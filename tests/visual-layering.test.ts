import { describe, expect, it } from "vitest";
import { drawScene } from "@/app/components/EditorCanvas";
import { INITIAL_SCENE } from "@/app/lib/editor-types";
import { sceneToSvg } from "@/app/lib/scene-export";
import { createDiagramElement } from "@/app/lib/component-catalog";

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
    setTransform(...args: number[]) { operations.push({ name: "setTransform", args }); },
  } as unknown as CanvasRenderingContext2D;
  return { context, operations };
}

function isApprox(value: unknown, expected: number) {
  return typeof value === "number" && Math.abs(value - expected) < 0.01;
}

describe("VIS-001 force-vector foreground regression", () => {
  it("draws incline force shafts after the object fill at every supported zoom and flip", () => {
    for (const zoom of [50, 75, 100, 125, 180]) {
      for (const flipped of [false, true]) {
        const { context, operations } = recordingContext();
        const geometry = drawScene(context, 1200, 800, { ...INITIAL_SCENE, flipped }, "incline", zoom);
        const blockFillIndex = operations.findIndex((operation) =>
          operation.name === "fillRect" && isApprox(operation.args[2], 150 * geometry.scale),
        );
        const gravityStrokeIndex = operations.findIndex((operation) =>
          operation.name === "stroke" && operation.path?.some((item) =>
            item.name === "moveTo" &&
            isApprox(item.args[0], geometry.blockCenter.x) &&
            isApprox(item.args[1], geometry.blockCenter.y),
          ) && operation.path?.some((item) =>
            item.name === "lineTo" &&
            isApprox(item.args[0], geometry.forceGravityEnd.x) &&
            isApprox(item.args[1], geometry.forceGravityEnd.y),
          ),
        );

        expect(blockFillIndex, `block fill at ${zoom}% flipped=${flipped}`).toBeGreaterThan(-1);
        expect(gravityStrokeIndex, `gravity stroke at ${zoom}% flipped=${flipped}`).toBeGreaterThan(blockFillIndex);
      }
    }
  });

  it("draws free-body force labels after the object fill", () => {
    const { context, operations } = recordingContext();
    drawScene(context, 1200, 800, INITIAL_SCENE, "freebody", 100);
    const blockFillIndex = operations.findIndex((operation) => operation.name === "fillRect" && Number(operation.args[2]) < 200);
    const gravityLabelIndex = operations.findIndex((operation) => operation.name === "fillText" && operation.args[0] === "mg");

    expect(blockFillIndex).toBeGreaterThan(-1);
    expect(gravityLabelIndex).toBeGreaterThan(blockFillIndex);
  });

  it("keeps SVG vectors after the object layer and labels after vectors", () => {
    const svg = sceneToSvg(INITIAL_SCENE);
    const objectIndex = svg.indexOf('data-layer="object"');
    const vectorIndex = svg.indexOf('data-layer="vector"');
    const massLabelIndex = svg.lastIndexOf('data-layer="label"');

    expect(objectIndex).toBeGreaterThan(-1);
    expect(vectorIndex).toBeGreaterThan(objectIndex);
    expect(massLabelIndex).toBeGreaterThan(vectorIndex);
  });

  it("escapes user-authored labels in SVG", () => {
    const svg = sceneToSvg({ ...INITIAL_SCENE, massLabel: '<m & "x">', annotationText: "A'B & C", showAnnotation: true });

    expect(svg).toContain("&lt;m &amp; &quot;x&quot;&gt;");
    expect(svg).toContain("A&apos;B &amp; C");
    expect(svg).not.toContain('<m & "x">');
  });

  it("exports walls with an upright object and visible roughness marks", () => {
    const svg = sceneToSvg({ ...INITIAL_SCENE, surfaceKind: "wall", surfaceRoughness: "rough" });

    expect(svg).toContain('data-surface-kind="wall"');
    expect(svg).toContain('data-surface-roughness="rough"');
    expect(svg).toContain('data-layer="surface-texture"');
    expect(svg).toMatch(/data-layer="object" transform="translate\([^)]*\) rotate\(0\)"/);
    expect(svg).not.toContain(">θ</text>");
  });

  it("applies transparent/white backgrounds and exact export margins", () => {
    const transparent = sceneToSvg(INITIAL_SCENE, { background: "transparent", margin: 24 });
    expect(transparent).toContain('width="948" height="608" viewBox="-24 -24 948 608"');
    expect(transparent).not.toContain('data-layer="paper"');

    const white = sceneToSvg(INITIAL_SCENE, { background: "white", margin: 0 });
    expect(white).toContain('data-layer="paper"');
    expect(white).toContain('width="900" height="560" viewBox="0 0 900 560"');
  });

  it("exports only the selected legacy component when selection range is requested", () => {
    const scene = { ...INITIAL_SCENE, elements: [] };
    const full = sceneToSvg(scene);
    const selection = sceneToSvg(scene, { selectedId: "force-gravity" });
    expect(full).toContain('data-vector="mg"');
    expect(selection).toContain('data-vector="mg"');
    expect(selection).not.toContain('data-vector="N"');
    expect(selection).not.toContain('data-layer="object"');
  });

  it("exports only the selected catalog component when selection range is requested", () => {
    const first = createDiagramElement("block", 300, 300, "first");
    const second = createDiagramElement("sphere", 500, 300, "second");
    const scene = { ...INITIAL_SCENE, elements: [first, second], selectedId: "element:second" as const };
    const selection = sceneToSvg(scene, { selectedId: scene.selectedId });
    expect(selection).toContain('data-component-id="second"');
    expect(selection).not.toContain('data-component-id="first"');
    expect(selection).not.toContain('data-layer="object"');
  });
});
