import type { DiagramElement } from "@/app/lib/editor-types";
import type PptxGenJS from "pptxgenjs";
import { catalogEntry } from "@/app/lib/component-catalog";
import { isConnectionElement, isVectorElement, resolveDiagramElement } from "@/app/lib/diagram-model";

interface PptxSlideLike {
  addShape: (shape: PptxGenJS.ShapeType, options?: PptxGenJS.ShapeProps) => unknown;
  addText: (text: string | PptxGenJS.TextProps[], options?: PptxGenJS.TextPropsOptions) => unknown;
}

interface PptxShapeTypes {
  ellipse: PptxGenJS.ShapeType;
  line: PptxGenJS.ShapeType;
  rect: PptxGenJS.ShapeType;
}

const INCHES_PER_UNIT = 0.01;
const ORIGIN_X = 1.4;
const ORIGIN_Y = 0.45;

function point(element: DiagramElement, along: number) {
  const radians = element.rotation * Math.PI / 180;
  return {
    x: ORIGIN_X + (element.x + Math.cos(radians) * along) * INCHES_PER_UNIT,
    y: ORIGIN_Y + (element.y + Math.sin(radians) * along) * INCHES_PER_UNIT,
  };
}

function localPoint(element: DiagramElement, along: number, normal: number) {
  const radians = element.rotation * Math.PI / 180;
  return {
    x: ORIGIN_X + (element.x + Math.cos(radians) * along - Math.sin(radians) * normal) * INCHES_PER_UNIT,
    y: ORIGIN_Y + (element.y + Math.sin(radians) * along + Math.cos(radians) * normal) * INCHES_PER_UNIT,
  };
}

export function addCatalogElementsToPptx(slide: PptxSlideLike, shapeType: PptxShapeTypes, elements: readonly DiagramElement[]) {
  const ordered = [...elements]
    .sort((left, right) => Number(isVectorElement(left.kind)) - Number(isVectorElement(right.kind)))
    .map((element) => resolveDiagramElement(element, elements));

  for (const element of ordered) {
    if (!element.visible) continue;
    const objectName = `physics:${element.id}:${element.kind}`;
    const definition = catalogEntry(element.kind);
    const centerX = ORIGIN_X + element.x * INCHES_PER_UNIT;
    const centerY = ORIGIN_Y + element.y * INCHES_PER_UNIT;
    const width = Math.max(0.08, element.width * INCHES_PER_UNIT);
    const height = Math.max(0.08, element.height * INCHES_PER_UNIT);
    const line = { color: "18202B", width: Math.max(0.1, element.lineWidth * .75) };

    if (["moment", "angular-velocity", "angular-acceleration", "rotation-direction"].includes(element.kind)) {
      const radius = Math.min(element.width, element.height) * .36;
      let previous = localPoint(element, Math.cos(Math.PI * .25) * radius, Math.sin(Math.PI * .25) * radius);
      for (let index = 1; index <= 18; index += 1) {
        const angle = Math.PI * .25 + (Math.PI * 1.6 * index / 18);
        const current = localPoint(element, Math.cos(angle) * radius, Math.sin(angle) * radius);
        slide.addShape(shapeType.line, { objectName: `${objectName}:arc`, x: previous.x, y: previous.y, w: current.x - previous.x, h: current.y - previous.y, line: { ...line, endArrowType: index === 18 ? "triangle" : undefined } });
        previous = current;
      }
      if (element.label) slide.addText(element.label, { objectName: `${objectName}:label`, x: centerX - width * .55, y: centerY - height * .58, w: 0.6, h: 0.32, fontFace: "Cambria Math", fontSize: element.fontSize * .75, italic: true, align: "center", margin: 0 });
      continue;
    }

    if (isVectorElement(element.kind)) {
      const start = point(element, -element.width / 2);
      const end = point(element, element.width / 2);
      slide.addShape(shapeType.line, { objectName, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, line: { ...line, endArrowType: "triangle" } });
      slide.addText(element.label, { objectName: `${objectName}:label`, x: end.x + 0.08, y: end.y - 0.18, w: 0.65, h: 0.32, fontFace: "Cambria Math", fontSize: element.fontSize * .75, italic: true, margin: 0 });
      continue;
    }

    if (isConnectionElement(element.kind)) {
      const start = point(element, -element.width / 2);
      const end = point(element, element.width / 2);
      if (element.kind === "spring") {
        let previous = start;
        for (let index = 1; index <= 12; index += 1) {
          const t = index / 12;
          const baseX = start.x + (end.x - start.x) * t;
          const baseY = start.y + (end.y - start.y) * t;
          const offset = index === 12 ? 0 : (index % 2 ? -0.1 : 0.1);
          const current = { x: baseX - Math.sin(element.rotation * Math.PI / 180) * offset, y: baseY + Math.cos(element.rotation * Math.PI / 180) * offset };
          slide.addShape(shapeType.line, { objectName, x: previous.x, y: previous.y, w: current.x - previous.x, h: current.y - previous.y, line });
          previous = current;
        }
      } else {
        slide.addShape(shapeType.line, { objectName, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, line });
      }
      if (element.label) slide.addText(element.label, { objectName: `${objectName}:label`, x: centerX - 0.3, y: centerY - 0.35, w: 0.6, h: 0.3, fontFace: "Cambria Math", fontSize: element.fontSize * .75, italic: true, align: "center", margin: 0 });
      continue;
    }

    if (element.kind === "cylinder") {
      const ellipseHeight = Math.max(0.08, height * .28);
      slide.addShape(shapeType.ellipse, { objectName: `${objectName}:top`, x: centerX - width / 2, y: centerY - height * .38, w: width, h: ellipseHeight, fill: { color: "FFFFFF" }, line });
      slide.addShape(shapeType.line, { objectName: `${objectName}:left`, x: centerX - width / 2, y: centerY - height * .24, w: 0, h: height * .62, line });
      slide.addShape(shapeType.line, { objectName: `${objectName}:right`, x: centerX + width / 2, y: centerY - height * .24, w: 0, h: height * .62, line });
      slide.addShape(shapeType.ellipse, { objectName: `${objectName}:bottom`, x: centerX - width / 2, y: centerY + height * .24, w: width, h: ellipseHeight, fill: { color: "FFFFFF" }, line });
      if (element.label) slide.addText(element.label, { objectName: `${objectName}:label`, x: centerX - 0.4, y: centerY - 0.18, w: 0.8, h: 0.35, align: "center", fontFace: "Cambria Math", fontSize: element.fontSize * .75, italic: true, margin: 0 });
      continue;
    }

    const circular = ["point-mass", "sphere", "disk", "fixed-pulley", "movable-pulley", "wheel-axle", "rotation-axis", "circular-track", "center-of-mass", "point-label"].includes(element.kind);
    const lineLike = definition.category === "接触面" || definition.category === "支持" || definition.category === "軌道" || element.kind === "construction-line";
    if (lineLike) {
      const start = point(element, -element.width / 2);
      const end = point(element, element.width / 2);
      slide.addShape(shapeType.line, { objectName, x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y, line: { ...line, dashType: element.kind === "construction-line" ? "dash" : undefined } });
      if (["rough-floor", "rough-wall", "rough-incline"].includes(element.kind)) {
        for (let along = -element.width / 2 + 12; along < element.width / 2; along += 17) {
          const hatchStart = localPoint(element, along, 0);
          const hatchEnd = localPoint(element, along - 8, 11);
          slide.addShape(shapeType.line, { objectName: `${objectName}:roughness`, x: hatchStart.x, y: hatchStart.y, w: hatchEnd.x - hatchStart.x, h: hatchEnd.y - hatchStart.y, line });
        }
      }
    } else {
      slide.addShape(circular ? shapeType.ellipse : shapeType.rect, {
        objectName,
        x: centerX - width / 2,
        y: centerY - height / 2,
        w: width,
        h: height,
        rotate: element.rotation,
        fill: { color: element.kind === "fluid-region" ? "DDEAF8" : "FFFFFF", transparency: element.kind === "fluid-region" ? 35 : 0 },
        line,
      });
    }
    if (element.label) slide.addText(element.label, { objectName: `${objectName}:label`, x: centerX - 0.4, y: centerY - 0.18, w: 0.8, h: 0.35, align: "center", fontFace: "Cambria Math", fontSize: element.fontSize * .75, italic: true, margin: 0, rotate: lineLike ? 0 : element.rotation });
  }
}
