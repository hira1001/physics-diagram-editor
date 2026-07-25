"use client";

import { useRef, useState } from "react";
import {
  ChevronDown,
  FlipHorizontal2,
  Link2,
  MoveUpRight,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { SceneNumericInput, SceneTextInput } from "@/app/components/SceneInputs";
import { NumericInput } from "@/app/components/NumericInput";
import { VariableInput } from "@/app/components/VariableInput";
import type { DiagramElement, PageKind, SceneState } from "@/app/lib/editor-types";
import { hasSurfaceConflict, surfaceDisplayName } from "@/app/lib/physics-rules";
import { catalogEntry, catalogSurfaceDefaultRotation, catalogSurfaceKind, catalogSurfacePreset, createDiagramElement } from "@/app/lib/component-catalog";
import { contextCandidatesForElement, createConnection, createReferencedElement, createVariableForElement, findElementDependencies, isConnectionElement, isVectorElement, removeElementWithDependencies } from "@/app/lib/diagram-model";

interface InspectorPanelProps {
  scene: SceneState;
  pageKind: PageKind;
  onCreateFreeBody: () => void;
  onCommitSnapshot: (scene: SceneState) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
}

type SectionKey = "dimensions" | "quick" | "suggestions" | "variables" | "constraints" | "appearance";

const selectionNames: Record<string, string> = {
  incline: "斜面",
  block: "物体",
  "mass-label": "質量ラベル",
  "force-gravity": "重力ベクトル",
  "force-normal": "垂直抗力",
  "force-friction": "摩擦力",
  angle: "角度ラベル",
  axis: "座標軸",
  spring: "ばね",
  pulley: "滑車",
  text: "テキスト",
};

type ElementNumberKey = "fontSize" | "height" | "lineWidth" | "rotation" | "width" | "x" | "y";

function ElementNumericInput({ ariaLabel, element, property, scene, onCommitSnapshot, onSceneChange }: {
  ariaLabel?: string;
  element: DiagramElement;
  property: ElementNumberKey;
  scene: SceneState;
  onCommitSnapshot: (scene: SceneState) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
}) {
  const limits = property === "width" || property === "height"
    ? { min: 8, max: 1000 }
    : property === "rotation"
      ? { min: -3600, max: 3600 }
      : property === "fontSize"
        ? { min: 6, max: 96 }
        : property === "lineWidth"
          ? { min: 0.1, max: 12 }
          : { min: -2000, max: 3000 };
  const replace = (value: number, source = scene) => source.elements.map((item) => item.id === element.id ? { ...item, [property]: Math.min(limits.max, Math.max(limits.min, value)) } : item);
  return <NumericInput
    {...limits}
    aria-label={ariaLabel}
    step={property === "lineWidth" ? 0.1 : 1}
    value={element[property]}
    onValueChange={(value) => onSceneChange({ elements: replace(value) }, false)}
    onValueCommit={(_, initial) => onCommitSnapshot({ ...scene, elements: replace(initial) })}
    onValueCancel={(initial) => onSceneChange({ elements: replace(initial) }, false)}
  />;
}

function ElementLabelInput({ element, scene, onCommitSnapshot, onSceneChange }: {
  element: DiagramElement;
  scene: SceneState;
  onCommitSnapshot: (scene: SceneState) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
}) {
  const initial = useRef(element.label);
  const cancelled = useRef(false);
  return <input
    value={element.label}
    onFocus={() => { initial.current = element.label; cancelled.current = false; }}
    onChange={(event) => onSceneChange({ elements: scene.elements.map((item) => item.id === element.id ? { ...item, label: event.target.value.slice(0, 80) } : item) }, false)}
    onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") {
        cancelled.current = true;
        onSceneChange({ elements: scene.elements.map((item) => item.id === element.id ? { ...item, label: initial.current } : item) }, false);
        event.currentTarget.blur();
      }
    }}
    onBlur={() => {
      if (!cancelled.current && element.label !== initial.current) onCommitSnapshot({ ...scene, elements: scene.elements.map((item) => item.id === element.id ? { ...item, label: initial.current } : item) });
      cancelled.current = false;
    }}
  />;
}

export function InspectorPanel({ scene, pageKind, onCreateFreeBody, onCommitSnapshot, onSceneChange }: InspectorPanelProps) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    dimensions: true,
    quick: true,
    suggestions: true,
    variables: true,
    constraints: true,
    appearance: false,
  });
  const selectedElement = typeof scene.selectedId === "string" && scene.selectedId.startsWith("element:")
    ? scene.elements.find((item) => `element:${item.id}` === scene.selectedId) ?? null
    : null;
  const selectedName = scene.selectedId === "incline"
    ? surfaceDisplayName(scene.surfaceKind, scene.surfaceRoughness)
    : selectedElement
      ? catalogEntry(selectedElement.kind).name
      : scene.selectedId ? selectionNames[scene.selectedId] ?? "選択対象" : "選択なし";
  const isIncline = scene.selectedId === "incline";
  const isAngleLabel = scene.selectedId === "angle";
  const isBlock = scene.selectedId === "block" || scene.selectedId === "mass-label";
  const isText = scene.selectedId === "text";
  const isFreeBody = pageKind === "freebody";
  const surfaceConflict = hasSurfaceConflict(scene);
  const constraintConflicts = scene.constraints.filter((constraint) => constraint.enabled && constraint.conflict);
  const selectedVariables = selectedElement ? scene.variables.filter((variable) => variable.referenceIds.includes(selectedElement.id)) : [];
  const selectedCatalogSurface = selectedElement ? catalogSurfacePreset(selectedElement.kind) : null;
  const contextCandidates = selectedElement ? contextCandidatesForElement(selectedElement) : [];
  const selectedDependencies = selectedElement ? findElementDependencies(selectedElement.id, scene.elements, scene.variables, scene.constraints) : null;
  const hasDependencies = Boolean(selectedDependencies && (selectedDependencies.connections.length || selectedDependencies.constraints.length || selectedDependencies.variables.length));
  const [deletePending, setDeletePending] = useState(false);
  const addContactForces = () => onSceneChange({
    showGravity: true,
    showNormal: true,
    ...(scene.surfaceRoughness === "rough" ? { showFriction: true } : {}),
  });
  const toggleSection = (key: SectionKey) => setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  const updateSelectedElement = (patch: Partial<DiagramElement>) => {
    if (!selectedElement) return;
    onSceneChange({ elements: scene.elements.map((item) => item.id === selectedElement.id ? { ...item, ...patch } : item) });
  };
  const updateConnectionTarget = (key: "startTargetId" | "endTargetId", targetId: string) => {
    if (!selectedElement) return;
    const updated = { ...selectedElement, [key]: targetId || null };
    const withoutOwnConnection = scene.constraints.filter((constraint) => constraint.id !== `connection-${selectedElement.id}`);
    const connectionConstraint = updated.startTargetId && updated.endTargetId ? [{
      conflict: updated.startTargetId === updated.endTargetId ? "始点と終点が同じです" : null,
      enabled: true,
      id: `connection-${selectedElement.id}`,
      kind: "connection" as const,
      strength: "required" as const,
      targetIds: [updated.startTargetId, updated.endTargetId, updated.id],
    }] : [];
    onSceneChange({
      constraints: [...withoutOwnConnection, ...connectionConstraint],
      elements: scene.elements.map((item) => item.id === selectedElement.id ? updated : item),
    });
  };
  const removeSelectedElement = () => {
    if (!selectedElement) return;
    const next = removeElementWithDependencies(selectedElement.id, scene.elements, scene.variables, scene.constraints);
    onSceneChange({
      constraints: next.constraints,
      elements: next.elements,
      selectedId: null,
      variables: next.variables,
    });
    setDeletePending(false);
  };

  return (
    <aside className="inspector-panel" aria-label="選択対象の設定">
      <div className="inspector-title">
        <span className="selection-mark" />
        <div><small>選択</small><strong>{selectedName}</strong></div>
      </div>

      <section className={`inspector-section ${openSections.dimensions ? "open" : ""}`}>
        <button aria-expanded={openSections.dimensions} className="inspector-heading" type="button" onClick={() => toggleSection("dimensions")}><span>寸法・値</span><ChevronDown size={14} /></button>
        {openSections.dimensions ? <div className="inspector-content">
          {selectedElement ? <>
            <label className="property-row">
              <span>ラベル</span>
              <ElementLabelInput element={selectedElement} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} />
              {selectedElement.labelOffsetX || selectedElement.labelOffsetY ? (
                <button
                  type="button"
                  className="inline-action-btn"
                  title="文字位置をリセット"
                  onClick={() => updateSelectedElement({ labelOffsetX: 0, labelOffsetY: 0 })}
                >
                  位置リセット
                </button>
              ) : null}
            </label>
            {selectedCatalogSurface ? <>
              <label className="property-row"><span>向き</span><select aria-label="部品面の向き" value={selectedCatalogSurface.direction} onChange={(event) => {
                const direction = event.target.value as typeof selectedCatalogSurface.direction;
                updateSelectedElement({ kind: catalogSurfaceKind(direction, selectedCatalogSurface.roughness), rotation: catalogSurfaceDefaultRotation(direction) });
              }}><option value="floor">床</option><option value="incline">斜面</option><option value="wall">壁</option></select></label>
              <label className="property-row"><span>表面</span><select aria-label="部品面の粗さ" value={selectedCatalogSurface.roughness} onChange={(event) => updateSelectedElement({ kind: catalogSurfaceKind(selectedCatalogSurface.direction, event.target.value as typeof selectedCatalogSurface.roughness) })}><option value="smooth">滑らか</option><option value="rough">粗い</option></select></label>
              <div className="property-note"><Link2 size={13} />{selectedCatalogSurface.roughness === "rough" ? "法線・摩擦・μ候補" : "法線候補・摩擦なし"}</div>
              {selectedElement.kind === "smooth-incline" || selectedElement.kind === "rough-incline" || selectedElement.kind === "wedge" ? (
                <label className="property-row">
                  <span>角度 θ</span>
                  <div className="unit-input">
                    <NumericInput
                      aria-label="斜面角度"
                      min={5}
                      max={75}
                      value={Math.round(Math.atan2(selectedElement.height, selectedElement.width) * 180 / Math.PI)}
                      onChange={(val) => {
                        const rad = (val * Math.PI) / 180;
                        updateSelectedElement({ height: Math.round(selectedElement.width * Math.tan(rad)) });
                      }}
                    />
                    <b>°</b>
                  </div>
                </label>
              ) : null}
            </> : null}
            {isConnectionElement(selectedElement.kind) ? <>
              <label className="property-row"><span>始点 🟢</span><select aria-label="接続の始点" value={selectedElement.startTargetId ?? ""} onChange={(event) => updateConnectionTarget("startTargetId", event.target.value)}><option value="">未接続（自由端）</option>{scene.elements.filter((item) => item.id !== selectedElement.id && !isConnectionElement(item.kind)).map((item) => <option key={item.id} value={item.id}>{catalogEntry(item.kind).name} · {item.label || item.id.slice(0, 6)}</option>)}</select></label>
              <label className="property-row"><span>終点 🔵</span><select aria-label="接続の終点" value={selectedElement.endTargetId ?? ""} onChange={(event) => updateConnectionTarget("endTargetId", event.target.value)}><option value="">未接続（自由端）</option>{scene.elements.filter((item) => item.id !== selectedElement.id && !isConnectionElement(item.kind)).map((item) => <option key={item.id} value={item.id}>{catalogEntry(item.kind).name} · {item.label || item.id.slice(0, 6)}</option>)}</select></label>
              {selectedElement.startTargetId || selectedElement.endTargetId ? (
                <button
                  type="button"
                  className="full-width-btn warning-btn"
                  onClick={() => {
                    updateSelectedElement({ startTargetId: null, endTargetId: null });
                  }}
                >
                  <Link2 size={13} />
                  接続を分解・解除する
                </button>
              ) : (
                <div className="property-note">
                  <Link2 size={13} />
                  緑/青の端点を対象物体へドラッグして接続できます
                </div>
              )}
            </> : null}
            {isVectorElement(selectedElement.kind) ? <label className="property-row"><span>作用対象</span><select aria-label="ベクトルの作用対象" value={selectedElement.referenceTargetId ?? ""} onChange={(event) => updateSelectedElement({ referenceTargetId: event.target.value || null })}><option value="">独立</option>{scene.elements.filter((item) => item.id !== selectedElement.id && !isVectorElement(item.kind)).map((item) => <option key={item.id} value={item.id}>{catalogEntry(item.kind).name} · {item.label || item.id.slice(0, 6)}</option>)}</select></label> : null}
            {!(isConnectionElement(selectedElement.kind) && selectedElement.startTargetId && selectedElement.endTargetId) ? <>
              {!selectedElement.referenceTargetId ? <><label className="property-row"><span>X</span><ElementNumericInput element={selectedElement} property="x" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
              <label className="property-row"><span>Y</span><ElementNumericInput element={selectedElement} property="y" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label></> : <div className="property-note"><Link2 size={13} />作用対象の移動へ追従</div>}
              <label className="property-row"><span>幅</span><ElementNumericInput element={selectedElement} property="width" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
              <label className="property-row"><span>高さ</span><ElementNumericInput element={selectedElement} property="height" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
              <label className="property-row"><span>回転</span><div className="unit-input"><ElementNumericInput element={selectedElement} property="rotation" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>°</b></div></label>
              <div className="rotation-presets">
                <button
                  type="button"
                  className="preset-chip"
                  title="斜面と平行にする"
                  onClick={() => {
                    const inclineAngle = scene.surfaceKind === "incline" ? (scene.flipped ? scene.angle : -scene.angle) : -30;
                    updateSelectedElement({ rotation: inclineAngle });
                  }}
                >
                  斜面平行
                </button>
                {[0, 30, 45, 60, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    className={`preset-chip ${selectedElement.rotation === deg ? "active" : ""}`}
                    onClick={() => updateSelectedElement({ rotation: deg })}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </> : <div className="property-note"><Link2 size={13} />接続先の移動へ追従</div>}
          </> : isIncline ? <>
            <label className="property-row"><span>面</span><select aria-label="接触面の向き" value={scene.surfaceKind} onChange={(event) => onSceneChange({ surfaceKind: event.target.value as SceneState["surfaceKind"], showAngle: event.target.value === "incline" })}><option value="floor">床</option><option value="incline">斜面</option><option value="wall">壁</option></select></label>
            <label className="property-row"><span>表面</span><select aria-label="接触面の粗さ" value={scene.surfaceRoughness} onChange={(event) => onSceneChange({ surfaceRoughness: event.target.value as SceneState["surfaceRoughness"] })}><option value="smooth">滑らか</option><option value="rough">粗い</option></select></label>
            {scene.surfaceKind === "incline" ? <>
              <label className="property-row"><span>角度</span><div className="unit-input"><SceneNumericInput min="5" max="75" property="angle" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>°</b></div></label>
              <input className="angle-range" type="range" min="5" max="75" value={scene.angle} onChange={(event) => onSceneChange({ angle: Number(event.target.value) })} aria-label="斜面の角度" />
            </> : null}
            <label className="property-row"><span>図 X</span><SceneNumericInput property="diagramOffsetX" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
            <label className="property-row"><span>図 Y</span><SceneNumericInput property="diagramOffsetY" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
          </> : isAngleLabel ? <>
            <label className="property-row"><span>角度</span><div className="unit-input"><SceneNumericInput min="5" max="75" property="angle" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>°</b></div></label>
            <label className="property-row"><span>文字 X</span><SceneNumericInput property="angleLabelOffsetX" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
            <label className="property-row"><span>文字 Y</span><SceneNumericInput property="angleLabelOffsetY" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
          </> : null}
          {isBlock ? <>
            <label className="property-row"><span>ラベル</span><SceneTextInput property="massLabel" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
            {!isFreeBody ? <label className="property-row"><span>位置</span><div className="unit-input"><SceneNumericInput min="12" max="88" property="blockPosition" scale={100} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>%</b></div></label> : null}
            <label className="property-row"><span>文字 X</span><SceneNumericInput property="massLabelOffsetX" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
            <label className="property-row"><span>文字 Y</span><SceneNumericInput property="massLabelOffsetY" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
            {isFreeBody ? <>
              <label className="property-row"><span>図 X</span><SceneNumericInput property="diagramOffsetX" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
              <label className="property-row"><span>図 Y</span><SceneNumericInput property="diagramOffsetY" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
            </> : !scene.contactConstraint ? <>
              <label className="property-row"><span>物体 X</span><SceneNumericInput property="blockOffsetX" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
              <label className="property-row"><span>物体 Y</span><SceneNumericInput property="blockOffsetY" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
            </> : null}
          </> : null}
          {isText ? <>
            <label className="property-row"><span>文字</span><SceneTextInput property="annotationText" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></label>
            <label className="property-row"><span>X</span><div className="unit-input"><SceneNumericInput min="4" max="96" property="annotationX" scale={100} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>%</b></div></label>
            <label className="property-row"><span>Y</span><div className="unit-input"><SceneNumericInput min="4" max="96" property="annotationY" scale={100} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>%</b></div></label>
          </> : null}
          {!selectedElement && !isIncline && !isAngleLabel && !isBlock && !isText ? <label className="property-row"><span>ベクトル</span><div className="unit-input"><SceneNumericInput min="50" max="180" property="forceScale" scale={100} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>%</b></div></label> : null}
        </div> : null}
      </section>

      <section className={`inspector-section ${openSections.quick ? "open" : ""}`}>
        <button aria-expanded={openSections.quick} className="inspector-heading" type="button" onClick={() => toggleSection("quick")}><span>クイック操作</span><ChevronDown size={14} /></button>
        {openSections.quick ? <div className="quick-grid">
          {selectedElement ? <>
            {isVectorElement(selectedElement.kind) ? <button type="button" onClick={() => updateSelectedElement({ rotation: selectedElement.rotation + 180 })}><FlipHorizontal2 size={15} />反転</button> : null}
            <button type="button" onClick={() => {
              const copy = { ...selectedElement, id: globalThis.crypto.randomUUID(), x: selectedElement.x + 30, y: selectedElement.y + 30, locked: false };
              onSceneChange({ elements: [...scene.elements, copy], selectedId: `element:${copy.id}` });
            }}><Plus size={15} />複製</button>
            <button className={selectedElement.locked ? "active" : ""} type="button" onClick={() => updateSelectedElement({ locked: !selectedElement.locked })}><Link2 size={15} />{selectedElement.locked ? "ロック解除" : "ロック"}</button>
            <button type="button" onClick={() => hasDependencies ? setDeletePending(true) : removeSelectedElement()}><Trash2 size={15} />削除</button>
          </> : isText ? <>
            <button type="button" onClick={() => onSceneChange({ annotationX: 0.5, annotationY: 0.2 })}><RotateCcw size={15} />中央へ戻す</button>
            <button type="button" onClick={() => onSceneChange({ showAnnotation: false, selectedId: null })}><Trash2 size={15} />削除</button>
          </> : isFreeBody ? <>
            <button type="button" onClick={addContactForces}><MoveUpRight size={15} />力を追加</button>
            <button type="button" onClick={() => onSceneChange({ diagramOffsetX: 0, diagramOffsetY: 0 })}><RotateCcw size={15} />中央へ戻す</button>
          </> : <>
            <button type="button" onClick={addContactForces}><MoveUpRight size={15} />力を追加</button>
            <button type="button" onClick={() => onSceneChange({ flipped: !scene.flipped, blockPosition: 1 - scene.blockPosition })}><FlipHorizontal2 size={15} />左右反転</button>
            <button className={scene.contactConstraint ? "active" : ""} type="button" onClick={() => onSceneChange({ contactConstraint: !scene.contactConstraint, ...(!scene.contactConstraint ? { blockOffsetX: 0, blockOffsetY: 0 } : {}) })}><Link2 size={15} />{scene.contactConstraint ? "接触中" : "接続"}</button>
            <button type="button" onClick={onCreateFreeBody}><RotateCcw size={15} />自由体図</button>
          </>}
        </div> : null}
      </section>

      {selectedElement ? <section className={`inspector-section ${openSections.suggestions ? "open" : ""}`}>
        <button aria-expanded={openSections.suggestions} className="inspector-heading" type="button" onClick={() => toggleSection("suggestions")}><span>物理候補・要素接続</span><ChevronDown size={14} /></button>
        {openSections.suggestions ? <div className="quick-grid physics-candidates">
          {!isConnectionElement(selectedElement.kind) ? <>
            <button type="button" onClick={() => {
              const other = scene.elements.find((item) => item.id !== selectedElement.id && !isConnectionElement(item.kind))
                ?? createDiagramElement("fixed-end", selectedElement.x - 130, selectedElement.y);
              const hasOther = scene.elements.some((item) => item.id === other.id);
              const connection = createConnection("string", selectedElement, other);
              onSceneChange({
                elements: hasOther ? [...scene.elements, connection] : [...scene.elements, other, connection],
                selectedId: `element:${connection.id}`,
              });
            }}><Link2 size={15} />ひもで接続</button>
            <button type="button" onClick={() => {
              const other = scene.elements.find((item) => item.id !== selectedElement.id && !isConnectionElement(item.kind))
                ?? createDiagramElement("fixed-end", selectedElement.x - 130, selectedElement.y);
              const hasOther = scene.elements.some((item) => item.id === other.id);
              const connection = createConnection("spring", selectedElement, other);
              onSceneChange({
                elements: hasOther ? [...scene.elements, connection] : [...scene.elements, other, connection],
                selectedId: `element:${connection.id}`,
              });
            }}><Link2 size={15} />ばねで接続</button>
            <button type="button" onClick={() => {
              const other = scene.elements.find((item) => item.id !== selectedElement.id && !isConnectionElement(item.kind))
                ?? createDiagramElement("fixed-end", selectedElement.x - 130, selectedElement.y);
              const hasOther = scene.elements.some((item) => item.id === other.id);
              const connection = createConnection("light-rod", selectedElement, other);
              onSceneChange({
                elements: hasOther ? [...scene.elements, connection] : [...scene.elements, other, connection],
                selectedId: `element:${connection.id}`,
              });
            }}><Link2 size={15} />棒で接続</button>
          </> : null}
          {contextCandidates.map((kind) => {
            const definition = catalogEntry(kind);
            const exists = scene.elements.some((item) => item.kind === kind && item.referenceTargetId === selectedElement.id);
            return <button disabled={exists && kind !== "force"} key={kind} type="button" onClick={() => {
              const added = createReferencedElement(kind, selectedElement);
              onSceneChange({
                elements: [...scene.elements, added],
                selectedId: `element:${added.id}`,
                variables: [...scene.variables, createVariableForElement(added)],
              });
            }}><MoveUpRight size={15} />{exists && kind !== "force" ? `${definition.defaultLabel || definition.name} 追加済み` : definition.defaultLabel || definition.name}</button>;
          })}
        </div> : null}
      </section> : null}

      <section className={`inspector-section ${openSections.variables ? "open" : ""}`}>
        <button aria-expanded={openSections.variables} className="inspector-heading" type="button" onClick={() => toggleSection("variables")}><span>変量</span><ChevronDown size={14} /></button>
        {openSections.variables ? <div className="token-list">
          {selectedElement ? <>
            {selectedVariables.map((variable) => <div className="custom-variable-row" key={variable.id}>
              <VariableInput aria-label="変量記号" property="symbol" variable={variable} syncElementId={selectedElement.id} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} />
              <VariableInput aria-label="変量値" property="value" variable={variable} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} placeholder="値" />
              <VariableInput aria-label="変量単位" property="unit" variable={variable} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} placeholder="単位" />
              <button type="button" aria-label="変量を削除" onClick={() => onSceneChange({ variables: scene.variables.filter((item) => item.id !== variable.id) })}><Trash2 size={13} /></button>
            </div>)}
            {selectedVariables.map((variable) => <div className="property-note" key={`${variable.id}-meta`}><Link2 size={13} />型 {variable.type} · 参照 {variable.referenceIds.length}</div>)}
            {!selectedVariables.length ? <button className="add-row" type="button" onClick={() => onSceneChange({ variables: [...scene.variables, createVariableForElement(selectedElement)] })}><Plus size={13} />ラベルを変量化</button> : null}
          </> : <>
            <button className="token-row active" type="button" onClick={() => onSceneChange({ selectedId: "angle" })}><i>θ</i><span>斜面角</span><b>{scene.angle}°</b></button>
            <button className="token-row" type="button" onClick={() => onSceneChange({ selectedId: "mass-label" })}><i>m</i><span>質量</span><b>— kg</b></button>
          </>}
          {!selectedElement && scene.surfaceRoughness === "rough" ? <div className="friction-variable-row"><i>μ</i><span>摩擦係数</span><SceneNumericInput aria-label="摩擦係数" min="0" max="10" step="0.05" property="surfaceFrictionCoefficient" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></div> : null}
          {!selectedElement && (scene.customVariableSymbol ? <div className="custom-variable-row">
            <input aria-label="変量記号" value={scene.customVariableSymbol} onChange={(event) => onSceneChange({ customVariableSymbol: event.target.value })} />
            <input aria-label="変量値" value={scene.customVariableValue} onChange={(event) => onSceneChange({ customVariableValue: event.target.value })} placeholder="値" />
            <input aria-label="変量単位" value={scene.customVariableUnit} onChange={(event) => onSceneChange({ customVariableUnit: event.target.value })} placeholder="単位" />
            <button type="button" aria-label="追加変量を削除" onClick={() => onSceneChange({ customVariableSymbol: "", customVariableValue: "", customVariableUnit: "" })}><Trash2 size={13} /></button>
          </div> : <button className="add-row" type="button" onClick={() => onSceneChange({ customVariableSymbol: "a", customVariableValue: "", customVariableUnit: "m/s²" })}><Plus size={13} />変量を追加</button>)}
        </div> : null}
      </section>

      <section className={`inspector-section ${openSections.constraints ? "open" : ""}`}>
        <button aria-expanded={openSections.constraints} className="inspector-heading" type="button" onClick={() => toggleSection("constraints")}><span>制約</span><ChevronDown size={14} /></button>
        {openSections.constraints ? <div className="constraint-list">
          {deletePending && selectedElement ? <div className="constraint-conflict" role="alert"><strong>参照中の部品です</strong><span>接続 {selectedDependencies?.connections.length ?? 0} · 変量 {selectedDependencies?.variables.length ?? 0} · 制約 {selectedDependencies?.constraints.length ?? 0}</span><div><button type="button" onClick={removeSelectedElement}>依存関係ごと削除</button><button type="button" onClick={() => setDeletePending(false)}>取消</button></div></div> : null}
          {surfaceConflict ? <div className="constraint-conflict" role="alert"><strong>滑らかな面に摩擦力があります</strong><span>物理条件が競合しています</span><div><button type="button" onClick={() => onSceneChange({ surfaceRoughness: "rough" })}>粗い面に変更</button><button type="button" onClick={() => onSceneChange({ showFriction: false })}>摩擦力を外す</button></div></div> : null}
          {constraintConflicts.map((constraint) => <div className="constraint-conflict" role="alert" key={constraint.id}><strong>{constraint.conflict}</strong><span>{constraint.kind} · 対象 {constraint.targetIds.length}</span><div><button type="button" onClick={() => onSceneChange({ constraints: scene.constraints.map((item) => item.id === constraint.id ? { ...item, enabled: false, conflict: null } : item) })}>制約を無効</button></div></div>)}
          {!selectedElement && !isFreeBody ? <button className={scene.contactConstraint ? "active" : ""} type="button" onClick={() => onSceneChange({ contactConstraint: !scene.contactConstraint, ...(!scene.contactConstraint ? { blockOffsetX: 0, blockOffsetY: 0 } : {}) })}><Link2 size={14} />物体を斜面に接触 <b>{scene.contactConstraint ? "有効" : "無効"}</b></button> : null}
          <button className={scene.snapEnabled ? "active" : ""} type="button" onClick={() => onSceneChange({ snapEnabled: !scene.snapEnabled })}><Link2 size={14} />推論スナップ <b>{scene.snapEnabled ? "有効" : "無効"}</b></button>
        </div> : null}
      </section>

      <section className={`inspector-section ${openSections.appearance ? "open" : ""}`}>
        <button aria-expanded={openSections.appearance} className="inspector-heading" type="button" onClick={() => toggleSection("appearance")}><span>外観</span><ChevronDown size={14} /></button>
        {openSections.appearance ? <div className="appearance-list">
          <label><input type="checkbox" checked={scene.grid} onChange={(event) => onSceneChange({ grid: event.target.checked })} />グリッド</label>
          {selectedElement ? <><label className="property-row"><span>文字サイズ</span><div className="unit-input"><ElementNumericInput ariaLabel="文字サイズ" element={selectedElement} property="fontSize" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>px</b></div></label><label className="property-row"><span>線幅</span><div className="unit-input"><ElementNumericInput ariaLabel="線幅" element={selectedElement} property="lineWidth" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>px</b></div></label><label><input type="checkbox" checked={selectedElement.visible} onChange={(event) => updateSelectedElement({ visible: event.target.checked })} />表示</label><label><input type="checkbox" checked={selectedElement.locked} onChange={(event) => updateSelectedElement({ locked: event.target.checked })} />ロック</label></> : null}
          {!isFreeBody ? <><label><input type="checkbox" checked={scene.showAxis} onChange={(event) => onSceneChange({ showAxis: event.target.checked })} />座標軸</label>
          <label><input type="checkbox" checked={scene.showAngle} onChange={(event) => onSceneChange({ showAngle: event.target.checked })} />角度</label></> : null}
          <label><input type="checkbox" checked={scene.showFriction} onChange={(event) => onSceneChange({ showFriction: event.target.checked })} />摩擦力</label>
        </div> : null}
      </section>
    </aside>
  );
}
