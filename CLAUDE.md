# Portfolio site — Kristjan Mihin

Personal portfolio and freelance site. Owner: Kristjan Mihin, full-stack developer (.NET / Azure / React), Slovenia.

## Stack
- Astro (static output), Tailwind CSS, TypeScript.
- Client JS: three, gsap (ScrollTrigger), lenis, loaded via <script> in Astro components. Keep scripts small and commented. No UI framework on the client.
- Design: black (#0a0a0a) base, warm white (#f3efe6) type, gold (#c9a24a) accents; Archivo (display) + Inter (body). Home intro: pinned Three.js particle cloud (src/scripts/particles.ts) choreographed with GSAP ScrollTrigger (Intro.astro), Lenis smooth scroll. Content lives in `content/` as Markdown with frontmatter. Pages are built from it; never hardcode case-study text in components.
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
- `/` home: positioning, services, selected work, contact
- `/work` all case studies, `/work/[slug]` detail
- `/services`
- `/about`
- `/contact` (mailto or form)

## Workflow
- Run `npm run dev` for preview, `npm run build` must pass before commit.
- Commit messages: short imperative English.
