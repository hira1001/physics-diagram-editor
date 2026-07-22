"use client";

import { CircleDot, Layers3, Slash, Waves, X } from "lucide-react";
import type { TemplateId } from "@/app/lib/editor-types";

interface TemplateDialogProps {
  onApply: (template: TemplateId) => void;
  onClose: () => void;
}

const templates: Array<{
  id: TemplateId;
  name: string;
  description: string;
  detail: string;
  icon: typeof Slash;
}> = [
  { id: "incline", name: "粗い斜面上の物体", description: "斜面・物体・基本3力", detail: "θ / m / mg / N / f / μ", icon: Slash },
  { id: "smooth-incline", name: "滑らかな斜面", description: "摩擦なしの斜面", detail: "θ / m / mg / N", icon: Slash },
  { id: "horizontal", name: "粗い水平面", description: "床上の物体と外力", detail: "m / mg / N / f / μ", icon: Slash },
  { id: "rough-wall", name: "粗い壁と物体", description: "壁面の摩擦を含む", detail: "m / mg / N / f / μ", icon: Slash },
  { id: "smooth-wall", name: "滑らかな壁と物体", description: "壁面の法線力", detail: "m / mg / N", icon: Slash },
  { id: "pulley", name: "斜面と滑車", description: "滑車と糸を接続", detail: "θ / m / T / mg", icon: CircleDot },
  { id: "spring", name: "斜面とばね", description: "ばねと物体を配置", detail: "θ / m / k / x", icon: Waves },
  { id: "freebody", name: "自由体図", description: "選択中の変量を共有", detail: "m / mg / N / f", icon: Layers3 },
];

export function TemplateDialog({ onApply, onClose }: TemplateDialogProps) {
  return (
    <div className="template-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="template-dialog" role="dialog" aria-modal="true" aria-label="テンプレート">
        <header>
          <div><small>再編集可能</small><strong>力学テンプレート</strong></div>
          <button type="button" onClick={onClose} aria-label="閉じる"><X size={16} /></button>
        </header>
        <div className="template-dialog-list">
          {templates.map((template) => {
            const Icon = template.icon;
            return <button key={template.id} type="button" onClick={() => onApply(template.id)}>
              <span className="template-dialog-icon"><Icon size={20} /></span>
              <span><strong>{template.name}</strong><small>{template.description}</small></span>
              <code>{template.detail}</code>
            </button>;
          })}
        </div>
      </section>
    </div>
  );
}
