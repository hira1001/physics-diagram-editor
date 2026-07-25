import type { SceneState, SurfaceKind, SurfaceRoughness, ToolId } from "@/app/lib/editor-types";

export interface SurfacePreset {
  kind: SurfaceKind;
  roughness: SurfaceRoughness;
}

const surfaceToolPresets: Partial<Record<ToolId, SurfacePreset>> = {
  incline: { kind: "incline", roughness: "rough" },
  "surface-rough-floor": { kind: "floor", roughness: "rough" },
  "surface-rough-incline": { kind: "incline", roughness: "rough" },
  "surface-rough-wall": { kind: "wall", roughness: "rough" },
  "surface-smooth-floor": { kind: "floor", roughness: "smooth" },
  "surface-smooth-incline": { kind: "incline", roughness: "smooth" },
  "surface-smooth-wall": { kind: "wall", roughness: "smooth" },
};

export function surfacePresetForTool(tool: ToolId) {
  return surfaceToolPresets[tool] ?? null;
}

export function effectiveSurfaceAngle(scene: Pick<SceneState, "angle" | "surfaceKind">) {
  if (scene.surfaceKind === "floor") return 0;
  if (scene.surfaceKind === "wall") return 90;
  return scene.angle;
}

export function blockRotationDegrees(scene: Pick<SceneState, "angle" | "flipped" | "surfaceKind">) {
  if (scene.surfaceKind !== "incline") return 0;
  return (scene.flipped ? 1 : -1) * scene.angle;
}

export function massLabelBaseX(scene: Pick<SceneState, "flipped" | "surfaceKind">) {
  if (scene.surfaceKind !== "wall") return -25;
  return scene.flipped ? -25 : 25;
}

export function surfaceContactClearance(kind: SurfaceKind) {
  return kind === "wall" ? 82 : 58;
}

export function surfaceDisplayName(kind: SurfaceKind, roughness: SurfaceRoughness) {
  const kindName = kind === "floor" ? "床" : kind === "wall" ? "壁" : "斜面";
  return `${roughness === "rough" ? "粗い" : "滑らかな"}${kindName}`;
}

export function contactSuggestions(kind: SurfaceKind, roughness: SurfaceRoughness) {
  const normalDirection = kind === "wall" ? "水平" : kind === "floor" ? "鉛直上向き" : "面の法線方向";
  const suggestions = [
    { id: "gravity", symbol: "mg", relation: "鉛直下向き" },
    { id: "normal", symbol: "N", relation: normalDirection },
  ];
  if (roughness === "rough") {
    suggestions.push({ id: "friction", symbol: "f", relation: "面に平行" });
    suggestions.push({ id: "coefficient", symbol: "μ", relation: "摩擦係数" });
  }
  return suggestions;
}

export function hasSurfaceConflict(scene: Pick<SceneState, "showFriction" | "surfaceRoughness">) {
  return scene.surfaceRoughness === "smooth" && scene.showFriction;
}

export function surfacePlacementPatch(preset: SurfacePreset): Partial<SceneState> {
  return {
    contactConstraint: true,
    selectedId: "incline",
    showAngle: preset.kind === "incline",
    showFriction: false,
    showGravity: true,
    showNormal: false,
    surfaceKind: preset.kind,
    surfaceRoughness: preset.roughness,
  };
}
