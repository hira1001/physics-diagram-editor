import {
  INITIAL_SCENE,
  INITIAL_WORKSPACE,
  type DiagramPage,
  type SceneState,
  type WorkspaceState,
} from "@/app/lib/editor-types";
import { catalogEntry, isDiagramElementKind } from "@/app/lib/component-catalog";

export const WORKSPACE_STORAGE_KEY = "physics-editor-workspace-v1";

export interface WorkspaceRestoreResult {
  workspace: WorkspaceState;
  recovered: boolean;
  message?: string;
}

const numericSceneKeys: Array<keyof SceneState> = [
  "angle",
  "angleLabelOffsetX",
  "angleLabelOffsetY",
  "annotationX",
  "annotationY",
  "blockOffsetX",
  "blockOffsetY",
  "blockPosition",
  "diagramOffsetX",
  "diagramOffsetY",
  "forceScale",
  "massLabelOffsetX",
  "massLabelOffsetY",
  "surfaceFrictionCoefficient",
];

function finiteOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeScene(candidate: unknown): SceneState {
  const source = candidate && typeof candidate === "object" ? candidate as Partial<SceneState> : {};
  const scene: SceneState = { ...INITIAL_SCENE, ...source };
  for (const key of numericSceneKeys) {
    scene[key] = finiteOr(source[key], INITIAL_SCENE[key] as number) as never;
  }
  scene.angle = clamp(scene.angle, 5, 75);
  scene.blockPosition = clamp(scene.blockPosition, 0.12, 0.88);
  scene.forceScale = clamp(scene.forceScale, 0.5, 1.8);
  scene.annotationX = clamp(scene.annotationX, 0.04, 0.96);
  scene.annotationY = clamp(scene.annotationY, 0.04, 0.96);
  scene.surfaceFrictionCoefficient = clamp(scene.surfaceFrictionCoefficient, 0, 10);
  scene.surfaceKind = source.surfaceKind === "floor" || source.surfaceKind === "wall" || source.surfaceKind === "incline" ? source.surfaceKind : INITIAL_SCENE.surfaceKind;
  scene.surfaceRoughness = source.surfaceRoughness === "smooth" || source.surfaceRoughness === "rough" ? source.surfaceRoughness : INITIAL_SCENE.surfaceRoughness;
  scene.massLabel = typeof source.massLabel === "string" ? source.massLabel.slice(0, 40) : INITIAL_SCENE.massLabel;
  scene.annotationText = typeof source.annotationText === "string" ? source.annotationText.slice(0, 200) : INITIAL_SCENE.annotationText;
  const seenElementIds = new Set<string>();
  scene.elements = Array.isArray(source.elements) ? source.elements.flatMap((candidateElement, index) => {
    if (!candidateElement || typeof candidateElement !== "object") return [];
    const element = candidateElement as unknown as Record<string, unknown>;
    if (!isDiagramElementKind(element.kind)) return [];
    const definition = catalogEntry(element.kind);
    let id = typeof element.id === "string" && element.id.trim() ? element.id.slice(0, 120) : `restored-${index + 1}`;
    while (seenElementIds.has(id)) id = `${id}-${index + 1}`;
    seenElementIds.add(id);
    return [{
      endTargetId: typeof element.endTargetId === "string" ? element.endTargetId : null,
      fontSize: clamp(finiteOr(element.fontSize, element.kind === "text" ? 18 : 22), 6, 96),
      height: clamp(finiteOr(element.height, definition.defaultHeight), 8, 1000),
      id,
      kind: element.kind,
      label: typeof element.label === "string" ? element.label.slice(0, 80) : definition.defaultLabel,
      lineWidth: clamp(finiteOr(element.lineWidth, 2), 0.1, 12),
      locked: element.locked === true,
      rotation: clamp(finiteOr(element.rotation, 0), -3600, 3600),
      referenceTargetId: typeof element.referenceTargetId === "string" ? element.referenceTargetId : null,
      startTargetId: typeof element.startTargetId === "string" ? element.startTargetId : null,
      visible: element.visible !== false,
      width: clamp(finiteOr(element.width, definition.defaultWidth), 8, 1000),
      x: clamp(finiteOr(element.x, 500), -2000, 3000),
      y: clamp(finiteOr(element.y, 325), -2000, 3000),
    }];
  }) : [];
  const elementIds = new Set(scene.elements.map((item) => item.id));
  scene.elements = scene.elements.map((element) => ({
    ...element,
    endTargetId: element.endTargetId && elementIds.has(element.endTargetId) && element.endTargetId !== element.id ? element.endTargetId : null,
    referenceTargetId: element.referenceTargetId && elementIds.has(element.referenceTargetId) && element.referenceTargetId !== element.id ? element.referenceTargetId : null,
    startTargetId: element.startTargetId && elementIds.has(element.startTargetId) && element.startTargetId !== element.id ? element.startTargetId : null,
  }));
  const variableTypes = new Set(["scalar", "vector", "angle", "length", "mass", "coefficient", "time"]);
  const variableIds = new Set<string>();
  scene.variables = (Array.isArray(source.variables) ? source.variables : INITIAL_SCENE.variables).flatMap((candidateVariable, index) => {
    if (!candidateVariable || typeof candidateVariable !== "object") return [];
    const variable = candidateVariable as unknown as Record<string, unknown>;
    let id = typeof variable.id === "string" && variable.id.trim() ? variable.id.slice(0, 120) : `variable-${index + 1}`;
    while (variableIds.has(id)) id = `${id}-${index + 1}`;
    variableIds.add(id);
    return [{
      id,
      referenceIds: Array.isArray(variable.referenceIds) ? variable.referenceIds.filter((item): item is string => typeof item === "string").slice(0, 100) : [],
      symbol: typeof variable.symbol === "string" ? variable.symbol.slice(0, 40) : "",
      type: variableTypes.has(String(variable.type)) ? variable.type as SceneState["variables"][number]["type"] : "scalar",
      unit: typeof variable.unit === "string" ? variable.unit.slice(0, 40) : "",
      value: typeof variable.value === "string" ? variable.value.slice(0, 80) : "",
    }];
  });
  const constraintKinds = new Set(["contact", "connection", "parallel", "perpendicular", "equal-length", "equal-angle", "same-variable", "same-tension", "axis-follow"]);
  const constraintIds = new Set<string>();
  scene.constraints = (Array.isArray(source.constraints) ? source.constraints : INITIAL_SCENE.constraints).flatMap((candidateConstraint, index) => {
    if (!candidateConstraint || typeof candidateConstraint !== "object") return [];
    const constraint = candidateConstraint as unknown as Record<string, unknown>;
    if (!constraintKinds.has(String(constraint.kind))) return [];
    let id = typeof constraint.id === "string" && constraint.id.trim() ? constraint.id.slice(0, 120) : `constraint-${index + 1}`;
    while (constraintIds.has(id)) id = `${id}-${index + 1}`;
    constraintIds.add(id);
    return [{
      conflict: typeof constraint.conflict === "string" ? constraint.conflict.slice(0, 200) : null,
      enabled: constraint.enabled !== false,
      id,
      kind: constraint.kind as SceneState["constraints"][number]["kind"],
      strength: constraint.strength === "preferred" ? "preferred" as const : "required" as const,
      targetIds: Array.isArray(constraint.targetIds) ? constraint.targetIds.filter((item): item is string => typeof item === "string").slice(0, 100) : [],
    }];
  });
  if (typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:") && !scene.elements.some((item) => `element:${item.id}` === scene.selectedId)) {
    scene.selectedId = null;
  }
  return scene;
}

function normalizePages(candidate: unknown): DiagramPage[] {
  if (!Array.isArray(candidate) || candidate.length === 0) return INITIAL_WORKSPACE.pages.map((page) => ({ ...page, scene: { ...page.scene } }));
  const usedIds = new Set<string>();
  return candidate.map((entry, index) => {
    const source = entry && typeof entry === "object" ? entry as Partial<DiagramPage> : {};
    const proposedId = typeof source.id === "string" && source.id.trim() ? source.id : `page-${index + 1}`;
    let id = proposedId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${proposedId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    const kind = source.kind === "blank" || source.kind === "freebody" || source.kind === "incline" ? source.kind : "incline";
    return {
      id,
      title: typeof source.title === "string" && source.title.trim() ? source.title.slice(0, 80) : `図${index + 1}`,
      kind,
      scene: normalizeScene(source.scene),
    };
  });
}

export function restoreWorkspace(raw: string | null): WorkspaceRestoreResult {
  if (!raw) return { workspace: structuredClone(INITIAL_WORKSPACE), recovered: false };
  try {
    const source = JSON.parse(raw) as Partial<WorkspaceState>;
    const pages = normalizePages(source.pages);
    const activePageId = pages.some((page) => page.id === source.activePageId) ? source.activePageId as string : pages[0].id;
    return {
      workspace: {
        schemaVersion: 2,
        density: source.density === "compact" ? "compact" : "standard",
        leftPanelWidth: clamp(finiteOr(source.leftPanelWidth, INITIAL_WORKSPACE.leftPanelWidth), 220, 320),
        leftPanelVisible: typeof source.leftPanelVisible === "boolean" ? source.leftPanelVisible : true,
        rightPanelWidth: clamp(finiteOr(source.rightPanelWidth, INITIAL_WORKSPACE.rightPanelWidth), 260, 380),
        rightPanelVisible: typeof source.rightPanelVisible === "boolean" ? source.rightPanelVisible : true,
        zoom: clamp(finiteOr(source.zoom, INITIAL_WORKSPACE.zoom), 50, 180),
        activePageId,
        pages,
      },
      recovered: source.schemaVersion !== 2,
      message: source.schemaVersion !== 2 ? "保存データを最新版へ更新しました" : undefined,
    };
  } catch {
    return {
      workspace: structuredClone(INITIAL_WORKSPACE),
      recovered: true,
      message: "保存データを読み取れなかったため、安全な新規図で復旧しました",
    };
  }
}

export function serializeWorkspace(workspace: WorkspaceState) {
  return JSON.stringify({ ...workspace, schemaVersion: 2 });
}
