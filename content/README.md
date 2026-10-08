# Content

- `profile.md`: positioning, bio, services, contact.
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
links: { repo: "", live: "" }   # optional
featured: true | false
cover: /work/<slug>.jpg         # optional, file under public/work/, shown on the home card
```
Body sections: Problem, What I did, Stack, Result.

Portrait for the About page: `public/portrait.jpg` (4:5). Shown automatically when the file exists.
Copy: no em dashes in visible text (see CLAUDE.md).
