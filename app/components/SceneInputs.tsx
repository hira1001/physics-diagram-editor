"use client";

import { useRef, type InputHTMLAttributes } from "react";
import { NumericInput } from "@/app/components/NumericInput";
import type { SceneState } from "@/app/lib/editor-types";

type NumericSceneKey = {
  [Key in keyof SceneState]: NonNullable<SceneState[Key]> extends number ? Key : never;
}[keyof SceneState] & keyof SceneState;

type StringSceneKey = {
  [Key in keyof SceneState]: NonNullable<SceneState[Key]> extends string ? Key : never;
}[keyof SceneState] & keyof SceneState;

interface SharedSceneInputProps {
  scene: SceneState;
  onCommitSnapshot: (scene: SceneState) => void;
  onSceneChange: (patch: Partial<SceneState>, record?: boolean) => void;
}

interface SceneNumericInputProps extends SharedSceneInputProps, Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "type" | "value"> {
  property: NumericSceneKey;
  scale?: number;
}

export function SceneNumericInput({ scene, property, scale = 1, onCommitSnapshot, onSceneChange, ...props }: SceneNumericInputProps) {
  const value = Number(scene[property] ?? 0) * scale;
  return (
    <NumericInput
      {...props}
      value={value}
      onValueChange={(next) => onSceneChange({ [property]: next / scale } as Partial<SceneState>, false)}
      onValueCommit={(_, initial) => onCommitSnapshot({ ...scene, [property]: initial / scale } as SceneState)}
      onValueCancel={(initial) => onSceneChange({ [property]: initial / scale } as Partial<SceneState>, false)}
    />
  );
}

interface SceneTextInputProps extends SharedSceneInputProps, Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "value"> {
  property: StringSceneKey;
}

export function SceneTextInput({ scene, property, onCommitSnapshot, onSceneChange, onBlur, onFocus, onKeyDown, ...props }: SceneTextInputProps) {
  const initialRef = useRef(String(scene[property] ?? ""));
  const cancelledRef = useRef(false);
  return (
    <input
      {...props}
      value={String(scene[property] ?? "")}
      onFocus={(event) => {
        initialRef.current = String(scene[property] ?? "");
        cancelledRef.current = false;
        onFocus?.(event);
      }}
      onChange={(event) => onSceneChange({ [property]: event.target.value } as Partial<SceneState>, false)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelledRef.current = true;
          onSceneChange({ [property]: initialRef.current } as Partial<SceneState>, false);
          event.currentTarget.blur();
        }
        onKeyDown?.(event);
      }}
      onBlur={(event) => {
        if (!cancelledRef.current && String(scene[property] ?? "") !== initialRef.current) {
          onCommitSnapshot({ ...scene, [property]: initialRef.current } as SceneState);
        }
        cancelledRef.current = false;
        onBlur?.(event);
      }}
    />
  );
}
