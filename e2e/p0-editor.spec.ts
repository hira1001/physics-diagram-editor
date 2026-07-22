import { expect, test, type Page } from "@playwright/test";
import { createGeometry } from "../app/components/EditorCanvas";
import { INITIAL_SCENE } from "../app/lib/editor-types";

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

  await page.getByRole("button", { name: "テンプレートを開く 4", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "テンプレート" })).toBeVisible();
  await page.getByRole("button", { name: "斜面上の物体 斜面・物体・基本3力 θ / m / mg / N / f", exact: true }).click();
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
