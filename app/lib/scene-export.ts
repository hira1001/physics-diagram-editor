import type { SceneState } from "@/app/lib/editor-types";
import { blockRotationDegrees, effectiveSurfaceAngle, massLabelBaseX, surfaceContactClearance } from "@/app/lib/physics-rules";
import { diagramElementsToSvg } from "@/app/lib/catalog-svg";
import type { ExportBackground } from "@/app/lib/export-types";

export interface SvgExportOptions {
  background?: ExportBackground;
  margin?: number;
  selectedId?: SceneState["selectedId"];
}

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
export function sceneToSvg(scene: SceneState, options: SvgExportOptions = {}) {
  const margin = Math.max(0, Math.min(200, Math.round(options.margin ?? 0)));
  const background = options.background ?? "white";
  const selectedId = options.selectedId;
  const selectedElementId = selectedId?.startsWith("element:") ? selectedId.slice("element:".length) : null;
  const include = (id: NonNullable<SceneState["selectedId"]>) => !selectedId || selectedId === id;
  const effectiveAngle = effectiveSurfaceAngle(scene);
  const angle = (effectiveAngle * Math.PI) / 180;
  const direction = scene.flipped ? -1 : 1;
  const start = {
    x: (scene.flipped ? 780 : 120) + scene.diagramOffsetX,
    y: (scene.surfaceKind === "wall" ? 500 : 430) + scene.diagramOffsetY,
  };
  const length = scene.surfaceKind === "wall" ? 400 : 560;
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
    x: linePoint.x + normal.x * surfaceContactClearance(scene.surfaceKind) + scene.blockOffsetX,
    y: linePoint.y + normal.y * surfaceContactClearance(scene.surfaceKind) + scene.blockOffsetY,
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
  const blockRotation = blockRotationDegrees(scene);

  const structurePath = scene.surfaceKind === "incline"
    ? `M${start.x},${start.y} L${end.x},${end.y} L${end.x},${start.y} Z`
    : `M${start.x},${start.y} L${end.x},${end.y}`;
  const roughMarks = scene.surfaceRoughness === "rough"
    ? Array.from({ length: 17 }, (_, index) => {
      const t = (index + 1) / 18;
      const point = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
      return `<line data-layer="surface-texture" x1="${point.x}" y1="${point.y}" x2="${point.x - normal.x * 12 - tangent.x * 5}" y2="${point.y - normal.y * 12 - tangent.y * 5}" stroke="#18202b" stroke-width="1.2"/>`;
    }).join("")
    : "";

  const width = 900 + margin * 2;
  const height = 560 + margin * 2;
  const paper = background === "white" ? `<rect data-layer="paper" x="${-margin}" y="${-margin}" width="${width}" height="${height}" fill="white"/>` : "";
  const legacyStructure = include("incline") ? `<path data-layer="structure" data-surface-kind="${scene.surfaceKind}" data-surface-roughness="${scene.surfaceRoughness}" d="${structurePath}" fill="none" stroke="#18202b" stroke-width="3"/>${roughMarks}` : "";
  const legacyObject = include("block") || include("mass-label") ? `<g data-layer="object" transform="translate(${block.x} ${block.y}) rotate(${blockRotation})"><rect x="-70" y="-45" width="140" height="90" fill="white" stroke="#18202b" stroke-width="3"/></g>` : "";
  const massLabel = include("block") || include("mass-label") ? `<g data-layer="label" transform="translate(${block.x} ${block.y}) rotate(${blockRotation})"><text x="${massLabelBaseX(scene) + scene.massLabelOffsetX}" y="${18 + scene.massLabelOffsetY}" text-anchor="middle" font-size="30" font-style="italic">${safeMass}</text></g>` : "";
  const catalogElements = selectedElementId ? scene.elements.filter((element) => element.id === selectedElementId) : scene.elements;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-margin} ${-margin} ${width} ${height}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#18202b"/></marker></defs>${paper}${legacyStructure}${legacyObject}${scene.showGravity && include("force-gravity") ? arrow(block.x, block.y, block.x, block.y + 120, "mg") : ""}${scene.showNormal && include("force-normal") ? arrow(block.x, block.y, block.x + normal.x * 120, block.y + normal.y * 120, "N") : ""}${scene.showFriction && include("force-friction") ? arrow(block.x, block.y, block.x + tangent.x * 120, block.y + tangent.y * 120, "f") : ""}${massLabel}${scene.showAngle && scene.surfaceKind === "incline" && include("angle") ? `<path data-layer="structure" d="M${baselineArcPoint.x},${baselineArcPoint.y} A70 70 0 0 ${scene.flipped ? 1 : 0} ${slopeArcPoint.x},${slopeArcPoint.y}" fill="none" stroke="#18202b" stroke-width="2"/><text data-layer="label" x="${angleLabel.x}" y="${angleLabel.y}" font-size="25" font-style="italic">θ</text>` : ""}${scene.showAnnotation && include("text") ? `<text data-layer="label" x="${scene.annotationX * 900}" y="${scene.annotationY * 560}" text-anchor="middle" font-size="20">${safeText}</text>` : ""}${diagramElementsToSvg(catalogElements)}</svg>`;
}
