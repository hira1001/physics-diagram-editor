import type { DiagramElement } from "@/app/lib/editor-types";
import type { Point } from "@/app/components/EditorCanvas";

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function arrow(ctx: CanvasRenderingContext2D, length: number, label: string, elementRotation = 0, labelOffsetX = 0, labelOffsetY = 0) {
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
    ctx.translate(end + localOffsetX + labelOffsetX, localOffsetY + labelOffsetY);
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

function drawText(ctx: CanvasRenderingContext2D, label: string, x = 0, y = 7, labelOffsetX = 0, labelOffsetY = 0, elementRotation = 0) {
  if (!label) return;
  ctx.save();
  ctx.translate(x + labelOffsetX, y + labelOffsetY);
  if (elementRotation !== 0) {
    ctx.rotate(-elementRotation);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawInclineWedge(ctx: CanvasRenderingContext2D, width: number, height: number, label: string, rough: boolean, labelOffsetX = 0, labelOffsetY = 0, elementRotation = 0, shapeStyle: "wedge" | "line" = "wedge") {
  if (shapeStyle === "line") {
    drawCatalogSurface(ctx, width, label, rough, labelOffsetX, labelOffsetY, elementRotation);
    return;
  }
  const h = Math.max(30, height);
  const w = Math.max(40, width);
  ctx.save();
  ctx.fillStyle = "rgba(241, 245, 249, 0.6)";
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw angle arc (θ) at acute corner on the LEFT (-w / 2, h / 2)
  const angleRad = Math.atan2(h, w);
  const angleDeg = Math.round(angleRad * 180 / Math.PI);
  const arcRadius = Math.min(w, h) * 0.35;
  ctx.beginPath();
  ctx.arc(-w / 2, h / 2, arcRadius, 0, -angleRad, true);
  ctx.stroke();

  ctx.save();
  ctx.translate(-w / 2 + arcRadius + 12, h / 2 - 8);
  ctx.rotate(-elementRotation);
  ctx.font = "italic 12px Georgia, serif";
  ctx.fillStyle = "#18202b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label || `${angleDeg}°`, 0, 0);
  ctx.restore();

  if (rough) {
    for (let x = -w / 2 + 10; x < w / 2; x += 16) {
      line(ctx, x, h / 2, x - 8, h / 2 + 10);
    }
  }
  ctx.restore();
}

function drawCatalogSurface(ctx: CanvasRenderingContext2D, width: number, label: string, rough: boolean, labelOffsetX = 0, labelOffsetY = 0, elementRotation = 0) {
  line(ctx, -width / 2, 0, width / 2, 0);
  if (rough) {
    for (let x = -width / 2 + 12; x < width / 2; x += 17) line(ctx, x, 0, x - 8, 11);
  }
  drawText(ctx, label, 0, rough ? 24 : 18, labelOffsetX, labelOffsetY, elementRotation);
}

function rotationalArrow(ctx: CanvasRenderingContext2D, width: number, height: number, label: string, elementRotation: number, labelOffsetX = 0, labelOffsetY = 0) {
  const radius = Math.min(width, height) * .36;
  ctx.beginPath();
  ctx.arc(0, 0, radius, Math.PI * .25, Math.PI * 1.85);
  ctx.stroke();
  ctx.save();
  ctx.rotate(Math.PI * 1.85);
  ctx.translate(radius, 0);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-12, -6);
  ctx.lineTo(-12, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (label) {
    ctx.save();
    ctx.translate(-radius * .85 + labelOffsetX, -radius - 12 + labelOffsetY);
    ctx.rotate(-elementRotation);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
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
  const lx = element.labelOffsetX ?? 0;
  const ly = element.labelOffsetY ?? 0;
  const rotRad = element.rotation * Math.PI / 180;
  ctx.save();
  ctx.translate(contentOrigin.x + element.x * scale, contentOrigin.y + element.y * scale);
  ctx.rotate(rotRad);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#18202b";
  ctx.fillStyle = "#18202b";
  ctx.lineWidth = element.lineWidth / scale;
  ctx.font = `italic ${element.fontSize}px Georgia, serif`;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (element.kind) {
    case "point-mass":
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); drawText(ctx, element.label, 18, -12, lx, ly, rotRad); break;
    case "block":
      ctx.fillStyle = "#fff"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, -w * .2, 7, lx, ly, rotRad); break;
    case "sphere":
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#18202b"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); drawText(ctx, element.label, 0, 8, lx, ly, rotRad); break;
    case "disk":
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); line(ctx, -w * .35, 0, w * .35, 0); line(ctx, 0, -h * .35, 0, h * .35); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, w * .22, -h * .18, lx, ly, rotRad); break;
    case "cylinder":
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(0, -h * .32, w * .46, h * .16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); line(ctx, -w * .46, -h * .32, -w * .46, h * .32); line(ctx, w * .46, -h * .32, w * .46, h * .32); ctx.beginPath(); ctx.ellipse(0, h * .32, w * .46, h * .16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, 0, 7, lx, ly, rotRad); break;
    case "wedge":
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, w * .18, h * .16, lx, ly, rotRad); break;
    case "cart":
      ctx.fillStyle = "#fff"; ctx.fillRect(-w / 2, -h / 2, w, h * .65); ctx.strokeRect(-w / 2, -h / 2, w, h * .65); ctx.beginPath(); ctx.arc(-w * .3, h * .3, h * .14, 0, Math.PI * 2); ctx.arc(w * .3, h * .3, h * .14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#18202b"; drawText(ctx, element.label, 0, -h * .14, lx, ly, rotRad); break;

    case "smooth-floor": case "smooth-wall":
      drawCatalogSurface(ctx, w, element.label, false, lx, ly, rotRad); break;
    case "rough-floor": case "rough-wall":
      drawCatalogSurface(ctx, w, element.label, true, lx, ly, rotRad); break;
    case "smooth-incline":
      drawInclineWedge(ctx, w, h, element.label, false, lx, ly, rotRad, element.shapeStyle); break;
    case "rough-incline":
      drawInclineWedge(ctx, w, h, element.label, true, lx, ly, rotRad, element.shapeStyle); break;

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
      ctx.lineWidth = element.lineWidth * 2.5 / scale; line(ctx, -w / 2, 0, w / 2, 0); ctx.lineWidth = element.lineWidth / scale; for (const x of [-w / 2, w / 2]) { ctx.beginPath(); ctx.arc(x, 0, 6, 0, Math.PI * 2); ctx.fill(); } drawText(ctx, element.label, 0, -14, lx, ly, rotRad); break;
    case "rigid-joint":
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); line(ctx, -w / 2, 0, w / 2, 0); line(ctx, 0, -h / 2, 0, h / 2); break;
    case "beam":
      ctx.lineWidth = element.lineWidth * 2.2 / scale; line(ctx, -w / 2, 0, w / 2, 0); ctx.lineWidth = element.lineWidth / scale; drawText(ctx, element.label, 0, -14, lx, ly, rotRad); break;
    case "h-beam": {
      const flange = h * .22;
      ctx.lineWidth = element.lineWidth * 1.8 / scale;
      line(ctx, -w / 2, -flange, w / 2, -flange);
      line(ctx, -w / 2, flange, w / 2, flange);
      line(ctx, 0, -h / 2, 0, h / 2);
      ctx.lineWidth = element.lineWidth / scale;
      drawText(ctx, element.label, 0, -h / 2 - 12, lx, ly, rotRad);
      break;
    }
    case "structural-column":
      ctx.lineWidth = element.lineWidth * 2.5 / scale; line(ctx, 0, -h / 2, 0, h / 2); ctx.lineWidth = element.lineWidth / scale; drawText(ctx, element.label, w / 2 + 8, 0, lx, ly, rotRad); break;
    case "truss-member":
      ctx.lineWidth = element.lineWidth * 1.8 / scale; line(ctx, -w / 2, h / 2, w / 2, -h / 2); ctx.lineWidth = element.lineWidth / scale; break;
    case "distributed-load": {
      const arrowCount = Math.max(3, Math.round(w / 35));
      line(ctx, -w / 2, -h / 2, w / 2, -h / 2);
      line(ctx, -w / 2, h / 2, w / 2, h / 2);
      ctx.fillStyle = ctx.strokeStyle;
      for (let i = 0; i < arrowCount; i++) {
        const x = -w / 2 + (w / Math.max(1, arrowCount - 1)) * i;
        line(ctx, x, -h / 2, x, h / 2);
        ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x - 4, h / 2 - 8); ctx.lineTo(x + 4, h / 2 - 8); ctx.closePath(); ctx.fill();
      }
      drawText(ctx, element.label || "w", 0, -h / 2 - 14, lx, ly, rotRad);
      break;
    }
    case "triangular-load": {
      const arrowCount = Math.max(3, Math.round(w / 35));
      line(ctx, -w / 2, h / 2, w / 2, -h / 2);
      line(ctx, -w / 2, h / 2, w / 2, h / 2);
      ctx.fillStyle = ctx.strokeStyle;
      for (let i = 0; i < arrowCount; i++) {
        const t = i / Math.max(1, arrowCount - 1);
        const x = -w / 2 + w * t;
        const topY = h / 2 - h * t;
        line(ctx, x, topY, x, h / 2);
        if (t > 0) {
          ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x - 3, h / 2 - 7); ctx.lineTo(x + 3, h / 2 - 7); ctx.closePath(); ctx.fill();
        }
      }
      drawText(ctx, element.label || "q", w / 4, -h / 2 - 10, lx, ly, rotRad);
      break;
    }
    case "bending-moment": {
      const r = Math.min(w, h) * 0.38;
      ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI * 0.8, Math.PI * 0.7); ctx.stroke();
      const endAngle = Math.PI * 0.7;
      const endX = r * Math.cos(endAngle);
      const endY = r * Math.sin(endAngle);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(endX, endY); ctx.lineTo(endX - 8, endY - 6); ctx.lineTo(endX - 4, endY + 8); ctx.closePath(); ctx.fill();
      drawText(ctx, element.label || "M", 0, -r - 12, lx, ly, rotRad);
      break;
    }
    case "shear-diagram": {
      ctx.save(); ctx.fillStyle = "rgba(49, 120, 212, 0.15)";
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -h / 2); ctx.lineTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      line(ctx, -w / 2, 0, w / 2, 0); ctx.restore();
      drawText(ctx, element.label || "SFD", 0, -h / 2 - 12, lx, ly, rotRad);
      break;
    }
    case "moment-diagram": {
      ctx.save(); ctx.fillStyle = "rgba(49, 120, 212, 0.15)";
      ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, h / 2, w / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      line(ctx, -w / 2, 0, w / 2, 0); ctx.restore();
      drawText(ctx, element.label || "BMD", 0, h / 2 + 16, lx, ly, rotRad);
      break;
    }

    case "string":
      ctx.lineWidth = element.lineWidth * .75 / scale; line(ctx, -w / 2, 0, w / 2, 0); drawText(ctx, element.label, 0, -13, lx, ly, rotRad); break;
    case "rope":
      ctx.lineWidth = element.lineWidth * 1.75 / scale; line(ctx, -w / 2, 0, w / 2, 0); drawText(ctx, element.label, 0, -14, lx, ly, rotRad); break;
    case "cable":
      ctx.lineWidth = element.lineWidth * 1.25 / scale; ctx.setLineDash([9 / scale, 5 / scale]); line(ctx, -w / 2, 0, w / 2, 0); ctx.setLineDash([]); drawText(ctx, element.label, 0, -14, lx, ly, rotRad); break;
    case "light-rod":
      ctx.lineWidth = element.lineWidth * 2.5 / scale; line(ctx, -w / 2, 0, w / 2, 0); ctx.lineWidth = element.lineWidth / scale; for (const x of [-w / 2, w / 2]) { ctx.beginPath(); ctx.arc(x, 0, 5, 0, Math.PI * 2); ctx.fill(); } drawText(ctx, element.label, 0, -15, lx, ly, rotRad); break;
    case "spring":
      spring(ctx, w); drawText(ctx, element.label, 0, -19, lx, ly, rotRad); break;
    case "damper":
      line(ctx, -w / 2, 0, -w * .15, 0); line(ctx, w * .15, 0, w / 2, 0); ctx.strokeRect(-w * .15, -h * .28, w * .3, h * .56); line(ctx, 0, -h * .45, 0, h * .45); drawText(ctx, element.label, 0, -h * .65, lx, ly, rotRad); break;

    case "fixed-pulley":
    case "movable-pulley": {
      const radius = Math.min(w, h) * .28; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      if (element.kind === "fixed-pulley") { line(ctx, 0, -radius, 0, -h / 2); line(ctx, -20, -h / 2, 20, -h / 2); }
      else { line(ctx, 0, radius, 0, h / 2); }
      ctx.beginPath(); ctx.moveTo(-radius, h / 2); ctx.lineTo(-radius, 0); ctx.arc(0, 0, radius, Math.PI, 0); ctx.lineTo(radius, h / 2); ctx.stroke(); drawText(ctx, element.label, radius + 18, 0, lx, ly, rotRad); break;
    }
    case "compound-pulley":
      for (const x of [-w * .2, w * .2]) { ctx.beginPath(); ctx.arc(x, -h * .18, 25, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, h * .22, 25, 0, Math.PI * 2); ctx.stroke(); } line(ctx, -w * .35, -h / 2, w * .35, -h / 2); drawText(ctx, element.label, w * .35, 0, lx, ly, rotRad); break;
    case "wheel-axle":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .46, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .2, 0, Math.PI * 2); ctx.stroke(); line(ctx, -w / 2, 0, w / 2, 0); drawText(ctx, element.label, w * .3, -h * .3, lx, ly, rotRad); break;
    case "rotation-axis":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .25, 0, Math.PI * 2); ctx.stroke(); line(ctx, -w / 2, 0, w / 2, 0); line(ctx, 0, -h / 2, 0, h / 2); drawText(ctx, element.label, 18, -18, lx, ly, rotRad); break;
    case "belt":
      for (const x of [-w * .34, w * .34]) { ctx.beginPath(); ctx.arc(x, 0, h * .28, 0, Math.PI * 2); ctx.stroke(); } line(ctx, -w * .34, -h * .28, w * .34, -h * .28); line(ctx, -w * .34, h * .28, w * .34, h * .28); arrow(ctx, w * .4, element.label, rotRad, lx, ly); break;

    case "straight-track":
      line(ctx, -w / 2, 0, w / 2, 0); line(ctx, -w / 2, 9, w / 2, 9); break;
    case "circular-track":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .45, 0, Math.PI * 2); ctx.stroke(); drawText(ctx, element.label, 20, -8, lx, ly, rotRad); break;
    case "curved-track":
      ctx.beginPath(); ctx.moveTo(-w / 2, h * .25); ctx.bezierCurveTo(-w * .2, -h / 2, w * .2, h / 2, w / 2, -h * .25); ctx.stroke(); break;
    case "projectile-path":
      ctx.setLineDash([7 / scale, 5 / scale]); ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.quadraticCurveTo(0, -h / 2, w / 2, h / 2); ctx.stroke(); ctx.setLineDash([]); break;

    case "fluid-surface":
      ctx.beginPath(); for (let x = -w / 2; x <= w / 2; x += 10) { const y = Math.sin((x + w / 2) / 10 * Math.PI) * 4; if (x === -w / 2) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); break;
    case "container":
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(w / 2, -h / 2); ctx.stroke(); break;
    case "fluid-region":
      ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = "#3178d4"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); ctx.strokeRect(-w / 2, -h / 2, w, h); drawText(ctx, element.label, 0, 7, lx, ly, rotRad); break;

    case "force": case "gravity": case "normal-force": case "friction-force": case "tension": case "spring-force":
    case "drag-force": case "buoyancy": case "thrust": case "velocity": case "acceleration": case "momentum":
      arrow(ctx, w, element.label, rotRad, lx, ly); break;
    case "moment": case "angular-velocity": case "angular-acceleration": case "rotation-direction":
      rotationalArrow(ctx, w, h, element.label, rotRad, lx, ly); break;

    case "local-axis":
      arrow(ctx, w * .8, "x", rotRad, lx, ly); ctx.save(); ctx.rotate(-Math.PI / 2); arrow(ctx, h * .8, "y", rotRad, lx, ly); ctx.restore(); break;
    case "angle-arc":
      line(ctx, 0, 0, w / 2, 0); line(ctx, 0, 0, w * .35, -h * .35); ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .3, -Math.PI / 4, 0); ctx.stroke(); drawText(ctx, element.label, w * .28, -h * .12, lx, ly, rotRad); break;
    case "length-dimension":
      line(ctx, -w / 2, 0, w / 2, 0); line(ctx, -w / 2, -10, -w / 2, 10); line(ctx, w / 2, -10, w / 2, 10); drawText(ctx, element.label, 0, -14, lx, ly, rotRad); break;
    case "radius-dimension":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .42, 0, Math.PI * 2); ctx.stroke(); arrow(ctx, w * .42, element.label, rotRad, lx, ly); break;
    case "center-of-mass":
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * .35, 0, Math.PI * 2); ctx.stroke(); line(ctx, -w * .25, 0, w * .25, 0); line(ctx, 0, -h * .25, 0, h * .25); drawText(ctx, element.label, w * .5, -h * .3, lx, ly, rotRad); break;
    case "point-label":
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); drawText(ctx, element.label, 14, -10, lx, ly, rotRad); break;
    case "construction-line":
      ctx.setLineDash([7 / scale, 5 / scale]); line(ctx, -w / 2, 0, w / 2, 0); ctx.setLineDash([]); break;
    case "text":
      ctx.font = `${element.fontSize}px system-ui, sans-serif`; drawText(ctx, element.label, 0, 0, lx, ly, rotRad); break;
  }

  if (selected) {
    ctx.save();
    ctx.strokeStyle = "#3178d4";
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([5 / scale, 4 / scale]);
    ctx.strokeRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
    ctx.setLineDash([]);

    // Draw rotation stem and handle at top center
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 - 8);
    ctx.lineTo(0, -h / 2 - 28);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -h / 2 - 28, 6 / scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw corner and edge resize handles
    const handles = [
      [-w / 2 - 8, -h / 2 - 8], // top-left
      [w / 2 + 8, -h / 2 - 8],  // top-right
      [-w / 2 - 8, h / 2 + 8],  // bottom-left
      [w / 2 + 8, h / 2 + 8],   // bottom-right (corner)
      [w / 2 + 8, 0],           // right-edge (width stretch)
      [0, h / 2 + 8],           // bottom-edge (height stretch)
    ];
    for (const [hx, hy] of handles) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(hx, hy, 5 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
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
