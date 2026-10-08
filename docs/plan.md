# Plan

Done
- Content in `content/` (profile, services.json, 3 side projects, 4 anonymized professional case studies)
- Astro 7 + Tailwind 4, content collections, pages: /, /work, /work/[slug], /services, /about, /contact
- Design v1: black / warm white / gold, Archivo + Inter. Pinned Three.js particle intro (sphere -> ring -> grid) choreographed with GSAP ScrollTrigger, Lenis smooth scroll, scroll reveals
- Deployed on Cloudflare Pages (project `potfol`, https://potfol.pages.dev), auto-build on push to `main`
- Design v4 (branch design-v2): one-page scroll story (intro, expertise, work, what I offer, closing + contact), particle cloud forms a scene per step, old inner pages removed except /work/[slug]. Earlier:  smoked plum + silk beige woven by a full-page WebGL silk background, sections switch the page colours on scroll, Bricolage Grotesque + Geist self-hosted, home work grid and services bento, work index rows, case study with sticky facts and "Next" link, about with sticky identity column, contact page. Motion layer: smooth scroll, page transitions, split headlines, staggered reveals, parallax, curtain blocks, counters, card tilt, hide-on-scroll header, reading progress, technology marquee. See CLAUDE.md for tokens and rules.

Next
1. Review design v2 on the branch preview URL; merge to `main`, tag `design-v2`.
2. Portrait: add `public/portrait.jpg` (4:5) and it appears on About automatically.
3. Case-study covers: add `cover: /work/<slug>.jpg` to a study's frontmatter (file under `public/work/`) to show an image on the home card.
4. Slovenian version (Astro i18n routing, copy in content/profile.sl.md).
5. Custom domain on Cloudflare Pages.
6. Housekeeping in other repos: remove committed `.env`, write READMEs, rename mojbeach repo, archive AppOnStars.

Note: `npm install` must be run on the Mac, not from the Claude shell (Linux binaries).
