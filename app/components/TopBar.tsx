"use client";

import {
  ChevronDown,
  Download,
  Menu,
  Redo2,
  Search,
  Undo2,
} from "lucide-react";

interface TopBarProps {
  canRedo: boolean;
  canUndo: boolean;
  commandQuery: string;
  commandOpen: boolean;
  onCommandChange: (value: string) => void;
  onCommandFocus: () => void;
  onExport: () => void;
  onMenu: () => void;
  onRedo: () => void;
  onUndo: () => void;
  saveStatus: "error" | "saved" | "saving";
}

export function TopBar({
  canRedo,
  canUndo,
  commandQuery,
  commandOpen,
  onCommandChange,
  onCommandFocus,
  onExport,
  onMenu,
  onRedo,
  onUndo,
  saveStatus,
}: TopBarProps) {
  return (
    <header className="topbar">
      <button className="icon-button" type="button" onClick={onMenu} aria-label="メニュー">
        <Menu size={18} />
      </button>
      <div className="document-identity">
        <strong>力学図エディタ</strong>
        <span className={`save-state ${saveStatus}`} aria-live="polite"><span aria-hidden="true" />{saveStatus === "saving" ? "保存中…" : saveStatus === "error" ? "保存できません" : "保存済み"}</span>
      </div>
      <div className="history-actions" aria-label="履歴操作">
        <button className="icon-button" type="button" onClick={onUndo} disabled={!canUndo} aria-label="元に戻す">
          <Undo2 size={17} />
        </button>
        <button className="icon-button" type="button" onClick={onRedo} disabled={!canRedo} aria-label="やり直す">
          <Redo2 size={17} />
        </button>
      </div>
      <label className={`command-field ${commandOpen ? "is-open" : ""}`}>
        <Search size={16} aria-hidden="true" />
        <input
          value={commandQuery}
          onChange={(event) => onCommandChange(event.target.value)}
          onFocus={onCommandFocus}
          placeholder="操作・部品を検索…"
          aria-label="操作・部品を検索"
        />
        <kbd>⌘K</kbd>
      </label>
      <button className="export-button" type="button" onClick={onExport}>
        <Download size={16} />
        出力
        <ChevronDown size={14} />
      </button>
    </header>
  );
}
