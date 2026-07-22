"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipHorizontal2, Link2, MoveUpRight, RotateCcw, Trash2 } from "lucide-react";
import { SceneNumericInput, SceneTextInput } from "@/app/components/SceneInputs";
import type { PageKind, SceneState, SelectionId, ToolId } from "@/app/lib/editor-types";

interface EditorCanvasProps {
  activeTool: ToolId;
  pageKind: PageKind;
  scene: SceneState;
  zoom: number;
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  onCommitSnapshot: (scene: SceneState) => void;
  onPointerPositionChange: (point: Point) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
  onToolComplete: () => void;
}

export interface Point { x: number; y: number }

export interface Geometry {
  anglePoint: Point;
  artboard: { x: number; y: number; width: number; height: number };
  annotationPoint: Point;
  blockCenter: Point;
  end: Point;
  forceFrictionEnd: Point;
  forceGravityEnd: Point;
  forceNormalEnd: Point;
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

export function createGeometry(width: number, height: number, scene: SceneState, zoom: number): Geometry {
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
  const start = toPoint((scene.flipped ? 795 : 205) + scene.diagramOffsetX, 474 + scene.diagramOffsetY);
  const length = 590 * scale;
  const radians = (scene.angle * Math.PI) / 180;
  const tangent = { x: direction * Math.cos(radians), y: -Math.sin(radians) };
  const normal = { x: -direction * Math.sin(radians), y: -Math.cos(radians) };
  const end = { x: start.x + tangent.x * length, y: start.y + tangent.y * length };
  const linePoint = {
    x: start.x + tangent.x * length * scene.blockPosition,
    y: start.y + tangent.y * length * scene.blockPosition,
  };
  const blockCenter = {
    x: linePoint.x + normal.x * 58 * scale + scene.blockOffsetX * scale,
    y: linePoint.y + normal.y * 58 * scale + scene.blockOffsetY * scale,
  };
  const forceLength = 116 * scale * scene.forceScale;
  const forceGravityEnd = { x: blockCenter.x, y: blockCenter.y + forceLength };
  const forceNormalEnd = { x: blockCenter.x + normal.x * forceLength, y: blockCenter.y + normal.y * forceLength };
  const forceFrictionEnd = { x: blockCenter.x + tangent.x * forceLength, y: blockCenter.y + tangent.y * forceLength };
  const blockRotation = scene.flipped ? radians : -radians;
  const massLocal = {
    x: (-25 + scene.massLabelOffsetX) * scale,
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
  return {
    anglePoint,
    annotationPoint: {
      x: artboard.x + scene.annotationX * artboard.width,
      y: artboard.y + scene.annotationY * artboard.height,
    },
    artboard,
    blockCenter,
    end,
    forceFrictionEnd,
    forceGravityEnd,
    forceNormalEnd,
    massLabelPoint,
    origin: toPoint(150 + scene.diagramOffsetX, 165 + scene.diagramOffsetY),
    scale,
    start,
    tangent,
    normal,
  };
}

function arrow(ctx: CanvasRenderingContext2D, start: Point, end: Point, label: string, scale: number, color = "#18202b") {
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
  const labelX = end.x + Math.cos(angle - Math.PI / 2) * 18 * scale;
  const labelY = end.y + Math.sin(angle - Math.PI / 2) * 18 * scale;
  ctx.fillText(label, labelX, labelY);
  ctx.restore();
}

function drawSpring(ctx: CanvasRenderingContext2D, from: Point, to: Point, scale: number) {
  const segments = 12;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const perpendicular = { x: -dy / length, y: dx / length };
  ctx.save();
  ctx.strokeStyle = "#18202b";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (let index = 1; index < segments; index += 1) {
    const t = index / segments;
    const amplitude = (index % 2 ? -10 : 10) * scale;
    ctx.lineTo(from.x + dx * t + perpendicular.x * amplitude, from.y + dy * t + perpendicular.y * amplitude);
  }
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, scene: SceneState, pageKind: PageKind, zoom: number) {
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

  if (pageKind === "blank") {
    ctx.restore();
    return geometry;
  }

  if (pageKind === "freebody") {
    const center = {
      x: artboard.x + artboard.width / 2 + scene.diagramOffsetX * scale,
      y: artboard.y + artboard.height / 2 + scene.diagramOffsetY * scale,
    };
    const boxWidth = 116 * scale;
    const boxHeight = 86 * scale;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#18202b";
    ctx.lineWidth = 2.2 * scale;
    ctx.fillRect(center.x - boxWidth / 2, center.y - boxHeight / 2, boxWidth, boxHeight);
    ctx.strokeRect(center.x - boxWidth / 2, center.y - boxHeight / 2, boxWidth, boxHeight);
    if (scene.showGravity) arrow(ctx, { x: center.x, y: center.y + boxHeight / 2 }, { x: center.x, y: center.y + 150 * scale }, "mg", scale);
    if (scene.showNormal) arrow(ctx, { x: center.x, y: center.y - boxHeight / 2 }, { x: center.x, y: center.y - 150 * scale }, "N", scale);
    if (scene.showFriction) arrow(ctx, { x: center.x + boxWidth / 2, y: center.y }, { x: center.x + 165 * scale, y: center.y }, "f", scale);
    ctx.fillStyle = "#18202b";
    ctx.font = `italic ${Math.max(21, 28 * scale)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(scene.massLabel, center.x + scene.massLabelOffsetX * scale, center.y + (9 + scene.massLabelOffsetY) * scale);
    ctx.textAlign = "start";
    ctx.fillStyle = "#637083";
    ctx.font = `${Math.max(12, 14 * scale)}px system-ui, sans-serif`;
    ctx.fillText("選択した物体の自由体図", artboard.x + 28, artboard.y + 38);
    ctx.restore();
    return geometry;
  }

  const { start, end, blockCenter, tangent } = geometry;
  ctx.strokeStyle = "#18202b";
  ctx.fillStyle = "#18202b";
  ctx.lineWidth = 2.4 * scale;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineTo(end.x, start.y);
  ctx.closePath();
  ctx.stroke();

  if (scene.selectedId === "incline") {
    ctx.save();
    ctx.strokeStyle = "#3178d4";
    ctx.lineWidth = 4 * scale;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    [start, end].forEach((point) => {
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#3178d4"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }

  if (scene.showAngle) {
    const radius = 73 * scale;
    ctx.save();
    ctx.strokeStyle = scene.selectedId === "angle" ? "#3178d4" : "#18202b";
    ctx.lineWidth = 1.8 * scale;
    ctx.beginPath();
    const radians = (scene.angle * Math.PI) / 180;
    if (scene.flipped) ctx.arc(start.x, start.y, radius, Math.PI, Math.PI + radians);
    else ctx.arc(start.x, start.y, radius, -radians, 0);
    ctx.stroke();
    ctx.fillStyle = "#18202b";
    ctx.font = `italic ${Math.max(18, 24 * scale)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("θ", geometry.anglePoint.x, geometry.anglePoint.y);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(blockCenter.x, blockCenter.y);
  ctx.rotate((scene.flipped ? 1 : -1) * ((scene.angle * Math.PI) / 180));
  const blockWidth = 150 * scale;
  const blockHeight = 96 * scale;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = scene.selectedId === "block" || scene.selectedId === "mass-label" ? "#3178d4" : "#18202b";
  ctx.lineWidth = scene.selectedId === "block" || scene.selectedId === "mass-label" ? 3.2 * scale : 2.4 * scale;
  ctx.fillRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);
  ctx.strokeRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);
  ctx.restore();

  // Vectors are semantic foreground elements. Draw them only after the object
  // body so their shaft and arrowhead can never disappear behind its fill.
  if (scene.showGravity) arrow(ctx, blockCenter, geometry.forceGravityEnd, "mg", scale, scene.selectedId === "force-gravity" ? "#3178d4" : undefined);
  if (scene.showNormal) arrow(ctx, blockCenter, geometry.forceNormalEnd, "N", scale, scene.selectedId === "force-normal" ? "#3178d4" : undefined);
  if (scene.showFriction) arrow(ctx, blockCenter, geometry.forceFrictionEnd, "f", scale, scene.selectedId === "force-friction" ? "#3178d4" : undefined);

  // Diagram labels are the top-most content layer, above objects and vectors.
  ctx.save();
  ctx.translate(blockCenter.x, blockCenter.y);
  ctx.rotate((scene.flipped ? 1 : -1) * ((scene.angle * Math.PI) / 180));
  ctx.fillStyle = "#18202b";
  ctx.font = `italic ${Math.max(21, 29 * scale)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText(scene.massLabel, (-25 + scene.massLabelOffsetX) * scale, (18 + scene.massLabelOffsetY) * scale);
  ctx.restore();

  if (scene.selectedId === "mass-label") {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#3178d4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(geometry.massLabelPoint.x, geometry.massLabelPoint.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (scene.showAxis) {
    const axisX = { x: geometry.origin.x + 105 * scale, y: geometry.origin.y };
    const axisY = { x: geometry.origin.x, y: geometry.origin.y - 105 * scale };
    arrow(ctx, geometry.origin, axisX, "x", scale, scene.selectedId === "axis" ? "#3178d4" : undefined);
    arrow(ctx, geometry.origin, axisY, "y", scale, scene.selectedId === "axis" ? "#3178d4" : undefined);
  }

  if (scene.showSpring) {
    const from = {
      x: start.x + geometry.normal.x * 58 * scale + tangent.x * 10 * scale,
      y: start.y + geometry.normal.y * 58 * scale + tangent.y * 10 * scale,
    };
    const to = {
      x: blockCenter.x - tangent.x * 76 * scale,
      y: blockCenter.y - tangent.y * 76 * scale,
    };
    drawSpring(ctx, from, to, scale);
    ctx.strokeStyle = "#18202b";
    ctx.beginPath();
    ctx.moveTo(from.x - geometry.normal.x * 28 * scale, from.y - geometry.normal.y * 28 * scale);
    ctx.lineTo(from.x + geometry.normal.x * 28 * scale, from.y + geometry.normal.y * 28 * scale);
    ctx.stroke();
  }

  if (scene.showPulley) {
    const pulley = { x: end.x - 18 * scale, y: end.y - 54 * scale };
    ctx.strokeStyle = "#18202b"; ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.arc(pulley.x, pulley.y, 28 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(blockCenter.x + tangent.x * 78 * scale, blockCenter.y + tangent.y * 78 * scale); ctx.lineTo(pulley.x, pulley.y + 28 * scale); ctx.lineTo(pulley.x + 28 * scale, pulley.y); ctx.lineTo(pulley.x + 28 * scale, pulley.y + 120 * scale); ctx.stroke();
  }

  if (scene.showAnnotation) {
    ctx.fillStyle = scene.selectedId === "text" ? "#3178d4" : "#18202b";
    ctx.font = `${Math.max(14, 18 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(scene.annotationText, geometry.annotationPoint.x, geometry.annotationPoint.y);
  }

  if (scene.selectedId && scene.selectedId.startsWith("force-")) {
    const endpoint = scene.selectedId === "force-gravity" ? geometry.forceGravityEnd : scene.selectedId === "force-normal" ? geometry.forceNormalEnd : geometry.forceFrictionEnd;
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#3178d4"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(endpoint.x, endpoint.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  return geometry;
}

function hitTest(point: Point, geometry: Geometry, scene: SceneState): SelectionId {
  if (scene.showAnnotation && distance(point, geometry.annotationPoint) < 46) return "text";
  if (distance(point, geometry.massLabelPoint) < 24) return "mass-label";
  if (distance(point, geometry.blockCenter) < 75 * geometry.scale) return "block";
  if (scene.showGravity && distanceToSegment(point, geometry.blockCenter, geometry.forceGravityEnd) < 13) return "force-gravity";
  if (scene.showNormal && distanceToSegment(point, geometry.blockCenter, geometry.forceNormalEnd) < 13) return "force-normal";
  if (scene.showFriction && distanceToSegment(point, geometry.blockCenter, geometry.forceFrictionEnd) < 13) return "force-friction";
  if (scene.showAngle && distance(point, geometry.anglePoint) < 42) return "angle";
  if (scene.showAxis && distance(point, geometry.origin) < 90 * geometry.scale) return "axis";
  if (distanceToSegment(point, geometry.start, geometry.end) < 16) return "incline";
  return null;
}

export function EditorCanvas({
  activeTool,
  pageKind,
  scene,
  zoom,
  onCanvasReady,
  onCommitSnapshot,
  onPointerPositionChange,
  onSceneChange,
  onToolComplete,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStartSceneRef = useRef<SceneState | null>(null);
  const dragStartPointRef = useRef<Point | null>(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<"angle" | "angle-label" | "block" | "diagram" | "force" | "freebody" | "mass-label" | "text" | null>(null);
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
    drawScene(ctx, size.width, size.height, scene, pageKind, zoom);
    onCanvasReady(canvas);
  }, [onCanvasReady, pageKind, scene, size, zoom]);

  const geometry = useMemo(() => createGeometry(size.width, size.height, scene, zoom), [scene, size, zoom]);

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
      const patch: Partial<SceneState> = { selectedId: activeTool === "force" ? "force-gravity" : activeTool as SelectionId };
      if (activeTool === "angle") patch.showAngle = true;
      if (activeTool === "axis") patch.showAxis = true;
      if (activeTool === "force") Object.assign(patch, { showGravity: true, showNormal: true, showFriction: true });
      if (activeTool === "spring") patch.showSpring = true;
      if (activeTool === "pulley") patch.showPulley = true;
      if (activeTool === "text") {
        patch.showAnnotation = true;
        patch.selectedId = "text";
        patch.annotationX = clamp((point.x - geometry.artboard.x) / geometry.artboard.width, 0.04, 0.96);
        patch.annotationY = clamp((point.y - geometry.artboard.y) / geometry.artboard.height, 0.04, 0.96);
      }
      if (activeTool === "block") {
        const dx = geometry.end.x - geometry.start.x;
        const dy = geometry.end.y - geometry.start.y;
        patch.blockPosition = clamp(((point.x - geometry.start.x) * dx + (point.y - geometry.start.y) * dy) / (dx * dx + dy * dy), 0.12, 0.88);
      }
      onSceneChange(patch);
      onToolComplete();
      return;
    }

    const freeBodyCenter = {
      x: geometry.artboard.x + geometry.artboard.width / 2 + scene.diagramOffsetX * geometry.scale,
      y: geometry.artboard.y + geometry.artboard.height / 2 + scene.diagramOffsetY * geometry.scale,
    };
    const hit = pageKind === "freebody"
      ? distance(point, freeBodyCenter) < 90 * geometry.scale ? "block" : null
      : hitTest(point, geometry, scene);
    onSceneChange({ selectedId: hit });
    if (!hit) return;
    dragStartSceneRef.current = { ...scene };
    dragStartPointRef.current = point;
    if (hit === "incline" && distance(point, geometry.end) < 32) setDragMode("angle");
    else if (hit === "incline") setDragMode("diagram");
    else if (hit === "angle") setDragMode("angle-label");
    else if (hit === "mass-label") setDragMode("mass-label");
    else if (hit === "text") setDragMode("text");
    else if (pageKind === "freebody" && hit === "block") setDragMode("freebody");
    else if (hit === "block") setDragMode("block");
    else if (hit.startsWith("force-")) setDragMode("force");
  }, [activeTool, canvasPoint, geometry, onPointerPositionChange, onSceneChange, onToolComplete, pageKind, scene]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const droppedTool = event.dataTransfer.getData("application/x-physics-tool") as ToolId;
    const validTools: ToolId[] = ["incline", "block", "force", "angle", "axis", "spring", "pulley", "text"];
    if (!validTools.includes(droppedTool)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const patch: Partial<SceneState> = { selectedId: droppedTool === "force" ? "force-gravity" : droppedTool as SelectionId };
    if (droppedTool === "angle") patch.showAngle = true;
    if (droppedTool === "axis") patch.showAxis = true;
    if (droppedTool === "force") Object.assign(patch, { showGravity: true, showNormal: true, showFriction: true });
    if (droppedTool === "spring") patch.showSpring = true;
    if (droppedTool === "pulley") patch.showPulley = true;
    if (droppedTool === "text") {
      patch.showAnnotation = true;
      patch.selectedId = "text";
      patch.annotationX = clamp((point.x - geometry.artboard.x) / geometry.artboard.width, 0.04, 0.96);
      patch.annotationY = clamp((point.y - geometry.artboard.y) / geometry.artboard.height, 0.04, 0.96);
    }
    if (droppedTool === "block") {
      const dx = geometry.end.x - geometry.start.x;
      const dy = geometry.end.y - geometry.start.y;
      patch.blockPosition = clamp(((point.x - geometry.start.x) * dx + (point.y - geometry.start.y) * dy) / (dx * dx + dy * dy), 0.12, 0.88);
    }
    onSceneChange(patch);
    onToolComplete();
  }, [geometry, onSceneChange, onToolComplete]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    setPointer(point);
    onPointerPositionChange({
      x: Math.round((point.x - geometry.artboard.x) / geometry.scale),
      y: Math.round((point.y - geometry.artboard.y) / geometry.scale),
    });
    const startScene = dragStartSceneRef.current;
    const startPoint = dragStartPointRef.current;

    if ((dragMode === "diagram" || dragMode === "freebody") && startScene && startPoint) {
      let nextX = startScene.diagramOffsetX + (point.x - startPoint.x) / geometry.scale;
      let nextY = startScene.diagramOffsetY + (point.y - startPoint.y) / geometry.scale;
      if (scene.snapEnabled && !event.altKey) {
        nextX = Math.round(nextX / 10) * 10;
        nextY = Math.round(nextY / 10) * 10;
      }
      onSceneChange({ diagramOffsetX: nextX, diagramOffsetY: nextY }, false);
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
      const rotation = (scene.flipped ? 1 : -1) * (scene.angle * Math.PI) / 180;
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
      nextAngle = scene.snapEnabled && !event.altKey ? Math.round(nextAngle / 5) * 5 : Math.round(nextAngle);
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
      let t = clamp(((point.x - geometry.start.x) * dx + (point.y - geometry.start.y) * dy) / (dx * dx + dy * dy), 0.12, 0.88);
      if (scene.snapEnabled && !event.altKey) t = Math.round(t / 0.05) * 0.05;
      onSceneChange({ blockPosition: t }, false);
      return;
    }
    if (dragMode === "force") {
      let nextScale = clamp(distance(point, geometry.blockCenter) / (116 * geometry.scale), 0.5, 1.8);
      if (scene.snapEnabled && !event.altKey) nextScale = Math.round(nextScale * 10) / 10;
      onSceneChange({ forceScale: nextScale }, false);
      return;
    }
    if (activeTool === "select" && distance(point, geometry.start) < 58) setSuggestion({ x: point.x + 14, y: point.y + 14 });
    else setSuggestion(null);
  }, [activeTool, canvasPoint, dragMode, geometry, onPointerPositionChange, onSceneChange, scene.angle, scene.contactConstraint, scene.flipped, scene.snapEnabled]);

  const handlePointerUp = useCallback(() => {
    if (dragMode && dragStartSceneRef.current) onCommitSnapshot(dragStartSceneRef.current);
    dragStartSceneRef.current = null;
    dragStartPointRef.current = null;
    setDragMode(null);
  }, [dragMode, onCommitSnapshot]);

  const hudPosition = useMemo(() => {
    if (!scene.selectedId) return null;
    if (scene.selectedId === "incline" || scene.selectedId === "angle") {
      return {
        left: clamp(geometry.start.x + (scene.flipped ? -220 : 24), 16, size.width - 250),
        top: clamp(geometry.start.y + 24, 16, size.height - 70),
      };
    }
    if (scene.selectedId === "block" || scene.selectedId === "mass-label") {
      const blockAnchor = pageKind === "freebody"
        ? {
            x: geometry.artboard.x + geometry.artboard.width / 2 + scene.diagramOffsetX * geometry.scale,
            y: geometry.artboard.y + geometry.artboard.height / 2 + scene.diagramOffsetY * geometry.scale,
          }
        : geometry.blockCenter;
      return {
        left: clamp(blockAnchor.x + 72 * geometry.scale, 16, size.width - 250),
        top: clamp(blockAnchor.y - 118 * geometry.scale, 16, size.height - 70),
      };
    }
    if (scene.selectedId === "axis" || scene.selectedId === "spring" || scene.selectedId === "pulley") {
      return {
        left: clamp(geometry.artboard.x + geometry.artboard.width - 258, 16, size.width - 250),
        top: geometry.artboard.y + 16,
      };
    }
    const anchor = scene.selectedId === "text"
        ? geometry.annotationPoint
        : scene.selectedId === "force-gravity"
          ? geometry.forceGravityEnd
          : scene.selectedId === "force-normal"
            ? geometry.forceNormalEnd
            : scene.selectedId === "force-friction"
              ? geometry.forceFrictionEnd
              : geometry.origin;
    return { left: clamp(anchor.x + 24, 16, size.width - 250), top: clamp(anchor.y - 48, 16, size.height - 70) };
  }, [geometry, pageKind, scene.diagramOffsetX, scene.diagramOffsetY, scene.flipped, scene.selectedId, size]);

  return (
    <main className={`canvas-workspace tool-${activeTool}`} ref={wrapperRef}>
      <canvas
        data-testid="editor-canvas"
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { if (!dragMode) setSuggestion(null); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        aria-label="物理図の作図キャンバス"
      />

      {suggestion && !dragMode ? (
        <div className="context-completion" style={{ left: suggestion.x, top: suggestion.y }} role="menu">
          <div className="completion-label">この頂点に追加</div>
          <button className="active" type="button" onClick={() => { onSceneChange({ showAngle: true, selectedId: "angle" }); setSuggestion(null); }}><span>角度 θ</span><kbd>A</kbd></button>
          <button type="button" onClick={() => { onSceneChange({ showNormal: true, selectedId: "force-normal" }); setSuggestion(null); }}><span>法線 N</span><kbd>N</kbd></button>
          <button type="button" onClick={() => { onSceneChange({ showAxis: true, selectedId: "axis" }); setSuggestion(null); }}><span>座標軸</span><kbd>X</kbd></button>
        </div>
      ) : null}

      {dragMode ? (
        <div className="numeric-hud" style={{ left: clamp(pointer.x + 16, 12, size.width - 160), top: clamp(pointer.y + 16, 12, size.height - 80) }}>
          <span>{dragMode === "angle" ? "角度" : dragMode === "block" ? "位置" : dragMode === "force" ? "長さ" : "移動"}</span>
          <strong>{dragMode === "angle" ? `${scene.angle}°` : dragMode === "block" ? `${Math.round(scene.blockPosition * 100)}%` : dragMode === "force" ? `${Math.round(scene.forceScale * 100)}%` : `x ${Math.round(scene.diagramOffsetX)}  y ${Math.round(scene.diagramOffsetY)}`}</strong>
        </div>
      ) : null}

      {hudPosition && !dragMode ? (
        <div className="selection-hud" style={hudPosition}>
          {scene.selectedId === "incline" || scene.selectedId === "angle" ? (
            <label><span>θ</span><SceneNumericInput min="5" max="75" property="angle" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>°</b></label>
          ) : scene.selectedId === "block" || scene.selectedId === "mass-label" ? (
            <label><span>質量</span><SceneTextInput property="massLabel" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
          ) : scene.selectedId === "text" ? (
            <label><span>文字</span><SceneTextInput property="annotationText" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
          ) : scene.selectedId?.startsWith("force-") ? (
            <label><span>倍率</span><SceneNumericInput min="50" max="180" property="forceScale" scale={100} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>%</b></label>
          ) : <span className="hud-name">{scene.selectedId === "axis" ? "座標軸" : scene.selectedId === "spring" ? "ばね" : "滑車"}</span>}
          <span className="hud-divider" />
          {pageKind !== "freebody" && (scene.selectedId === "incline" || scene.selectedId === "angle") ? <button type="button" title="左右反転" onClick={() => onSceneChange({ flipped: !scene.flipped, blockPosition: 1 - scene.blockPosition })}><FlipHorizontal2 size={14} /></button> : null}
          {pageKind !== "freebody" && (scene.selectedId === "incline" || scene.selectedId === "angle" || scene.selectedId === "block" || scene.selectedId === "mass-label") ? <button className={scene.contactConstraint ? "active" : ""} type="button" title="接触制約" onClick={() => onSceneChange({ contactConstraint: !scene.contactConstraint, ...(!scene.contactConstraint ? { blockOffsetX: 0, blockOffsetY: 0 } : {}) })}><Link2 size={14} /></button> : null}
          <button type="button" title="位置をリセット" onClick={() => onSceneChange(pageKind === "freebody" ? { diagramOffsetX: 0, diagramOffsetY: 0 } : scene.selectedId === "angle" ? { angleLabelOffsetX: 0, angleLabelOffsetY: 0 } : scene.selectedId === "mass-label" || scene.selectedId === "block" ? { massLabelOffsetX: 0, massLabelOffsetY: 0 } : scene.selectedId === "text" ? { annotationX: 0.5, annotationY: 0.2 } : { diagramOffsetX: 0, diagramOffsetY: 0 })}><RotateCcw size={14} /></button>
          {scene.selectedId === "text" ? <button type="button" title="削除" onClick={() => onSceneChange({ showAnnotation: false, selectedId: null })}><Trash2 size={14} /></button> : scene.selectedId === "block" || scene.selectedId === "mass-label" ? <button type="button" title="力を追加" onClick={() => onSceneChange({ showGravity: true, showNormal: true, showFriction: true })}><MoveUpRight size={14} /></button> : null}
        </div>
      ) : null}

      <div className="canvas-corner-hint"><span className={scene.snapEnabled ? "blue-dot" : "gray-dot"} />推論{scene.snapEnabled ? "オン" : "オフ"}{scene.snapEnabled ? <><kbd>⌥</kbd>で一時解除</> : null}</div>
    </main>
  );
}
