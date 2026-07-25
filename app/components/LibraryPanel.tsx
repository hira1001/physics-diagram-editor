"use client";

import { useState } from "react";
import {
  Axis3D,
  Box,
  ChevronRight,
  CircleDot,
  Droplets,
  Eye,
  EyeOff,
  Gauge,
  Lock,
  Magnet,
  MousePointer2,
  MoveUpRight,
  Orbit,
  Search,
  Slash,
  Sparkles,
  Type,
  Unlock,
  Waves,
} from "lucide-react";
import type { SceneState, SelectionId, TemplateId, ToolId } from "@/app/lib/editor-types";
import { surfaceDisplayName } from "@/app/lib/physics-rules";
import { componentToolId, PHYSICS_COMPONENT_CATALOG, searchComponentCatalog, type ComponentCategory } from "@/app/lib/component-catalog";

type LibraryTab = "add" | "structure";
type CategoryKey = "featured" | ComponentCategory;

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

const CATEGORIES: Array<{
  id: CategoryKey;
  name: string;
  shortName: string;
  icon: typeof Box;
}> = [
  { id: "featured", name: "おすすめ", shortName: "おすすめ", icon: Sparkles },
  { id: "物体", name: "剛体・物体", shortName: "物体", icon: Box },
  { id: "接触面", name: "接触面", shortName: "接触面", icon: Slash },
  { id: "支持", name: "支持・固定", shortName: "支持", icon: Magnet },
  { id: "接続", name: "接続・ひも", shortName: "接続", icon: Waves },
  { id: "機械要素", name: "滑車・回転", shortName: "滑車", icon: CircleDot },
  { id: "軌道", name: "軌道・線", shortName: "軌道", icon: Orbit },
  { id: "流体", name: "流体・容器", shortName: "流体", icon: Droplets },
  { id: "ベクトル", name: "ベクトル・力", shortName: "ベクトル", icon: MoveUpRight },
  { id: "注釈", name: "注釈・寸法", shortName: "注釈", icon: Gauge },
];

const libraryItems: Array<{
  id: ToolId;
  name: string;
  meta: string;
  icon: typeof Box;
}> = [
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
  { id: "incline", name: "接触面", depth: 0 },
  { id: "angle", name: "角度弧  θ", depth: 1 },
  { id: "block", name: "物体  m", depth: 0 },
  { id: "mass-label", name: "質量ラベル  m", depth: 1 },
  { id: "force-gravity", name: "重力  mg", depth: 1 },
  { id: "force-normal", name: "垂直抗力  N", depth: 1 },
  { id: "force-friction", name: "摩擦力  f", depth: 1 },
  { id: "axis", name: "座標軸  x–y", depth: 0 },
];

const categoryIcons: Record<ComponentCategory, typeof Box> = {
  物体: Box,
  接触面: Slash,
  支持: Magnet,
  接続: Waves,
  機械要素: CircleDot,
  軌道: Orbit,
  流体: Droplets,
  ベクトル: MoveUpRight,
  注釈: Gauge,
};

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
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("featured");

  const searchResults = query.trim() ? searchComponentCatalog(query) : null;
  const filteredQuickItems = libraryItems.filter((item) => item.name.includes(query.trim()));

  const activeCategoryDef = CATEGORIES.find((item) => item.id === selectedCategory)!;
  const categoryComponents = selectedCategory === "featured"
    ? []
    : PHYSICS_COMPONENT_CATALOG.filter((item) => item.category === selectedCategory);

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

          <div className="category-container">
            <nav className="category-rail" aria-label="部品カテゴリ一覧">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const count = cat.id === "featured"
                  ? 7
                  : PHYSICS_COMPONENT_CATALOG.filter((item) => item.category === cat.id).length;
                const isActive = !query.trim() && selectedCategory === cat.id;

                return (
                  <button
                    className={`category-rail-btn ${isActive ? "active" : ""}`}
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      onQueryChange("");
                    }}
                    title={`${cat.name} (${count}個)`}
                  >
                    <Icon size={16} />
                    <span>{cat.shortName}</span>
                    <span className="badge">{count}</span>
                  </button>
                );
              })}
            </nav>

            <div className="category-subpanel">
              {searchResults !== null ? (
                <>
                  <div className="category-subpanel-title">
                    <span>検索結果</span>
                    <span className="section-count">{searchResults.length + filteredQuickItems.length}</span>
                  </div>
                  <div className="component-list">
                    {filteredQuickItems.map((item) => {
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
                          {item.meta ? <kbd>{item.meta}</kbd> : <span />}
                        </button>
                      );
                    })}
                    {searchResults.map((item) => {
                      const toolId = componentToolId(item.kind);
                      const CategoryIcon = categoryIcons[item.category];
                      return (
                        <button
                          className={`component-row catalog-row ${activeTool === toolId ? "active" : ""}`}
                          key={item.kind}
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "copy";
                            event.dataTransfer.setData("application/x-physics-tool", toolId);
                            onToolPick(toolId);
                          }}
                          onClick={() => onToolPick(toolId)}
                          title={`${item.name} — ${item.physics.join("・")}`}
                        >
                          <CategoryIcon size={16} />
                          <span>{item.name}</span>
                          {item.defaultLabel ? <code>{item.defaultLabel}</code> : <span />}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : selectedCategory === "featured" ? (
                <>
                  <section className="library-section">
                    <div className="section-heading">テンプレート</div>
                    <button className="template-row featured" type="button" onClick={() => onApplyTemplate("incline")}>
                      <span className="mini-template incline-template" aria-hidden="true"><i /><b /></span>
                      <span><strong>斜面上の物体</strong><small>θ・m・力を連動</small></span>
                    </button>
                    <button className="template-row" type="button" onClick={() => onApplyTemplate("pulley")}>
                      <span className="mini-template pulley-template" aria-hidden="true"><i /><b /></span>
                      <span><strong>二物体と滑車</strong><small>糸と張力を接続</small></span>
                    </button>
                    <button className="template-row" type="button" onClick={() => onApplyTemplate("rough-wall")}>
                      <span className="mini-template incline-template" aria-hidden="true"><i /><b /></span>
                      <span><strong>粗い壁と物体</strong><small>N・fを連動</small></span>
                    </button>
                  </section>

                  <section className="library-section grow">
                    <div className="section-heading">基本ツール</div>
                    <div className="component-list">
                      {libraryItems.map((item) => {
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
                            {item.meta ? <kbd>{item.meta}</kbd> : <span />}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <div className="category-subpanel-title">
                    <span>{activeCategoryDef.name}</span>
                    <span className="section-count">{categoryComponents.length}個</span>
                  </div>
                  <div className="component-list vertical-catalog">
                    {categoryComponents.map((item) => {
                      const toolId = componentToolId(item.kind);
                      const CategoryIcon = categoryIcons[item.category];
                      return (
                        <button
                          className={`component-row catalog-row ${activeTool === toolId ? "active" : ""}`}
                          key={item.kind}
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "copy";
                            event.dataTransfer.setData("application/x-physics-tool", toolId);
                            onToolPick(toolId);
                          }}
                          onClick={() => onToolPick(toolId)}
                          title={`${item.name} — ${item.physics.join("・")}`}
                        >
                          <CategoryIcon size={16} />
                          <span>{item.name}</span>
                          {item.defaultLabel ? <code>{item.defaultLabel}</code> : <span />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <button className="library-footer" type="button" onClick={onOpenTemplates}>
            <Orbit size={15} />テンプレートを開く<span>8</span>
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
                  <button className="structure-select" type="button" aria-label={item.id === "incline" ? `${surfaceDisplayName(scene.surfaceKind, scene.surfaceRoughness)}${scene.surfaceKind === "incline" ? ` θ = ${scene.angle}°` : ""}` : item.name} onClick={() => onSelect(item.id)}>
                    {item.depth === 0 ? <ChevronRight size={12} /> : <span className="tree-elbow">└</span>}
                    <MousePointer2 size={13} />
                    <span>{item.id === "incline" ? `${surfaceDisplayName(scene.surfaceKind, scene.surfaceRoughness)}${scene.surfaceKind === "incline" ? `  θ = ${scene.angle}°` : ""}` : item.name}</span>
                  </button>
                  {canToggle ? <button className="visibility-control" type="button" onClick={toggleVisibility} aria-label={`${item.name}を${isVisible ? "非表示" : "表示"}`}>{isVisible ? <Eye size={13} /> : <EyeOff size={13} />}</button> : <span />}
                </div>
              );
            })}
            {scene.elements.map((element) => {
              const definition = PHYSICS_COMPONENT_CATALOG.find((item) => item.kind === element.kind)!;
              const selectionId = `element:${element.id}` as SelectionId;
              return <div className={`structure-row catalog-structure ${scene.selectedId === selectionId ? "active" : ""}`} key={element.id}>
                <button className="structure-select" type="button" aria-label={`${definition.name} ${element.label}`.trim()} onClick={() => onSelect(selectionId)}>
                  <ChevronRight size={12} /><MousePointer2 size={13} /><span>{definition.name}{element.label ? `  ${element.label}` : ""}</span>
                </button>
                <span className="structure-actions">
                  <button className="visibility-control" type="button" onClick={() => onSceneChange({ elements: scene.elements.map((item) => item.id === element.id ? { ...item, locked: !item.locked } : item) })} aria-label={`${definition.name}を${element.locked ? "ロック解除" : "ロック"}`}>{element.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                  <button className="visibility-control" type="button" onClick={() => onSceneChange({ elements: scene.elements.map((item) => item.id === element.id ? { ...item, visible: !item.visible } : item) })} aria-label={`${definition.name}を${element.visible ? "非表示" : "表示"}`}>{element.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                </span>
              </div>;
            })}
          </div>
        </>
      )}
    </aside>
  );
}
