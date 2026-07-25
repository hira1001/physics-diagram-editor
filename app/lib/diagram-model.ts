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

export function getElementActionPoint(element: DiagramElement, elements: readonly DiagramElement[]): { x: number; y: number } {
  if (element.referenceTargetId) {
    const rawTarget = elements.find((item) => item.id === element.referenceTargetId);
    const target = rawTarget && isConnectionElement(rawTarget.kind) ? resolveDiagramElement(rawTarget, elements) : rawTarget;
    if (target) {
      if (element.kind === "gravity") {
        return { x: target.x, y: target.y };
      }
      if (element.kind === "normal-force" || element.kind === "friction-force") {
        const surface = catalogSurfacePreset(target.kind);
        const slopeAngle = surface?.direction === "incline" ? -Math.round(Math.atan2(target.height, target.width) * 180 / Math.PI) : 0;
        const targetRot = target.rotation + slopeAngle;
        const targetRad = (targetRot * Math.PI) / 180;
        return {
          x: target.x - Math.sin(targetRad) * (target.height / 2),
          y: target.y + Math.cos(targetRad) * (target.height / 2),
        };
      }
      if (element.kind === "tension" || element.kind === "spring-force") {
        const vecRad = (element.rotation * Math.PI) / 180;
        const dirX = Math.cos(vecRad);
        const dirY = Math.sin(vecRad);
        const inset = boundaryDistance(target, dirX, dirY);
        return {
          x: target.x + dirX * inset,
          y: target.y + dirY * inset,
        };
      }
      return { x: target.x, y: target.y };
    }
  }
  if (isVectorElement(element.kind)) {
    const rad = (element.rotation * Math.PI) / 180;
    return {
      x: element.x - Math.cos(rad) * (element.width / 2),
      y: element.y - Math.sin(rad) * (element.width / 2),
    };
  }
  return { x: element.x, y: element.y };
}

export function getFaceMidpointByName(
  element: DiagramElement,
  faceName: "left" | "right" | "top" | "bottom"
): { x: number; y: number; normalAngle: number; faceName: "left" | "right" | "top" | "bottom" } {
  const rad = (element.rotation * Math.PI) / 180;
  const halfW = element.kind === "point-mass" ? 7 : element.width / 2;
  const halfH = element.kind === "point-mass" ? 7 : element.height / 2;

  if (faceName === "left") {
    return { x: element.x - Math.cos(rad) * halfW, y: element.y - Math.sin(rad) * halfW, normalAngle: element.rotation + 180, faceName: "left" };
  }
  if (faceName === "right") {
    return { x: element.x + Math.cos(rad) * halfW, y: element.y + Math.sin(rad) * halfW, normalAngle: element.rotation, faceName: "right" };
  }
  if (faceName === "top") {
    return { x: element.x + Math.sin(rad) * halfH, y: element.y - Math.cos(rad) * halfH, normalAngle: element.rotation - 90, faceName: "top" };
  }
  return { x: element.x - Math.sin(rad) * halfH, y: element.y + Math.cos(rad) * halfH, normalAngle: element.rotation + 90, faceName: "bottom" };
}

export function getOccupiedFaceNames(
  target: DiagramElement,
  elements: readonly DiagramElement[],
  currentConnId?: string
): Set<string> {
  const occupied = new Set<string>();
  const connections = elements.filter(
    (item) => isConnectionElement(item.kind) && item.id !== currentConnId && (item.startTargetId === target.id || item.endTargetId === target.id)
  );

  for (const conn of connections) {
    if (conn.startTargetId === target.id && conn.startFaceName) {
      occupied.add(conn.startFaceName);
    } else if (conn.endTargetId === target.id && conn.endFaceName) {
      occupied.add(conn.endFaceName);
    } else {
      const currentRad = (conn.rotation * Math.PI) / 180;
      const halfW = conn.width / 2;
      const attachPoint = conn.startTargetId === target.id
        ? { x: conn.x - Math.cos(currentRad) * halfW, y: conn.y - Math.sin(currentRad) * halfW }
        : { x: conn.x + Math.cos(currentRad) * halfW, y: conn.y + Math.sin(currentRad) * halfW };
      const matchedFace = getClosestFaceMidpoint(target, attachPoint);
      occupied.add(matchedFace.faceName);
    }
  }

  return occupied;
}

export function getClosestFaceMidpoint(
  element: DiagramElement,
  relativeToPoint: { x: number; y: number },
  occupiedFaceNames?: Set<string>
): { x: number; y: number; normalAngle: number; faceName: "left" | "right" | "top" | "bottom" } {
  const rad = element.rotation * Math.PI / 180;
  const halfW = element.kind === "point-mass" ? 7 : element.width / 2;
  const halfH = element.kind === "point-mass" ? 7 : element.height / 2;

  // 4 face midpoints in world coordinates
  const faces: Array<{ x: number; y: number; normalAngle: number; faceName: "left" | "right" | "top" | "bottom" }> = [
    {
      faceName: "left",
      x: element.x - Math.cos(rad) * halfW,
      y: element.y - Math.sin(rad) * halfW,
      normalAngle: element.rotation + 180,
    },
    {
      faceName: "right",
      x: element.x + Math.cos(rad) * halfW,
      y: element.y + Math.sin(rad) * halfW,
      normalAngle: element.rotation,
    },
    {
      faceName: "top",
      x: element.x + Math.sin(rad) * halfH,
      y: element.y - Math.cos(rad) * halfH,
      normalAngle: element.rotation - 90,
    },
    {
      faceName: "bottom",
      x: element.x - Math.sin(rad) * halfH,
      y: element.y + Math.cos(rad) * halfH,
      normalAngle: element.rotation + 90,
    },
  ];

  const available = occupiedFaceNames && occupiedFaceNames.size > 0 && occupiedFaceNames.size < 4
    ? faces.filter((f) => !occupiedFaceNames.has(f.faceName))
    : faces;

  let closest = available[0];
  let minDist = Math.hypot(available[0].x - relativeToPoint.x, available[0].y - relativeToPoint.y);

  for (let i = 1; i < available.length; i++) {
    const dist = Math.hypot(available[i].x - relativeToPoint.x, available[i].y - relativeToPoint.y);
    if (dist < minDist) {
      minDist = dist;
      closest = available[i];
    }
  }

  return closest;
}

export function resolveDiagramElement(element: DiagramElement, elements: readonly DiagramElement[]): DiagramElement {
  if (element.referenceTargetId) {
    const rawTarget = elements.find((item) => item.id === element.referenceTargetId);
    const target: DiagramElement | undefined = rawTarget && isConnectionElement(rawTarget.kind) ? resolveDiagramElement(rawTarget, elements) : rawTarget;
    if (target) {
      if (isVectorElement(element.kind)) {
        if (rotationalVectorKinds.has(element.kind)) return { ...element, x: target.x, y: target.y };
        const halfW = element.width / 2;
        const vecRad = (element.rotation * Math.PI) / 180;

        if (element.kind === "gravity") {
          return {
            ...element,
            x: target.x + Math.cos(vecRad) * halfW,
            y: target.y + Math.sin(vecRad) * halfW,
          };
        }

        if (element.kind === "normal-force" || element.kind === "friction-force") {
          const surface = catalogSurfacePreset(target.kind);
          const slopeAngle = surface?.direction === "incline" ? -Math.round(Math.atan2(target.height, target.width) * 180 / Math.PI) : 0;
          const targetRot = target.rotation + slopeAngle;
          const targetRad = (targetRot * Math.PI) / 180;
          const contactX = target.x - Math.sin(targetRad) * (target.height / 2);
          const contactY = target.y + Math.cos(targetRad) * (target.height / 2);

          return {
            ...element,
            x: contactX + Math.cos(vecRad) * halfW,
            y: contactY + Math.sin(vecRad) * halfW,
          };
        }

        if (element.kind === "tension" || element.kind === "spring-force") {
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
  if (!isConnectionElement(element.kind)) return element;
  const start = element.startTargetId ? elements.find((item) => item.id === element.startTargetId) : null;
  const end = element.endTargetId ? elements.find((item) => item.id === element.endTargetId) : null;
  if (!start && !end) return element;

  const currentRad = (element.rotation * Math.PI) / 180;
  const halfW = element.width / 2;

  let startX = element.x - Math.cos(currentRad) * halfW;
  let startY = element.y - Math.sin(currentRad) * halfW;
  let endX = element.x + Math.cos(currentRad) * halfW;
  let endY = element.y + Math.sin(currentRad) * halfW;
  let resolvedStartFace = element.startFaceName ?? null;
  let resolvedEndFace = element.endFaceName ?? null;

  if (start && end && start.id !== end.id) {
    const startOccupied = getOccupiedFaceNames(start, elements, element.id);
    const endOccupied = getOccupiedFaceNames(end, elements, element.id);
    const startFace = getClosestFaceMidpoint(start, { x: end.x, y: end.y }, startOccupied);
    const endFace = getClosestFaceMidpoint(end, { x: startFace.x, y: startFace.y }, endOccupied);
    startX = startFace.x;
    startY = startFace.y;
    endX = endFace.x;
    endY = endFace.y;

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return element;

    return {
      ...element,
      startFaceName: startFace.faceName,
      endFaceName: endFace.faceName,
      height: element.height,
      rotation: Math.atan2(dy, dx) * 180 / Math.PI,
      width: Math.max(8, dist),
      x: (startX + endX) / 2,
      y: (startY + endY) / 2,
    };
  } else if (start) {
    if (!resolvedStartFace) {
      const dirPoint = {
        x: start.x + Math.cos(currentRad) * (start.width / 2 + 10),
        y: start.y + Math.sin(currentRad) * (start.width / 2 + 10),
      };
      resolvedStartFace = getClosestFaceMidpoint(start, dirPoint, getOccupiedFaceNames(start, elements, element.id)).faceName;
    }
    const startFace = getFaceMidpointByName(start, resolvedStartFace);
    startX = startFace.x;
    startY = startFace.y;
    endX = startX + Math.cos(currentRad) * element.width;
    endY = startY + Math.sin(currentRad) * element.width;

    return {
      ...element,
      startFaceName: resolvedStartFace,
      x: (startX + endX) / 2,
      y: (startY + endY) / 2,
    };
  } else if (end) {
    if (!resolvedEndFace) {
      const dirPoint = {
        x: end.x - Math.cos(currentRad) * (end.width / 2 + 10),
        y: end.y - Math.sin(currentRad) * (end.width / 2 + 10),
      };
      resolvedEndFace = getClosestFaceMidpoint(end, dirPoint, getOccupiedFaceNames(end, elements, element.id)).faceName;
    }
    const endFace = getFaceMidpointByName(end, resolvedEndFace);
    endX = endFace.x;
    endY = endFace.y;
    startX = endX - Math.cos(currentRad) * element.width;
    startY = endY - Math.sin(currentRad) * element.width;

    return {
      ...element,
      endFaceName: resolvedEndFace,
      x: (startX + endX) / 2,
      y: (startY + endY) / 2,
    };
  }

  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return element;

  return {
    ...element,
    height: element.height,
    rotation: Math.atan2(dy, dx) * 180 / Math.PI,
    width: Math.max(8, dist),
    x: (startX + endX) / 2,
    y: (startY + endY) / 2,
  };
}

export function createReferencedElement(kind: DiagramElementKind, target: DiagramElement, id?: string) {
  const element = createDiagramElement(kind, target.x, target.y, id);
  element.referenceTargetId = target.id;
  const surface = catalogSurfacePreset(target.kind);
  const slopeAngle = surface?.direction === "incline" ? -Math.round(Math.atan2(target.height, target.width) * 180 / Math.PI) : 0;
  const targetRot = target.rotation + slopeAngle;
  if (kind === "normal-force") element.rotation = targetRot - 90;
  if (kind === "friction-force") element.rotation = targetRot;
  if (kind === "angle-arc" || kind === "local-axis") element.rotation = targetRot;
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
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const element = createDiagramElement(kind, (start.x + end.x) / 2, (start.y + end.y) / 2, id);
  element.startTargetId = start.id;
  element.endTargetId = end.id;
  element.width = Math.max(16, Math.hypot(dx, dy));
  element.rotation = Math.atan2(dy, dx) * 180 / Math.PI;
  return resolveDiagramElement(element, [start, end, element]);
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

export function decomposeVectorElement(
  element: DiagramElement,
  variables: readonly Variable[],
  elementsOrIdPrefix?: readonly DiagramElement[] | string,
  idPrefixArg?: string
) {
  if (!isVectorElement(element.kind)) return null;

  const elements = Array.isArray(elementsOrIdPrefix) ? elementsOrIdPrefix : [];
  const idPrefix = typeof elementsOrIdPrefix === "string"
    ? elementsOrIdPrefix
    : idPrefixArg ?? (globalThis.crypto?.randomUUID?.() ?? `components-${Date.now()}`);

  // Determine local reference frame angle (e.g. incline slope angle or local-axis)
  let frameAngle = 0;
  let hasLocalFrame = false;

  if (element.referenceTargetId) {
    const target = elements.find((el) => el.id === element.referenceTargetId);
    if (target) {
      const surface = catalogSurfacePreset(target.kind);
      if (surface?.direction === "incline") {
        const slopeAngle = -Math.round(Math.atan2(target.height, target.width) * 180 / Math.PI);
        frameAngle = target.rotation + slopeAngle;
        hasLocalFrame = true;
      } else if (target.rotation !== 0) {
        frameAngle = target.rotation;
        hasLocalFrame = true;
      }
    }
  }

  if (!hasLocalFrame) {
    const inclineEl = elements.find((el) => ["smooth-incline", "rough-incline", "wedge"].includes(el.kind));
    if (inclineEl) {
      const slopeAngle = inclineEl.rotation - Math.round(Math.atan2(inclineEl.height, inclineEl.width) * 180 / Math.PI);
      frameAngle = slopeAngle;
      hasLocalFrame = true;
    }
  }

  const vecRad = element.rotation * Math.PI / 180;
  const frameRad = frameAngle * Math.PI / 180;
  const relRad = vecRad - frameRad;

  const horizRot = Math.cos(relRad) >= 0 ? frameAngle : frameAngle + 180;
  const vertRot = Math.sin(relRad) >= 0 ? frameAngle + 90 : frameAngle - 90;

  const horizontal = createDiagramElement(element.kind, element.x, element.y, `${idPrefix}-x`);
  const vertical = createDiagramElement(element.kind, element.x, element.y, `${idPrefix}-y`);
  horizontal.fontSize = element.fontSize;
  horizontal.label = `${element.label || "F"}ₓ`;
  horizontal.lineWidth = element.lineWidth;
  horizontal.referenceTargetId = element.referenceTargetId;
  horizontal.rotation = horizRot;
  horizontal.width = Math.max(8, Math.abs(element.width * Math.cos(relRad)));
  vertical.fontSize = element.fontSize;
  vertical.label = `${element.label || "F"}ᵧ`;
  vertical.lineWidth = element.lineWidth;
  vertical.referenceTargetId = element.referenceTargetId;
  vertical.rotation = vertRot;
  vertical.width = Math.max(8, Math.abs(element.width * Math.sin(relRad)));

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
