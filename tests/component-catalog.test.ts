import { describe, expect, it } from "vitest";
import {
  PHYSICS_COMPONENT_CATALOG,
  catalogEntryForTool,
  componentToolId,
  createDiagramElement,
  searchComponentCatalog,
} from "@/app/lib/component-catalog";
import { diagramElementsToSvg } from "@/app/lib/catalog-svg";
import { diagramElementContainsPoint, drawDiagramElement } from "@/app/lib/catalog-renderer";

describe("PHY-075 standard component catalog", () => {
  it("contains unique physical component kinds across every required category", () => {
    const kinds = PHYSICS_COMPONENT_CATALOG.map((item) => item.kind);
    expect(PHYSICS_COMPONENT_CATALOG.length).toBeGreaterThanOrEqual(50);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(new Set(PHYSICS_COMPONENT_CATALOG.map((item) => item.category))).toEqual(new Set([
      "物体", "接触面", "支持", "接続", "機械要素", "軌道", "流体", "ベクトル", "注釈",
    ]));
  });

  it.each([
    ["曲面接触", "curved-surface"],
    ["固定端", "fixed-end"],
    ["ローラー", "roller-support"],
    ["ロープ", "rope"],
    ["動滑車", "movable-pulley"],
    ["コンベア", "belt"],
    ["空気抵抗", "drag-force"],
    ["斜面座標軸", "local-axis"],
  ])("finds catalog aliases for %s", (query, expectedKind) => {
    expect(searchComponentCatalog(query).map((item) => item.kind)).toContain(expectedKind);
  });

  it("finds every formal name, alias, and declared physics tag", () => {
    for (const item of PHYSICS_COMPONENT_CATALOG) {
      for (const query of [item.name, ...item.aliases, ...item.physics]) {
        expect(searchComponentCatalog(query).map((candidate) => candidate.kind), `${item.kind} must be found by ${query}`).toContain(item.kind);
      }
    }
  });

  it("maps tools to catalog definitions deterministically", () => {
    for (const item of PHYSICS_COMPONENT_CATALOG) {
      expect(catalogEntryForTool(componentToolId(item.kind))?.kind).toBe(item.kind);
    }
  });

  it("creates real, independently identified editable elements", () => {
    const first = createDiagramElement("damper", 120, 80, "damper-1");
    const second = createDiagramElement("damper", 180, 80, "damper-2");
    expect(first).toMatchObject({ id: "damper-1", kind: "damper", label: "c", x: 120, y: 80, visible: true, locked: false });
    expect(second.id).not.toBe(first.id);
  });

  it("exports every catalog component as an editable named SVG group", () => {
    const elements = PHYSICS_COMPONENT_CATALOG.map((item, index) => createDiagramElement(item.kind, 20 + index * 4, 100, `part-${index}`));
    elements[0].label = '<m & "1">';
    const svg = diagramElementsToSvg(elements);

    expect((svg.match(/data-layer="catalog-component"/g) ?? [])).toHaveLength(PHYSICS_COMPONENT_CATALOG.length);
    for (const item of PHYSICS_COMPONENT_CATALOG) expect(svg).toContain(`data-component-kind="${item.kind}"`);
    expect(svg).toContain("&lt;m &amp; &quot;1&quot;&gt;");
  });

  it("renders every component kind and hit-tests rotated bounds", () => {
    const context = new Proxy({}, {
      get: () => () => undefined,
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    for (const [index, item] of PHYSICS_COMPONENT_CATALOG.entries()) {
      const element = createDiagramElement(item.kind, 100 + index, 100, `draw-${index}`);
      expect(() => drawDiagramElement(context, element, { x: 0, y: 0 }, 1, true)).not.toThrow();
    }

    const rotated = { ...createDiagramElement("light-rod", 100, 100, "rod"), rotation: 45 };
    expect(diagramElementContainsPoint(rotated, { x: 100, y: 100 })).toBe(true);
    expect(diagramElementContainsPoint(rotated, { x: 500, y: 500 })).toBe(false);
  });
});
