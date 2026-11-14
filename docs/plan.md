# Plan

Done
- Content in `content/` (profile, services.json, 3 side projects, 4 anonymized professional case studies)
- Astro 7 + Tailwind 4, content collections, pages: /, /work, /work/[slug], /services, /about, /contact
- Design v1: black / warm white / gold, Archivo + Inter. Pinned Three.js particle intro (sphere -> ring -> grid) choreographed with GSAP ScrollTrigger, Lenis smooth scroll, scroll reveals
- Deployed on Cloudflare Pages (project `potfol`, https://potfol.pages.dev), auto-build on push to `main`
- Design v4 (branch design-v2): one-page scroll story (intro, expertise, work, what I offer, closing + contact), particle cloud forms a scene per step, old inner pages removed except /work/[slug]. Earlier:  smoked plum + silk beige woven by a full-page WebGL silk background, sections switch the page colours on scroll, Bricolage Grotesque + Geist self-hosted, home work grid and services bento, work index rows, case study with sticky facts and "Next" link, about with sticky identity column, contact page. Motion layer: smooth scroll, page transitions, split headlines, staggered reveals, parallax, curtain blocks, counters, card tilt, hide-on-scroll header, reading progress, technology marquee. See CLAUDE.md for tokens and rules.

- Design v5 (branch design-v3): midnight velvet, warm ivory travertine, brushed brass; Bodoni Moda + Geist; velvet / stone shader background; Expertise, Work and What I offer as self-cycling showcases with a clickable index and arrows (no pinned scrolling except the intro); brass seams between the materials; header hidden on the opening screen, marks the chapter on screen. See CLAUDE.md.

- Design v8, "Liquid" (Nov 2026): light page, one dark chapter, a body of liquid chrome and glass (Three.js MarchingCubes, transmission glass) that splits and merges with the scroll; Mona Sans with its width axis; GSAP SplitText, Lenis. Replaces the v7 journey through islands. See CLAUDE.md.

Next
1. Review design v8 on a real screen and phone; branch `design-v8`, then merge to `main`.
2. Case-study covers: only Omnikeep has screenshots; MojBeach and Fuel Guide would gain most from one each.
3. Slovenian version (Astro i18n routing, copy in content/profile.sl.md).
4. Custom domain on Cloudflare Pages.
5. Housekeeping in other repos: remove committed `.env`, write READMEs, rename mojbeach repo, archive AppOnStars.

Note: `npm install` must be run on the Mac, not from the Claude shell (Linux binaries).
