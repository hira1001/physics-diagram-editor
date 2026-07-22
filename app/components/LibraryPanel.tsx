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
  Lock,
  Magnet,
  MousePointer2,
  MoveUpRight,
  Orbit,
  Pin,
  Search,
  Slash,
  Waves,
  Type,
  Unlock,
} from "lucide-react";
import type { SceneState, SelectionId, ToolId } from "@/app/lib/editor-types";

type LibraryTab = "add" | "structure";

interface LibraryPanelProps {
  activeTab: LibraryTab;
  activeTool: ToolId;
  query: string;
  scene: SceneState;
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
  locked?: boolean;
}> = [
  { id: "incline", name: "斜面", depth: 0, locked: true },
  { id: "angle", name: "角度弧  θ", depth: 1 },
  { id: "block", name: "物体  m", depth: 0 },
  { id: "force-gravity", name: "重力  mg", depth: 1 },
  { id: "force-normal", name: "垂直抗力  N", depth: 1 },
  { id: "force-friction", name: "摩擦力  f", depth: 1 },
  { id: "axis", name: "座標軸  x–y", depth: 0 },
];

export function LibraryPanel({
  activeTab,
  activeTool,
  query,
  scene,
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
        <button className={activeTab === "add" ? "active" : ""} type="button" onClick={() => onTabChange("add")} role="tab">
          追加
        </button>
        <button className={activeTab === "structure" ? "active" : ""} type="button" onClick={() => onTabChange("structure")} role="tab">
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
            <div className="section-heading"><ChevronDown size={14} />最近使用</div>
            <button className="template-row featured" type="button" onClick={() => onToolPick("incline")}>
              <span className="mini-template incline-template" aria-hidden="true"><i /><b /></span>
              <span><strong>斜面上の物体</strong><small>θ・m・力を連動</small></span>
              <Pin size={13} />
            </button>
            <button className="template-row" type="button" onClick={() => onToolPick("pulley")}>
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
                    onClick={() => onToolPick(item.id)}
                    onDoubleClick={() => onToolPick(item.id)}
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
          <button className="library-footer" type="button">
            <Orbit size={15} />テンプレートを開く<span>12</span>
          </button>
        </>
      ) : (
        <>
          <div className="structure-header">
            <span>図1</span>
            <button type="button" aria-label="推論を切り替え"><Magnet size={15} /></button>
          </div>
          <div className="structure-list">
            {structureItems.map((item) => {
              const isVisible = item.id === "angle" ? scene.showAngle : item.id === "axis" ? scene.showAxis : true;
              return (
                <button
                  className={`structure-row ${scene.selectedId === item.id ? "active" : ""}`}
                  key={item.id}
                  type="button"
                  style={{ paddingLeft: `${12 + item.depth * 18}px` }}
                  onClick={() => onSelect(item.id)}
                  onDoubleClick={() => {
                    if (item.id === "angle") onSceneChange({ showAngle: !scene.showAngle });
                    if (item.id === "axis") onSceneChange({ showAxis: !scene.showAxis });
                  }}
                  title={item.id === "angle" || item.id === "axis" ? "ダブルクリックで表示を切り替え" : item.name}
                >
                  {item.depth === 0 ? <ChevronRight size={12} /> : <span className="tree-elbow">└</span>}
                  <MousePointer2 size={13} />
                  <span>{item.id === "incline" ? `${item.name}  θ = ${scene.angle}°` : item.name}</span>
                  {item.locked ? <Lock size={12} /> : <Unlock size={12} className="muted-icon" />}
                  <span className="visibility-control" aria-hidden="true">
                    {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
