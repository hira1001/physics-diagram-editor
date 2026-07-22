"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipHorizontal2, Link2, MoveUpRight, RotateCcw } from "lucide-react";
import type { PageKind, SceneState, SelectionId, ToolId } from "@/app/lib/editor-types";

interface EditorCanvasProps {
  activeTool: ToolId;
  pageKind: PageKind;
  scene: SceneState;
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  onCommitSnapshot: (scene: SceneState) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
  onToolComplete: () => void;
}

interface Point { x: number; y: number }

interface Geometry {
  anglePoint: Point;
  artboard: { x: number; y: number; width: number; height: number };
  blockCenter: Point;
  end: Point;
  forceFrictionEnd: Point;
  forceGravityEnd: Point;
  forceNormalEnd: Point;
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

function createGeometry(width: number, height: number, scene: SceneState): Geometry {
  const artboard = {
    x: 42,
    y: 30,
    width: Math.max(520, width - 84),
    height: Math.max(360, height - 62),
  };
  const scale = Math.min(artboard.width / 1000, artboard.height / 650);
  const contentWidth = 1000 * scale;
  const contentHeight = 650 * scale;
  const offsetX = artboard.x + (artboard.width - contentWidth) / 2;
  const offsetY = artboard.y + (artboard.height - contentHeight) / 2;
  const toPoint = (x: number, y: number): Point => ({ x: offsetX + x * scale, y: offsetY + y * scale });
  const start = toPoint(205, 474);
  const length = 590 * scale;
  const radians = (scene.angle * Math.PI) / 180;
  const tangent = { x: Math.cos(radians), y: -Math.sin(radians) };
  const normal = { x: -Math.sin(radians), y: -Math.cos(radians) };
  const end = { x: start.x + tangent.x * length, y: start.y + tangent.y * length };
  const linePoint = {
    x: start.x + tangent.x * length * scene.blockPosition,
    y: start.y + tangent.y * length * scene.blockPosition,
  };
  const blockCenter = {
    x: linePoint.x + normal.x * 58 * scale,
    y: linePoint.y + normal.y * 58 * scale,
  };
  const forceLength = 116 * scale * scene.forceScale;
  const forceGravityEnd = { x: blockCenter.x, y: blockCenter.y + forceLength };
  const forceNormalEnd = { x: blockCenter.x + normal.x * forceLength, y: blockCenter.y + normal.y * forceLength };
  const forceFrictionEnd = { x: blockCenter.x + tangent.x * forceLength, y: blockCenter.y + tangent.y * forceLength };
  return {
    anglePoint: { x: start.x + 83 * scale, y: start.y - 31 * scale },
    artboard,
    blockCenter,
    end,
    forceFrictionEnd,
    forceGravityEnd,
    forceNormalEnd,
    origin: toPoint(150, 165),
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
  ctx.save();
  ctx.strokeStyle = "#18202b";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  for (let index = 1; index < segments; index += 1) {
    const t = index / segments;
    ctx.lineTo(from.x + (to.x - from.x) * t, from.y + (index % 2 ? -10 : 10) * scale);
  }
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, scene: SceneState, pageKind: PageKind) {
  const geometry = createGeometry(width, height, scene);
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

  if (pageKind === "freebody") {
    const center = { x: artboard.x + artboard.width / 2, y: artboard.y + artboard.height / 2 };
    const boxWidth = 116 * scale;
    const boxHeight = 86 * scale;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#18202b";
    ctx.lineWidth = 2.2 * scale;
    ctx.fillRect(center.x - boxWidth / 2, center.y - boxHeight / 2, boxWidth, boxHeight);
    ctx.strokeRect(center.x - boxWidth / 2, center.y - boxHeight / 2, boxWidth, boxHeight);
    ctx.fillStyle = "#18202b";
    ctx.font = `italic ${Math.max(21, 28 * scale)}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillText(scene.massLabel, center.x, center.y + 9 * scale);
    ctx.textAlign = "start";
    if (scene.showGravity) arrow(ctx, center, { x: center.x, y: center.y + 150 * scale }, "mg", scale);
    if (scene.showNormal) arrow(ctx, center, { x: center.x, y: center.y - 150 * scale }, "N", scale);
    if (scene.showFriction) arrow(ctx, center, { x: center.x + 165 * scale, y: center.y }, "f", scale);
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
    ctx.arc(start.x, start.y, radius, -((scene.angle * Math.PI) / 180), 0);
    ctx.stroke();
    ctx.fillStyle = "#18202b";
    ctx.font = `italic ${Math.max(18, 24 * scale)}px Georgia, serif`;
    ctx.fillText("θ", geometry.anglePoint.x, geometry.anglePoint.y);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(blockCenter.x, blockCenter.y);
  ctx.rotate(-((scene.angle * Math.PI) / 180));
  const blockWidth = 150 * scale;
  const blockHeight = 96 * scale;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = scene.selectedId === "block" ? "#3178d4" : "#18202b";
  ctx.lineWidth = scene.selectedId === "block" ? 3.2 * scale : 2.4 * scale;
  ctx.fillRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);
  ctx.strokeRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);
  ctx.fillStyle = "#18202b";
  ctx.font = `italic ${Math.max(21, 29 * scale)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText(scene.massLabel, 0, 10 * scale);
  ctx.restore();

  if (scene.showGravity) arrow(ctx, blockCenter, geometry.forceGravityEnd, "mg", scale, scene.selectedId === "force-gravity" ? "#3178d4" : undefined);
  if (scene.showNormal) arrow(ctx, blockCenter, geometry.forceNormalEnd, "N", scale, scene.selectedId === "force-normal" ? "#3178d4" : undefined);
  if (scene.showFriction) arrow(ctx, blockCenter, geometry.forceFrictionEnd, "f", scale, scene.selectedId === "force-friction" ? "#3178d4" : undefined);

  if (scene.showAxis) {
    const axisX = { x: geometry.origin.x + 105 * scale, y: geometry.origin.y };
    const axisY = { x: geometry.origin.x, y: geometry.origin.y - 105 * scale };
    arrow(ctx, geometry.origin, axisX, "x", scale, scene.selectedId === "axis" ? "#3178d4" : undefined);
    arrow(ctx, geometry.origin, axisY, "y", scale, scene.selectedId === "axis" ? "#3178d4" : undefined);
  }

  if (scene.showSpring) {
    const from = { x: start.x - 120 * scale, y: start.y - 38 * scale };
    const to = { x: start.x - 10 * scale, y: start.y - 38 * scale };
    drawSpring(ctx, from, to, scale);
    ctx.strokeStyle = "#18202b"; ctx.beginPath(); ctx.moveTo(from.x, from.y - 30 * scale); ctx.lineTo(from.x, from.y + 30 * scale); ctx.stroke();
  }

  if (scene.showPulley) {
    const pulley = { x: end.x - 18 * scale, y: end.y - 54 * scale };
    ctx.strokeStyle = "#18202b"; ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.arc(pulley.x, pulley.y, 28 * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(blockCenter.x + tangent.x * 78 * scale, blockCenter.y + tangent.y * 78 * scale); ctx.lineTo(pulley.x, pulley.y + 28 * scale); ctx.lineTo(pulley.x + 28 * scale, pulley.y); ctx.lineTo(pulley.x + 28 * scale, pulley.y + 120 * scale); ctx.stroke();
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
  onCanvasReady,
  onCommitSnapshot,
  onSceneChange,
  onToolComplete,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStartSceneRef = useRef<SceneState | null>(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<"angle" | "block" | "force" | null>(null);
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
    drawScene(ctx, size.width, size.height, scene, pageKind);
    onCanvasReady(canvas);
  }, [onCanvasReady, pageKind, scene, size]);

  const geometry = useMemo(() => createGeometry(size.width, size.height, scene), [scene, size]);

  const canvasPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointer(point);
    setSuggestion(null);

    if (activeTool !== "select") {
      const patch: Partial<SceneState> = { selectedId: activeTool === "force" ? "force-gravity" : activeTool as SelectionId };
      if (activeTool === "angle") patch.showAngle = true;
      if (activeTool === "axis") patch.showAxis = true;
      if (activeTool === "force") Object.assign(patch, { showGravity: true, showNormal: true, showFriction: true });
      if (activeTool === "spring") patch.showSpring = true;
      if (activeTool === "pulley") patch.showPulley = true;
      if (activeTool === "block") {
        const dx = geometry.end.x - geometry.start.x;
        const dy = geometry.end.y - geometry.start.y;
        patch.blockPosition = clamp(((point.x - geometry.start.x) * dx + (point.y - geometry.start.y) * dy) / (dx * dx + dy * dy), 0.12, 0.88);
      }
      onSceneChange(patch);
      onToolComplete();
      return;
    }

    const hit = pageKind === "freebody" ? "block" : hitTest(point, geometry, scene);
    onSceneChange({ selectedId: hit });
    if (!hit) return;
    dragStartSceneRef.current = { ...scene };
    if (hit === "incline" && distance(point, geometry.end) < 32) setDragMode("angle");
    else if (hit === "block") setDragMode("block");
    else if (hit.startsWith("force-")) setDragMode("force");
  }, [activeTool, canvasPoint, geometry, onSceneChange, onToolComplete, pageKind, scene]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    setPointer(point);
    if (pageKind === "freebody") return;

    if (dragMode === "angle") {
      const nextAngle = clamp(Math.round((Math.atan2(geometry.start.y - point.y, point.x - geometry.start.x) * 180) / Math.PI), 5, 75);
      onSceneChange({ angle: nextAngle }, false);
      return;
    }
    if (dragMode === "block") {
      const dx = geometry.end.x - geometry.start.x;
      const dy = geometry.end.y - geometry.start.y;
      const t = clamp(((point.x - geometry.start.x) * dx + (point.y - geometry.start.y) * dy) / (dx * dx + dy * dy), 0.12, 0.88);
      onSceneChange({ blockPosition: t }, false);
      return;
    }
    if (dragMode === "force") {
      const nextScale = clamp(distance(point, geometry.blockCenter) / (116 * geometry.scale), 0.5, 1.8);
      onSceneChange({ forceScale: nextScale }, false);
      return;
    }
    if (activeTool === "select" && distance(point, geometry.start) < 58) setSuggestion({ x: point.x + 14, y: point.y + 14 });
    else setSuggestion(null);
  }, [activeTool, canvasPoint, dragMode, geometry, onSceneChange, pageKind]);

  const handlePointerUp = useCallback(() => {
    if (dragMode && dragStartSceneRef.current) onCommitSnapshot(dragStartSceneRef.current);
    dragStartSceneRef.current = null;
    setDragMode(null);
  }, [dragMode, onCommitSnapshot]);

  const hudPosition = useMemo(() => {
    if (!scene.selectedId) return null;
    const anchor = scene.selectedId === "incline" || scene.selectedId === "angle"
      ? geometry.anglePoint
      : scene.selectedId === "block"
        ? geometry.blockCenter
        : scene.selectedId === "force-gravity"
          ? geometry.forceGravityEnd
          : scene.selectedId === "force-normal"
            ? geometry.forceNormalEnd
            : scene.selectedId === "force-friction"
              ? geometry.forceFrictionEnd
              : geometry.origin;
    return { left: clamp(anchor.x + 24, 16, size.width - 250), top: clamp(anchor.y - 48, 16, size.height - 70) };
  }, [geometry, scene.selectedId, size]);

  return (
    <main className={`canvas-workspace tool-${activeTool}`} ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { if (!dragMode) setSuggestion(null); }}
        aria-label="物理図の作図キャンバス"
      />

      {suggestion && !dragMode ? (
        <div className="context-completion" style={{ left: suggestion.x, top: suggestion.y }} role="menu">
          <div className="completion-label">この頂点に追加</div>
          <button className="active" type="button" onClick={() => { onSceneChange({ showAngle: true, selectedId: "angle" }); setSuggestion(null); }}><span>角度 θ</span><kbd>Tab</kbd></button>
          <button type="button" onClick={() => setSuggestion(null)}><span>水平基準線</span><kbd>H</kbd></button>
          <button type="button" onClick={() => { onSceneChange({ showNormal: true, selectedId: "force-normal" }); setSuggestion(null); }}><span>法線 N</span><kbd>N</kbd></button>
          <button type="button" onClick={() => { onSceneChange({ showAxis: true, selectedId: "axis" }); setSuggestion(null); }}><span>座標軸</span><kbd>X</kbd></button>
        </div>
      ) : null}

      {dragMode ? (
        <div className="numeric-hud" style={{ left: clamp(pointer.x + 16, 12, size.width - 160), top: clamp(pointer.y + 16, 12, size.height - 80) }}>
          <span>{dragMode === "angle" ? "角度" : dragMode === "block" ? "位置" : "長さ"}</span>
          <strong>{dragMode === "angle" ? `${scene.angle}°` : dragMode === "block" ? `${Math.round(scene.blockPosition * 100)}%` : `${Math.round(scene.forceScale * 100)}%`}</strong>
          <small>Tab 数値入力</small>
        </div>
      ) : null}

      {hudPosition && !dragMode ? (
        <div className="selection-hud" style={hudPosition}>
          {scene.selectedId === "incline" || scene.selectedId === "angle" ? (
            <label><span>θ</span><input type="number" min="5" max="75" value={scene.angle} onChange={(event) => onSceneChange({ angle: Number(event.target.value) })} /><b>°</b></label>
          ) : scene.selectedId === "block" ? (
            <label><span>質量</span><input value={scene.massLabel} onChange={(event) => onSceneChange({ massLabel: event.target.value })} /></label>
          ) : (
            <label><span>倍率</span><input type="number" min="50" max="180" value={Math.round(scene.forceScale * 100)} onChange={(event) => onSceneChange({ forceScale: Number(event.target.value) / 100 })} /><b>%</b></label>
          )}
          <span className="hud-divider" />
          <button type="button" title="反転"><FlipHorizontal2 size={14} /></button>
          <button type="button" title="拘束"><Link2 size={14} /></button>
          <button type="button" title="整列"><RotateCcw size={14} /></button>
          <button type="button" title="力を追加" onClick={() => onSceneChange({ showGravity: true, showNormal: true, showFriction: true })}><MoveUpRight size={14} /></button>
        </div>
      ) : null}

      <div className="canvas-corner-hint"><span className="blue-dot" />推論オン <kbd>⌥</kbd>で一時解除</div>
    </main>
  );
}
