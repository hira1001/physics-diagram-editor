export type UiDensity = "standard" | "compact";

export type SelectionId =
  | "incline"
  | "block"
  | "force-gravity"
  | "force-normal"
  | "force-friction"
  | "angle"
  | "axis"
  | "spring"
  | "pulley"
  | null;

export type ToolId =
  | "select"
  | "incline"
  | "block"
  | "force"
  | "angle"
  | "axis"
  | "spring"
  | "pulley"
  | "text";

export interface SceneState {
  angle: number;
  blockPosition: number;
  forceScale: number;
  massLabel: string;
  showAngle: boolean;
  showAxis: boolean;
  showGravity: boolean;
  showNormal: boolean;
  showFriction: boolean;
  showSpring: boolean;
  showPulley: boolean;
  grid: boolean;
  selectedId: SelectionId;
}

export type PageKind = "incline" | "freebody" | "blank";

export interface DiagramPage {
  id: string;
  title: string;
  kind: PageKind;
  scene: SceneState;
}

export interface WorkspaceState {
  density: UiDensity;
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  activePageId: string;
  pages: DiagramPage[];
}

export const INITIAL_SCENE: SceneState = {
  angle: 30,
  blockPosition: 0.56,
  forceScale: 1,
  massLabel: "m",
  showAngle: true,
  showAxis: true,
  showGravity: true,
  showNormal: true,
  showFriction: true,
  showSpring: false,
  showPulley: false,
  grid: false,
  selectedId: "incline",
};

export const INITIAL_WORKSPACE: WorkspaceState = {
  density: "standard",
  leftPanelVisible: true,
  rightPanelVisible: true,
  activePageId: "page-1",
  pages: [
    {
      id: "page-1",
      title: "図1",
      kind: "incline",
      scene: { ...INITIAL_SCENE },
    },
    {
      id: "page-fbd",
      title: "自由体図",
      kind: "freebody",
      scene: { ...INITIAL_SCENE, selectedId: "block" },
    },
  ],
};

