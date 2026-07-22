import { describe, expect, it } from "vitest";
import { INITIAL_WORKSPACE } from "@/app/lib/editor-types";
import { normalizeScene, restoreWorkspace, serializeWorkspace } from "@/app/lib/workspace-storage";

describe("ARC-001/002/003 and REL-002/004/005 workspace persistence", () => {
  it("round-trips layout, pages, variables represented by the scene, and zoom", () => {
    const source = structuredClone(INITIAL_WORKSPACE);
    source.density = "compact";
    source.zoom = 140;
    source.leftPanelWidth = 300;
    source.rightPanelWidth = 360;
    source.pages[0].scene.angle = 47;
    source.pages[0].scene.massLabelOffsetX = 22;

    const restored = restoreWorkspace(serializeWorkspace(source));

    expect(restored.workspace).toEqual(source);
    expect(restored.recovered).toBe(false);
  });

  it("migrates the previous workspace shape without losing pages", () => {
    const legacy = {
      density: "compact",
      leftPanelVisible: false,
      rightPanelVisible: true,
      activePageId: "legacy-page",
      pages: [{ id: "legacy-page", title: "旧図", kind: "incline", scene: { angle: 35, massLabel: "M" } }],
    };

    const restored = restoreWorkspace(JSON.stringify(legacy));

    expect(restored.recovered).toBe(true);
    expect(restored.workspace.schemaVersion).toBe(2);
    expect(restored.workspace.pages[0].scene.angle).toBe(35);
    expect(restored.workspace.pages[0].scene.massLabel).toBe("M");
    expect(restored.workspace.zoom).toBe(100);
  });

  it("recovers from corrupt JSON with a safe editable document", () => {
    const restored = restoreWorkspace("{broken-json");

    expect(restored.recovered).toBe(true);
    expect(restored.message).toContain("復旧");
    expect(restored.workspace).toEqual(INITIAL_WORKSPACE);
  });

  it("normalizes non-finite and out-of-range numeric values", () => {
    const normalized = normalizeScene({
      angle: Number.NaN,
      blockPosition: 99,
      forceScale: Number.POSITIVE_INFINITY,
      annotationX: -10,
      annotationY: 50,
    });

    expect(normalized.angle).toBe(30);
    expect(normalized.blockPosition).toBe(0.88);
    expect(normalized.forceScale).toBe(1);
    expect(normalized.annotationX).toBe(0.04);
    expect(normalized.annotationY).toBe(0.96);
  });

  it("deduplicates page identifiers during recovery", () => {
    const duplicated = {
      ...INITIAL_WORKSPACE,
      pages: [INITIAL_WORKSPACE.pages[0], { ...INITIAL_WORKSPACE.pages[0] }],
    };

    const restored = restoreWorkspace(JSON.stringify(duplicated));
    expect(new Set(restored.workspace.pages.map((page) => page.id)).size).toBe(2);
  });

  it("round-trips real catalog elements and removes invalid or duplicate entries", () => {
    const normalized = normalizeScene({
      selectedId: "element:damper",
      elements: [
        { id: "damper", kind: "damper", label: "c", locked: false, rotation: 0, visible: true, width: 170, height: 46, x: 120, y: 180 },
        { id: "damper", kind: "spring", label: "k", locked: true, rotation: Number.NaN, visible: true, width: -20, height: 38, x: Number.POSITIVE_INFINITY, y: 220 },
        { id: "fake", kind: "not-a-component" },
      ],
    });

    expect(normalized.elements).toHaveLength(2);
    expect(new Set(normalized.elements.map((item) => item.id)).size).toBe(2);
    expect(normalized.elements[1]).toMatchObject({ kind: "spring", locked: true, rotation: 0, width: 8, x: 500 });
    expect(normalized.selectedId).toBe("element:damper");
  });
});
