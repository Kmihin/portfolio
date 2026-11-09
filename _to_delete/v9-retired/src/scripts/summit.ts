// The 3D landscape behind the whole site (Three.js, one fixed full-screen canvas).
//
// A mountain range of navy rock with thin gold veins and snow on the peaks, rising out of mist that
// fades into the ivory sky, with gold dust drifting in the air. The camera flies through it as the
// page scrolls: every section names a stop (data-stop="hero" ...), and between two sections the
// camera moves smoothly from one stop to the next. The pointer turns the view a little.
//
//   startSummit(canvas)   builds the scene and starts drawing; call stopSummit() before a page swap
//   setFlight(a, b, t)    camera between stop a and stop b, t = 0..1 (motion.ts calls this on scroll)
//
// The terrain heights are computed once on the CPU (ridged gradient noise); the colours, veins,
// snow, light and mist are worked out per pixel in the shader below.
import * as THREE from "three";

// The shader writes the colours as given (no linear conversion), like the rest of the site's palette.
THREE.ColorManagement.enabled = false;

const SKY = new THREE.Color("#f3ece0");

/** Camera stops: where the camera is and where it looks, in world units (x right, y up, -z ahead). */
const STOPS: Record<string, { pos: [number, number, number]; look: [number, number, number] }> = {
  hero: { pos: [9, 13, 40], look: [4, 19, -60] },
  about: { pos: [6, 20, 24], look: [-4, 12, -80] },
  facts: { pos: [1, 34, 6], look: [-2, 22, -100] },
  work: { pos: [-3, 27, -10], look: [-12, 16, -110] },
  skills: { pos: [-8, 31, -26], look: [4, 20, -125] },
  offer: { pos: [-10, 35, -40], look: [-2, 24, -140] },
  closing: { pos: [-9, 45, -50], look: [0, 34, -150] },
  contact: { pos: [-6, 24, -62], look: [10, 14, -160] },
  detail: { pos: [0, 34, 30], look: [0, 23, -80] },
};

let stop: (() => void) | null = null;
let flight = { a: "hero", b: "hero", t: 0 };

export function setFlight(a: string, b: string, t: number) {
  flight = { a: STOPS[a] ? a : "hero", b: STOPS[b] ? b : "hero", t: Math.min(Math.max(t, 0), 1) };
}

export function stopSummit() {
  if (stop) stop();
  stop = null;
}

// ---------- Noise (2D gradient noise, seeded, for the terrain heights) ----------

const perm = new Uint8Array(512);
(function seed() {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();

function grad(h: number, x: number, y: number) {
  const a = (h & 7) * (Math.PI / 4);
  return Math.cos(a) * x + Math.sin(a) * y;
}
function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = perm[perm[xi] + yi];
  const ab = perm[perm[xi] + yi + 1];
  const ba = perm[perm[xi + 1] + yi];
  const bb = perm[perm[xi + 1] + yi + 1];
  const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
  const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
  return x1 + v * (x2 - x1); // about -0.7..0.7
}

/** Ridged noise: sharp crests where the noise crosses zero, several octaves. 0..1 */
function ridged(x: number, y: number) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let prev = 1;
  for (let i = 0; i < 6; i++) {
    let n = 1 - Math.abs(noise(x * freq, y * freq) * 1.4);
    n = n * n;
    sum += n * amp * prev;
    prev = n;
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** Height of the land at a point. A winding valley runs along the camera's flight; the ranges
 *  grow taller with distance and to the sides. */
function height(x: number, z: number) {
  const valleyX = Math.sin(z * 0.035) * 10;
  const side = Math.min(Math.abs(x - valleyX) / 26, 1);
  const far = Math.min(Math.max(-z / 140, 0), 1);
  const peaks = ridged(x * 0.022 + 7.3, z * 0.022 - 3.1);
  const hills = noise(x * 0.06, z * 0.06) * 2.5;
  return peaks * (12 + far * 14) * (0.3 + side * 0.9) + hills - 2;
}

// ---------- Shaders ----------

const terrainVertex = `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 view = viewMatrix * world;
    vDepth = -view.z;
    gl_Position = projectionMatrix * view;
  }
`;

const terrainFragment = `
  precision highp float;
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDepth;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.07 + 13.1; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 n = normalize(vNormal);
    float steep = 1.0 - n.y;                       // 0 flat, 1 a cliff
    float light = max(dot(n, uSun), 0.0);
    float ambient = 0.35 + 0.25 * n.y;

    // Rock: deep navy in shadow, slate blue where the sun reaches, with fine strata.
    float strata = fbm(vec2(vWorld.x * 0.3, vWorld.y * 2.2));
    vec3 navy = vec3(0.035, 0.06, 0.115);
    vec3 slate = vec3(0.21, 0.28, 0.41);
    vec3 rock = mix(navy, slate, clamp(light * 0.85 + strata * 0.25, 0.0, 1.0));
    rock *= ambient + light * 0.75;

    // Snow on the high, gentle slopes; a blue cast on its shaded side.
    float snowLine = 9.0 + fbm(vWorld.xz * 0.08) * 10.0;
    float snow = smoothstep(snowLine, snowLine + 3.0, vWorld.y) * smoothstep(0.62, 0.35, steep);
    vec3 snowColor = mix(vec3(0.70, 0.75, 0.84), vec3(0.98, 0.96, 0.92), light);
    vec3 color = mix(rock, snowColor, snow);

    // Gold veins: thin lines where a second noise field crosses its middle, only in the rock.
    // fwidth keeps them about a pixel wide at any distance.
    float field = fbm(vWorld.xz * 0.03 + vec2(vWorld.y * 0.02)) - 0.5;
    float vein = 1.0 - smoothstep(0.0, fwidth(field) * 1.3, abs(field));
    vec3 gold = vec3(0.79, 0.66, 0.42) * (0.7 + light * 0.6);
    color = mix(color, gold, vein * (1.0 - snow) * 0.95);

    // Mist in the valleys, drifting slowly, the colour of the sky.
    float mist = smoothstep(4.0, -2.0, vWorld.y + (fbm(vWorld.xz * 0.05 + uTime * 0.02) - 0.5) * 6.0);
    color = mix(color, uSky, mist * 0.85);

    // Distance fog into the ivory sky, so the far ranges fade like ink on paper.
    float fog = 1.0 - exp(-pow(vDepth * 0.008, 1.6));
    color = mix(color, uSky, clamp(fog, 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const dustVertex = `
  uniform float uTime;
  uniform float uPixel;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y += mod(uTime * (0.25 + aSeed * 0.4) + aSeed * 40.0, 40.0) - 20.0;
    p.x += sin(uTime * 0.2 + aSeed * 6.28) * 1.5;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uPixel * (0.8 + aSeed * 1.2) * clamp(30.0 / -view.z, 0.35, 1.3);
    vAlpha = (0.35 + aSeed * 0.5) * smoothstep(160.0, 40.0, -view.z);
  }
`;

const dustFragment = `
  precision highp float;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    gl_FragColor = vec4(0.79, 0.64, 0.38, vAlpha * smoothstep(0.5, 0.1, d));
  }
`;

// ---------- Scene ----------

export function startSummit(canvas: HTMLCanvasElement) {
  stopSummit();
  const small = window.innerWidth < 768;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.setClearColor(SKY, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);

  // Terrain: a grid of heights, finer on wide screens.
  const segments = small ? 160 : 260;
  const geometry = new THREE.PlaneGeometry(240, 260, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -90);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geometry.computeVertexNormals();

  const uniforms = {
    uSky: { value: SKY.clone() },
    uSun: { value: new THREE.Vector3(-0.55, 0.62, -0.55).normalize() },
    uTime: { value: 0 },
  };
  const terrain = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: terrainFragment, uniforms }));
  scene.add(terrain);

  // Gold dust in the air along the flight.
  const dustCount = small ? 700 : 1600;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos.set([(Math.random() - 0.5) * 90, 6 + Math.random() * 40, 40 - Math.random() * 190], i * 3);
    dustSeed[i] = Math.random();
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeometry.setAttribute("aSeed", new THREE.BufferAttribute(dustSeed, 1));
  const dustUniforms = { uTime: { value: 0 }, uPixel: { value: renderer.getPixelRatio() * 2.2 } };
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.ShaderMaterial({ vertexShader: dustVertex, fragmentShader: dustFragment, uniforms: dustUniforms, transparent: true, depthWrite: false })
  );
  scene.add(dust);

  // Camera state, eased toward the flight's target every frame.
  // On load it arrives from lower and further back, a short flight into the first view.
  const camPos = new THREE.Vector3(...STOPS[flight.a].pos).add(reduced ? new THREE.Vector3() : new THREE.Vector3(0, -5, 26));
  const camLook = new THREE.Vector3(...STOPS[flight.a].look).add(reduced ? new THREE.Vector3() : new THREE.Vector3(0, -8, 0));
  const targetPos = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };

  function target() {
    const a = STOPS[flight.a];
    const b = STOPS[flight.b];
    const t = flight.t * flight.t * (3 - 2 * flight.t);
    targetPos.set(a.pos[0], a.pos[1], a.pos[2]).lerp(new THREE.Vector3(...b.pos), t);
    targetLook.set(a.look[0], a.look[1], a.look[2]).lerp(new THREE.Vector3(...b.look), t);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Narrow screens get a wider lens, so the range still fills the view.
    camera.fov = w < h ? 62 : 50;
    camera.updateProjectionMatrix();
  }

  let frameId = 0;
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!reduced) {
      uniforms.uTime.value += dt;
      dustUniforms.uTime.value += dt;
    }
    target();
    const ease = reduced ? 1 : 1 - Math.pow(0.08, dt);
    camPos.lerp(targetPos, ease);
    camLook.lerp(targetLook, ease);
    tilt.x += (pointer.x - tilt.x) * (reduced ? 1 : 0.04);
    tilt.y += (pointer.y - tilt.y) * (reduced ? 1 : 0.04);
    camera.position.set(camPos.x + tilt.x * 2.5, camPos.y + tilt.y * 1.2, camPos.z);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(frame);
  }

  function onPointer(e: PointerEvent) {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = 0.5 - e.clientY / window.innerHeight;
  }
  // Stop drawing while the tab is hidden.
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
    dustGeometry.dispose();
    (terrain.material as THREE.Material).dispose();
    (dust.material as THREE.Material).dispose();
    renderer.dispose();
  };
}
