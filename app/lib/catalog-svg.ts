import type { DiagramElement } from "@/app/lib/editor-types";
import { resolveDiagramElement } from "@/app/lib/diagram-model";

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

const vectorKinds = new Set(["force", "gravity", "normal-force", "friction-force", "tension", "spring-force", "drag-force", "buoyancy", "thrust", "velocity", "acceleration", "momentum"]);
const circularKinds = new Set(["sphere", "disk", "fixed-pulley", "movable-pulley", "wheel-axle", "rotation-axis", "circular-track"]);
const connectionKinds = new Set(["string", "rope", "cable", "light-rod", "straight-track", "construction-line", "strut"]);

function springPath(width: number) {
  const points = [`${-width / 2},0`];
  for (let index = 1; index < 12; index += 1) points.push(`${-width / 2 + width * index / 12},${index % 2 ? -12 : 12}`);
  points.push(`${width / 2},0`);
  return points.join(" ");
}

export function diagramElementToSvg(element: DiagramElement) {
  if (!element.visible) return "";
  const w = element.width;
  const h = element.height;
  const label = escapeXml(element.label);
  const common = `fill="none" stroke="#18202b" stroke-width="2"`;
  let body = "";

  if (vectorKinds.has(element.kind)) {
    body = `<line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" ${common} marker-end="url(#arrow)"/><text x="${w / 2 - 4}" y="-12" text-anchor="end" font-size="22" font-style="italic">${label}</text>`;
  } else if (circularKinds.has(element.kind)) {
    const radius = Math.min(w, h) / 2;
    body = `<circle cx="0" cy="0" r="${radius}" fill="white" stroke="#18202b" stroke-width="2"/>${element.kind === "disk" || element.kind === "wheel-axle" ? `<circle cx="0" cy="0" r="${radius * .38}" ${common}/>` : ""}<text x="0" y="7" text-anchor="middle" font-size="22" font-style="italic">${label}</text>`;
  } else if (connectionKinds.has(element.kind)) {
    const dash = element.kind === "cable" || element.kind === "construction-line" ? ` stroke-dasharray="8 5"` : "";
    const width = element.kind === "light-rod" || element.kind === "strut" ? 5 : element.kind === "rope" ? 3.5 : 2;
    body = `<line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" stroke="#18202b" stroke-width="${width}"${dash}/><text x="0" y="-13" text-anchor="middle" font-size="20" font-style="italic">${label}</text>`;
  } else {
    switch (element.kind) {
      case "point-mass": body = `<circle cx="0" cy="0" r="7" fill="#18202b"/><text x="18" y="-10" font-size="22" font-style="italic">${label}</text>`; break;
      case "block": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="white" stroke="#18202b" stroke-width="2"/><text x="0" y="7" text-anchor="middle" font-size="22" font-style="italic">${label}</text>`; break;
      case "wedge": body = `<path d="M${-w / 2},${h / 2} L${w / 2},${h / 2} L${w / 2},${-h / 2} Z" fill="white" stroke="#18202b" stroke-width="2"/><text x="${w * .18}" y="${h * .16}" text-anchor="middle" font-size="22" font-style="italic">${label}</text>`; break;
      case "cart": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h * .65}" fill="white" stroke="#18202b" stroke-width="2"/><circle cx="${-w * .3}" cy="${h * .3}" r="${h * .14}" fill="#18202b"/><circle cx="${w * .3}" cy="${h * .3}" r="${h * .14}" fill="#18202b"/><text x="0" y="${-h * .1}" text-anchor="middle" font-size="22" font-style="italic">${label}</text>`; break;
      case "spring": body = `<polyline points="${springPath(w)}" ${common}/><text x="0" y="-19" text-anchor="middle" font-size="20" font-style="italic">${label}</text>`; break;
      case "damper": body = `<line x1="${-w / 2}" y1="0" x2="${-w * .15}" y2="0" ${common}/><rect x="${-w * .15}" y="${-h * .28}" width="${w * .3}" height="${h * .56}" ${common}/><line x1="0" y1="${-h * .45}" x2="0" y2="${h * .45}" ${common}/><line x1="${w * .15}" y1="0" x2="${w / 2}" y2="0" ${common}/><text x="0" y="${-h * .6}" text-anchor="middle" font-size="20" font-style="italic">${label}</text>`; break;
      case "moment": body = `<path d="M${w * .3},${-h * .15} A${w * .35},${h * .35} 0 1 1 ${-w * .15},${-h * .3}" ${common} marker-end="url(#arrow)"/><text x="0" y="7" text-anchor="middle" font-size="22" font-style="italic">${label}</text>`; break;
      case "local-axis": body = `<line x1="0" y1="0" x2="${w * .4}" y2="0" ${common} marker-end="url(#arrow)"/><line x1="0" y1="0" x2="0" y2="${-h * .4}" ${common} marker-end="url(#arrow)"/><text x="${w * .43}" y="5" font-size="18">x</text><text x="-8" y="${-h * .43}" font-size="18">y</text>`; break;
      case "angle-arc": body = `<path d="M0,0 L${w / 2},0 M0,0 L${w * .35},${-h * .35} M${w * .3},0 A${w * .3},${h * .3} 0 0 0 ${w * .21},${-h * .21}" ${common}/><text x="${w * .3}" y="${-h * .12}" font-size="22" font-style="italic">${label}</text>`; break;
      case "length-dimension": body = `<path d="M${-w / 2},0 L${w / 2},0 M${-w / 2},-10 L${-w / 2},10 M${w / 2},-10 L${w / 2},10" ${common}/><text x="0" y="-14" text-anchor="middle" font-size="20" font-style="italic">${label}</text>`; break;
      case "radius-dimension": body = `<circle cx="0" cy="0" r="${Math.min(w, h) * .42}" ${common}/><line x1="0" y1="0" x2="${w * .42}" y2="0" ${common} marker-end="url(#arrow)"/><text x="${w * .2}" y="-10" font-size="20" font-style="italic">${label}</text>`; break;
      case "center-of-mass": body = `<circle cx="0" cy="0" r="${Math.min(w, h) * .35}" ${common}/><path d="M${-w * .25},0 L${w * .25},0 M0,${-h * .25} L0,${h * .25}" ${common}/><text x="${w * .5}" y="${-h * .3}" font-size="18">${label}</text>`; break;
      case "point-label": body = `<circle cx="0" cy="0" r="4" fill="#18202b"/><text x="14" y="-10" font-size="18">${label}</text>`; break;
      case "text": body = `<text x="0" y="0" text-anchor="middle" font-size="18">${label}</text>`; break;
      case "fluid-region": body = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#3178d4" fill-opacity=".12" stroke="#18202b" stroke-width="2"/><text x="0" y="7" text-anchor="middle" font-size="22" font-style="italic">${label}</text>`; break;
      case "container": body = `<path d="M${-w / 2},${-h / 2} L${-w / 2},${h / 2} L${w / 2},${h / 2} L${w / 2},${-h / 2}" ${common}/>`; break;
      case "fluid-surface": body = `<path d="M${-w / 2},0 q10,-8 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0" ${common}/>`; break;
      case "curved-surface": case "curved-track": case "projectile-path": body = `<path d="M${-w / 2},${h * .3} Q0,${-h / 2} ${w / 2},${h * .3}" ${common}${element.kind === "projectile-path" ? ` stroke-dasharray="8 5"` : ""}/>`; break;
      case "ceiling": body = `<path d="M${-w / 2},0 L${w / 2},0" ${common}/>`; break;
      case "step": body = `<path d="M${-w / 2},${h / 2} L0,${h / 2} L0,0 L${w / 2},0 L${w / 2},${-h / 2}" ${common}/>`; break;
      case "corner": body = `<path d="M${-w / 2},${h / 2} L${w / 2},${h / 2} L${w / 2},${-h / 2}" ${common}/>`; break;
      case "compound-pulley": case "belt": body = `<circle cx="${-w * .25}" cy="0" r="${h * .25}" ${common}/><circle cx="${w * .25}" cy="0" r="${h * .25}" ${common}/><path d="M${-w * .25},${-h * .25} L${w * .25},${-h * .25} M${-w * .25},${h * .25} L${w * .25},${h * .25}" ${common}/>`; break;
      default: body = `<path d="M${-w / 2},${h / 2} L0,${-h / 2} L${w / 2},${h / 2} Z" ${common}/><text x="0" y="${h * .3}" text-anchor="middle" font-size="18" font-style="italic">${label}</text>`;
    }
  }

  return `<g data-layer="catalog-component" data-component-id="${escapeXml(element.id)}" data-component-kind="${element.kind}" transform="translate(${element.x} ${element.y}) rotate(${element.rotation})">${body}</g>`;
}

export function diagramElementsToSvg(elements: readonly DiagramElement[]) {
  return elements.map((element) => diagramElementToSvg(resolveDiagramElement(element, elements))).join("");
}
