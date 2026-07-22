import { describe, expect, it } from "vitest";
import { createDiagramElement } from "@/app/lib/component-catalog";
import {
  createConnection,
  decomposeVectorElement,
  createReferencedElement,
  createVariableForElement,
  contextCandidatesForElement,
  findElementDependencies,
  resolveDiagramElement,
  removeElementWithDependencies,
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
    expect(createVariableForElement(createDiagramElement("spring", 0, 0), "spring-k")).toMatchObject({ symbol: "k", type: "coefficient", unit: "N/m" });
    expect(createVariableForElement(createDiagramElement("damper", 0, 0), "damper-c")).toMatchObject({ symbol: "c", type: "coefficient", unit: "N·s/m" });
    expect(createVariableForElement(createDiagramElement("rope", 0, 0), "rope-t")).toMatchObject({ symbol: "T", type: "vector", unit: "N" });
  });

  it("offers deterministic body actions and keeps an attached force on its target", () => {
    const body = createDiagramElement("block", 100, 100, "body-a");
    expect(contextCandidatesForElement(body)).toEqual(expect.arrayContaining(["gravity", "normal-force", "friction-force", "tension", "force", "velocity", "acceleration"]));
    const gravity = createReferencedElement("gravity", body, "gravity-a");
    expect(gravity).toMatchObject({ referenceTargetId: "body-a", rotation: 90, x: 100, y: 165 });
    expect(resolveDiagramElement(gravity, [{ ...body, x: 240, y: 80 }, gravity])).toMatchObject({ x: 240, y: 145 });
  });

  it("offers friction only for rough catalog surfaces and aligns force candidates to the surface", () => {
    const smoothWall = createDiagramElement("smooth-wall", 100, 100, "smooth-wall-a");
    const roughWall = createDiagramElement("rough-wall", 100, 100, "rough-wall-a");
    const roughIncline = createDiagramElement("rough-incline", 200, 200, "rough-incline-a");

    expect(contextCandidatesForElement(smoothWall)).toEqual(["normal-force"]);
    expect(contextCandidatesForElement(roughWall)).toEqual(["normal-force", "friction-force"]);
    expect(contextCandidatesForElement(roughIncline)).toEqual(["normal-force", "friction-force", "angle-arc", "local-axis"]);
    expect(createReferencedElement("normal-force", smoothWall, "normal-wall")).toMatchObject({ referenceTargetId: smoothWall.id, rotation: -180 });
    expect(createReferencedElement("friction-force", roughIncline, "friction-incline")).toMatchObject({ referenceTargetId: roughIncline.id, rotation: -30 });
  });

  it("keeps rotational quantities centered on a moving disk and assigns angular units", () => {
    const disk = createDiagramElement("disk", 200, 180, "disk");
    const omega = createReferencedElement("angular-velocity", disk, "omega");
    const alpha = createReferencedElement("angular-acceleration", disk, "alpha");
    const movedDisk = { ...disk, x: 340, y: 260 };

    expect(contextCandidatesForElement(disk)).toEqual(expect.arrayContaining(["force", "moment", "angular-velocity", "angular-acceleration", "rotation-direction", "radius-dimension"]));
    expect(resolveDiagramElement(omega, [movedDisk, omega])).toMatchObject({ x: 340, y: 260 });
    expect(createVariableForElement(omega)).toMatchObject({ symbol: "ω", unit: "rad/s", type: "vector" });
    expect(createVariableForElement(alpha)).toMatchObject({ symbol: "α", unit: "rad/s²", type: "vector" });
  });

  it("decomposes a vector into referenced x/y components with one shared variable", () => {
    const body = createDiagramElement("block", 100, 100, "body-components");
    const force = createReferencedElement("force", body, "force-components");
    force.label = "F";
    force.rotation = -30;
    force.width = 120;
    const variable = createVariableForElement(force, "force-variable");
    const decomposition = decomposeVectorElement(force, [variable], "force-components-result");

    expect(decomposition?.components[0]).toMatchObject({ id: "force-components-result-x", label: "Fₓ", referenceTargetId: body.id, rotation: 0, width: 103.92304845413264 });
    expect(decomposition?.components[1]).toMatchObject({ id: "force-components-result-y", label: "Fᵧ", referenceTargetId: body.id, rotation: -90, width: 59.99999999999999 });
    expect(decomposition?.variables[0].referenceIds).toEqual([force.id, "force-components-result-x", "force-components-result-y"]);
    expect(decomposition?.constraint).toMatchObject({ kind: "same-variable", targetIds: [force.id, "force-components-result-x", "force-components-result-y"] });
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

    const tension = createReferencedElement("tension", rope, "tension-rope");
    const tensionVariable = createVariableForElement(tension, "tension-variable");
    const removed = removeElementWithDependencies(first.id, [first, second, rope, tension], [variable, tensionVariable], [constraint]);
    expect([...removed.removedIds]).toEqual(expect.arrayContaining([first.id, rope.id, tension.id]));
    expect(removed.elements).toEqual([second]);
    expect(removed.variables).toEqual([]);
    expect(removed.constraints).toEqual([]);
    expect(validateModelReferences(removed.elements, removed.variables, removed.constraints)).toEqual([]);
  });
});
