# Design rules

Checklist for any agent changing the look or behaviour of this site. Read it before design
work, and check the finished change against it. Sources: four tip lists the owner collected
(Nov 2026) plus visual references; adapted to this site (Astro, static, one page, 3D scene).
Every rule says what it means here. "Status" marks what the current design (v8 "Porcelain")
already does and what is still open.

## 1. Remove AI slop

| Rule | What it means here | Status |
|---|---|---|
| Delete filler badges | No "New", "Available", version or status pills unless they carry real state. | done |
| Drop redundant labels | A small label above a heading only when it adds information. Max one label per three sections. | done |
| No random italics | Emphasis with weight, never by italicising single words. | done |
| Mono only where needed | Geist Mono only for tags, small meta (year, kind) and labels. Never body text or headings. | done |
| Use the design system | Only tokens from `src/styles/global.css` (`@theme`, `--glass-*`, `--radius-*`). No new colours, radii or shadows inline. | done |
| Show the actual product | Real screenshots, never fake UI built from divs. Every case study has a generated illustration in `public/covers/` (clearly an illustration, not a screenshot). Still missing: real screenshots of MojBeach and Fuel Guide. | open |
| Enlarge the main feature | One thing per section is clearly the biggest (featured study, the name, the email). | done |
| Group with spacing | Group by space first, lines second, cards last. | done |
| Specific headlines | Headlines say something about Kristjan, not generic ("Selected work" is acceptable, "Unleash your potential" never). | check per change |
| Emphasise the CTA | One primary action per screen: ink pill (`.btn-primary`). Contact = "Get in touch" everywhere. | done |
| One accent colour | Orange `#ff4d1a` (`--color-accent`), as text `--color-accent-ink`. No second accent. | done |
| Consistent icons | One icon family, one stroke width. The site uses no icons now; if added, pick one library. | n/a |
| Remove embellishments | No decorative dots, lines, scroll cues, section numbers, glows that carry no meaning. | done |
| Inner radius = outer radius - padding | Framed images use `--radius-framed` = `--radius-panel` - `--frame-padding`. | done |
| Text contrast | Body text 4.5:1, large text 3:1, on glass too and in the dark chapter. Check muted text on light glass. | check per change |
| Wrap headlines properly | `text-wrap: balance` on headings, `pretty` on paragraphs; no single word on the last line. | done |
| Align by eye | Optical alignment: big type gets a small negative margin (the name uses `-0.04em`). | done |
| Tabular numbers | Numbers that count up or line up get the `.tabular` class (`tabular-nums`) so they do not jitter. | done |
| Loading states | Images show the surface colour until loaded; the canvas fades in (`html.scene-on #scene`). | done |
| Animate useful feedback | Motion confirms an action (press, copy, send), not decoration. | done |

## 2. Animation

| Rule | What it means here | Status |
|---|---|---|
| Ease-out for entrances | Things entering use `power3.out` / `power4.out` (GSAP) or `--ease-out`. | done |
| Ease-in-out for moves | Things moving from A to B on screen (the model between stops) use ease-in-out. | done |
| Dropdowns and small UI 150-250ms | Hover and small state changes 150-300ms. Big scroll reveals may be longer (0.8-1.1s). | done |
| Exits 20% shorter than entrances | When something leaves, it leaves faster than it came. | check per change |
| Stagger list rows by ~30-50ms | `.reveal` children stagger; keep it short for long lists (currently 80ms, fine for 2-4 items). | check |
| Scale to 0.97 on press | `.btn:active { scale: 0.97 }`. Every clickable surface gets press feedback. | done |
| No bounce on everyday UI | No elastic or back easing on buttons, cards, header. No springs anywhere. | done |
| Start popovers at 0.95 | The phone menu scales in from 0.95 at its button's corner. Do the same for any new popover. | done |
| Enter from and exit to the trigger | The phone menu grows from its button (`transform-origin: top right`) and closes faster (160ms vs 220ms). | done |
| Arcs for object movement | Large objects travel on curves, not straight lines (the model's journey between stops). | done |
| Overlap old and new states | Crossfade, never blank in between (screen card wipe, palette blend). | done |
| Masks for reveals | Text lines rise out of clipped boxes (SplitText masks). | done |
| Crossfade icons + blur | Swaps crossfade with a short blur (copy button labels; menu icon lines turn into a cross). | done |
| Don't tween while held | While the pointer is down, follow it directly; ease only after release. | for future drag |
| Interruptible animations | Every animation can be reversed mid-way without a jump (scene eases to targets every frame). | done |
| Pulse to confirm success | "Copy email" in Contact: label crossfades to "Copied" with a pulse, announced to screen readers. | done |
| Reduced motion | Everything honours `prefers-reduced-motion`. | done |

## 3. Website basics (vibe-coded site fixes)

| Rule | What it means here | Status |
|---|---|---|
| No horizontal scroll | `html { overflow-x: clip }`; test at 360px wide. Negative margins (the active skill pane) must stay smaller than the page margin. | done |
| No broken links | Check every href after changes (work pages, GitHub, LinkedIn, mailto). | check per change |
| Mobile menu | Under 768px a menu button in the header bar opens a glass panel with the section links; a link, Escape or a tap outside closes it. | done |
| Favicon | `public/favicon.svg` and `public/apple-touch-icon.png` (180px). | done |
| Page titles + meta description | `Base.astro` sets both; every page passes its own. | done |
| Open Graph image | `public/og.jpg` (1200x630, a still of the hero), set in `Base.astro` with `twitter:card`. Re-take it when the hero changes. | done |
| Custom 404 page | `src/pages/404.astro`: the model, a short message, one button back. | done |
| Footer links + copyright year | Year is computed (`new Date().getFullYear()`). | done |
| Compress images | WebP/JPEG, real width/height, `loading="lazy"` below the fold. | done |
| Clickable logo | The name in the header links to `/#home`. | done |
| Clickable email | `mailto:` link plus a "Copy email" button. | done |
| No placeholder text, no unused nav | Every nav link points to a real section. | done |
| Mobile optimise | Test 375px and 390px: header, hero, services column, case pages. | check per change |

## 4. UI details

| Rule | What it means here | Status |
|---|---|---|
| Balanced headlines | `text-wrap: balance` on all headings. | done |
| Tabular numbers | See section 1. | done |
| Continuous corners | `@supports (corner-shape: squircle)` turns glass panels (not `.pill`) into squircles with a 1.6x radius. | done |
| Hit slop | Small text links get `.hit` (an invisible 44px tap area). Buttons are at least 44px high. | done |
| Safe area insets | `viewport-fit=cover`; `.wrap` and the header use `env(safe-area-inset-*)`. | done |
| View transitions | Astro `ClientRouter` between pages; the canvas persists. | done |
| Pre-rendering | Static output; nothing rendered on the client that could be built. | done |
| Blur placeholders | Screenshots show the surface colour before they load (no blurred preview yet). | partly |
| Skeleton loaders, optimistic updates, undo toasts, command menu, shortcut hints, stale-while-revalidate, idempotency keys, one-time-code autofill, predictive back, swipe sheets, safe triangle | App patterns. Not needed on a static portfolio; use them in the products (Omnikeep, MojBeach) instead. | n/a |

## 5. Visual references

Dashboards by "paulcodes" (V18, V22) the owner liked, for the glass language:

- Light, airy base with large soft colour washes (lavender in V18; mint/teal with peach in V22),
  never flat white and never full dark.
- White and frosted-glass panels with generous radius (~20px), thin light borders, soft
  coloured shadows. Panels float over the wash.
- One dark element per view as an anchor (V22: a dark teal banner and sidebar). Here: the ink
  primary button and the dark closing chapter.
- One saturated accent used sparingly (V18 orange label, V22 peach/orange chips). Here: orange.
- Real objects as visuals (3D rendered blobs in the thumbnails). Here: the chip and the case study objects (Blender models) and their pictures rendered in Blender in `public/covers/`.
- Motion: panels blur in and settle (blur + opacity + small y), lists stagger.

Earlier references: shopify.com/editions (cinematic, editorial), shader.se (3D objects, playful),
valentime.noomoagency.com (scroll journey through a 3D scene).

## 6. Tools

- Skills on the owner's account to use for design work: `design-taste-frontend`,
  `emil-design-eng`, `animate` (all the animation rules above come from the same school).
- `github.com/higgsfield-ai/skills`: Higgsfield AI image and video generation skills
  (generate, soul, product-photoshoot). Needs a Higgsfield account. Useful for making
  case-study covers or an OG image; not part of the site code.

## How to use this file

1. Before a design change: read sections 1-4 for the parts you touch.
2. After it: check every "check per change" row, and update a row's status when you close it.
3. Do not add a rule here without the owner's say.
