// Rooms with a list ([data-showcase]): one item is shown at a time. The index entries and the arrows
// pick an item; while the room is on screen it also moves on to the next item every few seconds
// (data-interval, 15 by default), and a brass line under the picked entry fills up until then. It
// pauses while the room is off screen; a pick starts the wait again. The room's sculpture follows
// the pick (sculptures.ts: the prism turns to the skill, the work room shows the case study's
// object), named by data-showcase ("work", "prism", "balance").
//
// Motion purpose: state indication (which item is on show, how long until the next) and a calm swap
// of the text. Under prefers-reduced-motion nothing moves on by itself and the text swaps without
// movement.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { pick } from "./sculptures";

gsap.registerPlugin(ScrollTrigger);

let cleanups: (() => void)[] = [];

function setup(host: HTMLElement) {
  const room = host.dataset.showcase ?? "";
  const items = Array.from(host.querySelectorAll<HTMLElement>("[data-item]"));
  const entries = Array.from(host.querySelectorAll<HTMLElement>("[data-go]"));
  const bars = Array.from(host.querySelectorAll<HTMLElement>("[data-bar]"));
  const interval = Number(host.dataset.interval ?? 15);
  if (items.length === 0) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = 0;
  let onScreen = false;
  // The wait for the next item: the bar under the picked entry filling up, then the next item.
  let wait: gsap.core.Tween | null = null;

  function startWait() {
    wait?.kill();
    bars.forEach((bar) => gsap.set(bar, { scaleX: 0 }));
    if (reduced || items.length < 2) return;
    wait = gsap.fromTo(bars[current], { scaleX: 0 }, { scaleX: 1, duration: interval, ease: "none", paused: !onScreen, onComplete: () => show(current + 1) });
  }

  function show(index: number) {
    const next = (index + items.length) % items.length;
    const before = items[current];
    const after = items[next];
    entries.forEach((entry, i) => entry.setAttribute("aria-pressed", i === next ? "true" : "false"));
    pick(room, next);
    if (next !== current) {
      // Quick clicks: any swap still running ends at once, so only the last two items move.
      items.forEach((item) => {
        gsap.killTweensOf(item);
        if (item !== before) gsap.set(item, { autoAlpha: 0, y: 0 });
      });
      if (reduced) {
        gsap.set(before, { autoAlpha: 0 });
        gsap.set(after, { autoAlpha: 1 });
      } else {
        gsap.to(before, { autoAlpha: 0, y: -10, duration: 0.25, ease: "power2.in" });
        gsap.fromTo(after, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out", delay: 0.15 });
      }
    }
    current = next;
    startWait();
  }

  items.forEach((item, i) => gsap.set(item, { autoAlpha: i === 0 ? 1 : 0 }));
  pick(room, 0);
  startWait();

  // Only while the room is on screen does the wait run.
  const trigger = ScrollTrigger.create({
    trigger: host,
    start: "top 70%",
    end: "bottom 30%",
    onToggle: (self) => {
      onScreen = self.isActive;
      if (onScreen) wait?.resume();
      else wait?.pause();
    },
  });

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const entry = target.closest<HTMLElement>("[data-go]");
    if (entry) show(Number(entry.dataset.go));
    if (target.closest("[data-prev]")) show(current - 1);
    if (target.closest("[data-next]")) show(current + 1);
  };
  host.addEventListener("click", onClick);
  cleanups.push(() => {
    host.removeEventListener("click", onClick);
    trigger.kill();
    wait?.kill();
  });
}

export function startShowcases() {
  document.querySelectorAll<HTMLElement>("[data-showcase]").forEach(setup);
}

export function stopShowcases() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
}
