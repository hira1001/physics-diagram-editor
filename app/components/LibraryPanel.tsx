"use client";

import {
  Axis3D,
  Box,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Eye,
  EyeOff,
  Gauge,
  Magnet,
  MousePointer2,
  MoveUpRight,
  Orbit,
  Search,
  Slash,
  Waves,
  Type,
} from "lucide-react";
import type { SceneState, SelectionId, TemplateId, ToolId } from "@/app/lib/editor-types";

type LibraryTab = "add" | "structure";

interface LibraryPanelProps {
  activeTab: LibraryTab;
  activeTool: ToolId;
  query: string;
  pageTitle: string;
  scene: SceneState;
  onApplyTemplate: (template: TemplateId) => void;
  onOpenTemplates: () => void;
  onQueryChange: (value: string) => void;
  onSceneChange: (patch: Partial<SceneState>) => void;
  onSelect: (id: SelectionId) => void;
  onTabChange: (tab: LibraryTab) => void;
  onToolPick: (tool: ToolId) => void;
}

const libraryItems: Array<{
  id: ToolId;
  name: string;
  meta: string;
  icon: typeof Box;
}> = [
  { id: "incline", name: "斜面", meta: "P", icon: Slash },
  { id: "block", name: "物体", meta: "B", icon: Box },
  { id: "force", name: "力ベクトル", meta: "F", icon: MoveUpRight },
  { id: "angle", name: "角度・寸法", meta: "A", icon: Gauge },
  { id: "axis", name: "座標軸", meta: "X", icon: Axis3D },
  { id: "spring", name: "ばね", meta: "S", icon: Waves },
  { id: "pulley", name: "滑車・糸", meta: "U", icon: CircleDot },
  { id: "text", name: "テキスト", meta: "T", icon: Type },
];

const structureItems: Array<{
  id: Exclude<SelectionId, null>;
  name: string;
  depth: number;
}> = [
  { id: "incline", name: "斜面", depth: 0 },
  { id: "angle", name: "角度弧  θ", depth: 1 },
  { id: "block", name: "物体  m", depth: 0 },
  { id: "mass-label", name: "質量ラベル  m", depth: 1 },
  { id: "force-gravity", name: "重力  mg", depth: 1 },
  { id: "force-normal", name: "垂直抗力  N", depth: 1 },
  { id: "force-friction", name: "摩擦力  f", depth: 1 },
  { id: "axis", name: "座標軸  x–y", depth: 0 },
];

export function LibraryPanel({
  activeTab,
  activeTool,
  query,
  pageTitle,
  scene,
  onApplyTemplate,
  onOpenTemplates,
  onQueryChange,
  onSceneChange,
  onSelect,
  onTabChange,
  onToolPick,
}: LibraryPanelProps) {
  const filteredItems = libraryItems.filter((item) => item.name.includes(query.trim()));

  return (
    <aside className="library-panel" aria-label="部品と図の構造">
      <div className="panel-tabs" role="tablist" aria-label="左パネル">
        <button aria-selected={activeTab === "add"} className={activeTab === "add" ? "active" : ""} type="button" onClick={() => onTabChange("add")} role="tab">
          追加
        </button>
        <button aria-selected={activeTab === "structure"} className={activeTab === "structure" ? "active" : ""} type="button" onClick={() => onTabChange("structure")} role="tab">
          構造
        </button>
      </div>

      {activeTab === "add" ? (
        <>
          <label className="panel-search">
            <Search size={14} />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="部品を検索" />
          </label>
          <section className="library-section">
            <div className="section-heading"><ChevronDown size={14} />おすすめ</div>
            <button className="template-row featured" type="button" onClick={() => onApplyTemplate("incline")}>
              <span className="mini-template incline-template" aria-hidden="true"><i /><b /></span>
              <span><strong>斜面上の物体</strong><small>θ・m・力を連動</small></span>
            </button>
            <button className="template-row" type="button" onClick={() => onApplyTemplate("pulley")}>
              <span className="mini-template pulley-template" aria-hidden="true"><i /><b /></span>
              <span><strong>二物体と滑車</strong><small>糸と張力を接続</small></span>
            </button>
          </section>
          <section className="library-section grow">
            <div className="section-heading"><ChevronDown size={14} />部品</div>
            <div className="component-list">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className={`component-row ${activeTool === item.id ? "active" : ""}`}
                    key={item.id}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData("application/x-physics-tool", item.id);
                      onToolPick(item.id);
                    }}
                    onClick={() => onToolPick(item.id)}
                    title={`${item.name} — ${item.meta}`}
                  >
                    <Icon size={17} />
                    <span>{item.name}</span>
                    <kbd>{item.meta}</kbd>
                  </button>
                );
              })}
            </div>
          </section>
          <button className="library-footer" type="button" onClick={onOpenTemplates}>
            <Orbit size={15} />テンプレートを開く<span>4</span>
          </button>
        </>
      ) : (
        <>
          <div className="structure-header">
            <span>{pageTitle}</span>
            <button className={scene.snapEnabled ? "active" : ""} type="button" aria-label="推論を切り替え" onClick={() => onSceneChange({ snapEnabled: !scene.snapEnabled })}><Magnet size={15} /></button>
          </div>
          <div className="structure-list">
            {structureItems.map((item) => {
              const isVisible = item.id === "angle" ? scene.showAngle
                : item.id === "axis" ? scene.showAxis
                  : item.id === "force-gravity" ? scene.showGravity
                    : item.id === "force-normal" ? scene.showNormal
                      : item.id === "force-friction" ? scene.showFriction
                        : true;
              const canToggle = item.id === "angle" || item.id === "axis" || item.id.startsWith("force-");
              const toggleVisibility = () => {
                if (item.id === "angle") onSceneChange({ showAngle: !scene.showAngle });
                if (item.id === "axis") onSceneChange({ showAxis: !scene.showAxis });
                if (item.id === "force-gravity") onSceneChange({ showGravity: !scene.showGravity });
                if (item.id === "force-normal") onSceneChange({ showNormal: !scene.showNormal });
                if (item.id === "force-friction") onSceneChange({ showFriction: !scene.showFriction });
              };
              return (
                <div
                  className={`structure-row ${scene.selectedId === item.id ? "active" : ""}`}
                  key={item.id}
                  style={{ paddingLeft: `${12 + item.depth * 18}px` }}
                >
                  <button className="structure-select" type="button" aria-label={item.id === "incline" ? `${item.name} θ = ${scene.angle}°` : item.name} onClick={() => onSelect(item.id)}>
                    {item.depth === 0 ? <ChevronRight size={12} /> : <span className="tree-elbow">└</span>}
                    <MousePointer2 size={13} />
                    <span>{item.id === "incline" ? `${item.name}  θ = ${scene.angle}°` : item.name}</span>
                  </button>
                  {canToggle ? <button className="visibility-control" type="button" onClick={toggleVisibility} aria-label={`${item.name}を${isVisible ? "非表示" : "表示"}`}>{isVisible ? <Eye size={13} /> : <EyeOff size={13} />}</button> : <span />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
