import { describe, expect, it } from "vitest";
import { createDiagramElement } from "@/app/lib/component-catalog";
import { elementIdsInMarquee } from "@/app/lib/canvas-selection";

describe("canvas marquee selection", () => {
  it("selects fully contained elements in window mode", () => {
    const a = createDiagramElement("block", 100, 100, "a");
    const b = createDiagramElement("block", 300, 100, "b");
    const ids = elementIdsInMarquee([a, b], { left: 20, right: 200, top: 40, bottom: 200 }, true);
    expect(ids).toEqual(["a"]);
  });

  it("selects intersecting elements in crossing mode", () => {
    const a = createDiagramElement("block", 100, 100, "a");
    const b = createDiagramElement("block", 300, 100, "b");
    const ids = elementIdsInMarquee([a, b], { left: 150, right: 350, top: 50, bottom: 200 }, false);
    expect(ids.sort()).toEqual(["a", "b"].sort());
  });
});
