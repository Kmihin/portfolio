"""The CV (one A4 page, English and Slovenian) and the share image, made from the site's own
content with a headless browser (Playwright with Chromium).

    python3 build.py cv       -> public/cv/kristjan-mihin-cv-en.pdf and -sl.pdf
    python3 build.py share    -> public/og.png (1200 x 630; needs `npm run dev` on port 4321)

The CV takes its text from content/: the contact details from profile.md, the about text and the
path from home/<lang>.json, the case studies (summaries) and the skills (titles)."""
import json
import os
import sys
import time
from html import escape
from pathlib import Path

import yaml
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "content"
FONTS = ROOT / "node_modules" / "@fontsource-variable"

LABELS = {
    "en": {
        "profile": "Profile",
        "path": "Experience and education",
        "work": "Selected work",
        "skills": "Skills",
        "languages": "Languages",
        "spoken": "Slovenian (native), English (fluent)",
        "site": "Portfolio",
        "professional": "Professional",
        "project": "Own product",
    },
    "sl": {
        "profile": "Profil",
        "path": "Izkušnje in izobrazba",
        "work": "Izbrani projekti",
        "skills": "Znanje",
        "languages": "Jeziki",
        "spoken": "slovenščina (materni jezik), angleščina (tekoče)",
        "site": "Portfelj",
        "professional": "V službi",
        "project": "Lastni produkt",
    },
}


def front_matter(path):
    """The YAML at the top of a Markdown file."""
    text = path.read_text(encoding="utf-8")
    return yaml.safe_load(text.split("---")[1])


def case_studies(lang):
    """Work from employment, then my own products; featured ones only (the CV has one page)."""
    base = CONTENT if lang == "en" else CONTENT / "sl"
    studies = []
    for folder in ("professional", "projects"):
        for path in sorted((base / folder).glob("[!_]*.md")):
            data = front_matter(path)
            if data.get("featured") or folder == "professional":
                studies.append(data)
    return studies


def font_faces():
    """The site's fonts: Bodoni Moda and Geist, the latin and latin-ext files (č, š, ž)."""
    faces = []
    for family, file, style in (
        ("Bodoni", "bodoni-moda/files/bodoni-moda-{}-wght-normal.woff2", "normal"),
        ("Bodoni", "bodoni-moda/files/bodoni-moda-{}-wght-italic.woff2", "italic"),
        ("Geist", "geist/files/geist-{}-wght-normal.woff2", "normal"),
    ):
        for subset in ("latin", "latin-ext"):
            url = (FONTS / file.format(subset)).as_uri()
            faces.append(f'@font-face {{ font-family: {family}; font-style: {style}; font-weight: 100 900; src: url("{url}"); }}')
    return "\n".join(faces)


def cv_html(lang):
    home = json.loads((CONTENT / "home" / f"{lang}.json").read_text(encoding="utf-8"))
    profile = front_matter(CONTENT / "profile.md")
    skills = json.loads(((CONTENT if lang == "en" else CONTENT / "sl") / "skills.json").read_text(encoding="utf-8"))
    labels = LABELS[lang]
    site = "https://potfol.pages.dev" + ("/sl/" if lang == "sl" else "/")

    path_items = "".join(
        f"<li><span class='years'>{escape(step['years'])}</span><strong>{escape(step['title'])}</strong><span class='place'>{escape(step['place'])}</span></li>"
        for step in reversed(home["about"]["path"])
    )
    work_items = "".join(
        f"<li><strong>{escape(study['title'])}</strong> <span class='kind'>{labels[study['type']]}, {escape(str(study['year']))}</span><p>{escape(study['summary'])}</p></li>"
        for study in case_studies(lang)
    )
    skill_items = ", ".join(escape(skill["title"]) for skill in skills)
    about = "".join(f"<p>{escape(line)}</p>" for line in home["about"]["paragraphs"])

    return f"""<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><style>
{font_faces()}
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: Geist, sans-serif; font-size: 9.6pt; line-height: 1.48; color: #0d172b; background: #f8f3ea; }}
.page {{ width: 210mm; height: 297mm; padding: 14mm 15mm; display: grid; grid-template-columns: 62mm 1fr; gap: 9mm; }}
h1 {{ font-family: Bodoni; font-weight: 600; font-size: 34pt; line-height: 0.95; letter-spacing: -0.01em; }}
h1 em {{ display: block; color: #a6814e; }}
.role {{ margin-top: 3mm; font-size: 7.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: #4f5666; }}
h2 {{ font-family: Bodoni; font-weight: 600; font-size: 13.5pt; margin: 7mm 0 3mm; padding-bottom: 1.2mm; border-bottom: 0.6pt solid #c9a86a; }}
aside h2:first-of-type {{ margin-top: 8mm; }}
.contact p {{ margin-bottom: 1mm; overflow-wrap: anywhere; }}
.muted, .place, .kind {{ color: #4f5666; }}
.path li {{ list-style: none; margin-bottom: 2.6mm; }}
.path .years {{ display: block; color: #a6814e; font-size: 7.5pt; letter-spacing: 0.06em; }}
.path strong, .path .place {{ display: block; }}
main p + p {{ margin-top: 2mm; }}
.work li {{ list-style: none; margin-bottom: 3.2mm; }}
.work strong {{ font-weight: 600; }}
.work .kind {{ font-size: 7.5pt; }}
.work p {{ margin-top: 0.6mm; }}
</style></head><body><div class="page">
<aside>
  <h1>Kristjan<em>Mihin</em></h1>
  <p class="role">{escape(home["hero"]["role"])}</p>
  <h2>{"Kontakt" if lang == "sl" else "Contact"}</h2>
  <div class="contact">
    <p>{escape(profile["email"])}</p>
    <p>{escape(profile["linkedin"].replace("https://www.", ""))}</p>
    <p>{escape(profile["github"].replace("https://", ""))}</p>
    <p>{labels["site"]}: {escape(site.replace("https://", ""))}</p>
    <p class="muted">{escape(home["contact"]["location"])}</p>
  </div>
  <h2>{labels["path"]}</h2>
  <ul class="path">{path_items}</ul>
  <h2>{labels["skills"]}</h2>
  <p>{skill_items}</p>
  <h2>{labels["languages"]}</h2>
  <p>{labels["spoken"]}</p>
</aside>
<main>
  <h2 style="margin-top:0">{labels["profile"]}</h2>
  {about}
  <h2>{labels["work"]}</h2>
  <ul class="work">{work_items}</ul>
</main>
</div></body></html>"""


def build_cv():
    out = ROOT / "public" / "cv"
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for lang in ("en", "sl"):
            html = ROOT / "tools" / "print" / f"cv-{lang}.html"
            html.write_text(cv_html(lang), encoding="utf-8")
            page.goto(html.as_uri())
            page.wait_for_timeout(300)
            page.pdf(path=str(out / f"kristjan-mihin-cv-{lang}.pdf"), format="A4", print_background=True)
            html.unlink()
        browser.close()


def build_share():
    """The hero of the running site at 1200 x 630, without the header, buttons and stack line."""
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        page = browser.new_page(viewport={"width": 1200, "height": 630})
        page.goto("http://localhost:4321/", wait_until="networkidle")
        page.add_style_tag(content="#site-header, .hero-copy .btn, .hero-copy .link, .stack-list { visibility: hidden !important; } .hero-grid { min-height: 630px !important; padding-top: 0 !important; padding-bottom: 0 !important; } astro-dev-toolbar { display: none !important; }")
        time.sleep(9)
        page.screenshot(path=str(ROOT / "public" / "og.png"))
        browser.close()


if __name__ == "__main__":
    if sys.argv[1] == "cv":
        build_cv()
    else:
        build_share()
