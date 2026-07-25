import { describe, expect, it } from "vitest";
import { INITIAL_SCENE } from "@/app/lib/editor-types";
import { createDiagramElement } from "@/app/lib/component-catalog";
import { attachAllForcesForElement } from "@/app/lib/scenario-actions";

describe("attachAllForcesForElement", () => {
  it("adds gravity and normal for a block on catalog scene", () => {
    const block = createDiagramElement("block", 200, 200, "body-1");
    const scene = { ...INITIAL_SCENE, elements: [block], variables: [] };
    const patch = attachAllForcesForElement(block, scene);
    expect(patch?.elements?.length).toBeGreaterThan(1);
    const kinds = patch!.elements!.map((el) => el.kind);
    expect(kinds).toContain("gravity");
  });
});
