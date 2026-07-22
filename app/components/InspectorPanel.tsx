"use client";

import {
  ChevronDown,
  CircleEqual,
  FlipHorizontal2,
  Link2,
  MoveUpRight,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { SceneState, SelectionId } from "@/app/lib/editor-types";

interface InspectorPanelProps {
  scene: SceneState;
  onCreateFreeBody: () => void;
  onSceneChange: (patch: Partial<SceneState>) => void;
}

const selectionNames: Record<Exclude<SelectionId, null>, string> = {
  incline: "斜面",
  block: "物体",
  "force-gravity": "重力ベクトル",
  "force-normal": "垂直抗力",
  "force-friction": "摩擦力",
  angle: "角度弧",
  axis: "座標軸",
  spring: "ばね",
  pulley: "滑車",
};

export function InspectorPanel({ scene, onCreateFreeBody, onSceneChange }: InspectorPanelProps) {
  const selectedName = scene.selectedId ? selectionNames[scene.selectedId] : "選択なし";
  const isIncline = scene.selectedId === "incline" || scene.selectedId === "angle";
  const isBlock = scene.selectedId === "block";

  return (
    <aside className="inspector-panel" aria-label="選択対象の設定">
      <div className="inspector-title">
        <span className="selection-mark" />
        <div><small>選択</small><strong>{selectedName}</strong></div>
        <button className="icon-button small" type="button" aria-label="設定"><SlidersHorizontal size={15} /></button>
      </div>

      <section className="inspector-section open">
        <button className="inspector-heading" type="button"><span>寸法・値</span><ChevronDown size={14} /></button>
        <div className="inspector-content">
          {isIncline ? (
            <>
              <label className="property-row"><span>角度</span><div className="unit-input"><input type="number" min="5" max="75" value={scene.angle} onChange={(event) => onSceneChange({ angle: Number(event.target.value) })} /><b>°</b></div></label>
              <input className="angle-range" type="range" min="5" max="75" value={scene.angle} onChange={(event) => onSceneChange({ angle: Number(event.target.value) })} aria-label="斜面の角度" />
              <label className="property-row"><span>変量</span><input value="θ" readOnly /></label>
            </>
          ) : null}
          {isBlock ? (
            <>
              <label className="property-row"><span>ラベル</span><input value={scene.massLabel} onChange={(event) => onSceneChange({ massLabel: event.target.value })} /></label>
              <label className="property-row"><span>位置</span><div className="unit-input"><input type="number" min="0" max="100" value={Math.round(scene.blockPosition * 100)} onChange={(event) => onSceneChange({ blockPosition: Number(event.target.value) / 100 })} /><b>%</b></div></label>
            </>
          ) : null}
          {!isIncline && !isBlock ? (
            <label className="property-row"><span>倍率</span><div className="unit-input"><input type="number" min="50" max="180" value={Math.round(scene.forceScale * 100)} onChange={(event) => onSceneChange({ forceScale: Number(event.target.value) / 100 })} /><b>%</b></div></label>
          ) : null}
        </div>
      </section>

      <section className="inspector-section open">
        <button className="inspector-heading" type="button"><span>クイック操作</span><ChevronDown size={14} /></button>
        <div className="quick-grid">
          <button type="button" onClick={() => onSceneChange({ showGravity: true, showNormal: true, showFriction: true })}><MoveUpRight size={15} />力を追加</button>
          <button type="button"><FlipHorizontal2 size={15} />反転</button>
          <button type="button"><Link2 size={15} />接続</button>
          <button type="button" onClick={onCreateFreeBody}><RotateCcw size={15} />自由体図</button>
        </div>
      </section>

      <section className="inspector-section open">
        <button className="inspector-heading" type="button"><span>変量</span><ChevronDown size={14} /></button>
        <div className="token-list">
          <button className="token-row active" type="button" onClick={() => onSceneChange({ selectedId: "angle" })}><i>θ</i><span>斜面角</span><b>{scene.angle}°</b></button>
          <button className="token-row" type="button" onClick={() => onSceneChange({ selectedId: "block" })}><i>m</i><span>質量</span><b>— kg</b></button>
          <button className="add-row" type="button"><Plus size={13} />変量を追加</button>
        </div>
      </section>

      <section className="inspector-section open">
        <button className="inspector-heading" type="button"><span>制約</span><ChevronDown size={14} /></button>
        <div className="constraint-list">
          <span><CircleEqual size={14} />角度固定 <b>{scene.angle}°</b></span>
          <span><Link2 size={14} />物体を斜面に接触 <b>有効</b></span>
          <button className="add-row" type="button"><Plus size={13} />制約を追加</button>
        </div>
      </section>

      <section className="inspector-section">
        <button className="inspector-heading" type="button"><span>外観</span><ChevronDown size={14} /></button>
      </section>
    </aside>
  );
}
