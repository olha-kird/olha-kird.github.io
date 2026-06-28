/* ───────────────────────────────────────────────
   Shared site logic: load markdown content, render
   homepage work cards + case study pages in the
   handcrafted-paper design.
   Content pipeline is unchanged — markdown files in
   content/case-studies/ + content/manifest.json,
   parsed with js-yaml, rendered with marked.
─────────────────────────────────────────────── */

const CONTENT_DIR = "content/case-studies";
const MANIFEST_URL = "content/manifest.json";

/* ── markdown helpers ── */

function parseFrontmatter(raw) {
  const match = raw.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };
  let meta = {};
  try {
    meta = jsyaml.load(match[1]) || {};
  } catch (e) {
    console.error("Frontmatter parse error:", e);
  }
  return { meta, body: (match[2] || "").trim() };
}

/* Bare names resolve to the images/ folder; paths with a slash are used as-is. */
function resolveEmbedSrc(name) {
  return name.includes("/") ? name : `images/${name}`;
}

/* Obsidian-style ![[file.png]] -> real <img>, with the striped paper
   placeholder shown only when the file is missing (handled by
   hookEmbedFallbacks after the markup is inserted).

   Before/after redesign slider — opt in per image with the `compare:` prefix:
     ![[compare: before.png | after.png]]
   Renders a draggable vertical divider: `before` shows left of the line,
   `after` to the right. Both images should share the same dimensions. */
function replaceObsidianEmbeds(md) {
  return md.replace(/!\[\[([^\]]+)\]\]/g, (_, raw) => {
    const inner = String(raw).trim();

    const cmp = inner.match(/^compare\s*:\s*(.+)$/i);
    if (cmp) {
      const parts = cmp[1].split("|").map((s) => s.trim()).filter(Boolean);
      if (parts.length === 2) {
        const [before, after] = parts;
        return `\n<div class="md-compare" style="--pos:50%">` +
          `<img class="cmp-img cmp-after" src="${escapeHtml(resolveEmbedSrc(after))}" alt="After redesign" draggable="false" />` +
          `<div class="cmp-before-wrap"><img class="cmp-img cmp-before" src="${escapeHtml(resolveEmbedSrc(before))}" alt="Before redesign" draggable="false" /></div>` +
          `<div class="cmp-handle" role="slider" tabindex="0" aria-label="Drag to compare before and after" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">` +
          `<span class="cmp-line"></span>` +
          `<span class="cmp-grip"><i class="ti ti-arrows-move-horizontal"></i></span>` +
          `</div></div>\n`;
      }
    }

    const src = resolveEmbedSrc(inner);
    const label = inner.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").trim();
    return `\n<img class="md-embed" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" data-label="${escapeHtml(label)}" />\n`;
  });
}

/* Wire up drag/keyboard interaction for each before/after slider. */
function initCompare(root = document) {
  root.querySelectorAll(".md-compare").forEach((el) => {
    const handle = el.querySelector(".cmp-handle");
    let dragging = false;

    const setPct = (pct) => {
      pct = Math.max(0, Math.min(100, pct));
      el.style.setProperty("--pos", pct + "%");
      handle.setAttribute("aria-valuenow", Math.round(pct));
    };
    const setFromX = (clientX) => {
      const rect = el.getBoundingClientRect();
      setPct(((clientX - rect.left) / rect.width) * 100);
    };

    el.addEventListener("pointerdown", (e) => {
      dragging = true;
      el.classList.add("is-dragging");
      el.setPointerCapture?.(e.pointerId);
      setFromX(e.clientX);
    });
    el.addEventListener("pointermove", (e) => { if (dragging) setFromX(e.clientX); });
    const stop = () => { dragging = false; el.classList.remove("is-dragging"); };
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);

    handle.addEventListener("keydown", (e) => {
      const cur = parseFloat(el.style.getPropertyValue("--pos")) || 50;
      if (e.key === "ArrowLeft") { e.preventDefault(); setPct(cur - 2); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setPct(cur + 2); }
      else if (e.key === "Home") { e.preventDefault(); setPct(0); }
      else if (e.key === "End") { e.preventDefault(); setPct(100); }
    });
  });
}

/* Swap any embed image that fails to load for the striped placeholder. */
function hookEmbedFallbacks(root = document) {
  root.querySelectorAll("img.md-embed").forEach((img) => {
    const swap = () => {
      const ph = document.createElement("div");
      ph.className = "ph md-figure";
      ph.innerHTML = `<span>${escapeHtml(img.dataset.label || "")} — image coming soon</span>`;
      img.replaceWith(ph);
    };
    if (img.complete && img.naturalWidth === 0) swap();
    else img.addEventListener("error", swap, { once: true });
  });
}

function renderMarkdown(body) {
  return marked.parse(replaceObsidianEmbeds(body));
}

/* Stable heading IDs: `## Title {#my-id}` → <h2 id="my-id">Title</h2>.
   Lets analytics track a section by a fixed id even if its visible text is reworded.
   Optional per heading; unmarked headings are unaffected. */
function applyHeadingIds(root) {
  root.querySelectorAll(".cs-prose h2, .cs-prose h3").forEach((h) => {
    const m = h.textContent.match(/\s*\{#([a-z0-9-]+)\}\s*$/i);
    if (!m) return;
    h.id = m[1];
    h.textContent = h.textContent.slice(0, m.index).replace(/\s+$/, "");
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

async function fetchStudy(slug) {
  const res = await fetch(`${CONTENT_DIR}/${slug}.md`);
  if (!res.ok) throw new Error(`Failed to load ${slug} (${res.status})`);
  return parseFrontmatter(await res.text());
}

/* A cover area: real <img> if frontmatter has `cover`, else striped placeholder. */
function coverMarkup(meta, extraClass, label) {
  if (meta.cover) {
    return `<div class="ph ${extraClass} has-image"><img src="${escapeHtml(meta.cover)}" alt="${escapeHtml(meta.title || "")}" /></div>`;
  }
  return `<div class="ph ${extraClass}"><span>${escapeHtml(label || "cover coming soon")}</span></div>`;
}

/* ── scroll reveal (shared observer; re-observe injected nodes) ── */
const revealIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);
function observeReveals(root = document) {
  root.querySelectorAll(".reveal:not(.in)").forEach((el, i) => {
    el.style.transitionDelay = (Math.min(i % 3, 2) * 70) + "ms";
    revealIO.observe(el);
  });
}

/* ── Homepage: featured case + 3-up grid ── */
async function renderWork(featureEl, gridEl) {
  let slugs;
  try {
    slugs = await (await fetch(MANIFEST_URL)).json();
  } catch (e) {
    console.error("Could not load manifest:", e);
    featureEl.innerHTML = `<p class="cs-status">Projects could not be loaded.</p>`;
    return;
  }

  const studies = (
    await Promise.all(
      slugs.map(async (slug) => {
        try { return { slug, meta: (await fetchStudy(slug)).meta }; }
        catch (e) { console.error(e); return null; }
      })
    )
  ).filter(Boolean);

  if (!studies.length) return;

  const card = (s) => {
    const href = `case-study.html?id=${encodeURIComponent(s.slug)}`;
    const tags = (s.meta.tags || [])
      .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
      .join("");
    return `
      <a href="${href}" class="case-card reveal">
        ${coverMarkup(s.meta, "cover", s.meta.industry || "cover coming soon")}
        <div class="cc-body">
          <span class="yr">${escapeHtml(String(s.meta.year || ""))}</span>
          <h3>${escapeHtml(s.meta.title || s.slug)}</h3>
          <p>${escapeHtml(s.meta.summary || "")}</p>
          ${tags ? `<div class="cc-tags">${tags}</div>` : ""}
        </div>
      </a>`;
  };

  // Row 1: first two studies (2-up). Row 2: the rest (3-up).
  featureEl.innerHTML = studies.slice(0, 2).map(card).join("");
  gridEl.innerHTML = studies.slice(2).map(card).join("");

  observeReveals(featureEl);
  observeReveals(gridEl);
}

/* ── Case study page ── */
function stickyRowMarkup(meta) {
  const items = [
    { cls: "sticky-blue",   k: "Goal",          b: meta.sticky_goal },
    { cls: "sticky-yellow", k: "The challenge", b: meta.sticky_challenge },
    { cls: "sticky-green",  k: "My role",        b: meta.sticky_role },
  ].filter((i) => i.b);
  if (!items.length) return "";
  return `<div class="cs-sticky-row">${items.map((i) =>
    `<div class="sticky ${i.cls}"><div class="k">${escapeHtml(i.k)}</div><div class="b">${escapeHtml(i.b)}</div></div>`
  ).join("")}</div>`;
}

function quoteMarkup(meta) {
  if (!meta.testimonial) return "";
  const by = meta.testimonial_by ? `<div class="by">— ${escapeHtml(meta.testimonial_by)}</div>` : "";
  return `<div class="cs-quote"><p>${escapeHtml(meta.testimonial)}</p>${by}</div>`;
}

async function renderCaseStudy(rootEl) {
  const slug = new URLSearchParams(window.location.search).get("id");
  if (!slug) { rootEl.innerHTML = notFoundMarkup("No case study specified."); return; }

  // manifest gives us prev/next ordering
  let slugs = [];
  try { slugs = await (await fetch(MANIFEST_URL)).json(); } catch (e) { /* non-fatal */ }

  let meta, body;
  try { ({ meta, body } = await fetchStudy(slug)); }
  catch (e) { console.error(e); rootEl.innerHTML = notFoundMarkup("That case study could not be found."); return; }

  document.title = `${meta.title || "Case study"} — Olha Kirdiaieva`;

  const tags = (meta.tags || [])
    .map((t) => `<span class="chip" style="font-size:12.5px;padding:5px 11px">${escapeHtml(t)}</span>`)
    .join("");

  const hasBody = body && body.trim().length > 0;
  const sticky = stickyRowMarkup(meta);
  let bodyHtml;
  if (hasBody) {
    let prose = renderMarkdown(body);
    if (sticky) {
      // drop the sticky row inside the first section (Context), above the
      // context image: before the first figure or the second <h2…>,
      // whichever comes first; fall back to the end.
      const h2s = [...prose.matchAll(/<h2[\s>]/g)];
      const fig = prose.search(/<div class="ph md-figure"/);
      const candidates = [
        h2s.length >= 2 ? h2s[1].index : -1,
        fig,
      ].filter((n) => n >= 0);
      const pos = candidates.length ? Math.min(...candidates) : prose.length;
      prose = prose.slice(0, pos) + sticky + prose.slice(pos);
    }
    bodyHtml = `<div class="cs-prose">${prose}</div>`;
  } else {
    bodyHtml = `${sticky}<div class="cs-notice">✏️ This case study is currently being written. Full write-up, visuals, and outcomes are coming soon — the structure and details below will be filled in.</div>`;
  }

  // prev / next from manifest order (wrap-around)
  let nav = "";
  const idx = slugs.indexOf(slug);
  if (idx !== -1 && slugs.length > 1) {
    const total = slugs.length;
    const prevIdx = (idx - 1 + total) % total;
    const nextIdx = (idx + 1) % total;
    const prevSlug = slugs[prevIdx];
    const nextSlug = slugs[nextIdx];
    nav = `
      <div class="cs-next">
        <a href="case-study.html?id=${encodeURIComponent(prevSlug)}" class="btn btn-ghost prev">
          <i class="ti ti-arrow-left"></i> <span class="cs-label">Previous<span class="cs-word"> case</span></span> <span class="cs-count">${prevIdx + 1}/${total}</span>
        </a>
        <a href="case-study.html?id=${encodeURIComponent(nextSlug)}" class="btn btn-ghost next">
          <span class="cs-count">${nextIdx + 1}/${total}</span> <span class="cs-label">Next<span class="cs-word"> case</span></span> <i class="ti ti-arrow-right"></i>
        </a>
      </div>`;
  }

  rootEl.innerHTML = `
    <section class="cs-hero">
      <div class="wrap">
        <a class="back-link" href="index.html#work"><i class="ti ti-arrow-left"></i> All work</a>
        <div class="case-tags">${tags}</div>
        <h1>${escapeHtml(meta.title || slug)}</h1>
        ${meta.summary ? `<p class="lead">${escapeHtml(meta.summary)}</p>` : ""}
      </div>
    </section>

    <div class="wrap cs-cover">
      ${coverMarkup(meta, "", "hero shot — product UI")}
    </div>

    <div class="wrap">
      <div class="cs-body">
        ${bodyHtml}
        ${quoteMarkup(meta)}
        ${nav}
      </div>
    </div>`;

  hookEmbedFallbacks(rootEl);
  initCompare(rootEl);
  applyHeadingIds(rootEl);

  // Signal that the case study DOM is ready (js/analytics.js listens to track engagement).
  document.dispatchEvent(new CustomEvent("casestudy:rendered", { detail: { slug } }));
}

function notFoundMarkup(message) {
  return `
    <section class="cs-hero">
      <div class="wrap">
        <a class="back-link" href="index.html#work"><i class="ti ti-arrow-left"></i> All work</a>
        <h1>Case study not found</h1>
        <p class="lead">${escapeHtml(message)}</p>
        <p style="margin-top:28px"><a class="btn btn-primary" href="index.html#work"><i class="ti ti-arrow-left"></i> Back to all work</a></p>
      </div>
    </section>`;
}

/* ── HTML partial includes (shared header / contact components) ──
   <div data-include="partials/header.html"></div> is replaced by the file's
   contents. On the home page, index.html#… links are rewritten to #… so
   in-page smooth-scroll keeps working. */
const ON_HOME = !/case-study\.html$/.test(window.location.pathname);

async function applyIncludes() {
  const slots = [...document.querySelectorAll("[data-include]")];
  await Promise.all(
    slots.map(async (slot) => {
      const url = slot.getAttribute("data-include");
      try {
        const html = await (await fetch(url)).text();
        const tpl = document.createElement("template");
        tpl.innerHTML = html.trim();
        if (ON_HOME) {
          tpl.content.querySelectorAll('a[href^="index.html#"]').forEach((a) => {
            a.setAttribute("href", a.getAttribute("href").slice("index.html".length));
          });
        }
        slot.replaceWith(tpl.content);
      } catch (e) {
        console.error(`Include failed: ${url}`, e);
        slot.remove();
      }
    })
  );
}

/* sticky-header shadow + smooth anchor scroll (runs after the header is injected) */
function initChrome() {
  const hdr = document.getElementById("hdr");
  if (hdr) {
    const onScroll = () => hdr.classList.toggle("scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // mobile burger menu
    const menuBtn = hdr.querySelector("#menuBtn");
    if (menuBtn) {
      const setOpen = (open) => {
        hdr.classList.toggle("nav-open", open);
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
        menuBtn.querySelector("i").className = open ? "ti ti-x" : "ti ti-menu-2";
      };
      setOpen(false);
      menuBtn.addEventListener("click", () => setOpen(!hdr.classList.contains("nav-open")));
      // close after picking a destination
      hdr.querySelectorAll(".nav-links a").forEach((a) =>
        a.addEventListener("click", () => setOpen(false))
      );
    }
  }
  // If an "index.html#section" link points at a section that exists on THIS
  // page (e.g. #contact on a case study), rewrite it to an in-page anchor so it
  // smooth-scrolls instead of navigating to the home page.
  document.querySelectorAll('a[href^="index.html#"]').forEach((a) => {
    const hash = a.getAttribute("href").slice("index.html".length);
    if (hash.length > 1 && document.getElementById(hash.slice(1))) {
      a.setAttribute("href", hash);
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (ev) => {
      const id = a.getAttribute("href");
      if (id.length > 1) {
        const t = document.querySelector(id);
        if (t) { ev.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" }); }
      }
    });
  });
}

/* ── Boot ── */
document.addEventListener("DOMContentLoaded", async () => {
  await applyIncludes();      // inject shared header + contact partials first
  initChrome();               // header now exists in the DOM
  observeReveals();           // static + injected .reveal elements

  const feature = document.getElementById("work-feature");
  const grid = document.getElementById("work-grid");
  if (feature && grid) renderWork(feature, grid);

  const cs = document.getElementById("case-study-root");
  if (cs) renderCaseStudy(cs);
});
