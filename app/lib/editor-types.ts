export type UiDensity = "standard" | "compact";
export type SurfaceKind = "floor" | "incline" | "wall";
export type SurfaceRoughness = "rough" | "smooth";

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

export type TemplateId = "horizontal" | "incline" | "pulley" | "rough-wall" | "smooth-incline" | "smooth-wall" | "spring" | "freebody";

export type ToolId =
  | "select"
  | "incline"
  | "surface-rough-floor"
  | "surface-rough-incline"
  | "surface-rough-wall"
  | "surface-smooth-floor"
  | "surface-smooth-incline"
  | "surface-smooth-wall"
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
  surfaceFrictionCoefficient: number;
  surfaceKind: SurfaceKind;
  surfaceRoughness: SurfaceRoughness;
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
  schemaVersion: 2;
  density: UiDensity;
  leftPanelWidth: number;
  leftPanelVisible: boolean;
  rightPanelWidth: number;
  rightPanelVisible: boolean;
  zoom: number;
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
  surfaceFrictionCoefficient: 0.3,
  surfaceKind: "incline",
  surfaceRoughness: "rough",
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
  schemaVersion: 2,
  density: "standard",
  leftPanelWidth: 244,
  leftPanelVisible: true,
  rightPanelWidth: 300,
  rightPanelVisible: true,
  zoom: 100,
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
