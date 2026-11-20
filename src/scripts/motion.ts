// Site-wide motion. One script, started on every page load (also after Astro view transitions).
//
// What it animates and why:
//  - Smooth scroll (Lenis) so the reveals and the sculptures follow the page calmly.
//  - sculptures          the marble and brass sculpture of every room, drawn in its slot
//                        ([data-sculpture], sculptures.ts); started once, it lives across pages.
//  - [data-showcase]     rooms with a list: picking an item shows it (showcase.ts).
//  - [data-split]        headline words rise out of a clipped line when the heading enters.
//  - [data-rule]         a hairline draws in from the left when it enters.
//  - .reveal             blocks rise and fade in as they enter; .reveal-item children stagger.
//  - [data-enter]        above-the-fold content stages in on load.
//  - header              transparent on the opening screen, then glass; hides on scroll down, returns
//                        on scroll up; the link of the room on screen is marked; anchor links scroll
//                        smoothly to their room.
//
// Everything is skipped under prefers-reduced-motion: CSS then shows all content statically.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { startSculptures } from "./sculptures";
import { startShowcases, stopShowcases } from "./showcase";
import { startEntrances, stopEntrances } from "./entrance";

gsap.registerPlugin(ScrollTrigger);

const EASE = "expo.out";
let lenis: Lenis | null = null;
let cleanups: (() => void)[] = [];

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

/** In-page links (#work, /#work, /sl/#work on that page) scroll smoothly to their chapter. */
function smoothAnchors() {
  const onClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="#"]');
    if (!link || link.pathname !== location.pathname) return;
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

function startScene() {
  const canvas = document.getElementById("sculptures") as HTMLCanvasElement | null;
  if (canvas) startSculptures(canvas);
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
  startScene();
  startEntrances();
  if (reducedMotion()) {
    document.documentElement.classList.add("reduce-motion");
    document.getElementById("site-header")?.classList.remove("at-top");
    startShowcases();
    return;
  }

  startSmoothScroll();
  smoothAnchors();
  startShowcases();
  pageEnter();
  animateHeadlines();
  animateRules();
  animateReveals();
  animateHeader();
  ScrollTrigger.refresh();
}

export function stopMotion() {
  stopShowcases();
  stopEntrances();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.globalTimeline.clear();
  cleanups.forEach((fn) => fn());
  cleanups = [];
}
