// The 3D scene behind the whole site (Three.js, one fixed full-screen canvas): a journey.
//
// The page opens on a screen, a terminal floating in white space. Scrolling shatters it into
// hundreds of shards and the camera flies through, then on along one continuous path past a chain of
// floating islands, one per chapter, linked by data cables with pulses running along them:
//   about    a monolith with my name on it, a ring of light turning around it
//   facts    four data pillars with the figures floating above them; they grow as you arrive
//   work     a screen per case study, standing in an arc; they light up as you arrive
//   skills   a tower of cubes, one per technology; it opens up as you arrive
//   offer    a gyroscope of rings around a core, spinning faster as you arrive
//   closing  scattered cubes that assemble into one block while the section scrolls
//   contact  an antenna sending out rings of signal
// White fog swallows what is far away, small square "bits" drift through the air.
//
//   startJourney(canvas, data, onReady)  builds the scene, calls onReady after the first frame
//   stopJourney()                        before a page swap
//   setFlight(a, b, t)                   between stop a and stop b, t = 0..1 (motion.ts, on scroll)
//   setPointer(x, y)                     pointer position, -0.5..0.5 each
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface JourneyData {
  skills: string[];
  work: string[];
  facts: { value: string; label: string }[];
}

const BG = new THREE.Color("#f5f6f9");
const INK = "#0b1220";
const ACCENT = 0x2f5bff;
const CORAL = 0xff6a3d;
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

type V3 = [number, number, number];
/** The stops in order. Each island stands at `at`; the camera stands at `cam` (relative to the
 *  island) and looks at `look` (relative too). A look point left of the island puts the island on
 *  the right of the screen, beside the text. Phones look straight at the island. */
const ORDER = ["hero", "about", "facts", "work", "skills", "offer", "closing", "contact"] as const;
type StopName = (typeof ORDER)[number];
const STOPS: Record<StopName, { at: V3; cam: V3; look: V3 }> = {
  hero: { at: [0, 2, 0], cam: [0, 0.5, 21], look: [-5.5, 0, 0] },
  about: { at: [-8, 0, -34], cam: [-5, 7, 24], look: [-7, 4, 0] },
  facts: { at: [12, -3, -64], cam: [-10, 8, 26], look: [-8, 4.5, 0] },
  work: { at: [-10, 2, -96], cam: [-2, 8, 28], look: [-6.5, 3.5, 0] },
  skills: { at: [13, 5, -128], cam: [-10, 8, 27], look: [-8, 6.5, 0] },
  offer: { at: [-11, 0, -160], cam: [-6, 6, 23], look: [-7.5, 3.5, 0] },
  closing: { at: [9, 4, -192], cam: [-5, 8, 21], look: [-6.5, 4.5, 0] },
  contact: { at: [13, -1, -224], cam: [-8, 8, 26], look: [-6.5, 4.5, 0] },
};

let stop: (() => void) | null = null;
let flight = { a: "hero" as string, b: "hero" as string, t: 0 };
const pointer = { x: 0, y: 0 };

export function setFlight(a: string, b: string, t: number) {
  flight = { a, b, t: Math.min(Math.max(t, 0), 1) };
}
export function setPointer(x: number, y: number) {
  pointer.x = x;
  pointer.y = y;
}
export function stopJourney() {
  if (stop) stop();
  stop = null;
}

/** Index of a stop on the path; the case study pages ("detail") look at the work island. */
function indexOf(name: string) {
  const i = ORDER.indexOf(name as StopName);
  return i >= 0 ? i : name === "detail" ? 3 : 0;
}

// Seeded random, so the scene is the same on every visit.
let seed = 5;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const add = (a: V3, b: V3): THREE.Vector3 => new THREE.Vector3(a[0] + b[0], a[1] + b[1], a[2] + b[2]);

// ---------- Canvas textures ----------

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Fits text into a width by shrinking the font and wrapping words onto up to `maxLines` lines. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, maxLines: number, weight = 600) {
  for (let s = size; s > 10; s -= 2) {
    ctx.font = `${weight} ${s}px ${MONO}`;
    const lines: string[] = [];
    let line = "";
    for (const w of text.split(/\s+/)) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size: s };
  }
  return { lines: [text], size: 10 };
}

/** The opening screen: a terminal. */
function terminalTexture() {
  return canvasTexture(1600, 900, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#e8edfb");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(47,91,255,0.07)";
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // Window bar.
    ctx.fillStyle = "rgba(11,18,32,0.06)";
    ctx.fillRect(0, 0, w, 70);
    [CORAL, 0xc5ccd8, 0xc5ccd8].forEach((c, i) => {
      ctx.fillStyle = `#${c.toString(16).padStart(6, "0")}`;
      ctx.beginPath();
      ctx.arc(48 + i * 36, 35, 11, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(11,18,32,0.5)";
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText("~/kristjan-mihin", 170, 44);
    const lines: [string, string][] = [
      ["$ ", "whoami"],
      ["", "kristjan mihin, full-stack developer"],
      ["$ ", "stack --main"],
      ["", ".NET  Azure  TypeScript  React  SQL"],
      ["$ ", "./enter --scroll"],
    ];
    ctx.font = `600 46px ${MONO}`;
    lines.forEach(([prompt, text], i) => {
      const y = 190 + i * 92;
      ctx.fillStyle = "#2f5bff";
      ctx.fillText(prompt, 90, y);
      ctx.fillStyle = prompt ? INK : "rgba(11,18,32,0.6)";
      ctx.fillText(text, 90 + ctx.measureText(prompt).width, y);
    });
    ctx.fillStyle = "#2f5bff";
    ctx.fillRect(90, 190 + 5 * 92 - 40, 26, 48);
  });
}

/** A label plate: white, a small accent mark, the text big, an optional caption. */
function plateTexture(text: string, caption: string, w = 1024, h = 640) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(11,18,32,0.12)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = "#2f5bff";
    ctx.fillRect(w * 0.07, h * 0.12, w * 0.05, h * 0.03);
    ctx.fillStyle = "rgba(11,18,32,0.5)";
    ctx.font = `600 ${h * 0.065}px ${MONO}`;
    ctx.fillText(caption.toUpperCase(), w * 0.07, h * 0.28);
    const { lines, size } = fit(ctx, text, w * 0.86, h * 0.17, 3, 700);
    ctx.fillStyle = INK;
    ctx.font = `700 ${size}px ${MONO}`;
    lines.forEach((l, i) => ctx.fillText(l, w * 0.07, h * 0.5 + i * size * 1.15));
  });
}

/** A figure floating over a pillar: the value big, the label small. Transparent background. */
function figureTexture(value: string, label: string) {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.textAlign = "center";
    ctx.fillStyle = "#2f5bff";
    ctx.font = `700 ${h * 0.42}px ${MONO}`;
    ctx.fillText(value, w / 2, h * 0.5);
    const { lines, size } = fit(ctx, label.toUpperCase(), w * 0.9, h * 0.085, 2, 600);
    ctx.fillStyle = "rgba(11,18,32,0.7)";
    ctx.font = `600 ${size}px ${MONO}`;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h * 0.68 + i * size * 1.3));
  });
}

// ---------- The shattering screen (all on the GPU) ----------

const shardVertex = `
  uniform float uShatter;
  uniform vec2 uCell;
  uniform vec2 uSize;
  attribute vec2 aOrigin;
  attribute float aFlip;
  attribute vec3 aDir;
  attribute vec4 aSpin;
  varying vec2 vUv;
  varying float vShade;
  vec3 rotate(vec3 v, vec3 k, float a) {
    return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a));
  }
  void main() {
    // The triangle in its cell; the second triangle of a cell is the first turned half way.
    vec2 p = aFlip > 0.5 ? vec2(1.0) - position.xy : position.xy;
    vec2 local = aOrigin + p * uCell;
    vUv = local / uSize + 0.5;
    vec2 centre = aOrigin + (aFlip > 0.5 ? vec2(2.0 / 3.0) : vec2(1.0 / 3.0)) * uCell;
    float s = uShatter * (0.7 + aSpin.w * 0.6);
    float angle = s * 6.0 * aSpin.w;
    vec3 offset = rotate(vec3(local - centre, 0.0), normalize(aSpin.xyz), angle);
    vec3 pos = vec3(centre, 0.0) + offset + aDir * s * s * 28.0;
    vShade = 1.0 - 0.25 * abs(sin(angle));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;
const shardFragment = `
  uniform sampler2D uMap;
  uniform float uShatter;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    gl_FragColor = vec4(c.rgb * vShade, 1.0 - smoothstep(0.75, 1.0, uShatter));
    #include <colorspace_fragment>
  }
`;

// ---------- Drifting bits ----------

const bitVertex = `
  uniform float uTime;
  uniform float uPixel;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.4 + aSeed * 30.0) * 0.8;
    p.x += cos(uTime * 0.3 + aSeed * 20.0) * 0.5;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uPixel * (2.0 + aSeed * 3.0) * clamp(25.0 / -view.z, 0.2, 3.0);
    vColor = aColor;
    vFade = smoothstep(90.0, 20.0, -view.z);
  }
`;
const bitFragment = `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(vColor, 0.85 * vFade);
    #include <colorspace_fragment>
  }
`;

// ---------- Scene ----------

export function startJourney(canvas: HTMLCanvasElement, data: JourneyData, onReady?: () => void) {
  stopJourney();
  const small = window.innerWidth < 768;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.setClearColor(BG, 1);

  const world = new THREE.Scene();
  world.fog = new THREE.FogExp2(BG.getHex(), 0.016);
  const pmrem = new THREE.PMREMGenerator(renderer);
  world.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  world.environmentIntensity = 0.35;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 300);

  world.add(new THREE.HemisphereLight(0xffffff, 0xd9e0ee, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(12, 24, 14);
  world.add(sun);

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // Shared materials: white "plaster", the accent as light, a light metal.
  const plaster = keep(new THREE.MeshStandardMaterial({ color: 0xf2f3f6, roughness: 0.92, flatShading: true }));
  const plasterDark = keep(new THREE.MeshStandardMaterial({ color: 0xdfe3eb, roughness: 0.9, flatShading: true }));
  const glow = keep(new THREE.MeshBasicMaterial({ color: ACCENT }));
  const glowCoral = keep(new THREE.MeshBasicMaterial({ color: CORAL }));
  const metal = keep(new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.3, metalness: 0.8 }));

  const centres = ORDER.map((name) => new THREE.Vector3(...STOPS[name].at));
  // Everything that moves on its own each frame.
  const updaters: ((time: number, dt: number, presence: number[]) => void)[] = [];

  /** A floating island: a hexagonal slab with a glowing rim, a rough underside and a few loose
   *  blocks drifting under it. Returns the group to put the chapter's objects on. */
  function island(index: number, radius: number) {
    const root = new THREE.Group();
    root.position.copy(centres[index]);
    const slab = new THREE.Mesh(keep(new THREE.CylinderGeometry(radius, radius * 0.96, 0.7, 6)), plaster);
    slab.position.y = -0.35;
    const underGeo = keep(new THREE.ConeGeometry(radius * 0.94, radius * 1.5, 6, 4));
    // Roughen the underside a little.
    seed = 17 + index;
    const pos = underGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i)) < radius * 0.7) {
        pos.setX(i, pos.getX(i) * (0.85 + rand() * 0.3));
        pos.setZ(i, pos.getZ(i) * (0.85 + rand() * 0.3));
      }
    }
    underGeo.computeVertexNormals();
    const under = new THREE.Mesh(underGeo, plasterDark);
    under.rotation.x = Math.PI;
    under.position.y = -0.7 - radius * 0.75;
    const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(radius * 1.005, 0.045, 4, 6)), glow);
    rim.rotation.x = Math.PI / 2;
    rim.rotation.z = Math.PI / 6;
    rim.position.y = 0.01;
    const inner = new THREE.Mesh(keep(new THREE.TorusGeometry(radius * 0.7, 0.02, 4, 6)), plasterDark);
    inner.rotation.x = Math.PI / 2;
    inner.rotation.z = Math.PI / 6;
    inner.position.y = 0.02;
    root.add(slab, under, rim, inner);
    // Loose blocks under the island.
    const debris: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const s = 0.3 + rand() * 0.6;
      const d = new THREE.Mesh(keep(new THREE.BoxGeometry(s, s, s)), plaster);
      const a = (i / 6) * Math.PI * 2 + rand();
      d.position.set(Math.cos(a) * radius * (0.6 + rand() * 0.6), -radius * (0.6 + rand() * 0.9), Math.sin(a) * radius * (0.6 + rand() * 0.6));
      d.rotation.set(rand() * 3, rand() * 3, 0);
      debris.push(d);
      root.add(d);
    }
    const stage = new THREE.Group();
    root.add(stage);
    world.add(root);
    const baseY = root.position.y;
    updaters.push((time) => {
      if (reduced) return;
      root.position.y = baseY + Math.sin(time * 0.5 + index) * 0.35;
      debris.forEach((d, i) => {
        d.rotation.x += 0.003 * (i + 1);
        d.position.y += Math.sin(time * 0.8 + i) * 0.003;
      });
    });
    return stage;
  }

  // ----- 0. The opening screen, which shatters -----

  const SCREEN_W = 16;
  const SCREEN_H = 9;
  const COLS = small ? 12 : 18;
  const ROWS = small ? 7 : 10;
  const shardBase = keep(new THREE.BufferGeometry());
  shardBase.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const shardGeo = keep(new THREE.InstancedBufferGeometry());
  shardGeo.index = null;
  shardGeo.setAttribute("position", shardBase.attributes.position);
  const count = COLS * ROWS * 2;
  const origin = new Float32Array(count * 2);
  const flip = new Float32Array(count);
  const dir = new Float32Array(count * 3);
  const spin = new Float32Array(count * 4);
  seed = 99;
  for (let r = 0, k = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (let f = 0; f < 2; f++, k++) {
        const ox = -SCREEN_W / 2 + (c * SCREEN_W) / COLS;
        const oy = -SCREEN_H / 2 + (r * SCREEN_H) / ROWS;
        origin.set([ox, oy], k * 2);
        flip[k] = f;
        // Out from the centre and towards the camera, so the shards fly past it.
        const cx = ox + SCREEN_W / COLS / 2;
        const cy = oy + SCREEN_H / ROWS / 2;
        const v = new THREE.Vector3(cx / SCREEN_W + (rand() - 0.5) * 0.4, cy / SCREEN_H + (rand() - 0.5) * 0.4, 0.5 + rand() * 0.9).normalize();
        dir.set([v.x, v.y, v.z], k * 3);
        spin.set([rand() - 0.5, rand() - 0.5, rand() - 0.5, 0.4 + rand() * 0.8], k * 4);
      }
    }
  }
  shardGeo.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(origin, 2));
  shardGeo.setAttribute("aFlip", new THREE.InstancedBufferAttribute(flip, 1));
  shardGeo.setAttribute("aDir", new THREE.InstancedBufferAttribute(dir, 3));
  shardGeo.setAttribute("aSpin", new THREE.InstancedBufferAttribute(spin, 4));
  shardGeo.instanceCount = count;
  const shardUniforms = {
    uShatter: { value: 0 },
    uCell: { value: new THREE.Vector2(SCREEN_W / COLS, SCREEN_H / ROWS) },
    uSize: { value: new THREE.Vector2(SCREEN_W, SCREEN_H) },
    uMap: { value: keep(terminalTexture()) },
  };
  const shards = new THREE.Mesh(
    shardGeo,
    keep(new THREE.ShaderMaterial({ vertexShader: shardVertex, fragmentShader: shardFragment, uniforms: shardUniforms, side: THREE.DoubleSide, transparent: true }))
  );
  shards.frustumCulled = false;
  const screen = new THREE.Group();
  screen.position.copy(centres[0]);
  // The bezel: four bars and a status light, which fade away with the shatter.
  const bezelMat = keep(new THREE.MeshStandardMaterial({ color: 0xf7f8fa, roughness: 0.5, transparent: true }));
  const bars: [number, number, number, number][] = [
    [0, SCREEN_H / 2 + 0.25, SCREEN_W + 1, 0.5],
    [0, -SCREEN_H / 2 - 0.25, SCREEN_W + 1, 0.5],
    [-SCREEN_W / 2 - 0.25, 0, 0.5, SCREEN_H],
    [SCREEN_W / 2 + 0.25, 0, 0.5, SCREEN_H],
  ];
  for (const [x, y, w, h] of bars) {
    const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, 0.5)), bezelMat);
    bar.position.set(x, y, -0.1);
    screen.add(bar);
  }
  const led = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 0.08, 0.1)), glow);
  led.position.set(0, -SCREEN_H / 2 - 0.25, 0.2);
  screen.add(shards, led);
  world.add(screen);

  // ----- 1. About: the monolith -----
  {
    const stage = island(1, 5.5);
    const body = new THREE.Mesh(keep(new RoundedBoxGeometry(3.4, 8.5, 1.6, 3, 0.18)), plaster);
    body.position.y = 4.25;
    const face = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(2.8, 7.6)),
      keep(
        new THREE.MeshStandardMaterial({
          roughness: 0.6,
          map: keep(
            canvasTexture(512, 1390, (ctx, w, h) => {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, w, h);
              ctx.fillStyle = INK;
              ctx.font = `800 110px ${MONO}`;
              ctx.fillText("KM", 50, 190);
              ctx.font = `600 54px ${MONO}`;
              ["KRISTJAN", "MIHIN"].forEach((t, i) => ctx.fillText(t, 50, 330 + i * 70));
              ctx.fillStyle = "rgba(11,18,32,0.55)";
              ctx.font = `500 34px ${MONO}`;
              ["FULL-STACK", "DEVELOPER", "", ".NET", "AZURE", "SLOVENIA"].forEach((t, i) => ctx.fillText(t, 50, 560 + i * 52));
              // Status lights.
              for (let i = 0; i < 9; i++) {
                ctx.fillStyle = i % 4 === 3 ? "#ff6a3d" : "#2f5bff";
                ctx.fillRect(50, 1000 + i * 36, 120 + ((i * 53) % 260), 14);
              }
            })
          ),
        })
      )
    );
    face.position.set(0, 4.25, 0.81);
    const halo = new THREE.Mesh(keep(new THREE.TorusGeometry(3.4, 0.05, 6, 80)), glow);
    halo.position.y = 4.5;
    stage.add(body, face, halo);
    stage.rotation.y = 0.35;
    updaters.push((time, _dt, presence) => {
      halo.rotation.x = Math.PI / 2 + Math.sin(time * 0.6) * 0.35;
      halo.rotation.y = time * 0.5;
      halo.scale.setScalar(0.85 + 0.15 * presence[1]);
    });
  }

  // ----- 2. Facts: data pillars with the figures over them -----
  {
    const stage = island(2, 6);
    const heights = [6, 9, 7.5, 4.5];
    const pillars: THREE.Mesh[] = [];
    const labels: THREE.Sprite[] = [];
    data.facts.slice(0, 4).forEach((f, i) => {
      const x = (i - 1.5) * 2.8;
      const z = i % 2 === 0 ? 0.8 : -0.8;
      const pillar = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.9, 0.9, 1, 6)), plaster);
      pillar.position.set(x, 0, z);
      const cap = new THREE.Mesh(keep(new THREE.TorusGeometry(0.92, 0.05, 4, 6)), i === 1 ? glowCoral : glow);
      cap.rotation.x = Math.PI / 2;
      pillar.add(cap);
      cap.position.y = 0.5;
      const label = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(figureTexture(f.value, f.label)), transparent: true, depthWrite: false })));
      label.scale.set(4.4, 2.2, 1);
      stage.add(pillar, label);
      pillars.push(pillar);
      labels.push(label);
    });
    stage.rotation.y = -0.25;
    // They grow as you arrive, each a little after the one before.
    updaters.push((time, _dt, presence) => {
      pillars.forEach((p, i) => {
        const g = smooth(presence[2] * 1.6 - i * 0.15);
        const h = 0.4 + (heights[i] - 0.4) * g;
        p.scale.y = h;
        p.position.y = h / 2;
        p.children[0].scale.set(1, 1, 1 / Math.max(h, 0.01));
        labels[i].position.set(p.position.x, h + 1.6 + Math.sin(time + i) * 0.15, p.position.z);
        (labels[i].material as THREE.SpriteMaterial).opacity = g;
      });
    });
  }

  // ----- 3. Work: a screen per case study, in an arc -----
  {
    const stage = island(3, 7);
    const screens: { group: THREE.Group; mat: THREE.MeshStandardMaterial }[] = [];
    const n = Math.min(data.work.length, 8);
    const stands: THREE.Mesh[] = [];
    data.work.slice(0, 8).forEach((label, i) => {
      const group = new THREE.Group();
      // Two rows facing the camera: four at the back, the rest in front and lower.
      const row = i < 4 ? 0 : 1;
      const col = row === 0 ? i : i - 4;
      const perRow = row === 0 ? Math.min(n, 4) : n - 4;
      group.position.set((col - (perRow - 1) / 2) * 3.9, row === 0 ? 2.9 : 0, row === 0 ? -1.6 : 1.6);
      group.userData.baseY = group.position.y;
      const frame = new THREE.Mesh(keep(new RoundedBoxGeometry(3.6, 2.3, 0.14, 2, 0.06)), plaster);
      const mat = keep(new THREE.MeshStandardMaterial({ map: keep(plateTexture(label, `Case ${String(i + 1).padStart(2, "0")}`)), roughness: 0.6, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0 }));
      const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.4, 2.1)), mat);
      face.position.z = 0.075;
      const stand = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.06, 1, 6)), metal);
      stands.push(stand);
      frame.add(face, stand);
      group.add(frame);
      stage.add(group);
      screens.push({ group, mat });
    });
    updaters.push((time, _dt, presence) => {
      screens.forEach((s, i) => {
        const on = smooth(presence[3] * 1.8 - i * 0.1);
        const y = s.group.userData.baseY + 1.8 + on * 0.5 + Math.sin(time * 0.8 + i) * 0.1;
        s.group.position.y = y;
        // Folded flat on arrival, they stand up one after another.
        s.group.children[0].rotation.x = -(1 - on) * 1.2;
        // The stand reaches down to the island.
        stands[i].scale.y = y - 1.15;
        stands[i].position.y = -1.15 - (y - 1.15) / 2;
        s.mat.emissiveIntensity = on * (0.08 + 0.04 * Math.sin(time * 2 + i));
      });
    });
  }

  // ----- 4. Skills: a tower of cubes, one per technology -----
  {
    const stage = island(4, 5.5);
    const cubes: THREE.Mesh[] = [];
    data.skills.slice(0, 8).forEach((label, i) => {
      const tex = keep(plateTexture(label, `0${i + 1}`, 768, 768));
      const face = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
      // Labels on the four sides, plain plaster on top and bottom.
      const cube = new THREE.Mesh(keep(new THREE.BoxGeometry(2.4, 2.4, 2.4)), [face, face, plaster, plaster, face, face]);
      stage.add(cube);
      cubes.push(cube);
    });
    updaters.push((time, _dt, presence) => {
      const open = smooth(presence[4] * 1.5);
      cubes.forEach((c, i) => {
        // Closed: a straight stack. Open: a twisting spiral with gaps.
        const a = i * (0.25 + open * 0.55) + time * 0.15;
        const r = open * 1.6;
        c.position.set(Math.cos(a) * r, 1.2 + i * (2.4 + open * 0.35), Math.sin(a) * r);
        c.rotation.y = a + open * 0.4;
      });
      stage.scale.setScalar(0.8);
    });
  }

  // ----- 5. Offer: a gyroscope around a core -----
  {
    const stage = island(5, 5.5);
    const core = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(1.1, 1)), keep(new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.35, flatShading: true })));
    core.position.y = 4.5;
    const rings = [3.6, 2.9, 2.2].map((r, i) => {
      const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(r, 0.14, 8, 90)), i === 1 ? metal : plaster);
      ring.position.y = 4.5;
      stage.add(ring);
      return ring;
    });
    // Small satellites on the outer ring.
    const sats = Array.from({ length: 8 }, (_, i) => {
      const s = new THREE.Mesh(keep(new THREE.BoxGeometry(0.35, 0.35, 0.35)), i % 3 === 0 ? glowCoral : glow);
      stage.add(s);
      return s;
    });
    stage.add(core);
    let spin = 0;
    updaters.push((time, dt, presence) => {
      spin += dt * (0.25 + presence[5] * 1.2);
      rings[0].rotation.set(spin * 0.6, spin * 0.3, 0);
      rings[1].rotation.set(Math.PI / 2 + spin * 0.4, 0, spin * 0.7);
      rings[2].rotation.set(spin, Math.PI / 3, spin * 0.2);
      core.rotation.y = spin;
      sats.forEach((s, i) => {
        const a = spin * 0.8 + (i / 8) * Math.PI * 2;
        s.position.set(Math.cos(a) * 4.4, 4.5 + Math.sin(a * 2) * 0.6, Math.sin(a) * 4.4);
      });
    });
  }

  // ----- 6. Closing: scattered cubes assemble into one block -----
  const N = 6;
  const blockGeo = keep(new THREE.BoxGeometry(0.7, 0.7, 0.7));
  const blocks = new THREE.InstancedMesh(blockGeo, plaster, N * N * N);
  blocks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * N * N * 3), 3);
  const assembled: THREE.Vector3[] = [];
  const scattered: THREE.Vector3[] = [];
  const blockSpin: THREE.Vector3[] = [];
  {
    const stage = island(6, 5.5);
    seed = 61;
    const col = new THREE.Color();
    for (let x = 0; x < N; x++)
      for (let y = 0; y < N; y++)
        for (let z = 0; z < N; z++) {
          const i = assembled.length;
          assembled.push(new THREE.Vector3((x - (N - 1) / 2) * 0.74, 5 + (y - (N - 1) / 2) * 0.74, (z - (N - 1) / 2) * 0.74));
          const a = rand() * Math.PI * 2;
          const r = 5 + rand() * 9;
          scattered.push(new THREE.Vector3(Math.cos(a) * r, 1 + rand() * 12 - 2, Math.sin(a) * r * 0.6 - 2));
          blockSpin.push(new THREE.Vector3(rand() * 6, rand() * 6, rand() * 6));
          const accent = (x + y + z) % 7 === 0;
          blocks.setColorAt(i, col.set(accent ? (i % 3 === 0 ? CORAL : ACCENT) : 0xffffff));
        }
    blocks.frustumCulled = false;
    stage.add(blocks);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    updaters.push((time, _dt, presence) => {
      // Assembled while the closing section is on screen; scattered before it.
      const k = assembly;
      for (let i = 0; i < assembled.length; i++) {
        const t = smooth(k * 1.4 - (i % 36) * 0.011);
        p.lerpVectors(scattered[i], assembled[i], t);
        p.y += (1 - t) * Math.sin(time * 0.7 + i) * 0.4;
        e.set(blockSpin[i].x * (1 - t) + time * 0.05 * (1 - t), blockSpin[i].y * (1 - t), blockSpin[i].z * (1 - t));
        q.setFromEuler(e);
        m.compose(p, q, one);
        blocks.setMatrixAt(i, m);
      }
      blocks.instanceMatrix.needsUpdate = true;
      stage.rotation.y = Math.PI / 4 + time * 0.12 * presence[6];
    });
  }

  // ----- 7. Contact: an antenna sending out signal -----
  {
    const stage = island(7, 5);
    const mast = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.16, 0.28, 6, 8)), metal);
    mast.position.y = 3;
    const points = Array.from({ length: 12 }, (_, i) => new THREE.Vector2(Math.max((i / 11) * 2.6, 0.05), ((i / 11) * 2.6) ** 2 * 0.22));
    const dish = new THREE.Mesh(keep(new THREE.LatheGeometry(points, 40)), keep(new THREE.MeshStandardMaterial({ color: 0xf7f8fa, roughness: 0.5, side: THREE.DoubleSide })));
    dish.position.set(0, 6, 0);
    dish.rotation.x = -Math.PI / 2 + 0.5;
    const tip = new THREE.Mesh(keep(new THREE.SphereGeometry(0.22, 16, 12)), glowCoral);
    tip.position.set(0, 6.2, 1.4);
    const ringGeo = keep(new THREE.TorusGeometry(1, 0.04, 6, 60));
    const ringMats = [0, 1, 2].map(() => keep(new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, depthWrite: false })));
    const rings = ringMats.map((mat) => {
      const r = new THREE.Mesh(ringGeo, mat);
      stage.add(r);
      return r;
    });
    stage.add(mast, dish, tip);
    stage.rotation.y = -0.6;
    updaters.push((time, _dt, presence) => {
      tip.visible = reduced || Math.sin(time * 4) > -0.2;
      rings.forEach((r, i) => {
        const f = (time * 0.45 + i / 3) % 1;
        // The rings travel out along the dish's axis, growing and fading.
        r.position.set(0, 6.1 + f * 4, 1 + f * 7);
        r.rotation.x = -0.5;
        r.scale.setScalar(1 + f * 3);
        ringMats[i].opacity = (1 - f) * 0.8 * Math.max(presence[7], 0.25);
      });
    });
  }

  // ----- Cables between the islands, with pulses -----
  const cableMat = keep(new THREE.MeshStandardMaterial({ color: 0xe4e8f0, roughness: 0.6 }));
  const pulseGeo = keep(new THREE.SphereGeometry(0.16, 10, 8));
  const cables: { curve: THREE.CatmullRomCurve3; pulses: THREE.Mesh[] }[] = [];
  for (let i = 1; i < centres.length - 1; i++) {
    const a = centres[i].clone().add(new THREE.Vector3(0, -0.4, 0));
    const b = centres[i + 1].clone().add(new THREE.Vector3(0, -0.4, 0));
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -6, 0));
    const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).add(new THREE.Vector3(0, -1.5, 0)), mid, b.clone().lerp(mid, 0.5).add(new THREE.Vector3(0, -1.5, 0)), b]);
    world.add(new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 80, 0.07, 6)), cableMat));
    const pulses = [0, 1, 2].map((k) => {
      const p = new THREE.Mesh(pulseGeo, k === 2 ? glowCoral : glow);
      world.add(p);
      return p;
    });
    cables.push({ curve, pulses });
  }
  updaters.push((time) => {
    cables.forEach((c, i) => c.pulses.forEach((p, k) => p.position.copy(c.curve.getPointAt((time * 0.12 + k / 3 + i * 0.17) % 1))));
  });

  // ----- Drifting bits -----
  const B = small ? 500 : 1100;
  const bitPos = new Float32Array(B * 3);
  const bitSeed = new Float32Array(B);
  const bitColor = new Float32Array(B * 3);
  seed = 7;
  const grey = new THREE.Color(0xa9b3c9);
  const blue = new THREE.Color(ACCENT);
  const coral = new THREE.Color(CORAL);
  for (let i = 0; i < B; i++) {
    const z = 25 - rand() * 260;
    bitPos.set([(rand() - 0.5) * 70, (rand() - 0.5) * 40, z], i * 3);
    bitSeed[i] = rand();
    const c = rand() < 0.12 ? blue : rand() < 0.04 ? coral : grey;
    bitColor.set([c.r, c.g, c.b], i * 3);
  }
  const bitGeo = keep(new THREE.BufferGeometry());
  bitGeo.setAttribute("position", new THREE.BufferAttribute(bitPos, 3));
  bitGeo.setAttribute("aSeed", new THREE.BufferAttribute(bitSeed, 1));
  bitGeo.setAttribute("aColor", new THREE.BufferAttribute(bitColor, 3));
  const bitUniforms = { uTime: { value: 0 }, uPixel: { value: renderer.getPixelRatio() } };
  const bits = new THREE.Points(bitGeo, keep(new THREE.ShaderMaterial({ vertexShader: bitVertex, fragmentShader: bitFragment, uniforms: bitUniforms, transparent: true, depthWrite: false })));
  bits.frustumCulled = false;
  world.add(bits);

  // ----- The camera path -----

  const camPoints = ORDER.map((name) => add(STOPS[name].at, STOPS[name].cam));
  const lookPoints = ORDER.map((name) => add(STOPS[name].at, small ? [0, STOPS[name].look[1], 0] : STOPS[name].look));
  if (small) {
    camPoints.forEach((p, i) => (p.x = centres[i].x + STOPS[ORDER[i]].cam[0] * 0.3));
    // Phones: the opening screen further back and high in the view, above the name.
    camPoints[0].copy(centres[0]).add(new THREE.Vector3(0, -2, 31));
    lookPoints[0].copy(centres[0]).add(new THREE.Vector3(0, -7, 0));
  }
  const camCurve = new THREE.CatmullRomCurve3(camPoints, false, "centripetal");
  const lookCurve = new THREE.CatmullRomCurve3(lookPoints, false, "centripetal");
  const last = ORDER.length - 1;

  let progress = 0; // position along the path, 0 .. ORDER.length - 1, eased toward the scroll
  let assembly = 0;
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const tilt = { x: 0, y: 0 };
  const presence = ORDER.map(() => 0);

  function frameCamera(dt: number) {
    const ia = indexOf(flight.a);
    const ib = indexOf(flight.b);
    const target = ia + (ib - ia) * flight.t;
    progress += (target - progress) * (reduced ? 1 : 1 - Math.pow(0.05, dt));
    const u = Math.min(Math.max(progress / last, 0), 1);
    camCurve.getPoint(u, camPos);
    lookCurve.getPoint(u, lookAt);
    tilt.x += (pointer.x - tilt.x) * 0.05;
    tilt.y += (pointer.y - tilt.y) * 0.05;
    camera.position.set(camPos.x + tilt.x * 1.6, camPos.y + tilt.y * 1, camPos.z);
    camera.lookAt(lookAt);
    // How present each island is: 1 at its stop, 0 one stop away.
    for (let i = 0; i < presence.length; i++) presence[i] = clamp01(1 - Math.abs(progress - i));
    // The screen shatters during the first half of the way to the first island (from a little
    // past the start, where the page opens); the blocks assemble from halfway to the closing stop
    // until the stop itself.
    shardUniforms.uShatter.value = smooth((progress - 0.17) / 0.4);
    bezelMat.opacity = 1 - smooth((progress - 0.17) / 0.2);
    led.visible = progress < 0.35;
    assembly = clamp01((progress - (ORDER.indexOf("closing") - 0.75)) / 0.75);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 60 : 42;
    camera.updateProjectionMatrix();
  }

  let frameId = 0;
  let lastNow = performance.now();
  let time = 0;
  let ready = false;
  function frame(now: number) {
    const dt = Math.min(Math.max((now - lastNow) / 1000, 0), 0.1);
    lastNow = now;
    time += reduced ? 0 : dt;
    bitUniforms.uTime.value = time;
    frameCamera(dt);
    for (const u of updaters) u(time, dt, presence);
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
      lastNow = performance.now();
      frameId = requestAnimationFrame(frame);
    }
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibility);
  resize();
  progress = indexOf(flight.a);
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
