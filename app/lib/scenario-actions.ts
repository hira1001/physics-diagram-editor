import type { DiagramElement, SceneState } from "@/app/lib/editor-types";
import { contextCandidatesForElement, createReferencedElement, createVariableForElement, isConnectionElement, isVectorElement } from "@/app/lib/diagram-model";

/** Attach all context-appropriate contact/force vectors to a body (mg, N, f, etc.). */
export function attachAllForcesForElement(element: DiagramElement, scene: SceneState): Partial<SceneState> | null {
  if (isVectorElement(element.kind) || isConnectionElement(element.kind)) return null;
  const candidates = contextCandidatesForElement(element).filter((kind) => isVectorElement(kind));
  const attached = new Set(
    scene.elements.filter((el) => el.referenceTargetId === element.id).map((el) => el.kind),
  );
  const newElements: DiagramElement[] = [];
  const newVariables = [...scene.variables];
  for (const kind of candidates) {
    if (attached.has(kind)) continue;
    const created = createReferencedElement(kind, element);
    newElements.push(created);
    newVariables.push(createVariableForElement(created));
  }
  if (newElements.length === 0) return null;
  return {
    elements: [...scene.elements, ...newElements],
    variables: newVariables,
    selectedId: `element:${newElements[0]!.id}`,
  };
}
