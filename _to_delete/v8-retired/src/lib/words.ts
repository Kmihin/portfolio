// Splits a title into words for rendering. Hyphenated words ("e-CMR", "Small-business") are marked
// so the markup can keep them on one line from sm up: a break after the hyphen reads badly in display
// type. On phones the break is allowed, a long hyphenated word would overflow otherwise.
export function words(title: string) {
  return title.split(" ").map((text) => ({ text, nowrap: text.includes("-") }));
}
