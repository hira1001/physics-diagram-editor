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

  if (template === "stacked") {
    const floor = createDiagramElement("rough-floor", 450, 420, "stacked-floor");
    floor.width = 600;

    const block2 = createDiagramElement("block", 450, 360, "stacked-block2");
    block2.label = "m₂";
    block2.width = 150;
    block2.height = 80;

    const block1 = createDiagramElement("block", 450, 280, "stacked-block1");
    block1.label = "m₁";
    block1.width = 100;
    block1.height = 60;

    const gravity1 = createReferencedElement("gravity", block1, "stacked-grav1");
    const gravity2 = createReferencedElement("gravity", block2, "stacked-grav2");
    const normal1 = createReferencedElement("normal-force", block1, "stacked-norm1");

    const pullForce = createReferencedElement("force", block2, "stacked-pull");
    pullForce.label = "F";
    pullForce.rotation = 0;

    const elements: DiagramElement[] = [floor, block2, block1, gravity1, gravity2, normal1, pullForce];
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
      selectedId: `element:${block1.id}`,
    };
  }

  if (template === "atwood") {
    const ceiling = createDiagramElement("fixed-end", 450, 80, "atwood-ceiling");
    ceiling.width = 180;

    const pulley = createDiagramElement("fixed-pulley", 450, 160, "atwood-pulley");
    pulley.label = "P";

    const blockA = createDiagramElement("block", 380, 380, "atwood-blockA");
    blockA.label = "m₁";

    const blockB = createDiagramElement("block", 520, 320, "atwood-blockB");
    blockB.label = "m₂";

    const stringA = createConnection("string", blockA, pulley, "atwood-stringA");
    const stringB = createConnection("string", pulley, blockB, "atwood-stringB");

    const gravA = createReferencedElement("gravity", blockA, "atwood-gravA");
    const gravB = createReferencedElement("gravity", blockB, "atwood-gravB");
    const tensionA = createReferencedElement("tension", blockA, "atwood-tensA");
    tensionA.label = "T";
    const tensionB = createReferencedElement("tension", blockB, "atwood-tensB");
    tensionB.label = "T";

    const elements: DiagramElement[] = [ceiling, pulley, blockA, blockB, stringA, stringB, gravA, gravB, tensionA, tensionB];
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

  if (template === "pendulum") {
    const ceiling = createDiagramElement("fixed-end", 450, 100, "pendulum-ceiling");
    ceiling.width = 200;

    const sphere = createDiagramElement("sphere", 550, 360, "pendulum-sphere");
    sphere.label = "m";

    const string = createConnection("string", ceiling, sphere, "pendulum-string");
    string.label = "L";

    const gravity = createReferencedElement("gravity", sphere, "pendulum-gravity");
    const tension = createReferencedElement("tension", sphere, "pendulum-tension");
    tension.label = "T";

    const angle = createDiagramElement("angle-arc", 450, 100, "pendulum-angle");
    angle.label = "θ";

    const elements: DiagramElement[] = [ceiling, sphere, string, gravity, tension, angle];
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
      selectedId: `element:${sphere.id}`,
    };
  }

  if (template === "simply-supported-beam") {
    const beam = createDiagramElement("light-rod", 450, 300, "beam-member");
    beam.width = 400;
    beam.label = "梁 L";

    const pin = createDiagramElement("pin-support", 250, 341, "beam-pin");
    const roller = createDiagramElement("roller-support", 650, 341, "beam-roller");

    const load = createDiagramElement("distributed-load", 450, 245, "beam-dist-load");
    load.width = 400;
    load.label = "w";

    const forceP = createDiagramElement("force", 450, 210, "beam-forceP");
    forceP.label = "P";
    forceP.rotation = 90;

    const elements: DiagramElement[] = [beam, pin, roller, load, forceP];
    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      elements,
      variables,
      showAngle: false, showGravity: false, showNormal: false, showFriction: false, showSpring: false, showPulley: false,
      selectedId: `element:${beam.id}`,
    };
  }

  if (template === "cantilever-beam") {
    const wall = createDiagramElement("fixed-end", 250, 300, "cantilever-wall");
    wall.height = 150;
    wall.rotation = 90;

    const beam = createDiagramElement("light-rod", 450, 300, "cantilever-beam");
    beam.width = 400;
    beam.label = "片持ち梁 L";

    const forceP = createDiagramElement("force", 650, 250, "cantilever-forceP");
    forceP.label = "P";
    forceP.rotation = 90;

    const moment = createDiagramElement("bending-moment", 250, 240, "cantilever-moment");
    moment.label = "M₀";

    const elements: DiagramElement[] = [wall, beam, forceP, moment];
    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      elements,
      variables,
      showAngle: false, showGravity: false, showNormal: false, showFriction: false, showSpring: false, showPulley: false,
      selectedId: `element:${beam.id}`,
    };
  }

  if (template === "portal-frame") {
    const colLeft = createDiagramElement("light-rod", 300, 350, "portal-colL");
    colLeft.width = 200; colLeft.rotation = -90;

    const colRight = createDiagramElement("light-rod", 600, 350, "portal-colR");
    colRight.width = 200; colRight.rotation = -90;

    const beam = createDiagramElement("light-rod", 450, 250, "portal-beam");
    beam.width = 300;

    const jointL = createDiagramElement("rigid-joint", 300, 250, "portal-jointL");
    const jointR = createDiagramElement("rigid-joint", 600, 250, "portal-jointR");

    const pinL = createDiagramElement("pin-support", 300, 491, "portal-pinL");
    const pinR = createDiagramElement("pin-support", 600, 491, "portal-pinR");

    const forceH = createDiagramElement("force", 220, 250, "portal-forceH");
    forceH.label = "H"; forceH.rotation = 0;

    const elements: DiagramElement[] = [colLeft, colRight, beam, jointL, jointR, pinL, pinR, forceH];
    const variables: Variable[] = elements.map((item) => createVariableForElement(item));

    return {
      ...INITIAL_SCENE,
      elements,
      variables,
      showAngle: false, showGravity: false, showNormal: false, showFriction: false, showSpring: false, showPulley: false,
      selectedId: `element:${beam.id}`,
    };
  }

  return INITIAL_SCENE;
}
