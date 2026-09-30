#!/usr/bin/env python3
"""Build the static case study pages.

    python3 build.py            write/refresh the pages
    python3 build.py --check    exit 1 if any page is out of date (writes nothing)

For every slug in content/manifest.json this reads content/case-studies-md/<slug>.md
and writes <name>.html in the project root (name = slug without its year prefix,
e.g. 2022-gas-stations -> gas-stations.html, linked without ".html"),
using templates/case-study.html.
The full case text is in the HTML, so readers that don't run JavaScript
(AI tools, link previews) can see it. The generated files are committed;
GitHub Pages serves them as plain static files.

Needs (dev machine only): pip3 install -r requirements.txt
"""

import json
import re
import sys
from pathlib import Path

import yaml
from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parent
CONTENT_DIR = ROOT / "content" / "case-studies-md"
MANIFEST = ROOT / "content" / "manifest.json"
TEMPLATE = ROOT / "templates" / "case-study.html"
OUT_DIR = ROOT
SITE_NAME = "Olha Kirdiaieva"

md = MarkdownIt("commonmark", {"html": True}).enable(["table", "strikethrough"])


def escape(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def page_name(slug):
    """2022-gas-stations -> gas-stations (the year stays in the slug, not the URL)."""
    return re.sub(r"^\d{4}-", "", slug)


def parse_frontmatter(raw):
    m = re.match(r"^\s*---\r?\n(.*?)\r?\n---\r?\n?(.*)$", raw, re.S)
    if not m:
        return {}, raw.strip()
    return (yaml.safe_load(m.group(1)) or {}), m.group(2).strip()


def resolve_embed_src(name):
    return name if "/" in name else f"images/{name}"



def replace_obsidian_embeds(text):
    """![[file.png]] -> <img>; ![[compare: a.png | b.png]] -> before/after slider."""
    def sub(match):
        inner = match.group(1).strip()

        cmp = re.match(r"^compare\s*:\s*(.+)$", inner, re.I)
        if cmp:
            parts = [p.strip() for p in cmp.group(1).split("|") if p.strip()]
            if len(parts) == 2:
                before, after = parts
                return (
                    '\n<div class="md-compare" style="--pos:50%">'
                    f'<img class="cmp-img cmp-after" src="{escape(resolve_embed_src(after))}" alt="After redesign" draggable="false" loading="lazy" decoding="async" />'
                    f'<div class="cmp-before-wrap"><img class="cmp-img cmp-before" src="{escape(resolve_embed_src(before))}" alt="Before redesign" draggable="false" loading="lazy" decoding="async" /></div>'
                    '<div class="cmp-handle" role="slider" tabindex="0" aria-label="Drag to compare before and after" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">'
                    '<span class="cmp-line"></span>'
                    '<span class="cmp-grip"><i class="ti ti-arrows-move-horizontal"></i></span>'
                    "</div></div>\n"
                )

        src = resolve_embed_src(inner)
        label = re.sub(r"\.[a-z0-9]+$", "", re.sub(r"^.*/", "", inner), flags=re.I).strip()
        return (f'\n<img class="md-embed" src="{escape(src)}" alt="{escape(label)}" '
                f'data-label="{escape(label)}" loading="lazy" decoding="async" />\n')

    return re.sub(r"!\[\[([^\]]+)\]\]", sub, text)


def apply_heading_ids(html):
    """`## Title {#my-id}` -> <h2 id="my-id">Title</h2> (stable ids for analytics)."""
    return re.sub(r"<h([23])>(.*?)\s*\{#([a-z0-9-]+)\}\s*</h\1>",
                  r'<h\1 id="\3">\2</h\1>', html, flags=re.I)


def render_body(body):
    return apply_heading_ids(md.render(replace_obsidian_embeds(body)))


def cover_markup(meta):
    if meta.get("cover"):
        return (f'<div class="ph has-image"><img src="{escape(meta["cover"])}" '
                f'alt="{escape(meta.get("title", ""))}" loading="eager" decoding="async" /></div>')
    return '<div class="ph"><span>hero shot — product UI</span></div>'


def quote_markup(meta):
    if not meta.get("testimonial"):
        return ""
    by = f'<div class="by">— {escape(meta["testimonial_by"])}</div>' if meta.get("testimonial_by") else ""
    return f'<div class="cs-quote"><p>{escape(meta["testimonial"])}</p>{by}</div>'


def nav_markup(slug, slugs):
    if slug not in slugs or len(slugs) < 2:
        return ""
    total = len(slugs)
    idx = slugs.index(slug)
    prev_idx, next_idx = (idx - 1) % total, (idx + 1) % total
    return f"""
      <div class="cs-next">
        <a href="{page_name(slugs[prev_idx])}" class="btn btn-ghost prev">
          <i class="ti ti-arrow-left"></i> <span class="cs-label">Previous<span class="cs-word"> case</span></span> <span class="cs-count">{prev_idx + 1}/{total}</span>
        </a>
        <a href="{page_name(slugs[next_idx])}" class="btn btn-ghost next">
          <span class="cs-count">{next_idx + 1}/{total}</span> <span class="cs-label">Next<span class="cs-word"> case</span></span> <i class="ti ti-arrow-right"></i>
        </a>
      </div>"""


def content_markup(slug, slugs, meta, body):
    tags = "".join(
        f'<span class="chip" style="font-size:12px;padding:5px 11px">{escape(t)}</span>'
        for t in (meta.get("tags") or [])
    )
    if body.strip():
        body_html = f'<div class="cs-prose">{render_body(body)}</div>'
    else:
        body_html = ('<div class="cs-notice">✏️ This case study is currently being written. Full write-up, '
                     "visuals, and outcomes are coming soon — the structure and details below will be filled in.</div>")
    lead = f'<p class="lead">{escape(meta["summary"])}</p>' if meta.get("summary") else ""

    return f"""
    <section class="cs-hero">
      <div class="wrap">
        <a class="back-link" href="./#case-{escape(page_name(slug))}"><i class="ti ti-arrow-left"></i> All work</a>
        <div class="case-tags">{tags}</div>
        <h1>{escape(meta.get("title") or slug)}</h1>
        {lead}
      </div>
    </section>

    <div class="wrap cs-cover">
      {cover_markup(meta)}
    </div>

    <div class="wrap">
      <div class="cs-body">
        {body_html}
        {quote_markup(meta)}
        {nav_markup(slug, slugs)}
      </div>
    </div>
  """


def build_page(template, slug, slugs):
    meta, body = parse_frontmatter((CONTENT_DIR / f"{slug}.md").read_text(encoding="utf-8"))
    title = f'{meta.get("title") or "Case study"} — {SITE_NAME}'
    values = {
        "title": escape(title),
        "description": escape(meta.get("summary") or ""),
        "slug": escape(slug),
        "content": content_markup(slug, slugs, meta, body),
    }
    return re.sub(r"\{\{(\w+)\}\}", lambda m: values[m.group(1)], template)


def main():
    check = "--check" in sys.argv[1:]
    slugs = json.loads(MANIFEST.read_text(encoding="utf-8"))
    template = TEMPLATE.read_text(encoding="utf-8")

    names = [page_name(s) for s in slugs]
    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        sys.exit(f"Two studies would share a page name: {', '.join(sorted(dupes))}")

    stale = []
    for slug in slugs:
        out = OUT_DIR / f"{page_name(slug)}.html"
        html = build_page(template, slug, slugs)
        if out.exists() and out.read_text(encoding="utf-8") == html:
            continue
        stale.append(out.name)
        if not check:
            out.write_text(html, encoding="utf-8")

    if check:
        if stale:
            print("Out of date (run python3 build.py): " + ", ".join(stale))
            sys.exit(1)
        print("All case study pages are up to date.")
    elif stale:
        print("Wrote: " + ", ".join(stale))
    else:
        print("Nothing to update.")


if __name__ == "__main__":
    main()
