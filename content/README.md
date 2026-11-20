# Content

- `profile.md`: contact details, and positioning, experience, education and bio for reference (the repo is public: no employer, client or field names).
- `home/en.json`, `home/sl.json`: the home page's copy (hero, about with the facts and the path, room titles, closing, contact) and every UI label, per language.
- `sl/`: the Slovenian case studies, skills and services, the same files as here, translated.
- `projects/`: side projects with public code (one file each).
- `professional/`: anonymized case studies from employment.

Frontmatter per case study:
```yaml
title:
slug:
type: project | professional
year:
summary:        # one sentence
stack: []
role:
featured: true | false
tagline:                        # optional, one line under the title on the case study page
links: { repo: "", live: "", liveLabel: "", liveNote: "" }   # optional; liveLabel defaults to "Live site"
cover: { src: /projects/<slug>/<file>.webp, alt: "", width: , height: }   # optional, top of the case study page
features:                       # optional, a grid on the case study page; image is optional
  - { text: "", image: { src: "", alt: "", width: , height: } }
featuresNote:                   # optional, small text under the grid
```
Images go in `public/projects/<slug>/`, used as they are, with their real width and height.
Body sections: Problem, What I did, Stack, Result.

Copy: no em dashes in visible text (see CLAUDE.md).
