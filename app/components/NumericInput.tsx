"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "type" | "value"> {
  value: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number, initialValue: number) => void;
  onValueCancel?: (initialValue: number) => void;
}

export function NumericInput({ value, onValueChange, onValueCommit, onValueCancel, onBlur, onFocus, onKeyDown, ...props }: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialValueRef = useRef(value);
  const currentValueRef = useRef(value);
  const cancelledRef = useRef(false);

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
      onFocus={(event) => {
        initialValueRef.current = value;
        currentValueRef.current = value;
        cancelledRef.current = false;
        onFocus?.(event);
      }}
      onInput={(event) => {
        const next = event.currentTarget.value;
        if (next !== "" && Number.isFinite(Number(next))) {
          currentValueRef.current = Number(next);
          onValueChange(Number(next));
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelledRef.current = true;
          currentValueRef.current = initialValueRef.current;
          event.currentTarget.value = String(initialValueRef.current);
          onValueCancel?.(initialValueRef.current);
          event.currentTarget.blur();
        }
        onKeyDown?.(event);
      }}
      onBlur={(event) => {
        if (event.currentTarget.value === "") event.currentTarget.value = String(value);
        if (!cancelledRef.current && currentValueRef.current !== initialValueRef.current) {
          onValueCommit?.(currentValueRef.current, initialValueRef.current);
        }
        cancelledRef.current = false;
        onBlur?.(event);
      }}
    />
  );
}
