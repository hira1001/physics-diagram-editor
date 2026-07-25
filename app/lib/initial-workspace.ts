import type { WorkspaceState } from "@/app/lib/editor-types";
import { buildTemplateScene } from "@/app/lib/template-builder";

/** Fresh workspace: catalog templates only (no legacy incline wizard). */
export function createDefaultWorkspace(): WorkspaceState {
  return {
    schemaVersion: 2,
    density: "standard",
    leftPanelWidth: 244,
    leftPanelVisible: true,
    rightPanelWidth: 300,
    rightPanelVisible: true,
    zoom: 100,
    activePageId: "page-1",
    pages: [
      {
        id: "page-1",
        title: "斜面運動",
        kind: "incline",
        scene: buildTemplateScene("incline"),
      },
      {
        id: "page-fbd",
        title: "自由体図",
        kind: "freebody",
        scene: buildTemplateScene("freebody"),
      },
    ],
  };
}
