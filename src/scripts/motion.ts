// The motion layer: smooth scrolling (Lenis), everything that moves with the scroll (GSAP
// ScrollTrigger, SplitText) and the link between the page and the 3D scene (scene.ts).
// Base.astro calls startMotion() on every page load and stopMotion() before the page is swapped.
//
// Hooks in the markup:
//   data-stop="name"    section: the chrome flows to that stop as the section arrives (scene.ts STOPS)
//   data-stop-late      with data-stop: a second stop the chrome moves on to inside the section
//   data-skill          a skill in the expertise list: the active one has its own drop of chrome
//   data-split          heading: its lines rise into place when it enters
//   data-scrub          paragraph: its words light up one by one as it scrolls through
//   data-enter          appears as soon as the page opens (hero, case study header)
//   .reveal             container: its children fade up one after another when it enters
//   data-count          a number that counts up when it enters ("10k+")
//   data-unveil         image frame that opens up as it scrolls in
//   data-pan            section that turns vertical scroll into a sideways move of [data-pan-track]
//   data-magnetic       button that leans towards the pointer
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { sceneIsRunning, setActiveDrop, setJourney, startScene } from "./scene";

gsap.registerPlugin(ScrollTrigger, SplitText);

const MOTION_OK = "(prefers-reduced-motion: no-preference)";
const WIDE = "(min-width: 1024px)";
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

let lenis: Lenis | null = null;
let media: gsap.MatchMedia | null = null;

export function startMotion() {
  startChrome();

  media = gsap.matchMedia();
  // Pinned sections first: everything created after them measures the page with the pin in place.
  media.add(`${MOTION_OK} and ${WIDE}`, panSideways);
  media.add(MOTION_OK, () => {
    smoothScroll();
    openPage();
    splitHeadings();
    scrubWords();
    revealGroups();
    countNumbers();
    unveilImages();
  });
  media.add(`${MOTION_OK} and ${FINE_POINTER}`, magneticButtons);

  followJourney();
  followSkills();
  hideHeaderOnScroll();
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

export function stopMotion() {
  media?.revert();
  media = null;
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  if (lenis) {
    gsap.ticker.remove(tickLenis);
    lenis.destroy();
    lenis = null;
  }
  document.removeEventListener("click", scrollToAnchor);
}

/* ---------- The 3D scene ---------- */

/** Start the scene (once; the canvas survives page changes). */
function startChrome() {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene");
  if (canvas) startScene(canvas);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Tell the scene where the scroll is between two stops. The section that came on screen last is
 * the one being travelled to: the journey from the stop before it starts when its top enters the
 * screen and is done when the top is two thirds of the way up. A section with a second stop
 * (data-stop-late) then travels on to that one while it scrolls through.
 */
function followJourney() {
  const sections = gsap.utils.toArray<HTMLElement>("[data-stop]");
  if (sections.length === 0) return;

  const update = () => {
    const viewport = window.innerHeight;
    let index = 0;
    sections.forEach((section, i) => {
      if (section.getBoundingClientRect().top < viewport) index = i;
    });
    const section = sections[index];
    const box = section.getBoundingClientRect();
    const stop = section.dataset.stop!;
    const lateStop = section.dataset.stopLate;
    const before = sections[index - 1];
    const stopBefore = before ? (before.dataset.stopLate ?? before.dataset.stop!) : stop;

    const arriving = clamp01((viewport - box.top) / (viewport * 0.66));
    if (arriving < 1 || !lateStop) {
      setJourney(stopBefore, stop, arriving);
      return;
    }
    const through = clamp01(-box.top / Math.max(1, box.height - viewport));
    setJourney(stop, lateStop, clamp01((through - 0.2) / 0.5));
  };

  ScrollTrigger.create({ start: 0, end: "max", onUpdate: update, onRefresh: update });
  update();
}

/** The expertise list: the skill crossing the middle of the screen is lit, and its drop of chrome swells. */
function followSkills() {
  const skills = gsap.utils.toArray<HTMLElement>("[data-skill]");
  skills.forEach((skill, index) => {
    ScrollTrigger.create({
      trigger: skill,
      start: "top 58%",
      end: "bottom 58%",
      onToggle: (self) => {
        if (!self.isActive) return;
        skills.forEach((other) => other.classList.toggle("is-active", other === skill));
        setActiveDrop(index);
      },
    });
  });
}

/* ---------- Scrolling ---------- */

function tickLenis(time: number) {
  lenis?.raf(time * 1000);
}

function smoothScroll() {
  lenis = new Lenis({ autoRaf: false, lerp: 0.11 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(tickLenis);
  gsap.ticker.lagSmoothing(0);
  document.addEventListener("click", scrollToAnchor);
}

/** Links to a section of the page that is already open ("/#work") scroll there smoothly. */
function scrollToAnchor(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/#"]');
  if (!link || !lenis || location.pathname !== "/") return;
  const target = document.querySelector<HTMLElement>(link.hash);
  if (!target) return;
  event.preventDefault();
  lenis.scrollTo(target, { duration: 1.4 });
}

/** The header slides away while scrolling down and returns on the way up. */
function hideHeaderOnScroll() {
  const header = document.querySelector("#header");
  if (!header) return;
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => header.classList.toggle("is-hidden", self.direction === 1 && self.scroll() > 300),
  });
}

/** Vertical scroll moves the track sideways while the section stays pinned (wide screens only). */
function panSideways() {
  gsap.utils.toArray<HTMLElement>("[data-pan]").forEach((section) => {
    const track = section.querySelector<HTMLElement>("[data-pan-track]");
    if (!track) return;
    const distance = () => track.scrollWidth - window.innerWidth;
    gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
  });
}

/* ---------- Type ---------- */

/** The page opens: the name rises letter by letter, then the rest of the first screen follows. */
function openPage() {
  // When the 3D scene runs it draws the name itself (and wipes it in); the page's h1 is animated
  // only when there is no scene.
  const name = sceneIsRunning() ? null : document.querySelector<HTMLElement>("#hero-name");
  const rest = gsap.utils.toArray<HTMLElement>("[data-enter]");
  const timeline = gsap.timeline({ delay: sceneIsRunning() ? 0.9 : 0.2 });

  if (name) {
    const split = SplitText.create(name, { type: "chars", mask: "chars" });
    gsap.set(name, { opacity: 1 });
    timeline.from(split.chars, { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.045 });
  }
  timeline.fromTo(rest, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1 }, name ? "-=0.6" : 0);
}

/** Headings: each line rises out of its own clipped box when the heading enters the screen. */
function splitHeadings() {
  gsap.utils.toArray<HTMLElement>("[data-split]").forEach((heading) => {
    SplitText.create(heading, {
      type: "lines",
      mask: "lines",
      linesClass: "split-line",
      autoSplit: true,
      onSplit: (split) => {
        gsap.set(heading, { opacity: 1 });
        return gsap.from(split.lines, {
          yPercent: 105,
          duration: 1,
          ease: "power4.out",
          stagger: 0.09,
          scrollTrigger: { trigger: heading, start: "top 88%", once: true },
        });
      },
    });
  });
}

/** A paragraph read by the scroll: its words go from dim to full, one after another. */
function scrubWords() {
  gsap.utils.toArray<HTMLElement>("[data-scrub]").forEach((paragraph) => {
    const split = SplitText.create(paragraph, { type: "words" });
    gsap.fromTo(
      split.words,
      { opacity: 0.16 },
      {
        opacity: 1,
        ease: "none",
        stagger: 0.1,
        scrollTrigger: { trigger: paragraph, start: "top 78%", end: "bottom 45%", scrub: true },
      },
    );
  });
}

/* ---------- Reveals ---------- */

function revealGroups() {
  gsap.utils.toArray<HTMLElement>(".reveal").forEach((group) => {
    gsap.fromTo(
      group.children,
      { opacity: 0, y: 32 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: group, start: "top 85%", once: true },
      },
    );
  });
}

/** "10k+" counts from 0 to 10 and keeps whatever follows the number. */
function countNumbers() {
  gsap.utils.toArray<HTMLElement>("[data-count]").forEach((element) => {
    const match = element.textContent?.match(/^(\d+)(.*)$/);
    if (!match) return;
    const counter = { value: 0 };
    gsap.to(counter, {
      value: Number(match[1]),
      duration: 1.6,
      ease: "power2.out",
      scrollTrigger: { trigger: element, start: "top 88%", once: true },
      onUpdate: () => {
        element.textContent = Math.round(counter.value) + match[2];
      },
    });
  });
}

/** An image frame opens from a cropped window to its full size while the image inside settles. */
function unveilImages() {
  gsap.utils.toArray<HTMLElement>("[data-unveil]").forEach((frame) => {
    const scrollTrigger = { trigger: frame, start: "top 92%", end: "top 35%", scrub: true };
    gsap.fromTo(frame, { clipPath: "inset(14% 10% 14% 10% round 20px)" }, { clipPath: "inset(0% 0% 0% 0% round 20px)", ease: "none", scrollTrigger });
    gsap.fromTo(frame.querySelector("img"), { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger });
  });
}

/* ---------- Pointer ---------- */

function magneticButtons() {
  const buttons = gsap.utils.toArray<HTMLElement>("[data-magnetic]");
  const cleanups = buttons.map((button) => {
    const moveX = gsap.quickTo(button, "x", { duration: 0.5, ease: "power3.out" });
    const moveY = gsap.quickTo(button, "y", { duration: 0.5, ease: "power3.out" });
    const onMove = (event: PointerEvent) => {
      const box = button.getBoundingClientRect();
      moveX((event.clientX - box.left - box.width / 2) * 0.3);
      moveY((event.clientY - box.top - box.height / 2) * 0.3);
    };
    const onLeave = () => {
      moveX(0);
      moveY(0);
    };
    button.addEventListener("pointermove", onMove);
    button.addEventListener("pointerleave", onLeave);
    return () => {
      button.removeEventListener("pointermove", onMove);
      button.removeEventListener("pointerleave", onLeave);
    };
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}
