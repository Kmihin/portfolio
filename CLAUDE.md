# Portfolio site, Kristjan Mihin

Personal portfolio and freelance site. Owner: Kristjan Mihin, full-stack developer (.NET / Azure / React), Slovenia.

## Stack
- Astro (static output), Tailwind CSS, TypeScript.
- Client JS: three, gsap (ScrollTrigger, SplitText), lenis, loaded via <script> in Astro components. Keep scripts small and commented. No UI framework on the client.
- Design (v8, "Porcelain"): porcelain white #f4f3ef is the page, graphite #16181d the type, cobalt #2e5bff the one accent, used sparingly (main button, highlighted words, label dots, the lit item in lists). Calm, not shiny: satin and brushed metal, almost no glow or bloom. The picture is one object that transforms (`src/scripts/scene.ts`, three.js, one fixed canvas behind the page that also draws the background and the hero's name; the DOM h1 stays transparent under `html.scene-on`, its lines give their colours with `data-color`). At rest it is a processor chip in its real layers: solder balls, a laminated substrate printed with traces, rings of capacitors, a silicon interposer on its bumps, two compute dies, an I/O die and two memory stacks on micro bumps (circuit pictures painted by `tools/blender/textures.py`) framed in cobalt, a thermal layer, and a brushed heat spreader marked "KM". All objects come from `public/models/objects.glb` (made by `tools/blender/build.py export` from `objects.py`; one node per object, the chip's layers named Balls, Substrate, Components, Bumps, Interposer, DieLine, MicroBumps, Die, Thermal, Lid, the house's Terrace, Ground, Upper, Roof with an empty Living; painted pictures and normal maps are kept from the model; the site's materials use no anisotropy, as untextured parts carry no UVs). In the work list the model becomes the object of the lit case study (rows carry `data-shape`, the list `data-spot-shapes`), and on a case study page the object of that study (`data-shape-page` on the article). Every change dissolves the old object along a soft cobalt edge while the new one builds itself (`prepare` in scene.ts). Every section names a stop (`data-stop`, `STOPS`): the model moves there and the chip opens into its layers as far as the stop says (`open`, an exploded view) or closes; in the closing chapter (`Closing.astro`, stops "chaos" and "order") the page turns graphite, the layers scatter, then the chip closes (`html.on-dark`). On a case study page the text keeps to the left (`.case-column`, a soft veil behind it) and the object tells its story on the right while the page is read (the scroll through the article, `setStory` from motion.ts): its parts move as keyframed in Blender (`key()` in objects.py, frames 0 to 100, exported as one animation and split by object in scene.ts), the view moves as `STORIES` in scene.ts says (the house: round it, floors lifted apart, then down into its living room). On phones the story plays in a box under the title. Nothing turns on its own: the model leans a little towards the pointer and a click lifts the layers for a moment; not on touch, not with reduced motion. On screens under 1024px the model stands in the empty box a section keeps for it (`.stage` / `data-stage`), elsewhere small in the top corner, and the work rows show their pictures. Without WebGL the hero shows a still of the chip (`public/models/chip-still.webp`, `html.no-scene`). Interface: light liquid glass (`.glass`), pill buttons, panels 22px.
- Pictures: `public/covers/<slug>.webp`, one per case study, the same objects rendered in Blender on a light grey backdrop a shade darker than the page, with soft shadows (`tools/blender/build.py render`). Shown on phones in the work list (a case study without screenshots has no cover image: its 3D object is the picture). Real product screenshots stay in `public/projects/`.
- Copy rules: no em/en dashes in visible text (use commas, colons, periods, or a plain hyphen for ranges).
- Deploy target: Cloudflare Pages (static). Keep the build host-agnostic.

## Design rules
- `docs/design-rules.md` is the checklist for every design change (anti-slop, animation, website basics, UI details, visual references). Read the relevant parts before design work, check the change against it after, and update the status column when an open item is done.

## Code conventions
- Simple, readable code. No clever abstractions.
- No inline styles. Tailwind utility classes or scoped component CSS.
- Small components, one responsibility each.
- Type all frontmatter with Astro content collections (`src/content.config.ts`).
- English UI. Slovenian translation may come later; keep strings in content, not in markup.

## Content rules
- The transport / logistics field I work in now is never named (I cannot take projects in that field): the e-CMR work is shown in general terms as `document-platform.md` ("Digital document exchange platform"), the ReBAC work as "Security, roles and rights for a B2B platform"; the carrier import stays hidden (`_carrier-data-import.md`, skipped by the collections). The apartment site is not named ("Holiday apartment website").
- Professional work (Trinet) is described anonymously: no client names, no screenshots with real data, no internal system names beyond what is in `content/professional/`.
- Side projects may link to GitHub repos.
- AI-assisted scaffolding (Lovable) is disclosed where used.

## Pages
- `/` is the whole site, one page: `#home` hero (`Hero.astro`: the name (drawn by the scene behind the model), one line, two buttons, a short note) -> `#about` (`About.astro`: portrait, the first sentence read word by word by the scroll, two paragraphs; `Facts.astro`: four figures counting up) -> `#work` Selected work (`WorkList.astro`: the own product with screenshots large, then the rest in two groups, professional work and own products; on wide screens the model beside the list becomes each study's object, on phones each row has its picture) -> `#skills` What I work with (`Expertise.astro`, from `content/skills.json`) -> `#offer` What I offer (`Offer.astro`, cards from `content/services.json`, a sideways row on wide screens) -> `#closing` (`Closing.astro`, the dark chapter, 220vh with sticky content) -> `#contact` (`Contact.astro`: the email as the main action, copy button, links, footer line; the home page passes `footer={false}` to Base).
- Work comes from the case-study collections (featured first, then most recent).
- `/404` (`src/pages/404.astro`): the model, a short message and a button back home.
- Header (`Header.astro`): a pill of liquid glass with the name, links and the cobalt contact button; under 768px a menu button opens a glass panel with the section links. Contact has a "Copy email" button beside the email. Share image: `public/og.jpg` (a still of the hero), touch icon `public/apple-touch-icon.png`.
- `/work/[slug]` is a page for every case study: title, tagline and summary, the cover, the feature grid (`CaseFeatures.astro`), a sticky panel with role, stack tags and links beside the markdown body; a "Next" band and `Footer.astro`.

## Workflow
- Run `npm run dev` for preview, `npm run build` must pass before commit.
- Commit messages: short imperative English.
