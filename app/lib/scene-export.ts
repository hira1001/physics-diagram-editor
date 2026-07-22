import type { SceneState } from "@/app/lib/editor-types";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Produces a deterministic, editable SVG representation of the current scene.
 * The element order is the export z-order: structure, object, vectors, labels.
 */
export function sceneToSvg(scene: SceneState) {
  const angle = (scene.angle * Math.PI) / 180;
  const direction = scene.flipped ? -1 : 1;
  const start = {
    x: (scene.flipped ? 780 : 120) + scene.diagramOffsetX,
    y: 430 + scene.diagramOffsetY,
  };
  const length = 560;
  const end = {
    x: start.x + direction * Math.cos(angle) * length,
    y: start.y - Math.sin(angle) * length,
  };
  const tangent = { x: direction * Math.cos(angle), y: -Math.sin(angle) };
  const normal = { x: -direction * Math.sin(angle), y: -Math.cos(angle) };
  const linePoint = {
    x: start.x + tangent.x * length * scene.blockPosition,
    y: start.y + tangent.y * length * scene.blockPosition,
  };
  const block = {
    x: linePoint.x + normal.x * 55 + scene.blockOffsetX,
    y: linePoint.y + normal.y * 55 + scene.blockOffsetY,
  };
  const arrow = (x1: number, y1: number, x2: number, y2: number, label: string) =>
    `<g data-layer="vector" data-vector="${escapeXml(label)}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#18202b" stroke-width="3" marker-end="url(#arrow)"/><text data-layer="label" x="${x2 + 12}" y="${y2}" font-size="24" font-style="italic">${escapeXml(label)}</text></g>`;
  const angleLabelDirection = scene.flipped ? Math.PI + angle / 2 : -angle / 2;
  const angleLabel = {
    x: start.x + Math.cos(angleLabelDirection) * 90 + scene.angleLabelOffsetX,
    y: start.y + Math.sin(angleLabelDirection) * 90 + scene.angleLabelOffsetY,
  };
  const baselineArcPoint = { x: start.x + direction * 70, y: start.y };
  const slopeArcPoint = {
    x: start.x + tangent.x * 70,
    y: start.y + tangent.y * 70,
  };
  const safeText = escapeXml(scene.annotationText);
  const safeMass = escapeXml(scene.massLabel);
  const blockRotation = scene.flipped ? scene.angle : -scene.angle;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#18202b"/></marker></defs><rect data-layer="paper" width="900" height="560" fill="white"/><path data-layer="structure" d="M${start.x},${start.y} L${end.x},${end.y} L${end.x},${start.y} Z" fill="none" stroke="#18202b" stroke-width="3"/><g data-layer="object" transform="translate(${block.x} ${block.y}) rotate(${blockRotation})"><rect x="-70" y="-45" width="140" height="90" fill="white" stroke="#18202b" stroke-width="3"/></g>${scene.showGravity ? arrow(block.x, block.y, block.x, block.y + 120, "mg") : ""}${scene.showNormal ? arrow(block.x, block.y, block.x + normal.x * 120, block.y + normal.y * 120, "N") : ""}${scene.showFriction ? arrow(block.x, block.y, block.x + tangent.x * 120, block.y + tangent.y * 120, "f") : ""}<g data-layer="label" transform="translate(${block.x} ${block.y}) rotate(${blockRotation})"><text x="${-25 + scene.massLabelOffsetX}" y="${18 + scene.massLabelOffsetY}" text-anchor="middle" font-size="30" font-style="italic">${safeMass}</text></g>${scene.showAngle ? `<path data-layer="structure" d="M${baselineArcPoint.x},${baselineArcPoint.y} A70 70 0 0 ${scene.flipped ? 1 : 0} ${slopeArcPoint.x},${slopeArcPoint.y}" fill="none" stroke="#18202b" stroke-width="2"/><text data-layer="label" x="${angleLabel.x}" y="${angleLabel.y}" font-size="25" font-style="italic">θ</text>` : ""}${scene.showAnnotation ? `<text data-layer="label" x="${scene.annotationX * 900}" y="${scene.annotationY * 560}" text-anchor="middle" font-size="20">${safeText}</text>` : ""}</svg>`;
}
