import { expect, test, type Page } from "@playwright/test";
import { createGeometry } from "../app/components/EditorCanvas";
import { INITIAL_SCENE } from "../app/lib/editor-types";
import { PHYSICS_COMPONENT_CATALOG } from "../app/lib/component-catalog";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { PNG } from "pngjs";

const browserErrors = new WeakMap<Page, string[]>();

async function openCleanEditor(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.locator(".physics-editor")).toHaveAttribute("data-hydrated", "true");
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
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await openCleanEditor(page);
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(50);
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test("SHL-001/003/019: editor shell contains only functional drawing controls", async ({ page }) => {
  await expect(page.getByRole("button", { name: "出力", exact: true })).toBeEnabled();
  await expect(page.getByPlaceholder("操作・部品を検索…")).toBeVisible();
  const bodyBox = await page.locator(".editor-body").boundingBox();
  const canvasBox = await page.getByTestId("editor-canvas").boundingBox();
  if (!bodyBox || !canvasBox) throw new Error("Editor shell geometry is unavailable");
  expect(canvasBox.width).toBeGreaterThan(bodyBox.width / 2);
  expect(canvasBox.height).toBeGreaterThan(bodyBox.height * .85);
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

  const x = page.getByRole("spinbutton", { name: "文字 X" });
  const y = page.getByRole("spinbutton", { name: "文字 Y" });
  await expect(x).not.toHaveValue("0");
  await expect(y).not.toHaveValue("0");
  const saved = { x: await x.inputValue(), y: await y.inputValue() };
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "文字 X" })).toHaveValue(saved.x);
  await expect(page.getByRole("spinbutton", { name: "文字 Y" })).toHaveValue(saved.y);
});

test("DIR-009: angle label theta can be dragged independently", async ({ page }) => {
  const { box, geometry } = await canvasGeometry(page);
  await dragCanvasPoint(page, box, geometry.anglePoint, { x: 34, y: -20 });

  const x = page.getByRole("spinbutton", { name: "文字 X" });
  const y = page.getByRole("spinbutton", { name: "文字 Y" });
  await expect(x).not.toHaveValue("0");
  await expect(y).not.toHaveValue("0");
  const saved = { x: await x.inputValue(), y: await y.inputValue() };
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "文字 X" })).toHaveValue(saved.x);
  await expect(page.getByRole("spinbutton", { name: "文字 Y" })).toHaveValue(saved.y);
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
  await expect(page.getByRole("contentinfo").getByRole("button", { name: "自由体図", exact: true })).toHaveAttribute("aria-current", "page");

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
  await page.keyboard.press(process.platform === "darwin" ? "Meta+B" : "Control+B");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Alt+B" : "Control+Alt+B");
  await expect(page.locator(".physics-editor")).toHaveClass(/density-compact/);
  await expect(page.getByText("110%", { exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "部品と図の構造" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "選択対象の設定" })).toHaveCount(0);
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });

  await page.reload();
  await expect(page.locator(".physics-editor")).toHaveClass(/density-compact/);
  await expect(page.getByText("110%", { exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "部品と図の構造" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "選択対象の設定" })).toHaveCount(0);
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

test("REL-007/008: add, move, edit, and delete round-trip while a new edit discards the old redo branch", async ({ page }) => {
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  const angle = inspector.getByRole("spinbutton", { name: "角度 °" });
  const undo = page.getByRole("button", { name: "元に戻す", exact: true });
  const redo = page.getByRole("button", { name: "やり直す", exact: true });

  await angle.fill("40");
  await angle.press("Enter");
  await undo.click();
  await expect(angle).toHaveValue("30");
  await expect(redo).toBeEnabled();
  await angle.fill("50");
  await angle.press("Enter");
  await expect(redo).toBeDisabled();

  await page.getByPlaceholder("部品を検索", { exact: true }).fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await page.getByTestId("editor-canvas").click({ position: { x: 620, y: 190 } });
  const xInput = inspector.getByRole("spinbutton", { name: "X", exact: true });
  const originalX = await xInput.inputValue();
  await xInput.fill("720");
  await xInput.press("Enter");
  await inspector.getByRole("button", { name: "削除", exact: true }).click();

  await page.getByRole("tab", { name: "構造", exact: true }).click();
  const blocks = page.locator(".catalog-structure").getByRole("button", { name: "物体 m", exact: true });
  await expect(blocks).toHaveCount(0);
  await undo.click();
  await expect(blocks).toHaveCount(1);
  await expect(xInput).toHaveValue("720");
  await undo.click();
  await expect(xInput).toHaveValue(originalX);
  await undo.click();
  await expect(blocks).toHaveCount(0);
  await redo.click();
  await expect(blocks).toHaveCount(1);
  await redo.click();
  await expect(xInput).toHaveValue("720");
  await redo.click();
  await expect(blocks).toHaveCount(0);
});

test("REL-009: a long drag is one history item regardless of pointermove count", async ({ page }) => {
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");
  await page.getByPlaceholder("部品を検索", { exact: true }).fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await canvas.click({ position: { x: 600, y: 180 } });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  const xInput = inspector.getByRole("spinbutton", { name: "X", exact: true });
  const originalX = await xInput.inputValue();
  await page.mouse.move(box.x + 600, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 780, box.y + 340, { steps: 40 });
  await page.mouse.up();
  const movedX = await xInput.inputValue();
  expect(movedX).not.toBe(originalX);

  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(xInput).toHaveValue(originalX);
  await page.getByRole("button", { name: "やり直す", exact: true }).click();
  await expect(xInput).toHaveValue(movedX);
});

test("REL-015: deterministic editing, command completion, and saving work offline", async ({ page, context }) => {
  await context.setOffline(true);
  try {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
    const commandSearch = page.getByPlaceholder("操作・部品を検索…");
    await commandSearch.fill("テキストを追加");
    await commandSearch.press("Enter");
    await page.getByTestId("editor-canvas").click({ position: { x: 640, y: 180 } });
    const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
    await expect(inspector.locator(".inspector-title strong")).toHaveText("テキスト");
    await inspector.getByRole("textbox", { name: "ラベル", exact: true }).fill("offline");
    await inspector.getByRole("textbox", { name: "ラベル", exact: true }).press("Enter");
    await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
    const stored = await page.evaluate(() => window.localStorage.getItem("physics-editor-workspace-v1"));
    expect(stored).toContain("offline");
  } finally {
    await context.setOffline(false);
  }
});

test("REL-016: an edit survives an immediate reload before the autosave debounce", async ({ page }) => {
  const angle = page.getByRole("spinbutton", { name: "角度 °" });
  await angle.fill("47");
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "角度 °" })).toHaveValue("47");
});

test("REL-017: a second tab detects an external update and never overwrites it silently", async ({ page, context }) => {
  await page.waitForTimeout(450);
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible();
  const secondPage = await context.newPage();
  await secondPage.goto("/");
  await expect(secondPage.getByRole("banner")).toBeVisible();
  await secondPage.waitForTimeout(450);
  await expect(secondPage.getByText("保存済み", { exact: true })).toBeVisible();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible();

  const firstAngle = page.getByRole("spinbutton", { name: "角度 °" });
  await firstAngle.fill("37");
  await firstAngle.press("Enter");
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await expect(secondPage.getByRole("alert")).toContainText("別のタブで図が更新されました");

  const secondAngle = secondPage.getByRole("spinbutton", { name: "角度 °" });
  await secondAngle.fill("42");
  await secondAngle.press("Enter");
  await expect(secondPage.getByText("保存できません", { exact: true })).toBeVisible({ timeout: 2_000 });
  const persistedAngle = await page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem("physics-editor-workspace-v1") ?? "{}") as { pages?: Array<{ scene?: { angle?: number } }> };
    return stored.pages?.[0]?.scene?.angle;
  });
  expect(persistedAngle).toBe(37);

  await secondPage.reload();
  await expect(secondPage.getByRole("spinbutton", { name: "角度 °" })).toHaveValue("37");
  await secondPage.close();
});

test("REL-018: successful UI operations create real document data and a real export", async ({ page }) => {
  await page.getByPlaceholder("部品を検索", { exact: true }).fill("テキスト");
  await page.getByRole("button", { name: "テキスト 注記", exact: true }).click();
  await page.getByTestId("editor-canvas").click({ position: { x: 620, y: 180 } });
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.getByRole("textbox", { name: "ラベル", exact: true }).fill("real-document-state");
  await inspector.getByRole("textbox", { name: "ラベル", exact: true }).press("Enter");
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });

  const storedElement = await page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem("physics-editor-workspace-v1") ?? "{}") as { pages?: Array<{ scene?: { elements?: Array<{ label?: string }> } }> };
    return stored.pages?.[0]?.scene?.elements?.find((element) => element.label === "real-document-state") ?? null;
  });
  expect(storedElement).not.toBeNull();

  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await dialog.getByLabel("出力形式").selectOption("svg");
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("Real SVG export is unavailable");
  expect(await readFile(path, "utf8")).toContain("real-document-state");
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

test("INS-001/003/006: incline HUD exposes its value and exactly three real quick actions", async ({ page }) => {
  const hud = page.locator(".selection-hud");
  await expect(hud).toBeVisible();
  await expect(hud.getByRole("spinbutton", { name: "θ °" })).toHaveValue("30");
  await expect(hud.getByRole("button")).toHaveCount(3);
  await expect(hud.getByTitle("左右反転")).toBeEnabled();
  await expect(hud.getByTitle("角度拘束")).toBeEnabled();
  await expect(hud.getByTitle("位置をリセット")).toBeEnabled();

  await hud.getByTitle("角度拘束").click();
  await expect(hud.getByTitle("角度拘束")).toHaveClass(/active/);
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await page.reload();
  await expect(page.locator(".selection-hud").getByTitle("角度拘束")).toHaveClass(/active/);
});

test("INS-004: body HUD offers force, contact, and real free-body actions without overflow", async ({ page }) => {
  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  const hud = page.locator(".selection-hud");
  await expect(hud.getByRole("textbox", { name: "質量" })).toHaveValue("m");
  await expect(hud.getByRole("button")).toHaveCount(3);
  await expect(hud.getByTitle("力を追加")).toBeEnabled();
  await expect(hud.getByTitle("接触制約")).toBeEnabled();
  await hud.getByTitle("自由体図").click();
  await expect(page.getByRole("contentinfo").getByRole("button", { name: "自由体図", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".selection-hud").getByRole("textbox", { name: "質量" })).toHaveValue("m");
});

test("INS-005/006 and PHY-034: vector HUD reverses and creates editable shared components", async ({ page }) => {
  const canvas = page.getByTestId("editor-canvas");
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await page.getByPlaceholder("部品を検索", { exact: true }).fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await canvas.click({ position: { x: 580, y: 360 } });
  await inspector.getByRole("button", { name: "F", exact: true }).click();

  const hud = page.locator(".selection-hud");
  await expect(hud.getByRole("button")).toHaveCount(3);
  await expect(hud.getByTitle("反転")).toBeEnabled();
  await expect(hud.getByTitle("成分分解")).toBeEnabled();
  await hud.getByTitle("反転").click();
  await expect(inspector.getByRole("spinbutton", { name: "回転 °", exact: true })).toHaveValue("180");
  await hud.getByTitle("成分分解").click();
  await expect(hud.getByTitle("成分分解済み")).toBeDisabled();
  await expect(inspector.getByText("型 vector · 参照 3", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "一般力 Fₓ", exact: true })).toHaveCount(1);
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "一般力 Fᵧ", exact: true })).toHaveCount(1);
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  const decomposition = await page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem("physics-editor-workspace-v1") ?? "{}") as { pages?: Array<{ scene?: { constraints?: Array<{ kind?: string; targetIds?: string[] }> } }> };
    return stored.pages?.[0]?.scene?.constraints?.find((constraint) => constraint.kind === "same-variable");
  });
  expect(decomposition?.targetIds).toHaveLength(3);
});

test("INS-009/015/017/018: inspector adapts, preserves sections, previews appearance, and closes safely after deletion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const canvas = page.getByTestId("editor-canvas");
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.getByRole("button", { name: "制約", exact: true }).click();
  await expect(inspector.getByRole("button", { name: "制約", exact: true })).toHaveAttribute("aria-expanded", "false");

  await page.getByPlaceholder("部品を検索", { exact: true }).fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await canvas.click({ position: { x: 620, y: 180 } });
  await expect(inspector.locator(".inspector-title strong")).toHaveText("物体");
  await expect(inspector.getByRole("button", { name: "寸法・値", exact: true })).toHaveCount(1);
  await expect(inspector.getByRole("button", { name: "変量", exact: true })).toHaveCount(1);
  await expect(inspector.getByRole("button", { name: "制約", exact: true })).toHaveAttribute("aria-expanded", "false");

  await inspector.getByRole("button", { name: "外観", exact: true }).click();
  const before = await canvas.screenshot();
  const lineWidth = inspector.getByRole("spinbutton", { name: "線幅", exact: true });
  await lineWidth.fill("6");
  const preview = await canvas.screenshot();
  expect(preview.equals(before)).toBe(false);
  await lineWidth.press("Enter");

  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await dialog.getByLabel("出力形式").selectOption("svg");
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error("Appearance preview SVG is unavailable");
  expect(await readFile(path, "utf8")).toContain('stroke-width="6"');

  await inspector.getByRole("button", { name: "削除", exact: true }).click();
  await expect(page.locator(".selection-hud")).toHaveCount(0);
  await expect(inspector.locator(".inspector-title strong")).toHaveText("選択なし");
  expect(errors).toEqual([]);
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

test("DIR-002/PHY-013/REL-013: a component selection places exactly one real component after rerenders", async ({ page }) => {
  await page.getByPlaceholder("部品を検索", { exact: true }).fill("テキスト");
  await page.getByRole("button", { name: "テキスト 注記", exact: true }).click();
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Editor canvas has no bounding box");
  await canvas.click({ position: { x: box.width * 0.72, y: box.height * 0.2 } });

  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await expect(inspector.locator(".inspector-title strong")).toHaveText("テキスト");
  await expect(inspector.getByRole("textbox", { name: "ラベル", exact: true })).toHaveValue("注記");
  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "テキスト 注記", exact: true })).toHaveCount(1);
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

test("PHY-002/047: smooth and rough floor, wall, and incline are independent editable physics parts", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  const canvas = page.getByTestId("editor-canvas");
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });

  await librarySearch.fill("滑らかな壁");
  await page.locator(".catalog-row").filter({ hasText: "滑らかな壁" }).click();
  await canvas.click({ position: { x: 170, y: 180 } });
  await expect(inspector.locator(".inspector-title strong")).toHaveText("滑らかな壁");
  await expect(inspector.getByRole("button", { name: "N", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "f", exact: true })).toHaveCount(0);
  await expect(inspector.getByText("法線候補・摩擦なし", { exact: true })).toBeVisible();

  await inspector.getByRole("combobox", { name: "部品面の粗さ", exact: true }).selectOption("rough");
  await expect(inspector.locator(".inspector-title strong")).toHaveText("粗い壁");
  await expect(inspector.getByRole("button", { name: "f", exact: true })).toBeVisible();
  await expect(inspector.getByText("法線・摩擦・μ候補", { exact: true })).toBeVisible();
  await inspector.getByRole("combobox", { name: "部品面の向き", exact: true }).selectOption("incline");
  await expect(inspector.locator(".inspector-title strong")).toHaveText("粗い斜面");
  await expect(inspector.getByRole("spinbutton", { name: "回転 °", exact: true })).toHaveValue("-30");
  await inspector.getByRole("spinbutton", { name: "幅", exact: true }).fill("235");
  await inspector.getByRole("spinbutton", { name: "幅", exact: true }).press("Enter");
  await inspector.getByRole("spinbutton", { name: "回転 °", exact: true }).fill("-24");
  await inspector.getByRole("spinbutton", { name: "回転 °", exact: true }).press("Enter");
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await page.reload();
  await expect(inspector.locator(".inspector-title strong")).toHaveText("粗い斜面");
  await expect(inspector.getByRole("spinbutton", { name: "幅", exact: true })).toHaveValue("235");
  await expect(inspector.getByRole("spinbutton", { name: "回転 °", exact: true })).toHaveValue("-24");

  await page.getByRole("button", { name: "図を追加", exact: true }).click();
  const surfaces = [
    { name: "滑らかな床", position: { x: 180, y: 130 } },
    { name: "粗い床", position: { x: 470, y: 130 } },
    { name: "滑らかな壁", position: { x: 145, y: 330 } },
    { name: "粗い壁", position: { x: 300, y: 330 } },
    { name: "滑らかな斜面", position: { x: 485, y: 290 } },
    { name: "粗い斜面", position: { x: 485, y: 410 } },
  ];
  for (const { name, position } of surfaces) {
    await librarySearch.fill(name);
    await page.locator(".catalog-row").filter({ hasText: name }).click();
    await canvas.click({ position });
  }
  await canvas.click({ position: { x: 650, y: 540 } });
  await expect(canvas).toHaveScreenshot("catalog-contact-surfaces.png", { maxDiffPixels: 0 });
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
    await canvas.click({ position: { x: 55 + index % 12 * 52, y: 210 + Math.floor(index / 12) % 4 * 70 } });
  }

  await page.getByRole("tab", { name: "構造", exact: true }).click();
  await expect(page.locator(".catalog-structure")).toHaveCount(PHYSICS_COMPONENT_CATALOG.length);
});

test("PHY-054/072: disk, cylinder, and rotational quantities are distinct editable physics parts", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  const canvas = page.getByTestId("editor-canvas");
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });

  await page.getByRole("button", { name: "図を追加", exact: true }).click();
  await librarySearch.fill("円板");
  await page.locator(".catalog-row").filter({ hasText: "円板" }).click();
  await canvas.click({ position: { x: 240, y: 280 } });
  await expect(inspector.locator(".inspector-title strong")).toHaveText("円板");
  await expect(inspector.getByRole("button", { name: "F", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "M", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "ω", exact: true })).toBeVisible();
  await expect(inspector.getByRole("button", { name: "α", exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "ω", exact: true }).click();
  await expect(inspector.locator(".inspector-title strong")).toHaveText("角速度");
  await expect(inspector.getByRole("combobox", { name: "ベクトルの作用対象", exact: true })).not.toHaveValue("");

  await librarySearch.fill("円柱");
  await page.locator(".catalog-row").filter({ hasText: "円柱" }).click();
  await canvas.click({ position: { x: 500, y: 280 } });
  await expect(inspector.locator(".inspector-title strong")).toHaveText("円柱");
  await expect(inspector.getByRole("button", { name: "α", exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "α", exact: true }).click();
  await expect(inspector.locator(".inspector-title strong")).toHaveText("角加速度");
  await expect(inspector.getByRole("combobox", { name: "ベクトルの作用対象", exact: true })).not.toHaveValue("");

  await canvas.click({ position: { x: 650, y: 470 } });
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible({ timeout: 2_000 });
  await page.reload();
  await expect(page.locator(".physics-editor")).toHaveAttribute("data-hydrated", "true");
  await expect(canvas).toHaveScreenshot("catalog-rotational-parts.png", { maxDiffPixels: 0 });
});

test("OUT-007/010: PPTX download is valid and keeps catalog parts as separate named objects", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  await librarySearch.fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await page.getByTestId("editor-canvas").click({ position: { x: 520, y: 490 } });

  await page.getByRole("button", { name: "出力", exact: true }).click();
  const exportDialog = page.getByRole("dialog", { name: "出力設定" });
  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "出力", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs("test-results/powerpoint-verification.pptx");
  const path = await download.path();
  if (!path) throw new Error("PPTX download path is unavailable");
  const archive = await JSZip.loadAsync(await readFile(path));
  const slideXml = await archive.file("ppt/slides/slide1.xml")!.async("string");

  expect(download.suggestedFilename()).toBe("図1.pptx");
  expect(archive.file("ppt/presentation.xml")).not.toBeNull();
  expect(slideXml).toContain(":block");
  expect(slideXml).toContain(":label");
});

test("OUT-004: SVG copy places a complete editable SVG on the clipboard", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await dialog.getByLabel("出力形式").selectOption("svg");
  await dialog.getByRole("button", { name: "SVGをコピー", exact: true }).click();
  await expect(page.getByText("SVGをクリップボードへコピーしました", { exact: true })).toBeVisible();
  if (browserName === "chromium") {
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(copied).toContain('data-layer="structure"');
    expect(copied).toContain('data-layer="vector"');
    expect(copied).toContain(">θ</text>");
  }
});

test("OUT-002/003/005/006/011/012/013: output settings change the generated files", async ({ page }) => {
  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await expect(dialog.getByLabel("出力形式")).toHaveValue("pptx");
  await expect(dialog.getByLabel("出力範囲")).toHaveValue("current");
  await expect(dialog.getByLabel("出力背景")).toHaveValue("white");
  await expect(dialog.getByLabel("出力余白")).toHaveValue("24");

  await dialog.getByLabel("出力形式").selectOption("svg");
  await dialog.getByLabel("出力範囲").selectOption("selection");
  await dialog.getByLabel("出力背景").selectOption("transparent");
  await dialog.getByLabel("出力余白").fill("32");
  const svgDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const svgDownload = await svgDownloadPromise;
  const svgPath = await svgDownload.path();
  if (!svgPath) throw new Error("SVG download path is unavailable");
  const svg = await readFile(svgPath, "utf8");
  expect(svgDownload.suggestedFilename()).toBe("図1.svg");
  expect(svg).toContain('width="964" height="624" viewBox="-32 -32 964 624"');
  expect(svg).not.toContain('data-layer="paper"');
  expect(svg).toContain('data-layer="structure"');
  expect(svg).not.toContain('data-layer="object"');

  await page.getByRole("button", { name: "出力", exact: true }).click();
  await dialog.getByLabel("出力形式").selectOption("png");
  await dialog.getByLabel("出力範囲").selectOption("current");
  await dialog.getByLabel("出力背景").selectOption("transparent");
  await dialog.getByLabel("出力余白").fill("10");
  const pngDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const pngPath = await (await pngDownloadPromise).path();
  if (!pngPath) throw new Error("PNG download path is unavailable");
  const png = await readFile(pngPath);
  expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1840);
  expect(png.readUInt32BE(20)).toBe(1160);
  const decodedPng = PNG.sync.read(png);
  expect(decodedPng.data[3]).toBe(0);

  await page.getByRole("button", { name: "出力", exact: true }).click();
  await dialog.getByLabel("出力形式").selectOption("pdf");
  await dialog.getByLabel("出力範囲").selectOption("all");
  const pdfDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const pdfPath = await (await pdfDownloadPromise).path();
  if (!pdfPath) throw new Error("PDF download path is unavailable");
  const pdf = await readFile(pdfPath);
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdf.toString("latin1")).toContain("/Count 2");
  expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");

  await page.getByRole("button", { name: "出力", exact: true }).click();
  await dialog.getByLabel("出力形式").selectOption("pptx");
  await dialog.getByLabel("出力範囲").selectOption("all");
  const pptxDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const pptxPath = await (await pptxDownloadPromise).path();
  if (!pptxPath) throw new Error("PPTX download path is unavailable");
  const pptxArchive = await JSZip.loadAsync(await readFile(pptxPath));
  expect(pptxArchive.file("ppt/slides/slide1.xml")).not.toBeNull();
  expect(pptxArchive.file("ppt/slides/slide2.xml")).not.toBeNull();
});

test("OUT-014/019/020/021: automatic quality warnings identify and focus their target", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  await librarySearch.fill("直方体");
  const blockTool = page.getByRole("button", { name: "物体 m", exact: true });
  await blockTool.click();
  await page.getByTestId("editor-canvas").click({ position: { x: 520, y: 300 } });
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.getByRole("spinbutton", { name: "X", exact: true }).fill("930");
  await inspector.getByRole("spinbutton", { name: "X", exact: true }).press("Enter");
  await inspector.getByRole("spinbutton", { name: "Y", exact: true }).fill("200");
  await inspector.getByRole("spinbutton", { name: "Y", exact: true }).press("Enter");
  await blockTool.click();
  await page.getByTestId("editor-canvas").click({ position: { x: 600, y: 300 } });
  await inspector.getByRole("spinbutton", { name: "X", exact: true }).fill("930");
  await inspector.getByRole("spinbutton", { name: "X", exact: true }).press("Enter");
  await inspector.getByRole("spinbutton", { name: "Y", exact: true }).fill("200");
  await inspector.getByRole("spinbutton", { name: "Y", exact: true }).press("Enter");

  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await expect(dialog.getByText(/件の確認事項/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: /部品ラベルが重なっています/ })).toBeVisible();
  await expect(dialog.getByText(/が用紙外にあります/).first()).toBeVisible();
  await dialog.getByRole("button", { name: /部品ラベルが重なっています/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(inspector.locator(".inspector-title strong")).toHaveText("物体");
});

test("OUT-015/016/017/018: quality inspection identifies constraint, variable, text, and line targets", async ({ page }) => {
  const librarySearch = page.getByPlaceholder("部品を検索", { exact: true });
  const canvas = page.getByTestId("editor-canvas");
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });

  await librarySearch.fill("直方体");
  await page.getByRole("button", { name: "物体 m", exact: true }).click();
  await canvas.click({ position: { x: 500, y: 420 } });
  await inspector.getByRole("button", { name: "ラベルを変量化", exact: true }).click();
  await inspector.getByLabel("変量記号").fill("");
  await inspector.getByLabel("変量記号").press("Enter");

  await librarySearch.fill("軽い糸");
  await page.getByRole("button", { name: "糸 T", exact: true }).click();
  await canvas.click({ position: { x: 600, y: 360 } });
  await inspector.getByLabel("接続の始点").selectOption({ index: 1 });
  await inspector.getByLabel("接続の終点").selectOption({ index: 1 });
  await expect(inspector.getByRole("alert")).toContainText("始点と終点が同じです");

  await inspector.getByRole("button", { name: "外観", exact: true }).click();
  await inspector.getByRole("spinbutton", { name: "文字サイズ", exact: true }).fill("9");
  await inspector.getByRole("spinbutton", { name: "文字サイズ", exact: true }).press("Enter");
  await inspector.getByRole("spinbutton", { name: "線幅", exact: true }).fill("0.4");
  await inspector.getByRole("spinbutton", { name: "線幅", exact: true }).press("Enter");

  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await expect(dialog.getByRole("button", { name: /始点と終点が同じです/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /未定義の変量・参照/ }).first()).toBeVisible();
  await expect(dialog.getByRole("button", { name: /文字が小さすぎます/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /線が細すぎます/ })).toBeVisible();
  await dialog.getByRole("button", { name: /線が細すぎます/ }).click();
  await expect(inspector.locator(".inspector-title strong")).toHaveText("糸");
});

test("OUT-022: a generation failure stays visible and can be retried", async ({ page }) => {
  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await dialog.getByLabel("出力形式").selectOption("svg");
  await page.evaluate(() => {
    const runtime = window as typeof window & { __originalCreateObjectURL?: typeof URL.createObjectURL };
    runtime.__originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => { throw new Error("テスト用の生成失敗"); };
  });
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("テスト用の生成失敗");
  await expect(dialog.getByRole("button", { name: "出力", exact: true })).toBeEnabled();

  await page.evaluate(() => {
    const runtime = window as typeof window & { __originalCreateObjectURL?: typeof URL.createObjectURL };
    if (runtime.__originalCreateObjectURL) URL.createObjectURL = runtime.__originalCreateObjectURL;
  });
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  await downloadPromise;
  await expect(dialog).toHaveCount(0);
});

test("OUT-023: exporting never mutates the document selection or history", async ({ page }) => {
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  const angle = inspector.getByRole("spinbutton", { name: "角度 °" });
  const undo = page.getByRole("button", { name: "元に戻す", exact: true });
  await angle.fill("38");
  await angle.press("Enter");
  await expect(undo).toBeEnabled();

  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await dialog.getByLabel("出力形式").selectOption("svg");
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  await downloadPromise;

  await expect(angle).toHaveValue("38");
  await expect(inspector.locator(".inspector-title strong")).toHaveText("粗い斜面");
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(angle).toHaveValue("30");
});

test("OUT-024: math symbols survive SVG, PNG, PDF, and PPTX output", async ({ page }) => {
  const mathLabel = "θ₁ = ω²t · m/s²";
  await page.getByPlaceholder("部品を検索", { exact: true }).fill("テキスト");
  await page.getByRole("button", { name: "テキスト 注記", exact: true }).click();
  await page.getByTestId("editor-canvas").click({ position: { x: 560, y: 180 } });
  const inspector = page.getByRole("complementary", { name: "選択対象の設定" });
  await inspector.getByRole("textbox", { name: "ラベル", exact: true }).fill(mathLabel);
  await inspector.getByRole("textbox", { name: "ラベル", exact: true }).press("Enter");

  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await dialog.getByLabel("出力形式").selectOption("svg");
  const svgDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const svgPath = await (await svgDownloadPromise).path();
  if (!svgPath) throw new Error("SVG math output is unavailable");
  expect(await readFile(svgPath, "utf8")).toContain(mathLabel);

  await page.getByRole("button", { name: "出力", exact: true }).click();
  await dialog.getByLabel("出力形式").selectOption("png");
  const pngDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const pngPath = await (await pngDownloadPromise).path();
  if (!pngPath) throw new Error("PNG math output is unavailable");
  const mathPng = PNG.sync.read(await readFile(pngPath));
  expect(mathPng.data.some((channel, index) => index % 4 !== 3 && channel < 200)).toBe(true);

  await page.getByRole("button", { name: "出力", exact: true }).click();
  await dialog.getByLabel("出力形式").selectOption("pdf");
  const pdfDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const pdfPath = await (await pdfDownloadPromise).path();
  if (!pdfPath) throw new Error("PDF math output is unavailable");
  const mathPdfHex = (await readFile(pdfPath)).toString("hex");
  for (const utf16Code of ["03b8", "2081", "03c9", "00b2"]) expect(mathPdfHex).toContain(utf16Code);

  await page.getByRole("button", { name: "出力", exact: true }).click();
  await dialog.getByLabel("出力形式").selectOption("pptx");
  const pptxDownloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  const pptxPath = await (await pptxDownloadPromise).path();
  if (!pptxPath) throw new Error("PPTX math output is unavailable");
  const archive = await JSZip.loadAsync(await readFile(pptxPath));
  expect(await archive.file("ppt/slides/slide1.xml")!.async("string")).toContain(mathLabel);
});

test("OUT-025: empty pages are explained and never downloaded", async ({ page }) => {
  await page.getByRole("button", { name: "図を追加", exact: true }).click();
  await page.getByRole("button", { name: "出力", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "出力設定" });
  await expect(dialog.getByText("出力できる部品がありません", { exact: true })).toBeVisible();
  let downloaded = false;
  page.once("download", () => { downloaded = true; });
  await dialog.getByRole("button", { name: "出力", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("空の図は出力できません");
  expect(downloaded).toBe(false);
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

test("PHY-004/022/038 and REL-012: a string follows two targets and dependency deletion round-trips", async ({ page }) => {
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
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await expect(page.locator(".catalog-structure").getByRole("button", { name: /^物体 (M|m)$/ })).toHaveCount(2);
  await expect(page.locator(".catalog-structure").getByRole("button", { name: "糸 T", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "やり直す", exact: true }).click();
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

test("ISSUE-011: template apply and bulk force HUD add elements", async ({ page }) => {
  await openCleanEditor(page);
  await page.getByRole("button", { name: "スキップ", exact: true }).click().catch(() => {});
  await page.getByRole("button", { name: /テンプレートを開く/ }).click();
  await page.getByRole("dialog", { name: "テンプレート" }).getByRole("button", { name: /粗い斜面上の物体/ }).click();
  await page.getByRole("tab", { name: "構造", exact: true }).click();
  const blockRow = page.locator(".catalog-structure").filter({ hasText: "物体" }).first();
  await expect(blockRow).toBeVisible({ timeout: 10000 });
  await blockRow.click();
  const bulkBtn = page.getByRole("button", { name: "力を全部", exact: true });
  await expect(bulkBtn).toBeVisible();
  await bulkBtn.click();
  await expect(page.locator(".catalog-structure").filter({ hasText: "重力" })).toBeVisible({ timeout: 5000 });
});
