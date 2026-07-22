import { expect, test, type Page } from "@playwright/test";
import { createGeometry } from "../app/components/EditorCanvas";
import { INITIAL_SCENE } from "../app/lib/editor-types";
import { PHYSICS_COMPONENT_CATALOG } from "../app/lib/component-catalog";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

async function openCleanEditor(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible();
  const skip = page.getByRole("button", { name: "スキップ", exact: true });
  if (await skip.isVisible()) await skip.click();
}

async function canvasGeometry(page: Page) {
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");
  return { box, canvas, geometry: createGeometry(box.width, box.height, INITIAL_SCENE, 100) };
}

async function dragCanvasPoint(page: Page, box: { x: number; y: number }, point: { x: number; y: number }, delta: { x: number; y: number }) {
  const from = { x: box.x + point.x, y: box.y + point.y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + delta.x, from.y + delta.y, { steps: 8 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await openCleanEditor(page);
});

test("SHL-001/003/019: editor shell contains only functional drawing controls", async ({ page }) => {
  await expect(page.getByRole("button", { name: "出力", exact: true })).toBeEnabled();
  await expect(page.getByPlaceholder("操作・部品を検索…")).toBeVisible();
  await expect(page.getByText("問題", { exact: true })).toHaveCount(0);
  await expect(page.getByText("解答", { exact: true })).toHaveCount(0);
  await expect(page.getByText("解説", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "テンプレートを開く 8", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "テンプレート" })).toBeVisible();
  await page.getByRole("button", { name: "粗い斜面上の物体 斜面・物体・基本3力 θ / m / mg / N / f / μ", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "テンプレート" })).toHaveCount(0);
});

test("VIS-001/017/018: force vectors stay in front of the object", async ({ page }) => {
  const canvas = page.getByTestId("editor-canvas");
  await expect(canvas).toHaveScreenshot("incline-force-foreground.png");

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.getByRole("button", { name: "左右反転", exact: true }).click();
  await expect(canvas).toHaveScreenshot("incline-force-foreground-flipped.png");
});

test("DIR-006: the complete incline diagram can be dragged", async ({ page }) => {
  const { box, geometry } = await canvasGeometry(page);
  const point = {
    x: geometry.start.x + (geometry.end.x - geometry.start.x) * 0.32,
    y: geometry.start.y + (geometry.end.y - geometry.start.y) * 0.32,
  };
  await dragCanvasPoint(page, box, point, { x: 48, y: 32 });

  await expect(page.getByRole("spinbutton", { name: "図 X" })).not.toHaveValue("0");
  await expect(page.getByRole("spinbutton", { name: "図 Y" })).not.toHaveValue("0");
});

test("DIR-008: mass label m can be dragged independently", async ({ page }) => {
  const { box, geometry } = await canvasGeometry(page);
  await dragCanvasPoint(page, box, geometry.massLabelPoint, { x: 36, y: -22 });

  await expect(page.getByRole("spinbutton", { name: "文字 X" })).not.toHaveValue("0");
  await expect(page.getByRole("spinbutton", { name: "文字 Y" })).not.toHaveValue("0");
});

test("DIR-009: angle label theta can be dragged independently", async ({ page }) => {
  const { box, geometry } = await canvasGeometry(page);
  await dragCanvasPoint(page, box, geometry.anglePoint, { x: 34, y: -20 });

  await expect(page.getByRole("spinbutton", { name: "文字 X" })).not.toHaveValue("0");
  await expect(page.getByRole("spinbutton", { name: "文字 Y" })).not.toHaveValue("0");
});

test("REL-014: primary P0 flow produces no browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.getByRole("button", { name: "出力", exact: true }).click();
  await expect(page.getByText("品質チェック完了", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "出力を閉じる" }).click();
  await page.getByPlaceholder("操作・部品を検索…").fill("自由体図");
  await page.getByRole("button", { name: "自由体図を生成 変量を共有した別タブを作成", exact: true }).click();
  await expect(page.getByRole("button", { name: "自由体図", exact: true })).toHaveAttribute("aria-current", "page");

  expect(errors).toEqual([]);
});

test("SHL-004/REL-001/002: save status is truthful and the edited document restores", async ({ page }) => {
  const angle = page.getByRole("spinbutton", { name: "角度 °" });
  await angle.fill("36");
  await expect(page.getByText("保存中…", { exact: true })).toBeVisible();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });

  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "角度 °" })).toHaveValue("36");
});

test("REL-003: density, panels, and zoom restore after reload", async ({ page }) => {
  await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await page.getByLabel("UI密度").selectOption("compact");
  await page.getByRole("button", { name: "拡大", exact: true }).click();
  await expect(page.locator(".physics-editor")).toHaveClass(/density-compact/);
  await expect(page.getByText("110%", { exact: true })).toBeVisible();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });

  await page.reload();
  await expect(page.locator(".physics-editor")).toHaveClass(/density-compact/);
  await expect(page.getByText("110%", { exact: true })).toBeVisible();
});

test("REL-004/005: legacy and corrupt saved data recover safely", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.setItem("physics-editor-workspace-v1", JSON.stringify({
      density: "standard",
      leftPanelVisible: true,
      rightPanelVisible: true,
      activePageId: "legacy",
      pages: [{ id: "legacy", title: "旧図", kind: "incline", scene: { angle: 35, massLabel: "M" } }],
    }));
  });
  await page.reload();
  await expect(page.getByText("保存データを最新版へ更新しました", { exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "角度 °" })).toHaveValue("35");

  await page.evaluate(() => window.localStorage.setItem("physics-editor-workspace-v1", "{broken-json"));
  await page.reload();
  await expect(page.getByText("保存データを読み取れなかったため、安全な新規図で復旧しました", { exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "角度 °" })).toHaveValue("30");
});

test("REL-006: storage failure never claims the document was saved", async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("spinbutton", { name: "角度 °" }).fill("41");

  await expect(page.getByText("保存できません", { exact: true })).toBeVisible({ timeout: 2_000 });
  await expect(page.getByRole("alert")).toContainText("端末への保存に失敗しました");
});

test("INS-010/011/012 and REL-010: numeric edit previews, cancels, and commits as one history item", async ({ page }) => {
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  const angle = inspector.getByRole("spinbutton", { name: "角度 °" });
  const undo = page.getByRole("button", { name: "元に戻す", exact: true });
  const redo = page.getByRole("button", { name: "やり直す", exact: true });

  await angle.fill("44");
  await expect(inspector.getByRole("button", { name: "θ 斜面角 44°", exact: true })).toBeVisible();
  await angle.press("Escape");
  await expect(angle).toHaveValue("30");
  await expect(undo).toBeDisabled();

  await angle.fill("45");
  await expect(inspector.getByRole("button", { name: "θ 斜面角 45°", exact: true })).toBeVisible();
  await angle.press("Enter");
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(angle).toHaveValue("30");
  await expect(undo).toBeDisabled();
  await redo.click();
  await expect(angle).toHaveValue("45");
});

test("DSC-008/011: command search executes the selected registered command once", async ({ page }) => {
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  const angle = inspector.getByRole("spinbutton", { name: "角度 °" });
  await angle.fill("42");
  await angle.press("Enter");

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  const search = page.getByPlaceholder("操作・部品を検索…");
  await search.fill("斜面を30");
  await expect(page.getByRole("button", { name: "斜面を30°に設定 選択中の斜面の角度を固定", exact: true })).toBeVisible();
  await search.press("Enter");

  await expect(angle).toHaveValue("30");
  await expect(page.getByRole("dialog", { name: "コマンド検索" })).toHaveCount(0);
});

test("DIR-002/PHY-013: a component can be selected then placed on the canvas", async ({ page }) => {
  await page.getByRole("button", { name: "テキスト T", exact: true }).click();
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");
  await canvas.click({ position: { x: box.width * 0.72, y: box.height * 0.2 } });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await expect(inspector.getByText("テキスト", { exact: true })).toBeVisible();
  await expect(inspector.getByRole("textbox", { name: "文字", exact: true })).toHaveValue("注記");
});

test("DIR-001: a library component can be dragged onto the canvas", async ({ page }) => {
  const source = page.getByRole("button", { name: "テキスト T", exact: true });
  const canvas = page.getByTestId("editor-canvas");
  await source.dragTo(canvas, { targetPosition: { x: 620, y: 180 } });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await expect(inspector.getByText("テキスト", { exact: true })).toBeVisible();
  await expect(inspector.getByRole("textbox", { name: "文字", exact: true })).toHaveValue("注記");
});

test("SHL-010/013: structure selection and diagram tabs select exact targets", async ({ page }) => {
  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await page.getByRole("button", { name: "垂直抗力 N", exact: true }).click();
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await expect(inspector.getByText("垂直抗力", { exact: true })).toBeVisible();

  const statusbar = page.getByRole("contentinfo");
  await statusbar.getByRole("button", { name: "自由体図", exact: true }).click();
  await expect(statusbar.getByRole("button", { name: "自由体図", exact: true })).toHaveAttribute("aria-current", "page");
  await statusbar.getByRole("button", { name: "図を追加", exact: true }).click();
  await expect(statusbar.getByRole("button", { name: "図3", exact: true })).toHaveAttribute("aria-current", "page");
});

test("PHY-040/041: smooth and rough walls expose different physical semantics", async ({ page }) => {
  const openTemplates = page.getByRole("button", { name: "テンプレートを開く 8", exact: true });
  await openTemplates.click();
  await page.getByRole("button", { name: "滑らかな壁と物体 壁面の法線力 m / mg / N", exact: true }).click();

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await expect(inspector.getByText("滑らかな壁", { exact: true })).toBeVisible();
  await expect(inspector.getByLabel("接触面の向き")).toHaveValue("wall");
  await expect(inspector.getByLabel("接触面の粗さ")).toHaveValue("smooth");
  await expect(inspector.getByLabel("摩擦係数")).toHaveCount(0);
  await inspector.getByRole("button", { name: "外観", exact: true }).click();
  await expect(inspector.getByLabel("摩擦力", { exact: true })).not.toBeChecked();
  await expect(page.getByTestId("editor-canvas")).toHaveScreenshot("smooth-wall.png");

  await openTemplates.click();
  await page.getByRole("button", { name: "粗い壁と物体 壁面の摩擦を含む m / mg / N / f / μ", exact: true }).click();
  await expect(inspector.getByText("粗い壁", { exact: true })).toBeVisible();
  await expect(inspector.getByLabel("摩擦係数")).toHaveValue("0.3");
  await expect(page.getByTestId("editor-canvas")).toHaveScreenshot("rough-wall.png");
});

test("PHY-042/043/044/045: floor and incline presets preserve their contact rules", async ({ page }) => {
  const openTemplates = page.getByRole("button", { name: "テンプレートを開く 8", exact: true });
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });

  await openTemplates.click();
  await page.getByRole("button", { name: "粗い水平面 床上の物体と外力 m / mg / N / f / μ", exact: true }).click();
  await expect(inspector.getByLabel("接触面の向き")).toHaveValue("floor");
  await expect(inspector.getByLabel("接触面の粗さ")).toHaveValue("rough");
  await expect(inspector.getByLabel("摩擦係数")).toBeVisible();
  await expect(page.getByTestId("editor-canvas")).toHaveScreenshot("rough-floor.png");

  await inspector.getByLabel("接触面の粗さ").selectOption("smooth");
  await expect(inspector.getByRole("alert")).toContainText("滑らかな面に摩擦力があります");
  await inspector.getByRole("button", { name: "摩擦力を外す", exact: true }).click();
  await expect(inspector.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("editor-canvas")).toHaveScreenshot("smooth-floor.png");

  await openTemplates.click();
  await page.getByRole("button", { name: "滑らかな斜面 摩擦なしの斜面 θ / m / mg / N", exact: true }).click();
  await expect(inspector.getByLabel("接触面の向き")).toHaveValue("incline");
  await expect(inspector.getByLabel("接触面の粗さ")).toHaveValue("smooth");
  await expect(inspector.getByLabel("摩擦係数")).toHaveCount(0);
  await expect(page.getByTestId("editor-canvas")).toHaveScreenshot("smooth-incline.png");

  await openTemplates.click();
  await page.getByRole("button", { name: "粗い斜面上の物体 斜面・物体・基本3力 θ / m / mg / N / f / μ", exact: true }).click();
  await expect(inspector.getByLabel("接触面の粗さ")).toHaveValue("rough");
  const angle = inspector.getByRole("spinbutton", { name: "角度 °", exact: true });
  await angle.fill("45");
  await angle.press("Enter");
  await expect(angle).toHaveValue("45");
  await expect(page.getByTestId("editor-canvas")).toHaveScreenshot("rough-incline-45.png");
});

test("PHY-046 and INS-013/014: surface conflicts are visible and resolved without silent deletion", async ({ page }) => {
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.getByLabel("接触面の粗さ").selectOption("smooth");

  const conflict = inspector.getByRole("alert");
  await expect(conflict).toContainText("滑らかな面に摩擦力があります");
  await expect(page.getByTestId("editor-canvas")).toHaveScreenshot("smooth-surface-friction-conflict.png");

  await conflict.getByRole("button", { name: "粗い面に変更", exact: true }).click();
  await expect(conflict).toHaveCount(0);
  await expect(inspector.getByLabel("接触面の粗さ")).toHaveValue("rough");
});

test("Catalog foundation: parts are placed, moved, locked, structured, and restored", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  await librarySearch.fill("ダンパー");
  await page.getByRole("button", { name: /^ダンパー/ }).click();

  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");
  const placedAt = { x: 500, y: 490 };
  await canvas.click({ position: placedAt });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await expect(inspector.locator(".inspector-title strong")).toHaveText("ダンパー");
  const xInput = inspector.getByRole("spinbutton", { name: "X", exact: true });
  const initialX = Number(await xInput.inputValue());
  await expect(canvas).toHaveScreenshot("catalog-damper.png");

  await page.mouse.move(box.x + placedAt.x, box.y + placedAt.y);
  await page.mouse.down();
  await page.mouse.move(box.x + placedAt.x + 60, box.y + placedAt.y + 40, { steps: 8 });
  await page.mouse.up();
  const movedX = Number(await xInput.inputValue());
  expect(movedX).toBeGreaterThan(initialX);

  await inspector.getByRole("button", { name: "ロック", exact: true }).click();
  const beforeLockedDrag = await xInput.inputValue();
  await page.mouse.move(box.x + placedAt.x + 60, box.y + placedAt.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + placedAt.x + 120, box.y + placedAt.y + 70, { steps: 8 });
  await page.mouse.up();
  await expect(xInput).toHaveValue(beforeLockedDrag);

  await expect(page.getByText("保存中…", { exact: true })).toBeVisible();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await page.reload();
  await expect(inspector.locator(".inspector-title strong")).toHaveText("ダンパー");
  await expect(inspector.getByRole("button", { name: "ロック解除", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "構造", exact: true }).click();
  const structurePart = page.getByRole("button", { name: "ダンパー c", exact: true });
  await expect(structurePart).toBeVisible();
  await structurePart.click();
  await page.getByRole("button", { name: "ダンパーをロック解除", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "ロック", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ダンパーを非表示", exact: true }).click();
  await expect(page.getByRole("button", { name: "ダンパーを表示", exact: true })).toBeVisible();
});

test("PHY-001: a textbook body can be placed, resized, rotated, moved, and restored", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  await librarySearch.fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");
  const placedAt = { x: 500, y: 490 };
  await canvas.click({ position: placedAt });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  const xInput = inspector.getByRole("spinbutton", { name: "X", exact: true });
  const initialX = Number(await xInput.inputValue());
  await inspector.getByRole("spinbutton", { name: "幅", exact: true }).fill("200");
  await inspector.getByRole("spinbutton", { name: "幅", exact: true }).press("Enter");
  await inspector.getByRole("spinbutton", { name: "高さ", exact: true }).fill("100");
  await inspector.getByRole("spinbutton", { name: "高さ", exact: true }).press("Enter");
  await inspector.getByRole("spinbutton", { name: "回転 °", exact: true }).fill("25");
  await inspector.getByRole("spinbutton", { name: "回転 °", exact: true }).press("Enter");
  await page.mouse.move(box.x + placedAt.x, box.y + placedAt.y);
  await page.mouse.down();
  await page.mouse.move(box.x + placedAt.x + 80, box.y + placedAt.y - 70, { steps: 8 });
  await page.mouse.up();
  expect(Number(await xInput.inputValue())).toBeGreaterThan(initialX);
  await expect(page.getByText("保存中…", { exact: true })).toBeVisible();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await expect(canvas).toHaveScreenshot("editable-textbook-body.png", { maxDiffPixels: 0 });

  await page.reload();
  await expect(inspector.getByRole("spinbutton", { name: "幅", exact: true })).toHaveValue("200");
  await expect(inspector.getByRole("spinbutton", { name: "高さ", exact: true })).toHaveValue("100");
  await expect(inspector.getByRole("spinbutton", { name: "回転 °", exact: true })).toHaveValue("25");
});

test("Catalog discovery: command search finds aliases and places the real component", async ({ page }) => {
  const command = page.getByPlaceholder("操作・部品を検索…");
  await command.fill("空気抵抗");
  const result = page.getByRole("button", { name: /^抗力を追加/ });
  await expect(result).toBeVisible();
  await result.click();

  await page.getByTestId("editor-canvas").click({ position: { x: 560, y: 250 } });
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await expect(inspector.locator(".inspector-title strong")).toHaveText("抗力");
  await expect(inspector.getByRole("textbox", { name: "ラベル", exact: true })).toHaveValue("D");
});

test("PHY-075: every standard component name and alias is discoverable and every kind is placeable", async ({ page }) => {
  test.setTimeout(120_000);
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  const canvas = page.getByTestId("editor-canvas");

  for (const item of PHYSICS_COMPONENT_CATALOG) {
    for (const query of [item.name, ...item.aliases]) {
      await librarySearch.fill(query);
      await expect(page.locator(".catalog-row").filter({ hasText: item.name }).first(), `${item.name} must be found by ${query}`).toBeVisible();
    }
  }

  for (const [index, item] of PHYSICS_COMPONENT_CATALOG.entries()) {
    await librarySearch.fill(item.name);
    await page.locator(".catalog-row").filter({ hasText: item.name }).first().click();
    await canvas.click({ position: { x: 70 + index % 11 * 55, y: 390 + Math.floor(index / 11) * 45 } });
  }

  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await expect(page.locator(".catalog-structure")).toHaveCount(PHYSICS_COMPONENT_CATALOG.length);
});

test("OUT-007/010: PPTX download is valid and keeps catalog parts as separate named objects", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  await librarySearch.fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await page.getByTestId("editor-canvas").click({ position: { x: 520, y: 490 } });

  await page.getByRole("button", { name: "出力", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /PowerPoint/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("PPTX download path is unavailable");
  const archive = await JSZip.loadAsync(await readFile(path));
  const slideXml = await archive.file("ppt/slides/slide1.xml")!.async("string");

  expect(download.suggestedFilename()).toBe("図1.pptx");
  expect(archive.file("ppt/presentation.xml")).not.toBeNull();
  expect(slideXml).toContain(":block");
  expect(slideXml).toContain(":label");
});

test("PHY-028/029: body suggestions create a foreground force that follows the body", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");

  await librarySearch.fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  const placedAt = { x: 500, y: 490 };
  await canvas.click({ position: placedAt });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  const suggestions = inspector.locator(".physics-candidates");
  for (const name of ["mg", "N", "f", "T", "F", "v", "a"]) await expect(suggestions.getByRole("button", { name, exact: true })).toBeVisible();
  await suggestions.getByRole("button", { name: "mg", exact: true }).click();
  await expect(inspector.getByLabel("ベクトルの作用対象")).not.toHaveValue("");
  await expect(inspector.getByLabel("変量記号")).toHaveValue("mg");
  await expect(canvas).toHaveScreenshot("referenced-gravity-created.png", { maxDiffPixels: 0 });

  await page.getByRole("tab", { name: "構造", exact: true }).click();
  const bodyRow = page.locator(".catalog-structure").getByRole("button", { name: "物体 m", exact: true });
  await bodyRow.click();
  await page.mouse.move(box.x + placedAt.x, box.y + placedAt.y);
  await page.mouse.down();
  await page.mouse.move(box.x + placedAt.x + 80, box.y + placedAt.y - 70, { steps: 8 });
  await page.mouse.up();
  await expect(canvas).toHaveScreenshot("referenced-gravity-followed.png", { maxDiffPixels: 0 });

  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await page.reload();
  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "重力 mg", exact: true })).toBeVisible();
});

test("PHY-019/020: variable edits sync between HUD and inspector as atomic history", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  await librarySearch.fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await page.getByTestId("editor-canvas").click({ position: { x: 520, y: 490 } });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.getByRole("button", { name: "ラベルを変量化", exact: true }).click();
  const inspectorSymbol = inspector.getByLabel("変量記号");
  const inspectorValue = inspector.getByLabel("変量値");
  const hudSymbol = page.getByLabel("HUD変量記号");
  const hudValue = page.getByLabel("HUD変量値");
  const undo = page.getByRole("button", { name: "元に戻す", exact: true });
  const redo = page.getByRole("button", { name: "やり直す", exact: true });

  await inspectorSymbol.fill("cancelled");
  await expect(hudSymbol).toHaveValue("cancelled");
  await inspectorSymbol.press("Escape");
  await expect(inspectorSymbol).toHaveValue("m");
  await expect(hudSymbol).toHaveValue("m");

  await inspectorSymbol.fill("M");
  await inspectorSymbol.press("Enter");
  await expect(hudSymbol).toHaveValue("M");
  await undo.click();
  await expect(inspectorSymbol).toHaveValue("m");
  await redo.click();
  await expect(inspectorSymbol).toHaveValue("M");

  await hudValue.fill("4");
  await expect(inspectorValue).toHaveValue("4");
  await hudValue.press("Enter");
  await undo.click();
  await expect(inspectorValue).toHaveValue("");
  await redo.click();
  await expect(inspectorValue).toHaveValue("4");
  await expect(page.getByTestId("editor-canvas")).toHaveScreenshot("variable-hud-inspector-sync.png", { maxDiffPixels: 0 });
});

test("PHY-008/068: a force supports symbol, magnitude, direction, and reversal", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  const canvas = page.getByTestId("editor-canvas");
  await librarySearch.fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await canvas.click({ position: { x: 520, y: 490 } });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.locator(".physics-candidates").getByRole("button", { name: "F", exact: true }).click();
  await inspector.getByLabel("変量記号").fill("P");
  await inspector.getByLabel("変量記号").press("Enter");
  await inspector.getByRole("spinbutton", { name: "幅", exact: true }).fill("180");
  await inspector.getByRole("spinbutton", { name: "幅", exact: true }).press("Enter");
  await inspector.getByRole("spinbutton", { name: "回転 °", exact: true }).fill("20");
  await inspector.getByRole("spinbutton", { name: "回転 °", exact: true }).press("Enter");
  await inspector.getByRole("button", { name: "反転", exact: true }).click();
  await expect(page.getByText("保存中…", { exact: true })).toBeVisible();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });

  await expect(inspector.getByLabel("変量記号")).toHaveValue("P");
  await expect(inspector.getByRole("spinbutton", { name: "幅", exact: true })).toHaveValue("180");
  await expect(inspector.getByRole("spinbutton", { name: "回転 °", exact: true })).toHaveValue("200");
  await expect(inspector.getByLabel("ベクトルの作用対象")).not.toHaveValue("");
  await expect(canvas).toHaveScreenshot("editable-reversed-force.png", { maxDiffPixels: 0 });

  await page.reload();
  await expect(inspector.getByLabel("変量記号")).toHaveValue("P");
  await expect(inspector.getByRole("spinbutton", { name: "回転 °", exact: true })).toHaveValue("200");
});

test("Semantic connection foundation: a string follows two targets and protects references", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");

  await librarySearch.fill("直方体");
  const blockTool = page.getByRole("button", { name: "物体 m", exact: true });
  await blockTool.click();
  await canvas.click({ position: { x: 350, y: 490 } });
  await blockTool.click();
  await canvas.click({ position: { x: 610, y: 490 } });

  await librarySearch.fill("軽い糸");
  await page.getByRole("button", { name: "糸 T", exact: true }).click();
  await canvas.click({ position: { x: 480, y: 440 } });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await expect(inspector.locator(".inspector-title strong")).toHaveText("糸");
  await inspector.getByLabel("接続の始点").selectOption({ index: 1 });
  await inspector.getByLabel("接続の終点").selectOption({ index: 2 });
  await expect(inspector.getByText("接続先の移動へ追従", { exact: true })).toBeVisible();
  await expect(canvas).toHaveScreenshot("semantic-string-connected.png");

  await page.getByRole("tab", { name: "構造", exact: true }).click();
  const structureBlocks = page.locator(".catalog-structure").getByRole("button", { name: "物体 m", exact: true });
  await expect(structureBlocks).toHaveCount(2);
  await structureBlocks.nth(0).click();
  await page.mouse.move(box.x + 350, box.y + 490);
  await page.mouse.down();
  await page.mouse.move(box.x + 410, box.y + 410, { steps: 8 });
  await page.mouse.up();
  await expect(canvas).toHaveScreenshot("semantic-string-followed.png");

  await inspector.getByRole("button", { name: "ラベルを変量化", exact: true }).click();
  await inspector.getByLabel("変量記号").fill("M");
  await inspector.getByLabel("変量値").fill("2");
  await inspector.getByLabel("変量単位").fill("kg");
  await expect(inspector.getByLabel("変量記号")).toHaveValue("M");
  await expect(page.getByText("保存中…", { exact: true })).toBeVisible();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });

  await inspector.getByRole("button", { name: "削除", exact: true }).click();
  const dependencyWarning = inspector.getByRole("alert");
  await expect(dependencyWarning).toContainText("参照中の部品です");
  await expect(dependencyWarning).toContainText("接続 1");
  await dependencyWarning.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dependencyWarning).toHaveCount(0);

  await page.reload();
  await expect(inspector.getByLabel("変量記号")).toHaveValue("M");
  await expect(inspector.getByLabel("変量値")).toHaveValue("2");
  await expect(inspector.getByLabel("変量単位")).toHaveValue("kg");
  await expect(page.getByTitle("参照中・右パネルで削除")).toBeDisabled();

  await inspector.getByRole("button", { name: "削除", exact: true }).click();
  const restoredWarning = inspector.getByRole("alert");
  await expect(restoredWarning).toContainText("接続 1");
  await expect(restoredWarning).toContainText("変量 1");
  await restoredWarning.getByRole("button", { name: "依存関係ごと削除", exact: true }).click();
  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "物体 m", exact: true })).toHaveCount(1);
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "糸 T", exact: true })).toHaveCount(0);
  await expect(page.getByText("保存中…", { exact: true })).toBeVisible();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await page.reload();
  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "物体 m", exact: true })).toHaveCount(1);
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "糸 T", exact: true })).toHaveCount(0);
});

test("PHY-005: a spring keeps two endpoints and exposes the spring constant", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");

  await librarySearch.fill("直方体");
  const blockTool = page.getByRole("button", { name: "物体 m", exact: true });
  await blockTool.click();
  await canvas.click({ position: { x: 330, y: 490 } });
  await blockTool.click();
  await canvas.click({ position: { x: 650, y: 490 } });

  await librarySearch.fill("スプリング");
  await page.getByRole("button", { name: "ばね k", exact: true }).click();
  await canvas.click({ position: { x: 490, y: 440 } });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.getByLabel("接続の始点").selectOption({ index: 1 });
  await inspector.getByLabel("接続の終点").selectOption({ index: 2 });
  await inspector.getByRole("button", { name: "ラベルを変量化", exact: true }).click();
  await expect(inspector.getByLabel("変量記号")).toHaveValue("k");
  await expect(inspector.getByLabel("変量単位")).toHaveValue("N/m");
  await expect(inspector.getByText("型 coefficient · 参照 1", { exact: true })).toBeVisible();
  await expect(canvas).toHaveScreenshot("semantic-spring-connected.png", { maxDiffPixels: 0 });

  await page.getByRole("tab", { name: "構造", exact: true }).click();
  const firstBlock = page.locator(".catalog-structure").getByRole("button", { name: "物体 m", exact: true }).first();
  await firstBlock.click();
  await page.mouse.move(box.x + 330, box.y + 490);
  await page.mouse.down();
  await page.mouse.move(box.x + 390, box.y + 400, { steps: 8 });
  await page.mouse.up();
  await expect(canvas).toHaveScreenshot("semantic-spring-followed.png", { maxDiffPixels: 0 });
});
