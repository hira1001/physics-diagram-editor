import { describe, expect, it } from "vitest";
import {
  PHYSICS_COMPONENT_CATALOG,
  catalogEntryForTool,
  catalogSurfaceKind,
  catalogSurfacePreset,
  componentToolId,
  createDiagramElement,
  searchComponentCatalog,
} from "@/app/lib/component-catalog";
import { diagramElementsToSvg } from "@/app/lib/catalog-svg";
import { diagramElementContainsPoint, drawDiagramElement } from "@/app/lib/catalog-renderer";

describe("PHY-075 standard component catalog", () => {
  it("contains unique physical component kinds across every required category", () => {
    const kinds = PHYSICS_COMPONENT_CATALOG.map((item) => item.kind);
    expect(PHYSICS_COMPONENT_CATALOG.length).toBeGreaterThanOrEqual(60);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(new Set(PHYSICS_COMPONENT_CATALOG.map((item) => item.category))).toEqual(new Set([
      "物体", "接触面", "支持", "接続", "機械要素", "軌道", "流体", "ベクトル", "注釈",
    ]));
  });

  it("contains independently placeable smooth and rough floor, wall, and incline parts", () => {
    for (const direction of ["floor", "wall", "incline"] as const) {
      for (const roughness of ["smooth", "rough"] as const) {
        const kind = catalogSurfaceKind(direction, roughness);
        expect(PHYSICS_COMPONENT_CATALOG.map((item) => item.kind)).toContain(kind);
        expect(catalogSurfacePreset(kind)).toEqual({ direction, roughness });
      }
    }
  });

  it("keeps every object and rotational annotation from the catalog requirements independently placeable", () => {
    const byName = new Map(PHYSICS_COMPONENT_CATALOG.map((item) => [item.name, item.kind]));
    expect(byName.get("円板")).toBe("disk");
    expect(byName.get("円柱")).toBe("cylinder");
    expect(byName.get("角速度")).toBe("angular-velocity");
    expect(byName.get("角加速度")).toBe("angular-acceleration");
    expect(byName.get("回転方向")).toBe("rotation-direction");
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

  it("uses each component's real font size and line width in SVG", () => {
    const element = createDiagramElement("block", 200, 180, "styled-block");
    element.fontSize = 14;
    element.lineWidth = 1.25;
    const svg = diagramElementsToSvg([element]);
    expect(svg).toContain('font-size="14"');
    expect(svg).toContain('stroke-width="1.25"');
  });

  it("renders labels unrotated in Canvas and SVG when the element is rotated", () => {
    const rotatedBlock = { ...createDiagramElement("block", 200, 180, "block-1"), rotation: 45, label: "m" };
    const svg = diagramElementsToSvg([rotatedBlock]);
    expect(svg).toContain('transform="rotate(-45 ');
    expect(svg).toContain('>m</text>');

    const rotates: number[] = [];
    const mockContext = {
      save() {},
      restore() {},
      translate() {},
      scale() {},
      rotate(rad: number) { rotates.push(rad); },
      beginPath() {},
      arc() {},
      fill() {},
      stroke() {},
      fillRect() {},
      strokeRect() {},
      fillText() {},
      setLineDash() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
    } as unknown as CanvasRenderingContext2D;

    drawDiagramElement(mockContext, rotatedBlock, { x: 0, y: 0 }, 1, false);
    // Element rotated by +45 deg (0.785 rad), label unrotated by -45 deg (-0.785 rad)
    const rad45 = 45 * Math.PI / 180;
    expect(rotates).toContain(rad45);
    expect(rotates).toContain(-rad45);
  });
});
