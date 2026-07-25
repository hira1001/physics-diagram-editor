export type UiDensity = "standard" | "compact";
export type SurfaceKind = "floor" | "incline" | "wall";
export type SurfaceRoughness = "rough" | "smooth";

export type DiagramElementKind =
  | "point-mass" | "block" | "sphere" | "disk" | "cylinder" | "wedge" | "cart"
  | "smooth-floor" | "rough-floor" | "smooth-wall" | "rough-wall" | "smooth-incline" | "rough-incline"
  | "ceiling" | "step" | "corner" | "curved-surface"
  | "fixed-end" | "pin-support" | "hinge" | "roller-support" | "simple-support" | "strut"
  | "beam" | "h-beam" | "structural-column" | "truss-member"
  | "distributed-load" | "triangular-load" | "bending-moment" | "shear-diagram" | "moment-diagram" | "rigid-joint"
  | "string" | "rope" | "cable" | "light-rod" | "spring" | "damper"
  | "fixed-pulley" | "movable-pulley" | "compound-pulley" | "wheel-axle" | "rotation-axis" | "belt"
  | "straight-track" | "circular-track" | "curved-track" | "projectile-path"
  | "fluid-surface" | "container" | "fluid-region"
  | "force" | "gravity" | "normal-force" | "friction-force" | "tension" | "spring-force"
  | "drag-force" | "buoyancy" | "thrust" | "velocity" | "acceleration" | "momentum" | "moment"
  | "angular-velocity" | "angular-acceleration" | "rotation-direction"
  | "local-axis" | "angle-arc" | "length-dimension" | "radius-dimension" | "center-of-mass"
  | "point-label" | "construction-line" | "text";

export interface DiagramElement {
  endTargetId: string | null;
  groupId?: string;
  startTargetRatio?: number;
  endTargetRatio?: number;
  startEdgeIndex?: number;
  endEdgeIndex?: number;
  fontSize: number;
  id: string;
  kind: DiagramElementKind;
  label: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
  lineWidth: number;
  locked: boolean;
  rotation: number;
  referenceTargetId: string | null;
  startTargetId: string | null;
  shapeStyle?: "wedge" | "line";
  visible: boolean;
  startFaceName?: "left" | "right" | "top" | "bottom" | null;
  endFaceName?: "left" | "right" | "top" | "bottom" | null;
  width: number;
  height: number;
  x: number;
  y: number;
}

export type VariableType = "scalar" | "vector" | "angle" | "length" | "mass" | "coefficient" | "time";

export interface Variable {
  id: string;
  referenceIds: string[];
  symbol: string;
  type: VariableType;
  unit: string;
  value: string;
}

export type ConstraintKind = "contact" | "connection" | "parallel" | "perpendicular" | "equal-length" | "equal-angle" | "same-variable" | "same-tension" | "axis-follow";

export interface Constraint {
  conflict: string | null;
  enabled: boolean;
  id: string;
  kind: ConstraintKind;
  strength: "required" | "preferred";
  targetIds: string[];
}

export type SelectionId =
  | "incline"
  | "block"
  | "mass-label"
  | "force-gravity"
  | "force-gravity-label"
  | "force-normal"
  | "force-normal-label"
  | "force-friction"
  | "force-friction-label"
  | "angle"
  | "axis"
  | "spring"
  | "pulley"
  | "text"
  | `element:${string}`
  | `element-label:${string}`
  | null;

export type TemplateId = "horizontal" | "incline" | "pulley" | "rough-wall" | "smooth-incline" | "smooth-wall" | "spring" | "freebody" | "stacked" | "atwood" | "pendulum" | "simply-supported-beam" | "cantilever-beam" | "portal-frame";

export type LegacyToolId =
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

export type ToolId = LegacyToolId | `part:${DiagramElementKind}`;

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
  forceGravityLabelOffsetX?: number;
  forceGravityLabelOffsetY?: number;
  forceNormalLabelOffsetX?: number;
  forceNormalLabelOffsetY?: number;
  forceFrictionLabelOffsetX?: number;
  forceFrictionLabelOffsetY?: number;
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
  elements: DiagramElement[];
  variables: Variable[];
  constraints: Constraint[];
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
  selectedIds?: string[];
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
  elements: [],
  variables: [],
  constraints: [],
  showAngle: false,
  showAnnotation: false,
  showAxis: false,
  showGravity: false,
  showNormal: false,
  showFriction: false,
  showSpring: false,
  showPulley: false,
  grid: false,
  selectedId: null,
};

/** Blank workspace shell. Prefer `createDefaultWorkspace()` for app startup. */
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
      kind: "blank",
      scene: { ...INITIAL_SCENE },
    },
  ],
};
