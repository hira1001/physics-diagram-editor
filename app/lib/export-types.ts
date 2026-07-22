export type ExportFormat = "pdf" | "png" | "pptx" | "svg";
export type ExportRange = "all" | "current" | "selection";
export type ExportBackground = "transparent" | "white";

export interface ExportSettings {
  background: ExportBackground;
  format: ExportFormat;
  margin: number;
  range: ExportRange;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  background: "white",
  format: "pptx",
  margin: 24,
  range: "current",
};

