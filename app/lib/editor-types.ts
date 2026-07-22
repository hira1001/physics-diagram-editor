export type UiDensity = "standard" | "compact";

export type SelectionId =
  | "incline"
  | "block"
  | "mass-label"
  | "force-gravity"
  | "force-normal"
  | "force-friction"
  | "angle"
  | "axis"
  | "spring"
  | "pulley"
  | "text"
  | null;

export type TemplateId = "incline" | "pulley" | "spring" | "freebody";

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
  angleLabelOffsetX: number;
  angleLabelOffsetY: number;
  blockPosition: number;
  blockOffsetX: number;
  blockOffsetY: number;
  contactConstraint: boolean;
  customVariableSymbol: string;
  customVariableUnit: string;
  customVariableValue: string;
  diagramOffsetX: number;
  diagramOffsetY: number;
  forceScale: number;
  flipped: boolean;
  massLabel: string;
  massLabelOffsetX: number;
  massLabelOffsetY: number;
  snapEnabled: boolean;
  annotationText: string;
  annotationX: number;
  annotationY: number;
  showAngle: boolean;
  showAnnotation: boolean;
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
  angleLabelOffsetX: 0,
  angleLabelOffsetY: 0,
  blockPosition: 0.56,
  blockOffsetX: 0,
  blockOffsetY: 0,
  contactConstraint: true,
  customVariableSymbol: "",
  customVariableUnit: "",
  customVariableValue: "",
  diagramOffsetX: 0,
  diagramOffsetY: 0,
  forceScale: 1,
  flipped: false,
  massLabel: "m",
  massLabelOffsetX: 0,
  massLabelOffsetY: 0,
  snapEnabled: true,
  annotationText: "注記",
  annotationX: 0.5,
  annotationY: 0.2,
  showAngle: true,
  showAnnotation: false,
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
