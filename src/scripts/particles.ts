// Full-page particle layer rendered with Three.js, fixed over the silk and behind the content.
//
// Shapes are looked up by name: abstract forms (scatter, sphere, ring, wave), technology marks
// (icons from simple-icons, lettering where the set has no icon) and scenes drawn in shapes.ts.
// "a+b" or "a+b+c" is a cluster: the parts shown together, smaller, side by side or in a triangle.
// "field" is a star field covering the whole screen.
//   setBlend(from, to, t, fromX, toX, currents)
//       show shape `from` at x = fromX blended toward shape `to` at x = toX by t (0..1).
//       Points do not all move at once: they peel off from the edge nearest the destination and
//       travel along curved paths, grouped into `currents` bands, so a change of scene looks like
//       particles flowing across the screen into the new shape while the text appears.
//   setTint(0..1)   0 = plum dots (for beige sections), 1 = beige dots (for plum sections)
// The cloud tilts toward the cursor with an eased motion and the points ripple gently like water.
import * as THREE from "three";
import { siDotnet, siReact, siTypescript, siAngular, siDocker, siSupabase, siPostgresql } from "simple-icons";
import { scenes } from "./shapes";

const marks: Record<string, { text?: string; icon?: { path: string } }> = {
  csharp: { text: "C#" },
  dotnet: { icon: siDotnet },
  azure: { text: "Azure" },
  sql: { text: "SQL" },
  react: { icon: siReact },
  typescript: { icon: siTypescript },
  angular: { icon: siAngular },
  docker: { icon: siDocker },
  supabase: { icon: siSupabase },
  postgresql: { icon: siPostgresql },
};

const PLUM = new THREE.Color("#3a2639");
const BEIGE = new THREE.Color("#f3e8d6");

let fromName = "scatter";
let toName = "scatter";
let blend = 0;
let fromX = 0;
let toX = 0;
let currents = 2;
let tint = 1;
let mouseX = 0;
let mouseY = 0;
let tiltX = 0;
let tiltY = 0;
let frameId = 0;
let stop: (() => void) | null = null;

export function setBlend(from: string, to: string, t: number, xFrom = 0, xTo = 0, bands = 2) {
  fromName = from;
  toName = to;
  blend = Math.min(Math.max(t, 0), 1);
  fromX = xFrom;
  toX = xTo;
  currents = Math.max(1, bands);
}
export function setTint(value: number) {
  tint = value;
}

export function stopParticles() {
  if (stop) stop();
  stop = null;
}

export function startParticles(canvas: HTMLCanvasElement) {
  stopParticles();

  const small = window.innerWidth < 768;
  const count = small ? 6000 : 14000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 7.5;

  // Shapes are built the first time they are asked for and kept.
  const cache = new Map<string, Float32Array>();
  function shape(name: string): Float32Array {
    let s = cache.get(name);
    if (s) return s;
    if (name.includes("+")) s = cluster(name.split("+").map(shape), count);
    else if (name === "sphere") s = sphere(count);
    else if (name === "stars") s = scatter(count, 5.5);
    else if (name === "field") s = box(count, 14, 8, 2);
    else if (name === "ring") s = ring(count);
    else if (name === "wave") s = wave(count);
    else if (marks[name]) s = marks[name].icon ? fromIcon(marks[name].icon!.path, count) : fromText(marks[name].text!, count);
    else if (scenes[name]) s = fromCanvas(scenes[name], count);
    else s = scatter(count, 8);
    cache.set(name, s);
    return s;
  }

  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: small ? 0.045 : 0.034,
    map: dotTexture(),
    color: BEIGE.clone(),
    transparent: true,
    opacity: small ? 0.55 : 0.8,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame(time: number) {
    const a = shape(fromName);
    const b = shape(toName);
    const s = time * 0.0012;
    const moving = fromName !== toName || fromX !== toX;
    // Points nearest the destination leave first: +1 when travelling right, -1 when travelling left.
    const dir = toX >= fromX ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      let t = 1;
      let arc = 0;
      if (moving) {
        // Each point waits for its turn (0..55% of the blend) then crosses over the remaining 45%.
        const edge = Math.min(Math.max((a[j] * dir + 2.2) / 4.4, 0), 1);
        t = smooth((blend - edge * 0.55) / 0.45);
        // Curved path: the point rises or dips depending on which current it belongs to.
        const band = (i % currents) - (currents - 1) / 2;
        const jitter = ((i * 7919) % 1000) / 1000 - 0.5;
        arc = Math.sin(Math.PI * t) * (band * 1.1 + jitter * 0.5);
      }
      const x = a[j] + fromX + (b[j] + toX - a[j] - fromX) * t;
      const z = a[j + 2] + (b[j + 2] - a[j + 2]) * t;
      positions[j] = x;
      // A slow ripple across the cloud so it never sits still.
      positions[j + 1] = a[j + 1] + (b[j + 1] - a[j + 1]) * t + arc + Math.sin(x * 1.4 + s) * Math.cos(z * 1.1 + s * 0.7) * 0.05;
      positions[j + 2] = z;
    }
    geometry.attributes.position.needsUpdate = true;

    // Ease toward the pointer.
    tiltX += (mouseX - tiltX) * 0.05;
    tiltY += (mouseY - tiltY) * 0.05;
    points.rotation.y = tiltX * 0.3;
    points.rotation.x = tiltY * 0.2;

    material.color.copy(PLUM).lerp(BEIGE, tint);

    renderer.render(scene, camera);
    frameId = requestAnimationFrame(frame);
  }

  function onMove(e: PointerEvent) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove);
  resize();
  frameId = requestAnimationFrame(frame);

  stop = () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}

// Several shapes shown together: two side by side, three in a triangle. Each part gets an equal
// share of the points, scaled down and moved to its slot.
function cluster(parts: Float32Array[], count: number) {
  const slots = parts.length === 2 ? [[-0.95, 0], [0.95, 0]] : [[-1.0, 0.8], [1.0, 0.8], [0, -0.95]];
  const scale = parts.length === 2 ? 0.5 : 0.46;
  const out = new Float32Array(count * 3);
  const per = Math.floor(count / parts.length);
  for (let i = 0; i < count; i++) {
    const partIndex = Math.min(Math.floor(i / per), parts.length - 1);
    const part = parts[partIndex];
    const j = (i % per) * 3;
    const [dx, dy] = slots[partIndex] ?? [0, 0];
    out.set([part[j] * scale + dx, part[j + 1] * scale + dy, part[j + 2]], i * 3);
  }
  return out;
}

// Points spread randomly inside a box of the given size.
function box(count: number, w: number, h: number, d: number) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out.set([(Math.random() - 0.5) * w, (Math.random() - 0.5) * h, (Math.random() - 0.5) * d], i * 3);
  }
  return out;
}

function smooth(t: number) {
  t = Math.min(Math.max(t, 0), 1);
  return t * t * (3 - 2 * t);
}

// Points spread randomly inside a cube of the given size.
function scatter(count: number, size: number) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out.set([(Math.random() - 0.5) * size, (Math.random() - 0.5) * size, (Math.random() - 0.5) * size], i * 3);
  }
  return out;
}

// Points spread evenly over a sphere surface, with a little depth jitter.
function sphere(count: number) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 2.2 + (Math.random() - 0.5) * 0.15;
    out.set([r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)], i * 3);
  }
  return out;
}

// A tilted torus ring.
function ring(count: number) {
  const out = new Float32Array(count * 3);
  const tilt = 0.6;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const b = Math.random() * Math.PI * 2;
    const R = 2.4;
    const r = 0.35 + Math.random() * 0.1;
    const x = (R + r * Math.cos(b)) * Math.cos(a);
    const y = r * Math.sin(b);
    const z = (R + r * Math.cos(b)) * Math.sin(a);
    out.set([x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)], i * 3);
  }
  return out;
}

// A flat grid in perspective, like a floor plane with a gentle wave.
function wave(count: number) {
  const out = new Float32Array(count * 3);
  const side = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const col = i % side;
    const row = Math.floor(i / side);
    const x = (col / side - 0.5) * 9;
    const z = (row / side - 0.5) * 9;
    const y = -1.2 + Math.sin(x * 1.2) * Math.cos(z * 1.2) * 0.25;
    out.set([x, y, z], i * 3);
  }
  return out;
}

// Draws into a small offscreen canvas and turns the filled pixels into points on a plane.
function fromCanvas(draw: (ctx: CanvasRenderingContext2D, size: number) => void, count: number) {
  const size = 220;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  draw(ctx, size);

  const data = ctx.getImageData(0, 0, size, size).data;
  const filled: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 128) filled.push(x, y);
    }
  }
  if (filled.length === 0) return scatter(count, 4);

  const out = new Float32Array(count * 3);
  const scale = 3.6 / size; // the shape spans about 3.6 world units
  for (let i = 0; i < count; i++) {
    const k = Math.floor(Math.random() * (filled.length / 2)) * 2;
    const x = (filled[k] + Math.random() - size / 2) * scale;
    const y = (size / 2 - filled[k + 1] - Math.random()) * scale;
    out.set([x, y, (Math.random() - 0.5) * 0.25], i * 3);
  }
  return out;
}

// simple-icons paths are drawn on a 24 x 24 grid.
function fromIcon(path: string, count: number) {
  return fromCanvas((ctx, size) => {
    const pad = size * 0.12;
    ctx.translate(pad, pad);
    ctx.scale((size - pad * 2) / 24, (size - pad * 2) / 24);
    ctx.fill(new Path2D(path));
  }, count);
}

function fromText(text: string, count: number) {
  return fromCanvas((ctx, size) => {
    ctx.font = `600 ${text.length > 3 ? size * 0.36 : size * 0.6}px "Bricolage Grotesque Variable", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size / 2, size / 2);
  }, count);
}

// Soft round sprite for each point.
function dotTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
