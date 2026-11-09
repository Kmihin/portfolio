// The 3D scene behind the whole site (Three.js, one fixed full-screen canvas).
//
// A distributed system: glowing nodes joined by thin links, with data packets travelling along them.
// The nodes re-form themselves for every section of the page (a scattered cloud, a globe, stacked
// layers, a lattice, a ring, a helix), and the formation morphs from one to the next as the page
// scrolls. The whole system turns slowly and follows the pointer a little.
//
//   startNetwork(canvas)   builds the scene and starts drawing; stopNetwork() before a page swap
//   setScene(a, b, t)      formation between scene a and scene b, t = 0..1 (motion.ts, on scroll)
//   setProgress(p)         page progress 0..1, turns the system and moves the camera
import * as THREE from "three";

const BG = new THREE.Color("#06090f");
const ACCENT = new THREE.Color("#3ee6ff");
const ACCENT_2 = new THREE.Color("#7a5cff");

/** Formation of the nodes for each scene. */
const SCENES = ["cloud", "sphere", "layers", "lattice", "ring", "helix", "wide", "core"] as const;
type SceneName = (typeof SCENES)[number];

let stop: (() => void) | null = null;
let scene = { a: "cloud" as SceneName, b: "cloud" as SceneName, t: 0 };
let progress = 0;

export function setScene(a: string, b: string, t: number) {
  const ok = (n: string): n is SceneName => (SCENES as readonly string[]).includes(n);
  scene = { a: ok(a) ? a : "cloud", b: ok(b) ? b : "cloud", t: Math.min(Math.max(t, 0), 1) };
}
export function setProgress(p: number) {
  progress = Math.min(Math.max(p, 0), 1);
}
export function stopNetwork() {
  if (stop) stop();
  stop = null;
}

// ---------- Seeded random, so the system looks the same on every visit ----------

let seed = 7;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
function gauss() {
  return (rand() + rand() + rand() - 1.5) * 2;
}

// ---------- Formations: node positions (N * 3) for each scene ----------

function formation(name: SceneName, n: number): Float32Array {
  seed = 7;
  const out = new Float32Array(n * 3);
  const set = (i: number, x: number, y: number, z: number) => out.set([x, y, z], i * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const f = i / n;
    switch (name) {
      case "cloud":
        set(i, gauss() * 14, gauss() * 8, gauss() * 10);
        break;
      case "wide":
        set(i, gauss() * 24, gauss() * 6, gauss() * 8 - 6);
        break;
      case "sphere": {
        const y = 1 - 2 * f;
        const r = Math.sqrt(1 - y * y);
        const a = golden * i;
        set(i, Math.cos(a) * r * 15, y * 15, Math.sin(a) * r * 15);
        break;
      }
      case "core": {
        const y = 1 - 2 * f;
        const r = Math.sqrt(1 - y * y) * (i % 5 === 0 ? 4 : 11);
        const a = golden * i;
        set(i, Math.cos(a) * r, y * (i % 5 === 0 ? 4 : 11), Math.sin(a) * r);
        break;
      }
      case "layers": {
        const layer = i % 3;
        set(i, (rand() - 0.5) * 34, (layer - 1) * 8 + (rand() - 0.5) * 0.6, (rand() - 0.5) * 20);
        break;
      }
      case "lattice": {
        const side = Math.ceil(Math.cbrt(n));
        const x = i % side;
        const y = Math.floor(i / side) % side;
        const z = Math.floor(i / (side * side));
        const s = 30 / (side - 1);
        set(i, (x - (side - 1) / 2) * s, (y - (side - 1) / 2) * s * 0.7, (z - (side - 1) / 2) * s);
        break;
      }
      case "ring": {
        const a = f * Math.PI * 2 * 3;
        const r = 14 + Math.sin(f * Math.PI * 2 * 7) * 2.5;
        set(i, Math.cos(a) * r, Math.sin(a * 2) * 3 + (rand() - 0.5) * 3, Math.sin(a) * r);
        break;
      }
      case "helix": {
        const a = f * Math.PI * 8;
        const strand = i % 2 === 0 ? 0 : Math.PI;
        set(i, Math.cos(a + strand) * 8, (f - 0.5) * 36, Math.sin(a + strand) * 8);
        break;
      }
    }
  }
  return out;
}

/** The links of a formation: every node joined to its k nearest neighbours. Returns E * 6 numbers
 *  (both ends of every link), always the same count, so links can morph between formations. */
function links(points: Float32Array, k: number): Float32Array {
  const n = points.length / 3;
  const out = new Float32Array(n * k * 6);
  const d = new Array<{ i: number; d: number }>(n);
  for (let i = 0; i < n; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    const z = points[i * 3 + 2];
    for (let j = 0; j < n; j++) {
      const dx = points[j * 3] - x;
      const dy = points[j * 3 + 1] - y;
      const dz = points[j * 3 + 2] - z;
      d[j] = { i: j, d: i === j ? Infinity : dx * dx + dy * dy + dz * dz };
    }
    d.sort((p, q) => p.d - q.d);
    for (let m = 0; m < k; m++) {
      const j = d[m].i;
      out.set([x, y, z, points[j * 3], points[j * 3 + 1], points[j * 3 + 2]], (i * k + m) * 6);
    }
  }
  return out;
}

// ---------- Shaders ----------

const nodeVertex = `
  uniform float uPixel;
  uniform float uTime;
  attribute float aSize;
  attribute float aPhase;
  varying float vPulse;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vPulse = 0.6 + 0.4 * sin(uTime * 1.4 + aPhase);
    gl_PointSize = uPixel * aSize * (1.0 + 0.25 * vPulse) * clamp(60.0 / -view.z, 0.3, 2.5);
    gl_Position = projectionMatrix * view;
  }
`;
const nodeFragment = `
  precision highp float;
  uniform vec3 uColor;
  varying float vPulse;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.35, 0.0, d);
    float halo = pow(1.0 - d, 2.2) * 0.55;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.8), (core + halo) * (0.7 + 0.3 * vPulse));
  }
`;

const packetVertex = `
  uniform float uPixel;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uPixel * 2.6 * clamp(60.0 / -view.z, 0.3, 2.5);
    gl_Position = projectionMatrix * view;
  }
`;
const packetFragment = `
  precision highp float;
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.5), pow(1.0 - d, 1.6));
  }
`;

// ---------- Scene ----------

export function startNetwork(canvas: HTMLCanvasElement) {
  stopNetwork();
  const small = window.innerWidth < 768;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.setClearColor(BG, 1);

  const world = new THREE.Scene();
  world.fog = new THREE.Fog(BG, 40, 110);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 200);

  const N = small ? 110 : 170;
  const K = 3;
  const E = N * K;

  // Every formation and its links, computed once.
  const forms = Object.fromEntries(SCENES.map((s) => [s, formation(s, N)])) as Record<SceneName, Float32Array>;
  const edges = Object.fromEntries(SCENES.map((s) => [s, links(forms[s], K)])) as Record<SceneName, Float32Array>;

  const group = new THREE.Group();
  world.add(group);

  // Nodes.
  const nodePos = new Float32Array(forms.cloud);
  const nodeSize = new Float32Array(N);
  const nodePhase = new Float32Array(N);
  seed = 99;
  for (let i = 0; i < N; i++) {
    nodeSize[i] = i % 17 === 0 ? 6 : 2.2 + rand() * 2;
    nodePhase[i] = rand() * Math.PI * 2;
  }
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute("aSize", new THREE.BufferAttribute(nodeSize, 1));
  nodeGeo.setAttribute("aPhase", new THREE.BufferAttribute(nodePhase, 1));
  const nodeUniforms = { uPixel: { value: renderer.getPixelRatio() }, uTime: { value: 0 }, uColor: { value: ACCENT } };
  const nodes = new THREE.Points(
    nodeGeo,
    new THREE.ShaderMaterial({ vertexShader: nodeVertex, fragmentShader: nodeFragment, uniforms: nodeUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  group.add(nodes);

  // Links.
  const edgePos = new Float32Array(edges.cloud);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
  const lines = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(lines);

  // Hubs: a wireframe shell around every HUB_EVERY-th node (the big ones).
  const HUB_EVERY = 17;
  const hubGeo = new THREE.IcosahedronGeometry(1.3, 1);
  const hubMat = new THREE.MeshBasicMaterial({ color: ACCENT_2, wireframe: true, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  const hubs = new THREE.InstancedMesh(hubGeo, hubMat, Math.ceil(N / HUB_EVERY));
  group.add(hubs);
  const hubMatrix = new THREE.Matrix4();
  const hubRot = new THREE.Euler();

  // Packets: each travels along one link, from one end to the other, then picks another link.
  const P = small ? 90 : 160;
  const packetPos = new Float32Array(P * 3);
  const packetEdge = new Int32Array(P);
  const packetT = new Float32Array(P);
  const packetSpeed = new Float32Array(P);
  seed = 5;
  for (let i = 0; i < P; i++) {
    packetEdge[i] = Math.floor(rand() * E);
    packetT[i] = rand();
    packetSpeed[i] = 0.25 + rand() * 0.5;
  }
  const packetGeo = new THREE.BufferGeometry();
  packetGeo.setAttribute("position", new THREE.BufferAttribute(packetPos, 3));
  const packets = new THREE.Points(
    packetGeo,
    new THREE.ShaderMaterial({ vertexShader: packetVertex, fragmentShader: packetFragment, uniforms: { uPixel: { value: renderer.getPixelRatio() }, uColor: { value: ACCENT } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  group.add(packets);

  // Dust far behind, for depth.
  const D = small ? 300 : 700;
  const dustPos = new Float32Array(D * 3);
  for (let i = 0; i < D; i++) dustPos.set([(rand() - 0.5) * 160, (rand() - 0.5) * 100, -20 - rand() * 80], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: ACCENT, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.35, depthWrite: false }));
  world.add(dust);

  // ----- Per frame -----

  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  // The formation eases toward its target, so a fast scroll never snaps.
  const morph = { t: 0 };
  let currentA: SceneName = scene.a;
  let currentB: SceneName = scene.b;

  function blendFormation(dt: number) {
    const target = scene.t * scene.t * (3 - 2 * scene.t);
    if (scene.a !== currentA || scene.b !== currentB) {
      currentA = scene.a;
      currentB = scene.b;
    }
    morph.t += (target - morph.t) * (reduced ? 1 : 1 - Math.pow(0.02, dt));
    const fa = forms[currentA];
    const fb = forms[currentB];
    for (let i = 0; i < nodePos.length; i++) nodePos[i] = fa[i] + (fb[i] - fa[i]) * morph.t;
    const ea = edges[currentA];
    const eb = edges[currentB];
    for (let i = 0; i < edgePos.length; i++) edgePos[i] = ea[i] + (eb[i] - ea[i]) * morph.t;
    nodeGeo.attributes.position.needsUpdate = true;
    edgeGeo.attributes.position.needsUpdate = true;
  }

  function movePackets(dt: number) {
    for (let i = 0; i < P; i++) {
      packetT[i] += dt * packetSpeed[i];
      if (packetT[i] > 1) {
        packetT[i] = 0;
        packetEdge[i] = Math.floor(Math.random() * E);
      }
      const e = packetEdge[i] * 6;
      const t = packetT[i];
      packetPos[i * 3] = edgePos[e] + (edgePos[e + 3] - edgePos[e]) * t;
      packetPos[i * 3 + 1] = edgePos[e + 1] + (edgePos[e + 4] - edgePos[e + 1]) * t;
      packetPos[i * 3 + 2] = edgePos[e + 2] + (edgePos[e + 5] - edgePos[e + 2]) * t;
    }
    packetGeo.attributes.position.needsUpdate = true;
  }

  function placeHubs(time: number) {
    let h = 0;
    for (let i = 0; i < N; i += HUB_EVERY) {
      hubRot.set(time * 0.3 + i, time * 0.2, 0);
      hubMatrix.makeRotationFromEuler(hubRot);
      hubMatrix.setPosition(nodePos[i * 3], nodePos[i * 3 + 1], nodePos[i * 3 + 2]);
      hubs.setMatrixAt(h++, hubMatrix);
    }
    hubs.instanceMatrix.needsUpdate = true;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 58 : 42;
    camera.updateProjectionMatrix();
  }

  let frameId = 0;
  let last = performance.now();
  let time = 0;
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!reduced) time += dt;
    nodeUniforms.uTime.value = time;

    blendFormation(dt);
    movePackets(reduced ? 0 : dt);
    placeHubs(time);

    // The system turns with the scroll and slowly on its own; the pointer tilts it.
    tilt.x += (pointer.x - tilt.x) * (reduced ? 1 : 0.05);
    tilt.y += (pointer.y - tilt.y) * (reduced ? 1 : 0.05);
    group.rotation.y = progress * Math.PI * 1.6 + time * 0.04 + tilt.x * 0.35;
    group.rotation.x = Math.sin(progress * Math.PI) * 0.35 - tilt.y * 0.25;
    // The camera drifts closer in the middle of the page, out again at the end.
    camera.position.set(0, 2, 52 - Math.sin(progress * Math.PI) * 14);
    camera.lookAt(0, 0, 0);
    dust.rotation.y = time * 0.01;

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
    [nodeGeo, edgeGeo, hubGeo, packetGeo, dustGeo].forEach((g) => g.dispose());
    [nodes.material, lines.material, hubMat, packets.material, dust.material].forEach((m) => (m as THREE.Material).dispose());
    renderer.dispose();
  };
}
