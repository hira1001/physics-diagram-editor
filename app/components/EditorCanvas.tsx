"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipHorizontal2, Link2, MoveUpRight, RotateCcw, Trash2, Unlink } from "lucide-react";
import { SceneNumericInput, SceneTextInput } from "@/app/components/SceneInputs";
import { VariableInput } from "@/app/components/VariableInput";
import type { DiagramElement, DiagramElementKind, PageKind, SceneState, SelectionId, ToolId } from "@/app/lib/editor-types";
import { blockRotationDegrees, effectiveSurfaceAngle, massLabelBaseX, surfaceContactClearance } from "@/app/lib/physics-rules";
import { catalogEntry, catalogEntryForTool, catalogSurfacePreset, createDiagramElement } from "@/app/lib/component-catalog";
import { diagramElementContainsPoint, drawDiagramElement } from "@/app/lib/catalog-renderer";
import { contextCandidatesForElement, createReferencedElement, createVariableForElement, decomposeVectorElement, findElementDependencies, getClosestFaceMidpoint, getElementActionPoint, getOccupiedFaceNames, isConnectionElement, isVectorElement, resolveDiagramElement } from "@/app/lib/diagram-model";
import { elementIdsInMarquee } from "@/app/lib/canvas-selection";
import { attachAllForcesForElement } from "@/app/lib/scenario-actions";

function pointToSegmentDistance(p: Point, a: Point, b: Point) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

export function findNearbySurfaceSnap(
  pointWorld: Point,
  scene: SceneState,
  geometry: Geometry,
  excludeId?: string
) {
  const edges: { name: string; p1: Point; p2: Point; angle: number }[] = [];

  if (scene.surfaceKind === "incline") {
    const angle = (scene.flipped ? 1 : -1) * scene.angle;
    edges.push({ name: `斜面 (${scene.angle}°)`, p1: geometry.start, p2: geometry.end, angle });
  }

  for (const elem of scene.elements) {
    if (elem.id === excludeId) continue;
    if (["smooth-incline", "rough-incline", "wedge"].includes(elem.kind)) {
      const rad = elem.rotation * Math.PI / 180;
      const slopeAngle = elem.rotation - Math.round(Math.atan2(elem.height, elem.width) * 180 / Math.PI);
      const p1 = {
        x: geometry.contentOrigin.x + (elem.x - Math.cos(rad) * (elem.width / 2) - Math.sin(rad) * (elem.height / 2)) * geometry.scale,
        y: geometry.contentOrigin.y + (elem.y - Math.sin(rad) * (elem.width / 2) + Math.cos(rad) * (elem.height / 2)) * geometry.scale,
      };
      const p2 = {
        x: geometry.contentOrigin.x + (elem.x + Math.cos(rad) * (elem.width / 2) + Math.sin(rad) * (elem.height / 2)) * geometry.scale,
        y: geometry.contentOrigin.y + (elem.y + Math.sin(rad) * (elem.width / 2) - Math.cos(rad) * (elem.height / 2)) * geometry.scale,
      };
      edges.push({ name: catalogEntry(elem.kind).name, p1, p2, angle: slopeAngle });
    }
  }

  let closest: { name: string; p1: Point; p2: Point; angle: number } | null = null;
  let minDist = 45 * geometry.scale;

  for (const edge of edges) {
    const dist = pointToSegmentDistance(pointWorld, edge.p1, edge.p2);
    if (dist < minDist) {
      minDist = dist;
      closest = edge;
    }
  }

  if (!closest) return null;
  return { ...closest, distance: minDist };
}

export interface GroundingSegment {
  name: string;
  p1: Point;
  p2: Point;
  angle: number;
}

export function findGroundingSurfaceSnap(
  element: DiagramElement,
  nextX: number,
  nextY: number,
  scene: SceneState,
  geometry: Geometry
) {
  const segments: GroundingSegment[] = [];
  const contentOrigin = geometry.contentOrigin;
  const scale = geometry.scale;

  const hasInclineElement = scene.elements.some((el) => ["smooth-incline", "rough-incline", "wedge"].includes(el.kind));
  if (scene.surfaceKind === "incline" && (scene.showAngle || hasInclineElement)) {
    const angle = (scene.flipped ? 1 : -1) * scene.angle;
    const startContent = {
      x: (geometry.start.x - contentOrigin.x) / scale,
      y: (geometry.start.y - contentOrigin.y) / scale,
    };
    const endContent = {
      x: (geometry.end.x - contentOrigin.x) / scale,
      y: (geometry.end.y - contentOrigin.y) / scale,
    };
    segments.push({ name: `斜面 (${scene.angle}°)`, p1: startContent, p2: endContent, angle });
  } else if (scene.surfaceKind === "floor") {
    segments.push({ name: "水平床", p1: { x: 0, y: 474 }, p2: { x: 1000, y: 474 }, angle: 0 });
  } else if (scene.surfaceKind === "wall") {
    const wallX = scene.flipped ? 300 : 700;
    segments.push({ name: "垂直壁", p1: { x: wallX, y: 0 }, p2: { x: wallX, y: 1000 }, angle: 90 });
  }

  for (const item of scene.elements) {
    if (item.id === element.id) continue;
    if (["smooth-incline", "rough-incline", "wedge"].includes(item.kind)) {
      const rad = item.rotation * Math.PI / 180;
      const slopeAngle = item.rotation - Math.round(Math.atan2(item.height, item.width) * 180 / Math.PI);
      const p1 = {
        x: item.x - Math.cos(rad) * (item.width / 2) - Math.sin(rad) * (item.height / 2),
        y: item.y - Math.sin(rad) * (item.width / 2) + Math.cos(rad) * (item.height / 2),
      };
      const p2 = {
        x: item.x + Math.cos(rad) * (item.width / 2) + Math.sin(rad) * (item.height / 2),
        y: item.y + Math.sin(rad) * (item.width / 2) - Math.cos(rad) * (item.height / 2),
      };
      segments.push({ name: catalogEntry(item.kind).name, p1, p2, angle: slopeAngle });
    } else if (["smooth-floor", "rough-floor", "smooth-wall", "rough-wall"].includes(item.kind)) {
      const rad = item.rotation * Math.PI / 180;
      const p1 = { x: item.x - Math.cos(rad) * (item.width / 2), y: item.y - Math.sin(rad) * (item.width / 2) };
      const p2 = { x: item.x + Math.cos(rad) * (item.width / 2), y: item.y + Math.sin(rad) * (item.width / 2) };
      segments.push({ name: catalogEntry(item.kind).name, p1, p2, angle: item.rotation });
    } else if (item.kind === "fixed-end") {
      const rad = item.rotation * Math.PI / 180;
      const p1 = { x: item.x - Math.sin(rad) * (item.height / 2), y: item.y + Math.cos(rad) * (item.height / 2) };
      const p2 = { x: item.x + Math.sin(rad) * (item.height / 2), y: item.y - Math.cos(rad) * (item.height / 2) };
      segments.push({ name: "固定端壁面", p1, p2, angle: item.rotation + 90 });
    } else if (["block", "cart"].includes(item.kind)) {
      const rad = item.rotation * Math.PI / 180;
      const p1 = {
        x: item.x - Math.cos(rad) * (item.width / 2) + Math.sin(rad) * (item.height / 2),
        y: item.y - Math.sin(rad) * (item.width / 2) - Math.cos(rad) * (item.height / 2),
      };
      const p2 = {
        x: item.x + Math.cos(rad) * (item.width / 2) + Math.sin(rad) * (item.height / 2),
        y: item.y + Math.sin(rad) * (item.width / 2) - Math.cos(rad) * (item.height / 2),
      };
      segments.push({ name: `${catalogEntry(item.kind).name} 天面`, p1, p2, angle: item.rotation });
    }
  }

  let closest: { segment: GroundingSegment; snappedX: number; snappedY: number; angle: number } | null = null;
  let minDist = 45;

  for (const seg of segments) {
    const l2 = (seg.p2.x - seg.p1.x) ** 2 + (seg.p2.y - seg.p1.y) ** 2;
    if (l2 === 0) continue;
    let t = ((nextX - seg.p1.x) * (seg.p2.x - seg.p1.x) + (nextY - seg.p1.y) * (seg.p2.y - seg.p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));

    const projX = seg.p1.x + t * (seg.p2.x - seg.p1.x);
    const projY = seg.p1.y + t * (seg.p2.y - seg.p1.y);

    const rad = (seg.angle * Math.PI) / 180;
    let normalX = Math.sin(rad);
    let normalY = -Math.cos(rad);

    const elemRad = (element.rotation * Math.PI) / 180;
    const relAngle = elemRad - rad;
    const clearance = (element.width / 2) * Math.abs(Math.sin(relAngle)) + (element.height / 2) * Math.abs(Math.cos(relAngle));

    const isVerticalWall = Math.abs(Math.sin(rad)) > 0.8;
    if (isVerticalWall) {
      if (nextX < projX) normalX = -Math.abs(normalX);
      else normalX = Math.abs(normalX);
    }

    const targetX = projX + normalX * clearance;
    const targetY = projY + normalY * clearance;

    const dist = Math.hypot(nextX - targetX, nextY - targetY);
    if (dist < minDist) {
      minDist = dist;
      closest = {
        segment: seg,
        snappedX: targetX,
        snappedY: targetY,
        angle: seg.angle,
      };
    }
  }

  return closest;
}

function findNearbyTargetElement(
  point: { x: number; y: number },
  elements: readonly DiagramElement[],
  excludeId?: string,
  maxDistance = 50,
) {
  let closest: DiagramElement | null = null;
  let minDistance = maxDistance;
  for (const item of elements) {
    if (item.id === excludeId || isConnectionElement(item.kind) || isVectorElement(item.kind) || ["length-dimension", "radius-dimension", "text", "point-label", "center-of-mass", "local-axis", "angle-arc"].includes(item.kind)) continue;
    const dx = point.x - item.x;
    const dy = point.y - item.y;
    const rad = -item.rotation * Math.PI / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
    const halfW = item.kind === "point-mass" ? 14 : Math.max(8, item.width / 2);
    const halfH = item.kind === "point-mass" ? 14 : Math.max(8, item.height / 2);
    const clampX = Math.max(-halfW, Math.min(halfW, localX));
    const clampY = Math.max(-halfH, Math.min(halfH, localY));
    const dist = Math.hypot(localX - clampX, localY - clampY);
    if (dist < minDistance) {
      minDistance = dist;
      closest = item;
    }
  }
  return closest;
}

export function getElementLabelWorldPosition(element: DiagramElement, geometry: Geometry) {
  const rad = element.rotation * Math.PI / 180;
  const lx = element.labelOffsetX ?? 0;
  const ly = element.labelOffsetY ?? 0;
  let baseX = 0;
  let baseY = -element.height / 2 - 14;

  if (element.kind === "point-mass") { baseX = 18; baseY = -12; }
  else if (element.kind === "block") { baseX = -element.width * 0.2; baseY = 7; }
  else if (element.kind === "sphere") { baseX = 0; baseY = 8; }
  else if (element.kind === "disk") { baseX = element.width * 0.22; baseY = -element.height * 0.18; }
  else if (["cylinder", "cart", "fluid-region"].includes(element.kind)) { baseX = 0; baseY = 7; }
  else if (["string", "rope", "cable", "light-rod", "strut"].includes(element.kind)) { baseX = 0; baseY = -14; }
  else if (element.kind === "spring") { baseX = 0; baseY = -19; }
  else if (element.kind === "damper") { baseX = 0; baseY = -element.height * 0.65; }
  else if (isVectorElement(element.kind)) { baseX = element.width / 2 + 16; baseY = -10; }

  const totalX = baseX + lx;
  const totalY = baseY + ly;

  return {
    x: geometry.contentOrigin.x + (element.x + totalX * Math.cos(rad) - totalY * Math.sin(rad)) * geometry.scale,
    y: geometry.contentOrigin.y + (element.y + totalX * Math.sin(rad) + totalY * Math.cos(rad)) * geometry.scale,
  };
}

interface EditorCanvasProps {
  activeTool: ToolId;
  pageKind: PageKind;
  scene: SceneState;
  zoom: number;
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  onCommitSnapshot: (scene: SceneState) => void;
  onCreateFreeBody: () => void;
  onPointerPositionChange: (point: Point) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
  onToolComplete: () => void;
  onUserNotice?: (message: string) => void;
}

export interface Point { x: number; y: number }

export interface Geometry {
  anglePoint: Point;
  artboard: { x: number; y: number; width: number; height: number };
  annotationPoint: Point;
  blockCenter: Point;
  contentOrigin: Point;
  end: Point;
  forceFrictionEnd: Point;
  forceGravityEnd: Point;
  forceNormalEnd: Point;
  forceGravityLabelPoint: Point;
  forceNormalLabelPoint: Point;
  forceFrictionLabelPoint: Point;
  massLabelPoint: Point;
  origin: Point;
  scale: number;
  start: Point;
  tangent: Point;
  normal: Point;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return distance(point, start);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

export function createGeometry(width: number, height: number, scene: SceneState, zoom: number): Geometry & { forceGravityLabelPoint: Point; forceNormalLabelPoint: Point; forceFrictionLabelPoint: Point } {
  const artboard = {
    x: 42,
    y: 30,
    width: Math.max(520, width - 84),
    height: Math.max(360, height - 62),
  };
  const scale = Math.min(artboard.width / 1000, artboard.height / 650) * (zoom / 100);
  const contentWidth = 1000 * scale;
  const contentHeight = 650 * scale;
  const offsetX = artboard.x + (artboard.width - contentWidth) / 2;
  const offsetY = artboard.y + (artboard.height - contentHeight) / 2;
  const toPoint = (x: number, y: number): Point => ({ x: offsetX + x * scale, y: offsetY + y * scale });
  const direction = scene.flipped ? -1 : 1;
  const start = toPoint(
    (scene.flipped ? 795 : 205) + scene.diagramOffsetX,
    (scene.surfaceKind === "wall" ? 550 : 474) + scene.diagramOffsetY,
  );
  const length = (scene.surfaceKind === "wall" ? 460 : 590) * scale;
  const radians = (effectiveSurfaceAngle(scene) * Math.PI) / 180;
  const tangent = { x: direction * Math.cos(radians), y: -Math.sin(radians) };
  const normal = { x: -direction * Math.sin(radians), y: -Math.cos(radians) };
  const end = { x: start.x + tangent.x * length, y: start.y + tangent.y * length };
  const linePoint = {
    x: start.x + tangent.x * length * scene.blockPosition,
    y: start.y + tangent.y * length * scene.blockPosition,
  };
  const blockCenter = {
    x: linePoint.x + normal.x * surfaceContactClearance(scene.surfaceKind) * scale + scene.blockOffsetX * scale,
    y: linePoint.y + normal.y * surfaceContactClearance(scene.surfaceKind) * scale + scene.blockOffsetY * scale,
  };
  const forceLength = 116 * scale * scene.forceScale;
  const forceGravityEnd = { x: blockCenter.x, y: blockCenter.y + forceLength };
  const forceNormalEnd = { x: blockCenter.x + normal.x * forceLength, y: blockCenter.y + normal.y * forceLength };
  const forceFrictionEnd = { x: blockCenter.x + tangent.x * forceLength, y: blockCenter.y + tangent.y * forceLength };
  const blockRotation = (blockRotationDegrees(scene) * Math.PI) / 180;
  const massLocal = {
    x: (massLabelBaseX(scene) + scene.massLabelOffsetX) * scale,
    y: (18 + scene.massLabelOffsetY) * scale,
  };
  const massLabelPoint = {
    x: blockCenter.x + massLocal.x * Math.cos(blockRotation) - massLocal.y * Math.sin(blockRotation),
    y: blockCenter.y + massLocal.x * Math.sin(blockRotation) + massLocal.y * Math.cos(blockRotation),
  };
  const labelAngle = scene.flipped ? Math.PI + radians / 2 : -radians / 2;
  const anglePoint = {
    x: start.x + Math.cos(labelAngle) * 104 * scale + scene.angleLabelOffsetX * scale,
    y: start.y + Math.sin(labelAngle) * 104 * scale + scene.angleLabelOffsetY * scale,
  };

  const forceGravityLabelPoint = {
    x: forceGravityEnd.x + 18 * scale + (scene.forceGravityLabelOffsetX ?? 0) * scale,
    y: forceGravityEnd.y + (scene.forceGravityLabelOffsetY ?? 0) * scale,
  };
  const forceNormalLabelPoint = {
    x: forceNormalEnd.x + 18 * scale + (scene.forceNormalLabelOffsetX ?? 0) * scale,
    y: forceNormalEnd.y + (scene.forceNormalLabelOffsetY ?? 0) * scale,
  };
  const forceFrictionLabelPoint = {
    x: forceFrictionEnd.x + 18 * scale + (scene.forceFrictionLabelOffsetX ?? 0) * scale,
    y: forceFrictionEnd.y + (scene.forceFrictionLabelOffsetY ?? 0) * scale,
  };

  return {
    anglePoint,
    annotationPoint: {
      x: artboard.x + scene.annotationX * artboard.width,
      y: artboard.y + scene.annotationY * artboard.height,
    },
    artboard,
    blockCenter,
    contentOrigin: { x: offsetX, y: offsetY },
    end,
    forceFrictionEnd,
    forceGravityEnd,
    forceNormalEnd,
    forceGravityLabelPoint,
    forceNormalLabelPoint,
    forceFrictionLabelPoint,
    massLabelPoint,
    origin: toPoint(
      (scene.surfaceKind === "wall" ? (scene.flipped ? 300 : 700) : 150) + scene.diagramOffsetX,
      165 + scene.diagramOffsetY,
    ),
    scale,
    start,
    tangent,
    normal,
  };
}

function arrow(ctx: CanvasRenderingContext2D, start: Point, end: Point, label: string, scale: number, color = "#18202b", labelPointOverride?: Point) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 11 * scale;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2 * scale;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 7), end.y - head * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 7), end.y - head * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
  ctx.font = `italic ${Math.max(17, 24 * scale)}px Georgia, serif`;
  const labelX = labelPointOverride ? labelPointOverride.x : end.x + Math.cos(angle - Math.PI / 2) * 18 * scale;
  const labelY = labelPointOverride ? labelPointOverride.y : end.y + Math.sin(angle - Math.PI / 2) * 18 * scale;
  ctx.fillText(label, labelX, labelY);
  ctx.restore();
}

export interface CanvasOverlay {
  marquee?: { x1: number; y1: number; x2: number; y2: number };
  snapGuides?: { x?: number; y?: number };
}

export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, scene: SceneState, pageKind: PageKind, zoom: number, overlay?: CanvasOverlay) {
  const geometry = createGeometry(width, height, scene, zoom);
  const { artboard, scale } = geometry;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#e9edf2";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.shadowColor = "rgba(28, 39, 51, 0.10)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(artboard.x, artboard.y, artboard.width, artboard.height);
  ctx.restore();

  if (scene.grid) {
    ctx.save();
    ctx.strokeStyle = "#edf0f3";
    ctx.lineWidth = 1;
    const step = Math.max(18, 24 * scale);
    for (let x = artboard.x + step; x < artboard.x + artboard.width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, artboard.y); ctx.lineTo(x, artboard.y + artboard.height); ctx.stroke();
    }
    for (let y = artboard.y + step; y < artboard.y + artboard.height; y += step) {
      ctx.beginPath(); ctx.moveTo(artboard.x, y); ctx.lineTo(artboard.x + artboard.width, y); ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(artboard.x, artboard.y, artboard.width, artboard.height);
  ctx.clip();

  // Catalog elements only (legacy incline wizard drawing removed).
  for (const element of [
    ...scene.elements.filter((item) => !isVectorElement(item.kind)),
    ...scene.elements.filter((item) => isVectorElement(item.kind)),
  ]) {
    drawDiagramElement(
      ctx,
      resolveDiagramElement(element, scene.elements),
      geometry.contentOrigin,
      scale,
      scene.selectedId === `element:${element.id}` || scene.selectedId === `element-label:${element.id}`,
    );
  }

  // Highlight related elements (forces/annotations attached via referenceTargetId)
  if (typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:")) {
    const selectedEl = scene.elements.find((item) => `element:${item.id}` === scene.selectedId);
    if (selectedEl) {
      const relatedElements = scene.elements.filter((el) =>
        el.referenceTargetId === selectedEl.id
        || el.startTargetId === selectedEl.id
        || el.endTargetId === selectedEl.id
      );
      for (const rel of relatedElements) {
        const resolvedRel = resolveDiagramElement(rel, scene.elements);
        const relRad = resolvedRel.rotation * Math.PI / 180;
        const relHalfW = resolvedRel.width / 2;
        const relHalfH = resolvedRel.height / 2;
        ctx.save();
        ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.translate(geometry.contentOrigin.x + resolvedRel.x * scale, geometry.contentOrigin.y + resolvedRel.y * scale);
        ctx.rotate(relRad);
        ctx.strokeRect(-relHalfW * scale - 3, -relHalfH * scale - 3, resolvedRel.width * scale + 6, resolvedRel.height * scale + 6);
        ctx.restore();
      }
    }
  }

  // Render selection handles for selected diagram elements
  if (typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:")) {
    const selectedElement = scene.elements.find((item) => `element:${item.id}` === scene.selectedId);
    if (selectedElement) {
      const resolved = resolveDiagramElement(selectedElement, scene.elements);
      const rad = resolved.rotation * Math.PI / 180;
      const halfW = resolved.width / 2;
      const halfH = resolved.height / 2;

      const rotateWorld = {
        x: geometry.contentOrigin.x + (resolved.x + (0) * Math.cos(rad) - (-halfH - 28) * Math.sin(rad)) * scale,
        y: geometry.contentOrigin.y + (resolved.y + (0) * Math.sin(rad) + (-halfH - 28) * Math.cos(rad)) * scale,
      };
      const resizeWorld = {
        x: geometry.contentOrigin.x + (resolved.x + (halfW + 8) * Math.cos(rad) - (halfH + 8) * Math.sin(rad)) * scale,
        y: geometry.contentOrigin.y + (resolved.y + (halfW + 8) * Math.sin(rad) + (halfH + 8) * Math.cos(rad)) * scale,
      };

      ctx.save();
      ctx.strokeStyle = "#3178d4";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.translate(geometry.contentOrigin.x + resolved.x * scale, geometry.contentOrigin.y + resolved.y * scale);
      ctx.rotate(rad);
      ctx.strokeRect(-halfW * scale - 4, -halfH * scale - 4, resolved.width * scale + 8, resolved.height * scale + 8);
      ctx.restore();

      // Rotate & 8-Handle PowerPoint Resizing (for non-vector elements)
      if (!isVectorElement(resolved.kind)) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#3178d4";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rotateWorld.x, rotateWorld.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 8 handles (4 corners + 4 edge midpoints)
        const handles = [
          { x: -halfW - 4, y: -halfH - 4 }, // Top-Left
          { x: halfW + 4, y: -halfH - 4 },  // Top-Right
          { x: -halfW - 4, y: halfH + 4 },  // Bottom-Left
          { x: halfW + 4, y: halfH + 4 },   // Bottom-Right
          { x: 0, y: -halfH - 4 },          // Top-Mid
          { x: 0, y: halfH + 4 },           // Bottom-Mid
          { x: -halfW - 4, y: 0 },          // Left-Mid
          { x: halfW + 4, y: 0 },           // Right-Mid
        ];

        for (const h of handles) {
          const hWorld = {
            x: geometry.contentOrigin.x + (resolved.x + h.x * Math.cos(rad) - h.y * Math.sin(rad)) * scale,
            y: geometry.contentOrigin.y + (resolved.y + h.x * Math.sin(rad) + h.y * Math.cos(rad)) * scale,
          };
          ctx.fillRect(hWorld.x - 5, hWorld.y - 5, 10, 10);
          ctx.strokeRect(hWorld.x - 5, hWorld.y - 5, 10, 10);
        }
      }

      // Connection endpoint handles
      if (isConnectionElement(resolved.kind)) {
        const startWorld = {
          x: geometry.contentOrigin.x + (resolved.x - Math.cos(rad) * halfW) * scale,
          y: geometry.contentOrigin.y + (resolved.y - Math.sin(rad) * halfW) * scale,
        };
        const endWorld = {
          x: geometry.contentOrigin.x + (resolved.x + Math.cos(rad) * halfW) * scale,
          y: geometry.contentOrigin.y + (resolved.y + Math.sin(rad) * halfW) * scale,
        };

        const startTarget = scene.elements.find((e) => e.id === resolved.startTargetId);
        const endTarget = scene.elements.find((e) => e.id === resolved.endTargetId);
        const startText = startTarget ? `始点: ${startTarget.label || catalogEntry(startTarget.kind).name}` : "始点(ドラッグ接続)";
        const endText = endTarget ? `終点: ${endTarget.label || catalogEntry(endTarget.kind).name}` : "終点(ドラッグ接続)";

        // Start handle (green dot)
        ctx.fillStyle = resolved.startTargetId ? "#22c55e" : "#ffffff";
        ctx.strokeStyle = "#15803d";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(startWorld.x, startWorld.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 10px sans-serif";
        const startMetrics = ctx.measureText(startText);
        ctx.fillStyle = "rgba(21, 128, 61, 0.9)";
        ctx.fillRect(startWorld.x - startMetrics.width / 2 - 4, startWorld.y - 24, startMetrics.width + 8, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(startText, startWorld.x - startMetrics.width / 2, startWorld.y - 12);

        // End handle (blue dot)
        ctx.fillStyle = resolved.endTargetId ? "#3b82f6" : "#ffffff";
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(endWorld.x, endWorld.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const endMetrics = ctx.measureText(endText);
        ctx.fillStyle = "rgba(29, 78, 216, 0.9)";
        ctx.fillRect(endWorld.x - endMetrics.width / 2 - 4, endWorld.y - 24, endMetrics.width + 8, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(endText, endWorld.x - endMetrics.width / 2, endWorld.y - 12);
      }

      // Vector tip handle (red dot)
      if (isVectorElement(resolved.kind)) {
        const tipWorld = {
          x: geometry.contentOrigin.x + (resolved.x + Math.cos(rad) * halfW) * scale,
          y: geometry.contentOrigin.y + (resolved.y + Math.sin(rad) * halfW) * scale,
        };
        ctx.fillStyle = "#ef4444";
        ctx.strokeStyle = "#b91c1c";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(tipWorld.x, tipWorld.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Label handle (purple dot)
      if (selectedElement.label) {
        const labelWorld = getElementLabelWorldPosition(selectedElement, geometry);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(labelWorld.x, labelWorld.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 9px sans-serif";
        ctx.fillStyle = "#8b5cf6";
        ctx.textAlign = "center";
        ctx.fillText("文字", labelWorld.x, labelWorld.y - 12);
      }
    }
  }

  ctx.restore();

  if (overlay?.snapGuides?.x !== undefined) {
    ctx.save();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(overlay.snapGuides.x, 0);
    ctx.lineTo(overlay.snapGuides.x, height);
    ctx.stroke();
    ctx.restore();
  }
  if (overlay?.snapGuides?.y !== undefined) {
    ctx.save();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.9)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(0, overlay.snapGuides.y);
    ctx.lineTo(width, overlay.snapGuides.y);
    ctx.stroke();
    ctx.restore();
  }
  if (overlay?.marquee) {
    const { x1, y1, x2, y2 } = overlay.marquee;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    const windowSelection = x2 >= x1;
    ctx.save();
    ctx.fillStyle = windowSelection ? "rgba(59, 130, 246, 0.15)" : "rgba(34, 197, 94, 0.15)";
    ctx.strokeStyle = windowSelection ? "rgba(59, 130, 246, 0.85)" : "rgba(34, 197, 94, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash(windowSelection ? [] : [6, 4]);
    ctx.fillRect(left, top, w, h);
    ctx.strokeRect(left, top, w, h);
    ctx.restore();
  }

  return geometry;
}

function hitTest(point: Point, geometry: Geometry, scene: SceneState): SelectionId {
  const contentPoint = {
    x: (point.x - geometry.contentOrigin.x) / geometry.scale,
    y: (point.y - geometry.contentOrigin.y) / geometry.scale,
  };

  if (typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:")) {
    const element = scene.elements.find((item) => `element:${item.id}` === scene.selectedId);
    if (element) {
      const rad = element.rotation * Math.PI / 180;
      if (!isVectorElement(element.kind)) {
        const rotateHandleWorld = {
          x: geometry.contentOrigin.x + (element.x + (0) * Math.cos(rad) - (-element.height / 2 - 28) * Math.sin(rad)) * geometry.scale,
          y: geometry.contentOrigin.y + (element.y + (0) * Math.sin(rad) + (-element.height / 2 - 28) * Math.cos(rad)) * geometry.scale,
        };
        if (distance(point, rotateHandleWorld) < 18) return scene.selectedId;

        const resizeHandleWorld = {
          x: geometry.contentOrigin.x + (element.x + (element.width / 2 + 8) * Math.cos(rad) - (element.height / 2 + 8) * Math.sin(rad)) * geometry.scale,
          y: geometry.contentOrigin.y + (element.y + (element.width / 2 + 8) * Math.sin(rad) + (element.height / 2 + 8) * Math.cos(rad)) * geometry.scale,
        };
        if (distance(point, resizeHandleWorld) < 18) return scene.selectedId;
      }

      if (isConnectionElement(element.kind)) {
        const halfW = element.width / 2;
        const startHandleWorld = {
          x: geometry.contentOrigin.x + (element.x - Math.cos(rad) * halfW) * geometry.scale,
          y: geometry.contentOrigin.y + (element.y - Math.sin(rad) * halfW) * geometry.scale,
        };
        const endHandleWorld = {
          x: geometry.contentOrigin.x + (element.x + Math.cos(rad) * halfW) * geometry.scale,
          y: geometry.contentOrigin.y + (element.y + Math.sin(rad) * halfW) * geometry.scale,
        };
        if (distance(point, startHandleWorld) < 18) return scene.selectedId;
        if (distance(point, endHandleWorld) < 18) return scene.selectedId;
      }

      if (isVectorElement(element.kind)) {
        const halfW = element.width / 2;
        const tipHandleWorld = {
          x: geometry.contentOrigin.x + (element.x + Math.cos(rad) * halfW) * geometry.scale,
          y: geometry.contentOrigin.y + (element.y + Math.sin(rad) * halfW) * geometry.scale,
        };
        if (distance(point, tipHandleWorld) < 18) return scene.selectedId;
      }

      if (element.label) {
        const labelWorld = getElementLabelWorldPosition(element, geometry);
        if (distance(point, labelWorld) < 10) return scene.selectedId;
      }
    }
  }

  if (typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:")) {
    const selectedElement = scene.elements.find((item) => `element:${item.id}` === scene.selectedId);
    if (selectedElement && diagramElementContainsPoint(resolveDiagramElement(selectedElement, scene.elements), contentPoint)) return scene.selectedId;
  }
  const layeredElements = [...scene.elements.filter((item) => !isVectorElement(item.kind)), ...scene.elements.filter((item) => isVectorElement(item.kind))];
  for (let index = layeredElements.length - 1; index >= 0; index -= 1) {
    const element = resolveDiagramElement(layeredElements[index], scene.elements);
    if (`element:${element.id}` === scene.selectedId) continue;
    if (diagramElementContainsPoint(element, contentPoint)) return `element:${element.id}`;
  }
  return null;
}

export function EditorCanvas({
  activeTool,
  pageKind,
  scene,
  zoom,
  onCanvasReady,
  onCommitSnapshot,
  onCreateFreeBody,
  onPointerPositionChange,
  onSceneChange,
  onToolComplete,
  onUserNotice,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStartSceneRef = useRef<SceneState | null>(null);
  const dragStartPointRef = useRef<Point | null>(null);
  const activeResizeHandleRef = useRef<string | null>(null);
  const boxSelectEndRef = useRef<Point | null>(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 });
  const [canvasOverlay, setCanvasOverlay] = useState<CanvasOverlay>({});
  const [dragMode, setDragMode] = useState<"angle" | "angle-label" | "block" | "box-select" | "diagram" | "element" | "element-label" | "element-rotate" | "element-resize" | "element-start-point" | "element-end-point" | "element-vector-tip" | "force" | "force-gravity-label" | "force-normal-label" | "force-friction-label" | "freebody" | "mass-label" | "text" | null>(null);
  const [suggestion, setSuggestion] = useState<Point | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawScene(ctx, size.width, size.height, scene, pageKind, zoom, canvasOverlay);
    onCanvasReady(canvas);
  }, [canvasOverlay, onCanvasReady, pageKind, scene, size, zoom]);

  const geometry = useMemo(() => createGeometry(size.width, size.height, scene, zoom), [scene, size, zoom]);

  // Keyboard shortcuts for force addition and element actions
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.metaKey || event.ctrlKey) return;

      const sel = typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:")
        ? scene.elements.find((item) => `element:${item.id}` === scene.selectedId)
        : null;

      if (!sel) return;

      // Delete / Backspace: delete selected element
      if (event.key === "Delete" || event.key === "Backspace") {
        const deps = findElementDependencies(sel.id, scene.elements, scene.variables, scene.constraints);
        if (deps.connections.length || deps.variables.length || deps.constraints.length) {
          event.preventDefault();
          onUserNotice?.("参照中のため削除できません。右パネルで依存を確認してください。");
          return;
        }
        event.preventDefault();
        onSceneChange({ elements: scene.elements.filter((item) => item.id !== sel.id), selectedId: null });
        return;
      }

      // D: decompose vector into components
      if (event.key === "d" || event.key === "D") {
        if (!isVectorElement(sel.kind)) return;
        const existingDecomp = scene.constraints.find((c) => c.kind === "same-variable" && c.targetIds[0] === sel.id && c.targetIds.length === 3);
        if (existingDecomp) return;
        const decomposition = decomposeVectorElement(sel, scene.variables);
        if (!decomposition) return;
        event.preventDefault();
        onSceneChange({
          constraints: [...scene.constraints, decomposition.constraint],
          elements: [...scene.elements, ...decomposition.components],
          selectedId: `element:${sel.id}`,
          variables: decomposition.variables,
        });
        return;
      }

      // Quick force shortcuts: G=gravity, N=normal, F=friction, T=tension
      if (isVectorElement(sel.kind)) return; // only for body/surface elements
      const shortcutMap: Record<string, string> = { g: "gravity", n: "normal-force", f: "friction-force", t: "tension" };
      const kind = shortcutMap[event.key.toLowerCase()];
      if (!kind) return;
      const candidates = contextCandidatesForElement(sel);
      if (!candidates.includes(kind as any)) return;
      const alreadyAttached = scene.elements.some((el) => el.referenceTargetId === sel.id && el.kind === kind);
      if (alreadyAttached) return;
      event.preventDefault();
      const newEl = createReferencedElement(kind as any, sel);
      const newVar = createVariableForElement(newEl);
      onSceneChange({
        elements: [...scene.elements, newEl],
        variables: [...scene.variables, newVar],
        selectedId: `element:${newEl.id}`,
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onUserNotice, scene, onSceneChange]);

  const canvasPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointer(point);
    onPointerPositionChange({
      x: Math.round((point.x - geometry.artboard.x) / geometry.scale),
      y: Math.round((point.y - geometry.artboard.y) / geometry.scale),
    });
    setSuggestion(null);

    if (activeTool !== "select") {
      const catalogDefinition = catalogEntryForTool(activeTool);
      if (catalogDefinition) {
        let element = createDiagramElement(
          catalogDefinition.kind,
          clamp((point.x - geometry.contentOrigin.x) / geometry.scale, 0, 1000),
          clamp((point.y - geometry.contentOrigin.y) / geometry.scale, 0, 650),
        );
        if (isConnectionElement(element.kind)) {
          const contentPt = {
            x: clamp((point.x - geometry.contentOrigin.x) / geometry.scale, 0, 1000),
            y: clamp((point.y - geometry.contentOrigin.y) / geometry.scale, 0, 650),
          };
          const radians = element.rotation * Math.PI / 180;
          const halfW = element.width / 2;
          const startPos = { x: contentPt.x - Math.cos(radians) * halfW, y: contentPt.y - Math.sin(radians) * halfW };
          const endPos = { x: contentPt.x + Math.cos(radians) * halfW, y: contentPt.y + Math.sin(radians) * halfW };
          const startTarget = findNearbyTargetElement(startPos, scene.elements, element.id, 75);
          const endTarget = findNearbyTargetElement(endPos, scene.elements, element.id, 75);
          if (startTarget) element.startTargetId = startTarget.id;
          if (endTarget && endTarget.id !== element.startTargetId) element.endTargetId = endTarget.id;
          element = resolveDiagramElement(element, scene.elements);
        }
        onSceneChange({ elements: [...scene.elements, element], selectedId: `element:${element.id}` });
        onToolComplete();
        return;
      }
      // Map remaining legacy tool ids to catalog parts.
      const legacyKindMap: Record<string, DiagramElementKind | undefined> = {
        block: "block",
        force: "force",
        angle: "angle-arc",
        axis: "local-axis",
        spring: "spring",
        pulley: "fixed-pulley",
        text: "text",
        incline: "rough-incline",
        "surface-rough-floor": "rough-floor",
        "surface-rough-incline": "rough-incline",
        "surface-rough-wall": "rough-wall",
        "surface-smooth-floor": "smooth-floor",
        "surface-smooth-incline": "smooth-incline",
        "surface-smooth-wall": "smooth-wall",
      };
      const mappedKind = legacyKindMap[activeTool];
      if (mappedKind) {
        const element = createDiagramElement(
          mappedKind,
          clamp((point.x - geometry.contentOrigin.x) / geometry.scale, 0, 1000),
          clamp((point.y - geometry.contentOrigin.y) / geometry.scale, 0, 650),
        );
        onSceneChange({ elements: [...scene.elements, element], selectedId: `element:${element.id}` });
      }
      onToolComplete();
      return;
    }

    const sceneHit = hitTest(point, geometry, scene);
    const hit = sceneHit;
    onSceneChange({ selectedId: hit, ...(hit ? {} : { selectedIds: [] }) });
    if (!hit) {
      if (activeTool === "select") {
        dragStartSceneRef.current = { ...scene };
        dragStartPointRef.current = point;
        setDragMode("box-select");
        setCanvasOverlay({ marquee: { x1: point.x, y1: point.y, x2: point.x, y2: point.y } });
      }
      return;
    }
    dragStartSceneRef.current = { ...scene };
    dragStartPointRef.current = point;

    if (hit.startsWith("element:")) {
      const element = scene.elements.find((item) => `element:${item.id}` === hit);
      if (element) {
        const rad = element.rotation * Math.PI / 180;
        const rotateHandleWorld = {
          x: geometry.contentOrigin.x + (element.x + (0) * Math.cos(rad) - (-element.height / 2 - 28) * Math.sin(rad)) * geometry.scale,
          y: geometry.contentOrigin.y + (element.y + (0) * Math.sin(rad) + (-element.height / 2 - 28) * Math.cos(rad)) * geometry.scale,
        };
        const halfW = element.width / 2;
        const halfH = element.height / 2;
        const handles = [
          { name: "top-left", x: -halfW - 4, y: -halfH - 4 },
          { name: "top-right", x: halfW + 4, y: -halfH - 4 },
          { name: "bottom-left", x: -halfW - 4, y: halfH + 4 },
          { name: "bottom-right", x: halfW + 4, y: halfH + 4 },
          { name: "top", x: 0, y: -halfH - 4 },
          { name: "bottom", x: 0, y: halfH + 4 },
          { name: "left", x: -halfW - 4, y: 0 },
          { name: "right", x: halfW + 4, y: 0 },
        ];
        let clickedResizeHandle: string | null = null;
        if (!isVectorElement(element.kind)) {
          for (const h of handles) {
            const hWorld = {
              x: geometry.contentOrigin.x + (element.x + h.x * Math.cos(rad) - h.y * Math.sin(rad)) * geometry.scale,
              y: geometry.contentOrigin.y + (element.y + h.x * Math.sin(rad) + h.y * Math.cos(rad)) * geometry.scale,
            };
            if (distance(point, hWorld) < 18) {
              clickedResizeHandle = h.name;
              break;
            }
          }
        }

        const startHandleWorld = {
          x: geometry.contentOrigin.x + (element.x - Math.cos(rad) * halfW) * geometry.scale,
          y: geometry.contentOrigin.y + (element.y - Math.sin(rad) * halfW) * geometry.scale,
        };
        const endHandleWorld = {
          x: geometry.contentOrigin.x + (element.x + Math.cos(rad) * halfW) * geometry.scale,
          y: geometry.contentOrigin.y + (element.y + Math.sin(rad) * halfW) * geometry.scale,
        };

        if (element.label && distance(point, getElementLabelWorldPosition(element, geometry)) < 10) {
          setDragMode("element-label");
        } else if (distance(point, rotateHandleWorld) < 18) {
          setDragMode("element-rotate");
        } else if (clickedResizeHandle) {
          activeResizeHandleRef.current = clickedResizeHandle;
          setDragMode("element-resize");
        } else if (isConnectionElement(element.kind) && distance(point, startHandleWorld) < 18) {
          setDragMode("element-start-point");
        } else if (isConnectionElement(element.kind) && distance(point, endHandleWorld) < 18) {
          setDragMode("element-end-point");
        } else if (isVectorElement(element.kind) && distance(point, endHandleWorld) < 18) {
          setDragMode("element-vector-tip");
        } else if (!element.locked) {
          setDragMode("element");
        }
      }
    }
  }, [activeTool, canvasPoint, geometry, onPointerPositionChange, onSceneChange, onToolComplete, scene]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const droppedTool = event.dataTransfer.getData("application/x-physics-tool") as ToolId;
    const validTools: ToolId[] = ["incline", "surface-rough-floor", "surface-rough-incline", "surface-rough-wall", "surface-smooth-floor", "surface-smooth-incline", "surface-smooth-wall", "block", "force", "angle", "axis", "spring", "pulley", "text"];
    const catalogDefinition = catalogEntryForTool(droppedTool);
    if (!validTools.includes(droppedTool) && !catalogDefinition) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (catalogDefinition) {
      let element = createDiagramElement(
        catalogDefinition.kind,
        clamp((point.x - geometry.contentOrigin.x) / geometry.scale, 0, 1000),
        clamp((point.y - geometry.contentOrigin.y) / geometry.scale, 0, 650),
      );
      if (isConnectionElement(element.kind)) {
        const radians = element.rotation * Math.PI / 180;
        const halfW = element.width / 2;
        const startPos = { x: element.x - Math.cos(radians) * halfW, y: element.y - Math.sin(radians) * halfW };
        const endPos = { x: element.x + Math.cos(radians) * halfW, y: element.y + Math.sin(radians) * halfW };
        const startTarget = findNearbyTargetElement(startPos, scene.elements, element.id, 55);
        const endTarget = findNearbyTargetElement(endPos, scene.elements, element.id, 55);
        if (startTarget) element.startTargetId = startTarget.id;
        if (endTarget && endTarget.id !== element.startTargetId) element.endTargetId = endTarget.id;
        element = resolveDiagramElement(element, scene.elements);
      }
      onSceneChange({ elements: [...scene.elements, element], selectedId: `element:${element.id}` });
      onToolComplete();
      return;
    }
    const legacyKindMap: Record<string, DiagramElementKind | undefined> = {
      block: "block",
      force: "force",
      angle: "angle-arc",
      axis: "local-axis",
      spring: "spring",
      pulley: "fixed-pulley",
      text: "text",
      incline: "rough-incline",
      "surface-rough-floor": "rough-floor",
      "surface-rough-incline": "rough-incline",
      "surface-rough-wall": "rough-wall",
      "surface-smooth-floor": "smooth-floor",
      "surface-smooth-incline": "smooth-incline",
      "surface-smooth-wall": "smooth-wall",
    };
    const mappedKind = legacyKindMap[droppedTool];
    if (mappedKind) {
      const element = createDiagramElement(
        mappedKind,
        clamp((point.x - geometry.contentOrigin.x) / geometry.scale, 0, 1000),
        clamp((point.y - geometry.contentOrigin.y) / geometry.scale, 0, 650),
      );
      onSceneChange({ elements: [...scene.elements, element], selectedId: `element:${element.id}` });
    }
    onToolComplete();
  }, [geometry, onSceneChange, onToolComplete, scene.elements]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    setPointer(point);
    onPointerPositionChange({
      x: Math.round((point.x - geometry.artboard.x) / geometry.scale),
      y: Math.round((point.y - geometry.artboard.y) / geometry.scale),
    });
    const startScene = dragStartSceneRef.current;
    const startPoint = dragStartPointRef.current;

    if (dragMode === "box-select" && startPoint) {
      boxSelectEndRef.current = point;
      setCanvasOverlay({ marquee: { x1: startPoint.x, y1: startPoint.y, x2: point.x, y2: point.y } });
      return;
    }

    if ((dragMode === "diagram" || dragMode === "freebody") && startScene && startPoint) {
      const nextX = startScene.diagramOffsetX + (point.x - startPoint.x) / geometry.scale;
      const nextY = startScene.diagramOffsetY + (point.y - startPoint.y) / geometry.scale;
      onSceneChange({ diagramOffsetX: nextX, diagramOffsetY: nextY }, false);
      return;
    }

    if (dragMode === "element-rotate" && startScene && typeof scene.selectedId === "string") {
      const elementId = scene.selectedId.slice("element:".length);
      const element = scene.elements.find((item) => item.id === elementId);
      if (element) {
        const contentX = (point.x - geometry.contentOrigin.x) / geometry.scale;
        const contentY = (point.y - geometry.contentOrigin.y) / geometry.scale;
        const pivotX = isVectorElement(element.kind) ? getElementActionPoint(element, scene.elements).x : element.x;
        const pivotY = isVectorElement(element.kind) ? getElementActionPoint(element, scene.elements).y : element.y;
        const rad = Math.atan2(contentY - pivotY, contentX - pivotX);
        let deg = isVectorElement(element.kind)
          ? (rad * 180 / Math.PI)
          : (rad * 180 / Math.PI + 90);
        if (event.altKey) {
          deg = Math.round(deg * 10) / 10;
        } else if (event.shiftKey) {
          deg = Math.round(deg / 15) * 15;
        } else if (scene.snapEnabled) {
          const targetAngles: number[] = [];
          if (scene.surfaceKind === "incline") {
            const inclineAngle = (scene.flipped ? 1 : -1) * scene.angle;
            targetAngles.push(inclineAngle, (inclineAngle + 360) % 360, (inclineAngle + 180) % 360);
          }
          for (const elem of scene.elements) {
            if (elem.id === elementId) continue;
            if (["smooth-incline", "rough-incline", "wedge"].includes(elem.kind)) {
              const slopeAngle = elem.rotation - Math.round(Math.atan2(elem.height, elem.width) * 180 / Math.PI);
              targetAngles.push(slopeAngle, (slopeAngle + 360) % 360, (slopeAngle + 180) % 360);
            }
          }

          const matchedSurfaceAngle = targetAngles.find((target) => {
            const normTarget = (target % 360 + 360) % 360;
            const normDeg = (deg % 360 + 360) % 360;
            return Math.abs(normTarget - normDeg) <= 10 || Math.abs(normTarget - normDeg - 360) <= 10;
          });

          if (matchedSurfaceAngle !== undefined) {
            deg = matchedSurfaceAngle;
          } else {
            const majorAngles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -165, -150, -135, -120, -105, -90, -75, -60, -45, -30, -15];
            const closest = majorAngles.reduce((prev, curr) => Math.abs(curr - deg) < Math.abs(prev - deg) ? curr : prev);
            if (Math.abs(closest - deg) <= 3 || Math.abs(closest - deg - 360) <= 3) {
              deg = closest;
            } else {
              deg = Math.round(deg);
            }
          }
        }
        onSceneChange({ elements: scene.elements.map((item) => item.id === elementId ? { ...item, rotation: deg } : item) }, false);
        return;
      }
    }

    if (dragMode === "element-resize" && startScene && startPoint && typeof scene.selectedId === "string") {
      const elementId = scene.selectedId.slice("element:".length);
      const original = startScene.elements.find((item) => item.id === elementId);
      if (original) {
        const rad = (original.rotation * Math.PI) / 180;
        const dx = (point.x - startPoint.x) / geometry.scale;
        const dy = (point.y - startPoint.y) / geometry.scale;
        const localDx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
        const localDy = dx * Math.sin(-rad) + dy * Math.cos(-rad);

        const handle = activeResizeHandleRef.current ?? "right";
        const isCorner = handle.includes("-");
        const isCenterScale = event.ctrlKey;

        let newWidth = original.width;
        let newHeight = original.height;
        let localShiftX = 0;
        let localShiftY = 0;

        if (isCorner && !event.shiftKey) {
          const aspect = original.width / original.height;
          const delta = handle.includes("right") ? localDx : -localDx;
          newWidth = Math.max(16, original.width + delta);
          newHeight = Math.max(16, newWidth / aspect);
          if (!isCenterScale) {
            localShiftX = (handle.includes("right") ? (newWidth - original.width) : -(newWidth - original.width)) / 2;
            localShiftY = (handle.includes("bottom") ? (newHeight - original.height) : -(newHeight - original.height)) / 2;
          }
        } else {
          if (handle.includes("right")) {
            newWidth = Math.max(16, isCenterScale ? original.width + localDx * 2 : original.width + localDx);
            if (!isCenterScale) localShiftX = (newWidth - original.width) / 2;
          } else if (handle.includes("left")) {
            newWidth = Math.max(16, isCenterScale ? original.width - localDx * 2 : original.width - localDx);
            if (!isCenterScale) localShiftX = -(newWidth - original.width) / 2;
          }

          if (handle.includes("bottom")) {
            newHeight = Math.max(16, isCenterScale ? original.height + localDy * 2 : original.height + localDy);
            if (!isCenterScale) localShiftY = (newHeight - original.height) / 2;
          } else if (handle.includes("top")) {
            newHeight = Math.max(16, isCenterScale ? original.height - localDy * 2 : original.height - localDy);
            if (!isCenterScale) localShiftY = -(newHeight - original.height) / 2;
          }
        }

        const worldShiftX = localShiftX * Math.cos(rad) - localShiftY * Math.sin(rad);
        const worldShiftY = localShiftX * Math.sin(rad) + localShiftY * Math.cos(rad);

        let updated: DiagramElement = {
          ...original,
          width: Math.round(newWidth),
          height: Math.round(newHeight),
          x: original.x + worldShiftX,
          y: original.y + worldShiftY,
        };
        updated = resolveDiagramElement(updated, scene.elements);
        onSceneChange({ elements: scene.elements.map((item) => item.id === elementId ? updated : item) }, false);
        return;
      }
    }

    if (dragMode === "element-start-point" && startScene && typeof scene.selectedId === "string") {
      const elementId = scene.selectedId.slice("element:".length);
      const original = startScene.elements.find((item) => item.id === elementId);
      if (original) {
        const contentX = (point.x - geometry.contentOrigin.x) / geometry.scale;
        const contentY = (point.y - geometry.contentOrigin.y) / geometry.scale;
        const rad = original.rotation * Math.PI / 180;
        const endPos = {
          x: original.x + Math.cos(rad) * (original.width / 2),
          y: original.y + Math.sin(rad) * (original.width / 2),
        };
        const target = findNearbyTargetElement({ x: contentX, y: contentY }, scene.elements, elementId, 24);
        const startPos = target ? getClosestFaceMidpoint(target, { x: contentX, y: contentY }, getOccupiedFaceNames(target, scene.elements, elementId)) : { x: contentX, y: contentY };
        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const newWidth = clamp(Math.hypot(dx, dy), 16, 1500);
        const newRotation = Math.atan2(-dy, -dx) * 180 / Math.PI;
        const newX = (startPos.x + endPos.x) / 2;
        const newY = (startPos.y + endPos.y) / 2;

        let updatedElement: DiagramElement = {
          ...original,
          x: newX,
          y: newY,
          width: newWidth,
          rotation: newRotation,
          startTargetId: target ? target.id : null,
          startFaceName: target && "faceName" in startPos ? (startPos as { faceName: "left" | "right" | "top" | "bottom" }).faceName : null,
        };
        updatedElement = resolveDiagramElement(updatedElement, scene.elements);
        onSceneChange({ elements: scene.elements.map((item) => item.id === elementId ? updatedElement : item) }, false);
        return;
      }
    }

    if (dragMode === "element-end-point" && startScene && typeof scene.selectedId === "string") {
      const elementId = scene.selectedId.slice("element:".length);
      const original = startScene.elements.find((item) => item.id === elementId);
      if (original) {
        const contentX = (point.x - geometry.contentOrigin.x) / geometry.scale;
        const contentY = (point.y - geometry.contentOrigin.y) / geometry.scale;
        const rad = original.rotation * Math.PI / 180;
        const startPos = {
          x: original.x - Math.cos(rad) * (original.width / 2),
          y: original.y - Math.sin(rad) * (original.width / 2),
        };
        const target = findNearbyTargetElement({ x: contentX, y: contentY }, scene.elements, elementId, 24);
        const endPos = target ? getClosestFaceMidpoint(target, { x: contentX, y: contentY }, getOccupiedFaceNames(target, scene.elements, elementId)) : { x: contentX, y: contentY };
        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const newWidth = clamp(Math.hypot(dx, dy), 16, 1500);
        const newRotation = Math.atan2(dy, dx) * 180 / Math.PI;
        const newX = (startPos.x + endPos.x) / 2;
        const newY = (startPos.y + endPos.y) / 2;

        let updatedElement: DiagramElement = {
          ...original,
          x: newX,
          y: newY,
          width: newWidth,
          rotation: newRotation,
          endTargetId: target ? target.id : null,
          endFaceName: target && "faceName" in endPos ? (endPos as { faceName: "left" | "right" | "top" | "bottom" }).faceName : null,
        };
        updatedElement = resolveDiagramElement(updatedElement, scene.elements);
        onSceneChange({ elements: scene.elements.map((item) => item.id === elementId ? updatedElement : item) }, false);
        return;
      }
    }

    if (dragMode === "element-vector-tip" && startScene && typeof scene.selectedId === "string") {
      const elementId = scene.selectedId.slice("element:".length);
      const original = startScene.elements.find((item) => item.id === elementId);
      if (original) {
        const contentX = (point.x - geometry.contentOrigin.x) / geometry.scale;
        const contentY = (point.y - geometry.contentOrigin.y) / geometry.scale;
        const actionPoint = getElementActionPoint(original, scene.elements);
        const dx = contentX - actionPoint.x;
        const dy = contentY - actionPoint.y;
        const newWidth = clamp(Math.hypot(dx, dy), 16, 1500);
        let newRotation = Math.atan2(dy, dx) * 180 / Math.PI;
        if (scene.snapEnabled && !event.altKey) {
          newRotation = Math.round(newRotation);
        }
        let updated = { ...original, width: newWidth, rotation: newRotation };
        updated = resolveDiagramElement(updated, scene.elements);
        onSceneChange({ elements: scene.elements.map((item) => item.id === elementId ? updated : item) }, false);
        return;
      }
    }

    if (dragMode === "element-label" && startScene && startPoint && typeof scene.selectedId === "string") {
      const elementId = scene.selectedId.slice("element:".length);
      const original = startScene.elements.find((item) => item.id === elementId);
      if (original) {
        const rad = original.rotation * Math.PI / 180;
        const dx = (point.x - startPoint.x) / geometry.scale;
        const dy = (point.y - startPoint.y) / geometry.scale;
        const localDx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
        const localDy = dx * Math.sin(-rad) + dy * Math.cos(-rad);

        onSceneChange({
          elements: scene.elements.map((item) =>
            item.id === elementId
              ? {
                  ...item,
                  labelOffsetX: Math.round((original.labelOffsetX ?? 0) + localDx),
                  labelOffsetY: Math.round((original.labelOffsetY ?? 0) + localDy),
                }
              : item
          ),
        }, false);
        return;
      }
    }

    if (dragMode === "element" && startScene && startPoint && typeof scene.selectedId === "string") {
      const elementId = scene.selectedId.slice("element:".length);
      const original = startScene.elements.find((item) => item.id === elementId);
      if (!original) return;

      if (original.groupId) {
        const dx = (point.x - startPoint.x) / geometry.scale;
        const dy = (point.y - startPoint.y) / geometry.scale;
        const updatedElements = startScene.elements.map((item) => {
          if (item.groupId === original.groupId) {
            const startElem = startScene.elements.find((e) => e.id === item.id);
            if (!startElem) return item;
            return { ...item, x: startElem.x + dx, y: startElem.y + dy };
          }
          return item;
        });
        onSceneChange({ elements: updatedElements }, false);
        return;
      }


      let nextX = original.x + (point.x - startPoint.x) / geometry.scale;
      let nextY = original.y + (point.y - startPoint.y) / geometry.scale;

      let guideX: number | undefined;
      let guideY: number | undefined;
      if (scene.snapEnabled && !event.altKey) {
        const threshold = 8 / geometry.scale;
        for (const other of scene.elements) {
          if (other.id === original.id) continue;
          if (Math.abs(other.x - nextX) < threshold) {
            nextX = other.x;
            guideX = geometry.contentOrigin.x + other.x * geometry.scale;
          }
          if (Math.abs(other.y - nextY) < threshold) {
            nextY = other.y;
            guideY = geometry.contentOrigin.y + other.y * geometry.scale;
          }
        }
        if (scene.grid) {
          nextX = Math.round(nextX / 10) * 10;
          nextY = Math.round(nextY / 10) * 10;
        }
      }
      setCanvasOverlay((current) => ({
        marquee: current.marquee,
        snapGuides: guideX !== undefined || guideY !== undefined ? { x: guideX, y: guideY } : undefined,
      }));
      let nextRotation = original.rotation;
      if (
        scene.snapEnabled &&
        !event.altKey &&
        !isConnectionElement(original.kind) &&
        !isVectorElement(original.kind) &&
        !["smooth-incline", "rough-incline", "wedge"].includes(original.kind)
      ) {
        const groundingSnap = findGroundingSurfaceSnap(original, nextX, nextY, scene, geometry);
        if (groundingSnap) {
          nextX = groundingSnap.snappedX;
          nextY = groundingSnap.snappedY;
          // Preserve element's rotation - do not auto-rotate when snapping to wall or surface
        }
      }
      let updatedElement: DiagramElement = { ...original, x: nextX, y: nextY, rotation: nextRotation };
      if (isConnectionElement(original.kind)) {
        const radians = original.rotation * Math.PI / 180;
        const halfW = original.width / 2;
        const startPos = { x: nextX - Math.cos(radians) * halfW, y: nextY - Math.sin(radians) * halfW };
        const endPos = { x: nextX + Math.cos(radians) * halfW, y: nextY + Math.sin(radians) * halfW };
        const startTarget = findNearbyTargetElement(startPos, scene.elements, elementId, 40);
        const endTarget = findNearbyTargetElement(endPos, scene.elements, elementId, 40);
        updatedElement.startTargetId = startTarget ? startTarget.id : null;
        updatedElement.endTargetId = endTarget ? endTarget.id : null;
        updatedElement = resolveDiagramElement(updatedElement, scene.elements);
      } else if (isVectorElement(original.kind)) {
        const contentX = (point.x - geometry.contentOrigin.x) / geometry.scale;
        const contentY = (point.y - geometry.contentOrigin.y) / geometry.scale;

        if (original.referenceTargetId) {
          const currentTarget = scene.elements.find((item) => item.id === original.referenceTargetId);
          if (currentTarget) {
            const dist = Math.hypot(contentX - currentTarget.x, contentY - currentTarget.y);
            if (dist > 65) {
              updatedElement.referenceTargetId = null;
              updatedElement.x = contentX;
              updatedElement.y = contentY;
            }
          }
        }

        if (!updatedElement.referenceTargetId) {
          const target = findNearbyTargetElement({ x: contentX, y: contentY }, scene.elements, elementId, 45);
          if (target) {
            updatedElement.referenceTargetId = target.id;
          }
        }

        if (updatedElement.referenceTargetId) {
          const refTarget = scene.elements.find((item) => item.id === updatedElement.referenceTargetId);
          if (refTarget) {
            const surface = catalogSurfacePreset(refTarget.kind);
            const slopeAngle = surface?.direction === "incline" ? -Math.round(Math.atan2(refTarget.height, refTarget.width) * 180 / Math.PI) : 0;
            if (original.kind === "gravity") {
              updatedElement.rotation = 90;
            } else if (original.kind === "normal-force") {
              updatedElement.rotation = refTarget.rotation + slopeAngle - 90;
            } else if (original.kind === "friction-force") {
              updatedElement.rotation = refTarget.rotation + slopeAngle;
            }
          }
          updatedElement = resolveDiagramElement(updatedElement, scene.elements);
        }
      }
      onSceneChange({ elements: scene.elements.map((item) => item.id === elementId ? updatedElement : item) }, false);
      return;
    }

    if (dragMode === "force-gravity-label" && startScene && startPoint) {
      onSceneChange({
        forceGravityLabelOffsetX: (startScene.forceGravityLabelOffsetX ?? 0) + (point.x - startPoint.x) / geometry.scale,
        forceGravityLabelOffsetY: (startScene.forceGravityLabelOffsetY ?? 0) + (point.y - startPoint.y) / geometry.scale,
      }, false);
      return;
    }
    if (dragMode === "force-normal-label" && startScene && startPoint) {
      onSceneChange({
        forceNormalLabelOffsetX: (startScene.forceNormalLabelOffsetX ?? 0) + (point.x - startPoint.x) / geometry.scale,
        forceNormalLabelOffsetY: (startScene.forceNormalLabelOffsetY ?? 0) + (point.y - startPoint.y) / geometry.scale,
      }, false);
      return;
    }
    if (dragMode === "force-friction-label" && startScene && startPoint) {
      onSceneChange({
        forceFrictionLabelOffsetX: (startScene.forceFrictionLabelOffsetX ?? 0) + (point.x - startPoint.x) / geometry.scale,
        forceFrictionLabelOffsetY: (startScene.forceFrictionLabelOffsetY ?? 0) + (point.y - startPoint.y) / geometry.scale,
      }, false);
      return;
    }

    if (dragMode === "angle-label" && startScene && startPoint) {
      onSceneChange({
        angleLabelOffsetX: startScene.angleLabelOffsetX + (point.x - startPoint.x) / geometry.scale,
        angleLabelOffsetY: startScene.angleLabelOffsetY + (point.y - startPoint.y) / geometry.scale,
      }, false);
      return;
    }
    if (dragMode === "mass-label" && startScene && startPoint) {
      const rotation = (blockRotationDegrees({ angle: scene.angle, flipped: scene.flipped, surfaceKind: scene.surfaceKind }) * Math.PI) / 180;
      const dx = (point.x - startPoint.x) / geometry.scale;
      const dy = (point.y - startPoint.y) / geometry.scale;
      onSceneChange({
        massLabelOffsetX: startScene.massLabelOffsetX + dx * Math.cos(rotation) + dy * Math.sin(rotation),
        massLabelOffsetY: startScene.massLabelOffsetY - dx * Math.sin(rotation) + dy * Math.cos(rotation),
      }, false);
      return;
    }
    if (dragMode === "text") {
      onSceneChange({
        annotationX: clamp((point.x - geometry.artboard.x) / geometry.artboard.width, 0.04, 0.96),
        annotationY: clamp((point.y - geometry.artboard.y) / geometry.artboard.height, 0.04, 0.96),
      }, false);
      return;
    }

    if (dragMode === "angle") {
      const horizontalDistance = scene.flipped ? geometry.start.x - point.x : point.x - geometry.start.x;
      let nextAngle = clamp((Math.atan2(geometry.start.y - point.y, horizontalDistance) * 180) / Math.PI, 5, 75);
      nextAngle = scene.snapEnabled && !event.altKey ? Math.round(nextAngle) : Math.round(nextAngle * 10) / 10;
      onSceneChange({ angle: nextAngle }, false);
      return;
    }
    if (dragMode === "block") {
      if (!scene.contactConstraint && startScene && startPoint) {
        onSceneChange({
          blockOffsetX: startScene.blockOffsetX + (point.x - startPoint.x) / geometry.scale,
          blockOffsetY: startScene.blockOffsetY + (point.y - startPoint.y) / geometry.scale,
        }, false);
        return;
      }
      const dx = geometry.end.x - geometry.start.x;
      const dy = geometry.end.y - geometry.start.y;
      let t = clamp(((point.x - geometry.start.x) * dx + (point.y - geometry.start.y) * dy) / (dx * dx + dy * dy), 0.08, 0.92);
      if (scene.snapEnabled && !event.altKey) t = Math.round(t * 200) / 200;
      onSceneChange({ blockPosition: t }, false);
      return;
    }
    if (dragMode === "force") {
      let nextScale = clamp(distance(point, geometry.blockCenter) / (116 * geometry.scale), 0.3, 2.5);
      if (scene.snapEnabled && !event.altKey) nextScale = Math.round(nextScale * 100) / 100;
      onSceneChange({ forceScale: nextScale }, false);
      return;
    }
    if (activeTool === "select" && distance(point, geometry.start) < 58) setSuggestion({ x: point.x + 14, y: point.y + 14 });
    else setSuggestion(null);
  }, [activeTool, canvasPoint, dragMode, geometry, onPointerPositionChange, onSceneChange, scene.angle, scene.contactConstraint, scene.elements, scene.flipped, scene.selectedId, scene.snapEnabled, scene.surfaceKind]);

  const handlePointerUp = useCallback(() => {
    if (dragMode === "box-select" && dragStartPointRef.current) {
      const start = dragStartPointRef.current;
      const end = boxSelectEndRef.current ?? start;
      const windowSelection = end.x >= start.x;
      const left = (Math.min(start.x, end.x) - geometry.contentOrigin.x) / geometry.scale;
      const right = (Math.max(start.x, end.x) - geometry.contentOrigin.x) / geometry.scale;
      const top = (Math.min(start.y, end.y) - geometry.contentOrigin.y) / geometry.scale;
      const bottom = (Math.max(start.y, end.y) - geometry.contentOrigin.y) / geometry.scale;
      if (Math.abs(end.x - start.x) > 4 || Math.abs(end.y - start.y) > 4) {
        const ids = elementIdsInMarquee(scene.elements, { left, right, top, bottom }, windowSelection);
        if (ids.length > 0) {
          onSceneChange({
            selectedIds: ids,
            selectedId: `element:${ids[0]}`,
          });
        }
      }
      setCanvasOverlay({});
      boxSelectEndRef.current = null;
    }

    // Auto-generate forces when a body element is grounded on a surface after drag
    if (dragMode === "element" && typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:")) {
      const elementId = scene.selectedId.slice("element:".length);
      const element = scene.elements.find((item) => item.id === elementId);
      if (element && !isVectorElement(element.kind) && !isConnectionElement(element.kind)
        && !["smooth-incline", "rough-incline", "wedge"].includes(element.kind)
        && scene.snapEnabled) {
        const groundingSnap = findGroundingSurfaceSnap(element, element.x, element.y, scene, geometry);
        if (groundingSnap) {
          // Check which forces are already attached
          const attached = new Set(scene.elements.filter((el) => el.referenceTargetId === elementId).map((el) => el.kind));
          const newElements: DiagramElement[] = [];
          const newVars = scene.variables.slice();

          // Always add gravity if missing (normal force N and friction f are added on-demand via + N button / N key)
          if (!attached.has("gravity")) {
            const grav = createReferencedElement("gravity", element);
            newElements.push(grav);
            newVars.push(createVariableForElement(grav));
          }

          if (newElements.length > 0) {
            onSceneChange({
              elements: [...scene.elements, ...newElements],
              variables: newVars,
            });
          }
        }
      }
    }

    if (dragMode && dragStartSceneRef.current) onCommitSnapshot(dragStartSceneRef.current);
    dragStartSceneRef.current = null;
    dragStartPointRef.current = null;
    activeResizeHandleRef.current = null;
    setDragMode(null);
    setCanvasOverlay((current) => ({ marquee: undefined, snapGuides: undefined }));
  }, [dragMode, geometry, onCommitSnapshot, onSceneChange, scene]);

  useEffect(() => {
    if (!dragMode) return;
    const release = () => handlePointerUp();
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [dragMode, handlePointerUp]);

  const hudPosition = useMemo(() => {
    if (!scene.selectedId?.startsWith("element:")) return null;
    const element = scene.elements.find((item) => `element:${item.id}` === scene.selectedId);
    if (!element) return null;
    const resolved = resolveDiagramElement(element, scene.elements);
    return {
      left: clamp(geometry.contentOrigin.x + (resolved.x + resolved.width / 2) * geometry.scale + 16, 16, size.width - 250),
      top: clamp(geometry.contentOrigin.y + (resolved.y - resolved.height / 2) * geometry.scale - 48, 16, size.height - 70),
    };
  }, [geometry, scene.elements, scene.selectedId, size]);

  const selectedElement = typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:")
    ? scene.elements.find((item) => `element:${item.id}` === scene.selectedId) ?? null
    : null;
  const selectedVariable = selectedElement
    ? scene.variables.find((item) => item.referenceIds.includes(selectedElement.id)) ?? null
    : null;
  const selectedElementHasDependencies = selectedElement
    ? (() => {
        const dependencies = findElementDependencies(selectedElement.id, scene.elements, scene.variables, scene.constraints);
        return Boolean(dependencies.connections.length || dependencies.variables.length || dependencies.constraints.length);
      })()
    : false;
  const componentConstraint = selectedElement
    ? scene.constraints.find((constraint) => constraint.kind === "same-variable" && constraint.targetIds[0] === selectedElement.id && constraint.targetIds.length === 3)
    : null;
  const decomposeSelectedVector = () => {
    if (!selectedElement || !isVectorElement(selectedElement.kind) || componentConstraint) return;
    const decomposition = decomposeVectorElement(selectedElement, scene.variables, scene.elements);
    if (!decomposition) return;
    onSceneChange({
      constraints: [...scene.constraints, decomposition.constraint],
      elements: [...scene.elements, ...decomposition.components],
      selectedId: `element:${selectedElement.id}`,
      variables: decomposition.variables,
    });
  };

  return (
    <main className={`canvas-workspace tool-${activeTool}`} ref={wrapperRef}>
      <canvas
        data-testid="editor-canvas"
        ref={canvasRef}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { if (!dragMode) setSuggestion(null); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        aria-label="物理図の作図キャンバス"
      />

      {suggestion && !dragMode ? null : null}

      {dragMode === "element-rotate" || dragMode === "element" || dragMode === "element-resize" || dragMode === "element-label" ? (
        <div className="numeric-hud" style={{ left: clamp(pointer.x + 16, 12, size.width - 160), top: clamp(pointer.y + 16, 12, size.height - 80) }}>
          <span>{dragMode === "element-rotate" ? "回転角" : "移動"}</span>
          <strong>
            {dragMode === "element-rotate" && selectedElement ? `${Math.round(selectedElement.rotation)}°`
              : selectedElement ? `x ${Math.round(selectedElement.x)}  y ${Math.round(selectedElement.y)}` : "—"}
          </strong>
        </div>
      ) : null}

      {activeTool === "select" && hudPosition && !dragMode && selectedElement ? (
        <div className="selection-hud" style={hudPosition}>
          {selectedVariable ? (
            <label className="hud-variable-editor"><small>{catalogEntry(selectedElement.kind).name}</small><VariableInput aria-label="HUD変量記号" property="symbol" variable={selectedVariable} syncElementId={selectedElement.id} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><VariableInput aria-label="HUD変量値" property="value" variable={selectedVariable} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} placeholder="値" /></label>
          ) : (
            <span className="hud-name">{catalogEntry(selectedElement.kind).name}{selectedElement.label ? ` · ${selectedElement.label}` : ""}</span>
          )}
          <span className="hud-divider" />
          {isVectorElement(selectedElement.kind) ? <>
            {selectedElement.referenceTargetId ? (
              <button
                type="button"
                className="active"
                title="作用対象を解除 (物体から離す)"
                onClick={() => onSceneChange({ elements: scene.elements.map((item) => item.id === selectedElement.id ? { ...item, referenceTargetId: null } : item) })}
              >
                <Unlink size={14} />
              </button>
            ) : null}
            <button type="button" title="反転" onClick={() => onSceneChange({ elements: scene.elements.map((item) => item.id === selectedElement.id ? { ...item, rotation: item.rotation + 180 } : item) })}><FlipHorizontal2 size={14} /></button>
            <button disabled={Boolean(componentConstraint)} type="button" title={componentConstraint ? "成分分解済み" : "成分分解"} onClick={decomposeSelectedVector}><MoveUpRight size={14} /></button>
            <button type="button" title={selectedElementHasDependencies ? "参照中・右パネルで削除" : "削除"} disabled={selectedElementHasDependencies} onClick={() => onSceneChange({ elements: scene.elements.filter((item) => item.id !== selectedElement.id), selectedId: null })}><Trash2 size={14} /></button>
          </> : null}
          {!isVectorElement(selectedElement.kind) ? (() => {
            const candidates = contextCandidatesForElement(selectedElement);
            if (candidates.length === 0) return null;
            const quickLabels: Record<string, string> = {
              "gravity": "+ mg", "normal-force": "+ N", "friction-force": "+ f",
              "tension": "+ T", "spring-force": "+ Fs", "force": "+ F",
              "velocity": "+ v", "acceleration": "+ a", "momentum": "+ p",
              "moment": "+ M", "angular-velocity": "+ ω", "angular-acceleration": "+ α",
              "rotation-direction": "+ ↻", "drag-force": "+ D", "buoyancy": "+ B",
              "angle-arc": "+ θ", "local-axis": "+ xy", "length-dimension": "+ L",
              "radius-dimension": "+ R",
            };
            const alreadyAttached = new Set(
              scene.elements
                .filter((el) => el.referenceTargetId === selectedElement.id)
                .map((el) => el.kind)
            );
            const filtered = candidates.filter((kind) => !alreadyAttached.has(kind));
            const hasForceCandidates = candidates.some((kind) => isVectorElement(kind));
            if (!hasForceCandidates) return null;
            return <>
              <button
                type="button"
                className="quick-action-btn"
                title="受ける力を一括追加 (G/N/F/T も可)"
                onClick={() => {
                  const patch = attachAllForcesForElement(selectedElement, scene);
                  if (patch) onSceneChange(patch);
                }}
              >
                力を全部
              </button>
              {filtered.slice(0, 5).map((kind) => (
              <button
                key={kind}
                type="button"
                className="quick-action-btn"
                title={`${catalogEntry(kind).name} を追加`}
                onClick={() => {
                  const newEl = createReferencedElement(kind, selectedElement);
                  const newVar = createVariableForElement(newEl);
                  onSceneChange({
                    elements: [...scene.elements, newEl],
                    variables: [...scene.variables, newVar],
                    selectedId: `element:${newEl.id}`,
                  });
                }}
              >
                {quickLabels[kind] || `+ ${catalogEntry(kind).defaultLabel || catalogEntry(kind).name}`}
              </button>
            ))}</>;
          })() : null}
          {selectedElement ? <>
            {isConnectionElement(selectedElement.kind) ? (
              <button
                type="button"
                className={selectedElement.startTargetId || selectedElement.endTargetId ? "active" : ""}
                title={selectedElement.startTargetId || selectedElement.endTargetId ? "接続を分解・解除" : "未接続"}
                disabled={!selectedElement.startTargetId && !selectedElement.endTargetId}
                onClick={() => onSceneChange({ elements: scene.elements.map((item) => item.id === selectedElement.id ? { ...item, startTargetId: null, endTargetId: null } : item) })}
              >
                <Unlink size={14} />
              </button>
            ) : null}
            <button
              type="button"
              title="斜面と平行に回転・配置"
              onClick={() => {
                const inclineAngle = scene.surfaceKind === "incline" ? (scene.flipped ? scene.angle : -scene.angle) : -30;
                onSceneChange({ elements: scene.elements.map((item) => item.id === selectedElement.id ? { ...item, rotation: inclineAngle } : item) });
              }}
            >
              <MoveUpRight size={14} />
            </button>
            {selectedElement.labelOffsetX || selectedElement.labelOffsetY ? (
              <button
                type="button"
                title="文字位置リセット"
                onClick={() => onSceneChange({ elements: scene.elements.map((item) => item.id === selectedElement.id ? { ...item, labelOffsetX: 0, labelOffsetY: 0 } : item) })}
              >
                <RotateCcw size={14} />
              </button>
            ) : null}
            <button type="button" title="位置をリセット" onClick={() => onSceneChange({ elements: scene.elements.map((item) => item.id === selectedElement.id ? { ...item, x: 500, y: 325 } : item) })}><RotateCcw size={14} /></button>
            <button className={selectedElement.locked ? "active" : ""} type="button" title={selectedElement.locked ? "ロック解除" : "ロック"} onClick={() => onSceneChange({ elements: scene.elements.map((item) => item.id === selectedElement.id ? { ...item, locked: !item.locked } : item) })}><Link2 size={14} /></button>
            <button type="button" title={selectedElementHasDependencies ? "参照中・右パネルで削除" : "削除"} disabled={selectedElementHasDependencies} onClick={() => onSceneChange({ elements: scene.elements.filter((item) => item.id !== selectedElement.id), selectedId: null })}><Trash2 size={14} /></button>
          </> : null}
          {!selectedElement && scene.selectedId && !["incline", "angle", "block", "mass-label", "text"].includes(scene.selectedId) ? <button type="button" title="位置をリセット" onClick={() => onSceneChange(pageKind === "freebody" ? { diagramOffsetX: 0, diagramOffsetY: 0 } : { forceScale: 1 })}><RotateCcw size={14} /></button> : null}
        </div>
      ) : null}

      <div className="canvas-corner-hint"><span className={scene.snapEnabled ? "blue-dot" : "gray-dot"} />推論{scene.snapEnabled ? "オン" : "オフ"}{scene.snapEnabled ? <><kbd>⌥</kbd>で一時解除</> : null}</div>
    </main>
  );
}
