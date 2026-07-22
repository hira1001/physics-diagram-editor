"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "type" | "value"> {
  value: number;
  onValueChange: (value: number) => void;
}

export function NumericInput({ value, onValueChange, onBlur, ...props }: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input) input.value = String(value);
  }, [value]);

  return (
    <input
      {...props}
      ref={inputRef}
      type="number"
      defaultValue={value}
      onInput={(event) => {
        const next = event.currentTarget.value;
        if (next !== "" && Number.isFinite(Number(next))) onValueChange(Number(next));
      }}
      onBlur={(event) => {
        if (event.currentTarget.value === "") event.currentTarget.value = String(value);
        onBlur?.(event);
      }}
    />
  );
}
