import type { DiagramElement } from "@/app/lib/editor-types";
import { isVectorElement, resolveDiagramElement } from "@/app/lib/diagram-model";

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

const vectorKinds = new Set(["force", "gravity", "normal-force", "friction-force", "tension", "spring-force", "drag-force", "buoyancy", "thrust", "velocity", "acceleration", "momentum"]);
const rotationalVectorKinds = new Set(["moment", "angular-velocity", "angular-acceleration", "rotation-direction"]);
const circularKinds = new Set(["sphere", "disk", "fixed-pulley", "movable-pulley", "wheel-axle", "rotation-axis", "circular-track"]);
const connectionKinds = new Set(["string", "rope", "cable", "light-rod", "straight-track", "construction-line", "strut"]);

function springPath(width: number) {
  const points = [`${-width / 2},0`];
  for (let index = 1; index < 12; index += 1) points.push(`${-width / 2 + width * index / 12},${index % 2 ? -12 : 12}`);
  points.push(`${width / 2},0`);
  return points.join(" ");
}

function makeSvgText(x: number, y: number, text: string, fontSize: number, italic: boolean, rotation: number, anchor = "middle") {
  if (!text) return "";
  const fontStyle = italic ? ' font-style="italic"' : "";
  const anchorAttr = anchor ? ` text-anchor="${anchor}"` : "";
  const rotAttr = rotation ? ` transform="rotate(${-rotation} ${x} ${y})"` : "";
  return `<text x="${x}" y="${y}"${anchorAttr} font-size="${fontSize}"${fontStyle}${rotAttr}>${text}</text>`;
}

function surfaceBody(width: number, lineWidth: number, fontSize: number, label: string, rough: boolean, rotation: number) {
  const hatches = rough
    ? Array.from({ length: Math.max(1, Math.floor((width - 18) / 17)) }, (_, index) => {
        const x = -width / 2 + 12 + index * 17;
        return `M${x},0 l-8,11`;
      }).join(" ")
    : "";
  return `<path d="M${-width / 2},0 L${width / 2},0 ${hatches}" fill="none" stroke="#18202b" stroke-width="${lineWidth}"/>${makeSvgText(0, rough ? 24 : 18, label, fontSize, true, rotation)}`;
}

export function diagramElementToSvg(element: DiagramElement) {
  if (!element.visible) return "";
  const w = element.width;
  const h = element.height;
  const fontSize = element.fontSize;
  const lineWidth = element.lineWidth;
  const label = escapeXml(element.label);
  const common = `fill="none" stroke="#18202b" stroke-width="${lineWidth}"`;
  const rot = element.rotation;
  let body = "";

  if (rotationalVectorKinds.has(element.kind)) {
    const labelX = -w * .31;
    const labelY = -h * .48;
    body = `<path d="M${w * .3},${-h * .15} A${w * .35},${h * .35} 0 1 1 ${-w * .15},${-h * .3}" ${common} marker-end="url(#arrow)"/>${makeSvgText(labelX, labelY, label, fontSize, true, rot)}`;
  } else if (vectorKinds.has(element.kind)) {
    const radians = element.rotation * Math.PI / 180;
    const labelX = w / 2 + 16 * Math.cos(radians) - 10 * Math.sin(radians);
    const labelY = -16 * Math.sin(radians) - 10 * Math.cos(radians);
    body = `<line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" ${common} marker-end="url(#arrow)"/>${makeSvgText(labelX, labelY, label, fontSize, true, rot)}`;
  } else if (circularKinds.has(element.kind)) {
    const radius = Math.min(w, h) / 2;
    body = `<circle cx="0" cy="0" r="${radius}" fill="white" stroke="#18202b" stroke-width="${lineWidth}"/>${element.kind === "disk" || element.kind === "wheel-axle" ? `<circle cx="0" cy="0" r="${radius * .38}" ${common}/>` : ""}${makeSvgText(0, 7, label, fontSize, true, rot)}`;
  } else if (connectionKinds.has(element.kind)) {
    const dash = element.kind === "cable" || element.kind === "construction-line" ? ` stroke-dasharray="8 5"` : "";
    const width = lineWidth * (element.kind === "light-rod" || element.kind === "strut" ? 2.5 : element.kind === "rope" ? 1.75 : 1);
    body = `<line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" stroke="#18202b" stroke-width="${width}"${dash}/>${makeSvgText(0, -13, label, fontSize, true, rot)}`;
  } else {
    switch (element.kind) {
      case "point-mass": body = `<circle cx="0" cy="0" r="7" fill="#18202b"/>${makeSvgText(18, -10, label, fontSize, true, rot, "")}`; break;
      case "block": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="white" stroke="#18202b" stroke-width="${lineWidth}"/>${makeSvgText(-w * .2, 7, label, fontSize, true, rot)}`; break;
      case "cylinder": body = `<ellipse cx="0" cy="${-h * .32}" rx="${w * .46}" ry="${h * .16}" fill="white" stroke="#18202b" stroke-width="${lineWidth}"/><path d="M${-w * .46},${-h * .32} L${-w * .46},${h * .32} M${w * .46},${-h * .32} L${w * .46},${h * .32}" ${common}/><ellipse cx="0" cy="${h * .32}" rx="${w * .46}" ry="${h * .16}" fill="white" stroke="#18202b" stroke-width="${lineWidth}"/>${makeSvgText(0, 7, label, fontSize, true, rot)}`; break;
      case "wedge": body = `<path d="M${-w / 2},${h / 2} L${w / 2},${h / 2} L${w / 2},${-h / 2} Z" fill="white" stroke="#18202b" stroke-width="${lineWidth}"/>${makeSvgText(w * .18, h * .16, label, fontSize, true, rot)}`; break;
      case "cart": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h * .65}" fill="white" stroke="#18202b" stroke-width="${lineWidth}"/><circle cx="${-w * .3}" cy="${h * .3}" r="${h * .14}" fill="#18202b"/><circle cx="${w * .3}" cy="${h * .3}" r="${h * .14}" fill="#18202b"/>${makeSvgText(0, -h * .1, label, fontSize, true, rot)}`; break;
      case "smooth-floor": case "smooth-wall": body = surfaceBody(w, lineWidth, fontSize, label, false, rot); break;
      case "rough-floor": case "rough-wall": body = surfaceBody(w, lineWidth, fontSize, label, true, rot); break;
      case "smooth-incline": case "rough-incline":
        const isRoughInc = element.kind === "rough-incline";
        if (element.shapeStyle === "line") {
          body = surfaceBody(w, lineWidth, fontSize, label, isRoughInc, rot);
        } else {
          const raSize = Math.min(w, h) * 0.15;
          body = `<path d="M${-w / 2},${-h / 2} L${-w / 2},${h / 2} L${w / 2},${h / 2} Z" fill="#f1f5f9" fill-opacity="0.6" stroke="#18202b" stroke-width="${lineWidth}"/><path d="M${-w / 2},${h / 2 - raSize} L${-w / 2 + raSize},${h / 2 - raSize} L${-w / 2 + raSize},${h / 2}" fill="none" stroke="#18202b" stroke-width="1.5"/>${isRoughInc ? `<line x1="${-w / 2}" y1="${h / 2}" x2="${w / 2}" y2="${h / 2}" stroke="#18202b" stroke-width="${lineWidth * 1.5}"/>` : ""}${makeSvgText(0, h / 2 + 20, label, fontSize, true, rot)}`;
        }
        break;
      case "spring": body = `<polyline points="${springPath(w)}" ${common}/>${makeSvgText(0, -19, label, fontSize, true, rot)}`; break;
      case "damper": body = `<line x1="${-w / 2}" y1="0" x2="${-w * .15}" y2="0" ${common}/><rect x="${-w * .15}" y="${-h * .28}" width="${w * .3}" height="${h * .56}" ${common}/><line x1="0" y1="${-h * .45}" x2="0" y2="${h * .45}" ${common}/><line x1="${w * .15}" y1="0" x2="${w / 2}" y2="0" ${common}/>${makeSvgText(0, -h * .6, label, fontSize, true, rot)}`; break;
      case "local-axis": body = `<line x1="0" y1="0" x2="${w * .4}" y2="0" ${common} marker-end="url(#arrow)"/><line x1="0" y1="0" x2="0" y2="${-h * .4}" ${common} marker-end="url(#arrow)"/>${makeSvgText(w * .43, 5, "x", fontSize, false, rot, "")}${makeSvgText(-8, -h * .43, "y", fontSize, false, rot, "")}`; break;
      case "angle-arc": body = `<path d="M0,0 L${w / 2},0 M0,0 L${w * .35},${-h * .35} M${w * .3},0 A${w * .3},${h * .3} 0 0 0 ${w * .21},${-h * .21}" ${common}/>${makeSvgText(w * .3, -h * .12, label, fontSize, true, rot, "")}`; break;
      case "length-dimension": body = `<path d="M${-w / 2},0 L${w / 2},0 M${-w / 2},-10 L${-w / 2},10 M${w / 2},-10 L${w / 2},10" ${common}/>${makeSvgText(0, -14, label, fontSize, true, rot)}`; break;
      case "radius-dimension": body = `<circle cx="0" cy="0" r="${Math.min(w, h) * .42}" ${common}/><line x1="0" y1="0" x2="${w * .42}" y2="0" ${common} marker-end="url(#arrow)"/>${makeSvgText(w * .2, -10, label, fontSize, true, rot, "")}`; break;
      case "center-of-mass": body = `<circle cx="0" cy="0" r="${Math.min(w, h) * .35}" ${common}/><path d="M${-w * .25},0 L${w * .25},0 M0,${-h * .25} L0,${h * .25}" ${common}/>${makeSvgText(w * .5, -h * .3, label, fontSize, false, rot, "")}`; break;
      case "point-label": body = `<circle cx="0" cy="0" r="4" fill="#18202b"/>${makeSvgText(14, -10, label, fontSize, false, rot, "")}`; break;
      case "text": body = `${makeSvgText(0, 0, label, fontSize, false, rot)}`; break;
      case "fluid-region": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#3178d4" fill-opacity=".12" stroke="#18202b" stroke-width="${lineWidth}"/>${makeSvgText(0, 7, label, fontSize, true, rot)}`; break;
      case "container": body = `<path d="M${-w / 2},${-h / 2} L${-w / 2},${h / 2} L${w / 2},${h / 2} L${w / 2},${-h / 2}" ${common}/>`; break;
      case "fluid-surface": body = `<path d="M${-w / 2},0 q10,-8 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0" ${common}/>`; break;
      case "curved-surface": case "curved-track": case "projectile-path": body = `<path d="M${-w / 2},${h * .3} Q0,${-h / 2} ${w / 2},${h * .3}" ${common}${element.kind === "projectile-path" ? ` stroke-dasharray="8 5"` : ""}/>`; break;
      case "ceiling": body = `<path d="M${-w / 2},0 L${w / 2},0" ${common}/>`; break;
      case "step": body = `<path d="M${-w / 2},${h / 2} L0,${h / 2} L0,0 L${w / 2},0 L${w / 2},${-h / 2}" ${common}/>`; break;
      case "corner": body = `<path d="M${-w / 2},${h / 2} L${w / 2},${h / 2} L${w / 2},${-h / 2}" ${common}/>`; break;
      case "compound-pulley": case "belt": body = `<circle cx="${-w * .25}" cy="0" r="${h * .25}" ${common}/><circle cx="${w * .25}" cy="0" r="${h * .25}" ${common}/><path d="M${-w * .25},${-h * .25} L${w * .25},${-h * .25} M${-w * .25},${h * .25} L${w * .25},${h * .25}" ${common}/>`; break;
      default: body = `<path d="M${-w / 2},${h / 2} L0,${-h / 2} L${w / 2},${h / 2} Z" ${common}/>${makeSvgText(0, h * .3, label, fontSize, true, rot)}`;
    }
  }

  return `<g data-layer="catalog-component" data-component-id="${escapeXml(element.id)}" data-component-kind="${element.kind}" transform="translate(${element.x} ${element.y}) rotate(${element.rotation})">${body}</g>`;
}

export function diagramElementsToSvg(elements: readonly DiagramElement[]) {
  return [...elements]
    .sort((left, right) => Number(isVectorElement(left.kind)) - Number(isVectorElement(right.kind)))
    .map((element) => diagramElementToSvg(resolveDiagramElement(element, elements))).join("");
}
