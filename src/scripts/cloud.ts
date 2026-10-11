// Shared helpers for placing the particle cloud, used by motion.ts and showcase.ts.

const SIDE_OFFSET = 3.0; // world units the cloud moves away from the text on wide screens

export function wideScreen() {
  return window.innerWidth >= 1024;
}

/** Cloud x position for a text side: away from the text on wide screens, centred otherwise. */
export function cloudX(textSide: string | undefined) {
  if (!wideScreen() || !textSide || textSide === "center") return 0;
  return textSide === "right" ? -SIDE_OFFSET : SIDE_OFFSET;
}

/** How many currents the points travel in: one per part of the scene they are forming, at least two. */
export function bands(shape: string) {
  return Math.max(shape.split("+").length, 2);
}
