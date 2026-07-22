"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  FileImage,
  FileText,
  Grid3X3,
  Layers3,
  Maximize2,
  Minus,
  Plus,
  Presentation,
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
  type DiagramPage,
  type SceneState,
  type TemplateId,
  type ToolId,
  type WorkspaceState,
} from "@/app/lib/editor-types";
import { sceneToSvg } from "@/app/lib/scene-export";
import { restoreWorkspace, serializeWorkspace, WORKSPACE_STORAGE_KEY } from "@/app/lib/workspace-storage";
import { blockRotationDegrees, effectiveSurfaceAngle, hasSurfaceConflict, surfaceContactClearance, surfacePlacementPatch, surfacePresetForTool, type SurfacePreset } from "@/app/lib/physics-rules";
import { componentToolId, PHYSICS_COMPONENT_CATALOG } from "@/app/lib/component-catalog";

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

export function PhysicsEditor() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(INITIAL_WORKSPACE);
  const [undoStack, setUndoStack] = useState<WorkspaceState[]>([]);
  const [redoStack, setRedoStack] = useState<WorkspaceState[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("add");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [commandQuery, setCommandQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  const [saveStatus, setSaveStatus] = useState<"error" | "saved" | "saving">("saved");
  const [systemNotice, setSystemNotice] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(true);
  const [tourStep, setTourStep] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const activePage = workspace.pages.find((page) => page.id === workspace.activePageId) ?? workspace.pages[0];

  useEffect(() => {
    const restored = restoreWorkspace(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
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
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(workspace));
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

  const saveNow = useCallback(() => {
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(workspace));
      setSaveStatus("saved");
      setSystemNotice("現在の図を端末へ保存しました");
    } catch {
      setSaveStatus("error");
      setSystemNotice("端末への保存に失敗しました。空き容量とブラウザ設定を確認してください");
    }
  }, [workspace]);

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
    const page: DiagramPage = { id: `page-${Date.now()}`, title: `図${pageNumber}`, kind: "blank", scene: { ...INITIAL_SCENE, selectedId: null } };
    setWorkspace((current) => ({ ...current, activePageId: page.id, pages: [...current.pages, page] }));
  }, [recordWorkspace, workspace]);

  const applyTemplate = useCallback((template: TemplateId) => {
    setTemplateOpen(false);
    if (template === "freebody") {
      addFreeBodyPage();
      return;
    }
    recordWorkspace(workspace);
    const templateSurface: SurfacePreset = template === "horizontal"
      ? { kind: "floor", roughness: "rough" }
      : template === "rough-wall"
        ? { kind: "wall", roughness: "rough" }
        : template === "smooth-wall"
          ? { kind: "wall", roughness: "smooth" }
          : template === "smooth-incline"
            ? { kind: "incline", roughness: "smooth" }
            : { kind: "incline", roughness: "rough" };
    const templateScene: SceneState = {
      ...INITIAL_SCENE,
      ...surfacePlacementPatch(templateSurface),
      showPulley: template === "pulley",
      showSpring: template === "spring",
      selectedId: template === "pulley" ? "pulley" : template === "spring" ? "spring" : "incline",
    };
    setWorkspace((current) => ({
      ...current,
      pages: current.pages.map((page) => page.id === current.activePageId ? { ...page, kind: "incline", scene: templateScene } : page),
    }));
    setActiveTool("select");
  }, [addFreeBodyPage, recordWorkspace, workspace]);

  const exportPng = useCallback(() => {
    if (!canvasNode) return;
    canvasNode.toBlob((blob) => { if (blob) downloadBlob(blob, `${activePage.title}.png`); }, "image/png");
    setFlyout(null);
  }, [activePage.title, canvasNode]);

  const copySvg = useCallback(async () => {
    await navigator.clipboard.writeText(sceneToSvg(activePage.scene));
    setFlyout(null);
  }, [activePage.scene]);

  const qualityIssues = useMemo(() => {
    const issues: string[] = [];
    if (!activePage.scene.massLabel.trim()) issues.push("質量ラベルが空です");
    if (activePage.scene.angle < 5 || activePage.scene.angle > 75) issues.push("斜面角が範囲外です");
    if (activePage.scene.forceScale < 0.5) issues.push("力ベクトルが短すぎます");
    if (hasSurfaceConflict(activePage.scene)) issues.push("滑らかな面に摩擦力が残っています");
    return issues;
  }, [activePage.scene]);

  const exportPptx = useCallback(async () => {
    const { default: PptxGenJS } = await import("pptxgenjs");
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Physics Diagram Editor";
    pptx.subject = "Editable mechanics diagram";
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    const effectiveAngle = effectiveSurfaceAngle(activePage.scene);
    const angle = (effectiveAngle * Math.PI) / 180;
    const direction = activePage.scene.flipped ? -1 : 1;
    const startX = (activePage.scene.flipped ? 11.1 : 2.2) + activePage.scene.diagramOffsetX * 0.01;
    const startY = 5.8 + activePage.scene.diagramOffsetY * 0.01;
    const length = activePage.scene.surfaceKind === "wall" ? 5 : 6.6;
    const endX = startX + direction * Math.cos(angle) * length;
    const endY = startY - Math.sin(angle) * length;
    slide.addShape(pptx.ShapeType.line, { x: startX, y: startY, w: endX - startX, h: endY - startY, line: { color: "18202B", width: 1.8 } });
    const normalX = -direction * Math.sin(angle);
    const normalY = -Math.cos(angle);
    if (activePage.scene.surfaceRoughness === "rough") {
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
    if (activePage.scene.surfaceKind === "incline") {
      slide.addShape(pptx.ShapeType.line, { x: endX, y: endY, w: 0, h: startY - endY, line: { color: "18202B", width: 1.8 } });
      slide.addShape(pptx.ShapeType.line, { x: startX, y: startY, w: endX - startX, h: 0, line: { color: "18202B", width: 1.8 } });
    }
    const clearance = surfaceContactClearance(activePage.scene.surfaceKind) * 0.01;
    const centerX = startX + (endX - startX) * activePage.scene.blockPosition + normalX * clearance + activePage.scene.blockOffsetX * 0.01;
    const centerY = startY + (endY - startY) * activePage.scene.blockPosition + normalY * clearance + activePage.scene.blockOffsetY * 0.01;
    const blockX = centerX - 0.6;
    const blockY = centerY - 0.45;
    slide.addText(activePage.scene.massLabel, { x: blockX, y: blockY, w: 1.2, h: 0.9, shape: pptx.ShapeType.rect, rotate: blockRotationDegrees(activePage.scene), align: "center", valign: "middle", fontFace: "Cambria Math", italic: true, fontSize: 24, fill: { color: "FFFFFF" }, line: { color: "18202B", width: 1.8 }, margin: 0 });
    if (activePage.scene.showGravity) {
      slide.addShape(pptx.ShapeType.line, { x: centerX, y: centerY, w: 0, h: 1.5, line: { color: "18202B", width: 1.8, endArrowType: "triangle" } });
      slide.addText("mg", { x: centerX + 0.08, y: centerY + 1.05, w: 0.7, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    if (activePage.scene.showNormal) {
      slide.addShape(pptx.ShapeType.line, { x: centerX + normalX * 1.5, y: centerY - Math.cos(angle) * 1.5, w: -normalX * 1.5, h: Math.cos(angle) * 1.5, line: { color: "18202B", width: 1.8, beginArrowType: "triangle" } });
      slide.addText("N", { x: centerX + normalX * 1.6 - 0.2, y: centerY - Math.cos(angle) * 1.6 - 0.3, w: 0.5, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    if (activePage.scene.showFriction) {
      slide.addShape(pptx.ShapeType.line, { x: centerX, y: centerY, w: direction * Math.cos(angle) * 1.5, h: -Math.sin(angle) * 1.5, line: { color: "18202B", width: 1.8, endArrowType: "triangle" } });
      slide.addText("f", { x: centerX + direction * Math.cos(angle) * 1.5, y: centerY - Math.sin(angle) * 1.5 - 0.25, w: 0.4, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    if (activePage.scene.surfaceKind === "incline" && activePage.scene.showAngle) {
      slide.addText(`θ = ${activePage.scene.angle}°`, { x: startX + 0.6, y: startY - 0.55, w: 1.2, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 18, margin: 0 });
    }
    await pptx.writeFile({ fileName: `${activePage.title}.pptx` });
    setFlyout(null);
  }, [activePage]);

  const commands = useMemo<EditorCommandItem[]>(() => [
    { id: "incline-30", label: "斜面を30°に設定", detail: "選択中の斜面の角度を固定", icon: "incline", run: () => updateScene({ angle: 30, selectedId: "incline" }) },
    { id: "add-block", label: "物体を斜面に追加", detail: "接触制約付きで配置", icon: "box", run: () => updateScene({ selectedId: "block" }) },
    { id: "add-forces", label: "基本の力を追加", detail: activePage.scene.surfaceRoughness === "rough" ? "mg・N・fを候補から追加" : "mg・Nを候補から追加", icon: "force", run: () => updateScene({ showGravity: true, showNormal: true, showFriction: activePage.scene.surfaceRoughness === "rough", selectedId: "force-gravity" }) },
    { id: "add-angle", label: "角度 θ を表示", detail: "斜面と水平線の交角", icon: "angle", run: () => updateScene({ showAngle: true, selectedId: "angle" }) },
    { id: "free-body", label: "自由体図を生成", detail: "変量を共有した別タブを作成", icon: "freebody", run: addFreeBodyPage },
    { id: "grid", label: "グリッドを切り替え", detail: activePage.scene.grid ? "グリッドを非表示" : "グリッドを表示", icon: "grid", run: () => updateScene({ grid: !activePage.scene.grid }) },
    { id: "panels", label: "左パネルを切り替え", detail: "作図領域を拡大", shortcut: "⌘B", icon: "panel", run: () => setWorkspace((current) => ({ ...current, leftPanelVisible: !current.leftPanelVisible })) },
    { id: "export", label: "PPTXとして出力", detail: "PowerPointで編集可能な図形", icon: "export", run: () => setFlyout("export") },
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
      if (event.key === "Escape") {
        setCommandOpen(false); setFlyout(null); setTemplateOpen(false); setActiveTool("select"); return;
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
  }, [activePage.scene.grid, redo, undo, updateScene]);

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
        <div className="export-flyout">
          <div className="flyout-heading"><div><small>出力</small><strong>{activePage.title}</strong></div><button aria-label="出力を閉じる" type="button" onClick={() => setFlyout(null)}><X size={14} /></button></div>
          <div className={`quality-state ${qualityIssues.length ? "warning" : ""}`}><Check size={15} /><span><strong>{qualityIssues.length ? `${qualityIssues.length}件の確認事項` : "品質チェック完了"}</strong><small>{qualityIssues[0] ?? "ラベル・角度・線長に問題はありません"}</small></span></div>
          <div className="export-options">
            <button type="button" onClick={exportPptx}><Presentation size={18} /><span><strong>PowerPoint</strong><small>編集可能な図形</small></span></button>
            <button type="button" onClick={exportPng}><FileImage size={18} /><span><strong>PNG</strong><small>現在の表示</small></span></button>
            <button type="button" onClick={copySvg}><Copy size={18} /><span><strong>SVGをコピー</strong><small>ベクター形式</small></span></button>
            <button type="button" onClick={() => window.print()}><FileText size={18} /><span><strong>PDF</strong><small>印刷ダイアログ</small></span></button>
          </div>
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
          onPointerPositionChange={setPointerPosition}
          onSceneChange={updateScene}
          onToolComplete={() => setActiveTool("select")}
        />

        {workspace.rightPanelVisible ? <InspectorPanel pageKind={activePage.kind} scene={activePage.scene} onCreateFreeBody={addFreeBodyPage} onCommitSnapshot={commitSnapshot} onSceneChange={updateScene} /> : null}
      </div>

      <footer className="statusbar">
        <div className="page-tabs">
          {workspace.pages.map((page) => (
            <button aria-current={page.id === workspace.activePageId ? "page" : undefined} className={page.id === workspace.activePageId ? "active" : ""} type="button" key={page.id} onClick={() => setWorkspace((current) => ({ ...current, activePageId: page.id }))}>
              {page.kind === "freebody" ? <Layers3 size={13} /> : null}{page.title}
            </button>
          ))}
          <button className="add-page" type="button" onClick={addBlankPage} aria-label="図を追加"><Plus size={14} /></button>
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
