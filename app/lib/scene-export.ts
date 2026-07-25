import type { SceneState } from "@/app/lib/editor-types";
import { diagramElementsToSvg } from "@/app/lib/catalog-svg";
import type { ExportBackground } from "@/app/lib/export-types";

export interface SvgExportOptions {
  background?: ExportBackground;
  margin?: number;
  selectedId?: SceneState["selectedId"];
}

/**
 * Catalog-elements-only SVG export (legacy incline wizard removed).
 */
export function sceneToSvg(scene: SceneState, options: SvgExportOptions = {}) {
  const margin = Math.max(0, Math.min(200, Math.round(options.margin ?? 0)));
  const background = options.background ?? "white";
  const selectedId = options.selectedId;
  const selectedElementId = selectedId?.startsWith("element:") ? selectedId.slice("element:".length) : null;
  const catalogElements = selectedElementId
    ? scene.elements.filter((element) => element.id === selectedElementId)
    : scene.elements;

  const width = 900 + margin * 2;
  const height = 560 + margin * 2;
  const paper = background === "white"
    ? `<rect data-layer="paper" x="${-margin}" y="${-margin}" width="${width}" height="${height}" fill="white"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-margin} ${-margin} ${width} ${height}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#18202b"/></marker></defs>${paper}${diagramElementsToSvg(catalogElements)}</svg>`;
}
