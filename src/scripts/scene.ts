// The 3D picture of the site, drawn with three.js on one fixed canvas behind the page, together
// with the background (porcelain, with a faint glow of cobalt around the model; graphite in the
// closing chapter) and the name of the hero.
//
// The picture is one object that transforms. At rest it is a processor chip (public/models/
// objects.glb, modelled in Blender: tools/blender/objects.py) in its real layers: solder balls, a
// laminated substrate printed with traces, rings of capacitors, a silicon interposer on its bumps,
// two compute dies, an I/O die and two memory stacks on micro bumps, framed in cobalt, the thermal
// layer, and a brushed heat spreader marked "KM". Section by section it opens up into its layers
// (an exploded view of the full stack) and closes again. In the work
// list it becomes the object of the case study that is lit (documents, padlock, server, volleyball,
// kettlebell, house, safe), and on a case study page the object of that study. Every change
// dissolves the old object along a soft cobalt edge while the new one builds itself. Nothing turns
// on its own: the model moves only with the page, leans a little towards the pointer, and a click
// lifts the chip's layers for a moment.
//
// On a case study page the object tells a story while the page is read: the scroll through the
// page plays it. Its parts move as keyframed in Blender (the key goes into the lock and turns, the
// safe's door opens, the drives fly up into the cloud...; the model's animation, split by object),
// and the view moves as STORIES says: round the house, the floors lifted apart, then down into its
// living room.
//
// motion.ts tells the scene where the scroll is (setJourney), which case study is lit in the work
// list (setActiveShape) and how far the case study page has been read (setStory).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const PORCELAIN = new THREE.Color("#f4f3ef");
const GRAPHITE = new THREE.Color("#16181d");
const COBALT = new THREE.Color("#2e5bff");
const COBALT_LIGHT = new THREE.Color("#8aa2ff");

/* ---------- Objects in layers ---------- */

// The parts of an object that move apart (by their names in Blender): how far each moves up when
// the object is fully open (in the object's own units: the chip is about 2.2 wide, the house 2.9),
// and for the chip how it leans when the layers scatter (the dark chapter).
type LayerMove = { lift: number; lean?: [number, number] };
const LAYERS: Record<string, Record<string, LayerMove>> = {
  chip: {
    Balls: { lift: -0.5, lean: [0.12, -0.2] },
    Substrate: { lift: 0, lean: [-0.08, 0.1] },
    Components: { lift: 0.18, lean: [0.18, 0.06] },
    Bumps: { lift: 0.3, lean: [-0.1, 0.14] },
    Interposer: { lift: 0.42, lean: [0.14, -0.08] },
    DieLine: { lift: 0.46, lean: [-0.2, -0.12] },
    MicroBumps: { lift: 0.56, lean: [0.08, 0.18] },
    Die: { lift: 0.7, lean: [-0.14, 0.16] },
    Thermal: { lift: 0.92, lean: [0.1, -0.14] },
    Lid: { lift: 1.25, lean: [0.22, -0.1] },
  },
  "stekner-house": {
    Upper: { lift: 0.7 },
    Roof: { lift: 1.5 },
  },
};

// Objects that lie flat in their model (the chip, the papers) are leaned back this far, so their
// top faces the viewer at an angle instead of showing its edge.
const LEAN: Record<string, number> = { chip: 0.85, "document-platform": 0.6 };

/* ---------- Stops: where the model is for each section ---------- */

type Stop = {
  /** Where the model stands: 0 is the centre of the screen, 1 and -1 are its edges. */
  x: number;
  y: number;
  scale: number;
  /** How far the whole model is tilted towards the viewer and turned (radians). */
  tilt: number;
  turn: number;
  /** How far the chip is open: 0 closed, 1 its layers spread apart. */
  open: number;
  /** The layers lean every which way (the dark chapter's first half). */
  scatter?: number;
  /** A case study's story: how far the house's floors are lifted apart, how far the view has stepped inside. */
  floors?: number;
  inside?: number;
  /** Brightness of the cobalt line round the die, and of the glow behind the model. */
  glow: number;
  /** Which object the model becomes: the chip, or the case study object of the list or page. */
  form: "chip" | "list" | "page";
  /** The closing chapter: the background turns graphite (html.on-dark). */
  dark?: boolean;
};

// Where the object stands on a case study page, before its story moves it.
const PAGE = { x: 0.55, y: -0.02, scale: 1.25, tilt: 0.15, turn: -0.4 };

const STOPS: Record<string, Stop> = {
  hero: { x: 0.3, y: -0.02, scale: 1.45, tilt: 0.05, turn: -0.55, open: 0, glow: 1, form: "chip" },
  about: { x: 0.56, y: 0, scale: 1.15, tilt: -0.2, turn: 0.45, open: 1, glow: 1, form: "chip" },
  work: { x: 0.6, y: -0.02, scale: 1.3, tilt: 0.12, turn: -0.35, open: 0, glow: 1, form: "list" },
  skills: { x: -0.52, y: 0, scale: 1.1, tilt: -0.45, turn: 0.25, open: 0.65, glow: 1.1, form: "chip" },
  offer: { x: 0.68, y: 0.58, scale: 0.5, tilt: 0.1, turn: 0.3, open: 0, glow: 0.9, form: "chip" },
  chaos: { x: 0.45, y: 0, scale: 1.15, tilt: -0.1, turn: 0.2, open: 1.25, scatter: 1, glow: 1.2, form: "chip", dark: true },
  order: { x: 0.45, y: 0, scale: 1.3, tilt: 0.1, turn: -0.2, open: 0, glow: 1.4, form: "chip", dark: true },
  contact: { x: 0.55, y: -0.05, scale: 1.15, tilt: 0.05, turn: -0.3, open: 0.25, glow: 1.1, form: "chip" },
  detail: { ...PAGE, open: 0, glow: 1, form: "page" },
};

// The view during each case study's story, by how far its page has been read (at, 0 to 1); between
// two moments every value eases from one to the next. floors: how far the house's floors are
// lifted apart; inside: how far the view has stepped down into its living room. A study without
// its own story turns slowly while it is read.
type Moment = { at: number; x: number; y: number; scale: number; tilt: number; turn: number; floors?: number; inside?: number };
const TURN = Math.PI * 2;
const STORIES: Record<string, Moment[]> = {
  "stekner-house": [
    { at: 0, ...PAGE, scale: 1.35, tilt: 0.18, turn: -0.5 },
    { at: 0.08, ...PAGE, scale: 1.35, tilt: 0.18, turn: -0.5 },
    { at: 0.38, ...PAGE, scale: 1.35, tilt: 0.3, turn: -0.5 + TURN * 0.58 },
    { at: 0.62, ...PAGE, y: -0.1, scale: 1.2, tilt: 0.75, turn: -0.5 + TURN, floors: 1 },
    { at: 0.88, ...PAGE, y: 0, scale: 3.2, tilt: 1.0, turn: -0.3 + TURN, floors: 3, inside: 1 },
    { at: 1, ...PAGE, y: 0, scale: 3.4, tilt: 1.0, turn: -0.1 + TURN, floors: 3, inside: 1 },
  ],
  "document-platform": [
    { at: 0, ...PAGE, scale: 1.3, tilt: 0, turn: -0.3 },
    { at: 1, ...PAGE, scale: 1.3, tilt: 0.15, turn: 0.1 },
  ],
  "rebac-authorization": [
    { at: 0, ...PAGE, tilt: 0.12, turn: -0.5 },
    { at: 0.5, ...PAGE, tilt: 0.1, turn: -0.15 },
    { at: 1, ...PAGE, tilt: 0.2, turn: 0.2 },
  ],
  "azure-migration": [
    { at: 0, ...PAGE, tilt: 0.2, turn: -0.4 },
    { at: 1, ...PAGE, tilt: 0.3, turn: 0.3 },
  ],
  mojbeach: [
    { at: 0, ...PAGE, scale: 1.1, tilt: 0.1, turn: -0.3 },
    { at: 1, ...PAGE, scale: 1.1, tilt: 0.1, turn: 0.3 },
  ],
  "fuel-guide": [
    { at: 0, ...PAGE, scale: 1.2, tilt: 0.2, turn: -0.35 },
    { at: 1, ...PAGE, scale: 1.2, tilt: 0.25, turn: 0.2 },
  ],
  omnikeep: [
    { at: 0, ...PAGE, tilt: 0.1, turn: -0.3 },
    { at: 0.5, ...PAGE, tilt: 0.1, turn: -0.5 },
    { at: 1, ...PAGE, tilt: 0.2, turn: -0.1 },
  ],
};
const READING: Moment[] = [
  { at: 0, ...PAGE },
  { at: 1, ...PAGE, turn: PAGE.turn + 0.8 },
];

// On narrow screens the text needs the full width: the model stands in the empty box a section
// keeps for it ([data-stage="stop name"]) and scrolls with the page. A section without a box (the
// dark chapter aside) sends it small into the top corner.
const NARROW_SCALE: Record<string, number> = { hero: 0.95, about: 0.75, skills: 0.75, contact: 0.8, detail: 0.7 };
const NARROW_CORNER = { x: 0.62, y: 0.74, scale: 0.32 };

/* ---------- State shared with motion.ts ---------- */

let running = false;
const journey = { from: "hero", to: "hero", progress: 1 };
let activeShape: string | null = null;
let storyProgress = 0;

export function sceneIsRunning() {
  return running;
}

/** The scroll is between two stops (names from STOPS), progress 0..1. */
export function setJourney(from: string, to: string, progress: number) {
  journey.from = STOPS[from] ? from : "detail";
  journey.to = STOPS[to] ? to : "detail";
  journey.progress = progress;
}

/** The case study whose object the model becomes in the work list (its slug), or null. */
export function setActiveShape(slug: string | null) {
  activeShape = slug;
}

/** How far the case study page has been read (0 to 1). */
export function setStory(progress: number) {
  storyProgress = progress;
}

/** Move a value towards its target, the same at every frame rate. */
function ease(current: number, target: number, rate: number, seconds: number) {
  return current + (target - current) * (1 - Math.exp(-rate * seconds));
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Between two angles the short way round (the house's story ends a full turn further than it began). */
function lerpAngle(from: number, to: number, t: number) {
  const difference = ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + difference * t;
}

/* ---------- Materials ---------- */

/** A light studio, painted on a canvas: what the metal and the glass reflect. Large softboxes
 *  and a darker floor, so metal reads as metal (light and dark in it) without turning shiny. */
function studioReflections(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const paint = canvas.getContext("2d")!;
  const room = paint.createLinearGradient(0, 0, 0, 512);
  room.addColorStop(0, "#e4e5e8");
  room.addColorStop(0.45, "#a3a6ac");
  room.addColorStop(0.55, "#575b62");
  room.addColorStop(1, "#2c2f34");
  paint.fillStyle = room;
  paint.fillRect(0, 0, 1024, 512);
  paint.filter = "blur(12px)";
  paint.fillStyle = "#ffffff";
  paint.fillRect(90, 50, 260, 150);
  paint.fillRect(660, 60, 120, 190);
  paint.fillStyle = "#1c1e22";
  paint.fillRect(420, 120, 160, 120);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const generator = new THREE.PMREMGenerator(renderer);
  const reflections = generator.fromEquirectangular(texture).texture;
  texture.dispose();
  generator.dispose();
  return reflections;
}

/** The values each shape's materials share: how far it has dissolved, where its middle is. */
type Dissolve = {
  uDissolve: { value: number };
  uSpace: { value: THREE.Matrix4 };
  uEdgeA: { value: THREE.Color };
  uEdgeB: { value: THREE.Color };
};

/**
 * Teach a material to dissolve: where a noise (fixed to the shape, rising from below) is under
 * the dissolve value the surface is cut away, and along the cut it glows cobalt.
 */
function prepare(material: THREE.MeshStandardMaterial, dissolve: Dissolve) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, dissolve);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uSpace;\nvarying vec3 vSpace;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvSpace = (uSpace * modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uDissolve;
        uniform vec3 uEdgeA;
        uniform vec3 uEdgeB;
        varying vec3 vSpace;
        float dissolveHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float dissolveNoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(dissolveHash(i), dissolveHash(i + vec3(1, 0, 0)), f.x), mix(dissolveHash(i + vec3(0, 1, 0)), dissolveHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(dissolveHash(i + vec3(0, 0, 1)), dissolveHash(i + vec3(1, 0, 1)), f.x), mix(dissolveHash(i + vec3(0, 1, 1)), dissolveHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float dissolveField = (dissolveNoise(vSpace * 2.6) * 0.65 + dissolveNoise(vSpace * 7.0) * 0.15) + (vSpace.y * 0.5 + 0.5) * 0.25;
        float dissolveCut = uDissolve * 1.12 - 0.04;
        if (dissolveField < dissolveCut) discard;
        float dissolveEdge = (1.0 - smoothstep(0.0, 0.06, dissolveField - dissolveCut)) * step(0.001, uDissolve);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += mix(uEdgeA, uEdgeB, clamp(dissolveField * 1.4 - 0.2, 0.0, 1.0)) * dissolveEdge * 2.5;`,
      );
  };
}

/** The materials of the objects, by the names they have in Blender (tools/blender/studio.py).
 *  Finishes are satin: calm reflections rather than shine. Pictures painted onto an object (the
 *  substrate's traces, the dies' circuits, the ball's panels) are kept from the model (loader). */
function objectMaterial(name: string): THREE.MeshStandardMaterial {
  if (name.startsWith("Photo")) {
    // Photos of the real holiday apartment on the walls of the model house.
    return new THREE.MeshStandardMaterial({ roughness: 0.6 });
  }
  if (name.startsWith("Die print")) {
    // The dies' circuits: a dark mirror with a faint rainbow, like a wafer.
    return new THREE.MeshPhysicalMaterial({ metalness: 0.35, roughness: 0.22, iridescence: 0.5, iridescenceIOR: 1.6 });
  }
  switch (name) {
    case "Brushed metal":
      return new THREE.MeshStandardMaterial({ color: "#b8bcc2", metalness: 1, roughness: 0.3 });
    case "Steel":
      return new THREE.MeshStandardMaterial({ color: "#8f959c", metalness: 1, roughness: 0.26 });
    case "Polished metal":
      return new THREE.MeshStandardMaterial({ color: "#c2c5ca", metalness: 1, roughness: 0.22 });
    case "Solder":
      return new THREE.MeshStandardMaterial({ color: "#c3c6cb", metalness: 1, roughness: 0.26 });
    case "Thermal":
      return new THREE.MeshStandardMaterial({ color: "#a6a9ae", metalness: 1, roughness: 0.45 });
    case "Graphite":
      return new THREE.MeshPhysicalMaterial({ color: "#1d2026", roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    case "Powder coat":
    case "Powder coat grain": // matte black on cast iron, the grain in a normal map
      return new THREE.MeshStandardMaterial({ color: "#16181b", roughness: 0.62 });
    case "Interposer print":
      return new THREE.MeshPhysicalMaterial({ metalness: 0.3, roughness: 0.25, iridescence: 0.4, iridescenceIOR: 1.6 });
    case "Oak":
      return new THREE.MeshStandardMaterial({ color: "#cdb38c", roughness: 0.55 });
    case "Fabric":
      return new THREE.MeshStandardMaterial({ color: "#a9abae", roughness: 0.9 });
    case "Foliage":
      return new THREE.MeshStandardMaterial({ color: "#475e4c", roughness: 0.7 });
    case "Desk pad":
      return new THREE.MeshStandardMaterial({ color: "#b4b2ab", roughness: 0.9, envMapIntensity: 0.7 });
    case "Rubber":
      return new THREE.MeshStandardMaterial({ color: "#17191c", roughness: 0.75 });
    case "Protein":
      return new THREE.MeshStandardMaterial({ color: "#ddd1bc", roughness: 0.8 });
    case "Apple":
      return new THREE.MeshStandardMaterial({ color: "#9e1a16", roughness: 0.45 });
    case "Stem":
      return new THREE.MeshStandardMaterial({ color: "#5a4530", roughness: 0.8 });
    case "Cast iron":
      return new THREE.MeshStandardMaterial({ color: "#1e2024", roughness: 0.75, envMapIntensity: 0.7 });
    case "Substrate":
      return new THREE.MeshPhysicalMaterial({ color: "#2b2f35", roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.25 });
    case "Substrate print":
      return new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    case "Laminate":
      return new THREE.MeshStandardMaterial({ color: "#3d4248", roughness: 0.6 });
    case "Underfill":
      return new THREE.MeshStandardMaterial({ color: "#14171b", roughness: 0.6 });
    case "Ceramic":
      return new THREE.MeshStandardMaterial({ color: "#bdb5a6", roughness: 0.5 });
    case "Silicon":
      return new THREE.MeshPhysicalMaterial({ color: "#232833", metalness: 0.5, roughness: 0.18, iridescence: 0.5, iridescenceIOR: 1.6 });
    case "Ball":
      return new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.4 });
    case "Paper":
      return new THREE.MeshStandardMaterial({ color: "#eceae4", roughness: 0.9, envMapIntensity: 0.6 });
    case "Leather":
      return new THREE.MeshPhysicalMaterial({ color: "#f2f1ed", roughness: 0.6, clearcoat: 0.15 });
    case "Porcelain":
      return new THREE.MeshStandardMaterial({ color: "#f4f3ef", roughness: 0.55, envMapIntensity: 0.8 });
    case "Concrete":
      return new THREE.MeshStandardMaterial({ color: "#d9d7d2", roughness: 0.85, envMapIntensity: 0.7 });
    case "Cobalt":
      return new THREE.MeshStandardMaterial({ color: COBALT, roughness: 0.45 });
    case "Cobalt glow":
      return new THREE.MeshStandardMaterial({ color: COBALT, emissive: COBALT, emissiveIntensity: 1.4, roughness: 0.4 });
    case "Frosted glass":
      return new THREE.MeshPhysicalMaterial({ color: "#dfe3ea", transmission: 0.85, thickness: 0.6, ior: 1.45, roughness: 0.5 });
    case "Smoked glass":
      return new THREE.MeshPhysicalMaterial({ color: "#aab0ba", transmission: 1, thickness: 0.4, ior: 1.5, roughness: 0.1, attenuationColor: new THREE.Color("#4d535e"), attenuationDistance: 1.6 });
    default:
      return new THREE.MeshStandardMaterial({ color: "#b8bcc2", metalness: 1, roughness: 0.3 });
  }
}

/* ---------- The background: porcelain, a faint glow around the model, and the hero's name ---------- */

const BACKGROUND_VERTEX = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const BACKGROUND_FRAGMENT = /* glsl */ `
  uniform vec2 uResolution;
  uniform vec3 uBase;
  uniform vec3 uDarkBase;
  uniform vec3 uGlowColor;
  uniform vec2 uGlowAt;        // canvas pixels
  uniform float uGlowSize;     // canvas pixels
  uniform float uGlow;
  uniform float uDark;
  uniform sampler2D uNameMap;  // the hero's name, drawn on a canvas in its own colours
  uniform vec4 uNameBox;       // where it goes: x, y (bottom left), width, height in canvas pixels
  uniform float uNameOn;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 px = gl_FragCoord.xy;
    vec2 uv = px / uResolution;
    // Porcelain, a touch darker towards the edges; in the closing chapter graphite.
    float edge = length((uv - vec2(0.55, 0.55)) * vec2(1.2, 1.0));
    vec3 color = mix(uBase, uBase * 0.92, smoothstep(0.2, 1.1, edge));
    color = mix(color, mix(uDarkBase * 1.25, uDarkBase * 0.85, smoothstep(0.2, 1.1, edge)), uDark);
    // A faint glow of cobalt around the model.
    float distance = length(px - uGlowAt) / max(uGlowSize, 1.0);
    color = mix(color, uGlowColor, exp(-distance * distance * 2.6) * min(uGlow, 1.2) * mix(0.04, 0.05, uDark));
    // The name, in the colours it was drawn in.
    vec2 nameUv = (px - uNameBox.xy) / uNameBox.zw;
    if (uNameOn > 0.0 && all(greaterThanEqual(nameUv, vec2(0.0))) && all(lessThanEqual(nameUv, vec2(1.0)))) {
      vec4 letters = texture2D(uNameMap, nameUv);
      color = mix(color, letters.rgb / max(letters.a, 0.001), letters.a * uNameOn);
    }
    // A little grain, so the gradient never bands.
    color += (hash(px) - 0.5) * 0.01;
    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ---------- The scene ---------- */

export function startScene(canvas: HTMLCanvasElement) {
  if (running) return;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    document.documentElement.classList.add("no-scene");
    return; // no WebGL: the page shows a still of the chip instead (Hero.astro)
  }
  running = true;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  let pixelRatio = Math.min(window.devicePixelRatio, 2);

  const scene = new THREE.Scene();
  scene.environment = studioReflections(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.z = 10;

  // A soft key light from above left and a quiet light from behind.
  const key = new THREE.DirectionalLight("#ffffff", 2);
  key.position.set(-3, 5, 6);
  const rim = new THREE.DirectionalLight("#f2f5ff", 0.8);
  rim.position.set(4, 2, -4);
  scene.add(key, rim);

  /* ----- The background ----- */

  const nameCanvas = document.createElement("canvas");
  const nameMap = new THREE.CanvasTexture(nameCanvas);
  nameMap.colorSpace = THREE.SRGBColorSpace;
  nameMap.premultiplyAlpha = true;
  const background = new THREE.ShaderMaterial({
    vertexShader: BACKGROUND_VERTEX,
    fragmentShader: BACKGROUND_FRAGMENT,
    depthWrite: false,
    uniforms: {
      uResolution: { value: new THREE.Vector2() },
      // three keeps colours in linear space already, as the shader needs them.
      uBase: { value: PORCELAIN.clone() },
      uDarkBase: { value: GRAPHITE.clone() },
      uGlowColor: { value: COBALT.clone() },
      uGlowAt: { value: new THREE.Vector2() },
      uGlowSize: { value: 300 },
      uGlow: { value: 1 },
      uDark: { value: 0 },
      uNameMap: { value: nameMap },
      uNameBox: { value: new THREE.Vector4() },
      uNameOn: { value: 0 },
    },
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), background);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -10;
  scene.add(backdrop);

  /* ----- The model: the chip and the case study objects, in one container ----- */

  const model = new THREE.Group();
  model.position.y = 8; // it drops in from above when it has loaded
  scene.add(model);

  // One form per object the model can become: its group, and how far it has dissolved (1 = gone).
  // Each case study object also has its story: its share of the model's animation, played by time.
  type Form = { group: THREE.Group; dissolve: Dissolve; story?: { mixer: THREE.AnimationMixer; length: number } };
  const forms = new Map<string, Form>();
  // The layers of each object that opens (chip, house), with where each sits when it is closed.
  type Layer = { part: THREE.Object3D; rest: THREE.Vector3; restTurn: THREE.Quaternion } & LayerMove;
  const layers = new Map<string, Layer[]>();
  // The point of the house its story steps into (an empty named Living in the model).
  let living: THREE.Object3D | null = null;
  // The cobalt line round the die: it glows brighter in some sections.
  const glowing: THREE.MeshStandardMaterial[] = [];

  new GLTFLoader().load("/models/objects.glb", (gltf) => {
    // Each object has its own materials, so each dissolves on its own.
    for (const node of [...gltf.scene.children]) {
      const dissolve: Dissolve = {
        uDissolve: { value: 1 },
        uSpace: { value: new THREE.Matrix4() },
        uEdgeA: { value: COBALT.clone() },
        uEdgeB: { value: COBALT_LIGHT.clone() },
      };
      const materials = new Map<string, THREE.MeshStandardMaterial>();
      node.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const original = mesh.material as THREE.MeshStandardMaterial;
        const name = original.name;
        if (!materials.has(name)) {
          const material = objectMaterial(name);
          // Keep the pictures painted onto the object, and its normal map (the ball's seams and dimples).
          if (original.map) material.map = original.map;
          if (original.normalMap) {
            material.normalMap = original.normalMap;
            material.normalScale.copy(original.normalScale);
          }
          prepare(material, dissolve);
          materials.set(name, material);
          if (name === "Cobalt glow" && node.name === "chip") glowing.push(material);
        }
        mesh.material = materials.get(name)!;
      });
      const group = new THREE.Group();
      group.add(node);
      group.visible = false;
      group.rotation.x = LEAN[node.name] ?? 0;
      const moves = LAYERS[node.name] ?? {};
      const found: Layer[] = [];
      for (const [name, move] of Object.entries(moves)) {
        const part = node.getObjectByName(name);
        if (part) found.push({ part, rest: part.position.clone(), restTurn: part.quaternion.clone(), ...move });
      }
      layers.set(node.name, found);
      living ??= node.getObjectByName("Living") ?? null;
      model.add(group);
      forms.set(node.name, { group, dissolve, story: storyOf(node, gltf.animations[0]) });
    }
  });

  /** The tracks of the model's animation that move this object's parts, ready to play by time. */
  function storyOf(node: THREE.Object3D, animation?: THREE.AnimationClip) {
    if (!animation) return undefined;
    const names = new Set<string>();
    node.traverse((part) => names.add(part.name));
    const tracks = animation.tracks.filter((track) => names.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName));
    if (tracks.length === 0) return undefined;
    const mixer = new THREE.AnimationMixer(node);
    const clip = new THREE.AnimationClip(node.name, animation.duration, tracks);
    mixer.clipAction(clip).play();
    return { mixer, length: animation.duration };
  }

  /* ----- Composition: the scene, then the output (no bloom: it made white paper and chrome glow) ----- */

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  /* ----- Sizes ----- */

  let narrow = false;
  let halfWidth = 1;
  let halfHeight = 1;
  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfWidth = halfHeight * camera.aspect;
    renderer.getDrawingBufferSize(background.uniforms.uResolution.value);
    narrow = width < 1024;
    drawName();
  }

  /* ----- The hero's name, drawn into the background behind the chip ----- */

  const nameElement = () => document.querySelector<HTMLElement>("#hero-name");
  function drawName() {
    const element = nameElement();
    if (!element) return;
    const box = element.getBoundingClientRect();
    const dpr = pixelRatio;
    nameCanvas.width = Math.max(1, Math.round(box.width * dpr));
    nameCanvas.height = Math.max(1, Math.round(box.height * dpr));
    const paint = nameCanvas.getContext("2d")!;
    paint.clearRect(0, 0, nameCanvas.width, nameCanvas.height);
    const style = getComputedStyle(element);
    paint.textBaseline = "alphabetic";
    if ("letterSpacing" in paint) (paint as any).letterSpacing = style.letterSpacing;
    // Each line in its own colour (data-color on the line, the colour the CSS gives it).
    element.querySelectorAll<HTMLElement>("span").forEach((line) => {
      const lineBox = line.getBoundingClientRect();
      const size = parseFloat(style.fontSize) * dpr;
      paint.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
      paint.fillStyle = line.dataset.color ?? "#16181d";
      const metrics = paint.measureText(line.textContent ?? "");
      const ascent = metrics.fontBoundingBoxAscent ?? size * 0.9;
      const descent = metrics.fontBoundingBoxDescent ?? size * 0.25;
      const lineHeight = lineBox.height * dpr;
      const baseline = (lineBox.top - box.top) * dpr + (lineHeight - ascent - descent) / 2 + ascent;
      paint.fillText(line.textContent ?? "", (lineBox.left - box.left) * dpr, baseline);
    });
    nameMap.needsUpdate = true;
  }
  resize();
  window.addEventListener("resize", resize);
  document.fonts?.ready.then(drawName);
  document.addEventListener("astro:page-load", () => setTimeout(drawName, 50));

  /* ----- The pointer: the model leans towards it; a click lifts the chip's layers ----- */

  const pointer = new THREE.Vector2();
  const look = new THREE.Vector2();
  let lift = 0; // extra opening from a click, fades out
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  });
  window.addEventListener("pointerdown", (event) => {
    if (reducedMotion || (event.target as HTMLElement).closest("a, button")) return;
    lift = 0.35;
  });

  /* ----- One frame ----- */

  // Where each stop puts the model on narrow screens: in its box, or small in the corner.
  function stopNamed(name: string): Stop {
    if (!narrow) return name === "detail" ? storyStop() : STOPS[name];
    // On narrow screens a case study's story plays in the box under its title, without stepping inside.
    const stop = name === "detail" ? { ...storyStop(), inside: 0, floors: 0 } : STOPS[name];
    if (stop.dark) return { ...stop, x: 0.2, y: 0.42, scale: 0.75 };
    const stage = document.querySelector(`[data-stage~="${name}"]`)?.getBoundingClientRect();
    if (!stage || stage.height === 0) return { ...stop, ...NARROW_CORNER };
    return {
      ...stop,
      x: ((stage.left + stage.width / 2) / window.innerWidth) * 2 - 1,
      y: 1 - ((stage.top + stage.height / 2) / window.innerHeight) * 2,
      scale: NARROW_SCALE[name] ?? 0.7,
    };
  }


  /** Where the page's story is: the two moments around how far it is read, eased between. */
  function storyStop(): Stop {
    const story = STORIES[pageSlug() ?? ""] ?? READING;
    const next = Math.max(1, story.findIndex((moment) => moment.at >= storyNow));
    const a = story[next - 1];
    const b = story[next];
    const t = smooth(THREE.MathUtils.clamp((storyNow - a.at) / Math.max(0.0001, b.at - a.at), 0, 1));
    const lerp = THREE.MathUtils.lerp;
    return {
      ...STOPS.detail,
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      scale: lerp(a.scale, b.scale, t),
      tilt: lerp(a.tilt, b.tilt, t),
      turn: lerp(a.turn, b.turn, t),
      floors: lerp(a.floors ?? 0, b.floors ?? 0, t),
      inside: lerp(a.inside ?? 0, b.inside ?? 0, t),
    };
  }

  function pageSlug() {
    return document.querySelector<HTMLElement>("[data-shape-page]")?.dataset.shapePage;
  }

  /** The object a stop shows: the chip, the lit study of the list, or the study of the page. */
  function formFor(stop: Stop) {
    if (stop.form === "list" && activeShape && forms.has(activeShape)) return activeShape;
    if (stop.form === "page") {
      const slug = pageSlug();
      if (slug && forms.has(slug)) return slug;
    }
    return "chip";
  }

  const turnTo = new THREE.Euler();
  const turnQuaternion = new THREE.Quaternion();
  const leanTurn = new THREE.Quaternion();
  const screen = new THREE.Vector3();
  let time = 0;
  let open = 0;
  let scatter = 0;
  let floors = 0;
  let inside = 0;
  let storyNow = 0;
  const livingAt = new THREE.Vector3();
  let glow = 1;
  let dark = 0;
  let arrived = false;

  function frame(seconds: number) {
    if (!reducedMotion) time += seconds;
    storyNow = reducedMotion ? storyProgress : ease(storyNow, storyProgress, 5, seconds);
    const from = stopNamed(journey.from);
    const to = stopNamed(journey.to);
    const mix = smooth(journey.progress);
    const near = mix > 0.5 ? to : from;
    const quick = reducedMotion ? 1000 : 1;
    const lerp = THREE.MathUtils.lerp;

    document.documentElement.classList.toggle("on-dark", Boolean(near.dark));
    dark = ease(dark, near.dark ? 1 : 0, 3 * quick, seconds);

    if (!reducedMotion) {
      look.x = ease(look.x, pointer.x, 2.5, seconds);
      look.y = ease(look.y, pointer.y, 2.5, seconds);
      lift *= Math.exp(-2.5 * seconds);
    }

    // The whole model: place, size, tilt, a slow float, the lean towards the pointer.
    let x = lerp(from.x, to.x, mix) * halfWidth;
    let y = lerp(from.y, to.y, mix) * halfHeight;
    // Stepping inside the house: the model moves so the living room comes to that place instead.
    inside = ease(inside, lerp(from.inside ?? 0, to.inside ?? 0, mix), 4 * quick, seconds);
    if (living && inside > 0.001) {
      living.getWorldPosition(livingAt).sub(model.position);
      x = lerp(x, x - livingAt.x, inside);
      y = lerp(y, y - livingAt.y, inside);
    }
    const scale = lerp(from.scale, to.scale, mix);
    const floatY = reducedMotion ? 0 : Math.sin(time * 0.8) * 0.05;
    const rate = 4 * quick;
    model.position.x = ease(model.position.x, x, rate, seconds);
    model.position.y = ease(model.position.y, arrived ? y + floatY : y, arrived ? rate : 2.2 * quick, seconds);
    model.scale.setScalar(ease(model.scale.x, scale, rate, seconds));
    turnTo.set(lerp(from.tilt, to.tilt, mix) - look.y * 0.15, lerpAngle(from.turn, to.turn, mix) + look.x * 0.25, 0);
    model.quaternion.slerp(turnQuaternion.setFromEuler(turnTo), 1 - Math.exp(-rate * seconds));
    if (forms.size && Math.abs(model.position.y - y) < 0.3) arrived = true;
    model.updateMatrixWorld();

    // The forms: the one this stop shows builds itself, every other one dissolves.
    const showing = formFor(near);
    forms.forEach((form, name) => {
      const target = name === showing ? 0 : 1;
      const step = seconds / (target === 0 ? 1.1 : 0.7);
      const now = form.dissolve.uDissolve.value;
      form.dissolve.uDissolve.value = reducedMotion ? target : now + THREE.MathUtils.clamp(target - now, -step, step);
      form.group.visible = form.dissolve.uDissolve.value < 0.999;
      // The dissolve noise is fixed to the object: measured in the object's own space.
      form.dissolve.uSpace.value.copy(form.group.matrixWorld).invert();
      // Its story plays with the reading of its page (done a little before the end); anywhere
      // else the object rests.
      const reading = name === showing && near.form === "page";
      // (Just short of its last frame: at its very end a looping clip starts over.)
      form.story?.mixer.setTime(reading ? Math.min(0.9999, storyNow / 0.9) * form.story.length : 0);
    });

    // The chip's layers: spread along its axis as far as the stop opens it, leaning when they scatter.
    open = ease(open, lerp(from.open, to.open, mix), 3 * quick, seconds);
    scatter = ease(scatter, lerp(from.scatter ?? 0, to.scatter ?? 0, mix), 3 * quick, seconds);
    for (const layer of layers.get("chip") ?? []) {
      const lean = layer.lean ?? [0, 0];
      layer.part.position.copy(layer.rest);
      layer.part.position.y += layer.lift * (open + lift);
      layer.part.position.x += lean[1] * scatter * 1.5;
      leanTurn.setFromEuler(turnTo.set(lean[0] * scatter, 0, lean[1] * scatter));
      layer.part.quaternion.copy(layer.restTurn).multiply(leanTurn);
    }

    // The house's floors: lifted apart in its story.
    floors = ease(floors, lerp(from.floors ?? 0, to.floors ?? 0, mix), 3 * quick, seconds);
    for (const layer of layers.get("stekner-house") ?? []) {
      layer.part.position.copy(layer.rest);
      layer.part.position.y += layer.lift * floors;
    }

    // The glow: the line round the die, the glow on the background.
    glow = ease(glow, lerp(from.glow, to.glow, mix), 3 * quick, seconds);
    for (const material of glowing) material.emissiveIntensity = 1.4 * glow + open * 0.6;

    // The background: the glow follows the model, the name follows the page.
    const resolution = background.uniforms.uResolution.value;
    screen.copy(model.position).project(camera);
    background.uniforms.uGlowAt.value.set((screen.x * 0.5 + 0.5) * resolution.x, (screen.y * 0.5 + 0.5) * resolution.y);
    background.uniforms.uGlowSize.value = (model.scale.x / (halfHeight * 2)) * resolution.y * 1.4;
    background.uniforms.uGlow.value = glow;
    background.uniforms.uDark.value = dark;
    const name = nameElement();
    if (name) {
      const box = name.getBoundingClientRect();
      const dpr = resolution.y / window.innerHeight;
      background.uniforms.uNameBox.value.set(box.left * dpr, (window.innerHeight - box.bottom) * dpr, box.width * dpr, box.height * dpr);
      background.uniforms.uNameOn.value = ease(background.uniforms.uNameOn.value, 1, 3, seconds);
    } else {
      background.uniforms.uNameOn.value = 0;
    }

    composer.render(seconds);
  }

  /* ----- The loop ----- */

  let before = performance.now();
  let slowFrames = 0;
  function loop(now: number) {
    requestAnimationFrame(loop);
    if (document.hidden) {
      before = now;
      return;
    }
    // The first frame's time can lie a moment before the scene started: never a negative step.
    const seconds = THREE.MathUtils.clamp((now - before) / 1000, 0, 0.05);
    before = now;
    frame(seconds);

    // On a device that cannot keep up, draw fewer pixels (in steps).
    slowFrames = seconds > 0.034 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 90 && pixelRatio > 1) {
      pixelRatio = pixelRatio > 1.5 ? 1.5 : 1;
      slowFrames = 0;
      resize();
    }
  }
  requestAnimationFrame(loop);

  document.documentElement.classList.add("scene-on");
}
