// Site-wide motion. One script, started on every page load (also after Astro view transitions).
//
// What it animates and why:
//  - Smooth scroll (Lenis) so the scrubbed intro and the reveals feel continuous.
//  - background          velvet or travertine rendered by a shader; eases toward the chapter's material (silk.ts).
//  - particles           a point cloud that forms the scene each section asks for (particles.ts):
//                        [data-shapes="a>b>c"] on a pinned section spreads the scenes over its scroll,
//                        other sections morph into their scene as they come into view;
//                        [data-showcase] chapters drive the cloud themselves (showcase.ts).
//                        [data-side] says which side the TEXT is on; the cloud goes to the other side.
//  - [data-theme]        chapters switch the page between ivory and midnight as they reach mid-screen.
//  - [data-split]        headline words rise out of a clipped line when the heading enters.
//  - [data-rule]         a hairline draws in from the left when it enters.
//  - .reveal             blocks rise and fade in as they enter; .reveal-item children stagger.
//  - [data-enter]        above-the-fold content stages in on load.
//  - header              transparent on the opening screen, then glass; hides on scroll down, returns
//                        on scroll up; the link of the chapter on screen is marked; anchor links scroll
//                        smoothly to their chapter.
//
// Everything is skipped under prefers-reduced-motion: CSS then shows all content statically.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { startSilk, stopSilk, setMix, setScroll } from "./silk";
import { startParticles, stopParticles, setBlend, setTint, freezeCloud, setAnchor, setFade } from "./particles";
import { startShowcases, stopShowcases } from "./showcase";
import { cloudX, bands } from "./cloud";

gsap.registerPlugin(ScrollTrigger);

const EASE = "expo.out";
const FAINT = 0.6; // opacity of a cloud kept in the background
let lenis: Lenis | null = null;
let cleanups: (() => void)[] = [];
// Set once the load gather is done; before that the scroll does not drive the cloud.
let ready = false;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  lenis = new Lenis({ lerp: 0.12 });
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

/** Page colours follow the themed chapter covering the middle of the screen. The particle dots are
 *  brass on midnight and navy on ivory, unless the chapter asks for brass (data-tint="brass", for an
 *  ivory chapter whose picture puts dark mountains behind the particle shape). */
function applyTheme(section: HTMLElement | undefined) {
  const theme = section?.dataset.theme ?? "ivory";
  document.documentElement.dataset.theme = theme;
  setMix(theme === "midnight" ? 1 : 0);
  setTint(theme === "midnight" || section?.dataset.tint === "brass" ? 1 : 0);
}
function syncTheme() {
  const mid = window.innerHeight * 0.5;
  const current = Array.from(document.body.querySelectorAll<HTMLElement>("[data-theme]")).find((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= mid && r.bottom >= mid;
  });
  applyTheme(current);
}

/** In-page links (#work, /#work) scroll smoothly to their chapter. */
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
  // Capture phase: this must run before Astro's own link handler, which would jump natively first.
  document.addEventListener("click", onClick, true);
  cleanups.push(() => document.removeEventListener("click", onClick, true));
}

function startBackground() {
  const silk = document.getElementById("silk") as HTMLCanvasElement | null;
  if (silk) startSilk(silk);
  const dots = document.getElementById("particles") as HTMLCanvasElement | null;
  if (dots) startParticles(dots);

  // The material drifts with the page.
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: (self) => setScroll(self.scroll()) });

  // Each themed chapter takes over the page colours while it covers the middle of the screen.
  // Only sections inside the body: <html> carries data-theme too, as the current value.
  document.body.querySelectorAll<HTMLElement>("[data-theme]").forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      end: "bottom 50%",
      onEnter: () => applyTheme(section),
      onEnterBack: () => applyTheme(section),
    });
  });
  syncTheme();
}

type Key = { at: number; shape: string; x: number };

/** Strength of a section's cloud while it is kept in the background (data-faint, 0..1). */
function faintOf(host: HTMLElement) {
  return host.dataset.faint ? Number(host.dataset.faint) : FAINT;
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
  // Sections that ask for scenes directly. Showcase chapters drive the cloud themselves.
  const hosts = Array.from(document.body.querySelectorAll<HTMLElement>("[data-shapes]:not([data-item])"));
  if (!hosts.length) {
    // A page without any scenes (a case study) shows no particles.
    if (!document.querySelector("[data-showcase]")) setFade(0);
    return;
  }

  const firstShape = (hosts[0].dataset.shapes ?? "sphere").split(">")[0].split("@")[0];
  const firstX = hosts[0].dataset.centerUntil ? 0 : cloudX(hosts[0].dataset.side);

  // Load: scattered points gather into the first scene; the scroll takes over once that is done.
  // Scrolling during the load cuts it short: the scroll takes over from there.
  // data-faint-until on a section keeps the cloud faint (a background) up to that point of its
  // scroll, then brings it to full strength over the next stretch.
  // data-faint sets how faint (0 = hidden); FAINT when not given.
  const faintUntil = hosts[0].dataset.faintUntil ? Number(hosts[0].dataset.faintUntil) : -1;
  if (faintUntil > 0) setFade(faintOf(hosts[0]));
  const load = { t: 0 };
  const loadTl = gsap.timeline({ onComplete: () => (ready = true) });
  loadTl.to(load, { t: 1, duration: 3.2, ease: "power3.out", onUpdate: () => setBlend("scatter", firstShape, load.t, 0, firstX, 2) });
  let firstKeys: Key[] | null = null;
  function takeOverFromLoad() {
    if (ready) return;
    loadTl.kill();
    freezeCloud();
    if (firstKeys) firstKeys[0].shape = "current"; // start the scroll from what the load got to
    ready = true;
  }

  hosts.forEach((host, index) => {
    // Every section after the first starts from whatever the cloud shows when it arrives.
    const keys: Key[] = [{ at: 0, shape: index === 0 ? firstShape : "current", x: index === 0 ? firstX : 0 }];
    const pinned = host.querySelector(".sticky") !== null;
    // Pinned section: its scenes spread evenly over its scroll, beside the text until
    // data-side-until (fraction of the scroll), centred after; data-center-until centres the scenes
    // up to that point too (the intro's name). Plain section: one scene as it arrives.
    // "name@0.3" pins a scene to a point of the scroll; without "@" the scenes are spread evenly.
    const names = (host.dataset.shapes ?? "").split(">").filter(Boolean);
    const until = host.dataset.sideUntil ? Number(host.dataset.sideUntil) : Infinity;
    const centerUntil = host.dataset.centerUntil ? Number(host.dataset.centerUntil) : -1;
    const side = cloudX(host.dataset.side);
    names.forEach((entry, i) => {
      const [name, atText] = entry.split("@");
      const at = atText ? Number(atText) : pinned && names.length > 1 ? i / (names.length - 1) : 1;
      keys.push({ at, shape: name, x: at > centerUntil && at < until ? side : 0 });
    });
    if (index === 0) firstKeys = keys;

    ScrollTrigger.create({
      trigger: host,
      // Plain sections own the cloud while they cover the middle of the screen, like the showcases,
      // so two sections never drive it at once and a fast scroll cannot skip the hand-over.
      start: pinned ? "top top" : "top 50%",
      end: pinned ? "bottom bottom" : "bottom 50%",
      // Taking over the cloud: freeze what it shows now, so the section starts from there.
      onToggle: (self) => {
        if (!self.isActive) return;
        // The section takes the cloud: it sits in its [data-cloud] box (none = screen coordinates).
        setAnchor(host.querySelector<HTMLElement>("[data-cloud]"));
        if (!host.dataset.faintUntil) setFade(1);
        // Start from what the cloud shows now (also when coming back to the first section later),
        // so the section's scene forms from there instead of mixing with a stale shape.
        if (index > 0 || ready) {
          freezeCloud();
          keys[0].shape = "current";
        }
      },
      onUpdate: (self) => {
        if (!ready && self.progress > 0.02) takeOverFromLoad();
        if (ready) blendAlong(keys, self.progress);
        const until = host.dataset.faintUntil ? Number(host.dataset.faintUntil) : -1;
        const faint = faintOf(host);
        if (until > 0) setFade(faint + (1 - faint) * Math.min(Math.max((self.progress - until) / 0.12, 0), 1));
      },
    });
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

function animateRules() {
  document.querySelectorAll<HTMLElement>("[data-rule]").forEach((el) => {
    gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: EASE, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
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
  // Transparent at the top of the page; past that it has its glass surface, hides on scroll down
  // and returns on scroll up.
  ScrollTrigger.create({
    start: 40,
    end: "max",
    onToggle: (self) => header.classList.toggle("at-top", !self.isActive),
    onUpdate: (self) => header.classList.toggle("is-hidden", self.direction === 1 && self.scroll() > 200),
    onLeaveBack: () => header.classList.remove("is-hidden"),
  });
  // The link of the chapter on screen is marked (state indication for a long one-page scroll).
  header.querySelectorAll<HTMLAnchorElement>("a[href*='#']").forEach((link) => {
    const section = document.querySelector<HTMLElement>(link.hash);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      end: "bottom 50%",
      onToggle: (self) => link.toggleAttribute("aria-current", self.isActive),
    });
  });
}

function pageEnter() {
  // Whatever is above the fold rises in with a short stagger.
  const first = document.querySelector<HTMLElement>("[data-enter]");
  if (first) gsap.fromTo(first.children, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: EASE, delay: 0.1 });
}

export function startMotion() {
  document.documentElement.classList.add("js");
  if (reducedMotion()) {
    document.documentElement.classList.add("reduce-motion");
    // Static page in the colours of its first chapter; backgrounds render but do not move.
    const first = document.body.querySelector<HTMLElement>("[data-theme]");
    const midnight = first?.dataset.theme === "midnight";
    document.documentElement.dataset.theme = midnight ? "midnight" : "ivory";
    document.getElementById("site-header")?.classList.remove("at-top");
    const silk = document.getElementById("silk") as HTMLCanvasElement | null;
    if (silk) {
      setMix(midnight ? 1 : 0);
      startSilk(silk);
    }
    const dots = document.getElementById("particles") as HTMLCanvasElement | null;
    if (dots) {
      setTint(midnight ? 1 : 0);
      setBlend("galaxy", "galaxy", 1);
      setFade(0.3);
      startParticles(dots);
    }
    startShowcases(true);
    return;
  }

  startSmoothScroll();
  smoothAnchors();
  startBackground();
  animateScenes();
  startShowcases(false);
  pageEnter();
  animateHeadlines();
  animateRules();
  animateReveals();
  animateHeader();
  ScrollTrigger.refresh();
}

export function stopMotion() {
  stopShowcases();
  stopSilk();
  stopParticles();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.globalTimeline.clear();
  cleanups.forEach((fn) => fn());
  cleanups = [];
  ready = false;
}
