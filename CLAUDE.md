# Portfolio site — Kristjan Mihin

Personal portfolio and freelance site. Owner: Kristjan Mihin, full-stack developer (.NET / Azure / React), Slovenia.

## Stack
- Astro (static output), Tailwind CSS, TypeScript.
- Client JS: three, gsap (ScrollTrigger), lenis, loaded via <script> in Astro components. Keep scripts small and commented. No UI framework on the client.
- Design (v3): two colours only, smoked plum (#5b4058 / deep #3d2a3b) and silk beige (#e9dfcf / light #f6f0e5), woven through each other. A fixed full-page WebGL silk background (`src/scripts/silk.ts`, Three.js shader: draped diagonal folds, sheen, grain; drifts with scroll, bends toward the pointer) blends between the two. Sections carry `data-theme="beige" | "plum"`; `motion.ts` switches `<html data-theme>` when a section reaches mid-screen, the silk eases to that colour and the text palette follows via CSS variables (`--ink`, `--muted`, `--line`, `--panel`, `--contrast`). Tailwind colour tokens map to those variables (`text-ink`, `bg-contrast`, `border-line`, `.panel` translucent blur panel, `.panel-strong` solid). Fonts self-hosted via @fontsource-variable: Bricolage Grotesque (display) + Geist (body). Sharp corners everywhere (no border-radius). Motion: one layer in `src/scripts/motion.ts` (GSAP ScrollTrigger + Lenis), started on `astro:page-load` and torn down on `astro:before-swap` (Astro view transitions fade between pages). Hooks are data attributes: `data-split` (word-by-word headline rise), `.reveal` / `.reveal-item` (rise + stagger), `data-parallax`, `data-curtain` (clip-path uncover), `data-scrub` (children rise/scale tied to scroll, reversible), `data-hpan` + `data-hpan-track` (pinned horizontal pan on lg), `data-count`, `data-tilt` (pointer tilt on cards), `data-enter` (above-the-fold load-in). The home intro (Intro.astro) owns its own 300vh scroll timeline over the silk: name, word-by-word statement, scroll-driven counters. A full-page particle layer (`src/scripts/particles.ts`, Three.js points, fixed above the silk) forms whatever scene the section on screen asks for: `[data-shapes]` / `[data-story]` steps are read in page order by `motion.ts` and turned into keyframes, so the cloud morphs sphere -> ring -> wave through the intro and then scene to scene down the page (tech marks from the `simple-icons` package, C#, Azure, SQL as lettering because Microsoft marks are not in that set; drawn scenes in `shapes.ts`). `data-side` says where the text is; the cloud goes to the other side on wide screens. Dots are plum on beige sections and beige on plum sections. CSS motion tokens in global.css; hover effects gated behind `(hover: hover) and (pointer: fine)`; everything honours `prefers-reduced-motion` (`.reduce-motion` html class disables start states; the silk still renders, static). Content lives in `content/` as Markdown with frontmatter. Pages are built from it; never hardcode case-study text in components.
- Copy rules: no em/en dashes in visible text (use commas, colons, periods, or a plain hyphen for ranges); no uppercase "eyebrow" labels above headings; no scroll cues.
- Deploy target: Cloudflare Pages (static). Keep the build host-agnostic.

## Code conventions
- Simple, readable code. No clever abstractions.
- No inline styles. Tailwind utility classes or scoped component CSS.
- Small components, one responsibility each.
- Type all frontmatter with Astro content collections (`src/content.config.ts`).
- English UI. Slovenian translation may come later; keep strings in content, not in markup.

## Content rules
- Professional work (Trinet) is described anonymously: no client names, no screenshots with real data, no internal system names beyond what is in `content/professional/`.
- Side projects may link to GitHub repos.
- AI-assisted scaffolding (Lovable) is disclosed where used.

## Pages
- `/` is the whole site, one scroll: Intro (name, statement, facts) -> `#skills` Expertise story -> `#work` Work story -> `#offer` What I offer story -> `#contact` closing statement + contact. The header links scroll to these anchors.
- Stories are `Story.astro`: a pinned stage, one viewport per step; text on alternating sides, the particle cloud forms the step's scene on the other side (`shapes: "a>b"` morphs during the step). Scenes are named in `src/scripts/shapes.ts` (drawn primitives) and `src/scripts/particles.ts` (tech marks). Skills come from `content/skills.json`, services from `content/services.json` (each with a `shape`), work from the case-study collections with the scene per slug set in `index.astro`.
- `/work/[slug]` detail pages still exist for the professional case studies (linked as "Full case study" when a study has no live site or repo).

## Workflow
- Run `npm run dev` for preview, `npm run build` must pass before commit.
- Commit messages: short imperative English.
