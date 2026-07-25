"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Grid3X3,
  Layers3,
  Maximize2,
  Minus,
  Plus,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { CommandPalette, type EditorCommandItem } from "@/app/components/CommandPalette";
import { EditorCanvas } from "@/app/components/EditorCanvas";
import { InspectorPanel } from "@/app/components/InspectorPanel";
import { LibraryPanel } from "@/app/components/LibraryPanel";
import { TemplateDialog } from "@/app/components/TemplateDialog";
import { TopBar } from "@/app/components/TopBar";
import {
  INITIAL_SCENE,
  INITIAL_WORKSPACE,
  type DiagramElement,
  type DiagramPage,
  type SceneState,
  type TemplateId,
  type ToolId,
  type WorkspaceState,
} from "@/app/lib/editor-types";
import { sceneToSvg } from "@/app/lib/scene-export";
import { svgToPngBlob, svgsToPdfBlob } from "@/app/lib/browser-export";
import { inspectExportQuality } from "@/app/lib/export-quality";
import { DEFAULT_EXPORT_SETTINGS, type ExportSettings } from "@/app/lib/export-types";
import { addCatalogElementsToPptx } from "@/app/lib/catalog-pptx";
import { restoreWorkspace, serializeWorkspace, WORKSPACE_STORAGE_KEY } from "@/app/lib/workspace-storage";
import { removeElementWithDependencies } from "@/app/lib/diagram-model";
import { writeTextToClipboard } from "@/app/lib/clipboard";
import { blockRotationDegrees, effectiveSurfaceAngle, surfaceContactClearance, surfacePlacementPatch, surfacePresetForTool, type SurfacePreset } from "@/app/lib/physics-rules";
import { componentToolId, PHYSICS_COMPONENT_CATALOG } from "@/app/lib/component-catalog";
import { buildTemplateScene } from "@/app/lib/template-builder";

type LibraryTab = "add" | "structure";
type Flyout = "export" | "menu" | null;

function cloneWorkspace(workspace: WorkspaceState): WorkspaceState {
  return JSON.parse(JSON.stringify(workspace)) as WorkspaceState;
}

function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
}

function exportScene(scene: SceneState, settings: ExportSettings) {
  return sceneToSvg(scene, {
    background: settings.background,
    margin: settings.margin,
    selectedId: settings.range === "selection" ? scene.selectedId : null,
  });
}

function selectedCatalogElements(scene: SceneState) {
  const selectedId = scene.selectedId?.startsWith("element:") ? scene.selectedId.slice("element:".length) : null;
  return selectedId ? scene.elements.filter((element) => element.id === selectedId) : scene.elements;
}

function canonicalWorkspaceStorage(raw: string | null) {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { pages?: unknown }).pages)) return `invalid:${raw}`;
    return serializeWorkspace(restoreWorkspace(raw).workspace);
  } catch {
    return `invalid:${raw}`;
  }
}

function storageValuesMatch(left: string | null, right: string | null) {
  return left === right || canonicalWorkspaceStorage(left) === canonicalWorkspaceStorage(right);
}

export function PhysicsEditor() {
  const clipboardRef = useRef<DiagramElement[] | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState>(INITIAL_WORKSPACE);
  const workspaceRef = useRef(workspace);
  const lastPersistedRawRef = useRef<string | null>(null);
  const [undoStack, setUndoStack] = useState<WorkspaceState[]>([]);
  const [redoStack, setRedoStack] = useState<WorkspaceState[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("add");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [commandQuery, setCommandQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  const [saveStatus, setSaveStatus] = useState<"error" | "saved" | "saving">("saved");
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(true);
  const [tourStep, setTourStep] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editorRootRef = useRef<HTMLDivElement>(null);
  const activePage = workspace.pages.find((page) => page.id === workspace.activePageId) ?? workspace.pages[0];

  useEffect(() => {
    editorRootRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    lastPersistedRawRef.current = raw;
    const restored = restoreWorkspace(raw);
    const tourCompleted = window.localStorage.getItem(`${WORKSPACE_STORAGE_KEY}-tour`) === "done";
    const frame = window.requestAnimationFrame(() => {
      setWorkspace(restored.workspace);
      if (restored.message) setSystemNotice(restored.message);
      if (tourCompleted) setTourOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const statusTimer = window.setTimeout(() => setSaveStatus("saving"), 0);
    const timer = window.setTimeout(() => {
      try {
        const currentRaw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (!storageValuesMatch(currentRaw, lastPersistedRawRef.current)) {
          setSaveStatus("error");
          setSystemNotice("別のタブで図が更新されました。再読込してから編集を続けてください");
          return;
        }
        const nextRaw = serializeWorkspace(workspace);
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextRaw);
        lastPersistedRawRef.current = nextRaw;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
        setSystemNotice("端末への保存に失敗しました。空き容量とブラウザ設定を確認してください");
      }
    }, 350);
    return () => {
      window.clearTimeout(statusTimer);
      window.clearTimeout(timer);
    };
  }, [workspace]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    const persistLatestWorkspace = () => {
      try {
        if (!storageValuesMatch(window.localStorage.getItem(WORKSPACE_STORAGE_KEY), lastPersistedRawRef.current)) return;
        const nextRaw = serializeWorkspace(workspaceRef.current);
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextRaw);
        lastPersistedRawRef.current = nextRaw;
      } catch {
        // The normal autosave path already exposes storage failures in the UI.
        // During page teardown there is no reliable opportunity to render one.
      }
    };
    window.addEventListener("beforeunload", persistLatestWorkspace);
    window.addEventListener("pagehide", persistLatestWorkspace);
    return () => {
      window.removeEventListener("beforeunload", persistLatestWorkspace);
      window.removeEventListener("pagehide", persistLatestWorkspace);
    };
  }, []);

  const saveNow = useCallback(() => {
    try {
      if (!storageValuesMatch(window.localStorage.getItem(WORKSPACE_STORAGE_KEY), lastPersistedRawRef.current)) {
        setSaveStatus("error");
        setSystemNotice("別のタブで図が更新されました。再読込してから編集を続けてください");
        return;
      }
      const nextRaw = serializeWorkspace(workspace);
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextRaw);
      lastPersistedRawRef.current = nextRaw;
      setSaveStatus("saved");
      setSystemNotice("現在の図を端末へ保存しました");
    } catch {
      setSaveStatus("error");
      setSystemNotice("端末への保存に失敗しました。空き容量とブラウザ設定を確認してください");
    }
  }, [workspace]);

  useEffect(() => {
    const handleExternalWorkspaceChange = (event: StorageEvent) => {
      if (event.key !== WORKSPACE_STORAGE_KEY) return;
      if (storageValuesMatch(event.newValue, lastPersistedRawRef.current)) {
        lastPersistedRawRef.current = event.newValue;
        return;
      }
      setSaveStatus("error");
      setSystemNotice("別のタブで図が更新されました。再読込してから編集を続けてください");
    };
    window.addEventListener("storage", handleExternalWorkspaceChange);
    return () => window.removeEventListener("storage", handleExternalWorkspaceChange);
  }, []);

  const recordWorkspace = useCallback((snapshot: WorkspaceState) => {
    setUndoStack((stack) => [...stack.slice(-39), cloneWorkspace(snapshot)]);
    setRedoStack([]);
  }, []);

  const updateScene = useCallback((patch: Partial<SceneState>, record = true) => {
    if (record) recordWorkspace(workspace);
    setWorkspace((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === current.activePageId ? { ...page, scene: { ...page.scene, ...patch } } : page),
    }));
  }, [recordWorkspace, workspace]);

  const commitSnapshot = useCallback((scene: SceneState) => {
    const snapshot = cloneWorkspace(workspace);
    snapshot.pages = snapshot.pages.map((page) => page.id === snapshot.activePageId ? { ...page, scene } : page);
    recordWorkspace(snapshot);
  }, [recordWorkspace, workspace]);

  const undo = useCallback(() => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((stack) => [...stack, cloneWorkspace(workspace)]);
    setWorkspace(cloneWorkspace(previous));
    setUndoStack((stack) => stack.slice(0, -1));
  }, [undoStack, workspace]);

  const redo = useCallback(() => {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((stack) => [...stack, cloneWorkspace(workspace)]);
    setWorkspace(cloneWorkspace(next));
    setRedoStack((stack) => stack.slice(0, -1));
  }, [redoStack, workspace]);

  const addFreeBodyPage = useCallback(() => {
    const existing = workspace.pages.find((page) => page.kind === "freebody");
    if (existing) {
      if (existing.id === workspace.activePageId) return;
      recordWorkspace(workspace);
      setWorkspace((current) => ({
        ...current,
        activePageId: existing.id,
        pages: current.pages.map((page) => page.id === existing.id
          ? { ...page, scene: { ...activePage.scene, selectedId: "block" } }
          : page),
      }));
      return;
    }
    recordWorkspace(workspace);
    const page: DiagramPage = { id: `page-${Date.now()}`, title: "自由体図", kind: "freebody", scene: { ...activePage.scene, selectedId: "block" } };
    setWorkspace((current) => ({ ...current, activePageId: page.id, pages: [...current.pages, page] }));
  }, [activePage.scene, recordWorkspace, workspace]);

  const addBlankPage = useCallback(() => {
    recordWorkspace(workspace);
    const pageNumber = workspace.pages.length + 1;
    const page: DiagramPage = {
      id: `page-${Date.now()}`,
      title: `図${pageNumber}`,
      kind: "blank",
      scene: {
        ...INITIAL_SCENE,
        surfaceKind: "floor",
        showAngle: false,
        elements: [],
        variables: [],
        constraints: [],
        selectedId: null,
      },
    };
    setWorkspace((current) => ({ ...current, activePageId: page.id, pages: [...current.pages, page] }));
  }, [recordWorkspace, workspace]);

  const duplicatePage = useCallback((pageId: string) => {
    recordWorkspace(workspace);
    const targetIndex = workspace.pages.findIndex((p) => p.id === pageId);
    const source = workspace.pages[targetIndex];
    if (!source) return;
    const newPage: DiagramPage = {
      id: `page-${Date.now()}`,
      title: `${source.title} (コピー)`,
      kind: source.kind,
      scene: JSON.parse(JSON.stringify(source.scene)),
    };
    const newPages = [...workspace.pages];
    newPages.splice(targetIndex + 1, 0, newPage);
    setWorkspace((current) => ({
      ...current,
      activePageId: newPage.id,
      pages: newPages,
    }));
  }, [recordWorkspace, workspace]);

  const deletePage = useCallback((pageId: string) => {
    if (workspace.pages.length <= 1) return;
    recordWorkspace(workspace);
    const targetIndex = workspace.pages.findIndex((p) => p.id === pageId);
    const nextPages = workspace.pages.filter((p) => p.id !== pageId);
    const nextActiveId = pageId === workspace.activePageId
      ? (nextPages[Math.min(targetIndex, nextPages.length - 1)]?.id ?? nextPages[0].id)
      : workspace.activePageId;
    setWorkspace((current) => ({
      ...current,
      activePageId: nextActiveId,
      pages: nextPages,
    }));
  }, [recordWorkspace, workspace]);

  const renamePage = useCallback((pageId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    recordWorkspace(workspace);
    setWorkspace((current) => ({
      ...current,
      pages: current.pages.map((p) => p.id === pageId ? { ...p, title: trimmed } : p),
    }));
  }, [recordWorkspace, workspace]);

  const applyTemplate = useCallback((template: TemplateId) => {
    setTemplateOpen(false);
    recordWorkspace(workspace);
    const templateScene = buildTemplateScene(template);
    const pageNumber = workspace.pages.length + 1;
    const templateTitle = template === "freebody" ? "自由体図" : template === "incline" ? "斜面運動" : template === "pulley" ? "滑車系" : template === "spring" ? "ばね運動" : `テンプレート図${pageNumber}`;
    const newPage: DiagramPage = {
      id: `page-${Date.now()}`,
      title: templateTitle,
      kind: template === "freebody" ? "freebody" : "incline",
      scene: templateScene,
    };
    setWorkspace((current) => ({
      ...current,
      activePageId: newPage.id,
      pages: [...current.pages, newPage],
    }));
    setActiveTool("select");
  }, [recordWorkspace, workspace]);

  const exportPages = useMemo(() => exportSettings.range === "all" ? workspace.pages : [activePage], [activePage, exportSettings.range, workspace.pages]);

  const exportPng = useCallback(async () => {
    for (const page of exportPages) {
      const blob = await svgToPngBlob(exportScene(page.scene, exportSettings));
      downloadBlob(blob, `${page.title}.png`);
    }
  }, [exportPages, exportSettings]);

  const exportSvg = useCallback(() => {
    for (const page of exportPages) {
      downloadBlob(new Blob([exportScene(page.scene, exportSettings)], { type: "image/svg+xml;charset=utf-8" }), `${page.title}.svg`);
    }
  }, [exportPages, exportSettings]);

  const copySvg = useCallback(async () => {
    setExportError(null);
    try {
      await writeTextToClipboard(exportScene(activePage.scene, { ...exportSettings, format: "svg", range: exportSettings.range === "selection" ? "selection" : "current" }));
      setSystemNotice("SVGをクリップボードへコピーしました");
      setFlyout(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "SVGをコピーできませんでした");
    }
  }, [activePage.scene, exportSettings]);

  const exportPdf = useCallback(async () => {
    const blob = await svgsToPdfBlob(exportPages.map((page) => exportScene(page.scene, exportSettings)));
    downloadBlob(blob, `${exportSettings.range === "all" ? "全図" : activePage.title}.pdf`);
  }, [activePage.title, exportPages, exportSettings]);

  const qualityIssues = useMemo(() => {
    return inspectExportQuality(exportPages);
  }, [exportPages]);

  const exportPptx = useCallback(async () => {
    const { default: PptxGenJS } = await import("pptxgenjs");
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Physics Diagram Editor";
    pptx.subject = "Editable mechanics diagram";
    for (const page of exportPages) {
    const scene = page.scene;
    const include = (id: NonNullable<SceneState["selectedId"]>) => exportSettings.range !== "selection" || scene.selectedId === id;
    const slide = pptx.addSlide();
    if (exportSettings.background === "white") slide.background = { color: "FFFFFF" };
    const effectiveAngle = effectiveSurfaceAngle(scene);
    const angle = (effectiveAngle * Math.PI) / 180;
    const direction = scene.flipped ? -1 : 1;
    const marginInches = exportSettings.margin * 0.01;
    const startX = (scene.flipped ? 11.1 : 2.2) + scene.diagramOffsetX * 0.01 + (scene.flipped ? -marginInches : marginInches);
    const startY = 5.8 + scene.diagramOffsetY * 0.01 - marginInches;
    const length = scene.surfaceKind === "wall" ? 5 : 6.6;
    const endX = startX + direction * Math.cos(angle) * length;
    const endY = startY - Math.sin(angle) * length;
    if (include("incline")) slide.addShape(pptx.ShapeType.line, { x: startX, y: startY, w: endX - startX, h: endY - startY, line: { color: "18202B", width: 1.8 } });
    const normalX = -direction * Math.sin(angle);
    const normalY = -Math.cos(angle);
    if (scene.surfaceRoughness === "rough" && include("incline")) {
      for (let index = 1; index < 18; index += 1) {
        const t = index / 18;
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t;
        slide.addShape(pptx.ShapeType.line, {
          x,
          y,
          w: -normalX * 0.14 - direction * Math.cos(angle) * 0.05,
          h: -normalY * 0.14 + Math.sin(angle) * 0.05,
          line: { color: "18202B", width: 0.8 },
        });
      }
    }
    if (scene.surfaceKind === "incline" && include("incline")) {
      slide.addShape(pptx.ShapeType.line, { x: endX, y: endY, w: 0, h: startY - endY, line: { color: "18202B", width: 1.8 } });
      slide.addShape(pptx.ShapeType.line, { x: startX, y: startY, w: endX - startX, h: 0, line: { color: "18202B", width: 1.8 } });
    }
    const clearance = surfaceContactClearance(scene.surfaceKind) * 0.01;
    const centerX = startX + (endX - startX) * scene.blockPosition + normalX * clearance + scene.blockOffsetX * 0.01;
    const centerY = startY + (endY - startY) * scene.blockPosition + normalY * clearance + scene.blockOffsetY * 0.01;
    const blockX = centerX - 0.6;
    const blockY = centerY - 0.45;
    if (include("block") || include("mass-label")) slide.addText(scene.massLabel, { x: blockX, y: blockY, w: 1.2, h: 0.9, shape: pptx.ShapeType.rect, rotate: blockRotationDegrees(scene), align: "center", valign: "middle", fontFace: "Cambria Math", italic: true, fontSize: 24, fill: { color: "FFFFFF" }, line: { color: "18202B", width: 1.8 }, margin: 0 });
    if (scene.showGravity && include("force-gravity")) {
      slide.addShape(pptx.ShapeType.line, { x: centerX, y: centerY, w: 0, h: 1.5, line: { color: "18202B", width: 1.8, endArrowType: "triangle" } });
      slide.addText("mg", { x: centerX + 0.08, y: centerY + 1.05, w: 0.7, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    if (scene.showNormal && include("force-normal")) {
      slide.addShape(pptx.ShapeType.line, { x: centerX + normalX * 1.5, y: centerY - Math.cos(angle) * 1.5, w: -normalX * 1.5, h: Math.cos(angle) * 1.5, line: { color: "18202B", width: 1.8, beginArrowType: "triangle" } });
      slide.addText("N", { x: centerX + normalX * 1.6 - 0.2, y: centerY - Math.cos(angle) * 1.6 - 0.3, w: 0.5, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    if (scene.showFriction && include("force-friction")) {
      slide.addShape(pptx.ShapeType.line, { x: centerX, y: centerY, w: direction * Math.cos(angle) * 1.5, h: -Math.sin(angle) * 1.5, line: { color: "18202B", width: 1.8, endArrowType: "triangle" } });
      slide.addText("f", { x: centerX + direction * Math.cos(angle) * 1.5, y: centerY - Math.sin(angle) * 1.5 - 0.25, w: 0.4, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    if (scene.surfaceKind === "incline" && scene.showAngle && include("angle")) {
      slide.addText(`θ = ${scene.angle}°`, { x: startX + 0.6, y: startY - 0.55, w: 1.2, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 18, margin: 0 });
    }
    addCatalogElementsToPptx(slide, pptx.ShapeType, exportSettings.range === "selection" ? selectedCatalogElements(scene) : scene.elements);
    }
    await pptx.writeFile({ fileName: `${exportSettings.range === "all" ? "全図" : activePage.title}.pptx` });
  }, [activePage.title, exportPages, exportSettings]);

  const runExport = useCallback(async () => {
    setExportBusy(true);
    setExportError(null);
    try {
      if (exportSettings.range === "selection" && !activePage.scene.selectedId) throw new Error("出力する部品を選択してください");
      if (qualityIssues.some((issue) => issue.code === "empty-document")) throw new Error("空の図は出力できません。部品を追加してください");
      if (exportSettings.format === "pptx") await exportPptx();
      if (exportSettings.format === "png") await exportPng();
      if (exportSettings.format === "svg") exportSvg();
      if (exportSettings.format === "pdf") await exportPdf();
      setSystemNotice(`${exportSettings.format.toUpperCase()}を出力しました`);
      setFlyout(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "出力に失敗しました。もう一度お試しください");
    } finally {
      setExportBusy(false);
    }
  }, [activePage.scene.selectedId, exportPdf, exportPng, exportPptx, exportSettings, exportSvg, qualityIssues]);

  const focusQualityIssue = useCallback((issue: (typeof qualityIssues)[number]) => {
    setWorkspace((current) => ({
      ...current,
      activePageId: issue.pageId,
      pages: current.pages.map((page) => page.id === issue.pageId ? { ...page, scene: { ...page.scene, selectedId: issue.targetId } } : page),
    }));
    setFlyout(null);
  }, []);

  const commands = useMemo<EditorCommandItem[]>(() => [
    { id: "incline-30", label: "斜面を30°に設定", detail: "選択中の斜面の角度を固定", icon: "incline", run: () => updateScene({ angle: 30, selectedId: "incline" }) },
    { id: "add-block", label: "物体を斜面に追加", detail: "接触制約付きで配置", icon: "box", run: () => updateScene({ selectedId: "block" }) },
    { id: "add-forces", label: "基本の力を追加", detail: activePage.scene.surfaceRoughness === "rough" ? "mg・N・fを候補から追加" : "mg・Nを候補から追加", icon: "force", run: () => updateScene({ showGravity: true, showNormal: true, showFriction: activePage.scene.surfaceRoughness === "rough", selectedId: "force-gravity" }) },
    { id: "add-angle", label: "角度 θ を表示", detail: "斜面と水平線の交角", icon: "angle", run: () => updateScene({ showAngle: true, selectedId: "angle" }) },
    { id: "free-body", label: "自由体図を生成", detail: "変量を共有した別タブを作成", icon: "freebody", run: addFreeBodyPage },
    { id: "grid", label: "グリッドを切り替え", detail: activePage.scene.grid ? "グリッドを非表示" : "グリッドを表示", icon: "grid", run: () => updateScene({ grid: !activePage.scene.grid }) },
    { id: "panels", label: "左パネルを切り替え", detail: "作図領域を拡大", shortcut: "⌘B", icon: "panel", run: () => setWorkspace((current) => ({ ...current, leftPanelVisible: !current.leftPanelVisible })) },
    { id: "export", label: "図を出力", detail: "PPTX・SVG・PNG・PDF", icon: "export", run: () => setFlyout("export") },
    ...PHYSICS_COMPONENT_CATALOG.map((item): EditorCommandItem => ({
      id: `add-part-${item.kind}`,
      label: `${item.name}を追加`,
      detail: `${item.category} · ${[...item.aliases, ...item.physics].join(" · ")}`,
      icon: item.category === "ベクトル" ? "force" : item.category === "注釈" ? "angle" : item.category === "接触面" ? "incline" : "box",
      run: () => setActiveTool(componentToolId(item.kind)),
    })),
  ], [activePage.scene.grid, activePage.scene.surfaceRoughness, addFreeBodyPage, updateScene]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setCommandOpen(true); return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault(); setWorkspace((current) => ({ ...current, leftPanelVisible: !current.leftPanelVisible })); return;
      }
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault(); setWorkspace((current) => ({ ...current, rightPanelVisible: !current.rightPanelVisible })); return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault(); if (event.shiftKey) redo(); else undo(); return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault(); redo(); return;
      }
      if (event.key === "Escape") {
        setCommandOpen(false); setFlyout(null); setTemplateOpen(false); setActiveTool("select"); return;
      }

      // Copy (Ctrl+C / Cmd+C)
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "c") {
        if (isTyping) return;
        event.preventDefault();
        const selectedId = activePage.scene.selectedId;
        if (typeof selectedId === "string" && selectedId.startsWith("element:")) {
          const elementId = selectedId.slice("element:".length);
          const elem = activePage.scene.elements.find((e) => e.id === elementId);
          if (elem) {
            clipboardRef.current = [{ ...elem }];
            writeTextToClipboard(JSON.stringify([{ ...elem }])).catch(() => {});
          }
        }
        return;
      }

      // Cut (Ctrl+X / Cmd+X)
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "x" && !isTyping) {
        event.preventDefault();
        const selectedId = activePage.scene.selectedId;
        if (typeof selectedId === "string" && selectedId.startsWith("element:")) {
          const elementId = selectedId.slice("element:".length);
          const elem = activePage.scene.elements.find((e) => e.id === elementId);
          if (elem) {
            clipboardRef.current = [{ ...elem }];
            writeTextToClipboard(JSON.stringify([{ ...elem }])).catch(() => {});
            const result = removeElementWithDependencies(elementId, activePage.scene.elements, activePage.scene.variables, activePage.scene.constraints);
            updateScene({ elements: result.elements, variables: result.variables, constraints: result.constraints, selectedId: null });
          }
        }
        return;
      }

      // Paste (Ctrl+V / Cmd+V)
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "v") {
        if (isTyping) return;
        event.preventDefault();
        if (clipboardRef.current && clipboardRef.current.length > 0) {
          const pasted = clipboardRef.current.map((item) => ({
            ...item,
            id: globalThis.crypto?.randomUUID?.() ?? `elem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            x: item.x + 20,
            y: item.y + 20,
          }));
          updateScene({
            elements: [...activePage.scene.elements, ...pasted],
            selectedId: `element:${pasted[0].id}`,
          });
        }
        return;
      }

      // Duplicate (Ctrl+D / Cmd+D)
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "d") {
        if (isTyping) return;
        event.preventDefault();
        const selectedId = activePage.scene.selectedId;
        if (typeof selectedId === "string" && selectedId.startsWith("element:")) {
          const elementId = selectedId.slice("element:".length);
          const elem = activePage.scene.elements.find((e) => e.id === elementId);
          if (elem) {
            const duplicated: DiagramElement = {
              ...elem,
              id: globalThis.crypto?.randomUUID?.() ?? `elem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              x: elem.x + 24,
              y: elem.y + 24,
            };
            updateScene({
              elements: [...activePage.scene.elements, duplicated],
              selectedId: `element:${duplicated.id}`,
            });
          }
        }
        return;
      }

      // Select All (Ctrl+A / Cmd+A)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" && !isTyping) {
        event.preventDefault();
        if (activePage.scene.elements.length > 0) {
          updateScene({ selectedId: `element:${activePage.scene.elements[0].id}` });
        }
        return;
      }

      // Delete / Backspace
      if ((event.key === "Delete" || event.key === "Backspace") && !isTyping) {
        event.preventDefault();
        const selectedId = activePage.scene.selectedId;
        if (typeof selectedId === "string" && selectedId.startsWith("element:")) {
          const elementId = selectedId.slice("element:".length);
          const result = removeElementWithDependencies(elementId, activePage.scene.elements, activePage.scene.variables, activePage.scene.constraints);
          updateScene({ elements: result.elements, variables: result.variables, constraints: result.constraints, selectedId: null });
        } else if (selectedId === "force-gravity") updateScene({ showGravity: false, selectedId: null });
        else if (selectedId === "force-normal") updateScene({ showNormal: false, selectedId: null });
        else if (selectedId === "force-friction") updateScene({ showFriction: false, selectedId: null });
        else if (selectedId === "angle") updateScene({ showAngle: false, selectedId: null });
        else if (selectedId === "axis") updateScene({ showAxis: false, selectedId: null });
        else if (selectedId === "spring") updateScene({ showSpring: false, selectedId: null });
        else if (selectedId === "pulley") updateScene({ showPulley: false, selectedId: null });
        else if (selectedId === "text") updateScene({ showAnnotation: false, selectedId: null });
        return;
      }

      // Arrow keys (Nudging / Shift+Resizing)
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && !isTyping) {
        event.preventDefault();
        const selectedId = activePage.scene.selectedId;

        if (typeof selectedId === "string" && selectedId.startsWith("element:")) {
          const elementId = selectedId.slice("element:".length);
          if (event.shiftKey) {
            const dw = event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0;
            const dh = event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0;
            updateScene({
              elements: activePage.scene.elements.map((item) => {
                if (item.id !== elementId) return item;
                const nextW = Math.max(16, item.width + dw);
                const nextH = Math.max(16, item.height + dh);
                return { ...item, width: nextW, height: nextH };
              }),
            });
          } else {
            const step = 1;
            const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
            const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
            updateScene({
              elements: activePage.scene.elements.map((item) => item.id === elementId ? { ...item, x: item.x + dx, y: item.y + dy } : item),
            });
          }
        } else {
          const step = event.shiftKey ? 10 : 1;
          const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
          const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
          if (selectedId === "mass-label") {
            updateScene({ massLabelOffsetX: activePage.scene.massLabelOffsetX + dx, massLabelOffsetY: activePage.scene.massLabelOffsetY + dy });
          } else if (selectedId === "angle") {
            updateScene({ angleLabelOffsetX: activePage.scene.angleLabelOffsetX + dx, angleLabelOffsetY: activePage.scene.angleLabelOffsetY + dy });
          } else if (selectedId === "force-gravity-label") {
            updateScene({ forceGravityLabelOffsetX: (activePage.scene.forceGravityLabelOffsetX ?? 0) + dx, forceGravityLabelOffsetY: (activePage.scene.forceGravityLabelOffsetY ?? 0) + dy });
          } else if (selectedId === "force-normal-label") {
            updateScene({ forceNormalLabelOffsetX: (activePage.scene.forceNormalLabelOffsetX ?? 0) + dx, forceNormalLabelOffsetY: (activePage.scene.forceNormalLabelOffsetY ?? 0) + dy });
          } else if (selectedId === "force-friction-label") {
            updateScene({ forceFrictionLabelOffsetX: (activePage.scene.forceFrictionLabelOffsetX ?? 0) + dx, forceFrictionLabelOffsetY: (activePage.scene.forceFrictionLabelOffsetY ?? 0) + dy });
          }
        }
        return;
      }

      if (!isTyping) {
        const shortcuts: Record<string, ToolId> = { p: "incline", b: "block", f: "force", a: "angle", x: "axis", s: "spring", u: "pulley", t: "text", v: "select" };
        const tool = shortcuts[event.key.toLowerCase()];
        if (tool) setActiveTool(tool);
        if (event.key.toLowerCase() === "g") updateScene({ grid: !activePage.scene.grid });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePage.scene.constraints, activePage.scene.elements, activePage.scene.forceFrictionLabelOffsetX, activePage.scene.forceFrictionLabelOffsetY, activePage.scene.forceGravityLabelOffsetX, activePage.scene.forceGravityLabelOffsetY, activePage.scene.forceNormalLabelOffsetX, activePage.scene.forceNormalLabelOffsetY, activePage.scene.grid, activePage.scene.massLabelOffsetX, activePage.scene.massLabelOffsetY, activePage.scene.angleLabelOffsetX, activePage.scene.angleLabelOffsetY, activePage.scene.selectedId, activePage.scene.variables, redo, undo, updateScene]);

  const handleToolPick = useCallback((tool: ToolId) => {
    setActiveTool(tool);
    if (activePage.kind === "blank" && !tool.startsWith("part:")) {
      setWorkspace((current) => ({ ...current, pages: current.pages.map((page) => page.id === current.activePageId ? { ...page, kind: "incline" } : page) }));
    }
    const surfacePreset = surfacePresetForTool(tool);
    if (surfacePreset) updateScene(surfacePlacementPatch(surfacePreset));
    if (tool === "angle") updateScene({ showAngle: true, selectedId: "angle" });
    if (tool === "axis") updateScene({ showAxis: true, selectedId: "axis" });
    if (tool === "spring") updateScene({ showSpring: true, selectedId: "spring" });
    if (tool === "pulley") updateScene({ showPulley: true, selectedId: "pulley" });
  }, [activePage.kind, updateScene]);

  const finishTour = useCallback(() => {
    setTourOpen(false);
    window.localStorage.setItem(`${WORKSPACE_STORAGE_KEY}-tour`, "done");
  }, []);

  return (
    <div
      className={`physics-editor density-${workspace.density}`}
      ref={editorRootRef}
      style={{
        "--panel-left": `${workspace.leftPanelWidth}px`,
        "--panel-right": `${workspace.rightPanelWidth}px`,
      } as React.CSSProperties}
    >
      <TopBar
        canRedo={redoStack.length > 0}
        canUndo={undoStack.length > 0}
        commandOpen={commandOpen}
        commandQuery={commandQuery}
        onCommandChange={(value) => { setCommandQuery(value); setCommandOpen(true); }}
        onCommandFocus={() => setCommandOpen(true)}
        onExport={() => setFlyout(flyout === "export" ? null : "export")}
        onMenu={() => setFlyout(flyout === "menu" ? null : "menu")}
        onRedo={redo}
        onUndo={undo}
        saveStatus={saveStatus}
      />

      {commandOpen ? <CommandPalette commands={commands} query={commandQuery} onClose={() => { setCommandOpen(false); setCommandQuery(""); }} /> : null}

      {flyout === "menu" ? (
        <div className="menu-flyout">
          <div className="flyout-heading"><strong>表示設定</strong><button aria-label="メニューを閉じる" type="button" onClick={() => setFlyout(null)}><X size={14} /></button></div>
          <label className="menu-row"><span><Settings2 size={15} />UI密度</span><select value={workspace.density} onChange={(event) => setWorkspace((current) => ({ ...current, density: event.target.value as WorkspaceState["density"] }))}><option value="standard">標準</option><option value="compact">コンパクト</option></select></label>
          <button className="menu-row" type="button" onClick={saveNow}><span><Check size={15} />今すぐ保存</span></button>
          <button className="menu-row" type="button" onClick={() => setTourOpen(true)}><span><CircleHelp size={15} />60秒ガイド</span><ChevronDown size={14} /></button>
          <button className="menu-row" type="button" onClick={() => setWorkspace(INITIAL_WORKSPACE)}><span><Sparkles size={15} />サンプルを復元</span></button>
        </div>
      ) : null}

      {flyout === "export" ? (
        <div aria-label="出力設定" className="export-flyout" role="dialog">
          <div className="flyout-heading"><div><small>出力</small><strong>{activePage.title}</strong></div><button aria-label="出力を閉じる" type="button" onClick={() => setFlyout(null)}><X size={14} /></button></div>
          <div className={`quality-state ${qualityIssues.length ? "warning" : ""}`}><Check size={15} /><span><strong>{qualityIssues.length ? `${qualityIssues.length}件の確認事項` : "品質チェック完了"}</strong><small>{qualityIssues[0]?.message ?? "重複・制約・参照・用紙範囲に問題はありません"}</small></span></div>
          {qualityIssues.length ? <div className="quality-list" aria-label="品質チェック結果">{qualityIssues.map((issue, index) => <button key={`${issue.pageId}-${issue.code}-${index}`} type="button" onClick={() => focusQualityIssue(issue)}><span className={`quality-severity ${issue.severity}`} />{issue.message}<small>対象へ移動</small></button>)}</div> : null}
          <div className="export-fields">
            <label><span>形式</span><select aria-label="出力形式" value={exportSettings.format} onChange={(event) => setExportSettings((current) => ({ ...current, format: event.target.value as ExportSettings["format"] }))}><option value="pptx">PowerPoint (.pptx)</option><option value="svg">SVG</option><option value="png">PNG</option><option value="pdf">PDF</option></select></label>
            <label><span>範囲</span><select aria-label="出力範囲" value={exportSettings.range} onChange={(event) => setExportSettings((current) => ({ ...current, range: event.target.value as ExportSettings["range"] }))}><option value="current">現在の図</option><option value="all">すべての図</option><option value="selection">選択部品</option></select></label>
            <label><span>背景</span><select aria-label="出力背景" value={exportSettings.background} onChange={(event) => setExportSettings((current) => ({ ...current, background: event.target.value as ExportSettings["background"] }))}><option value="white">白</option><option value="transparent">透明</option></select></label>
            <label><span>余白</span><span className="margin-field"><input aria-label="出力余白" min="0" max="200" type="number" value={exportSettings.margin} onChange={(event) => setExportSettings((current) => ({ ...current, margin: Math.max(0, Math.min(200, Number(event.target.value) || 0)) }))} /><small>px</small></span></label>
          </div>
          {exportError ? <div className="export-error" role="alert">{exportError}</div> : null}
          <div className="export-actions">{exportSettings.format === "svg" ? <button type="button" onClick={copySvg}><Copy size={14} />SVGをコピー</button> : <span />}<button className="primary" disabled={exportBusy} type="button" onClick={runExport}>{exportBusy ? "生成中…" : "出力"}</button></div>
        </div>
      ) : null}

      <div className="editor-body">
        {workspace.leftPanelVisible ? (
          <LibraryPanel
            activeTab={libraryTab}
            activeTool={activeTool}
            pageTitle={activePage.title}
            query={libraryQuery}
            scene={activePage.scene}
            onApplyTemplate={applyTemplate}
            onOpenTemplates={() => setTemplateOpen(true)}
            onQueryChange={setLibraryQuery}
            onSceneChange={updateScene}
            onSelect={(selectedId) => updateScene({ selectedId })}
            onTabChange={setLibraryTab}
            onToolPick={handleToolPick}
          />
        ) : null}

        <EditorCanvas
          activeTool={activeTool}
          pageKind={activePage.kind}
          scene={activePage.scene}
          zoom={workspace.zoom}
          onCanvasReady={setCanvasNode}
          onCommitSnapshot={commitSnapshot}
          onCreateFreeBody={addFreeBodyPage}
          onPointerPositionChange={setPointerPosition}
          onSceneChange={updateScene}
          onToolComplete={() => setActiveTool("select")}
        />

        {workspace.rightPanelVisible ? <InspectorPanel pageKind={activePage.kind} scene={activePage.scene} onCreateFreeBody={addFreeBodyPage} onCommitSnapshot={commitSnapshot} onSceneChange={updateScene} /> : null}
      </div>

      <footer className="statusbar">
        <div className="page-tabs">
          {workspace.pages.map((page) => {
            const isActive = page.id === workspace.activePageId;
            const isEditing = editingPageId === page.id;
            return (
              <div
                key={page.id}
                className={`page-tab-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (editingPageId !== page.id) {
                    setWorkspace((current) => ({ ...current, activePageId: page.id }));
                  }
                }}
                onDoubleClick={() => {
                  setEditingPageId(page.id);
                  setEditingTitle(page.title);
                }}
              >
                <span className="page-tab-title">
                  {page.kind === "freebody" ? <Layers3 size={13} /> : null}
                  {isEditing ? (
                    <input
                      autoFocus
                      className="tab-rename-input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => {
                        renamePage(page.id, editingTitle);
                        setEditingPageId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          renamePage(page.id, editingTitle);
                          setEditingPageId(null);
                        } else if (e.key === "Escape") {
                          setEditingPageId(null);
                        }
                      }}
                    />
                  ) : (
                    <span>{page.title}</span>
                  )}
                </span>

                <span className="tab-actions">
                  <button
                    className="tab-action-btn"
                    type="button"
                    title="シートを複製 (コピー)"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicatePage(page.id);
                    }}
                  >
                    <Copy size={11} />
                  </button>
                  {workspace.pages.length > 1 ? (
                    <button
                      className="tab-action-btn delete"
                      type="button"
                      title="シートを削除"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePage(page.id);
                      }}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
          <button className="add-page" type="button" onClick={addBlankPage} title="新規図面シートを追加"><Plus size={14} /></button>
        </div>
        <div className="drawing-status"><span>x: {pointerPosition.x}</span><span>y: {pointerPosition.y}</span><span>θ: {activePage.scene.angle}°</span><button className={activePage.scene.grid ? "active" : ""} type="button" onClick={() => updateScene({ grid: !activePage.scene.grid })}><Grid3X3 size={13} />GRID</button><button className={activePage.scene.snapEnabled ? "active" : ""} type="button" onClick={() => updateScene({ snapEnabled: !activePage.scene.snapEnabled })}>SNAP</button></div>
        <div className="zoom-controls"><button type="button" aria-label="縮小" onClick={() => setWorkspace((current) => ({ ...current, zoom: Math.max(50, current.zoom - 10) }))}><Minus size={13} /></button><span>{workspace.zoom}%</span><button type="button" aria-label="拡大" onClick={() => setWorkspace((current) => ({ ...current, zoom: Math.min(180, current.zoom + 10) }))}><Plus size={13} /></button><button type="button" title="全体表示" onClick={() => { setWorkspace((current) => ({ ...current, zoom: 100 })); updateScene({ diagramOffsetX: 0, diagramOffsetY: 0 }); }}><Maximize2 size={13} /></button></div>
      </footer>

      {tourOpen ? (
        <aside className="tour-card">
          <div className="tour-progress"><span style={{ width: `${((tourStep + 1) / 3) * 100}%` }} /></div>
          <button aria-label="ガイドを閉じる" className="tour-close" type="button" onClick={finishTour}><X size={14} /></button>
          <small>60秒ガイド · {tourStep + 1}/3</small>
          <strong>{tourStep === 0 ? "斜面を選択しました" : tourStep === 1 ? "角度を数値で変更" : "頂点の候補から追加"}</strong>
          <p>{tourStep === 0 ? "青い端点をドラッグすると、斜面角と関連要素が追従します。" : tourStep === 1 ? "図上の θ = 30° をクリックし、数値を入力してみましょう。" : "斜面の頂点へカーソルを近づけ、表示された候補をクリックできます。"}</p>
          <div><button type="button" onClick={finishTour}>スキップ</button><button className="primary" type="button" onClick={() => tourStep < 2 ? setTourStep((step) => step + 1) : finishTour()}>{tourStep < 2 ? "次へ" : "完了"}</button></div>
        </aside>
      ) : null}

      {templateOpen ? <TemplateDialog onApply={applyTemplate} onClose={() => setTemplateOpen(false)} /> : null}
      {systemNotice ? <div className={`system-notice ${saveStatus === "error" ? "error" : ""}`} role={saveStatus === "error" ? "alert" : "status"}><span>{systemNotice}</span><button type="button" aria-label="通知を閉じる" onClick={() => setSystemNotice(null)}><X size={14} /></button></div> : null}
    </div>
  );
}
