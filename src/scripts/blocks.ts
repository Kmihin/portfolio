// The 3D scene behind the whole site (Three.js, one fixed full-screen canvas).
//
// A field of soft rounded blocks on a white floor, lit like a product shot (soft shadows). The
// blocks rise out of the floor and build a pixel-art picture for every section of the page: code
// brackets, a person, a bar chart, a browser window, a cloud, a gear, a lightbulb, an envelope, a
// database. Each picture is a 16 x 16 bitmap below ("#" a raised block, "+" half height, "o" a
// raised coral block, "." the floor); heights ease toward their target, so a fast scroll never
// snaps, and a faint ripple keeps the field alive. The camera looks from the front and high up, so
// the pictures read, and sways a little with the page and the pointer.
//
//   startBlocks(canvas)   builds the scene and starts drawing; stopBlocks() before a page swap
//   setScene(a, b, t)     picture between scene a and scene b, t = 0..1 (motion.ts, on scroll)
//   setProgress(p)        page progress 0..1, sways the camera
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const BG = new THREE.Color("#f6f7fb");
const LOW = new THREE.Color("#eef1fa");
const HIGH = new THREE.Color("#93a4ff");
const CORAL = new THREE.Color("#ff8a65");

/** The pictures, one per scene. Row 0 is the far edge, column 0 the left. */
const PICTURES = {
  code: [
    "................",
    "................",
    ".....#...o#.....",
    "....#....o.#....",
    "...#.....o..#...",
    "..#......o...#..",
    ".#......o.....#.",
    "#.......o......#",
    ".#......o.....#.",
    "..#....o.....#..",
    "...#...o....#...",
    "....#..o...#....",
    ".....#o...#.....",
    "................",
    "................",
    "................",
  ],
  person: [
    "................",
    ".......##.......",
    "......####......",
    ".....######.....",
    ".....######.....",
    ".....######.....",
    "......####......",
    ".......##.......",
    "................",
    ".....######.....",
    "....########....",
    "...##########...",
    ".##############.",
    ".##############.",
    ".##############.",
    "................",
  ],
  chart: [
    "................",
    "................",
    ".............oo.",
    ".............##.",
    ".............##.",
    "..........##.##.",
    "..........##.##.",
    ".......##.##.##.",
    ".......##.##.##.",
    ".......##.##.##.",
    "....##.##.##.##.",
    "....##.##.##.##.",
    ".##.##.##.##.##.",
    ".##.##.##.##.##.",
    ".##.##.##.##.##.",
    "................",
  ],
  browser: [
    "................",
    "################",
    "#.o.o.o........#",
    "################",
    "#..............#",
    "#.+++++..+++++.#",
    "#.+++++..+++++.#",
    "#.+++++..+++++.#",
    "#........+++++.#",
    "#.+++++..+++++.#",
    "#.+++++..+++++.#",
    "#.+++++..+++++.#",
    "#.+++++..+++++.#",
    "#..............#",
    "################",
    "................",
  ],
  cloud: [
    "................",
    "................",
    "................",
    ".......####.....",
    "......######....",
    ".....########...",
    "...##########...",
    "..############..",
    "..#############.",
    "..#############.",
    "..#############.",
    "..#############.",
    "..#############.",
    "................",
    "................",
    "................",
  ],
  gear: [
    "................",
    ".......##.......",
    "...#...##...#...",
    "..############..",
    "...##########...",
    "...##########...",
    "...###....###...",
    ".#####....#####.",
    ".#####....#####.",
    "...###....###...",
    "...##########...",
    "...##########...",
    "..############..",
    "...#...##...#...",
    ".......##.......",
    "................",
  ],
  bulb: [
    "................",
    ".......##.......",
    ".....######.....",
    "....########....",
    "....########....",
    "...##########...",
    "...##########...",
    "....########....",
    "....########....",
    ".....######.....",
    "......++++......",
    "......++++......",
    "......++++......",
    "......oooo......",
    "................",
    "................",
  ],
  mail: [
    "................",
    "................",
    "................",
    ".##############.",
    ".#o..........o#.",
    ".#.o........o.#.",
    ".#..o......o..#.",
    ".#...o....o...#.",
    ".#....o..o....#.",
    ".#.....oo.....#.",
    ".#.....oo.....#.",
    ".#............#.",
    ".##############.",
    "................",
    "................",
    "................",
  ],
  database: [
    "................",
    "................",
    "...##oooooo##...",
    "...##########...",
    "...##########...",
    "...++++++++++...",
    "...##########...",
    "...##########...",
    "...##########...",
    "...++++++++++...",
    "...##########...",
    "...##########...",
    "...##########...",
    "...++++++++++...",
    "................",
    "................",
  ],
};
type SceneName = keyof typeof PICTURES;
const SCENES = Object.keys(PICTURES) as SceneName[];
const FLOOR = 0.06;

let stop: (() => void) | null = null;
let scene = { a: "code" as SceneName, b: "code" as SceneName, t: 0 };
let progress = 0;

export function setScene(a: string, b: string, t: number) {
  const ok = (n: string): n is SceneName => (SCENES as string[]).includes(n);
  scene = { a: ok(a) ? a : "code", b: ok(b) ? b : "code", t: Math.min(Math.max(t, 0), 1) };
}
export function setProgress(p: number) {
  progress = Math.min(Math.max(p, 0), 1);
}
export function stopBlocks() {
  if (stop) stop();
  stop = null;
}

/** Height (0..1) and coral flag (0 or 1) of the picture's pixel at grid cell (gx, gz) of SIDE. */
function pixel(name: SceneName, gx: number, gz: number, side: number) {
  const rows = PICTURES[name];
  const n = rows.length;
  const ch = rows[Math.min(Math.floor((gz / side) * n), n - 1)][Math.min(Math.floor((gx / side) * n), n - 1)];
  if (ch === "#") return { h: 1, c: 0 };
  if (ch === "o") return { h: 1, c: 1 };
  if (ch === "+") return { h: 0.45, c: 0 };
  return { h: FLOOR, c: 0 };
}

export function startBlocks(canvas: HTMLCanvasElement) {
  stopBlocks();
  const small = window.innerWidth < 768;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.setClearColor(BG, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const world = new THREE.Scene();
  world.fog = new THREE.Fog(BG, 70, 120);
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 200);

  // Lights: a soft sky and one sun casting soft shadows.
  world.add(new THREE.HemisphereLight(0xffffff, 0xdfe6f5, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -24;
  sun.shadow.camera.right = sun.shadow.camera.top = 24;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 4;
  world.add(sun);

  // The floor only shows the shadows.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.08 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world.add(floor);

  // The blocks: one instanced mesh, a grid of SIDE x SIDE.
  // Two blocks per picture pixel; shadows only where there is room for them.
  const SIDE = 32;
  const STEP = 1.08;
  const MAX_H = 3.2;
  renderer.shadowMap.enabled = !small;
  const count = SIDE * SIDE;
  const geometry = new RoundedBoxGeometry(0.92, 1, 0.92, 2, 0.1);
  geometry.translate(0, 0.5, 0); // base at y = 0, so scaling y grows upward
  const material = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.0 });
  const blocks = new THREE.InstancedMesh(geometry, material, count);
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  world.add(blocks);

  // Every picture sampled onto the grid once: height and coral flag per cell.
  const forms = Object.fromEntries(
    SCENES.map((name) => {
      const h = new Float32Array(count);
      const c = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const px = pixel(name, i % SIDE, Math.floor(i / SIDE), SIDE);
        h[i] = px.h;
        c[i] = px.c;
      }
      return [name, { h, c }];
    })
  ) as Record<SceneName, { h: Float32Array; c: Float32Array }>;

  const cellX = new Float32Array(count);
  const cellZ = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    cellX[i] = ((i % SIDE) - (SIDE - 1) / 2) * STEP;
    cellZ[i] = (Math.floor(i / SIDE) - (SIDE - 1) / 2) * STEP;
  }
  const curH = new Float32Array(count).fill(FLOOR);
  const curC = new Float32Array(count);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  function updateBlocks(dt: number, time: number) {
    const ease = reduced ? 1 : 1 - Math.pow(0.004, dt);
    const t = scene.t * scene.t * (3 - 2 * scene.t);
    const a = forms[scene.a];
    const b = forms[scene.b];
    for (let i = 0; i < count; i++) {
      const targetH = a.h[i] + (b.h[i] - a.h[i]) * t;
      const targetC = a.c[i] + (b.c[i] - a.c[i]) * t;
      curH[i] += (targetH - curH[i]) * ease;
      curC[i] += (targetC - curC[i]) * ease;
      // A faint travelling ripple keeps the floor alive.
      const ripple = reduced ? 0 : 0.02 * Math.sin(time * 1.2 + cellX[i] * 0.8 + cellZ[i] * 0.6);
      const h = (curH[i] + ripple) * MAX_H;
      matrix.makeScale(1, Math.max(h, 0.12), 1);
      matrix.setPosition(cellX[i], 0, cellZ[i]);
      blocks.setMatrixAt(i, matrix);
      // Colour: pale on the floor, indigo when raised, coral where the picture says so.
      color.copy(LOW).lerp(HIGH, Math.min(curH[i], 1) * 0.9).lerp(CORAL, curC[i]);
      blocks.setColorAt(i, color);
    }
    blocks.instanceMatrix.needsUpdate = true;
    blocks.instanceColor!.needsUpdate = true;
  }

  // Camera: from the front and high up (so the pictures read), swaying a little with the page and
  // the pointer; looking left of the field so it sits under the right side of the page.
  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  const CAM_R = small ? 60 : 54;
  function placeCamera() {
    const a = Math.PI * 0.5 - 0.22 + progress * 0.44 + tilt.x * 0.2;
    const y = (small ? 70 : 62) + tilt.y * 3;
    camera.position.set(Math.cos(a) * CAM_R, y, Math.sin(a) * CAM_R);
    const shift = small ? 0 : 11;
    camera.lookAt(Math.sin(a) * -shift, 0, Math.cos(a) * shift);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 42 : 28;
    camera.updateProjectionMatrix();
  }

  let frameId = 0;
  let last = performance.now();
  let time = 0;
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!reduced) time += dt;
    tilt.x += (pointer.x - tilt.x) * (reduced ? 1 : 0.05);
    tilt.y += (pointer.y - tilt.y) * (reduced ? 1 : 0.05);
    updateBlocks(dt, time);
    placeCamera();
    renderer.render(world, camera);
    frameId = requestAnimationFrame(frame);
  }

  function onPointer(e: PointerEvent) {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = 0.5 - e.clientY / window.innerHeight;
  }
  function onVisibility() {
    cancelAnimationFrame(frameId);
    if (!document.hidden) {
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    }
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointer);
  document.addEventListener("visibilitychange", onVisibility);
  resize();
  frameId = requestAnimationFrame(frame);

  stop = () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", onVisibility);
    geometry.dispose();
    material.dispose();
    floor.geometry.dispose();
    (floor.material as THREE.Material).dispose();
    renderer.dispose();
  };
}
