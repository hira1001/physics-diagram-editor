import type { Constraint, DiagramElement, DiagramElementKind, Variable, VariableType } from "@/app/lib/editor-types";
import { catalogEntry, createDiagramElement } from "@/app/lib/component-catalog";

const connectionKinds = new Set<DiagramElementKind>(["string", "rope", "cable", "light-rod", "spring", "damper", "strut"]);
const vectorKinds = new Set<DiagramElementKind>(["force", "gravity", "normal-force", "friction-force", "tension", "spring-force", "drag-force", "buoyancy", "thrust", "velocity", "acceleration", "momentum"]);

export function isConnectionElement(kind: DiagramElementKind) {
  return connectionKinds.has(kind);
}

export function isVectorElement(kind: DiagramElementKind) {
  return vectorKinds.has(kind);
}

function boundaryDistance(element: DiagramElement, directionX: number, directionY: number) {
  const rotation = -element.rotation * Math.PI / 180;
  const localX = directionX * Math.cos(rotation) - directionY * Math.sin(rotation);
  const localY = directionX * Math.sin(rotation) + directionY * Math.cos(rotation);
  const halfWidth = element.kind === "point-mass" ? 7 : Math.max(4, element.width / 2);
  const halfHeight = element.kind === "point-mass" ? 7 : Math.max(4, element.height / 2);
  const tx = Math.abs(localX) > 1e-6 ? halfWidth / Math.abs(localX) : Number.POSITIVE_INFINITY;
  const ty = Math.abs(localY) > 1e-6 ? halfHeight / Math.abs(localY) : Number.POSITIVE_INFINITY;
  return Math.min(tx, ty);
}

export function resolveDiagramElement(element: DiagramElement, elements: readonly DiagramElement[]) {
  if (!isConnectionElement(element.kind) || !element.startTargetId || !element.endTargetId) return element;
  const start = elements.find((item) => item.id === element.startTargetId);
  const end = elements.find((item) => item.id === element.endTargetId);
  if (!start || !end || start.id === end.id) return element;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const centerDistance = Math.hypot(dx, dy);
  if (centerDistance < 1e-6) return element;
  const unitX = dx / centerDistance;
  const unitY = dy / centerDistance;
  const startInset = boundaryDistance(start, unitX, unitY);
  const endInset = boundaryDistance(end, -unitX, -unitY);
  const startX = start.x + unitX * startInset;
  const startY = start.y + unitY * startInset;
  const endX = end.x - unitX * endInset;
  const endY = end.y - unitY * endInset;
  return {
    ...element,
    height: element.height,
    rotation: Math.atan2(dy, dx) * 180 / Math.PI,
    width: Math.max(8, Math.hypot(endX - startX, endY - startY)),
    x: (startX + endX) / 2,
    y: (startY + endY) / 2,
  };
}

export function createConnection(kind: Extract<DiagramElementKind, "string" | "rope" | "cable" | "light-rod" | "spring" | "damper" | "strut">, start: DiagramElement, end: DiagramElement, id?: string) {
  const element = createDiagramElement(kind, (start.x + end.x) / 2, (start.y + end.y) / 2, id);
  element.startTargetId = start.id;
  element.endTargetId = end.id;
  return resolveDiagramElement(element, [start, end]);
}

export function variableTypeForElement(kind: DiagramElementKind): VariableType {
  if (vectorKinds.has(kind)) return "vector";
  if (kind === "angle-arc" || kind === "moment") return "angle";
  if (kind === "length-dimension" || kind === "radius-dimension" || connectionKinds.has(kind)) return "length";
  if (["point-mass", "block", "sphere", "disk", "wedge", "cart"].includes(kind)) return "mass";
  return "scalar";
}

export function createVariableForElement(element: DiagramElement, id = globalThis.crypto?.randomUUID?.() ?? `variable-${Date.now()}`): Variable {
  const type = variableTypeForElement(element.kind);
  const fallbackSymbol = catalogEntry(element.kind).defaultLabel || (type === "length" ? "L" : type === "vector" ? "F" : "q");
  return {
    id,
    referenceIds: [element.id],
    symbol: element.label || fallbackSymbol,
    type,
    unit: type === "mass" ? "kg" : type === "length" ? "m" : type === "angle" ? "°" : type === "vector" ? "N" : "",
    value: "",
  };
}

export function findElementDependencies(elementId: string, elements: readonly DiagramElement[], variables: readonly Variable[], constraints: readonly Constraint[]) {
  return {
    connections: elements.filter((item) => item.startTargetId === elementId || item.endTargetId === elementId),
    constraints: constraints.filter((item) => item.targetIds.includes(elementId)),
    variables: variables.filter((item) => item.referenceIds.includes(elementId)),
  };
}

export function validateModelReferences(elements: readonly DiagramElement[], variables: readonly Variable[], constraints: readonly Constraint[]) {
  const elementIds = new Set(elements.map((item) => item.id));
  const knownIds = new Set([...elementIds, "incline", "block", "axis", "angle"]);
  const errors: string[] = [];
  for (const element of elements) {
    if (element.startTargetId && !elementIds.has(element.startTargetId)) errors.push(`${element.id}:始点参照切れ`);
    if (element.endTargetId && !elementIds.has(element.endTargetId)) errors.push(`${element.id}:終点参照切れ`);
    if (element.startTargetId && element.startTargetId === element.endTargetId) errors.push(`${element.id}:自己接続`);
  }
  for (const variable of variables) {
    if (!variable.symbol.trim()) errors.push(`${variable.id}:記号なし`);
    for (const referenceId of variable.referenceIds) if (!knownIds.has(referenceId)) errors.push(`${variable.id}:参照切れ:${referenceId}`);
  }
  for (const constraint of constraints) {
    for (const targetId of constraint.targetIds) if (!knownIds.has(targetId)) errors.push(`${constraint.id}:参照切れ:${targetId}`);
  }
  return errors;
}
