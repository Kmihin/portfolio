# Plan

Done
- Content in `content/` (profile, services.json, 3 side projects, 4 anonymized professional case studies)
- Astro 7 + Tailwind 4, content collections, pages: /, /work, /work/[slug], /services, /about, /contact
- Design: black / warm white / gold, Archivo + Inter. Pinned Three.js particle intro (sphere → ring → grid) choreographed with GSAP ScrollTrigger, Lenis smooth scroll, scroll reveals

Next
1. Review in `npm run dev`; tune copy, motion, colours.
2. Photo (content/photo.jpg) on About.
3. Slovenian version (Astro i18n routing, copy in content/profile.sl.md).
4. Deploy: Cloudflare Pages, build `npm run build`, output `dist`. Domain later.
5. Housekeeping in other repos: remove committed `.env`, write READMEs, rename mojbeach repo, archive AppOnStars.

Note: `npm install` must be run on the Mac, not from the Claude shell (Linux binaries).
