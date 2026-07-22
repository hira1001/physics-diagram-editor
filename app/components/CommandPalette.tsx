"use client";

import { Box, Download, Gauge, Grid3X3, Layers3, MoveUpRight, PanelLeftClose, Search, Slash } from "lucide-react";

export interface EditorCommandItem {
  id: string;
  label: string;
  detail: string;
  shortcut?: string;
  icon: "incline" | "box" | "force" | "angle" | "grid" | "panel" | "export" | "freebody";
  run: () => void;
}

interface CommandPaletteProps {
  commands: EditorCommandItem[];
  query: string;
  onClose: () => void;
}

const icons = {
  incline: Slash,
  box: Box,
  force: MoveUpRight,
  angle: Gauge,
  grid: Grid3X3,
  panel: PanelLeftClose,
  export: Download,
  freebody: Layers3,
};

export function CommandPalette({ commands, query, onClose }: CommandPaletteProps) {
  const normalized = query.trim().toLowerCase();
  const visible = commands.filter((command) => `${command.label} ${command.detail}`.toLowerCase().includes(normalized)).slice(0, 7);

  return (
    <div className="command-popover" role="dialog" aria-label="コマンド検索">
      <div className="command-popover-title"><Search size={14} /><span>{normalized ? `「${query}」の候補` : "おすすめの操作"}</span><button type="button" onClick={onClose}>Esc</button></div>
      <div className="command-results">
        {visible.length ? visible.map((command, index) => {
          const Icon = icons[command.icon];
          return (
            <button className={index === 0 ? "active" : ""} type="button" key={command.id} onClick={() => { command.run(); onClose(); }}>
              <Icon size={16} />
              <span><strong>{command.label}</strong><small>{command.detail}</small></span>
              {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
            </button>
          );
        }) : <p className="empty-command">一致する操作がありません</p>}
      </div>
      <footer><span>↑↓ 選択</span><span>↵ 実行</span><span>Esc 閉じる</span></footer>
    </div>
  );
}
