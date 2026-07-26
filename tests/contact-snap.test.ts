import { describe, expect, it } from "vitest";
import { contactEdgeForElement, createGeometry, findGroundingSurfaceSnap } from "@/app/components/EditorCanvas";
import { createDiagramElement } from "@/app/lib/component-catalog";
import { INITIAL_SCENE, type DiagramElement, type SceneState } from "@/app/lib/editor-types";

function sceneWith(...elements: DiagramElement[]): SceneState {
  return {
    ...INITIAL_SCENE,
    // Keep the legacy background surface away from these self-contained
    // catalog-surface checks.
    surfaceKind: "floor",
    elements,
  };
}

function snap(body: DiagramElement, surface: DiagramElement) {
  const scene = sceneWith(surface, body);
  return findGroundingSurfaceSnap(body, body.x, body.y, scene, createGeometry(1_000, 650, scene, 100));
}

describe("PHY-021 / CTX-013 catalog contact adsorption", () => {
  it("uses the visible line of a floor and places the body exactly above it", () => {
    const floor = createDiagramElement("rough-floor", 500, 420, "floor");
    const body = createDiagramElement("block", 500, 370, "body");

    expect(snap(body, floor)).toMatchObject({
      segment: { name: "粗い床" },
      snappedX: 500,
      snappedY: 382,
      angle: 0,
    });
  });

  it("uses the approached side of a wall instead of forcing a fixed side", () => {
    const wall = createDiagramElement("smooth-wall", 500, 360, "wall");
    const body = createDiagramElement("block", 452, 360, "body");

    expect(snap(body, wall)).toMatchObject({
      segment: { name: "滑らかな壁" },
      snappedX: 440,
      snappedY: 360,
      angle: -90,
    });
  });

  it("derives an incline contact edge from the same diagonal that is rendered", () => {
    const incline = createDiagramElement("rough-incline", 500, 380, "incline");
    const body = createDiagramElement("block", 470, 337, "body");
    const edge = contactEdgeForElement(incline);
    const result = snap(body, incline);

    expect(edge?.angle).toBeCloseTo(-30.018, 2);
    expect(result?.segment.name).toBe("粗い斜面");
    expect(result?.angle).toBeCloseTo(edge?.angle ?? 0, 6);
    expect(result?.snappedX).toBeCloseTo(464.6575, 3);
    expect(result?.snappedY).toBeCloseTo(327.7534, 3);
  });

});
