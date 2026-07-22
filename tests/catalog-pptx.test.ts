import { describe, expect, it } from "vitest";
import { addCatalogElementsToPptx } from "@/app/lib/catalog-pptx";
import { PHYSICS_COMPONENT_CATALOG, createDiagramElement } from "@/app/lib/component-catalog";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";

describe("OUT-010 editable PPTX catalog output", () => {
  it("emits every visible standard component as a separately named PowerPoint object", () => {
    const operations: Array<{ kind: string; options: Record<string, unknown>; text?: string }> = [];
    const slide = {
      addShape: (kind: string, options: Record<string, unknown>) => operations.push({ kind, options }),
      addText: (text: string, options: Record<string, unknown>) => operations.push({ kind: "text", options, text }),
    };
    const elements = PHYSICS_COMPONENT_CATALOG.map((item, index) => createDiagramElement(item.kind, 40 + index * 8, 120 + index % 5 * 30, `pptx-${item.kind}`));
    addCatalogElementsToPptx(slide as never, { ellipse: "ellipse", line: "line", rect: "rect" } as never, elements);

    for (const element of elements) {
      expect(operations.some((operation) => String(operation.options.objectName).startsWith(`physics:${element.id}:${element.kind}`)), element.kind).toBe(true);
    }
    const firstVector = operations.findIndex((operation) => String(operation.options.objectName).includes(":force"));
    const body = operations.findIndex((operation) => String(operation.options.objectName).includes(":block"));
    expect(firstVector).toBeGreaterThan(body);
    expect(operations.filter((operation) => String(operation.options.objectName).startsWith("physics:")).length).toBeGreaterThan(elements.length);
  });

  it("writes those objects into a valid editable PPTX package", async () => {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const slide = pptx.addSlide();
    const elements = PHYSICS_COMPONENT_CATALOG.map((item, index) => createDiagramElement(item.kind, 50 + index * 6, 100 + index % 6 * 40, `package-${item.kind}`));
    addCatalogElementsToPptx(slide, pptx.ShapeType, elements);
    const data = await pptx.write({ outputType: "nodebuffer" });
    const archive = await JSZip.loadAsync(data as Buffer);
    const xml = await archive.file("ppt/slides/slide1.xml")!.async("string");

    expect(archive.file("[Content_Types].xml")).not.toBeNull();
    for (const element of elements) expect(xml, element.kind).toContain(`physics:${element.id}:${element.kind}`);
  });
});
