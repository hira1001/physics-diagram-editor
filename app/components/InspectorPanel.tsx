"use client";

import { useState } from "react";
import {
  ChevronDown,
  FlipHorizontal2,
  Link2,
  MoveUpRight,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { NumericInput } from "@/app/components/NumericInput";
import type { PageKind, SceneState, SelectionId } from "@/app/lib/editor-types";

interface InspectorPanelProps {
  scene: SceneState;
  pageKind: PageKind;
  onCreateFreeBody: () => void;
  onSceneChange: (patch: Partial<SceneState>) => void;
}

type SectionKey = "dimensions" | "quick" | "variables" | "constraints" | "appearance";

const selectionNames: Record<Exclude<SelectionId, null>, string> = {
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

export function InspectorPanel({ scene, pageKind, onCreateFreeBody, onSceneChange }: InspectorPanelProps) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    dimensions: true,
    quick: true,
    variables: true,
    constraints: true,
    appearance: false,
  });
  const selectedName = scene.selectedId ? selectionNames[scene.selectedId] : "選択なし";
  const isIncline = scene.selectedId === "incline";
  const isAngleLabel = scene.selectedId === "angle";
  const isBlock = scene.selectedId === "block" || scene.selectedId === "mass-label";
  const isText = scene.selectedId === "text";
  const isFreeBody = pageKind === "freebody";
  const toggleSection = (key: SectionKey) => setOpenSections((current) => ({ ...current, [key]: !current[key] }));

  return (
    <aside className="inspector-panel" aria-label="選択対象の設定">
      <div className="inspector-title">
        <span className="selection-mark" />
        <div><small>選択</small><strong>{selectedName}</strong></div>
      </div>

      <section className={`inspector-section ${openSections.dimensions ? "open" : ""}`}>
        <button aria-expanded={openSections.dimensions} className="inspector-heading" type="button" onClick={() => toggleSection("dimensions")}><span>寸法・値</span><ChevronDown size={14} /></button>
        {openSections.dimensions ? <div className="inspector-content">
          {isIncline || isAngleLabel ? <>
            <label className="property-row"><span>角度</span><div className="unit-input"><NumericInput min="5" max="75" value={scene.angle} onValueChange={(angle) => onSceneChange({ angle })} /><b>°</b></div></label>
            <input className="angle-range" type="range" min="5" max="75" value={scene.angle} onChange={(event) => onSceneChange({ angle: Number(event.target.value) })} aria-label="斜面の角度" />
            {isIncline ? <>
              <label className="property-row"><span>図 X</span><NumericInput value={Math.round(scene.diagramOffsetX)} onValueChange={(diagramOffsetX) => onSceneChange({ diagramOffsetX })} /></label>
              <label className="property-row"><span>図 Y</span><NumericInput value={Math.round(scene.diagramOffsetY)} onValueChange={(diagramOffsetY) => onSceneChange({ diagramOffsetY })} /></label>
            </> : <>
              <label className="property-row"><span>文字 X</span><NumericInput value={Math.round(scene.angleLabelOffsetX)} onValueChange={(angleLabelOffsetX) => onSceneChange({ angleLabelOffsetX })} /></label>
              <label className="property-row"><span>文字 Y</span><NumericInput value={Math.round(scene.angleLabelOffsetY)} onValueChange={(angleLabelOffsetY) => onSceneChange({ angleLabelOffsetY })} /></label>
            </>}
          </> : null}
          {isBlock ? <>
            <label className="property-row"><span>ラベル</span><input value={scene.massLabel} onChange={(event) => onSceneChange({ massLabel: event.target.value })} /></label>
            {!isFreeBody ? <label className="property-row"><span>位置</span><div className="unit-input"><NumericInput min="12" max="88" value={Math.round(scene.blockPosition * 100)} onValueChange={(value) => onSceneChange({ blockPosition: value / 100 })} /><b>%</b></div></label> : null}
            <label className="property-row"><span>文字 X</span><NumericInput value={Math.round(scene.massLabelOffsetX)} onValueChange={(massLabelOffsetX) => onSceneChange({ massLabelOffsetX })} /></label>
            <label className="property-row"><span>文字 Y</span><NumericInput value={Math.round(scene.massLabelOffsetY)} onValueChange={(massLabelOffsetY) => onSceneChange({ massLabelOffsetY })} /></label>
            {isFreeBody ? <>
              <label className="property-row"><span>図 X</span><NumericInput value={Math.round(scene.diagramOffsetX)} onValueChange={(diagramOffsetX) => onSceneChange({ diagramOffsetX })} /></label>
              <label className="property-row"><span>図 Y</span><NumericInput value={Math.round(scene.diagramOffsetY)} onValueChange={(diagramOffsetY) => onSceneChange({ diagramOffsetY })} /></label>
            </> : !scene.contactConstraint ? <>
              <label className="property-row"><span>物体 X</span><NumericInput value={Math.round(scene.blockOffsetX)} onValueChange={(blockOffsetX) => onSceneChange({ blockOffsetX })} /></label>
              <label className="property-row"><span>物体 Y</span><NumericInput value={Math.round(scene.blockOffsetY)} onValueChange={(blockOffsetY) => onSceneChange({ blockOffsetY })} /></label>
            </> : null}
          </> : null}
          {isText ? <>
            <label className="property-row"><span>文字</span><input value={scene.annotationText} onChange={(event) => onSceneChange({ annotationText: event.target.value })} /></label>
            <label className="property-row"><span>X</span><div className="unit-input"><NumericInput min="4" max="96" value={Math.round(scene.annotationX * 100)} onValueChange={(value) => onSceneChange({ annotationX: value / 100 })} /><b>%</b></div></label>
            <label className="property-row"><span>Y</span><div className="unit-input"><NumericInput min="4" max="96" value={Math.round(scene.annotationY * 100)} onValueChange={(value) => onSceneChange({ annotationY: value / 100 })} /><b>%</b></div></label>
          </> : null}
          {!isIncline && !isAngleLabel && !isBlock && !isText ? <label className="property-row"><span>ベクトル</span><div className="unit-input"><NumericInput min="50" max="180" value={Math.round(scene.forceScale * 100)} onValueChange={(value) => onSceneChange({ forceScale: value / 100 })} /><b>%</b></div></label> : null}
        </div> : null}
      </section>

      <section className={`inspector-section ${openSections.quick ? "open" : ""}`}>
        <button aria-expanded={openSections.quick} className="inspector-heading" type="button" onClick={() => toggleSection("quick")}><span>クイック操作</span><ChevronDown size={14} /></button>
        {openSections.quick ? <div className="quick-grid">
          {isText ? <>
            <button type="button" onClick={() => onSceneChange({ annotationX: 0.5, annotationY: 0.2 })}><RotateCcw size={15} />中央へ戻す</button>
            <button type="button" onClick={() => onSceneChange({ showAnnotation: false, selectedId: null })}><Trash2 size={15} />削除</button>
          </> : isFreeBody ? <>
            <button type="button" onClick={() => onSceneChange({ showGravity: true, showNormal: true, showFriction: true })}><MoveUpRight size={15} />力を追加</button>
            <button type="button" onClick={() => onSceneChange({ diagramOffsetX: 0, diagramOffsetY: 0 })}><RotateCcw size={15} />中央へ戻す</button>
          </> : <>
            <button type="button" onClick={() => onSceneChange({ showGravity: true, showNormal: true, showFriction: true })}><MoveUpRight size={15} />力を追加</button>
            <button type="button" onClick={() => onSceneChange({ flipped: !scene.flipped, blockPosition: 1 - scene.blockPosition })}><FlipHorizontal2 size={15} />左右反転</button>
            <button className={scene.contactConstraint ? "active" : ""} type="button" onClick={() => onSceneChange({ contactConstraint: !scene.contactConstraint, ...(!scene.contactConstraint ? { blockOffsetX: 0, blockOffsetY: 0 } : {}) })}><Link2 size={15} />{scene.contactConstraint ? "接触中" : "接続"}</button>
            <button type="button" onClick={onCreateFreeBody}><RotateCcw size={15} />自由体図</button>
          </>}
        </div> : null}
      </section>

      <section className={`inspector-section ${openSections.variables ? "open" : ""}`}>
        <button aria-expanded={openSections.variables} className="inspector-heading" type="button" onClick={() => toggleSection("variables")}><span>変量</span><ChevronDown size={14} /></button>
        {openSections.variables ? <div className="token-list">
          <button className="token-row active" type="button" onClick={() => onSceneChange({ selectedId: "angle" })}><i>θ</i><span>斜面角</span><b>{scene.angle}°</b></button>
          <button className="token-row" type="button" onClick={() => onSceneChange({ selectedId: "mass-label" })}><i>m</i><span>質量</span><b>— kg</b></button>
          {scene.customVariableSymbol ? <div className="custom-variable-row">
            <input aria-label="変量記号" value={scene.customVariableSymbol} onChange={(event) => onSceneChange({ customVariableSymbol: event.target.value })} />
            <input aria-label="変量値" value={scene.customVariableValue} onChange={(event) => onSceneChange({ customVariableValue: event.target.value })} placeholder="値" />
            <input aria-label="変量単位" value={scene.customVariableUnit} onChange={(event) => onSceneChange({ customVariableUnit: event.target.value })} placeholder="単位" />
            <button type="button" aria-label="追加変量を削除" onClick={() => onSceneChange({ customVariableSymbol: "", customVariableValue: "", customVariableUnit: "" })}><Trash2 size={13} /></button>
          </div> : <button className="add-row" type="button" onClick={() => onSceneChange({ customVariableSymbol: "a", customVariableValue: "", customVariableUnit: "m/s²" })}><Plus size={13} />変量を追加</button>}
        </div> : null}
      </section>

      <section className={`inspector-section ${openSections.constraints ? "open" : ""}`}>
        <button aria-expanded={openSections.constraints} className="inspector-heading" type="button" onClick={() => toggleSection("constraints")}><span>制約</span><ChevronDown size={14} /></button>
        {openSections.constraints ? <div className="constraint-list">
          {!isFreeBody ? <button className={scene.contactConstraint ? "active" : ""} type="button" onClick={() => onSceneChange({ contactConstraint: !scene.contactConstraint, ...(!scene.contactConstraint ? { blockOffsetX: 0, blockOffsetY: 0 } : {}) })}><Link2 size={14} />物体を斜面に接触 <b>{scene.contactConstraint ? "有効" : "無効"}</b></button> : null}
          <button className={scene.snapEnabled ? "active" : ""} type="button" onClick={() => onSceneChange({ snapEnabled: !scene.snapEnabled })}><Link2 size={14} />推論スナップ <b>{scene.snapEnabled ? "有効" : "無効"}</b></button>
        </div> : null}
      </section>

      <section className={`inspector-section ${openSections.appearance ? "open" : ""}`}>
        <button aria-expanded={openSections.appearance} className="inspector-heading" type="button" onClick={() => toggleSection("appearance")}><span>外観</span><ChevronDown size={14} /></button>
        {openSections.appearance ? <div className="appearance-list">
          <label><input type="checkbox" checked={scene.grid} onChange={(event) => onSceneChange({ grid: event.target.checked })} />グリッド</label>
          {!isFreeBody ? <><label><input type="checkbox" checked={scene.showAxis} onChange={(event) => onSceneChange({ showAxis: event.target.checked })} />座標軸</label>
          <label><input type="checkbox" checked={scene.showAngle} onChange={(event) => onSceneChange({ showAngle: event.target.checked })} />角度</label></> : null}
          <label><input type="checkbox" checked={scene.showFriction} onChange={(event) => onSceneChange({ showFriction: event.target.checked })} />摩擦力</label>
        </div> : null}
      </section>
    </aside>
  );
}
