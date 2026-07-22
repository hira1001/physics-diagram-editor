import { describe, expect, it } from "vitest";
import { createDiagramElement } from "@/app/lib/component-catalog";
import {
  createConnection,
  createReferencedElement,
  createVariableForElement,
  contextCandidatesForElement,
  findElementDependencies,
  resolveDiagramElement,
  validateModelReferences,
} from "@/app/lib/diagram-model";

describe("PHY-004/005/018/022 semantic diagram model", () => {
  it("keeps connection endpoints attached when either target moves", () => {
    const first = createDiagramElement("block", 100, 100, "block-a");
    const second = createDiagramElement("sphere", 300, 100, "sphere-b");
    const string = createConnection("string", first, second, "string-a-b");

    expect(string).toMatchObject({ startTargetId: "block-a", endTargetId: "sphere-b", x: 209.5, y: 100, width: 99, rotation: 0 });
    const moved = { ...second, x: 100, y: 300 };
    expect(resolveDiagramElement(string, [first, moved, string])).toMatchObject({ x: 100, y: 198.5, width: 121, rotation: 90 });
  });

  it("creates a typed variable with a concrete element reference", () => {
    const mass = createDiagramElement("point-mass", 100, 100, "mass-a");
    const variable = createVariableForElement(mass, "variable-mass-a");
    expect(variable).toEqual({ id: "variable-mass-a", referenceIds: ["mass-a"], symbol: "m", type: "mass", unit: "kg", value: "" });
  });

  it("offers deterministic body actions and keeps an attached force on its target", () => {
    const body = createDiagramElement("block", 100, 100, "body-a");
    expect(contextCandidatesForElement(body)).toEqual(expect.arrayContaining(["gravity", "normal-force", "friction-force", "tension", "force", "velocity", "acceleration"]));
    const gravity = createReferencedElement("gravity", body, "gravity-a");
    expect(gravity).toMatchObject({ referenceTargetId: "body-a", rotation: 90, x: 100, y: 165 });
    expect(resolveDiagramElement(gravity, [{ ...body, x: 240, y: 80 }, gravity])).toMatchObject({ x: 240, y: 145 });
  });

  it("reports dependencies and all orphan or self references", () => {
    const first = createDiagramElement("block", 100, 100, "block-a");
    const second = createDiagramElement("block", 300, 100, "block-b");
    const rope = createConnection("rope", first, second, "rope-a-b");
    const variable = { ...createVariableForElement(first, "mass-variable"), referenceIds: [first.id] };
    const constraint = { conflict: null, enabled: true, id: "connection", kind: "connection" as const, strength: "required" as const, targetIds: [first.id, second.id, rope.id] };

    expect(findElementDependencies(first.id, [first, second, rope], [variable], [constraint])).toMatchObject({ connections: [rope], variables: [variable], constraints: [constraint] });
    expect(validateModelReferences([first, second, rope], [variable], [constraint])).toEqual([]);
    expect(validateModelReferences([{ ...rope, endTargetId: "missing" }], [{ ...variable, referenceIds: ["missing"] }], [{ ...constraint, targetIds: ["missing"] }])).toEqual(expect.arrayContaining([
      "rope-a-b:始点参照切れ", "rope-a-b:終点参照切れ", "mass-variable:参照切れ:missing", "connection:参照切れ:missing",
    ]));
  });
});
