// Full-page background material rendered with a small WebGL shader (Three.js full-screen quad).
// Two materials share one fold field so the page can ease from one to the other:
//   midnight velvet   navy pile with long diagonal folds: shadowed valleys, cool sheen on the crests,
//                     two inks of blue drifting across the page, fine fibres, rare brass threads and
//                     warm lamp light in the upper right with a darker edge
//   ivory travertine  warm stone: soft mottling, thin veins, fine pits, wide horizontal bedding
//   setMix(0..1)   0 = travertine, 1 = velvet. Chapters set a target as they scroll in; the value
//                  eases toward it slowly so the change feels like light moving across a room.
//   setScroll(px)  the material drifts a little with the page so it feels attached to the content.
// Pointer position bends the folds slightly. Runs behind everything, fixed, pointer-events none.
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
  uniform vec3 uNavy;
  uniform vec3 uNavyDeep;
  uniform vec3 uInk;
  uniform vec3 uSheen;
  uniform vec3 uBrass;
  uniform vec3 uIvory;
  uniform vec3 uIvoryLight;
  uniform vec3 uVein;

  // Hash and value noise, enough for soft fabric folds and stone mottling.
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

  // Height of the velvet pile at a point: folds that bend, never blobs.
  float pile(vec2 f, float t) {
    vec2 q = vec2(fbm(f * 1.1 + t * 0.4), fbm(f * 1.1 - t * 0.3 + 3.1));
    return fbm(f * 1.4 + q * 0.8 + vec2(t * 0.3, -t * 0.2));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.03;
    p.y += uScroll * 0.00025;
    p += (uPointer - 0.5) * 0.08;

    // Velvet: rotate and stretch so the folds run as long diagonals, like fabric draped over a frame.
    float c = cos(0.5), s = sin(0.5);
    vec2 f = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    f.x *= 0.45;
    float h = pile(f, t);
    // Slope toward the light (upper left), from a finite difference along the fold direction.
    float slope = clamp((pile(f + vec2(0.02, 0.0), t) - h) * 18.0, -1.0, 1.0);
    float crest = smoothstep(0.1, 0.9, slope * 0.5 + 0.5);
    // Base: deep valleys, lit folds, and a slow shift between two inks of blue across the page.
    float ink = fbm(p * 0.6 + vec2(-t * 0.2, t * 0.15));
    vec3 navy = mix(uNavy, uInk, smoothstep(0.35, 0.7, ink));
    vec3 velvet = mix(uNavyDeep, navy, smoothstep(0.2, 0.8, h));
    velvet *= mix(0.6, 1.0, smoothstep(-0.6, 0.4, slope)); // shadow on the far side of each fold
    velvet = mix(velvet, uSheen, crest * 0.5 * smoothstep(0.4, 0.85, h));
    // Pile: fine fibres along the folds, only visible up close.
    velvet *= 0.94 + 0.08 * noise(vec2(f.x * 420.0, f.y * 60.0));
    // Thin brass threads woven through, as in the stone, but rare.
    float thread = 1.0 - smoothstep(0.0, 0.005, abs(fbm(p * 1.3 + vec2(2.7, 8.1)) - 0.5));
    velvet = mix(velvet, uBrass * 0.7, thread * 0.12);
    // Warm light from the lamps, drifting slowly, and a cool fall-off at the edges.
    vec2 lamp = vec2(0.78 + sin(uTime * 0.03) * 0.06, 0.82);
    vec2 toLamp = (uv - lamp) * vec2(aspect, 1.0);
    float glow = exp(-dot(toLamp, toLamp) * 2.2);
    velvet += uBrass * glow * 0.09 + uBrass * pow(crest, 4.0) * 0.06 * glow;
    float vignette = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(aspect, 1.0)));
    velvet *= mix(0.7, 1.0, vignette);

    // Travertine: a calm field. Mottle, thin veins where a second field crosses its middle,
    // fine pits, and wide horizontal bedding bands.
    vec2 g = p * 1.6;
    float mottle = fbm(g + vec2(t * 0.1));
    float veinField = fbm(g * 1.8 + vec2(5.2, 1.3));
    float vein = 1.0 - smoothstep(0.0, 0.03, abs(veinField - 0.5));
    float pits = step(0.978, noise(p * 170.0));
    float bedding = sin(p.y * 9.0 + mottle * 2.5) * 0.5 + 0.5;
    vec3 stone = mix(uIvoryLight, uIvory, mottle);
    stone = mix(stone, uVein, vein * 0.07);
    stone = mix(stone, uVein, pits * 0.25);
    stone = mix(stone, uIvory, bedding * 0.18);

    vec3 col = mix(stone, velvet, uMix);
    // Grain: fine on stone, a little heavier on the velvet pile.
    col += (hash(gl_FragCoord.xy + uTime) - 0.5) * mix(0.014, 0.03, uMix);
    gl_FragColor = vec4(col, 1.0);
  }
`;

let stop: (() => void) | null = null;
let mixTarget = 0;
let scrollTarget = 0;

let snapMix = false;
/** `now` skips the easing (used when a header link jumps to another section). */
export function setMix(value: number, now = false) {
  mixTarget = Math.min(Math.max(value, 0), 1);
  if (now) snapMix = true;
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
    uNavy: { value: new THREE.Color("#18264d") },
    uNavyDeep: { value: new THREE.Color("#04070f") },
    uInk: { value: new THREE.Color("#132d45") },
    uSheen: { value: new THREE.Color("#4c6393") },
    uBrass: { value: new THREE.Color("#c9a86a") },
    uIvory: { value: new THREE.Color("#f1e9db") },
    uIvoryLight: { value: new THREE.Color("#f9f5ed") },
    uVein: { value: new THREE.Color("#d6bf94") },
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
    // Ease every driven value so chapter changes and scroll feel like light moving, not switches.
    if (snapMix) {
      uniforms.uMix.value = mixTarget;
      snapMix = false;
    }
    uniforms.uMix.value += (mixTarget - uniforms.uMix.value) * 0.08;
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
