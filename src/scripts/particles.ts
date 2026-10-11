// Full-page particle layer rendered with Three.js, fixed over the background material and behind the content.
//
// Shapes are looked up by name: abstract forms (scatter, sphere, ring, wave), technology marks
// (icons from simple-icons, lettering where the set has no icon) and scenes drawn in shapes.ts.
// "a+b" or "a+b+c" is a cluster: the parts shown together, smaller, side by side or in a triangle.
// "field" is a star field covering the whole screen. "galaxy" is the opening scene: a spiral galaxy
// behind the photo and the name. "globe" is a slowly turning
// globe in the middle of the screen.
//   setAnchor(el)   the cloud sits in the middle of `el` and is scaled to fit it, and follows it as
//                   the page scrolls, so a section's scene leaves with its section. null = the
//                   cloud is placed in screen coordinates (the pinned intro).
//   setBlend(from, to, t, fromX, toX, currents)
//       show shape `from` at x = fromX blended toward shape `to` at x = toX by t (0..1).
//       `from` may be "current": whatever the cloud shows at that moment is frozen and used as the
//       starting shape, so a new motion can begin from any state without a jump.
//       Points do not all move at once: they peel off from the edge nearest the destination and
//       travel along curved paths, grouped into `currents` bands, so a change of scene looks like
//       particles flowing across the screen into the new shape while the text appears.
//   setTint(0..1)   0 = midnight dots (for ivory chapters), 1 = brass dots (for midnight chapters)
// The cloud tilts toward the cursor with an eased motion and the points ripple gently like water.
import * as THREE from "three";
import { siDotnet, siReact, siTypescript, siAngular, siDocker, siSupabase, siPostgresql } from "simple-icons";
import { scenes } from "./shapes";

// Height of the visible area at z = 0 in world units (45 degree camera at z = 7.5).
const VIEW_H = 2 * 7.5 * Math.tan((45 / 2) * (Math.PI / 180));
// Width and height a single scene is drawn at (fromCanvas) and a cluster spans.
const SCENE_SIZE = 4;

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

const MIDNIGHT = new THREE.Color("#1a2748");
const BRASS = new THREE.Color("#d8b97c");

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
// Copies the positions on screen into the "current" shape (set up by startParticles).
let snapshot: (() => void) | null = null;
let anchor: HTMLElement | null = null;
let spin = 0; // how far the globe has turned
let fade = 1; // 0..1, multiplies the cloud's opacity (a chapter taking the cloud over fades it)

export function setFade(value: number) {
  fade = Math.min(Math.max(value, 0), 1);
}

export function setAnchor(el: HTMLElement | null) {
  anchor = el;
}

/** Freezes what the cloud shows now as the "current" shape. Call it before a motion that starts from "current". */
export function freezeCloud() {
  snapshot?.();
}

export function setBlend(from: string, to: string, t: number, xFrom = 0, xTo = 0, bands = 2) {
  if (from === "current" && fromName !== "current") freezeCloud();
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
  const count = small ? 8000 : 20000;

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
    else if (name === "galaxy") s = galaxy(count);
    else if (name === "globe") s = globe(count);
    else if (marks[name]) s = marks[name].icon ? fromIcon(marks[name].icon!.path, count) : fromText(marks[name].text!, count);
    else if (scenes[name]) s = fromCanvas(scenes[name], count);
    else s = scatter(count, 8);
    cache.set(name, s);
    return s;
  }

  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  // Where the cloud sits for the current anchor: centre (in world units) and scale. An anchor with
  // data-cloud-fit="none" keeps the scenes at their own size (the intro, which fills the screen).
  function anchorTarget() {
    if (!anchor) return { x: 0, y: 0, s: 1 };
    const r = anchor.getBoundingClientRect();
    const k = VIEW_H / window.innerHeight;
    const fit = anchor.dataset.cloudFit === "none" ? 1 : Math.min(Math.max((Math.min(r.width, r.height) * k) / SCENE_SIZE, 0.45), 1.1);
    return { x: (r.left + r.width / 2 - window.innerWidth / 2) * k, y: -(r.top + r.height / 2 - window.innerHeight / 2) * k, s: fit };
  }

  // Freezes what is on screen as the "current" shape, expressed in the frame of the current anchor,
  // and moves the cloud to that anchor at once. The points do not move on screen when this happens;
  // the next blend then carries them from exactly where they are into the new scene.
  snapshot = () => {
    const t = anchorTarget();
    const frozen = positions.slice();
    for (let i = 0; i < count; i++) {
      frozen[i * 3] = (positions[i * 3] * points.scale.x + points.position.x - t.x) / t.s;
      frozen[i * 3 + 1] = (positions[i * 3 + 1] * points.scale.y + points.position.y - t.y) / t.s;
    }
    cache.set("current", frozen);
    points.position.set(t.x, t.y, 0);
    points.scale.setScalar(t.s);
  };

  const material = new THREE.PointsMaterial({
    size: small ? 0.04 : 0.03,
    map: dotTexture(),
    color: BRASS.clone(),
    transparent: true,
    opacity: small ? 0.42 : 0.8,
    depthWrite: false,
  });

  const baseOpacity = material.opacity;
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Placed for the screen shape, so rebuilt for the new one.

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
      positions[j + 1] = a[j + 1] + (b[j + 1] - a[j + 1]) * t + arc + Math.sin(x * 1.4 + s) * Math.cos(z * 1.1 + s * 0.7) * 0.015;
      positions[j + 2] = z;
    }
    geometry.attributes.position.needsUpdate = true;

    // Follow the anchor exactly, so the scene moves with its section like the text does.
    const target = anchorTarget();
    points.position.set(target.x, target.y, 0);
    points.scale.setScalar(target.s);

    // Ease toward the pointer.
    tiltX += (mouseX - tiltX) * 0.05;
    tiltY += (mouseY - tiltY) * 0.05;
    // The globe turns slowly; the turn fades in and out with the globe itself.
    const globeWeight = (toName === "globe" ? blend : 0) + (fromName === "globe" ? 1 - blend : 0);
    spin = globeWeight > 0 ? spin + 0.0015 : 0;
    points.rotation.y = tiltX * 0.3 + globeWeight * spin;
    points.rotation.x = tiltY * 0.2;

    material.color.copy(MIDNIGHT).lerp(BRASS, tint);
    material.opacity = baseOpacity * fade;

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
    anchor = null;
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    snapshot = null;
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

// A spiral galaxy seen at an angle: a bright core, three arms that wind out and thin toward the
// edge, stars scattered between them, the disk tipped toward the viewer. Large and centred a little
// right, so it sits behind the photo and the name like a night sky.
function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}
function galaxy(count: number) {
  const out = new Float32Array(count * 3);
  const tilt = 1.05; // radians the disk is tipped toward the viewer
  const cx = 1.2;
  const cy = 0.4;
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    let z: number;
    if (i % 7 === 0) {
      // the core: a dense, slightly flattened ball
      x = gauss() * 0.7;
      y = gauss() * 0.35;
      z = gauss() * 0.7;
    } else {
      const arm = i % 3;
      const r = 0.4 + Math.pow(Math.random(), 1.4) * 6.2;
      const angle = arm * ((Math.PI * 2) / 3) + Math.log(r) * 2.2 + gauss() * (0.55 / Math.sqrt(r));
      const spread = 0.12 + r * 0.05;
      x = Math.cos(angle) * r + gauss() * spread;
      z = Math.sin(angle) * r + gauss() * spread;
      y = gauss() * 0.12 * (1 - r / 7);
    }
    out.set([cx + x, cy + y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)], i * 3);
  }
  return out;
}

// A globe: meridians and parallels on a sphere, with a light dusting on its surface, in the middle
// of the screen behind the figures.
function globe(count: number) {
  const out = new Float32Array(count * 3);
  const r = 2.4;
  const centerY = -0.1;
  for (let i = 0; i < count; i++) {
    let lat: number;
    let lon: number;
    const kind = i % 10;
    if (kind < 4) {
      lon = Math.floor(Math.random() * 16) * ((Math.PI * 2) / 16); // on a meridian
      lat = Math.asin(2 * Math.random() - 1);
    } else if (kind < 8) {
      lat = (Math.floor(Math.random() * 9) - 4) * (Math.PI / 10); // on a parallel
      lon = Math.random() * Math.PI * 2;
    } else {
      lat = Math.asin(2 * Math.random() - 1); // anywhere on the surface
      lon = Math.random() * Math.PI * 2;
    }
    const x = r * Math.cos(lat) * Math.cos(lon);
    const z = r * Math.cos(lat) * Math.sin(lon);
    // Tip the axis toward the viewer a little.
    const tilt = 0.35;
    const y = r * Math.sin(lat);
    out.set([x, centerY + y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)], i * 3);
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
  const size = 360;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  draw(ctx, size);

  // Filled pixels, and the ones on the edge of the shape (a filled pixel next to an empty one).
  const data = ctx.getImageData(0, 0, size, size).data;
  const isFilled = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && data[(y * size + x) * 4 + 3] > 128;
  const filled: number[] = [];
  const edge: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFilled(x, y)) continue;
      filled.push(x, y);
      if (!isFilled(x - 1, y) || !isFilled(x + 1, y) || !isFilled(x, y - 1) || !isFilled(x, y + 1)) edge.push(x, y);
    }
  }
  if (filled.length === 0) return scatter(count, 4);

  // A third of the points trace the edges, so the shape reads crisp; the rest fill it.
  const out = new Float32Array(count * 3);
  const scale = 3.6 / size; // the shape spans about 3.6 world units
  for (let i = 0; i < count; i++) {
    const list = i % 3 === 0 && edge.length ? edge : filled;
    const k = Math.floor(Math.random() * (list.length / 2)) * 2;
    const x = (list[k] + Math.random() - size / 2) * scale;
    const y = (size / 2 - list[k + 1] - Math.random()) * scale;
    out.set([x, y, (Math.random() - 0.5) * 0.06], i * 3);
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
    ctx.font = `600 ${text.length > 3 ? size * 0.3 : size * 0.52}px "Geist Variable", sans-serif`;
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
