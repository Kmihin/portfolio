// Site-wide motion. One script, started on every page load (also after Astro view transitions).
//
// What it does and why:
//  - Preloader: a counter runs to 100 while the 3D scene draws its first frame, then the curtain
//    lifts and the hero stages in (#preloader in Base.astro).
//  - Smooth scroll (Lenis), so the pinned scenes and the camera moves feel continuous.
//  - The journey (journey.ts): every [data-scene] section names a stop on the 3D camera path; the
//    section whose top has passed the middle of the screen and the next one give how far along the
//    path the camera is. The labels in the scene come from #scene-data (JSON on the page).
//    A [data-pin] section is pinned to the screen while its scroll plays out (data-pin="200" pins
//    for 200% of the viewport), like a scene in a film; inside it, [data-out] fades out over the
//    first half and [data-in] fades in over the second half.
//  - Custom cursor: a ring and a dot follow the pointer (#cursor), the ring grows over links.
//  - [data-split] headline words rise out of a clipped line; .reveal / .reveal-item rise and fade in;
//    [data-rule] draws in; [data-enter] stages in after the preloader; [data-count] counts up.
//  - Header: shows the current chapter number, hides on scroll down and returns on scroll up.
//
// Under prefers-reduced-motion: no preloader counter, no pinning, no cursor; the camera holds the
// first stop and the content is simply shown (CSS).
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { startJourney, stopJourney, setFlight, setPointer } from "./journey";
import type { JourneyData } from "./journey";

gsap.registerPlugin(ScrollTrigger);

const EASE = "expo.out";
let lenis: Lenis | null = null;
let cleanups: (() => void)[] = [];

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function finePointer() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Wraps every word of an element in a clipped span so it can rise into view. A child element
 *  (an <em>) keeps its tag and classes on each of its words. */
function splitWords(el: HTMLElement) {
  if (el.dataset.splitDone) return;
  const parts: { word: string; tag: string; className: string }[] = [];
  el.childNodes.forEach((node) => {
    const isEl = node instanceof HTMLElement;
    for (const word of (node.textContent ?? "").trim().split(/\s+/)) {
      if (word) parts.push({ word, tag: isEl ? node.tagName.toLowerCase() : "span", className: isEl ? node.className : "" });
    }
  });
  el.textContent = "";
  for (const part of parts) {
    const outer = document.createElement("span");
    outer.className = "split-word";
    const inner = document.createElement(part.tag);
    inner.className = `split-inner ${part.className}`.trim();
    inner.textContent = part.word;
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

/** In-page links (#work, /#work) scroll smoothly to their chapter. */
function smoothAnchors() {
  const onClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"], a[href^="/#"]');
    if (!link || (link.pathname !== location.pathname && link.getAttribute("href")?.startsWith("/"))) return;
    const target = document.querySelector<HTMLElement>(link.hash);
    if (!target) return;
    e.preventDefault();
    lenis?.scrollTo(target, { offset: -8, duration: 1.6 });
    history.pushState(null, "", link.hash);
  };
  // Capture phase: this must run before Astro's own link handler, which would jump natively first.
  document.addEventListener("click", onClick, true);
  cleanups.push(() => document.removeEventListener("click", onClick, true));
}

/** The preloader: counts to 100 (at least 1.4 s, and not before the scene has drawn), then lifts. */
function preload(sceneReady: Promise<void>) {
  const loader = document.getElementById("preloader");
  const counter = loader?.querySelector<HTMLElement>("[data-counter]");
  const finish = () => {
    loader?.remove();
    document.documentElement.classList.add("loaded");
    pageEnter();
  };
  if (!loader || !counter || reducedMotion()) {
    finish();
    return;
  }
  lenis?.stop();
  const state = { n: 0 };
  const count = gsap.to(state, { n: 100, duration: 1.4, ease: "power2.inOut", onUpdate: () => (counter.textContent = String(Math.round(state.n)).padStart(3, "0")) });
  Promise.all([count.then(), sceneReady]).then(() => {
    gsap
      .timeline({
        onComplete: () => {
          lenis?.start();
          finish();
        },
      })
      .to(counter, { yPercent: -120, autoAlpha: 0, duration: 0.5, ease: "power3.in" })
      .to(loader, { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, "-=0.1");
  });
}

/** The scene's labels, from the page (the case study pages have none: plain objects). */
function sceneData(): JourneyData {
  const el = document.getElementById("scene-data");
  try {
    if (el?.textContent) return JSON.parse(el.textContent) as JourneyData;
  } catch {
    // fall through to the plain scene
  }
  return { skills: ["", "", "", "", "", "", ""], work: ["", "", "", "", "", ""], facts: [] };
}

/** The camera follows the sections: the section whose top has passed the middle of the screen is
 *  the current stop, the way to the next section's top is the way to the next stop. */
function followStops(sections: HTMLElement[]) {
  const update = () => {
    const mid = window.innerHeight * 0.5;
    const tops = sections.map((s) => s.getBoundingClientRect().top);
    let i = 0;
    while (i < sections.length - 1 && tops[i + 1] <= mid) i++;
    const next = Math.min(i + 1, sections.length - 1);
    const span = tops[next] - tops[i];
    const t = next === i || span <= 0 ? 0 : (mid - tops[i]) / span;
    setFlight(sections[i].dataset.scene!, sections[next].dataset.scene!, t);
  };
  update();
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: update, onRefresh: update });
}

/** Pinned sections hold the screen while their scroll plays out; [data-out] and [data-in] inside
 *  them cross over. */
function pinScenes(sections: HTMLElement[]) {
  sections
    // A section taller than the screen is not pinned: its bottom would never be seen.
    .filter((s) => s.dataset.pin && s.offsetHeight <= window.innerHeight + 2)
    .forEach((section) => {
      const outs = section.querySelectorAll<HTMLElement>("[data-out]");
      const ins = section.querySelectorAll<HTMLElement>("[data-in]");
      const tl = gsap.timeline({ paused: true });
      if (outs.length) tl.fromTo(outs, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -40, duration: 0.3, ease: "none" }, 0.2);
      if (ins.length) tl.fromTo(ins, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "none" }, 0.45);
      tl.to({}, { duration: 0.25 }, 0.75); // hold to the end
      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: `+=${section.dataset.pin}%`,
        pin: true,
        scrub: true,
        onUpdate: (self) => tl.progress(self.progress),
      });
    });
}

/** Starts the 3D scene; resolves once it has drawn its first frame. */
function startScenes(still: boolean) {
  const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
  const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
  const first = sections[0]?.dataset.scene ?? "detail";
  setFlight(first, first, 0);
  const ready = new Promise<void>((resolve) => {
    if (!canvas) return resolve();
    startJourney(canvas, sceneData(), resolve);
  });
  if (!still && sections.length) {
    pinScenes(sections);
    followStops(sections);
  }
  return ready;
}

/** The custom cursor: a dot right on the pointer, a ring that trails it and grows over links. */
function startCursor() {
  const cursor = document.getElementById("cursor");
  if (!cursor || !finePointer()) return;
  const ring = cursor.querySelector<HTMLElement>(".cursor-ring")!;
  const dot = cursor.querySelector<HTMLElement>(".cursor-dot")!;
  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { x: target.x, y: target.y };
  const onMove = (e: PointerEvent) => {
    // Shown from the first move on, so it never waits in the middle of the screen.
    if (cursor.hidden) {
      cursor.hidden = false;
      ringPos.x = e.clientX;
      ringPos.y = e.clientY;
    }
    target.x = e.clientX;
    target.y = e.clientY;
    gsap.set(dot, { x: target.x, y: target.y });
    setPointer(e.clientX / innerWidth - 0.5, 0.5 - e.clientY / innerHeight);
    const hot = (e.target as HTMLElement).closest("a, button, [data-cursor]");
    cursor.classList.toggle("is-hot", !!hot);
  };
  const tick = () => {
    ringPos.x += (target.x - ringPos.x) * 0.18;
    ringPos.y += (target.y - ringPos.y) * 0.18;
    gsap.set(ring, { x: ringPos.x, y: ringPos.y });
  };
  window.addEventListener("pointermove", onMove);
  gsap.ticker.add(tick);
  cleanups.push(() => {
    window.removeEventListener("pointermove", onMove);
    gsap.ticker.remove(tick);
  });
}

function animateHeadlines() {
  document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
    splitWords(el);
    const inners = el.querySelectorAll(".split-inner");
    gsap.fromTo(
      inners,
      { yPercent: 110, y: 0 },
      { yPercent: 0, y: 0, duration: 1.1, ease: EASE, stagger: 0.04, scrollTrigger: { trigger: el, start: "top 85%", once: true } }
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
      { autoAlpha: 0, y: 32 },
      { autoAlpha: 1, y: 0, duration: 1, ease: EASE, stagger: 0.08, scrollTrigger: { trigger: block, start: "top 85%", once: true } }
    );
    if (items.length) gsap.set(block, { autoAlpha: 1 });
  });
}

/** Numbers count up from 0 when they enter ("10k+" keeps its suffix). */
function animateCounts() {
  document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
    const text = el.textContent ?? "";
    const match = text.match(/[\d.]+/);
    if (!match) return;
    const target = Number(match[0]);
    const suffix = text.slice(match.index! + match[0].length);
    const state = { n: 0 };
    el.textContent = "0" + suffix;
    gsap.to(state, {
      n: target,
      duration: 1.6,
      ease: "power3.out",
      onUpdate: () => (el.textContent = Math.round(state.n) + suffix),
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
  });
}

function animateHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;
  ScrollTrigger.create({
    start: 40,
    end: "max",
    onToggle: (self) => header.classList.toggle("at-top", !self.isActive),
    onUpdate: (self) => header.classList.toggle("is-hidden", self.direction === 1 && self.scroll() > 200),
    onLeaveBack: () => header.classList.remove("is-hidden"),
  });
  // The chapter counter shows the section on screen.
  const counter = header.querySelector<HTMLElement>("[data-chapter]");
  const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter-name]"));
  if (!counter || !sections.length) return;
  sections.forEach((section, i) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      end: "bottom 50%",
      onToggle: (self) => {
        if (self.isActive) counter.textContent = `${String(i + 1).padStart(2, "0")} / ${String(sections.length).padStart(2, "0")}  ${section.dataset.chapterName}`;
      },
    });
  });
}

function pageEnter() {
  const first = document.querySelector<HTMLElement>("[data-enter]");
  if (!first) return;
  if (reducedMotion()) {
    gsap.set(first.children, { autoAlpha: 1 });
    return;
  }
  gsap.fromTo(first.children, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.1, ease: EASE, delay: 0.1 });
}

export function startMotion() {
  document.documentElement.classList.add("js");
  if (reducedMotion()) {
    document.documentElement.classList.add("reduce-motion");
    document.getElementById("site-header")?.classList.remove("at-top");
    document.getElementById("cursor")?.remove();
    preload(startScenes(true));
    return;
  }

  startSmoothScroll();
  smoothAnchors();
  const ready = startScenes(false);
  startCursor();
  preload(ready);
  animateHeadlines();
  animateRules();
  animateReveals();
  animateCounts();
  animateHeader();
  ScrollTrigger.refresh();
}

export function stopMotion() {
  stopJourney();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.globalTimeline.clear();
  cleanups.forEach((fn) => fn());
  cleanups = [];
}
