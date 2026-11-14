// The 3D scene behind every page: one fixed canvas (#scene in Base.astro) that paints the page
// itself and, on it, a body of liquid chrome with a glass ring and a glass ball.
//
// The chrome is eight "drops" that flow together where they touch (metaballs, drawn by three's
// MarchingCubes). The page is a journey with a "stop" per chapter (STOPS): where the chrome is,
// how its drops are laid out (LAYOUTS: one body, a column, seven drops, a scatter, a perfect
// sphere ...), what the glass does, and the colours of the light on the page (PALETTES). motion.ts
// reports where the scroll is between two stops (setJourney); every frame the drops, the colours
// and the glass ease towards that state, so everything flows with the scroll and never jumps.
//
// Behind the chrome is a "wall" (a plane that fills the view, drawn by WALL_SHADER): soft fields
// of coloured light drifting slowly, the chrome's shadow, and the light the glass gathers and
// throws on the wall (caustics). The drops reach for the pointer and shake when clicked.
//
// The big name on the first screen is drawn in here too (a flat plane between the wall and the
// chrome, kept exactly over the page's own h1), because glass can only bend what is in the scene.
import {
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import gsap from "gsap";

/* ---------- The drops ---------- */

const DROPS = 8;
/** One drop: x, y, z and radius, in the chrome's own space (about -1 to 1). */
type Drop = [number, number, number, number];

/** A small seeded random generator, so the scatter is the same on every visit. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function scatterLayout(): Drop[] {
  const random = seededRandom(9);
  return Array.from({ length: DROPS }, () => [(random() - 0.5) * 1.7, (random() - 0.5) * 1.7, (random() - 0.5) * 1.1, 0.14 + random() * 0.12]);
}

const LAYOUTS: Record<string, Drop[]> = {
  // One restless body.
  one: [
    [0, 0, 0, 0.6],
    [0.36, 0.26, 0.1, 0.4],
    [-0.32, 0.3, -0.1, 0.36],
    [0.26, -0.36, 0.15, 0.38],
    [-0.36, -0.26, 0, 0.34],
    [0, 0.48, 0.2, 0.3],
    [0.52, -0.05, -0.2, 0.3],
    [-0.1, -0.52, -0.1, 0.3],
  ],
  // A large body with smaller ones drifting off it.
  drift: [
    [-0.15, -0.28, 0, 0.5],
    [0.12, -0.42, 0.1, 0.38],
    [-0.4, -0.12, -0.1, 0.36],
    [0.66, 0.5, 0, 0.27],
    [0.56, 0.62, 0.1, 0.2],
    [-0.62, 0.72, 0, 0.2],
    [0.86, -0.56, 0.1, 0.15],
    [-0.86, -0.74, 0, 0.12],
  ],
  // A standing column of beads that half melt into each other.
  column: Array.from({ length: DROPS }, (_, i): Drop => [0.12 * Math.sin(i * 1.3), 0.84 - i * 0.24, 0, i % 2 === 0 ? 0.27 : 0.21]),
  // Seven separate drops in a zigzag, one per skill, top to bottom (the eighth hides inside the last).
  seven: Array.from({ length: DROPS }, (_, i): Drop => {
    const drop = Math.min(i, 6);
    return [drop % 2 === 0 ? -0.3 : 0.3, 0.81 - drop * 0.27, 0, i === 7 ? 0.04 : 0.13];
  }),
  // A ring of drops.
  necklace: Array.from({ length: DROPS }, (_, i): Drop => {
    const angle = (i / DROPS) * Math.PI * 2;
    return [Math.cos(angle) * 0.68, Math.sin(angle) * 0.68, 0, 0.19];
  }),
  // Drops with no order.
  scatter: scatterLayout(),
  // Every drop in the same place: one perfect sphere.
  sphere: Array.from({ length: DROPS }, (): Drop => [0, 0, 0, 0.36]),
  // A calm body with three small moons.
  moons: [
    [0, 0, 0, 0.5],
    [0.1, 0.06, 0, 0.44],
    [-0.08, -0.06, 0.05, 0.42],
    [0.04, -0.1, -0.05, 0.4],
    [-0.06, 0.1, 0, 0.38],
    [0.82, 0.3, 0.1, 0.15],
    [-0.74, -0.5, 0, 0.13],
    [0.2, 0.86, -0.1, 0.11],
  ],
};

/* ---------- The stops ---------- */

/** The numbers that are blended between two stops. */
interface Pose {
  x: number;
  y: number;
  scale: number;
  /** How far the drops wander around their places (0 holds them still). */
  wobble: number;
  /** Size of the glass ring (1 circles the whole chrome). */
  ring: number;
  /** 1: the ring leaves the centre and circles the active drop, face on. */
  select: number;
  /** Size of the glass ball that circles the chrome (0 hides it). */
  lens: number;
}

interface Stop extends Pose {
  layout: string;
  palette: string;
  /** The page turns dark for this stop (the closing chapter). */
  dark: boolean;
}

/**
 * The colours of the wall: the page colour, then three soft fields of light on it: one around
 * the chrome, one low on the left, one high in the middle.
 */
const PALETTES: Record<string, string[]> = {
  dawn: ["#ebe8e3", "#ffc6ab", "#b8c7ff", "#efd8ff"],
  sand: ["#ece8e1", "#ffd6b5", "#c9d3ff", "#ffd3cc"],
  mist: ["#e8e9ed", "#c7d3ff", "#ffd8c4", "#d2efe5"],
  lilac: ["#ebe8ef", "#d9c8ff", "#bfdcff", "#ffd8ca"],
  night: ["#0b0c10", "#18205a", "#4b1a0b", "#20153c"],
  sunset: ["#eee7e1", "#ffb898", "#c2c8ff", "#ffe2b5"],
};

const STOPS: Record<string, Stop> = {
  hero: { x: 1.25, y: 0.25, scale: 1.05, wobble: 0.1, ring: 1, select: 0, lens: 1, layout: "one", palette: "dawn", dark: false },
  about: { x: 2.25, y: 0, scale: 0.95, wobble: 0.06, ring: 0.82, select: 0, lens: 0.8, layout: "drift", palette: "sand", dark: false },
  work: { x: 3.0, y: 0, scale: 0.85, wobble: 0.04, ring: 0.5, select: 0, lens: 0.6, layout: "column", palette: "mist", dark: false },
  skills: { x: -1.9, y: 0, scale: 1.15, wobble: 0.012, ring: 0.24, select: 1, lens: 0, layout: "seven", palette: "lilac", dark: false },
  offer: { x: 2.95, y: 1.5, scale: 0.5, wobble: 0.03, ring: 1.05, select: 0, lens: 0.7, layout: "necklace", palette: "sand", dark: false },
  chaos: { x: 2.0, y: 0, scale: 1.15, wobble: 0.13, ring: 1.15, select: 0, lens: 0.9, layout: "scatter", palette: "night", dark: true },
  order: { x: 2.1, y: 0, scale: 1, wobble: 0, ring: 0.95, select: 0, lens: 0.8, layout: "sphere", palette: "night", dark: true },
  contact: { x: 2.45, y: -0.25, scale: 0.9, wobble: 0.05, ring: 0.95, select: 0, lens: 0.9, layout: "moons", palette: "sunset", dark: false },
  detail: { x: 3.1, y: 1.2, scale: 0.5, wobble: 0.06, ring: 0.9, select: 0, lens: 0.7, layout: "drift", palette: "mist", dark: false },
};

/** Narrow screens: the chrome is large above the text on the first and last screen, and a small
    shape peeking in at the top corner everywhere else, so it stays out of the way of the text. */
const NARROW_STOPS: Record<string, Partial<Pose>> = {
  hero: { x: 0, y: 1.0, scale: 0.6 },
  contact: { x: 0, y: 1.2, scale: 0.5 },
  default: { x: 1.0, y: 2.3, scale: 0.3, lens: 0 },
};

const NARROW = 1024;
const INK = "#141518";
const CAMERA_Z = 9.5;
const CAMERA_FOV = 30;
const UNIT = 1.2; // size of the chrome: one unit of a layout in scene units
const NAME_Z = -1.6; // the name lies this far behind the chrome
const WALL_Z = -40; // the wall, far behind everything
const RING_RADIUS = 1.35;
const LENS_RADIUS = 0.42;

/* ---------- The wall ---------- */

/**
 * The wall's colour at a point of the screen, shared by the wall and the name plane. Positions are
 * in "screen heights" from the centre of the screen, so a round field stays round on any screen.
 */
const WALL_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uBase;
  uniform vec3 uGlowA;
  uniform vec3 uGlowB;
  uniform vec3 uGlowC;
  uniform float uLightness; // 1 on a light page, 0 on the dark one
  uniform vec2 uFocus;      // the chrome, on screen (0 to 1)
  uniform float uFocusSize; // its radius, in screen heights
  uniform vec2 uShadow;     // its shadow on the wall
  uniform vec2 uLens;       // where the glass ball focuses light on the wall
  uniform float uLensSize;  // the ball's radius, in screen heights
  varying vec2 vScreen;

  vec2 toSpace(vec2 screen) {
    return vec2((screen.x - 0.5) * uAspect, screen.y - 0.5);
  }

  float field(vec2 p, vec2 centre, float radius) {
    vec2 d = p - centre;
    return exp(-dot(d, d) / (radius * radius));
  }

  // Light that has passed through rippled glass: bright, thin, moving threads.
  float caustic(vec2 p, float t) {
    vec2 i = p;
    float c = 1.0;
    for (int n = 1; n <= 4; n++) {
      float s = t * (1.0 - 3.5 / float(n + 1));
      i = p + vec2(cos(s - i.x) + sin(s + i.y), sin(s - i.y) + cos(s + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + s) / 0.005), p.y / (cos(i.y + s) / 0.005)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
  }

  // The coloured light on the wall.
  vec3 wall(vec2 screen) {
    vec2 p = toSpace(screen);
    // A slow warp so the fields breathe instead of being perfect circles.
    vec2 w = p + 0.07 * vec2(sin(p.y * 3.1 + uTime * 0.21), sin(p.x * 2.7 - uTime * 0.17));
    vec2 focus = toSpace(uFocus);
    vec3 colour = uBase;
    colour = mix(colour, uGlowA, 0.85 * field(w, focus + 0.1 * vec2(sin(uTime * 0.13), cos(uTime * 0.11)), 0.42 + uFocusSize));
    colour = mix(colour, uGlowB, 0.75 * field(w, vec2(-0.42 * uAspect + 0.1 * sin(uTime * 0.09), -0.42 + 0.08 * cos(uTime * 0.12)), 0.62));
    colour = mix(colour, uGlowC, 0.6 * field(w, vec2(-0.08 * uAspect + 0.2 * cos(uTime * 0.07), 0.55 + 0.05 * sin(uTime * 0.1)), 0.55));
    return colour;
  }

  // What the chrome and the glass do to the wall: a soft shadow behind the chrome and a smaller
  // one behind the glass ball, both with caustic light in them (the light the glass gathers),
  // its colours a little apart like through a prism.
  vec3 light(vec2 screen, vec3 colour) {
    vec2 p = toSpace(screen);
    float radius = uFocusSize * 1.05;
    float shadow = field(p, toSpace(uShadow), radius);
    float lensSize = max(uLensSize, 0.0001);
    float lensShadow = field(p, toSpace(uLens), lensSize * 1.3) * step(0.0002, uLensSize);
    colour *= 1.0 - (0.2 * shadow + 0.12 * lensShadow) * uLightness;

    float glow = max(shadow, lensShadow);
    if (glow > 0.02) {
      // Warped, so the pattern does not read as tiles.
      vec2 q = (p - toSpace(uShadow)) / radius * 5.5;
      q += 0.6 * vec2(sin(q.y * 0.9 + uTime * 0.2), cos(q.x * 0.8 - uTime * 0.15)) - 250.0;
      float t = uTime * 0.4;
      vec3 threads = vec3(caustic(q, t), caustic(q + 0.02, t), caustic(q + 0.04, t));
      colour += threads * glow * glow * mix(0.6, 0.4, uLightness);
    }
    return colour;
  }
`;

/** The vertex shader of the wall and the name plane: hands the screen position to the colours. */
const SCREEN_VERTEX = /* glsl */ `
  varying vec2 vScreen;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vScreen = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
  }
`;

/* ---------- The scene ---------- */

interface SceneState {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  scene: Scene;
  /** Holds the chrome and the glass; placed and scaled by the pose. */
  group: Group;
  chrome: MarchingCubes;
  ring: Mesh;
  lens: Mesh;
  wall: Mesh;
  /** The uniforms of WALL_SHADER (the wall and the name plane share them). */
  uniforms: Record<string, { value: any }>;
  /** The four colours of the palette the scroll is at, eased into the uniforms every frame. */
  palette: Color[];
  name: { plane: Mesh; material: ShaderMaterial; canvas: HTMLCanvasElement; texture: CanvasTexture; element: HTMLElement | null; drawnFor: string };
  pose: Pose;
  target: Pose;
  /** Where every drop is, and where it is heading. */
  drops: Drop[];
  dropTargets: Drop[];
  activeDrop: number;
  dark: boolean;
  /** The pointer on screen (-1 to 1, y down); `active` while a mouse is over the page. */
  pointer: { x: number; y: number; targetX: number; targetY: number; active: boolean };
  /** How strongly the chrome reaches for the pointer right now (0 to 1). */
  reach: number;
  /** 1 right after a click, fading to 0: the liquid shakes and the ring spins. */
  jolt: number;
  ringSpin: number;
  time: number;
  reducedMotion: boolean;
  /** For the speed check after the first seconds: frames counted and time they took. */
  frames: number;
  frameTime: number;
}

let state: SceneState | null = null;

function isNarrow() {
  return window.innerWidth < NARROW;
}

/** True once the scene runs: then it, not the page, draws the name on the first screen. */
export function sceneIsRunning() {
  return state !== null;
}

/** The pose of a stop on this screen size. */
function poseOf(name: string): Pose {
  const stop = STOPS[name] ?? STOPS.hero;
  if (!isNarrow()) return stop;
  return { ...stop, ...(NARROW_STOPS[name] ?? NARROW_STOPS.default) };
}

function paletteOf(name: string) {
  return PALETTES[(STOPS[name] ?? STOPS.hero).palette].map((hex) => new Color(hex));
}

/**
 * What the chrome and the glass reflect: a photo studio painted on a canvas, as one picture of
 * everything around the scene (left to right is all the way round, top to bottom is up to down).
 * Light above and dark below, a large soft lamp and thin strip lights, a warm glow on the right,
 * a cool one on the left, and dark behind, which is what draws the edge of the chrome on a pale page.
 */
function studioReflections(renderer: WebGLRenderer) {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;

  // Round the picture: 512 is straight behind the scene, 1024 the right, 1536 behind the camera,
  // 0 and 2048 the left.
  const BEHIND = 512;
  const RIGHT = 1024;
  const FRONT = 1536;

  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#ffffff");
  sky.addColorStop(0.3, "#e6e6ea");
  sky.addColorStop(0.5, "#a3a5b0");
  sky.addColorStop(0.62, "#3b3c45");
  sky.addColorStop(1, "#050506");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  /** A soft round glow. */
  const glow = (x: number, y: number, radius: number, colour: string) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, "rgb(0 0 0 / 0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  /** An upright band with soft sides: a strip light, or a dark card. */
  const band = (x: number, top: number, bottom: number, bandWidth: number, colour: string) => {
    const gradient = context.createLinearGradient(x - bandWidth / 2, 0, x + bandWidth / 2, 0);
    gradient.addColorStop(0, "rgb(0 0 0 / 0)");
    gradient.addColorStop(0.4, colour);
    gradient.addColorStop(0.6, colour);
    gradient.addColorStop(1, "rgb(0 0 0 / 0)");
    context.fillStyle = gradient;
    context.fillRect(x - bandWidth / 2, top, bandWidth, bottom - top);
  };

  // Dark behind the scene, with one thin rim light in it.
  band(BEHIND, 120, 900, 620, "rgb(6 6 8 / 0.92)");
  band(BEHIND - 150, 200, 640, 26, "#ffffff");
  band(BEHIND + 210, 260, 600, 14, "#ffffff");

  // The lamps on the camera's side.
  glow(FRONT + 60, 230, 420, "rgb(255 255 255 / 1)");
  band(FRONT - 330, 140, 620, 70, "#ffffff");
  band(FRONT + 380, 200, 560, 34, "#ffffff");
  band(FRONT - 150, 560, 900, 200, "rgb(6 6 8 / 0.8)");

  // Colour: warm on the right, cool on the left (the left is both ends of the picture), a little
  // rose low in front.
  glow(RIGHT + 60, 560, 340, "rgb(255 84 30 / 0.95)");
  glow(0, 600, 330, "rgb(48 78 255 / 0.9)");
  glow(width, 600, 330, "rgb(48 78 255 / 0.9)");
  glow(FRONT + 240, 720, 240, "rgb(255 130 190 / 0.55)");

  const picture = new CanvasTexture(canvas);
  picture.mapping = EquirectangularReflectionMapping;
  picture.colorSpace = SRGBColorSpace;
  return new PMREMGenerator(renderer).fromEquirectangular(picture).texture;
}

/** Create the scene on the canvas. Safe to call again: the second call does nothing. */
export function startScene(canvas: HTMLCanvasElement) {
  if (state) return;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    canvas.hidden = true; // no WebGL: the page works without the scene
    return;
  }
  renderer.toneMapping = NeutralToneMapping;

  const scene = new Scene();
  scene.environment = studioReflections(renderer);
  scene.environmentIntensity = 1.5;

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 60);
  camera.position.z = CAMERA_Z;
  scene.add(camera); // the wall hangs on the camera

  // Liquid chrome: a mirror with a thin oily film on it, so its highlights carry a little colour.
  const chromeMaterial = new MeshPhysicalMaterial({
    color: "#ffffff",
    metalness: 1,
    roughness: 0.07,
    iridescence: 0.6,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [160, 520],
  });
  const narrow = isNarrow();
  const chrome = new MarchingCubes(narrow ? 44 : 64, chromeMaterial, false, false, narrow ? 60000 : 140000);
  chrome.isolation = 80;
  chrome.frustumCulled = false;
  // MarchingCubes fills a cube from -1 to 1; a layout unit is 0.8 of that (see addDrop).
  chrome.scale.setScalar(UNIT / 0.8);

  // The glass ring: clear, thick enough to bend what is behind it and split it into colours.
  const glass = new MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.02, transmission: 1, thickness: 0.9, ior: 1.5, dispersion: 7 });
  const ring = new Mesh(new TorusGeometry(RING_RADIUS, 0.13, 48, 160), glass);
  // A ball of glass that circles the chrome like a moon and turns upside down whatever is behind
  // it: thinner glass with an oily film, like a soap bubble, so it shows on the pale page too.
  const bubble = new MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.02,
    transmission: 1,
    thickness: 0.42,
    ior: 1.3,
    dispersion: 5,
    iridescence: 1,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [120, 420],
  });
  const lens = new Mesh(new SphereGeometry(LENS_RADIUS, 64, 32), bubble);

  const group = new Group();
  group.add(chrome, ring, lens);
  scene.add(group);

  // The wall and the name share the uniforms of WALL_SHADER.
  const first = paletteOf("hero");
  const uniforms: Record<string, { value: any }> = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uBase: { value: first[0].clone() },
    uGlowA: { value: first[1].clone() },
    uGlowB: { value: first[2].clone() },
    uGlowC: { value: first[3].clone() },
    uLightness: { value: 1 },
    uFocus: { value: new Vector2(0.7, 0.5) },
    uFocusSize: { value: 0.2 },
    uShadow: { value: new Vector2(0.72, 0.45) },
    uLens: { value: new Vector2(0, 0) },
    uLensSize: { value: 0 },
  };

  const wall = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms,
      vertexShader: SCREEN_VERTEX,
      fragmentShader: /* glsl */ `
        ${WALL_SHADER}
        void main() {
          gl_FragColor = vec4(light(vScreen, wall(vScreen)), 1.0);
          #include <colorspace_fragment>
          // A little noise, so the soft gradients do not show steps.
          gl_FragColor.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        }
      `,
    }),
  );
  wall.position.z = WALL_Z;
  wall.frustumCulled = false;
  camera.add(wall);

  // The name: the wall's colours, with the letters in ink over them.
  const nameCanvas = document.createElement("canvas");
  const nameTexture = new CanvasTexture(nameCanvas);
  nameTexture.colorSpace = SRGBColorSpace;
  const nameMaterial = new ShaderMaterial({
    uniforms: { ...uniforms, uLetters: { value: nameTexture }, uInk: { value: new Color(INK) }, uReveal: { value: 0 } },
    vertexShader: SCREEN_VERTEX,
    fragmentShader: /* glsl */ `
      ${WALL_SHADER}
      uniform sampler2D uLetters;
      uniform vec3 uInk;
      uniform float uReveal; // 0 to 1: the name is wiped in from the left
      varying vec2 vUv;
      void main() {
        float letters = texture2D(uLetters, vUv).r * step(vUv.x, uReveal);
        gl_FragColor = vec4(light(vScreen, mix(wall(vScreen), uInk, letters)), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const namePlane = new Mesh(new PlaneGeometry(1, 1), nameMaterial);
  namePlane.visible = false;
  scene.add(namePlane);

  const firstPose = poseOf("hero");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  state = {
    renderer,
    camera,
    scene,
    group,
    chrome,
    ring,
    lens,
    wall,
    uniforms,
    palette: first,
    name: { plane: namePlane, material: nameMaterial, canvas: nameCanvas, texture: nameTexture, element: null, drawnFor: "" },
    // The chrome rises into its first place from below.
    pose: reducedMotion ? { ...firstPose } : { ...firstPose, y: firstPose.y - 3.2, scale: firstPose.scale * 0.5 },
    target: { ...firstPose },
    drops: LAYOUTS.sphere.map((drop): Drop => [...drop]),
    dropTargets: LAYOUTS.one.map((drop): Drop => [...drop]),
    activeDrop: 0,
    dark: false,
    pointer: { x: 0, y: 0, targetX: 0, targetY: 0, active: false },
    reach: 0,
    jolt: 0,
    ringSpin: 0,
    time: 0,
    reducedMotion,
    frames: 0,
    frameTime: 0,
  };

  document.documentElement.classList.add("scene-on");
  gsap.to(nameMaterial.uniforms.uReveal, { value: 1, duration: reducedMotion ? 0 : 1.4, delay: reducedMotion ? 0 : 0.3, ease: "power3.inOut" });

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  gsap.ticker.add(render);
}

/* ---------- The pointer ---------- */

function onPointerMove(event: PointerEvent) {
  if (!state || event.pointerType === "touch") return;
  state.pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
  state.pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1;
  state.pointer.active = true;
}

function onPointerLeave() {
  if (state) state.pointer.active = false;
}

/** A click (not a tap: on phones taps start every scroll) shakes the liquid. */
function onPointerDown(event: PointerEvent) {
  if (!state || event.pointerType === "touch" || state.reducedMotion) return;
  state.jolt = 1;
}

function resize() {
  if (!state) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.uniforms.uAspect.value = width / height;
  // The wall fills the view, with a little to spare.
  const wallHeight = 2 * -WALL_Z * Math.tan((CAMERA_FOV * Math.PI) / 360) * 1.02;
  state.wall.scale.set(wallHeight * state.camera.aspect, wallHeight, 1);
}

/* ---------- What motion.ts tells the scene ---------- */

/** Where the scroll is: `progress` (0 to 1) of the way from one stop to the next. */
export function setJourney(from: string, to: string, progress: number) {
  if (!state) return;
  // With reduced motion nothing travels: the chrome is at one stop or the other.
  const amount = state.reducedMotion ? Math.round(progress) : gsap.parseEase("power2.inOut")(progress);
  const start = poseOf(from);
  const end = poseOf(to);
  for (const key of Object.keys(state.target) as (keyof Pose)[]) {
    state.target[key] = start[key] + (end[key] - start[key]) * amount;
  }

  const startDrops = LAYOUTS[(STOPS[from] ?? STOPS.hero).layout];
  const endDrops = LAYOUTS[(STOPS[to] ?? STOPS.hero).layout];
  state.dropTargets.forEach((drop, i) => {
    for (let n = 0; n < 4; n++) drop[n] = startDrops[i][n] + (endDrops[i][n] - startDrops[i][n]) * amount;
  });

  const startColours = paletteOf(from);
  const endColours = paletteOf(to);
  state.palette.forEach((colour, i) => colour.copy(startColours[i]).lerp(endColours[i], amount));

  setDark((progress > 0.5 ? STOPS[to] : STOPS[from])?.dark ?? false);
}

/** Turn the page dark or light: the page swaps its colours (html.on-dark), the wall follows its palette. */
function setDark(dark: boolean) {
  if (!state || state.dark === dark) return;
  state.dark = dark;
  document.documentElement.classList.toggle("on-dark", dark);
}

/** The skills chapter: drop number `index` swells and the glass ring moves to it. */
export function setActiveDrop(index: number) {
  if (state) state.activeDrop = index;
}

/* ---------- Every frame ---------- */

/** Move `current` a step towards `goal`; the step does not depend on the frame rate. */
function ease(current: number, goal: number, delta: number, speed: number) {
  return current + (goal - current) * (1 - Math.exp(-delta * speed));
}

/** 0 at `from`, 1 at `to`, smooth in between (as GLSL's smoothstep). */
function smoothstep(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Add one ball of liquid: position and radius in layout units (the cube of MarchingCubes is 0 to 1). */
function addDrop(x: number, y: number, z: number, radius: number) {
  // A layout unit is 0.4 of the cube, centred on 0.5. A ball of this strength has the radius
  // asked for (subtract 12, isolation 80).
  const size = radius * 0.4;
  state!.chrome.addBall(0.5 + x * 0.4, 0.5 + y * 0.4, 0.5 + z * 0.4, size * size * 92, 12);
}

/**
 * Draw the chrome from the drops, pulled towards `reach` (the pointer, in layout units).
 * Returns where the active drop is, in the group's space.
 */
function drawChrome(delta: number, reach: { x: number; y: number }) {
  const { chrome, drops, dropTargets, pose, time, activeDrop, reducedMotion, jolt } = state!;
  const pull = state!.reach;
  const active = { x: 0, y: 0 };
  chrome.reset();

  drops.forEach((drop, i) => {
    const speed = reducedMotion ? 1000 : 4;
    for (let n = 0; n < 4; n++) drop[n] = ease(drop[n], dropTargets[i][n], delta, speed);

    // Each drop wanders a little around its place, on its own rhythm, and shakes after a click.
    let x = drop[0] + Math.sin(time * 0.7 + i * 2.1) * pose.wobble + Math.sin(time * 13 + i * 1.9) * 0.07 * jolt;
    let y = drop[1] + Math.cos(time * 0.55 + i * 1.3) * pose.wobble + Math.cos(time * 11 + i * 2.3) * 0.07 * jolt;
    const z = drop[2] + Math.sin(time * 0.45 + i * 3.7) * pose.wobble;

    // Drops near the pointer lean towards it.
    const towardsX = reach.x - x;
    const towardsY = reach.y - y;
    const near = Math.exp(-(towardsX * towardsX + towardsY * towardsY) / 0.6) * pull;
    x += towardsX * near * 0.2;
    y += towardsY * near * 0.2;

    // The active drop swells while the ring is on it.
    const radius = drop[3] * (i === activeDrop ? 1 + pose.select * 0.4 : 1);
    if (i === activeDrop) {
      active.x = x * UNIT;
      active.y = y * UNIT;
    }
    addDrop(x, y, z, radius);
  });

  // One more small drop sits on the edge of the chrome, on the pointer's side: as the pointer
  // comes near, the liquid grows a bump that follows it around.
  if (pull > 0.01) {
    const distance = Math.hypot(reach.x, reach.y) || 1;
    const along = Math.min(distance, 1.0);
    addDrop((reach.x / distance) * along, (reach.y / distance) * along, 0.15, (0.15 + jolt * 0.06) * pull);
  }

  chrome.update();
  return active;
}

/** Keep the name's plane exactly over the page's own h1 (which is transparent while the scene runs). */
function placeName() {
  const { name, camera } = state!;
  if (!name.element || !name.element.isConnected) name.element = document.querySelector<HTMLElement>("#hero-name");
  const element = name.element;
  const box = element?.getBoundingClientRect();
  if (!element || !box || box.bottom < 0 || box.width === 0) {
    name.plane.visible = false;
    return;
  }

  // Redraw the letters when the heading changes size (first run, resize, font loaded).
  const fontSize = parseFloat(getComputedStyle(element).fontSize);
  const key = `${Math.round(box.width)}x${Math.round(box.height)}x${fontSize}x${document.fonts.status}`;
  if (key !== name.drawnFor) {
    name.drawnFor = key;
    drawName(element, box.width, box.height, fontSize);
  }

  // One CSS pixel in scene units, at the depth of the plane.
  const visibleHeight = 2 * (CAMERA_Z - NAME_Z) * Math.tan((camera.fov * Math.PI) / 360);
  const pixel = visibleHeight / window.innerHeight;
  name.plane.visible = true;
  name.plane.scale.set(box.width * pixel, box.height * pixel, 1);
  name.plane.position.set((box.left + box.width / 2 - window.innerWidth / 2) * pixel, (window.innerHeight / 2 - box.top - box.height / 2) * pixel, NAME_Z);
}

/** Draw the heading's lines into the name texture, white on black, in the heading's own font. */
function drawName(element: HTMLElement, width: number, height: number, fontSize: number) {
  const { name } = state!;
  const ratio = Math.min(2, window.devicePixelRatio);
  name.canvas.width = Math.ceil(width * ratio);
  name.canvas.height = Math.ceil(height * ratio);
  const context = name.canvas.getContext("2d")!;
  context.fillStyle = "#000";
  context.fillRect(0, 0, name.canvas.width, name.canvas.height);

  const style = getComputedStyle(element);
  context.font = `${style.fontWeight} extra-expanded ${fontSize * ratio}px ${style.fontFamily}`;
  if ("letterSpacing" in context) context.letterSpacing = `${parseFloat(style.letterSpacing) * ratio}px`;
  context.fillStyle = "#fff";
  context.textBaseline = "alphabetic";

  const lines = Array.from(element.children).map((line) => (line.textContent ?? "").toUpperCase());
  const lineHeight = (height * ratio) / lines.length;
  lines.forEach((line, index) => {
    // Capitals are about 0.73 of the font size high; centre them in the line.
    context.fillText(line, 0, index * lineHeight + lineHeight / 2 + fontSize * ratio * 0.365);
  });
  name.texture.needsUpdate = true;
}

/**
 * Once, after the first two seconds: if this machine cannot keep up (under about 35 frames a
 * second), draw the chrome coarser and the canvas at a lower resolution.
 */
function checkSpeed(deltaMs: number) {
  if (!state || state.frames < 0) return;
  state.frames += 1;
  state.frameTime += deltaMs;
  if (state.frameTime < 2000) return;
  if (state.frameTime / state.frames > 28) {
    state.chrome.init(40);
    state.renderer.setPixelRatio(1);
  }
  state.frames = -1; // checked
}

const projected = new Vector3();

/** A point of the scene on screen, 0 to 1 from the bottom left. */
function toScreen(point: Vector3, out: Vector2) {
  projected.copy(point).project(state!.camera);
  out.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5);
}

/** How many screen heights a length of the scene is, at depth 0. */
function inScreenHeights(length: number) {
  return length / (2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360));
}

/** Tell the wall where the chrome, its shadow and the glass ball are on screen. */
function lightTheWall(delta: number) {
  const { uniforms, group, lens, pose, palette } = state!;
  toScreen(group.position, uniforms.uFocus.value);
  uniforms.uFocusSize.value = inScreenHeights(UNIT * 0.85 * pose.scale);
  // The light comes from the upper left: the shadow falls to the lower right.
  toScreen(projected.set(group.position.x + 0.45 * pose.scale, group.position.y - 0.6 * pose.scale, 0), uniforms.uShadow.value);
  // The ball focuses the light into a spot below and to the right of it.
  const ball = lens.getWorldPosition(new Vector3());
  const ballSize = LENS_RADIUS * pose.lens * pose.scale;
  toScreen(ball.add(new Vector3(ballSize * 1.1, -ballSize * 2.2, 0)), uniforms.uLens.value);
  uniforms.uLensSize.value = inScreenHeights(ballSize);

  const speed = 1 - Math.exp(-delta * 3);
  uniforms.uBase.value.lerp(palette[0], speed);
  uniforms.uGlowA.value.lerp(palette[1], speed);
  uniforms.uGlowB.value.lerp(palette[2], speed);
  uniforms.uGlowC.value.lerp(palette[3], speed);
  uniforms.uLightness.value = ease(uniforms.uLightness.value, state!.dark ? 0 : 1, delta, 3);
  uniforms.uTime.value = state!.time;
}

function render(_time: number, deltaMs: number) {
  if (!state) return;
  const { pose, target, pointer, group, ring, lens, camera, reducedMotion } = state;
  checkSpeed(deltaMs);
  const delta = Math.min(deltaMs / 1000, 0.05);
  if (!reducedMotion) state.time += delta;
  const time = state.time;

  const speed = reducedMotion ? 1000 : 4;
  for (const key of Object.keys(pose) as (keyof Pose)[]) pose[key] = ease(pose[key], target[key], delta, speed);
  pointer.x = ease(pointer.x, pointer.targetX, delta, 3);
  pointer.y = ease(pointer.y, pointer.targetY, delta, 3);
  state.jolt = ease(state.jolt, 0, delta, 2.2);

  // The chrome and glass together: place, size, and a slow lean towards the pointer.
  group.position.set(pose.x + pointer.x * 0.12, pose.y - pointer.y * 0.08, 0);
  group.scale.setScalar(pose.scale);
  group.rotation.set(pointer.y * 0.12, pointer.x * 0.2, 0);

  // The pointer in the chrome's own units. Within about two units the chrome reaches for it.
  const halfHeight = CAMERA_Z * Math.tan((camera.fov * Math.PI) / 360);
  const size = pose.scale * UNIT;
  const reach = {
    x: (pointer.x * halfHeight * camera.aspect - group.position.x) / size,
    y: (-pointer.y * halfHeight - group.position.y) / size,
  };
  const wanted = pointer.active && !reducedMotion ? smoothstep(2.4, 1.0, Math.hypot(reach.x, reach.y)) : 0;
  state.reach = ease(state.reach, wanted, delta, 4);

  const active = drawChrome(delta, reach);

  // The ring tumbles slowly around the chrome (a click spins it); in the skills chapter it turns
  // face on and settles around the active drop.
  const free = 1 - pose.select;
  state.ringSpin += state.jolt * delta * 6;
  ring.position.set(ease(ring.position.x, active.x * pose.select, delta, 5), ease(ring.position.y, active.y * pose.select, delta, 5), 0);
  ring.scale.setScalar(pose.ring);
  ring.rotation.set((1.15 + Math.sin(time * 0.31) * 0.5) * free, (0.5 + time * 0.22 + state.ringSpin) * free, 0);

  // The glass ball circles the chrome on a tilted path, passing in front of it and behind it.
  const orbit = time * 0.32 + 2.4;
  lens.position.set(Math.cos(orbit) * 1.75 * free, Math.sin(orbit * 0.7) * 0.75 * free, Math.sin(orbit) * 1.1);
  lens.scale.setScalar(Math.max(0.001, pose.lens));

  lightTheWall(delta);
  placeName();
  state.renderer.render(state.scene, state.camera);
}
