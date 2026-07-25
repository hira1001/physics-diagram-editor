import { describe, expect, it } from "vitest";
import { drawScene } from "@/app/components/EditorCanvas";
import { INITIAL_SCENE } from "@/app/lib/editor-types";
import { sceneToSvg } from "@/app/lib/scene-export";
import { createDiagramElement } from "@/app/lib/component-catalog";
import { createReferencedElement } from "@/app/lib/diagram-model";
import { buildTemplateScene } from "@/app/lib/template-builder";

type Operation = {
  name: string;
  args: unknown[];
  path?: Array<{ name: string; args: number[] }>;
};

function recordingContext() {
  const operations: Operation[] = [];
  let path: Array<{ name: string; args: number[] }> = [];
  const context = {
    beginPath() { path = []; operations.push({ name: "beginPath", args: [] }); },
    moveTo(...args: number[]) { path.push({ name: "moveTo", args }); operations.push({ name: "moveTo", args }); },
    lineTo(...args: number[]) { path.push({ name: "lineTo", args }); operations.push({ name: "lineTo", args }); },
    stroke() { operations.push({ name: "stroke", args: [], path: [...path] }); },
    fill() { operations.push({ name: "fill", args: [], path: [...path] }); },
    fillRect(...args: number[]) { operations.push({ name: "fillRect", args }); },
    strokeRect(...args: number[]) { operations.push({ name: "strokeRect", args }); },
    fillText(...args: unknown[]) { operations.push({ name: "fillText", args }); },
    clearRect(...args: number[]) { operations.push({ name: "clearRect", args }); },
    rect(...args: number[]) { operations.push({ name: "rect", args }); },
    arc(...args: number[]) { operations.push({ name: "arc", args }); },
    save() { operations.push({ name: "save", args: [] }); },
    restore() { operations.push({ name: "restore", args: [] }); },
    clip() { operations.push({ name: "clip", args: [] }); },
    closePath() { operations.push({ name: "closePath", args: [] }); },
    translate(...args: number[]) { operations.push({ name: "translate", args }); },
    rotate(...args: number[]) { operations.push({ name: "rotate", args }); },
    scale(...args: number[]) { operations.push({ name: "scale", args }); },
    setLineDash(...args: unknown[]) { operations.push({ name: "setLineDash", args }); },
    setTransform(...args: number[]) { operations.push({ name: "setTransform", args }); },
    quadraticCurveTo(...args: number[]) { operations.push({ name: "quadraticCurveTo", args }); },
  } as unknown as CanvasRenderingContext2D;
  return { context, operations };
}

describe("VIS-001 force-vector foreground regression", () => {
  it("draws catalog forces after body parts at supported zooms", () => {
    const block = createDiagramElement("block", 450, 300, "body");
    const gravity = createReferencedElement("gravity", block, "grav");
    gravity.rotation = 90;
    const scene = { ...INITIAL_SCENE, elements: [block, gravity] };

    for (const zoom of [50, 75, 100, 125, 180]) {
      const { context, operations } = recordingContext();
      drawScene(context, 1200, 800, scene, "incline", zoom);
      const bodyFillIndex = operations.findIndex((operation) => operation.name === "fillRect" || operation.name === "fill");
      const gravityLabelIndex = operations.findIndex((operation) => operation.name === "fillText" && operation.args[0] === "mg");
      expect(bodyFillIndex, `body fill at ${zoom}%`).toBeGreaterThan(-1);
      expect(gravityLabelIndex, `gravity label at ${zoom}%`).toBeGreaterThan(bodyFillIndex);
    }
  });

  it("draws free-body template forces after the object", () => {
    const scene = buildTemplateScene("freebody");
    const { context, operations } = recordingContext();
    drawScene(context, 1200, 800, scene, "freebody", 100);
    const bodyFillIndex = operations.findIndex((operation) => operation.name === "fillRect" || operation.name === "fill");
    const gravityLabelIndex = operations.findIndex((operation) => operation.name === "fillText" && operation.args[0] === "mg");
    expect(bodyFillIndex).toBeGreaterThan(-1);
    expect(gravityLabelIndex).toBeGreaterThan(bodyFillIndex);
  });

  it("keeps SVG catalog vectors after objects", () => {
    const scene = buildTemplateScene("incline");
    const svg = sceneToSvg(scene);
    const objectIndex = svg.indexOf('data-component-kind="block"');
    const vectorIndex = svg.indexOf('data-component-kind="gravity"');
    expect(objectIndex).toBeGreaterThan(-1);
    expect(vectorIndex).toBeGreaterThan(objectIndex);
  });

  it("escapes user-authored catalog labels in SVG", () => {
    const block = createDiagramElement("block", 300, 300, "label-escape");
    block.label = '<m & "x">';
    const svg = sceneToSvg({ ...INITIAL_SCENE, elements: [block] });
    expect(svg).toContain("&lt;m &amp; &quot;x&quot;&gt;");
    expect(svg).not.toContain('<m & "x">');
  });

  it("applies transparent/white backgrounds and exact export margins", () => {
    const transparent = sceneToSvg(INITIAL_SCENE, { background: "transparent", margin: 24 });
    expect(transparent).toContain('width="948" height="608" viewBox="-24 -24 948 608"');
    expect(transparent).not.toContain('data-layer="paper"');

    const white = sceneToSvg(INITIAL_SCENE, { background: "white", margin: 0 });
    expect(white).toContain('data-layer="paper"');
    expect(white).toContain('width="900" height="560" viewBox="0 0 900 560"');
  });

  it("exports only the selected catalog component when selection range is requested", () => {
    const first = createDiagramElement("block", 300, 300, "first");
    const second = createDiagramElement("sphere", 500, 300, "second");
    const scene = { ...INITIAL_SCENE, elements: [first, second], selectedId: "element:second" as const };
    const selection = sceneToSvg(scene, { selectedId: scene.selectedId });
    expect(selection).toContain('data-component-id="second"');
    expect(selection).not.toContain('data-component-id="first"');
  });
});
