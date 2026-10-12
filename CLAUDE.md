# Portfolio site, Kristjan Mihin

Personal portfolio and freelance site. Owner: Kristjan Mihin, full-stack developer (.NET / Azure / React), Slovenia.

## Stack
- Astro (static output), Tailwind CSS, TypeScript.
- Client JS: three, gsap (ScrollTrigger), lenis, loaded via <script> in Astro components. Keep scripts small and commented. No UI framework on the client.
- Design (v7, "ivory paper, navy marble, brass", from my own mockup on top of the v5 structure and motion): the page is warm ivory paper (#f6f0e5 area, shader stone #f9f5ed / #f1e9db with faint gold veins) with deep navy ink (#0d172b) and brass (#a6814e on ivory, #c9a86a on navy) for the surname, italic second lines of headings, chapter numbers on a short brass line, the main button, link underlines and icons. Work and the closing are on the midnight velvet (#121f3a / deep #070c19, ivory text). A fixed full-page WebGL background (`src/scripts/silk.ts`) renders stone or velvet and eases between them; chapters carry `data-theme="ivory" | "midnight"`, `motion.ts` switches `<html data-theme>` at mid-screen and the text palette follows via CSS variables (`--ink`, `--muted`, `--line`, `--panel`, `--contrast`, `--accent`). `Seam.astro` (brass star on a hairline) marks each change of material. Fonts self-hosted via @fontsource-variable: Bodoni Moda (display; the hero name at weight 600) + Geist (body). Sharp corners. The hero art `public/hero-art.webp` (my photo over a navy marble with gold veins and a thin gold circle) and `public/mountains.webp` were cut from my mockup, upscaled 2x and made transparent where the paper was, so they sit on the page's own paper. Motion: one layer in `src/scripts/motion.ts` (GSAP ScrollTrigger + Lenis), hooks `data-split`, `data-rule`, `.reveal` / `.reveal-item`, `data-enter`, `.shield`, `data-showcase` (chapters that cycle through their items on their own, `src/scripts/showcase.ts`). Header: KM monogram with a brass line, the chapter links, "Let's talk" on the right; transparent at the top of the page, glass after, hides on scroll down and returns on scroll up, marks the chapter on screen; in-page links scroll smoothly (capture-phase click handler). The home intro (`Intro.astro`) owns a 320vh pinned scroll timeline: hero (eyebrow, name with the surname in brass, line, "View my work" and "About me", the art on the right, the stack listed on the marble, a scroll mark on the left; no particles) -> 01 About me (two paragraphs, three parts of the work with line icons, mountains lower right) -> brass counters over a turning particle globe. `#home` and `#about` are anchor spans inside the pinned section. Particles (`src/scripts/particles.ts`): `[data-shapes]` sections become scroll keyframes, showcases flow the cloud into each item's scene; `data-faint` / `data-faint-until` keep a section's cloud hidden or faint up to a point; dots are midnight on stone and brass on velvet; a page without scenes shows none. Everything honours `prefers-reduced-motion`. Content lives in `content/`; never hardcode case-study text in components.
- Copy rules: no em/en dashes in visible text (use commas, colons, periods, or a plain hyphen for ranges); the hero eyebrow, chapter numbers and the scroll mark from my mockup are intended.
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
- `/` is the whole site, one scroll: Intro (ivory, pinned: hero, 01 About me, facts) -> `#skills` 02 Tech Expertise (ivory) -> seam -> `#work` 03 Selected Work (velvet) -> seam -> `#offer` 04 What I Offer (ivory) -> seam -> `#contact` closing statement + contact (velvet). The three chapters are `Showcase.astro` (number, two-line title, lead, clickable index, one item on show with arrows, the cloud forming its scene on the right, advancing on its own).
- Scenes are named in `src/scripts/shapes.ts` (drawn primitives) and `src/scripts/particles.ts` (tech marks). Skills come from `content/skills.json`, services from `content/services.json` (each with a `shape`), work from the case-study collections (`label` is the short index name) with the scene per slug set in `index.astro`.
- `/work/[slug]` detail pages still exist for the professional case studies (linked as "Full case study" when a study has no live site or repo).

## Workflow
- Run `npm run dev` for preview, `npm run build` must pass before commit.
- Commit messages: short imperative English.
