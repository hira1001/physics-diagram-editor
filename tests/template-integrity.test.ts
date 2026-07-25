import { describe, expect, it } from "vitest";
import { buildTemplateScene } from "@/app/lib/template-builder";
import { createDiagramElement } from "@/app/lib/component-catalog";

describe("minimum-click template integrity", () => {
  it("simply-supported-beam template creates catalog-backed elements without throw", () => {
    const scene = buildTemplateScene("simply-supported-beam");
    expect(scene.elements.length).toBeGreaterThan(3);
    expect(scene.elements.some((el) => el.kind === "distributed-load")).toBe(true);
    expect(scene.elements.some((el) => el.kind === "pin-support")).toBe(true);
  });

  it("pulley template uses fixed-end from catalog", () => {
    const scene = buildTemplateScene("pulley");
    expect(scene.elements.some((el) => el.kind === "fixed-end")).toBe(true);
  });

  it("createDiagramElement succeeds for every required catalog kind", () => {
    expect(() => createDiagramElement("fixed-end", 0, 0, "x")).not.toThrow();
    expect(() => createDiagramElement("beam", 0, 0, "y")).not.toThrow();
  });
});
