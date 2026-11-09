// The 3D scene behind the whole site (Three.js, one fixed full-screen canvas): a circuit board.
//
// A light board with a graphite chip for everything on the page: the CPU in the middle (me: name,
// role, stack engraved on its aluminium lid), a chip per technology I work with, a module per case
// study, four memory chips with the figures printed on them, and an I/O port for contact. Traces
// run from the CPU to every part, data pulses race along them, and a silkscreen layer (grid,
// footprints, part names) lies on the board.
//
// On load the board builds itself: the traces draw out from the CPU, the parts rise into place,
// the camera comes down from above. Then the camera flies across the board as the page scrolls:
// every section names a stop (data-scene="skills"), and between two sections the camera moves from
// one stop to the next. The parts a section is about lift a little, light up, and their traces
// turn blue while the pulses favour them.
//
//   startBoard(canvas, data, onReady)  builds the scene, calls onReady after the first frame
//   stopBoard()                        before a page swap
//   setFlight(a, b, t)                 camera between stop a and stop b, t = 0..1 (motion.ts)
//   setPointer(x, y)                   pointer position, -0.5..0.5 each
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface BoardData {
  skills: string[];
  work: string[];
  facts: { value: string; label: string }[];
}

const BG = "#f3f5f9";
const GRAPHITE = "#1b2030";
const ACCENT = new THREE.Color("#2f5bff");
const CORAL = new THREE.Color("#ff6a3d");
const TRACE = new THREE.Color("#c3cad6");

/** Which parts a stop is about: lifted, lit, and favoured by the pulses. */
type Focus = "none" | "cpu" | "skills" | "work" | "ram" | "io" | "all";
const GROUPS = ["skills", "work", "ram", "io"] as const;

/** Camera stops: the point looked at on the board (x, z), distance, elevation and azimuth in
 *  degrees (azimuth 0 looks from the front), and how far the view is panned so the point sits
 *  right of the text (shift). */
type Stop = { at: [number, number]; dist: number; elev: number; azim: number; shift: number; focus: Focus };
const STOPS: Record<string, Stop> = {
  hero: { at: [2, 0], dist: 80, elev: 50, azim: 22, shift: 19, focus: "none" },
  about: { at: [0, 0], dist: 30, elev: 42, azim: 32, shift: 7, focus: "cpu" },
  facts: { at: [-5, 11], dist: 27, elev: 34, azim: -12, shift: 6, focus: "ram" },
  work: { at: [-17.5, -6], dist: 34, elev: 52, azim: -28, shift: 8, focus: "work" },
  skills: { at: [18.5, -7.5], dist: 32, elev: 48, azim: 18, shift: 8, focus: "skills" },
  offer: { at: [-3, -7], dist: 44, elev: 20, azim: 62, shift: 8, focus: "all" },
  closing: { at: [0, 0], dist: 78, elev: 88, azim: 0, shift: 0, focus: "none" },
  contact: { at: [19, 14], dist: 24, elev: 30, azim: 28, shift: 6, focus: "io" },
  detail: { at: [0, 0], dist: 70, elev: 62, azim: -15, shift: -14, focus: "work" },
};

let stop: (() => void) | null = null;
let flight = { a: "hero", b: "hero", t: 0 };
const pointer = { x: 0, y: 0 };

export function setFlight(a: string, b: string, t: number) {
  flight = { a: STOPS[a] ? a : "hero", b: STOPS[b] ? b : "hero", t: Math.min(Math.max(t, 0), 1) };
}
export function setPointer(x: number, y: number) {
  pointer.x = x;
  pointer.y = y;
}
export function stopBoard() {
  if (stop) stop();
  stop = null;
}

// Seeded random, so the board is the same on every visit.
let seed = 7;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
const ease = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

// ---------- Layout ----------

type Part = {
  id: string; // reference designator printed on the board (U1, U2, M1, J1)
  group: "cpu" | (typeof GROUPS)[number];
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  lines: string[]; // what is printed on its top
};

function layout(data: BoardData): Part[] {
  const parts: Part[] = [{ id: "U1", group: "cpu", x: 0, z: 0, w: 9, d: 9, h: 0.9, lines: [] }];
  // Technologies: a 3 x 3 grid on the right.
  data.skills.slice(0, 9).forEach((label, i) => {
    parts.push({ id: `U${i + 2}`, group: "skills", x: 13 + (i % 3) * 5.6, z: -13 + Math.floor(i / 3) * 5.6, w: 4.4, d: 4.4, h: 0.7, lines: [label] });
  });
  // Case studies: modules in two columns on the left.
  data.work.slice(0, 8).forEach((label, i) => {
    parts.push({ id: `U${i + 11}`, group: "work", x: -14 - (i % 2) * 7.4, z: -14 + Math.floor(i / 2) * 5, w: 6.4, d: 3.6, h: 0.6, lines: [label] });
  });
  // The figures: memory chips in a row at the front.
  data.facts.slice(0, 4).forEach((f, i) => {
    parts.push({ id: `M${i + 1}`, group: "ram", x: -13.5 + i * 5.2, z: 11.5, w: 4.2, d: 3, h: 0.55, lines: [f.value, f.label] });
  });
  // Contact: the I/O port at the front right edge.
  parts.push({ id: "J1", group: "io", x: 19, z: 14, w: 6, d: 4.6, h: 3.4, lines: ["CONTACT"] });
  return parts;
}

// ---------- Textures (canvas, so the labels come from the page content) ----------

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, maxLines: number) {
  let s = size;
  while (s > 10) {
    ctx.font = `600 ${s}px ${MONO}`;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size: s };
    s -= 2;
  }
  return { lines: [text], size: s };
}

/** The top of a graphite chip: its label, designator and a pin-1 dot. */
function chipTexture(part: Part, small: boolean) {
  const W = small ? 256 : 512;
  const H = Math.round((W * part.d) / part.w);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = GRAPHITE;
  ctx.fillRect(0, 0, W, H);
  // A faint inner bevel.
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = W * 0.012;
  ctx.strokeRect(W * 0.03, H * 0.04, W * 0.94, H * 0.92);
  // Pin-1 dot.
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.15, W * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const pad = W * 0.09;
  if (part.group === "ram") {
    // Memory chip: the figure big, its label small under it.
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${H * 0.36}px ${MONO}`;
    ctx.fillText(part.lines[0], pad, H * 0.52);
    const { lines, size } = wrap(ctx, part.lines[1].toUpperCase(), W - pad * 2, H * 0.1, 3);
    ctx.fillStyle = "rgba(232,236,243,0.7)";
    ctx.font = `600 ${size}px ${MONO}`;
    lines.forEach((l, i) => ctx.fillText(l, pad, H * 0.68 + i * size * 1.25));
  } else {
    const { lines, size } = wrap(ctx, part.lines[0].toUpperCase(), W - pad * 2, H * 0.17, 3);
    ctx.fillStyle = "#e8ecf3";
    ctx.font = `600 ${size}px ${MONO}`;
    const top = H * 0.5 - ((lines.length - 1) * size * 1.2) / 2 + size * 0.35;
    lines.forEach((l, i) => ctx.fillText(l, pad, top + i * size * 1.2));
  }
  ctx.fillStyle = "rgba(232,236,243,0.45)";
  ctx.font = `500 ${H * 0.08}px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(part.id, W - pad * 0.7, H * 0.9);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The CPU lid: brushed aluminium with my name engraved. */
function lidTexture(small: boolean) {
  const S = small ? 512 : 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#e9ecf1");
  g.addColorStop(0.5, "#d3d8e0");
  g.addColorStop(1, "#e4e7ed");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // Brushed lines.
  seed = 17;
  for (let i = 0; i < 900; i++) {
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? "255,255,255" : "120,130,150"},${0.04 + rand() * 0.05})`;
    ctx.lineWidth = 1;
    const y = rand() * S;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y + (rand() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.fillStyle = "#151a26";
  ctx.textAlign = "left";
  const pad = S * 0.1;
  ctx.font = `800 ${S * 0.16}px ${MONO}`;
  ctx.fillText("KM-01", pad, S * 0.32);
  ctx.font = `700 ${S * 0.07}px ${MONO}`;
  ctx.fillText("KRISTJAN MIHIN", pad, S * 0.5);
  ctx.fillStyle = "rgba(21,26,38,0.8)";
  ctx.font = `600 ${S * 0.05}px ${MONO}`;
  ctx.fillText("FULL-STACK DEVELOPER", pad, S * 0.6);
  ctx.fillText(".NET  AZURE  TYPESCRIPT", pad, S * 0.68);
  ctx.fillText("SLOVENIA  2026", pad, S * 0.86);
  // Pin-1 triangle.
  ctx.fillStyle = "#2f5bff";
  ctx.beginPath();
  ctx.moveTo(S * 0.82, S * 0.82);
  ctx.lineTo(S * 0.92, S * 0.82);
  ctx.lineTo(S * 0.92, S * 0.92);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The silkscreen: grid, footprints, part names, mounting holes and the board name, fading out
 *  towards the edges into the page colour. Covers SIZE x SIZE units around the centre. */
const SIZE_X = 120;
const SIZE_Z = 84;
function silkTexture(parts: Part[], small: boolean) {
  const PX = small ? 12 : 20; // pixels per unit
  const c = document.createElement("canvas");
  c.width = SIZE_X * PX;
  c.height = SIZE_Z * PX;
  const ctx = c.getContext("2d")!;
  const X = (x: number) => (x + SIZE_X / 2) * PX;
  const Z = (z: number) => (z + SIZE_Z / 2) * PX;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, c.width, c.height);
  // Fine grid.
  ctx.strokeStyle = "rgba(30,45,80,0.06)";
  ctx.lineWidth = 1;
  for (let x = -SIZE_X / 2; x <= SIZE_X / 2; x += 2) {
    ctx.beginPath();
    ctx.moveTo(X(x), 0);
    ctx.lineTo(X(x), c.height);
    ctx.stroke();
  }
  for (let z = -SIZE_Z / 2; z <= SIZE_Z / 2; z += 2) {
    ctx.beginPath();
    ctx.moveTo(0, Z(z));
    ctx.lineTo(c.width, Z(z));
    ctx.stroke();
  }
  // Board outline and mounting holes.
  ctx.strokeStyle = "rgba(30,45,80,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(X(-31), Z(-20), 62 * PX, 40 * PX, 2 * PX);
  ctx.stroke();
  for (const [hx, hz] of [
    [-28.5, -17.5],
    [28.5, -17.5],
    [-28.5, 17.5],
    [28.5, 17.5],
  ]) {
    ctx.beginPath();
    ctx.arc(X(hx), Z(hz), 1.1 * PX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(hx), Z(hz), 0.55 * PX, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Footprints and designators.
  ctx.font = `600 ${0.7 * PX}px ${MONO}`;
  ctx.fillStyle = "rgba(30,45,80,0.5)";
  for (const p of parts) {
    ctx.strokeStyle = "rgba(30,45,80,0.18)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X(p.x - p.w / 2 - 0.7), Z(p.z - p.d / 2 - 0.7), (p.w + 1.4) * PX, (p.d + 1.4) * PX);
    ctx.fillText(p.id, X(p.x - p.w / 2 - 0.7), Z(p.z - p.d / 2 - 1.1));
  }
  // Board name and notes.
  ctx.font = `700 ${1.1 * PX}px ${MONO}`;
  ctx.fillStyle = "rgba(30,45,80,0.55)";
  ctx.fillText("KM-BOARD  REV 2026", X(-29), Z(18.2));
  ctx.font = `500 ${0.65 * PX}px ${MONO}`;
  ctx.fillText("FULL-STACK  .NET  AZURE  INTEGRATIONS", X(-29), Z(16.6));
  ctx.fillText("DESIGNED IN SLOVENIA", X(14), Z(-18.2));
  // Fade to the page colour towards the edges.
  const fade = ctx.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.38, c.width / 2, c.height / 2, c.width * 0.5);
  fade.addColorStop(0, "rgba(243,245,249,0)");
  fade.addColorStop(1, "rgba(243,245,249,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---------- Traces ----------

type Trace = { pts: THREE.Vector2[]; cum: number[]; len: number; group: number };

/** A trace from (x0, z0) to (x1, z1): out along the main axis, a 45 degree run, then straight in. */
function route(x0: number, z0: number, x1: number, z1: number, alongX: boolean, lead: number): THREE.Vector2[] {
  const A = (a: number, b: number) => (alongX ? new THREE.Vector2(a, b) : new THREE.Vector2(b, a));
  const [p0, q0, p1, q1] = alongX ? [x0, z0, x1, z1] : [z0, x0, z1, x1];
  const s = Math.sign(p1 - p0) || 1;
  const dq = q1 - q0;
  const room = Math.abs(p1 - p0) - Math.abs(dq);
  const l = Math.max(0.6, Math.min(lead, room - 0.6));
  const a = p0 + s * l;
  const b = a + s * Math.abs(dq);
  return [A(p0, q0), A(a, q0), A(b, q1), A(p1, q1)];
}

function buildTraces(parts: Part[]): Trace[] {
  const cpu = parts[0];
  const traces: Trace[] = [];
  const add = (pts: THREE.Vector2[], group: number) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    traces.push({ pts, cum, len: cum[cum.length - 1], group });
  };
  seed = 23;
  parts.slice(1).forEach((p, index) => {
    const group = GROUPS.indexOf(p.group as (typeof GROUPS)[number]);
    const n = p.group === "io" ? 5 : 3;
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 0.55;
      const lead = 1.2 + ((index * 3 + k) % 5) * 0.5;
      if (p.group === "skills") {
        add(route(cpu.x + cpu.w / 2, (p.z - cpu.z) * 0.25 + off, p.x - p.w / 2, p.z + off, true, lead), group);
      } else if (p.group === "work") {
        add(route(cpu.x - cpu.w / 2, (p.z - cpu.z) * 0.25 + off, p.x + p.w / 2, p.z + off, true, lead), group);
      } else {
        // Memory and I/O: out of the CPU's front edge.
        add(route((p.x - cpu.x) * 0.22 + off, cpu.z + cpu.d / 2, p.x + off, p.z - p.d / 2, false, lead), group);
      }
    }
  });
  return traces;
}

/** Flat ribbons for every trace, with the distance along it (0..1) for the draw-in animation and
 *  the trace's group for the highlight. */
function traceGeometry(traces: Trace[]) {
  const W = 0.16;
  const pos: number[] = [];
  const dist: number[] = [];
  const grp: number[] = [];
  const idx: number[] = [];
  for (const t of traces) {
    for (let i = 1; i < t.pts.length; i++) {
      const a = t.pts[i - 1];
      const b = t.pts[i];
      const dir = b.clone().sub(a).normalize();
      const n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(W / 2);
      const a2 = a.clone().addScaledVector(dir, -W / 2);
      const b2 = b.clone().addScaledVector(dir, W / 2);
      const base = pos.length / 3;
      for (const [p, d] of [
        [a2.clone().add(n), t.cum[i - 1]],
        [a2.clone().sub(n), t.cum[i - 1]],
        [b2.clone().add(n), t.cum[i]],
        [b2.clone().sub(n), t.cum[i]],
      ] as [THREE.Vector2, number][]) {
        pos.push(p.x, 0.02, p.y);
        dist.push(d / t.len);
        grp.push(t.group);
      }
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aDist", new THREE.Float32BufferAttribute(dist, 1));
  g.setAttribute("aGroup", new THREE.Float32BufferAttribute(grp, 1));
  g.setIndex(idx);
  return g;
}

const traceVertex = `
  attribute float aDist;
  attribute float aGroup;
  varying float vDist;
  varying float vGroup;
  void main() {
    vDist = aDist;
    vGroup = aGroup;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const traceFragment = `
  uniform float uDraw;
  uniform float uTime;
  uniform vec4 uActive;
  uniform vec3 uBase;
  uniform vec3 uAccent;
  varying float vDist;
  varying float vGroup;
  void main() {
    if (vDist > uDraw) discard;
    float act = vGroup < 0.5 ? uActive.x : vGroup < 1.5 ? uActive.y : vGroup < 2.5 ? uActive.z : uActive.w;
    // Active traces turn blue, with a soft sheen running from the CPU outwards.
    float sheen = 0.75 + 0.25 * sin(vDist * 30.0 - uTime * 5.0);
    gl_FragColor = vec4(mix(uBase, uAccent, act * sheen), 1.0);
    #include <colorspace_fragment>
  }
`;

// ---------- Scene ----------

export function startBoard(canvas: HTMLCanvasElement, data: BoardData, onReady?: () => void) {
  stopBoard();
  const small = window.innerWidth < 768;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.setClearColor(BG, 1);
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const world = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  world.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);

  world.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ef, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-18, 40, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -40;
  sun.shadow.camera.right = sun.shadow.camera.top = 40;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0004;
  world.add(sun);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const parts = layout(data);

  // The board: the silkscreen (unlit, so its colour matches the page exactly) and a shadow layer.
  const silk = keep(silkTexture(parts, small));
  const board = new THREE.Mesh(keep(new THREE.PlaneGeometry(SIZE_X, SIZE_Z)), keep(new THREE.MeshBasicMaterial({ map: silk })));
  board.rotation.x = -Math.PI / 2;
  world.add(board);
  const shade = new THREE.Mesh(keep(new THREE.PlaneGeometry(SIZE_X, SIZE_Z)), keep(new THREE.ShadowMaterial({ opacity: 0.13 })));
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.03;
  shade.receiveShadow = true;
  world.add(shade);

  // Traces.
  const traces = buildTraces(parts);
  const traceUniforms = {
    uDraw: { value: reduced ? 1 : 0 },
    uTime: { value: 0 },
    uActive: { value: new THREE.Vector4() },
    uBase: { value: TRACE.clone() },
    uAccent: { value: ACCENT.clone() },
  };
  const traceMesh = new THREE.Mesh(keep(traceGeometry(traces)), keep(new THREE.ShaderMaterial({ vertexShader: traceVertex, fragmentShader: traceFragment, uniforms: traceUniforms })));
  world.add(traceMesh);

  // Pads where the traces end.
  const padGeo = keep(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16));
  const pads = new THREE.InstancedMesh(padGeo, keep(new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.8, roughness: 0.3 })), traces.length * 2);
  const m4 = new THREE.Matrix4();
  traces.forEach((t, i) => {
    const a = t.pts[0];
    const b = t.pts[t.pts.length - 1];
    pads.setMatrixAt(i * 2, m4.makeTranslation(a.x, 0.04, a.y));
    pads.setMatrixAt(i * 2 + 1, m4.makeTranslation(b.x, 0.04, b.y));
  });
  world.add(pads);

  // The parts: a graphite body with its printed top, rising out of the board on load.
  type Built = { part: Part; group: THREE.Group; topMat: THREE.MeshStandardMaterial; rise: number; lift: number; delay: number };
  const built: Built[] = [];
  const pinSpots: [number, number][] = [];
  const graphite = keep(new THREE.MeshStandardMaterial({ color: GRAPHITE, roughness: 0.55, metalness: 0.1 }));
  const aluminium = keep(new THREE.MeshStandardMaterial({ color: 0xd5dae2, roughness: 0.32, metalness: 0.85 }));
  for (const part of parts) {
    const group = new THREE.Group();
    group.position.set(part.x, 0, part.z);
    let topY = part.h;
    if (part.group === "cpu") {
      // Substrate, then the aluminium lid with the engraving.
      const sub = new THREE.Mesh(keep(new RoundedBoxGeometry(part.w, 0.3, part.d, 2, 0.08)), graphite);
      sub.position.y = 0.15;
      const lid = new THREE.Mesh(keep(new RoundedBoxGeometry(part.w * 0.78, 0.55, part.d * 0.78, 3, 0.18)), aluminium);
      lid.position.y = 0.3 + 0.275;
      sub.castShadow = lid.castShadow = true;
      group.add(sub, lid);
      topY = 0.86;
    } else if (part.group === "io") {
      // A port: an aluminium housing with a dark opening facing the front.
      const housing = new THREE.Mesh(keep(new RoundedBoxGeometry(part.w, part.h, part.d, 2, 0.12)), aluminium);
      housing.position.y = part.h / 2;
      housing.castShadow = true;
      const hole = new THREE.Mesh(keep(new THREE.BoxGeometry(part.w * 0.62, part.h * 0.5, 0.4)), graphite);
      hole.position.set(0, part.h * 0.48, part.d / 2 - 0.15);
      // Two status lights.
      const ledGeo = keep(new THREE.BoxGeometry(0.5, 0.3, 0.1));
      const ledA = new THREE.Mesh(ledGeo, keep(new THREE.MeshBasicMaterial({ color: 0x2f5bff })));
      const ledB = new THREE.Mesh(ledGeo, keep(new THREE.MeshBasicMaterial({ color: 0xff6a3d })));
      ledA.position.set(-part.w * 0.36, part.h * 0.88, part.d / 2 + 0.02);
      ledB.position.set(part.w * 0.36, part.h * 0.88, part.d / 2 + 0.02);
      ledA.name = "led";
      ledB.name = "led";
      group.add(housing, hole, ledA, ledB);
      topY = part.h;
    } else {
      const body = new THREE.Mesh(keep(new RoundedBoxGeometry(part.w, part.h, part.d, 2, 0.08)), graphite);
      body.position.y = part.h / 2;
      body.castShadow = true;
      group.add(body);
    }
    // The printed (or engraved) top.
    const topW = part.group === "cpu" ? part.w * 0.74 : part.w * 0.96;
    const topD = part.group === "cpu" ? part.d * 0.74 : part.d * 0.94;
    const topMat = keep(
      new THREE.MeshStandardMaterial({
        map: keep(part.group === "cpu" ? lidTexture(small) : part.group === "io" ? silk : chipTexture(part, small)),
        roughness: part.group === "cpu" ? 0.5 : 0.6,
        metalness: part.group === "cpu" ? 0.25 : 0.05,
        emissive: new THREE.Color(0x000000),
      })
    );
    if (part.group !== "io") {
      const top = new THREE.Mesh(keep(new THREE.PlaneGeometry(topW, topD)), topMat);
      top.rotation.x = -Math.PI / 2;
      top.position.y = topY + 0.006;
      group.add(top);
    }
    // Pins along the long sides of the chips (drawn together below, they stay on the board).
    if (part.group === "skills" || part.group === "work" || part.group === "ram") {
      const n = Math.floor(part.w / 0.62);
      for (let k = 0; k < n; k++) {
        const px = -part.w / 2 + 0.4 + (k * (part.w - 0.8)) / Math.max(n - 1, 1);
        for (const side of [-1, 1]) pinSpots.push([part.x + px, part.z + side * (part.d / 2 + 0.2)]);
      }
    }
    group.scale.y = reduced ? 1 : 0.001;
    world.add(group);
    const distFromCpu = Math.hypot(part.x, part.z);
    built.push({ part, group, topMat, rise: reduced ? 1 : 0, lift: 0, delay: 0.5 + distFromCpu * 0.035 });
  }

  const pins = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.16, 0.08, 0.5)), aluminium, pinSpots.length);
  pinSpots.forEach(([x, z], i) => pins.setMatrixAt(i, m4.makeTranslation(x, 0.06, z)));
  world.add(pins);

  // Small parts in tidy rows, as on a real board: a row of resistors beside every chip, and
  // capacitors around the CPU and the port.
  const resistorGeo = keep(new RoundedBoxGeometry(0.9, 0.32, 0.42, 1, 0.08));
  const capGeo = keep(new THREE.CylinderGeometry(0.42, 0.42, 0.9, 20));
  const resistorSpots: { x: number; z: number; rotY: number }[] = [];
  const capSpots: { x: number; z: number; rotY: number }[] = [];
  for (const p of parts) {
    if (p.group === "skills" || p.group === "work") {
      // A row of three along the chip's top edge, outside its footprint.
      for (let k = 0; k < 3; k++) resistorSpots.push({ x: p.x - p.w / 2 + 0.8 + k * 1.3, z: p.z - p.d / 2 - 1.35, rotY: 0 });
    } else if (p.group === "ram") {
      for (let k = 0; k < 2; k++) resistorSpots.push({ x: p.x - p.w / 2 + 0.8 + k * 1.3, z: p.z + p.d / 2 + 1.35, rotY: 0 });
    } else if (p.group === "cpu") {
      // Two capacitors at each corner, a row of resistors along the top and bottom.
      for (const [cx, cz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        capSpots.push({ x: cx * (p.w / 2 + 1.1), z: cz * (p.d / 2 + 1.1), rotY: 0 });
        capSpots.push({ x: cx * (p.w / 2 + 2.2), z: cz * (p.d / 2 + 1.1), rotY: 0 });
      }
      for (let k = 0; k < 5; k++) resistorSpots.push({ x: -2.6 + k * 1.3, z: -p.d / 2 - 1.5, rotY: 0 });
    } else if (p.group === "io") {
      for (let k = 0; k < 3; k++) capSpots.push({ x: p.x - p.w / 2 - 1.2, z: p.z - 1.4 + k * 1.2, rotY: 0 });
    }
  }
  const resistors = new THREE.InstancedMesh(resistorGeo, graphite, resistorSpots.length);
  const caps = new THREE.InstancedMesh(capGeo, aluminium, capSpots.length);
  resistors.castShadow = caps.castShadow = true;
  seed = 31;
  const smallParts: { mesh: THREE.InstancedMesh; i: number; x: number; z: number; rotY: number; delay: number }[] = [];
  resistorSpots.forEach((r, i) => smallParts.push({ mesh: resistors, i, ...r, delay: 0.9 + Math.hypot(r.x, r.z) * 0.035 + rand() * 0.2 }));
  capSpots.forEach((c, i) => smallParts.push({ mesh: caps, i, ...c, delay: 0.9 + Math.hypot(c.x, c.z) * 0.035 + rand() * 0.2 }));
  world.add(resistors, caps);

  // Pulses: short bright streaks racing along the traces.
  const P = small ? 70 : 140;
  const pulseGeo = keep(new THREE.BoxGeometry(1, 0.08, 0.14));
  const pulseMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const pulses = new THREE.InstancedMesh(pulseGeo, pulseMat, P);
  pulses.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(P * 3), 3);
  const pulseState: { trace: number; d: number; speed: number }[] = [];
  seed = 41;
  for (let i = 0; i < P; i++) {
    pulseState.push({ trace: Math.floor(rand() * traces.length), d: rand(), speed: 6 + rand() * 8 });
    pulses.setColorAt(i, i % 7 === 0 ? CORAL : ACCENT);
  }
  pulses.visible = false;
  world.add(pulses);

  const qPulse = new THREE.Quaternion();
  const vPulse = new THREE.Vector3();
  const sPulse = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  function pickTrace(active: THREE.Vector4) {
    // Favour the active group's traces when there is one.
    const weights = [active.x, active.y, active.z, active.w];
    const best = weights.indexOf(Math.max(...weights));
    if (weights[best] > 0.3 && Math.random() < 0.7) {
      const pool = traces.map((t, i) => (t.group === best ? i : -1)).filter((i) => i >= 0);
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return Math.floor(Math.random() * traces.length);
  }
  function movePulses(dt: number) {
    for (let i = 0; i < P; i++) {
      const s = pulseState[i];
      const t = traces[s.trace];
      s.d += (dt * s.speed) / t.len;
      if (s.d >= 1) {
        s.d = 0;
        s.trace = pickTrace(traceUniforms.uActive.value);
      }
      const tr = traces[s.trace];
      const at = s.d * tr.len;
      let k = 1;
      while (k < tr.pts.length - 1 && tr.cum[k] < at) k++;
      const a = tr.pts[k - 1];
      const b = tr.pts[k];
      const f = (at - tr.cum[k - 1]) / (tr.cum[k] - tr.cum[k - 1] || 1);
      vPulse.set(a.x + (b.x - a.x) * f, 0.07, a.y + (b.y - a.y) * f);
      qPulse.setFromAxisAngle(yAxis, -Math.atan2(b.y - a.y, b.x - a.x));
      sPulse.set(1, 1, 1);
      m4.compose(vPulse, qPulse, sPulse);
      pulses.setMatrixAt(i, m4);
    }
    pulses.instanceMatrix.needsUpdate = true;
  }

  // ----- Camera -----

  const goal = { atX: 0, atZ: 0, dist: 0, elev: 0, azim: 0, shift: 0 };
  goalFromFlight();
  // The intro starts from high above the first stop, already panned beside the text.
  const view = { ...goal, dist: goal.dist * 1.6, elev: 86, azim: goal.azim - 20 };
  const lookAt = new THREE.Vector3();
  const right = new THREE.Vector3();
  const tilt = { x: 0, y: 0 };

  function goalFromFlight(): Focus {
    const a = STOPS[flight.a];
    const b = STOPS[flight.b];
    const t = ease(flight.t);
    const mix = (p: number, q: number) => p + (q - p) * t;
    goal.atX = mix(a.at[0], b.at[0]);
    goal.atZ = mix(a.at[1], b.at[1]);
    goal.dist = mix(a.dist, b.dist) * (small ? 1.45 : 1);
    goal.elev = mix(a.elev, b.elev);
    goal.azim = mix(a.azim, b.azim);
    goal.shift = small ? 0 : mix(a.shift, b.shift);
    return t < 0.5 ? a.focus : b.focus;
  }

  function placeCamera(dt: number, intro: number) {
    // During the intro the camera eases down slower, from straight above.
    const k = reduced ? 1 : 1 - Math.pow(intro < 1 ? 0.25 : 0.04, dt);
    for (const key of Object.keys(view) as (keyof typeof view)[]) view[key] += (goal[key] - view[key]) * k;
    tilt.x += (pointer.x - tilt.x) * 0.05;
    tilt.y += (pointer.y - tilt.y) * 0.05;
    const elev = THREE.MathUtils.degToRad(Math.min(view.elev + tilt.y * 4, 89.5));
    const azim = THREE.MathUtils.degToRad(view.azim + tilt.x * 6);
    lookAt.set(view.atX, 0, view.atZ);
    camera.position.set(
      lookAt.x + Math.sin(azim) * Math.cos(elev) * view.dist,
      Math.sin(elev) * view.dist,
      lookAt.z + Math.cos(azim) * Math.cos(elev) * view.dist
    );
    // Pan the whole view, so the point looked at sits right of centre, beside the text.
    right.set(Math.cos(azim), 0, -Math.sin(azim));
    camera.position.addScaledVector(right, -view.shift);
    lookAt.addScaledVector(right, -view.shift);
    camera.lookAt(lookAt);
  }

  // ----- Focus: lift and light the parts a stop is about -----

  const activeGoal = new THREE.Vector4();
  function applyFocus(focus: Focus, dt: number, time: number) {
    activeGoal.set(0, 0, 0, 0);
    if (focus === "all" || focus === "cpu") activeGoal.set(0.7, 0.7, 0.7, 0.7);
    else if (focus !== "none") activeGoal.setComponent(GROUPS.indexOf(focus), 1);
    traceUniforms.uActive.value.lerp(activeGoal, reduced ? 1 : 1 - Math.pow(0.05, dt));
    built.forEach((b, i) => {
      const on = focus === b.part.group || (focus === "all" && b.part.group !== "cpu") ? 1 : 0;
      // Slightly different speeds, so a group lifts one part after another.
      const rate = reduced ? 1 : 1 - Math.pow(0.02 + (i % 7) * 0.012, dt);
      b.lift += (on - b.lift) * rate;
      const glow = b.lift * (0.55 + 0.15 * Math.sin(time * 3 + i));
      b.topMat.emissive.copy(ACCENT).multiplyScalar(b.part.group === "cpu" ? 0 : glow * 0.35);
    });
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 46 : 32;
    camera.updateProjectionMatrix();
  }

  let frameId = 0;
  let last = performance.now();
  let time = 0;
  let ready = false;
  const leds: THREE.Object3D[] = [];
  world.traverse((o) => o.name === "led" && leds.push(o));

  function frame(now: number) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
    last = now;
    time += reduced ? 0 : dt;
    traceUniforms.uTime.value = time;

    // Intro: traces draw out (0.3 s to 2.6 s), parts rise from the CPU outwards.
    const intro = reduced ? 1 : Math.min(time / 3, 1);
    if (!reduced) traceUniforms.uDraw.value = Math.min(Math.max((time - 0.3) / 2.3, 0), 1);
    for (const b of built) {
      if (!reduced) b.rise = Math.min(Math.max((time - b.delay) / 0.7, 0), 1);
      b.group.scale.y = Math.max(easeOutBack(b.rise), 0.001);
      b.group.position.y = b.lift * (b.part.group === "io" ? 0.3 : 0.7);
    }
    for (const s of smallParts) {
      const r = reduced ? 1 : Math.min(Math.max((time - s.delay) / 0.5, 0), 1);
      const y = s.mesh === caps ? 0.45 : 0.16;
      m4.makeRotationY(s.rotY);
      m4.scale(sPulse.set(1, Math.max(easeOutBack(r), 0.001), 1));
      m4.setPosition(s.x, y * Math.max(easeOutBack(r), 0.001), s.z);
      s.mesh.setMatrixAt(s.i, m4);
    }
    resistors.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    pulses.visible = traceUniforms.uDraw.value > 0.95 && !reduced;
    if (pulses.visible) movePulses(dt);
    leds.forEach((l, i) => (l.visible = reduced || Math.sin(time * (4 + i * 3)) > -0.3));

    const focus = goalFromFlight();
    applyFocus(focus, dt, time);
    placeCamera(dt, intro);
    renderer.render(world, camera);
    if (!ready) {
      ready = true;
      onReady?.();
    }
    frameId = requestAnimationFrame(frame);
  }

  function onVisibility() {
    cancelAnimationFrame(frameId);
    if (!document.hidden) {
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    }
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibility);
  resize();
  if (reduced) {
    goalFromFlight();
    Object.assign(view, goal);
  }
  frameId = requestAnimationFrame(frame);

  stop = () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    disposables.forEach((d) => d.dispose());
    world.environment?.dispose();
    renderer.dispose();
  };
}
