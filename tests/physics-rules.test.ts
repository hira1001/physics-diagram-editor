import { describe, expect, it } from "vitest";
import { INITIAL_SCENE } from "@/app/lib/editor-types";
import {
  blockRotationDegrees,
  contactSuggestions,
  effectiveSurfaceAngle,
  hasSurfaceConflict,
  massLabelBaseX,
  surfaceContactClearance,
  surfacePlacementPatch,
  surfacePresetForTool,
} from "@/app/lib/physics-rules";

describe("PHY-040..046 contact surface semantics", () => {
  it.each([
    ["surface-smooth-wall", "wall", "smooth"],
    ["surface-rough-wall", "wall", "rough"],
    ["surface-smooth-floor", "floor", "smooth"],
    ["surface-rough-floor", "floor", "rough"],
    ["surface-smooth-incline", "incline", "smooth"],
    ["surface-rough-incline", "incline", "rough"],
  ] as const)("maps %s to a physical surface preset", (tool, kind, roughness) => {
    expect(surfacePresetForTool(tool)).toEqual({ kind, roughness });
  });

  it("offers no default friction or coefficient for a smooth wall", () => {
    const symbols = contactSuggestions("wall", "smooth").map((item) => item.symbol);
    expect(symbols).toEqual(["mg", "N"]);
  });

  it("offers friction for a rough wall without auto-generating mu", () => {
    const suggestions = contactSuggestions("wall", "rough");
    expect(suggestions.map((item) => item.symbol)).toEqual(["mg", "N", "f"]);
    expect(suggestions.find((item) => item.symbol === "f")?.relation).toBe("面に平行");
  });

  it("uses fixed physical orientations for floors and walls", () => {
    expect(effectiveSurfaceAngle({ angle: 37, surfaceKind: "floor" })).toBe(0);
    expect(effectiveSurfaceAngle({ angle: 37, surfaceKind: "wall" })).toBe(90);
    expect(effectiveSurfaceAngle({ angle: 37, surfaceKind: "incline" })).toBe(37);
  });

  it("keeps wall and floor objects upright while incline objects follow the slope", () => {
    expect(blockRotationDegrees({ angle: 30, flipped: false, surfaceKind: "wall" })).toBe(0);
    expect(blockRotationDegrees({ angle: 30, flipped: true, surfaceKind: "floor" })).toBe(0);
    expect(blockRotationDegrees({ angle: 30, flipped: false, surfaceKind: "incline" })).toBe(-30);
    expect(blockRotationDegrees({ angle: 30, flipped: true, surfaceKind: "incline" })).toBe(30);
  });

  it("reserves wall contact width and moves m away from force shafts", () => {
    expect(surfaceContactClearance("wall")).toBe(58);
    expect(massLabelBaseX({ flipped: false, surfaceKind: "wall" })).toBe(25);
    expect(massLabelBaseX({ flipped: true, surfaceKind: "wall" })).toBe(-25);
  });

  it("places smooth and rough surfaces without friction by default", () => {
    expect(surfacePlacementPatch({ kind: "wall", roughness: "smooth" }).showFriction).toBe(false);
    expect(surfacePlacementPatch({ kind: "wall", roughness: "rough" }).showFriction).toBe(false);
  });

  it("reports, but does not delete, friction left on a smooth surface", () => {
    const scene = { ...INITIAL_SCENE, surfaceRoughness: "smooth" as const, showFriction: true };
    expect(hasSurfaceConflict(scene)).toBe(true);
    expect(scene.showFriction).toBe(true);
  });
});
