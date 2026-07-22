import {
  INITIAL_SCENE,
  INITIAL_WORKSPACE,
  type DiagramPage,
  type SceneState,
  type WorkspaceState,
} from "@/app/lib/editor-types";

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
