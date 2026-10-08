// Full-page silk background rendered with a small WebGL shader (Three.js full-screen quad).
// Two colours, smoked plum and silk beige, are woven through each other by layered noise.
//   setMix(0..1)   0 = beige field with plum threads, 1 = plum field with beige threads.
//                  Sections set a target as they scroll in; the value eases toward it.
//   setScroll(px)  the weave drifts with the page so it feels attached to the content.
// Pointer position bends the threads slightly. Runs behind everything, fixed, pointer-events none.
import * as THREE from "three";

// The shader writes colours straight to the screen, so keep the hex values as given (no linear conversion).
THREE.ColorManagement.enabled = false;

const vertexShader = `
  void main() { gl_Position = vec4(position, 1.0); }
`;

const fragmentShader = `
  precision highp float;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uMix;
  uniform float uScroll;
  uniform vec2 uPointer;
  uniform vec3 uPlum;
  uniform vec3 uPlumDeep;
  uniform vec3 uBeige;
  uniform vec3 uBeigeLight;

  // Hash and value noise, enough for soft fabric-like folds.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++) { v += amp * noise(p); p = p * 2.03 + 11.7; amp *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.04;
    // The weave drifts up as the page scrolls down, and bends toward the pointer.
    p.y += uScroll * 0.00030;
    p += (uPointer - 0.5) * 0.10;

    // Rotate a little and stretch along x so the folds run as long diagonal bands, like draped fabric.
    float c = cos(0.35), s = sin(0.35);
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    p.x *= 0.38;

    // Gentle domain warp: folds that bend, never blobs.
    vec2 q = vec2(fbm(p * 1.2 + t * 0.5), fbm(p * 1.2 - t * 0.35 + 3.1));
    float folds = fbm(p * 1.5 + q * 0.9 + vec2(t * 0.4, -t * 0.25));

    // Fine ripple across the folds gives the sheen of silk.
    float ripple = sin(folds * 22.0 + p.y * 6.0 - uTime * 0.25) * 0.5 + 0.5;

    // Where the second colour shows through: narrow, soft-edged bands.
    float thread = smoothstep(0.42, 0.68, folds);

    // Base fabric with soft self-shading; the thread colour is a tempered version of the other colour.
    vec3 base = mix(mix(uBeigeLight, uBeige, folds * 0.8), mix(uPlum, uPlumDeep, folds * 0.7), uMix);
    vec3 threadColor = mix(mix(uPlum, uBeige, 0.45), mix(uBeige, uPlum, 0.35), uMix);
    float strength = mix(0.34, 0.42, uMix);

    vec3 col = mix(base, threadColor, thread * strength);
    col += ripple * 0.035 * (1.0 - thread);          // sheen on the base
    col += ripple * 0.05 * thread * mix(1.0, 0.6, uMix); // brighter sheen along the threads

    // Fine grain so gradients never band.
    col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.018;
    gl_FragColor = vec4(col, 1.0);
  }
`;

let stop: (() => void) | null = null;
let mixTarget = 0;
let scrollTarget = 0;

export function setMix(value: number) {
  mixTarget = Math.min(Math.max(value, 0), 1);
}
export function setScroll(px: number) {
  scrollTarget = px;
}

export function stopSilk() {
  if (stop) stop();
  stop = null;
}

export function startSilk(canvas: HTMLCanvasElement) {
  stopSilk();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uMix: { value: mixTarget },
    uScroll: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uPlum: { value: new THREE.Color("#3f2a3d") },
    uPlumDeep: { value: new THREE.Color("#261a26") },
    uBeige: { value: new THREE.Color("#e9dfcf") },
    uBeigeLight: { value: new THREE.Color("#f6f0e5") },
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const pointer = { x: 0.5, y: 0.5 };
  let frameId = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  }

  function frame(time: number) {
    uniforms.uTime.value = time / 1000;
    // Ease every driven value so section changes and scroll feel like fabric, not switches.
    uniforms.uMix.value += (mixTarget - uniforms.uMix.value) * 0.09;
    uniforms.uScroll.value += (scrollTarget - uniforms.uScroll.value) * 0.08;
    uniforms.uPointer.value.x += (pointer.x - uniforms.uPointer.value.x) * 0.03;
    uniforms.uPointer.value.y += (pointer.y - uniforms.uPointer.value.y) * 0.03;
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(frame);
  }

  function onMove(e: PointerEvent) {
    pointer.x = e.clientX / window.innerWidth;
    pointer.y = 1 - e.clientY / window.innerHeight;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove);
  resize();
  frameId = requestAnimationFrame(frame);

  stop = () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    quad.geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
