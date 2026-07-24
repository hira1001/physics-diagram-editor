import type { DiagramElement, SceneState, TemplateId, Variable } from "@/app/lib/editor-types";
import { INITIAL_SCENE } from "@/app/lib/editor-types";
import { createDiagramElement } from "@/app/lib/component-catalog";
import { createConnection, createReferencedElement, createVariableForElement } from "@/app/lib/diagram-model";

export function buildTemplateScene(template: TemplateId): SceneState {
  if (template === "freebody") {
    const block = createDiagramElement("block", 450, 300, "freebody-block");
    block.label = "m";
    const axis = createReferencedElement("local-axis", block, "freebody-axis");
    const gravity = createReferencedElement("gravity", block, "freebody-gravity");
    gravity.rotation = 90;
    const normal = createReferencedElement("normal-force", block, "freebody-normal");
    normal.rotation = -90;
    const tension = createReferencedElement("tension", block, "freebody-tension");
    tension.rotation = -30;

    const elements: DiagramElement[] = [block, axis, gravity, normal, tension];
    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      elements,
      variables,
      showAngle: false,
      showGravity: false,
      showNormal: false,
      showFriction: false,
      showSpring: false,
      showPulley: false,
      selectedId: `element:${block.id}`,
    };
  }

  if (template === "incline" || template === "smooth-incline") {
    const isRough = template === "incline";
    const incline = createDiagramElement(
      isRough ? "rough-incline" : "smooth-incline",
      450, 420, "template-incline"
    );
    incline.width = 520;
    incline.rotation = 30;

    const block = createDiagramElement("block", 450, 345, "template-block");
    block.label = "m";
    block.rotation = -30;

    const angle = createDiagramElement("angle-arc", 220, 420, "template-angle");
    angle.rotation = 30;
    angle.label = "θ";

    const gravity = createReferencedElement("gravity", block, "template-gravity");
    gravity.rotation = 90;

    const normal = createReferencedElement("normal-force", block, "template-normal");
    normal.rotation = -60;

    const elements: DiagramElement[] = [incline, block, angle, gravity, normal];

    if (isRough) {
      const friction = createReferencedElement("friction-force", block, "template-friction");
      friction.rotation = -150;
      elements.push(friction);
    }

    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      angle: 30,
      surfaceKind: "incline",
      surfaceRoughness: isRough ? "rough" : "smooth",
      elements,
      variables,
      showAngle: false,
      showGravity: false,
      showNormal: false,
      showFriction: false,
      showSpring: false,
      showPulley: false,
      selectedId: `element:${block.id}`,
    };
  }

  if (template === "horizontal") {
    const floor = createDiagramElement("rough-floor", 450, 420, "template-floor");
    floor.width = 600;

    const block = createDiagramElement("block", 450, 360, "template-block");
    block.label = "m";

    const pullForce = createReferencedElement("force", block, "template-force");
    pullForce.label = "F";
    pullForce.rotation = 0;

    const gravity = createReferencedElement("gravity", block, "template-gravity");
    gravity.rotation = 90;

    const normal = createReferencedElement("normal-force", block, "template-normal");
    normal.rotation = -90;

    const friction = createReferencedElement("friction-force", block, "template-friction");
    friction.rotation = 180;

    const elements: DiagramElement[] = [floor, block, pullForce, gravity, normal, friction];
    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      surfaceKind: "floor",
      surfaceRoughness: "rough",
      elements,
      variables,
      showAngle: false,
      showGravity: false,
      showNormal: false,
      showFriction: false,
      showSpring: false,
      showPulley: false,
      selectedId: `element:${block.id}`,
    };
  }

  if (template === "rough-wall" || template === "smooth-wall") {
    const isRough = template === "rough-wall";
    const wall = createDiagramElement(
      isRough ? "rough-wall" : "smooth-wall",
      280, 300, "template-wall"
    );
    wall.height = 450;
    wall.rotation = 90;

    const block = createDiagramElement("block", 335, 300, "template-block");
    block.label = "m";

    const pushForce = createReferencedElement("force", block, "template-push");
    pushForce.label = "P";
    pushForce.rotation = 180;

    const normal = createReferencedElement("normal-force", block, "template-normal");
    normal.rotation = 0;

    const gravity = createReferencedElement("gravity", block, "template-gravity");
    gravity.rotation = 90;

    const elements: DiagramElement[] = [wall, block, pushForce, normal, gravity];

    if (isRough) {
      const friction = createReferencedElement("friction-force", block, "template-friction");
      friction.rotation = -90;
      elements.push(friction);
    }

    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      surfaceKind: "wall",
      surfaceRoughness: isRough ? "rough" : "smooth",
      elements,
      variables,
      showAngle: false,
      showGravity: false,
      showNormal: false,
      showFriction: false,
      showSpring: false,
      showPulley: false,
      selectedId: `element:${block.id}`,
    };
  }

  if (template === "pulley") {
    const ceiling = createDiagramElement("fixed-end", 450, 100, "template-ceiling");
    ceiling.width = 250;

    const pulley = createDiagramElement("fixed-pulley", 450, 190, "template-pulley");
    pulley.label = "P";

    const blockLeft = createDiagramElement("block", 380, 380, "block-left");
    blockLeft.label = "m₁";

    const blockRight = createDiagramElement("block", 520, 430, "block-right");
    blockRight.label = "m₂";

    const stringLeft = createConnection("string", blockLeft, pulley, "string-left");
    const stringRight = createConnection("string", pulley, blockRight, "string-right");

    const gravityLeft = createReferencedElement("gravity", blockLeft, "gravity-left");
    gravityLeft.rotation = 90;

    const gravityRight = createReferencedElement("gravity", blockRight, "gravity-right");
    gravityRight.rotation = 90;

    const tensionLeft = createReferencedElement("tension", blockLeft, "tension-left");
    tensionLeft.label = "T₁";
    tensionLeft.rotation = -90;

    const tensionRight = createReferencedElement("tension", blockRight, "tension-right");
    tensionRight.label = "T₂";
    tensionRight.rotation = -90;

    const elements: DiagramElement[] = [
      ceiling,
      pulley,
      blockLeft,
      blockRight,
      stringLeft,
      stringRight,
      gravityLeft,
      gravityRight,
      tensionLeft,
      tensionRight,
    ];
    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      elements,
      variables,
      showAngle: false,
      showGravity: false,
      showNormal: false,
      showFriction: false,
      showSpring: false,
      showPulley: false,
      selectedId: `element:${pulley.id}`,
    };
  }

  if (template === "spring") {
    const wall = createDiagramElement("fixed-end", 180, 320, "template-wall");
    wall.height = 200;
    wall.rotation = 90;

    const floor = createDiagramElement("smooth-floor", 450, 360, "template-floor");
    floor.width = 600;

    const block = createDiagramElement("block", 500, 300, "template-block");
    block.label = "m";

    const spring = createConnection("spring", wall, block, "template-spring");
    spring.label = "k";

    const springForce = createReferencedElement("spring-force", block, "template-spring-force");
    springForce.label = "Fₛ";
    springForce.rotation = 180;

    const lengthDim = createDiagramElement("length-dimension", 340, 230, "template-dim");
    lengthDim.width = 160;
    lengthDim.label = "x";

    const elements: DiagramElement[] = [wall, floor, block, spring, springForce, lengthDim];
    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      elements,
      variables,
      showAngle: false,
      showGravity: false,
      showNormal: false,
      showFriction: false,
      showSpring: false,
      showPulley: false,
      selectedId: `element:${block.id}`,
    };
  }

  return INITIAL_SCENE;
}
