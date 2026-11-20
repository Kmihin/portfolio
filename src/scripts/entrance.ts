// The way into a case study. In the work room, "Full case study" plays its object's entrance
// (sculptures.ts: the chest opens and the view goes in, the villa's door opens and the view goes
// through, ...). As the view goes in, a veil in the colour of the object's inside covers the page,
// and the case page opens out of it.
//
// Motion purpose: spatial continuity; the case study lives inside its object. Under
// prefers-reduced-motion (or without the 3D scene) the link simply opens the page.
import gsap from "gsap";
import { navigate } from "astro:transitions/client";
import { enterWork } from "./sculptures";

// The colour of each object's inside: the colour its case page opens out of.
const TONES: Record<string, string> = {
  omnikeep: "blue",
  "stekner-house": "ivory",
  "azure-migration": "ivory",
  "rebac-authorization": "blue",
  mojbeach: "ivory",
  "document-platform": "ivory",
  "fuel-guide": "blue",
  "project-hub": "ivory",
};

// How long the veil takes to cover the page, at the end of the entrance (seconds).
const COVER = 0.55;

let entering = false;
let cleanup: (() => void) | null = null;

function onClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('[data-showcase="work"] a[href*="/work/"]');
  const veil = document.getElementById("veil");
  if (!link || !veil || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  event.preventDefault();
  if (entering) return;
  const href = link.getAttribute("href")!;
  // "/work/omnikeep" or "/sl/work/omnikeep": the slug is the last part.
  const slug = href.split("/").filter(Boolean).pop() ?? "";
  const seconds = enterWork(slug);
  if (seconds === 0) {
    navigate(href);
    return;
  }
  entering = true;
  veil.dataset.tone = TONES[slug] ?? "ivory";
  gsap.fromTo(
    veil,
    { opacity: 0 },
    { opacity: 1, duration: COVER, delay: Math.max(0, seconds - COVER), ease: "power1.in", onComplete: () => navigate(href) },
  );
}

export function startEntrances() {
  entering = false;
  // Arrived through the veil: it lifts off the new page.
  const veil = document.getElementById("veil");
  if (veil && Number(gsap.getProperty(veil, "opacity")) > 0) gsap.to(veil, { opacity: 0, duration: 0.9, delay: 0.2, ease: "power2.out" });
  // Before the router's own click handler, which would open the page at once.
  document.addEventListener("click", onClick, true);
  cleanup = () => document.removeEventListener("click", onClick, true);
}

export function stopEntrances() {
  cleanup?.();
  cleanup = null;
}
