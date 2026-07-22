"use client";

import { useRef } from "react";
import type { SceneState, Variable } from "@/app/lib/editor-types";

type VariableTextKey = "symbol" | "unit" | "value";

export function VariableInput({
  "aria-label": ariaLabel,
  onCommitSnapshot,
  onSceneChange,
  placeholder,
  property,
  scene,
  syncElementId,
  variable,
}: {
  "aria-label": string;
  onCommitSnapshot: (scene: SceneState) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
  placeholder?: string;
  property: VariableTextKey;
  scene: SceneState;
  syncElementId?: string;
  variable: Variable;
}) {
  const initial = useRef(variable[property]);
  const cancelled = useRef(false);
  const replace = (value: string, source = scene) => ({
    elements: property === "symbol" && syncElementId
      ? source.elements.map((item) => item.id === syncElementId ? { ...item, label: value } : item)
      : source.elements,
    variables: source.variables.map((item) => item.id === variable.id ? { ...item, [property]: value } : item),
  });

  return <input
    aria-label={ariaLabel}
    placeholder={placeholder}
    value={variable[property]}
    onFocus={() => { initial.current = variable[property]; cancelled.current = false; }}
    onChange={(event) => onSceneChange(replace(event.target.value.slice(0, 80)), false)}
    onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") {
        cancelled.current = true;
        onSceneChange(replace(initial.current), false);
        event.currentTarget.blur();
      }
    }}
    onBlur={() => {
      if (!cancelled.current && variable[property] !== initial.current) onCommitSnapshot({ ...scene, ...replace(initial.current) });
      cancelled.current = false;
    }}
  />;
}
