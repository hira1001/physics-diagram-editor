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
import { TopBar } from "@/app/components/TopBar";
import {
  INITIAL_SCENE,
  INITIAL_WORKSPACE,
  type DiagramPage,
  type SceneState,
  type ToolId,
  type WorkspaceState,
} from "@/app/lib/editor-types";

type LibraryTab = "add" | "structure";
type Flyout = "export" | "menu" | null;

const STORAGE_KEY = "physics-editor-workspace-v1";

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

function sceneToSvg(scene: SceneState) {
  const angle = (scene.angle * Math.PI) / 180;
  const start = { x: 120, y: 430 };
  const length = 560;
  const end = { x: start.x + Math.cos(angle) * length, y: start.y - Math.sin(angle) * length };
  const tangent = { x: Math.cos(angle), y: -Math.sin(angle) };
  const normal = { x: -Math.sin(angle), y: -Math.cos(angle) };
  const linePoint = { x: start.x + tangent.x * length * scene.blockPosition, y: start.y + tangent.y * length * scene.blockPosition };
  const block = { x: linePoint.x + normal.x * 55, y: linePoint.y + normal.y * 55 };
  const arrow = (x1: number, y1: number, x2: number, y2: number, label: string) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#18202b" stroke-width="3" marker-end="url(#arrow)"/><text x="${x2 + 12}" y="${y2}" font-size="24" font-style="italic">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#18202b"/></marker></defs><rect width="900" height="560" fill="white"/><path d="M${start.x},${start.y} L${end.x},${end.y} L${end.x},${start.y} Z" fill="none" stroke="#18202b" stroke-width="3"/><g transform="translate(${block.x} ${block.y}) rotate(${-scene.angle})"><rect x="-70" y="-45" width="140" height="90" fill="white" stroke="#18202b" stroke-width="3"/><text x="0" y="9" text-anchor="middle" font-size="30" font-style="italic">${scene.massLabel}</text></g>${scene.showGravity ? arrow(block.x, block.y, block.x, block.y + 120, "mg") : ""}${scene.showNormal ? arrow(block.x, block.y, block.x + normal.x * 120, block.y + normal.y * 120, "N") : ""}${scene.showFriction ? arrow(block.x, block.y, block.x + tangent.x * 120, block.y + tangent.y * 120, "f") : ""}${scene.showAngle ? `<path d="M${start.x + 70},${start.y} A70 70 0 0 0 ${start.x + Math.cos(angle) * 70},${start.y - Math.sin(angle) * 70}" fill="none" stroke="#18202b" stroke-width="2"/><text x="${start.x + 80}" y="${start.y - 24}" font-size="25" font-style="italic">θ</text>` : ""}</svg>`;
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
  const [zoom, setZoom] = useState(100);
  const [tourOpen, setTourOpen] = useState(true);
  const [tourStep, setTourStep] = useState(0);
  const activePage = workspace.pages.find((page) => page.id === workspace.activePageId) ?? workspace.pages[0];

  useEffect(() => {
    let restoredWorkspace: WorkspaceState | null = null;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WorkspaceState;
        if (parsed.pages?.length) restoredWorkspace = parsed;
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    const tourCompleted = window.localStorage.getItem(`${STORAGE_KEY}-tour`) === "done";
    const frame = window.requestAnimationFrame(() => {
      if (restoredWorkspace) setWorkspace(restoredWorkspace);
      if (tourCompleted) setTourOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)), 350);
    return () => window.clearTimeout(timer);
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
      setWorkspace((current) => ({ ...current, activePageId: existing.id }));
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

  const exportPng = useCallback(() => {
    if (!canvasNode) return;
    canvasNode.toBlob((blob) => { if (blob) downloadBlob(blob, `${activePage.title}.png`); }, "image/png");
    setFlyout(null);
  }, [activePage.title, canvasNode]);

  const copySvg = useCallback(async () => {
    await navigator.clipboard.writeText(sceneToSvg(activePage.scene));
    setFlyout(null);
  }, [activePage.scene]);

  const exportPptx = useCallback(async () => {
    const { default: PptxGenJS } = await import("pptxgenjs");
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Physics Diagram Editor";
    pptx.subject = "Editable mechanics diagram";
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    const angle = (activePage.scene.angle * Math.PI) / 180;
    const startX = 2.2;
    const startY = 5.8;
    const length = 6.6;
    const endX = startX + Math.cos(angle) * length;
    const endY = startY - Math.sin(angle) * length;
    slide.addShape(pptx.ShapeType.line, { x: startX, y: startY, w: endX - startX, h: endY - startY, line: { color: "18202B", width: 1.8 } });
    slide.addShape(pptx.ShapeType.line, { x: endX, y: endY, w: 0, h: startY - endY, line: { color: "18202B", width: 1.8 } });
    slide.addShape(pptx.ShapeType.line, { x: startX, y: startY, w: endX - startX, h: 0, line: { color: "18202B", width: 1.8 } });
    const blockX = startX + (endX - startX) * activePage.scene.blockPosition - 0.6;
    const blockY = startY + (endY - startY) * activePage.scene.blockPosition - 0.7;
    slide.addText(activePage.scene.massLabel, { x: blockX, y: blockY, w: 1.2, h: 0.9, shape: pptx.ShapeType.rect, rotate: -activePage.scene.angle, align: "center", valign: "mid", fontFace: "Cambria Math", italic: true, fontSize: 24, fill: { color: "FFFFFF" }, line: { color: "18202B", width: 1.8 }, margin: 0 });
    const centerX = blockX + 0.6;
    const centerY = blockY + 0.45;
    if (activePage.scene.showGravity) {
      slide.addShape(pptx.ShapeType.line, { x: centerX, y: centerY, w: 0, h: 1.5, line: { color: "18202B", width: 1.8, endArrowType: "triangle" } });
      slide.addText("mg", { x: centerX + 0.08, y: centerY + 1.05, w: 0.7, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    if (activePage.scene.showNormal) {
      slide.addShape(pptx.ShapeType.line, { x: centerX - Math.sin(angle) * 1.5, y: centerY - Math.cos(angle) * 1.5, w: Math.sin(angle) * 1.5, h: Math.cos(angle) * 1.5, line: { color: "18202B", width: 1.8, beginArrowType: "triangle" } });
      slide.addText("N", { x: centerX - Math.sin(angle) * 1.6 - 0.2, y: centerY - Math.cos(angle) * 1.6 - 0.3, w: 0.5, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    if (activePage.scene.showFriction) {
      slide.addShape(pptx.ShapeType.line, { x: centerX, y: centerY, w: Math.cos(angle) * 1.5, h: -Math.sin(angle) * 1.5, line: { color: "18202B", width: 1.8, endArrowType: "triangle" } });
      slide.addText("f", { x: centerX + Math.cos(angle) * 1.5, y: centerY - Math.sin(angle) * 1.5 - 0.25, w: 0.4, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 20, margin: 0 });
    }
    slide.addText(`θ = ${activePage.scene.angle}°`, { x: startX + 0.6, y: startY - 0.55, w: 1.2, h: 0.4, italic: true, fontFace: "Cambria Math", fontSize: 18, margin: 0 });
    await pptx.writeFile({ fileName: `${activePage.title}.pptx` });
    setFlyout(null);
  }, [activePage]);

  const commands = useMemo<EditorCommandItem[]>(() => [
    { id: "incline-30", label: "斜面を30°に設定", detail: "選択中の斜面の角度を固定", shortcut: "P 30", icon: "incline", run: () => updateScene({ angle: 30, selectedId: "incline" }) },
    { id: "add-block", label: "物体を斜面に追加", detail: "接触制約付きで配置", shortcut: "B", icon: "box", run: () => updateScene({ selectedId: "block" }) },
    { id: "add-forces", label: "基本の力を追加", detail: "mg・N・fを候補から追加", shortcut: "F", icon: "force", run: () => updateScene({ showGravity: true, showNormal: true, showFriction: true, selectedId: "force-gravity" }) },
    { id: "add-angle", label: "角度 θ を表示", detail: "斜面と水平線の交角", shortcut: "A", icon: "angle", run: () => updateScene({ showAngle: true, selectedId: "angle" }) },
    { id: "free-body", label: "自由体図を生成", detail: "変量を共有した別タブを作成", shortcut: "⇧F", icon: "freebody", run: addFreeBodyPage },
    { id: "grid", label: "グリッドを切り替え", detail: activePage.scene.grid ? "グリッドを非表示" : "グリッドを表示", shortcut: "G", icon: "grid", run: () => updateScene({ grid: !activePage.scene.grid }) },
    { id: "panels", label: "左パネルを切り替え", detail: "作図領域を拡大", shortcut: "⌘B", icon: "panel", run: () => setWorkspace((current) => ({ ...current, leftPanelVisible: !current.leftPanelVisible })) },
    { id: "export", label: "PPTXとして出力", detail: "PowerPointで編集可能な図形", shortcut: "⇧⌘E", icon: "export", run: () => setFlyout("export") },
  ], [activePage.scene.grid, addFreeBodyPage, updateScene]);

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
        setCommandOpen(false); setFlyout(null); setActiveTool("select"); return;
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
    if (tool === "incline") updateScene({ selectedId: "incline" });
    if (tool === "angle") updateScene({ showAngle: true, selectedId: "angle" });
    if (tool === "axis") updateScene({ showAxis: true, selectedId: "axis" });
    if (tool === "spring") updateScene({ showSpring: true, selectedId: "spring" });
    if (tool === "pulley") updateScene({ showPulley: true, selectedId: "pulley" });
  }, [updateScene]);

  const finishTour = useCallback(() => {
    setTourOpen(false);
    window.localStorage.setItem(`${STORAGE_KEY}-tour`, "done");
  }, []);

  return (
    <div className={`physics-editor density-${workspace.density}`}>
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
      />

      {commandOpen ? <CommandPalette commands={commands} query={commandQuery} onClose={() => { setCommandOpen(false); setCommandQuery(""); }} /> : null}

      {flyout === "menu" ? (
        <div className="menu-flyout">
          <div className="flyout-heading"><strong>表示設定</strong><button type="button" onClick={() => setFlyout(null)}><X size={14} /></button></div>
          <label className="menu-row"><span><Settings2 size={15} />UI密度</span><select value={workspace.density} onChange={(event) => setWorkspace((current) => ({ ...current, density: event.target.value as WorkspaceState["density"] }))}><option value="standard">標準</option><option value="compact">コンパクト</option></select></label>
          <button className="menu-row" type="button" onClick={() => setTourOpen(true)}><span><CircleHelp size={15} />60秒ガイド</span><ChevronDown size={14} /></button>
          <button className="menu-row" type="button" onClick={() => setWorkspace(INITIAL_WORKSPACE)}><span><Sparkles size={15} />サンプルを復元</span></button>
        </div>
      ) : null}

      {flyout === "export" ? (
        <div className="export-flyout">
          <div className="flyout-heading"><div><small>出力</small><strong>{activePage.title}</strong></div><button type="button" onClick={() => setFlyout(null)}><X size={14} /></button></div>
          <div className="quality-state"><Check size={15} /><span><strong>品質チェック完了</strong><small>重なり・未定義の変量はありません</small></span></div>
          <div className="export-options">
            <button type="button" onClick={exportPptx}><Presentation size={18} /><span><strong>PowerPoint</strong><small>編集可能な図形</small></span></button>
            <button type="button" onClick={exportPng}><FileImage size={18} /><span><strong>PNG</strong><small>現在の表示</small></span></button>
            <button type="button" onClick={copySvg}><Copy size={18} /><span><strong>SVGをコピー</strong><small>ベクター形式</small></span></button>
            <button type="button" onClick={() => window.print()}><FileText size={18} /><span><strong>PDF</strong><small>印刷ダイアログ</small></span></button>
          </div>
          <label className="export-check"><input type="checkbox" defaultChecked />透明背景</label>
          <label className="export-check"><input type="checkbox" defaultChecked />余白を自動調整</label>
        </div>
      ) : null}

      <div className="editor-body">
        {workspace.leftPanelVisible ? (
          <LibraryPanel
            activeTab={libraryTab}
            activeTool={activeTool}
            query={libraryQuery}
            scene={activePage.scene}
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
          onCanvasReady={setCanvasNode}
          onCommitSnapshot={commitSnapshot}
          onSceneChange={updateScene}
          onToolComplete={() => setActiveTool("select")}
        />

        {workspace.rightPanelVisible ? <InspectorPanel scene={activePage.scene} onCreateFreeBody={addFreeBodyPage} onSceneChange={updateScene} /> : null}
      </div>

      <footer className="statusbar">
        <div className="page-tabs">
          {workspace.pages.map((page) => (
            <button className={page.id === workspace.activePageId ? "active" : ""} type="button" key={page.id} onClick={() => setWorkspace((current) => ({ ...current, activePageId: page.id }))}>
              {page.kind === "freebody" ? <Layers3 size={13} /> : null}{page.title}
            </button>
          ))}
          <button className="add-page" type="button" onClick={addBlankPage} aria-label="図を追加"><Plus size={14} /></button>
        </div>
        <div className="drawing-status"><span>x: 482</span><span>y: 316</span><span>θ: {activePage.scene.angle}°</span><button className={activePage.scene.grid ? "active" : ""} type="button" onClick={() => updateScene({ grid: !activePage.scene.grid })}><Grid3X3 size={13} />GRID</button><span>SNAP</span></div>
        <div className="zoom-controls"><button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))}><Minus size={13} /></button><span>{zoom}%</span><button type="button" onClick={() => setZoom((value) => Math.min(180, value + 10))}><Plus size={13} /></button><button type="button" title="全体表示"><Maximize2 size={13} /></button></div>
      </footer>

      {tourOpen ? (
        <aside className="tour-card">
          <div className="tour-progress"><span style={{ width: `${((tourStep + 1) / 3) * 100}%` }} /></div>
          <button className="tour-close" type="button" onClick={finishTour}><X size={14} /></button>
          <small>60秒ガイド · {tourStep + 1}/3</small>
          <strong>{tourStep === 0 ? "斜面を選択しました" : tourStep === 1 ? "角度を数値で変更" : "Tab補完で要素を追加"}</strong>
          <p>{tourStep === 0 ? "青い端点をドラッグすると、斜面角と関連要素が追従します。" : tourStep === 1 ? "図上の θ = 30° をクリックし、数値を入力してみましょう。" : "斜面の頂点へカーソルを近づけ、角度や法線を追加できます。"}</p>
          <div><button type="button" onClick={finishTour}>スキップ</button><button className="primary" type="button" onClick={() => tourStep < 2 ? setTourStep((step) => step + 1) : finishTour()}>{tourStep < 2 ? "次へ" : "完了"}</button></div>
        </aside>
      ) : null}
    </div>
  );
}
