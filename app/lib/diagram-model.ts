import type { Constraint, DiagramElement, DiagramElementKind, Variable, VariableType } from "@/app/lib/editor-types";
import { catalogEntry, catalogSurfacePreset, createDiagramElement } from "@/app/lib/component-catalog";

const connectionKinds = new Set<DiagramElementKind>(["string", "rope", "cable", "light-rod", "spring", "damper", "strut"]);
const rotationalVectorKinds = new Set<DiagramElementKind>(["moment", "angular-velocity", "angular-acceleration", "rotation-direction"]);
const vectorKinds = new Set<DiagramElementKind>(["force", "gravity", "normal-force", "friction-force", "tension", "spring-force", "drag-force", "buoyancy", "thrust", "velocity", "acceleration", "momentum", ...rotationalVectorKinds]);

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

export function resolveDiagramElement(element: DiagramElement, elements: readonly DiagramElement[]): DiagramElement {
  if (element.referenceTargetId) {
    const rawTarget = elements.find((item) => item.id === element.referenceTargetId);
    const target: DiagramElement | undefined = rawTarget && isConnectionElement(rawTarget.kind) ? resolveDiagramElement(rawTarget, elements) : rawTarget;
    if (target) {
      if (isVectorElement(element.kind)) {
        if (rotationalVectorKinds.has(element.kind)) return { ...element, x: target.x, y: target.y };
        const halfW = element.width / 2;

        if (element.kind === "gravity") {
          return {
            ...element,
            rotation: 90,
            x: target.x,
            y: target.y + halfW,
          };
        }

        if (element.kind === "normal-force" || element.kind === "friction-force") {
          const surface = catalogSurfacePreset(target.kind);
          const slopeAngle = surface?.direction === "incline" ? -Math.round(Math.atan2(target.height, target.width) * 180 / Math.PI) : 0;
          const targetRot = target.rotation + slopeAngle;
          const targetRad = (targetRot * Math.PI) / 180;
          const contactX = target.x + Math.sin(targetRad) * (target.height / 2);
          const contactY = target.y + Math.cos(targetRad) * (target.height / 2);

          const vecRot = element.kind === "normal-force" ? targetRot - 90 : targetRot;
          const vecRad = (vecRot * Math.PI) / 180;

          return {
            ...element,
            rotation: vecRot,
            x: contactX + Math.cos(vecRad) * halfW,
            y: contactY + Math.sin(vecRad) * halfW,
          };
        }

        if (element.kind === "tension" || element.kind === "spring-force") {
          const vecRad = (element.rotation * Math.PI) / 180;
          const dirX = Math.cos(vecRad);
          const dirY = Math.sin(vecRad);
          const inset = boundaryDistance(target, dirX, dirY);
          const attachX = target.x + dirX * inset;
          const attachY = target.y + dirY * inset;

          return {
            ...element,
            x: attachX + dirX * halfW,
            y: attachY + dirY * halfW,
          };
        }

        const vecRad = (element.rotation * Math.PI) / 180;
        return {
          ...element,
          x: target.x + Math.cos(vecRad) * halfW,
          y: target.y + Math.sin(vecRad) * halfW,
        };
      }
      if (element.kind === "length-dimension") return { ...element, x: target.x, y: target.y, width: target.width, rotation: target.rotation };
      if (element.kind === "radius-dimension") return { ...element, x: target.x, y: target.y, width: target.width, height: target.height, rotation: target.rotation };
      if (["local-axis", "center-of-mass", "point-label", "text"].includes(element.kind)) return { ...element, x: target.x, y: target.y, rotation: target.rotation };
    }
  }
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

export function createReferencedElement(kind: DiagramElementKind, target: DiagramElement, id?: string) {
  const element = createDiagramElement(kind, target.x, target.y, id);
  element.referenceTargetId = target.id;
  const surface = catalogSurfacePreset(target.kind);
  const slopeAngle = surface?.direction === "incline" ? -Math.round(Math.atan2(target.height, target.width) * 180 / Math.PI) : 0;
  if (surface && kind === "normal-force") element.rotation = target.rotation + slopeAngle - 90;
  if (surface && kind === "friction-force") element.rotation = target.rotation + slopeAngle;
  if (surface && (kind === "angle-arc" || kind === "local-axis")) element.rotation = target.rotation + slopeAngle;
  return resolveDiagramElement(element, [target, element]);
}

const bodyKinds = new Set<DiagramElementKind>(["point-mass", "block", "sphere", "disk", "cylinder", "wedge", "cart"]);

export function contextCandidatesForElement(element: DiagramElement): DiagramElementKind[] {
  if (bodyKinds.has(element.kind)) {
    const rotationalBody = ["sphere", "disk", "cylinder"].includes(element.kind);
    return [
      "gravity", "normal-force", "friction-force", "tension", "force", "velocity", "acceleration",
      ...(["sphere", "disk", "cylinder", "wedge", "cart"].includes(element.kind) ? ["moment" as const] : []),
      ...(rotationalBody ? ["angular-velocity" as const, "angular-acceleration" as const, "rotation-direction" as const, "radius-dimension" as const] : []),
    ];
  }
  const surface = catalogSurfacePreset(element.kind);
  if (surface) {
    return [
      "normal-force",
      ...(surface.roughness === "rough" ? ["friction-force" as const] : []),
      ...(surface.direction === "incline" ? ["angle-arc" as const, "local-axis" as const] : []),
    ];
  }
  if (["string", "rope", "cable"].includes(element.kind)) return ["tension", "length-dimension"];
  if (element.kind === "spring") return ["spring-force", "length-dimension"];
  if (element.kind === "damper") return ["force", "length-dimension"];
  if (["straight-track", "circular-track", "curved-track", "projectile-path"].includes(element.kind)) return ["velocity", "acceleration", "local-axis"];
  if (["wheel-axle", "rotation-axis"].includes(element.kind)) return ["moment", "angular-velocity", "angular-acceleration", "rotation-direction", "radius-dimension"];
  return [];
}

export function createConnection(kind: Extract<DiagramElementKind, "string" | "rope" | "cable" | "light-rod" | "spring" | "damper" | "strut">, start: DiagramElement, end: DiagramElement, id?: string) {
  const element = createDiagramElement(kind, (start.x + end.x) / 2, (start.y + end.y) / 2, id);
  element.startTargetId = start.id;
  element.endTargetId = end.id;
  return resolveDiagramElement(element, [start, end]);
}

export function variableTypeForElement(kind: DiagramElementKind): VariableType {
  if (vectorKinds.has(kind)) return "vector";
  if (kind === "angle-arc") return "angle";
  if (kind === "spring" || kind === "damper") return "coefficient";
  if (["string", "rope", "cable", "light-rod", "strut"].includes(kind)) return "vector";
  if (kind === "length-dimension" || kind === "radius-dimension") return "length";
  if (["point-mass", "block", "sphere", "disk", "cylinder", "wedge", "cart"].includes(kind)) return "mass";
  return "scalar";
}

export function createVariableForElement(element: DiagramElement, id = globalThis.crypto?.randomUUID?.() ?? `variable-${Date.now()}`): Variable {
  const type = variableTypeForElement(element.kind);
  const specialized = element.kind === "spring"
    ? { symbol: "k", unit: "N/m" }
    : element.kind === "damper"
      ? { symbol: "c", unit: "N·s/m" }
      : element.kind === "moment"
        ? { symbol: element.label || "M", unit: "N·m" }
      : element.kind === "angular-velocity"
        ? { symbol: element.label || "ω", unit: "rad/s" }
      : element.kind === "angular-acceleration"
        ? { symbol: element.label || "α", unit: "rad/s²" }
      : element.kind === "rotation-direction"
        ? { symbol: element.label || "回転", unit: "" }
      : ["string", "rope", "cable"].includes(element.kind)
        ? { symbol: "T", unit: "N" }
        : ["light-rod", "strut"].includes(element.kind)
          ? { symbol: element.label || "S", unit: "N" }
          : null;
  const fallbackSymbol = catalogEntry(element.kind).defaultLabel || (type === "length" ? "L" : type === "vector" ? "F" : "q");
  return {
    id,
    referenceIds: [element.id],
    symbol: specialized?.symbol ?? (element.label || fallbackSymbol),
    type,
    unit: specialized?.unit ?? (type === "mass" ? "kg" : type === "length" ? "m" : type === "angle" ? "°" : type === "vector" ? "N" : ""),
    value: "",
  };
}

export function decomposeVectorElement(element: DiagramElement, variables: readonly Variable[], idPrefix = globalThis.crypto?.randomUUID?.() ?? `components-${Date.now()}`) {
  if (!isVectorElement(element.kind)) return null;
  const radians = element.rotation * Math.PI / 180;
  const horizontal = createDiagramElement(element.kind, element.x, element.y, `${idPrefix}-x`);
  const vertical = createDiagramElement(element.kind, element.x, element.y, `${idPrefix}-y`);
  horizontal.fontSize = element.fontSize;
  horizontal.label = `${element.label || "F"}ₓ`;
  horizontal.lineWidth = element.lineWidth;
  horizontal.referenceTargetId = element.referenceTargetId;
  horizontal.rotation = Math.cos(radians) >= 0 ? 0 : 180;
  horizontal.width = Math.max(8, Math.abs(element.width * Math.cos(radians)));
  vertical.fontSize = element.fontSize;
  vertical.label = `${element.label || "F"}ᵧ`;
  vertical.lineWidth = element.lineWidth;
  vertical.referenceTargetId = element.referenceTargetId;
  vertical.rotation = Math.sin(radians) >= 0 ? 90 : -90;
  vertical.width = Math.max(8, Math.abs(element.width * Math.sin(radians)));

  const existingVariable = variables.find((variable) => variable.referenceIds.includes(element.id));
  const nextVariables = existingVariable
    ? variables.map((variable) => variable.id === existingVariable.id
      ? { ...variable, referenceIds: [...new Set([...variable.referenceIds, horizontal.id, vertical.id])] }
      : variable)
    : [...variables, { ...createVariableForElement(element, `${idPrefix}-variable`), referenceIds: [element.id, horizontal.id, vertical.id] }];
  return {
    components: [horizontal, vertical] as const,
    constraint: {
      conflict: null,
      enabled: true,
      id: `${idPrefix}-same-variable`,
      kind: "same-variable" as const,
      strength: "required" as const,
      targetIds: [element.id, horizontal.id, vertical.id],
    },
    variables: nextVariables,
  };
}

export function findElementDependencies(elementId: string, elements: readonly DiagramElement[], variables: readonly Variable[], constraints: readonly Constraint[]) {
  return {
    connections: elements.filter((item) => item.startTargetId === elementId || item.endTargetId === elementId || item.referenceTargetId === elementId),
    constraints: constraints.filter((item) => item.targetIds.includes(elementId)),
    variables: variables.filter((item) => item.referenceIds.includes(elementId)),
  };
}

export function removeElementWithDependencies(elementId: string, elements: readonly DiagramElement[], variables: readonly Variable[], constraints: readonly Constraint[]) {
  const removedIds = new Set([elementId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const element of elements) {
      if (removedIds.has(element.id)) continue;
      if ([element.startTargetId, element.endTargetId, element.referenceTargetId].some((targetId) => targetId && removedIds.has(targetId))) {
        removedIds.add(element.id);
        changed = true;
      }
    }
  }
  return {
    constraints: constraints.filter((constraint) => !constraint.targetIds.some((targetId) => removedIds.has(targetId))),
    elements: elements.filter((element) => !removedIds.has(element.id)),
    removedIds,
    variables: variables.filter((variable) => !variable.referenceIds.some((referenceId) => removedIds.has(referenceId))),
  };
}

export function validateModelReferences(elements: readonly DiagramElement[], variables: readonly Variable[], constraints: readonly Constraint[]) {
  const elementIds = new Set(elements.map((item) => item.id));
  const knownIds = new Set([...elementIds, "incline", "block", "axis", "angle"]);
  const errors: string[] = [];
  for (const element of elements) {
    if (element.startTargetId && !elementIds.has(element.startTargetId)) errors.push(`${element.id}:始点参照切れ`);
    if (element.endTargetId && !elementIds.has(element.endTargetId)) errors.push(`${element.id}:終点参照切れ`);
    if (element.referenceTargetId && !elementIds.has(element.referenceTargetId)) errors.push(`${element.id}:対象参照切れ`);
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
