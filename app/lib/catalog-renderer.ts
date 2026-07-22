import type { DiagramElement } from "@/app/lib/editor-types";
import type { Point } from "@/app/components/EditorCanvas";

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function arrow(ctx: CanvasRenderingContext2D, length: number, label: string, elementRotation = 0) {
  const start = -length / 2;
  const end = length / 2;
  line(ctx, start, 0, end, 0);
  ctx.beginPath();
  ctx.moveTo(end, 0);
  ctx.lineTo(end - 13, -6);
  ctx.lineTo(end - 13, 6);
  ctx.closePath();
  ctx.fill();
  if (label) {
    const worldOffsetX = 16;
    const worldOffsetY = -10;
    const localOffsetX = worldOffsetX * Math.cos(elementRotation) + worldOffsetY * Math.sin(elementRotation);
    const localOffsetY = -worldOffsetX * Math.sin(elementRotation) + worldOffsetY * Math.cos(elementRotation);
    ctx.save();
    ctx.translate(end + localOffsetX, localOffsetY);
    ctx.rotate(-elementRotation);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}

function spring(ctx: CanvasRenderingContext2D, width: number) {
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  const segments = 12;
  for (let index = 1; index < segments; index += 1) {
    const x = -width / 2 + width * index / segments;
    ctx.lineTo(x, index % 2 ? -12 : 12);
  }
  ctx.lineTo(width / 2, 0);
  ctx.stroke();
}

function supportTriangle(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(0, -height / 2);
  ctx.lineTo(-width / 2, height / 2);
  ctx.lineTo(width / 2, height / 2);
  ctx.closePath();
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, label: string, x = 0, y = 7) {
  if (!label) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
}

export function drawDiagramElement(
  ctx: CanvasRenderingContext2D,
  element: DiagramElement,
  contentOrigin: Point,
  scale: number,
  selected: boolean,
) {
  if (!element.visible) return;
  const { width: w, height: h } = element;
  ctx.save();
  ctx.translate(contentOrigin.x + element.x * scale, contentOrigin.y + element.y * scale);
  ctx.rotate(element.rotation * Math.PI / 180);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#18202b";
  ctx.fillStyle = "#18202b";
  ctx.lineWidth = 2 / scale;
  ctx.font = `italic 22px Georgia, serif`;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (element.kind) {
    case "point-mass":
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); drawText(ctx, element.label, 18, -12); break;
    case "block":
      ctx.fillStyle = "#fff"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, -w * .2, 7); break;
    case "sphere":
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#18202b"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); drawText(ctx, element.label, 0, 8); break;
    case "disk":
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); line(ctx, -w * .35, 0, w * .35, 0); line(ctx, 0, -h * .35, 0, h * .35); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, w * .22, -h * .18); break;
    case "wedge":
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, w * .18, h * .16); break;
    case "cart":
      ctx.fillStyle = "#fff"; ctx.fillRect(-w / 2, -h / 2, w, h * .65); ctx.strokeRect(-w / 2, -h / 2, w, h * .65); ctx.beginPath(); ctx.arc(-w * .3, h * .3, h * .14, 0, Math.PI * 2); ctx.arc(w * .3, h * .3, h * .14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, 0, -h * .14); break;

    case "ceiling":
      line(ctx, -w / 2, 0, w / 2, 0); for (let x = -w / 2; x < w / 2; x += 18) line(ctx, x, 0, x + 10, -12); break;
    case "step":
      ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(0, h / 2); ctx.lineTo(0, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2, -h / 2); ctx.stroke(); break;
    case "corner":
      line(ctx, -w / 2, h / 2, w / 2, h / 2); line(ctx, w / 2, h / 2, w / 2, -h / 2); break;
    case "curved-surface":
      ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.quadraticCurveTo(0, -h / 2, w / 2, h / 2); ctx.stroke(); break;

    case "fixed-end":
      line(ctx, 0, -h / 2, 0, h / 2); for (let y = -h / 2; y < h / 2; y += 17) line(ctx, 0, y, -14, y + 9); break;
    case "pin-support":
      ctx.beginPath(); ctx.arc(0, -h / 2 + 7, 7, 0, Math.PI * 2); ctx.stroke(); supportTriangle(ctx, w, h * .75); line(ctx, -w / 2, h / 2, w / 2, h / 2); break;
    case "hinge":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .28, 0, Math.PI * 2); ctx.stroke(); line(ctx, -w / 2, h / 2, w / 2, h / 2); break;
    case "roller-support":
      supportTriangle(ctx, w, h * .65); for (const x of [-w * .28, 0, w * .28]) { ctx.beginPath(); ctx.arc(x, h * .4, 7, 0, Math.PI * 2); ctx.stroke(); } line(ctx, -w / 2, h / 2, w / 2, h / 2); break;
    case "simple-support":
      supportTriangle(ctx, w * .35, h * .7); ctx.save(); ctx.translate(w * .35, 0); supportTriangle(ctx, w * .35, h * .7); ctx.restore(); line(ctx, -w / 2, -h / 2, w / 2, -h / 2); break;
    case "strut":
      ctx.lineWidth = 5 / scale; line(ctx, -w / 2, 0, w / 2, 0); ctx.lineWidth = 2 / scale; for (const x of [-w / 2, w / 2]) { ctx.beginPath(); ctx.arc(x, 0, 6, 0, Math.PI * 2); ctx.fill(); } drawText(ctx, element.label, 0, -14); break;

    case "string":
      ctx.lineWidth = 1.5 / scale; line(ctx, -w / 2, 0, w / 2, 0); drawText(ctx, element.label, 0, -13); break;
    case "rope":
      ctx.lineWidth = 3.5 / scale; line(ctx, -w / 2, 0, w / 2, 0); drawText(ctx, element.label, 0, -14); break;
    case "cable":
      ctx.lineWidth = 2.5 / scale; ctx.setLineDash([9 / scale, 5 / scale]); line(ctx, -w / 2, 0, w / 2, 0); ctx.setLineDash([]); drawText(ctx, element.label, 0, -14); break;
    case "light-rod":
      ctx.lineWidth = 5 / scale; line(ctx, -w / 2, 0, w / 2, 0); ctx.lineWidth = 2 / scale; for (const x of [-w / 2, w / 2]) { ctx.beginPath(); ctx.arc(x, 0, 5, 0, Math.PI * 2); ctx.fill(); } drawText(ctx, element.label, 0, -15); break;
    case "spring":
      spring(ctx, w); drawText(ctx, element.label, 0, -19); break;
    case "damper":
      line(ctx, -w / 2, 0, -w * .15, 0); line(ctx, w * .15, 0, w / 2, 0); ctx.strokeRect(-w * .15, -h * .28, w * .3, h * .56); line(ctx, 0, -h * .45, 0, h * .45); drawText(ctx, element.label, 0, -h * .65); break;

    case "fixed-pulley":
    case "movable-pulley": {
      const radius = Math.min(w, h) * .28; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      if (element.kind === "fixed-pulley") { line(ctx, 0, -radius, 0, -h / 2); line(ctx, -20, -h / 2, 20, -h / 2); }
      else { line(ctx, 0, radius, 0, h / 2); }
      ctx.beginPath(); ctx.moveTo(-radius, h / 2); ctx.lineTo(-radius, 0); ctx.arc(0, 0, radius, Math.PI, 0); ctx.lineTo(radius, h / 2); ctx.stroke(); drawText(ctx, element.label, radius + 18, 0); break;
    }
    case "compound-pulley":
      for (const x of [-w * .2, w * .2]) { ctx.beginPath(); ctx.arc(x, -h * .18, 25, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, h * .22, 25, 0, Math.PI * 2); ctx.stroke(); } line(ctx, -w * .35, -h / 2, w * .35, -h / 2); drawText(ctx, element.label, w * .35, 0); break;
    case "wheel-axle":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .46, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .2, 0, Math.PI * 2); ctx.stroke(); line(ctx, -w / 2, 0, w / 2, 0); drawText(ctx, element.label, w * .3, -h * .3); break;
    case "rotation-axis":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .25, 0, Math.PI * 2); ctx.stroke(); line(ctx, -w / 2, 0, w / 2, 0); line(ctx, 0, -h / 2, 0, h / 2); drawText(ctx, element.label, 18, -18); break;
    case "belt":
      for (const x of [-w * .34, w * .34]) { ctx.beginPath(); ctx.arc(x, 0, h * .28, 0, Math.PI * 2); ctx.stroke(); } line(ctx, -w * .34, -h * .28, w * .34, -h * .28); line(ctx, -w * .34, h * .28, w * .34, h * .28); arrow(ctx, w * .4, element.label); break;

    case "straight-track":
      line(ctx, -w / 2, 0, w / 2, 0); line(ctx, -w / 2, 9, w / 2, 9); break;
    case "circular-track":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .45, 0, Math.PI * 2); ctx.stroke(); drawText(ctx, element.label, 20, -8); break;
    case "curved-track":
      ctx.beginPath(); ctx.moveTo(-w / 2, h * .25); ctx.bezierCurveTo(-w * .2, -h / 2, w * .2, h / 2, w / 2, -h * .25); ctx.stroke(); break;
    case "projectile-path":
      ctx.setLineDash([7 / scale, 5 / scale]); ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.quadraticCurveTo(0, -h / 2, w / 2, h / 2); ctx.stroke(); ctx.setLineDash([]); break;

    case "fluid-surface":
      ctx.beginPath(); for (let x = -w / 2; x <= w / 2; x += 10) { const y = Math.sin((x + w / 2) / 10 * Math.PI) * 4; if (x === -w / 2) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); break;
    case "container":
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(w / 2, -h / 2); ctx.stroke(); break;
    case "fluid-region":
      ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = "#3178d4"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); ctx.strokeRect(-w / 2, -h / 2, w, h); drawText(ctx, element.label); break;

    case "force": case "gravity": case "normal-force": case "friction-force": case "tension": case "spring-force":
    case "drag-force": case "buoyancy": case "thrust": case "velocity": case "acceleration": case "momentum":
      arrow(ctx, w, element.label, element.rotation * Math.PI / 180); break;
    case "moment":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .36, Math.PI * .25, Math.PI * 1.85); ctx.stroke(); ctx.save(); ctx.rotate(Math.PI * 1.85); ctx.translate(Math.min(w, h) * .36, 0); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, -6); ctx.lineTo(-12, 6); ctx.closePath(); ctx.fill(); ctx.restore(); drawText(ctx, element.label); break;

    case "local-axis":
      arrow(ctx, w * .8, "x"); ctx.save(); ctx.rotate(-Math.PI / 2); arrow(ctx, h * .8, "y"); ctx.restore(); break;
    case "angle-arc":
      line(ctx, 0, 0, w / 2, 0); line(ctx, 0, 0, w * .35, -h * .35); ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .3, -Math.PI / 4, 0); ctx.stroke(); drawText(ctx, element.label, w * .28, -h * .12); break;
    case "length-dimension":
      line(ctx, -w / 2, 0, w / 2, 0); line(ctx, -w / 2, -10, -w / 2, 10); line(ctx, w / 2, -10, w / 2, 10); drawText(ctx, element.label, 0, -14); break;
    case "radius-dimension":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .42, 0, Math.PI * 2); ctx.stroke(); arrow(ctx, w * .42, element.label); break;
    case "center-of-mass":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .35, 0, Math.PI * 2); ctx.stroke(); line(ctx, -w * .25, 0, w * .25, 0); line(ctx, 0, -h * .25, 0, h * .25); drawText(ctx, element.label, w * .5, -h * .3); break;
    case "point-label":
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); drawText(ctx, element.label, 14, -10); break;
    case "construction-line":
      ctx.setLineDash([7 / scale, 5 / scale]); line(ctx, -w / 2, 0, w / 2, 0); ctx.setLineDash([]); break;
    case "text":
      ctx.font = `18px system-ui, sans-serif`; drawText(ctx, element.label, 0, 0); break;
  }

  if (selected) {
    ctx.save();
    ctx.strokeStyle = "#3178d4";
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([5 / scale, 4 / scale]);
    ctx.strokeRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
    ctx.setLineDash([]);
    for (const [x, y] of [[-w / 2 - 8, -h / 2 - 8], [w / 2 + 8, h / 2 + 8]]) {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 5 / scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export function diagramElementContainsPoint(element: DiagramElement, contentPoint: Point, padding = 12) {
  if (!element.visible) return false;
  const radians = -element.rotation * Math.PI / 180;
  const dx = contentPoint.x - element.x;
  const dy = contentPoint.y - element.y;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= element.width / 2 + padding && Math.abs(localY) <= element.height / 2 + padding;
}
