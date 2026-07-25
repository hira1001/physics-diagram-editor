"use client";

import { useState } from "react";
import {
  Box,
  ChevronRight,
  CircleDot,
  Droplets,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  Lock,
  Magnet,
  MousePointer2,
  MoveUpRight,
  Orbit,
  Search,
  Slash,
  Sparkles,
  Unlock,
  Waves,
} from "lucide-react";
import type { SceneState, SelectionId, TemplateId, ToolId } from "@/app/lib/editor-types";
import { componentToolId, PHYSICS_COMPONENT_CATALOG, catalogEntry, searchComponentCatalog, type ComponentCategory } from "@/app/lib/component-catalog";

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
  { id: "構造力学", name: "構造・梁", shortName: "構造", icon: Layers3 },
  { id: "接続", name: "接続・ひも", shortName: "接続", icon: Waves },
  { id: "機械要素", name: "滑車・回転", shortName: "滑車", icon: CircleDot },
  { id: "軌道", name: "軌道・線", shortName: "軌道", icon: Orbit },
  { id: "流体", name: "流体・容器", shortName: "流体", icon: Droplets },
  { id: "ベクトル", name: "ベクトル・力", shortName: "ベクトル", icon: MoveUpRight },
  { id: "注釈", name: "注釈・寸法", shortName: "注釈", icon: Gauge },
];

const FEATURED_KINDS = [
  "block",
  "rough-incline",
  "rough-floor",
  "force",
  "gravity",
  "string",
  "spring",
  "fixed-pulley",
  "beam",
  "pin-support",
] as const;

const categoryIcons: Record<ComponentCategory, typeof Box> = {
  物体: Box,
  接触面: Slash,
  支持: Magnet,
  構造力学: Layers3,
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
  const featuredItems = FEATURED_KINDS.map((kind) => catalogEntry(kind));

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
                  ? FEATURED_KINDS.length
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
                    <span className="section-count">{searchResults.length}</span>
                  </div>
                  <div className="component-list">
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
                    <button className="template-row" type="button" onClick={() => onApplyTemplate("simply-supported-beam")}>
                      <span className="mini-template incline-template" aria-hidden="true"><i /><b /></span>
                      <span><strong>単純梁</strong><small>支点・分布荷重</small></span>
                    </button>
                  </section>

                  <section className="library-section grow">
                    <div className="section-heading">よく使う部品</div>
                    <div className="component-list">
                      {featuredItems.map((item) => {
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
                            <CategoryIcon size={17} />
                            <span>{item.name}</span>
                            {item.defaultLabel ? <code>{item.defaultLabel}</code> : <span />}
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
            <Orbit size={15} />テンプレートを開く<span>11</span>
          </button>
        </>
      ) : (
        <>
          <div className="structure-header">
            <span>{pageTitle}</span>
            <button className={scene.snapEnabled ? "active" : ""} type="button" aria-label="推論を切り替え" onClick={() => onSceneChange({ snapEnabled: !scene.snapEnabled })}><Magnet size={15} /></button>
          </div>
          <div className="structure-list">
            {scene.elements.length === 0 ? (
              <div className="structure-row" style={{ padding: "12px", color: "var(--text-soft)" }}>
                部品がありません。テンプレートか「追加」から配置してください。
              </div>
            ) : null}
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
