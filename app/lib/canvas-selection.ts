import type { DiagramElement } from "@/app/lib/editor-types";
import { isVectorElement, resolveDiagramElement } from "@/app/lib/diagram-model";

export interface ContentRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function elementContentRect(element: DiagramElement, elements: readonly DiagramElement[]): ContentRect {
  const resolved = resolveDiagramElement(element, elements);
  const rad = (resolved.rotation * Math.PI) / 180;
  const halfW = resolved.width / 2;
  const halfH = resolved.height / 2;
  const corners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ].map(({ x, y }) => ({
    x: resolved.x + x * Math.cos(rad) - y * Math.sin(rad),
    y: resolved.y + x * Math.sin(rad) + y * Math.cos(rad),
  }));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

function rectsIntersect(a: ContentRect, b: ContentRect) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function rectContains(outer: ContentRect, inner: ContentRect) {
  return inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
}

/** Marquee in content coordinates. Window = left-to-right (full contain), crossing = right-to-left. */
export function elementIdsInMarquee(
  elements: readonly DiagramElement[],
  marqueeContent: ContentRect,
  windowSelection: boolean,
): string[] {
  const ids: string[] = [];
  for (const element of elements) {
    if (!element.visible || isVectorElement(element.kind)) continue;
    const bounds = elementContentRect(element, elements);
    const match = windowSelection ? rectContains(marqueeContent, bounds) : rectsIntersect(marqueeContent, bounds);
    if (match) ids.push(element.id);
  }
  return ids;
}
