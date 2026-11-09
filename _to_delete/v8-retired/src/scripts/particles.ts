// Gold particle cloud rendered with Three.js.
// The cloud morphs between shapes as `setProgress(0..2)` is called from the scroll timeline,
// and tilts gently toward the cursor.
import * as THREE from "three";

const SHAPES = 3; // sphere -> ring -> grid
const GOLD = new THREE.Color("#c9a24a");
const GOLD_SOFT = new THREE.Color("#e8d7a8");

let progress = 0;      // 0 = sphere, 1 = ring, 2 = grid
let mouseX = 0;        // -1..1
let mouseY = 0;        // -1..1

export function setProgress(value: number) {
  progress = value;
}

export function startParticles(canvas: HTMLCanvasElement) {
  const small = window.innerWidth < 768;
  const count = small ? 6000 : 16000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 7;

  // One position array per shape; the current positions are lerped between them each frame.
  const shapes = [sphere(count), ring(count), grid(count)];
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = Math.random() < 0.3 ? GOLD_SOFT : GOLD;
    colors.set([c.r, c.g, c.b], i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: small ? 0.035 : 0.028,
    map: dotTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame(time: number) {
    // which two shapes are we between, and how far
    const from = Math.min(Math.floor(progress), SHAPES - 2);
    const t = ease(Math.min(Math.max(progress - from, 0), 1));
    const a = shapes[from];
    const b = shapes[from + 1];
    for (let i = 0; i < positions.length; i++) {
      positions[i] = a[i] + (b[i] - a[i]) * t;
    }
    geometry.attributes.position.needsUpdate = true;

    points.rotation.y = time * 0.00008 + mouseX * 0.35;
    points.rotation.x = mouseY * 0.25;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  resize();
  requestAnimationFrame(frame);
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Points spread evenly over a sphere surface, with a little depth jitter.
function sphere(count: number) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
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

// A flat grid in perspective, like a floor plane.
function grid(count: number) {
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

// Soft round sprite for each point.
function dotTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
