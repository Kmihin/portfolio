// The 3D scene behind the whole site (Three.js, one fixed full-screen canvas).
//
// One object: a sphere of about 320 iridescent crystal shards (one instanced mesh). It breaks apart
// and re-forms into a different structure for every scene of the page: the whole core, a burst, a
// shell, a ring, a tunnel the camera flies through, a lattice, a helix, and the core again. Each
// scene also moves the camera from a start to an end position as its section scrolls. Dust drifts
// in the dark, a cyan light follows the pointer and reveals the shards it passes, and a bloom pass
// makes the highlights glow.
//
//   startCore(canvas, onReady)  builds the scene, draws the first frame, calls onReady
//   stopCore()                  before a page swap
//   setScene(name, t)           the current scene and how far its section has scrolled, t = 0..1
//   setPointer(x, y)            pointer position, -0.5..0.5 each (motion.ts)
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const BG = new THREE.Color("#05060a");

type Vec = [number, number, number];
/** A scene: which shard structure, and the camera's start and end position over the section. */
const SCENES: Record<string, { form: string; from: Vec; to: Vec; look?: Vec }> = {
  hero: { form: "core", from: [0, 0, 10.5], to: [0.6, 0.3, 8], look: [-2.4, 0.2, 0] },
  about: { form: "shell", from: [0, 0.5, 14], to: [0, 0.2, 12], look: [-3.2, 0, 0] },
  facts: { form: "ring", from: [0, 7, 14], to: [0, 2.5, 12] },
  work: { form: "tunnel", from: [0, 0, 6], to: [0, 0, -34] },
  skills: { form: "lattice", from: [0, 0, 19], to: [0, 0, 16] },
  offer: { form: "helix", from: [0, 1, 17], to: [0, -1, 15], look: [-3.5, 0, 0] },
  closing: { form: "burst", from: [0, 0, 30], to: [0, 0, 20] },
  contact: { form: "core", from: [0, 0, 10], to: [0, 0, 8] },
  detail: { form: "shell", from: [0, 1, 16], to: [0, 0.5, 15], look: [-3.5, 0, 0] },
};
const FIRST = "hero";

let stop: (() => void) | null = null;
let current = { name: FIRST, t: 0 };
const pointer = { x: 0, y: 0 };

export function setScene(name: string, t: number) {
  current = { name: SCENES[name] ? name : FIRST, t: Math.min(Math.max(t, 0), 1) };
}
export function setPointer(x: number, y: number) {
  pointer.x = x;
  pointer.y = y;
}
export function stopCore() {
  if (stop) stop();
  stop = null;
}

// Seeded random, so the structures are the same on every visit.
let seed = 11;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

const UP = new THREE.Vector3(0, 1, 0);
/** Position and orientation of every shard in a structure. */
type Form = { pos: Float32Array; rot: Float32Array };

function buildForms(normals: THREE.Vector3[]): Record<string, Form> {
  const n = normals.length;
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const forms: Record<string, Form> = {};
  const make = (name: string, place: (i: number, out: THREE.Vector3) => THREE.Vector3) => {
    seed = 11;
    const pos = new Float32Array(n * 3);
    const rot = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const axis = place(i, v);
      pos.set([v.x, v.y, v.z], i * 3);
      q.setFromUnitVectors(UP, axis.normalize());
      rot.set([q.x, q.y, q.z, q.w], i * 4);
    }
    forms[name] = { pos, rot };
  };
  const golden = Math.PI * (3 - Math.sqrt(5));
  const dir = new THREE.Vector3();

  // The whole sphere: every shard's tip at the centre, pointing out along its face normal.
  make("core", (i, out) => {
    out.set(0, 0, 0);
    return dir.copy(normals[i]);
  });
  // Flung outwards along the normals, a little tumbled.
  make("burst", (i, out) => {
    const d = 2.5 + rand() * 4;
    out.copy(normals[i]).multiplyScalar(d);
    return dir.copy(normals[i]).add(new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.8));
  });
  // A loose shell around a hollow centre, shards lying flat on it.
  make("shell", (i, out) => {
    out.copy(normals[i]).multiplyScalar(2.8 + (rand() - 0.5) * 0.6);
    return dir.copy(normals[i]);
  });
  // A ring, shards pointing outward from the tube.
  make("ring", (i, out) => {
    const a = (i / n) * Math.PI * 2;
    const b = rand() * Math.PI * 2;
    const R = 3.6;
    const r = 0.7;
    const cx = Math.cos(a) * R;
    const cz = Math.sin(a) * R;
    out.set(cx + Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, cz + Math.sin(a) * Math.cos(b) * r);
    return dir.set(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
  });
  // A tunnel along -z, the shards on its wall pointing inward.
  make("tunnel", (i, out) => {
    const a = i * golden * 3;
    const r = 4.2 + (rand() - 0.5) * 0.8;
    const z = 8 - (i / n) * 50;
    out.set(Math.cos(a) * r, Math.sin(a) * r, z);
    return dir.set(-Math.cos(a), -Math.sin(a), 0);
  });
  // A flat lattice facing the camera.
  make("lattice", (i, out) => {
    const side = Math.ceil(Math.sqrt(n));
    const x = (i % side) - (side - 1) / 2;
    const y = Math.floor(i / side) - (side - 1) / 2;
    out.set(x * 0.55, y * 0.55, -2 + Math.sin(x * 0.7) * Math.cos(y * 0.7) * 0.6);
    return dir.set(0, 0, 1);
  });
  // A double helix.
  make("helix", (i, out) => {
    const a = (i / n) * Math.PI * 7 + (i % 2) * Math.PI;
    const y = (i / n - 0.5) * 11;
    out.set(Math.cos(a) * 1.6, y, Math.sin(a) * 1.6);
    return dir.set(Math.cos(a), 0, Math.sin(a));
  });
  return forms;
}

export function startCore(canvas: HTMLCanvasElement, onReady?: () => void) {
  stopCore();
  const small = window.innerWidth < 768;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const world = new THREE.Scene();
  world.fog = new THREE.FogExp2(BG.getHex(), 0.02);
  // A neutral studio environment gives the shards something to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  world.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);

  // The shards: one instanced crystal per face of a subdivided icosahedron.
  const sphere = new THREE.IcosahedronGeometry(1.7, 3);
  const posAttr = sphere.attributes.position;
  const normals: THREE.Vector3[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i += 3) {
    a.fromBufferAttribute(posAttr, i);
    b.fromBufferAttribute(posAttr, i + 1);
    c.fromBufferAttribute(posAttr, i + 2);
    normals.push(a.add(b).add(c).divideScalar(3).normalize().clone());
  }
  sphere.dispose();
  const N = normals.length;
  // Each shard is a slim three-sided pyramid, its tip at the origin and its base 1.7 out.
  const faceRadius = 0.24;
  const shardGeo = new THREE.ConeGeometry(faceRadius, 1.7, 3, 1);
  shardGeo.translate(0, 0.85, 0);
  shardGeo.rotateX(Math.PI); // tip at the origin, base along +y
  shardGeo.translate(0, 1.7, 0);
  const shardMat = new THREE.MeshPhysicalMaterial({
    color: 0x33459c,
    metalness: 0.7,
    roughness: 0.25,
    iridescence: 1,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [120, 520],
    envMapIntensity: 0.9,
    flatShading: true,
  });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, N);
  shards.frustumCulled = false; // the structures reach far beyond the geometry's own bounds
  world.add(shards);

  const forms = buildForms(normals);
  const curPos = new Float32Array(forms.core.pos);
  const curRot = new Float32Array(forms.core.rot);
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  function placeShards(dt: number, time: number) {
    const target = forms[SCENES[current.name].form];
    const ease = reduced ? 1 : 1 - Math.pow(0.004, dt);
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      curPos[i3] += (target.pos[i3] - curPos[i3]) * ease;
      curPos[i3 + 1] += (target.pos[i3 + 1] - curPos[i3 + 1]) * ease;
      curPos[i3 + 2] += (target.pos[i3 + 2] - curPos[i3 + 2]) * ease;
      qa.set(curRot[i4], curRot[i4 + 1], curRot[i4 + 2], curRot[i4 + 3]);
      qb.set(target.rot[i4], target.rot[i4 + 1], target.rot[i4 + 2], target.rot[i4 + 3]);
      qa.slerp(qb, ease);
      curRot.set([qa.x, qa.y, qa.z, qa.w], i4);
      // A slow breath, so the core is never quite still.
      const breathe = reduced ? 0 : 0.03 * Math.sin(time * 0.8 + i * 0.37);
      pos.set(curPos[i3], curPos[i3 + 1], curPos[i3 + 2]).multiplyScalar(1 + breathe);
      matrix.compose(pos, qa, one);
      shards.setMatrixAt(i, matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
  }

  // Lights: a cool key, a warm rim, and the cyan light that follows the pointer.
  world.add(new THREE.AmbientLight(0x3a4466, 0.8));
  const key = new THREE.DirectionalLight(0xdfe8ff, 2.0);
  key.position.set(4, 6, 5);
  world.add(key);
  const rim = new THREE.DirectionalLight(0xff8a65, 1.6);
  rim.position.set(-6, -2, -4);
  world.add(rim);
  const cursorLight = new THREE.PointLight(0x3ee6ff, 60, 16, 2);
  world.add(cursorLight);

  // Dust: faint points drifting through the dark.
  const D = small ? 500 : 1200;
  const dustPos = new Float32Array(D * 3);
  seed = 3;
  for (let i = 0; i < D; i++) dustPos.set([(rand() - 0.5) * 50, (rand() - 0.5) * 30, 10 - rand() * 70], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false }));
  world.add(dust);

  // Post: render, bloom on the highlights, output.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), small ? 0.45 : 0.6, 0.6, 0.7);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Camera: eased toward the scene's position for its progress, tilted a little by the pointer.
  const camPos = new THREE.Vector3(...SCENES[FIRST].from);
  const camTarget = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tilt = { x: 0, y: 0 };
  const lightTarget = new THREE.Vector3();

  function placeCamera(dt: number) {
    const s = SCENES[current.name];
    const t = current.t * current.t * (3 - 2 * current.t);
    camTarget.set(s.from[0] + (s.to[0] - s.from[0]) * t, s.from[1] + (s.to[1] - s.from[1]) * t, s.from[2] + (s.to[2] - s.from[2]) * t);
    camPos.lerp(camTarget, reduced ? 1 : 1 - Math.pow(0.02, dt));
    tilt.x += (pointer.x - tilt.x) * (reduced ? 1 : 0.06);
    tilt.y += (pointer.y - tilt.y) * (reduced ? 1 : 0.06);
    camera.position.set(camPos.x + tilt.x * 0.8, camPos.y + tilt.y * 0.5, camPos.z);
    // In the tunnel the camera looks ahead; elsewhere at the centre, or at the scene's own point
    // (a point left of the object puts the object on the right of the screen, beside the text).
    if (s.form === "tunnel") look.set(0, 0, camPos.z - 10);
    else if (s.look) look.set(small ? 0 : s.look[0], s.look[1], s.look[2]); // phones: centred
    else look.set(0, 0, 0);
    camera.lookAt(look);
    // The cursor light sits in front of the camera, where the pointer is.
    lightTarget.set(tilt.x * 10, tilt.y * 6, -4).applyQuaternion(camera.quaternion).add(camera.position);
    cursorLight.position.lerp(lightTarget, 0.2);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 55 : 40;
    camera.updateProjectionMatrix();
  }

  let frameId = 0;
  let last = performance.now();
  let time = 0;
  let ready = false;
  function frame(now: number) {
    // The frame timestamp can be a little behind performance.now(): never let dt go negative.
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
    last = now;
    if (!reduced) time += dt;
    placeShards(dt, time);
    placeCamera(dt);
    dust.rotation.y = time * 0.01;
    composer.render();
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
  frameId = requestAnimationFrame(frame);

  stop = () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    shardGeo.dispose();
    shardMat.dispose();
    dustGeo.dispose();
    (dust.material as THREE.Material).dispose();
    composer.dispose();
    renderer.dispose();
  };
}
