import { describe, expect, it } from "vitest";
import { createDiagramElement } from "@/app/lib/component-catalog";
import { INITIAL_SCENE, type DiagramPage } from "@/app/lib/editor-types";
import { inspectPageQuality } from "@/app/lib/export-quality";

function page(overrides: Partial<DiagramPage> = {}): DiagramPage {
  return { id: "quality-page", kind: "incline", scene: { ...INITIAL_SCENE, constraints: [...INITIAL_SCENE.constraints], elements: [], variables: [...INITIAL_SCENE.variables] }, title: "品質図", ...overrides };
}

describe("automatic export quality inspection", () => {
  it("accepts the default textbook diagram", () => {
    expect(inspectPageQuality(page())).toEqual([]);
  });

  it("identifies empty pages instead of generating a silent empty file", () => {
    expect(inspectPageQuality(page({ kind: "blank" }))).toEqual([expect.objectContaining({ code: "empty-document", severity: "error" })]);
  });

  it("reports a conflicting constraint with its target", () => {
    const conflicted = page();
    conflicted.scene.constraints = [{ id: "bad", conflict: "平行と垂直が同時に指定されています", enabled: true, kind: "parallel", strength: "required", targetIds: ["incline"] }];
    expect(inspectPageQuality(conflicted)).toContainEqual(expect.objectContaining({ code: "constraint-conflict", targetId: "incline" }));
  });

  it("reports broken references, off-paper parts, and overlapping labels", () => {
    const first = createDiagramElement("block", 930, 200, "first");
    const second = createDiagramElement("block", 930, 200, "second");
    const invalid = page();
    invalid.scene.elements = [first, second];
    invalid.scene.variables = [{ id: "broken-variable", referenceIds: ["missing"], symbol: "", type: "mass", unit: "kg", value: "" }];
    const codes = inspectPageQuality(invalid).map((issue) => issue.code);
    expect(codes).toContain("model-reference");
    expect(codes).toContain("outside-paper");
    expect(codes).toContain("label-overlap");
  });
});

