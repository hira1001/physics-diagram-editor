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
import { SceneNumericInput, SceneTextInput } from "@/app/components/SceneInputs";
import type { PageKind, SceneState, SelectionId } from "@/app/lib/editor-types";
import { hasSurfaceConflict, surfaceDisplayName } from "@/app/lib/physics-rules";

interface InspectorPanelProps {
  scene: SceneState;
  pageKind: PageKind;
  onCreateFreeBody: () => void;
  onCommitSnapshot: (scene: SceneState) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
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

export function InspectorPanel({ scene, pageKind, onCreateFreeBody, onCommitSnapshot, onSceneChange }: InspectorPanelProps) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    dimensions: true,
    quick: true,
    variables: true,
    constraints: true,
    appearance: false,
  });
  const selectedName = scene.selectedId === "incline" ? surfaceDisplayName(scene.surfaceKind, scene.surfaceRoughness) : scene.selectedId ? selectionNames[scene.selectedId] : "選択なし";
  const isIncline = scene.selectedId === "incline";
  const isAngleLabel = scene.selectedId === "angle";
  const isBlock = scene.selectedId === "block" || scene.selectedId === "mass-label";
  const isText = scene.selectedId === "text";
  const isFreeBody = pageKind === "freebody";
  const surfaceConflict = hasSurfaceConflict(scene);
  const addContactForces = () => onSceneChange({
    showGravity: true,
    showNormal: true,
    ...(scene.surfaceRoughness === "rough" ? { showFriction: true } : {}),
  });
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
          {isIncline ? <>
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
          {!isIncline && !isAngleLabel && !isBlock && !isText ? <label className="property-row"><span>ベクトル</span><div className="unit-input"><SceneNumericInput min="50" max="180" property="forceScale" scale={100} scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /><b>%</b></div></label> : null}
        </div> : null}
      </section>

      <section className={`inspector-section ${openSections.quick ? "open" : ""}`}>
        <button aria-expanded={openSections.quick} className="inspector-heading" type="button" onClick={() => toggleSection("quick")}><span>クイック操作</span><ChevronDown size={14} /></button>
        {openSections.quick ? <div className="quick-grid">
          {isText ? <>
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

      <section className={`inspector-section ${openSections.variables ? "open" : ""}`}>
        <button aria-expanded={openSections.variables} className="inspector-heading" type="button" onClick={() => toggleSection("variables")}><span>変量</span><ChevronDown size={14} /></button>
        {openSections.variables ? <div className="token-list">
          <button className="token-row active" type="button" onClick={() => onSceneChange({ selectedId: "angle" })}><i>θ</i><span>斜面角</span><b>{scene.angle}°</b></button>
          <button className="token-row" type="button" onClick={() => onSceneChange({ selectedId: "mass-label" })}><i>m</i><span>質量</span><b>— kg</b></button>
          {scene.surfaceRoughness === "rough" ? <div className="friction-variable-row"><i>μ</i><span>摩擦係数</span><SceneNumericInput aria-label="摩擦係数" min="0" max="10" step="0.05" property="surfaceFrictionCoefficient" scene={scene} onCommitSnapshot={onCommitSnapshot} onSceneChange={onSceneChange} /></div> : null}
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
          {surfaceConflict ? <div className="constraint-conflict" role="alert"><strong>滑らかな面に摩擦力があります</strong><span>物理条件が競合しています</span><div><button type="button" onClick={() => onSceneChange({ surfaceRoughness: "rough" })}>粗い面に変更</button><button type="button" onClick={() => onSceneChange({ showFriction: false })}>摩擦力を外す</button></div></div> : null}
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
