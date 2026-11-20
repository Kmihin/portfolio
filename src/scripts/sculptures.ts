// The sculptures: one fixed WebGL canvas behind the page draws the sculpture of every room, each in
// its slot. A slot is an empty box in the layout ([data-sculpture="name"]); the sculpture is drawn
// over it and scrolls with it, so the page's layout decides where and how large each one is.
//
// The sculptures come from public/models/sculptures.glb (modelled in Blender: tools/blender/
// sculptures.py). Marble is drawn here by its own shader (navy with gold veins, white with grey
// veins, polished); brass is plain metal in a warm studio light.
//
// Slots:
//   data-sculpture="armillary" | "prism" | "balance" | "king" | "envelope" | a case study slug
//   data-sculpture="work" with data-objects="slug,slug,...": shows the picked case study's object
//
// What moves, and why (nothing turns just to turn):
//   - armillary: its three rings turn into place when the page opens, then keep turning slowly
//     round the globe; the globe floats (nothing holds it), turning on a tilted axis and rising and
//     sinking a little.
//   - prism: turns to the face of the skill that is picked (pick()).
//   - work: when another case study is picked, the last object sinks away first, then the new one
//     rises in its place (never both at once); the key turns a quarter, the chest opens a little.
//   - balance: its beam settles level as the room arrives; its pans hold a pair of objects for the
//     picked service (pick("balance")): the last pair shrinks away, the new one drops in, and the
//     beam sways and settles again.
//   - lighthouse (project-hub): its lamp turns slowly, keeping watch over everything I run.
//   - envelope: the seal is pressed onto the flap as the room comes into view (sealed).
//   - every sculpture leans a little towards the pointer.
//   - entering a case study (enterWork, from entrance.ts): its object plays its entrance (the chest
//     opens wide, the villa's door opens, the key sinks in and turns and a door in its pedestal
//     opens, the ball flies over the net, the dumbbell lifts, the cloud lifts off the servers, the
//     lighthouse's door opens),
//     then the view zooms into its Entry point (an empty in the model).
// Under prefers-reduced-motion everything is shown in its final place.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// The marble's colours follow the background pictures: a clear mid blue with light gold veins.
const NAVY = new THREE.Color("#172a40");
const GOLD = new THREE.Color("#e6c47e");
const WHITE = new THREE.Color("#f7f3ec");
const GREY = new THREE.Color("#a59d90");

// Sculptures that lie flat in their model are leaned towards the viewer (radians round x): the
// scroll stands up, so its text faces you.
const LEAN: Record<string, number> = { "document-platform": 0.95 };

// How fast each ring turns round the globe (radians a second).
const RING_SPEEDS = [0.1, -0.075, 0.06];
// The globe's axis: tilted 23 degrees, as the earth's.
const GLOBE_AXIS = new THREE.Vector3(Math.sin(0.4), Math.cos(0.4), 0);
const GLOBE_TILT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), GLOBE_AXIS);

// Entering a case study: how long its object's own move takes (seconds), and how the object is
// turned while the view goes in (lean: tipped towards you, round x; turn: round y), so the way in
// faces you: the open chest from above, the villa's door from the front, the court from above.
const ENTRANCES: Record<string, { act: number; lean: number; turn: number }> = {
  omnikeep: { act: 0.9, lean: 1.15, turn: 0 },
  "stekner-house": { act: 0.9, lean: 0.05, turn: 0 },
  "azure-migration": { act: 0.6, lean: 0.1, turn: 0 },
  "rebac-authorization": { act: 1.3, lean: 0.05, turn: 0 },
  mojbeach: { act: 1.0, lean: 0.7, turn: 0 },
  "document-platform": { act: 0.3, lean: 0.1, turn: 0 },
  "fuel-guide": { act: 0.7, lean: 0.25, turn: 0 },
  "project-hub": { act: 0.9, lean: 0.05, turn: 0 },
};
// How long the view takes to zoom in, after the object's move.
const ZOOM = 1.1;

let running = false;
const picks = new Map<string, number>();
const sculptures = new Map<string, Sculpture>();
let entering: { name: string; started: number } | null = null;
// The balance's pan objects: the picked service, when it was picked, how far each pair is shown.
const loads = { picked: 0, swapped: 0, shown: new Map<number, number>() };

/** Picks an item in a room ("work", "prism"): its index in the room's list. */
export function pick(room: string, index: number) {
  picks.set(room, index);
}

/**
 * Plays the way into a case study's object (see the top of this file) and returns how many seconds
 * it takes; 0 when its object is not on screen (no WebGL, not loaded yet), so the page just opens.
 */
export function enterWork(slug: string) {
  const sculpture = sculptures.get(slug);
  const entrance = ENTRANCES[slug];
  if (!sculpture || !entrance || sculpture.shown < 0.5) return 0;
  entering = { name: slug, started: performance.now() };
  return entrance.act + ZOOM;
}

/* ---------- Materials ---------- */

/**
 * Polished marble, drawn from the surface's own position (no texture), like the background
 * pictures: the stone breaks into facets of slightly different shades, crossed by seams of uneven
 * width (some edges of large stone cells, pushed around by noise, with rough edges and a paler
 * halo) and by fine hairline cracks (edges of small cells, only in places). The veins are as strong
 * as `strength`; gold veins are a little metallic and grainy.
 */
function marble(base: THREE.Color, vein: THREE.Color, scale: number, strength: number, metalVeins: boolean, land: THREE.Texture | null = null) {
  const material = new THREE.MeshPhysicalMaterial({ color: base, roughness: 0.18, clearcoat: 0.7, clearcoatRoughness: 0.12, map: land });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uVein = { value: vein };
    shader.uniforms.uScale = { value: scale };
    shader.uniforms.uStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMarble;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMarble = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vMarble;
        uniform vec3 uVein;
        uniform float uScale;
        uniform float uStrength;
        float marbleHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float marbleNoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(marbleHash(i), marbleHash(i + vec3(1, 0, 0)), f.x), mix(marbleHash(i + vec3(0, 1, 0)), marbleHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(marbleHash(i + vec3(0, 0, 1)), marbleHash(i + vec3(1, 0, 1)), f.x), mix(marbleHash(i + vec3(0, 1, 1)), marbleHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }
        float marbleFbm(vec3 p) {
          float sum = 0.0;
          float amount = 0.5;
          for (int i = 0; i < 5; i++) {
            sum += marbleNoise(p) * amount;
            p *= 2.03;
            amount *= 0.5;
          }
          return sum;
        }
        vec3 marbleHash3(vec3 p) {
          p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
          return fract(sin(p) * 43758.5453);
        }
        // Stone cells (Voronoi): x is how far the point is from the edge between its two nearest
        // cells, y a value shared by those two cells (it picks which edges become seams), z a value
        // of the nearest cell (its shade).
        vec3 marbleCells(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          float nearest = 8.0;
          float second = 8.0;
          vec3 cell = vec3(0.0);
          vec3 next = vec3(0.0);
          for (int z = -1; z <= 1; z++) {
            for (int y = -1; y <= 1; y++) {
              for (int x = -1; x <= 1; x++) {
                vec3 g = vec3(float(x), float(y), float(z));
                vec3 r = g + marbleHash3(i + g) - f;
                float d = dot(r, r);
                if (d < nearest) {
                  second = nearest;
                  next = cell;
                  nearest = d;
                  cell = i + g;
                } else if (d < second) {
                  second = d;
                  next = i + g;
                }
              }
            }
          }
          return vec3(sqrt(second) - sqrt(nearest), marbleHash(cell + next), marbleHash(cell));
        }
        float marbleVein;
        float marbleLand;`,
      )
      .replace("#include <map_fragment>", "")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 marbleAt = vMarble * uScale;
        // The stone pushed around by noise, so the cells and seams meander.
        vec3 warped = marbleAt + (vec3(marbleFbm(marbleAt * 1.3), marbleFbm(marbleAt * 1.3 + 5.2), marbleFbm(marbleAt * 1.3 + 9.7)) - 0.5) * 0.9;
        vec3 large = marbleCells(warped * 1.6);
        vec3 small = marbleCells(warped * 4.5 + 2.0);
        // Seams: about half of the large cells' edges, wide in places and narrow in others, with
        // rough edges.
        float isSeam = step(0.45, large.y);
        float width = (0.008 + 0.045 * pow(marbleFbm(marbleAt * 2.2 + 3.0), 2.0)) * (0.7 + 0.6 * marbleNoise(marbleAt * 30.0));
        float seam = (1.0 - smoothstep(width * 0.55, width, large.x)) * isSeam;
        // Hairline cracks: the small cells' edges, only where the noise lets them through.
        float crack = (1.0 - smoothstep(0.012, 0.03, small.x)) * smoothstep(0.4, 0.6, marbleFbm(marbleAt * 1.8 + 11.0));
        marbleVein = max(seam, crack * 0.75) * uStrength;
        // The stone: facets of slightly different shades, clouded, paler beside the seams.
        float cloud = marbleFbm(marbleAt * 2.5 + 7.0);
        float halo = (1.0 - smoothstep(width, width * 6.0 + 0.04, large.x)) * isSeam * marbleFbm(marbleAt * 3.0 + 1.0);
        // (calmer on stone with faint veins, as the white marble)
        diffuseColor.rgb *= (1.0 - 0.22 * uStrength + 0.4 * uStrength * small.z) * mix(0.82, 1.06, cloud);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 3.2 + 0.1, halo * 0.55 * uStrength);
        // Grainy gold: the vein's colour flickers a little.
        diffuseColor.rgb = mix(diffuseColor.rgb, uVein * (0.85 + 0.3 * marbleNoise(marbleAt * 60.0)), marbleVein);
        marbleLand = 0.0;
        #ifdef USE_MAP
          // A globe: the mask's red is land, its green the 30 degree lines; both are brass.
          vec4 globeMask = texture2D(map, vMapUv);
          marbleLand = max(smoothstep(0.3, 0.7, globeMask.r), smoothstep(0.2, 0.8, globeMask.g) * 0.75);
          diffuseColor.rgb = mix(diffuseColor.rgb, uVein, marbleLand);
        #endif`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, marbleLand);",
      );
    if (metalVeins) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.85, max(marbleVein, marbleLand));",
      );
    }
  };
  return material;
}

function materialsByName(globeMask: THREE.Texture | null) {
  return new Map<string, THREE.Material>([
    // The globe: navy marble seas (faint veins, so the continents read) with brass land.
    ["Globe", marble(NAVY, GOLD, 0.9, 0.12, true, globeMask)],
    ["Navy marble", marble(NAVY, GOLD, 0.9, 1, true)],
    // White marble keeps its veins faint: a hint of grey, so the stone reads calm and light.
    ["White marble", marble(WHITE, GREY, 0.7, 0.35, false)],
    ["Brass", new THREE.MeshStandardMaterial({ color: "#dcbb78", metalness: 1, roughness: 0.32 })],
    ["Polished brass", new THREE.MeshStandardMaterial({ color: "#ead08f", metalness: 1, roughness: 0.18 })],
  ]);
}

/** A warm studio, painted on a canvas: what the marble and the brass reflect. */
function studio(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const paint = canvas.getContext("2d")!;
  const room = paint.createLinearGradient(0, 0, 0, 512);
  room.addColorStop(0, "#f4ede0");
  room.addColorStop(0.48, "#cfc3ad");
  room.addColorStop(0.56, "#6e6455");
  room.addColorStop(1, "#2e2a24");
  paint.fillStyle = room;
  paint.fillRect(0, 0, 1024, 512);
  paint.filter = "blur(14px)";
  paint.fillStyle = "#fffaf0";
  paint.fillRect(90, 60, 260, 150);
  paint.fillRect(650, 70, 130, 180);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const generator = new THREE.PMREMGenerator(renderer);
  const map = generator.fromEquirectangular(texture).texture;
  texture.dispose();
  generator.dispose();
  return map;
}

/* ---------- The scene ---------- */

/** Move a value towards its target, the same at every frame rate. */
function ease(current: number, target: number, rate: number, seconds: number) {
  return current + (target - current) * (1 - Math.exp(-rate * seconds));
}

/** The short way round between two angles. */
function easeAngle(current: number, target: number, rate: number, seconds: number) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-rate * seconds));
}

/** How far a slot's room has come up the screen: 0 when its top enters, 1 when its middle is at the middle. */
function arrival(slot: HTMLElement) {
  const room = slot.closest("section") ?? slot;
  const box = room.getBoundingClientRect();
  return THREE.MathUtils.clamp((window.innerHeight - box.top) / (window.innerHeight / 2 + box.height / 2), 0, 1);
}

type Sculpture = {
  name: string;
  /** Holds the model; placed over the slot every frame. */
  group: THREE.Group;
  /** Named parts the room moves, with where they rest. */
  parts: Map<string, { object: THREE.Object3D; position: THREE.Vector3; rotation: THREE.Euler }>;
  /** How far it has grown in (0 hidden, 1 whole): a picked case study's object rises in. */
  shown: number;
  /** The slot it was last shown in: it shrinks away there. */
  slot: HTMLElement | null;
  /** A case study's object: the point the view zooms into when the study is opened. */
  entry: THREE.Object3D | null;
};

// The balance's pan objects are LoadL0, LoadR0, ... (one pair per service).
const LOAD = /^Load[LR]\d$/;
const PARTS = ["Ring1", "Ring2", "Ring3", "Core", "Turn", "Beam", "PanLeft", "PanRight", "Seal", "Lid", "Key", "Hatch", "FrontDoor", "Door", "Lamp", "Ball", "Dumbbell", "Cloud"];

export function startSculptures(canvas: HTMLCanvasElement) {
  if (running) return;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return; // no WebGL: the rooms keep their pictures and text
  }
  running = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  camera.position.z = 20;
  const key = new THREE.DirectionalLight("#fff4e2", 2.2);
  key.position.set(-4, 6, 8);
  const rim = new THREE.DirectionalLight("#ffffff", 0.7);
  rim.position.set(5, 2, -6);
  scene.add(key, rim);

  let halfWidth = 1;
  let halfHeight = 1;
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfWidth = halfHeight * camera.aspect;
  }
  resize();
  window.addEventListener("resize", resize);

  const opened = performance.now();
  new GLTFLoader().load("/models/sculptures.glb", (gltf) => {
    const globe = gltf.scene.getObjectByName("Core") as THREE.Mesh | undefined;
    const materials = materialsByName((globe?.material as THREE.MeshStandardMaterial | undefined)?.map ?? null);
    for (const node of [...gltf.scene.children]) {
      node.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.material = materials.get((mesh.material as THREE.Material).name) ?? mesh.material;
      });
      const parts = new Map<string, { object: THREE.Object3D; position: THREE.Vector3; rotation: THREE.Euler }>();
      node.traverse((object) => {
        if (PARTS.includes(object.name) || LOAD.test(object.name)) {
          parts.set(object.name, { object, position: object.position.clone(), rotation: object.rotation.clone() });
        }
      });
      // The model sits in a holder that leans it, inside the group the frame places and turns.
      const holder = new THREE.Group();
      holder.rotation.x = LEAN[node.name] ?? 0;
      holder.add(node);
      const group = new THREE.Group();
      group.add(holder);
      group.visible = false;
      scene.add(group);
      // The entry point is an empty named Entry (Blender numbers repeats: Entry001, ...).
      const entry = node.children.find((child) => child.name.startsWith("Entry")) ?? null;
      sculptures.set(node.name, { name: node.name, group, parts, shown: 0, slot: null, entry });
    }
  });

  // A new page (client navigation keeps this canvas): the objects start hidden and at rest, so
  // the case page's object grows in there.
  document.addEventListener("astro:after-swap", () => {
    entering = null;
    sculptures.forEach((sculpture) => {
      sculpture.shown = 0;
      sculpture.slot = null;
      sculpture.parts.forEach((part) => {
        part.object.position.copy(part.position);
        part.object.rotation.copy(part.rotation);
      });
    });
  });

  // The pointer: every sculpture leans a little towards it.
  const pointer = new THREE.Vector2();
  const look = new THREE.Vector2();
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
  });

  /** Places a sculpture over its slot: centred, as tall as the slot. */
  function place(sculpture: Sculpture, box: DOMRect) {
    const group = sculpture.group;
    const x = ((box.left + box.width / 2) / window.innerWidth) * 2 - 1;
    const y = 1 - ((box.top + box.height / 2) / window.innerHeight) * 2;
    group.position.set(x * halfWidth, y * halfHeight, 0);
    // The model fits a sphere of radius 1: as wide as the slot's smaller side.
    const size = (Math.min(box.width / window.innerWidth * halfWidth * 2, box.height / window.innerHeight * halfHeight * 2) / 2) * 0.98;
    // Growing in, it also rises from a little below; shrinking away, it sinks.
    const grown = 1 - (1 - sculpture.shown) * (1 - sculpture.shown);
    group.position.y -= (1 - grown) * size * 0.35;
    group.scale.setScalar(size * Math.max(0.001, grown));
  }

  // What each slot shows (a work slot: its picked object; others: their own sculpture).
  function objectFor(slot: HTMLElement) {
    const room = slot.dataset.sculpture!;
    if (room !== "work") return room;
    if (entering) return entering.name;
    const objects = (slot.dataset.objects ?? "").split(",");
    return objects[picks.get("work") ?? 0] ?? objects[0];
  }

  // The prism's faces: the angle that brings each label to the front.
  function faceAngle(sculpture: Sculpture, index: number) {
    const label = sculpture.group.getObjectByName(`Label${index + 1}`);
    return label ? Math.atan2(label.position.y, label.position.z) : 0;
  }

  let before = performance.now();
  function frame(now: number) {
    requestAnimationFrame(frame);
    if (document.hidden) {
      before = now;
      return;
    }
    const seconds = Math.min(0.05, (now - before) / 1000);
    before = now;
    if (!reduced) {
      look.x = ease(look.x, pointer.x, 2.5, seconds);
      look.y = ease(look.y, pointer.y, 2.5, seconds);
    }

    // Which sculptures are wanted where: every slot near the screen.
    const wanted = new Map<string, HTMLElement>();
    document.querySelectorAll<HTMLElement>("[data-sculpture]").forEach((slot) => {
      const box = slot.getBoundingClientRect();
      if (box.bottom < -200 || box.top > window.innerHeight + 200 || box.height === 0) return;
      wanted.set(objectFor(slot), slot);
    });

    // An object that is leaving a slot: the one picked next waits until it has gone.
    const leaving = (slot: HTMLElement, except: Sculpture) =>
      [...sculptures.values()].some((other) => other !== except && other.slot === slot && other.shown > 0.02 && !wanted.has(other.name));

    sculptures.forEach((sculpture, name) => {
      const slot = wanted.get(name);
      if (slot) sculpture.slot = slot;
      // A sculpture grows in when its slot wants it (once the slot is empty) and shrinks away when
      // it does not.
      const grow = slot && !leaving(slot, sculpture) ? 1 : 0;
      sculpture.shown = reduced ? grow : ease(sculpture.shown, grow, grow ? 4 : 10, seconds);
      sculpture.group.visible = sculpture.shown > 0.01;
      if (!sculpture.group.visible || !sculpture.slot) return;
      place(sculpture, sculpture.slot.getBoundingClientRect());
      const settle = reduced ? 1 : 1 - (1 - sculpture.shown) * (1 - sculpture.shown);
      sculpture.group.rotation.set(0.12 + look.y * 0.08, -0.35 + look.x * 0.25 - (1 - settle) * 0.5, 0);
      const way = entrance(sculpture, now);
      move(sculpture, sculpture.slot, now, seconds, way.act);
      if (way.turn > 0) {
        const view = ENTRANCES[sculpture.name];
        const rotation = sculpture.group.rotation;
        rotation.set(THREE.MathUtils.lerp(rotation.x, view.lean, way.turn), THREE.MathUtils.lerp(rotation.y, view.turn, way.turn), 0);
      }
      zoomInto(sculpture, way.zoom);
    });

    renderer.render(scene, camera);
  }

  /**
   * Where a sculpture is in its entrance (enterWork): its own move (act), how far it has turned to
   * face the way in (turn) and how far the view has zoomed in (zoom), each from 0 to 1.
   */
  function entrance(sculpture: Sculpture, now: number) {
    const view = ENTRANCES[sculpture.name];
    if (!entering || entering.name !== sculpture.name || !view) return { act: 0, turn: 0, zoom: 0 };
    const t = (now - entering.started) / 1000;
    const clamp = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
    return {
      act: THREE.MathUtils.smoothstep(t / view.act, 0, 1),
      turn: THREE.MathUtils.smoothstep(t / (view.act + ZOOM * 0.5), 0, 1),
      zoom: clamp((t - view.act) / ZOOM),
    };
  }

  /**
   * Zooms the view into a sculpture's entry point: the point moves to the middle of the screen and
   * the sculpture grows round it, slowly and then fast, until the view is inside.
   */
  function zoomInto(sculpture: Sculpture, zoom: number) {
    if (!sculpture.entry || zoom <= 0) return;
    const group = sculpture.group;
    group.updateMatrixWorld(true);
    const point = sculpture.entry.getWorldPosition(new THREE.Vector3());
    const grow = Math.pow(60, zoom * zoom);
    const centred = THREE.MathUtils.smoothstep(zoom, 0, 0.6);
    const offset = group.position.clone().sub(point).multiplyScalar(grow);
    group.position.set(point.x * (1 - centred), point.y * (1 - centred), point.z).add(offset);
    group.scale.multiplyScalar(grow);
  }

  /** The movements of the rooms (see the top of this file); `into` is a case study's entrance. */
  function move(sculpture: Sculpture, slot: HTMLElement, now: number, seconds: number, into: number) {
    const part = (name: string) => sculpture.parts.get(name);
    const between = (from: number, to: number) => THREE.MathUtils.smoothstep(into, from, to);
    if (sculpture.name === "armillary") {
      // The rings turn into place in the first seconds after the page opens, and then keep turning
      // slowly round the globe, each round one of its own diameters.
      const t = reduced ? 1 : Math.min(1, (now - opened) / 2600);
      const left = 1 - (1 - Math.pow(1 - t, 4));
      const time = reduced ? 0 : (now - opened) / 1000;
      ["Ring1", "Ring2", "Ring3"].forEach((name, i) => {
        const ring = part(name);
        if (!ring) return;
        ring.object.rotation.set(ring.rotation.x + left * (1.4 + i * 0.6), ring.rotation.y + left * (0.8 - i * 0.5), ring.rotation.z);
        ring.object.rotateX(time * RING_SPEEDS[i]);
      });
      // The globe floats: it turns on its tilted axis and rises and sinks a little.
      const core = part("Core");
      if (core) {
        core.object.quaternion.setFromAxisAngle(GLOBE_AXIS, time * 0.15).multiply(GLOBE_TILT);
        core.object.position.y = core.position.y + Math.sin(time * 0.9) * 0.025;
      }
    }
    if (sculpture.name === "prism") {
      const turn = part("Turn");
      if (turn) turn.object.rotation.x = easeAngle(turn.object.rotation.x, faceAngle(sculpture, picks.get("prism") ?? 0), reduced ? 1000 : 4, seconds);
    }
    if (sculpture.name === "balance") {
      // The pans' objects: the picked service's pair drops in once the last pair has gone.
      const picked = picks.get("balance") ?? 0;
      if (picked !== loads.picked) {
        loads.picked = picked;
        loads.swapped = now;
      }
      const shown = (index: number) => loads.shown.get(index) ?? 0;
      const leaving = [...loads.shown.keys()].some((index) => index !== picked && shown(index) > 0.03);
      const pairs = [...sculpture.parts.keys()].filter((name) => name.startsWith("LoadL")).length;
      for (let index = 0; index < pairs; index++) {
        const grow = index === picked && !leaving ? 1 : 0;
        const amount = reduced ? grow : ease(shown(index), grow, grow ? 6 : 12, seconds);
        loads.shown.set(index, amount);
        for (const side of ["L", "R"]) {
          const load = part(`Load${side}${index}`);
          if (!load) continue;
          load.object.visible = amount > 0.01;
          load.object.scale.setScalar(Math.max(0.001, amount));
          // Dropping in from a little above; shrinking away where it lies.
          load.object.position.y = load.position.y + (grow ? (1 - amount) * (1 - amount) * 0.35 : 0);
        }
      }
      // The beam settles level as the room comes up the screen, with a last small sway; it sways
      // again when a new pair drops into the pans.
      const p = arrival(slot);
      const since = (now - loads.swapped) / 1000;
      const sway = loads.swapped ? 0.1 * Math.exp(-since * 1.6) * Math.sin(since * 5) : 0;
      const tilt = reduced ? 0 : 0.32 * (1 - p) * Math.cos(p * 7) + sway;
      const beam = part("Beam");
      if (beam) {
        beam.object.rotation.z = beam.rotation.z + tilt;
        // The pans hang from the beam's ends and stay upright.
        for (const name of ["PanLeft", "PanRight"]) {
          const pan = part(name);
          if (!pan) continue;
          const arm = pan.position.clone().sub(beam.position);
          arm.applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
          pan.object.position.copy(beam.position).add(arm);
        }
      }
    }
    if (sculpture.name === "envelope") {
      const seal = part("Seal");
      const p = reduced ? 1 : THREE.MathUtils.smoothstep(arrival(slot), 0.4, 1);
      if (seal) {
        // Pressed onto the envelope: it comes down from a little in front and rests on the flap.
        seal.object.position.set(seal.position.x, seal.position.y + (1 - p) * 0.12, seal.position.z + (1 - p) * 0.28);
        seal.object.rotation.set(seal.rotation.x - (1 - p) * 0.35, seal.rotation.y, seal.rotation.z);
      }
    }
    // A picked case study: the key turns a quarter, the chest opens a little. Entering it: the
    // key sinks into the keyhole and turns once more, then the pedestal's door opens; the chest
    // opens wide.
    const key = part("Key");
    if (key) {
      const turn = (reduced ? 0 : Math.PI / 2) * sculpture.shown + (Math.PI / 2) * between(0.4, 0.75);
      key.object.rotation.y = into > 0 ? turn : ease(key.object.rotation.y, turn, 3, seconds);
      key.object.position.y = key.position.y - 0.16 * between(0, 0.4);
    }
    const hatch = part("Hatch");
    if (hatch) hatch.object.rotation.y = hatch.rotation.y - 1.7 * between(0.7, 1);
    const lid = part("Lid");
    if (lid) {
      const open = 0.55 * sculpture.shown + 1.35 * into;
      lid.object.rotation.x = ease(lid.object.rotation.x, lid.rotation.x - open, into > 0 ? 14 : 3, seconds);
    }
    // The villa's and the lighthouse's front doors swing in.
    for (const name of ["FrontDoor", "Door"]) {
      const door = part(name);
      if (door) door.object.rotation.y = door.rotation.y + 1.5 * into;
    }
    // The lighthouse's lamp turns slowly: it keeps watch.
    const lamp = part("Lamp");
    if (lamp) lamp.object.rotation.y = lamp.rotation.y + (reduced ? 0 : ((now - opened) / 1000) * 0.6);
    // The ball flies over the net and lands on the other side of the court, spinning.
    const ball = part("Ball");
    if (ball) {
      ball.object.position.set(
        THREE.MathUtils.lerp(ball.position.x, -0.55, into),
        THREE.MathUtils.lerp(ball.position.y, 0.21, into) + Math.sin(into * Math.PI) * 0.35,
        ball.position.z,
      );
      ball.object.rotation.z = ball.rotation.z + into * 5;
    }
    // The dumbbell is lifted; the cloud lifts off the servers.
    const dumbbell = part("Dumbbell");
    if (dumbbell) dumbbell.object.position.y = dumbbell.position.y + 0.3 * into;
    const cloud = part("Cloud");
    if (cloud) cloud.object.position.y = cloud.position.y + 0.6 * into;
  }

  requestAnimationFrame(frame);
}
