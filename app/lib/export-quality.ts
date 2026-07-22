import type { DiagramPage, SceneState, SelectionId } from "@/app/lib/editor-types";
import { validateModelReferences } from "@/app/lib/diagram-model";
import { hasSurfaceConflict } from "@/app/lib/physics-rules";

export type ExportQualityCode =
  | "constraint-conflict"
  | "empty-document"
  | "label-overlap"
  | "model-reference"
  | "outside-paper"
  | "small-text"
  | "surface-conflict"
  | "thin-line";

export interface ExportQualityIssue {
  code: ExportQualityCode;
  message: string;
  pageId: string;
  severity: "error" | "warning";
  targetId: SelectionId;
}

const PAPER_WIDTH = 900;
const PAPER_HEIGHT = 560;
const FILL_ONLY_KINDS = new Set(["point-mass", "point-label", "text"]);

function labelBounds(scene: SceneState) {
  return scene.elements
    .filter((element) => element.visible && element.label.trim())
    .map((element) => ({
      id: element.id,
      left: element.x - Math.max(18, element.label.length * element.fontSize * .35),
      right: element.x + Math.max(18, element.label.length * element.fontSize * .35),
      top: element.y - element.height / 2 - element.fontSize - 7,
      bottom: element.y - element.height / 2 - 5,
    }));
}

function overlaps(left: ReturnType<typeof labelBounds>[number], right: ReturnType<typeof labelBounds>[number]) {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

export function inspectPageQuality(page: DiagramPage): ExportQualityIssue[] {
  const issues: ExportQualityIssue[] = [];
  const scene = page.scene;

  if (page.kind === "blank" && scene.elements.length === 0) {
    issues.push({ code: "empty-document", message: "出力できる部品がありません", pageId: page.id, severity: "error", targetId: null });
    return issues;
  }

  if (hasSurfaceConflict(scene)) {
    issues.push({ code: "surface-conflict", message: "滑らかな面に摩擦力が残っています", pageId: page.id, severity: "warning", targetId: "force-friction" });
  }

  for (const constraint of scene.constraints.filter((item) => item.enabled && item.conflict)) {
    const targetId = constraint.targetIds[0];
    issues.push({
      code: "constraint-conflict",
      message: constraint.conflict ?? "制約が競合しています",
      pageId: page.id,
      severity: "error",
      targetId: targetId && scene.elements.some((item) => item.id === targetId) ? `element:${targetId}` : (targetId as SelectionId ?? null),
    });
  }

  for (const error of validateModelReferences(scene.elements, scene.variables, scene.constraints)) {
    const sourceId = error.split(":")[0];
    const sourceVariable = scene.variables.find((item) => item.id === sourceId);
    const referenceId = sourceVariable?.referenceIds.find((id) => scene.elements.some((element) => element.id === id));
    issues.push({
      code: "model-reference",
      message: `未定義の変量・参照: ${error}`,
      pageId: page.id,
      severity: "error",
      targetId: scene.elements.some((item) => item.id === sourceId) ? `element:${sourceId}` : referenceId ? `element:${referenceId}` : null,
    });
  }

  for (const element of scene.elements.filter((item) => item.visible)) {
    if (element.label.trim() && element.fontSize < 12) {
      issues.push({ code: "small-text", message: `${element.label}の文字が小さすぎます（12px以上を推奨）`, pageId: page.id, severity: "warning", targetId: `element:${element.id}` });
    }
    if (!FILL_ONLY_KINDS.has(element.kind) && element.lineWidth < .75) {
      issues.push({ code: "thin-line", message: `${element.label || "部品"}の線が細すぎます（0.75px以上を推奨）`, pageId: page.id, severity: "warning", targetId: `element:${element.id}` });
    }
    const halfWidth = Math.max(4, element.width / 2);
    const halfHeight = Math.max(4, element.height / 2);
    if (element.x - halfWidth < 0 || element.y - halfHeight < 0 || element.x + halfWidth > PAPER_WIDTH || element.y + halfHeight > PAPER_HEIGHT) {
      issues.push({ code: "outside-paper", message: `${element.label || "部品"}が用紙外にあります`, pageId: page.id, severity: "warning", targetId: `element:${element.id}` });
    }
  }

  const labels = labelBounds(scene);
  const reported = new Set<string>();
  for (let leftIndex = 0; leftIndex < labels.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < labels.length; rightIndex += 1) {
      const left = labels[leftIndex];
      const right = labels[rightIndex];
      if (!overlaps(left, right)) continue;
      const key = [left.id, right.id].sort().join(":");
      if (reported.has(key)) continue;
      reported.add(key);
      issues.push({ code: "label-overlap", message: "部品ラベルが重なっています", pageId: page.id, severity: "warning", targetId: `element:${right.id}` });
    }
  }

  return issues;
}

export function inspectExportQuality(pages: readonly DiagramPage[]) {
  return pages.flatMap(inspectPageQuality);
}
