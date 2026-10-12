// Showcase chapters ([data-showcase]): one item is shown at a time and the chapter moves to the
// next one on its own every few seconds while it is on screen. The index entries and the arrows
// select an item directly. The particle cloud forms the scene of the item on show.
//
// The cycle runs whether or not the pointer is over the chapter. It pauses while the chapter is off
// screen or the tab is hidden, and waits longer after the visitor picks an item. Under
// prefers-reduced-motion nothing cycles and items switch without movement.
//
// Motion purpose: state indication (which item is on show) and preventing a jarring swap.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setBlend, freezeCloud, setAnchor, setFade } from "./particles";
import { bands } from "./cloud";

gsap.registerPlugin(ScrollTrigger);

const PAUSE_AFTER_PICK = 8; // seconds the cycle waits after the visitor chose an item
let cleanups: (() => void)[] = [];

function setup(host: HTMLElement, reduced: boolean) {
  const items = Array.from(host.querySelectorAll<HTMLElement>("[data-item]"));
  const entries = Array.from(host.querySelectorAll<HTMLElement>("[data-go]"));
  const bars = Array.from(host.querySelectorAll<HTMLElement>("[data-bar]"));
  const interval = Number(host.dataset.interval ?? 4);
  // The cloud sits in this box and scrolls with it.
  const box = host.querySelector<HTMLElement>("[data-cloud]");
  const x = 0;
  if (items.length < 2) return;

  let current = 0;
  let onScreen = false;
  let swap: gsap.core.Timeline | null = null;
  let scene: gsap.core.Timeline | null = null;
  let bar: gsap.core.Tween | null = null;
  let next: gsap.core.Tween | null = null;

  /** The scene of an item: "a" or "a>b" (b forms halfway through the item's time on show). */
  function scenes(item: HTMLElement) {
    return (item.dataset.shapes ?? "sphere").split(">").filter(Boolean);
  }

  /**
   * Taking the cloud over from another section: whatever it showed fades out where it is, the
   * item's scene appears in this chapter's box already formed, and fades in. No shape travels
   * across the page, so the chapter opens with the right picture.
   */
  function takeOver(item: HTMLElement) {
    if (reduced) return;
    scene?.kill();
    const [a] = scenes(item);
    const f = { v: 1 };
    scene = gsap.timeline();
    scene
      .to(f, { v: 0, duration: 0.5, ease: "power1.in", onUpdate: () => setFade(f.v) })
      .call(() => {
        setAnchor(box);
        setBlend(a, a, 1, x, x, bands(a));
      })
      .to(f, { v: 1, duration: 1.1, ease: "power2.out", onUpdate: () => setFade(f.v) });
  }

  /** Flows the cloud from whatever it shows into the item's scene, then into its second scene. */
  function showScene(item: HTMLElement) {
    if (reduced) return; // the cloud stands still under reduced motion (see motion.ts)
    scene?.kill();
    setFade(1);
    const [a, b] = scenes(item);
    // Start from exactly what is on screen now, even halfway through the previous flow.
    freezeCloud();
    const flow = { t: 0 };
    scene = gsap.timeline();
    scene.to(flow, { t: 1, duration: 1.8, ease: "power2.inOut", onUpdate: () => setBlend("current", a, flow.t, 0, x, bands(a)) });
    if (b) {
      const morph = { t: 0 };
      scene.to(morph, { t: 1, duration: 2, ease: "power2.inOut", onUpdate: () => setBlend(a, b, morph.t, x, x, bands(b)) }, interval * 0.5);
    }
  }

  /** Marks the index entry and restarts its fill, which shows how long until the next item. */
  function markIndex(i: number) {
    entries.forEach((entry, k) => entry.setAttribute("aria-pressed", String(k === i)));
    bar?.kill();
    bars.forEach((b) => gsap.set(b, { scaleX: 0 }));
    if (!reduced && bars[i]) bar = gsap.fromTo(bars[i], { scaleX: 0 }, { scaleX: 1, duration: interval, ease: "none", paused: !running() });
  }

  /** Crossfade: the old item lifts away blurred, the new one rises in. Interruptible at any point. */
  function show(i: number) {
    const from = items[current];
    const to = items[i];
    current = i;
    swap?.kill();
    swap = gsap.timeline();
    items.forEach((item) => item.setAttribute("aria-hidden", String(item !== to)));
    if (reduced) {
      swap.set(items, { autoAlpha: 0 }).set(to, { autoAlpha: 1 });
    } else {
      swap
        .to(from, { autoAlpha: 0, y: -14, filter: "blur(4px)", duration: 0.28, ease: "power2.out" }, 0)
        .fromTo(to, { autoAlpha: 0, y: 22, filter: "blur(4px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, 0.12);
    }
    markIndex(i);
    showScene(to);
  }

  function running() {
    return !reduced && onScreen && !document.hidden;
  }

  /** Schedules the next item; a pick by the visitor waits longer so they can read. */
  function schedule(delay = interval) {
    next?.kill();
    if (!running()) return;
    next = gsap.delayedCall(delay, () => {
      show((current + 1) % items.length);
      schedule();
    });
  }

  function pause() {
    next?.kill();
    bar?.pause();
  }
  function resume(delay = interval) {
    if (!running()) return;
    bar?.play();
    schedule(delay);
  }

  function pick(i: number) {
    show(i);
    schedule(PAUSE_AFTER_PICK);
    bar?.timeScale(interval / PAUSE_AFTER_PICK); // the fill takes the longer wait
  }

  entries.forEach((entry, i) => entry.addEventListener("click", () => pick(i)));
  host.querySelector("[data-prev]")?.addEventListener("click", () => pick((current - 1 + items.length) % items.length));
  host.querySelector("[data-next]")?.addEventListener("click", () => pick((current + 1) % items.length));

  const onVisibility = () => (document.hidden ? pause() : resume());
  document.addEventListener("visibilitychange", onVisibility);

  // The chapter owns the cloud and cycles while it covers the middle of the screen.
  let trigger: ScrollTrigger | null = null;
  if (!reduced) {
    trigger = ScrollTrigger.create({
      trigger: host,
      start: "top 50%",
      end: "bottom 50%",
      onToggle: (self) => {
        onScreen = self.isActive;
        if (onScreen) {
          takeOver(items[current]);
          markIndex(current);
          resume();
        } else {
          pause();
          scene?.kill();
          setFade(1);
        }
      },
    });
  }

  // Start state: the first item is visible, the others are not.
  gsap.set(items, { autoAlpha: 0 });
  gsap.set(items[0], { autoAlpha: 1 });
  items.forEach((item, k) => item.setAttribute("aria-hidden", String(k !== 0)));
  markIndex(0);

  cleanups.push(() => {
    trigger?.kill();
    swap?.kill();
    scene?.kill();
    bar?.kill();
    next?.kill();
    document.removeEventListener("visibilitychange", onVisibility);
  });
}

export function startShowcases(reduced: boolean) {
  document.querySelectorAll<HTMLElement>("[data-showcase]").forEach((host) => setup(host, reduced));
}

export function stopShowcases() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
}
