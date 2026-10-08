// Site-wide motion. One script, started on every page load (also after Astro view transitions).
//
// What it animates and why:
//  - Smooth scroll (Lenis) so the scrubbed scroll choreography feels continuous.
//  - silk background    two colours woven by a shader; blends toward the section colour (silk.ts).
//  - particles          a point cloud that forms the scene each section asks for (particles.ts):
//                       [data-shapes="a>b>c"] on a pinned section spreads the scenes over its scroll,
//                       [data-story] sections spread them over their [data-step] children,
//                       other sections morph into their scene as they come into view.
//                       [data-side] says which side the TEXT is on; the cloud goes to the other side.
//  - [data-theme]       sections switch the page between beige and plum as they reach mid-screen.
//  - [data-split]       headline words rise out of a clipped line when the heading enters.
//  - .reveal            blocks rise and fade in as they enter; .reveal-item children stagger.
//  - [data-enter]       above-the-fold content stages in on load.
//  - header             hides on scroll down, returns on scroll up; anchor links scroll smoothly.
//
// Everything is skipped under prefers-reduced-motion: CSS then shows all content statically.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { startSilk, stopSilk, setMix, setScroll } from "./silk";
import { startParticles, stopParticles, setBlend, setTint } from "./particles";

gsap.registerPlugin(ScrollTrigger);

const EASE = "expo.out";
const SIDE_OFFSET = 2.8; // world units the cloud moves away from the text on wide screens
let lenis: Lenis | null = null;
let cleanups: (() => void)[] = [];

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function wideScreen() {
  return window.innerWidth >= 1024;
}

/** Wraps every word of an element in a clipped span so it can rise into view. */
function splitWords(el: HTMLElement) {
  if (el.dataset.splitDone) return;
  const words = (el.textContent ?? "").trim().split(/\s+/);
  el.textContent = "";
  for (const word of words) {
    const outer = document.createElement("span");
    outer.className = "split-word";
    const inner = document.createElement("span");
    inner.className = "split-inner";
    inner.textContent = word;
    outer.appendChild(inner);
    el.appendChild(outer);
    el.appendChild(document.createTextNode(" "));
  }
  el.dataset.splitDone = "1";
}

function startSmoothScroll() {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  cleanups.push(() => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
  });
}

/** In-page links (#work, /#work) scroll smoothly instead of jumping. */
function smoothAnchors() {
  const onClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"], a[href^="/#"]');
    if (!link) return;
    const target = document.querySelector<HTMLElement>(link.hash);
    if (!target) return;
    e.preventDefault();
    lenis?.scrollTo(target, { offset: -8, duration: 1.4 });
    history.pushState(null, "", link.hash);
  };
  document.addEventListener("click", onClick);
  cleanups.push(() => document.removeEventListener("click", onClick));
}

function startBackground() {
  const silk = document.getElementById("silk") as HTMLCanvasElement | null;
  if (silk) startSilk(silk);
  const dots = document.getElementById("particles") as HTMLCanvasElement | null;
  if (dots) startParticles(dots);

  // The weave drifts with the page.
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (self) => setScroll(self.scroll()) });

  // Each themed section takes over the page colours while it covers the middle of the screen.
  // Only sections inside the body: <html> carries data-theme too, as the current value.
  const sections = document.body.querySelectorAll<HTMLElement>("[data-theme]");
  const apply = (theme: string) => {
    document.documentElement.dataset.theme = theme;
    setMix(theme === "plum" ? 1 : 0);
    setTint(theme === "plum" ? 1 : 0);
  };
  sections.forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 55%",
      onEnter: () => apply(section.dataset.theme!),
      onEnterBack: () => apply(section.dataset.theme!),
    });
  });
  const mid = window.innerHeight * 0.55;
  const current = Array.from(sections).find((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= mid && r.bottom >= mid;
  });
  apply(current?.dataset.theme ?? "beige");
}

/** Cloud x position for a text side: away from the text on wide screens, centred otherwise. */
function cloudX(textSide: string | undefined) {
  if (!wideScreen() || !textSide || textSide === "center") return 0;
  return textSide === "right" ? -SIDE_OFFSET : SIDE_OFFSET;
}

type Key = { at: number; shape: string; x: number };

/** How many currents the points travel in: one per part of the scene they are forming, at least two. */
function bands(shape: string) {
  return Math.max(shape.split("+").length, 2);
}

/** Blends the cloud along a list of keyframes for a progress value 0..1. */
function blendAlong(keys: Key[], p: number) {
  let k = 0;
  while (k < keys.length - 2 && p > keys[k + 1].at) k++;
  const a = keys[k];
  const b = keys[Math.min(k + 1, keys.length - 1)];
  const t = b.at > a.at ? (p - a.at) / (b.at - a.at) : 1;
  setBlend(a.shape, b.shape, t, a.x, b.x, bands(b.shape));
}

function animateScenes() {
  // Walk the page in order so each section starts from the scene the previous one ended with.
  // Story steps carry data-shapes too but belong to their story, so they are not hosts themselves.
  const hosts = Array.from(document.body.querySelectorAll<HTMLElement>("[data-shapes]:not([data-step]), [data-story]"));
  if (!hosts.length) return;

  const firstShape = (hosts[0].dataset.shapes ?? hosts[0].querySelector<HTMLElement>("[data-step]")?.dataset.shapes ?? "sphere").split(">")[0].split("@")[0];
  const firstX = cloudX(hosts[0].dataset.side ?? hosts[0].querySelector<HTMLElement>("[data-step]")?.dataset.side);
  let last: Key = { at: 1, shape: firstShape, x: firstX };

  // Load: scattered points gather into the first scene; the scroll takes over once that is done.
  let ready = false;
  const load = { t: 0 };
  gsap.to(load, { t: 1, duration: 2, ease: "power3.out", onUpdate: () => setBlend("scatter", firstShape, load.t, 0, firstX, 2), onComplete: () => (ready = true) });

  hosts.forEach((host) => {
    const keys: Key[] = [{ at: 0, shape: last.shape, x: last.x }];
    const steps = Array.from(host.querySelectorAll<HTMLElement>("[data-step]"));
    const pinned = steps.length > 0 || host.querySelector(".sticky") !== null;

    if (steps.length) {
      // Story: each step owns an equal slice. Coming into the story the cloud spreads into a star
      // field over the whole screen. Between steps the points flow from the old scene straight into
      // the new one on the other side, forming it by 45% of the slice while the text fades in.
      // A second scene (a>b) forms by 80%; it holds until 90%.
      const n = steps.length;
      steps.forEach((step, i) => {
        const names = (step.dataset.shapes ?? "").split(">").filter(Boolean);
        const start = i / n;
        const x = cloudX(step.dataset.side);
        if (i === 0) keys.push({ at: start + 0.12 / n, shape: "field", x: 0 });
        if (names[0]) keys.push({ at: start + 0.45 / n, shape: names[0], x });
        if (names[1]) keys.push({ at: start + 0.8 / n, shape: names[1], x });
        const lastName = names[names.length - 1];
        if (lastName) keys.push({ at: start + 0.9 / n, shape: lastName, x });
      });
      // The story ends in a star field: the gap before the next section and its colour change play
      // over the stars, and the next section starts from them.
      keys.push({ at: 1, shape: "field", x: 0 });
    } else {
      // Pinned section: its scenes spread evenly over its scroll, beside the text until
      // data-side-until (fraction of the scroll), centred after. Plain section: one scene as it arrives.
      // "name@0.3" pins a scene to a point of the scroll; without "@" the scenes are spread evenly.
      const names = (host.dataset.shapes ?? "").split(">").filter(Boolean);
      const until = host.dataset.sideUntil ? Number(host.dataset.sideUntil) : Infinity;
      const side = cloudX(host.dataset.side);
      names.forEach((entry, i) => {
        const [name, atText] = entry.split("@");
        const at = atText ? Number(atText) : pinned && names.length > 1 ? i / (names.length - 1) : 1;
        keys.push({ at, shape: name, x: at < until ? side : 0 });
      });
    }
    last = keys[keys.length - 1];

    ScrollTrigger.create({
      trigger: host,
      start: pinned ? "top top" : "top 85%",
      end: pinned ? "bottom bottom" : "top 25%",
      onUpdate: (self) => {
        if (ready) blendAlong(keys, self.progress);
      },
    });

    // Story text: each step fades up, holds, fades away, scrubbed to the scroll.
    if (steps.length) {
      const n = steps.length;
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: host, start: "top top", end: "bottom bottom", scrub: 0.15 },
      });
      steps.forEach((step, i) => {
        const start = i / n;
        const len = 1 / n;
        tl.fromTo(step, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: len * 0.22 }, start + len * 0.08);
        tl.to(step, { autoAlpha: 0, y: -60, duration: len * 0.14 }, start + len * 0.82);
      });
      // The timeline must be exactly 1 long: a scrubbed timeline is mapped onto the scroll by its
      // total duration, so anything shorter would shift every fade earlier than the scenes.
      tl.set({}, {}, 1);
    }
  });
}

function animateHeadlines() {
  document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
    splitWords(el);
    const inners = el.querySelectorAll(".split-inner");
    // Explicit from-values: GSAP must not inherit the CSS start transform as a pixel offset.
    gsap.fromTo(
      inners,
      { yPercent: 110, y: 0 },
      { yPercent: 0, y: 0, duration: 1, ease: EASE, stagger: 0.035, scrollTrigger: { trigger: el, start: "top 88%", once: true } }
    );
  });
}

function animateReveals() {
  document.querySelectorAll<HTMLElement>(".reveal").forEach((block) => {
    const items = block.querySelectorAll<HTMLElement>(".reveal-item");
    const targets = items.length ? items : [block];
    gsap.fromTo(
      targets,
      { autoAlpha: 0, y: 28 },
      { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.08, scrollTrigger: { trigger: block, start: "top 86%", once: true } }
    );
    if (items.length) gsap.set(block, { autoAlpha: 1 });
  });
}

function animateHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;
  // Hide on scroll down, show on scroll up (never hidden near the top).
  ScrollTrigger.create({
    start: 120,
    end: "max",
    onUpdate: (self) => header.classList.toggle("is-hidden", self.direction === 1),
    onLeaveBack: () => header.classList.remove("is-hidden"),
  });
}

let firstLoad = true;

function pageEnter() {
  // Whatever is above the fold rises in with a short stagger. The header only does this once.
  const header = document.getElementById("site-header");
  const first = document.querySelector<HTMLElement>("[data-enter]");
  const tl = gsap.timeline({ defaults: { ease: EASE } });
  if (header && firstLoad) tl.fromTo(header, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0);
  if (first) tl.fromTo(first.children, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.1);
  firstLoad = false;
}

export function startMotion() {
  document.documentElement.classList.add("js");
  if (reducedMotion()) {
    document.documentElement.classList.add("reduce-motion");
    // Static page in the colours of its first themed section; backgrounds render but do not move.
    const first = document.body.querySelector<HTMLElement>("[data-theme]");
    const plum = first?.dataset.theme === "plum";
    document.documentElement.dataset.theme = plum ? "plum" : "beige";
    const silk = document.getElementById("silk") as HTMLCanvasElement | null;
    if (silk) {
      setMix(plum ? 1 : 0);
      startSilk(silk);
    }
    const dots = document.getElementById("particles") as HTMLCanvasElement | null;
    if (dots) {
      setTint(plum ? 1 : 0);
      setBlend("sphere", "sphere", 1);
      startParticles(dots);
    }
    return;
  }

  startSmoothScroll();
  smoothAnchors();
  startBackground();
  animateScenes();
  pageEnter();
  animateHeadlines();
  animateReveals();
  animateHeader();
  ScrollTrigger.refresh();
}

export function stopMotion() {
  stopSilk();
  stopParticles();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.globalTimeline.clear();
  cleanups.forEach((fn) => fn());
  cleanups = [];
}
