/* ───────────────────────────────────────────────
   Shared site logic: homepage work cards, shared
   partials, and the interactive bits of the case
   study pages (compare sliders, image fallbacks).
   Case study pages themselves are static HTML built
   by build.py from content/case-studies-md/*.md; the
   homepage cards read the same frontmatter in the
   browser (js-yaml) via content/manifest.json.
─────────────────────────────────────────────── */

const CONTENT_DIR = "content/case-studies-md";
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

/* 2022-gas-stations -> gas-stations (same rule as build.py; GitHub Pages serves gas-stations.html at that URL). */
function casePageUrl(slug) {
  return slug.replace(/^\d{4}-/, "");
}

/* A cover area: real <img> if frontmatter has `cover`, else striped placeholder.
   `eager` is for the single above-the-fold case-study hero cover; homepage
   grid covers (mostly below the fold) default to lazy. */
function coverMarkup(meta, extraClass, label, eager = false) {
  if (meta.cover) {
    const loading = eager ? "eager" : "lazy";
    return `<div class="ph ${extraClass} has-image"><img src="${escapeHtml(meta.cover)}" alt="${escapeHtml(meta.title || "")}" loading="${loading}" decoding="async" /></div>`;
  }
  return `<div class="ph ${extraClass}"><span>${escapeHtml(label || "cover coming soon")}</span></div>`;
}

/* ── scroll reveal (shared observer; re-observe injected nodes) ── */
const revealIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        // Drop the compositor hint only once the fade finishes — clearing it
        // mid-transition forces a re-raster (visible on the image-heavy cards).
        // The stagger delay goes too: it applies to every transition, so left
        // in place it would also delay hover effects (and fully block the
        // per-pointermove case-card tilt, which restarts before it elapses).
        e.target.addEventListener("transitionend", () => {
          e.target.style.willChange = "auto";
          e.target.style.transitionDelay = "";
        }, { once: true });
        revealIO.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);
function observeReveals(root = document) {
  root.querySelectorAll(".reveal:not(.in)").forEach((el) => {
    // Stagger by the element's position among its reveal-siblings in the same
    // container, so each group (a grid row, the process cards, a header block)
    // cascades in DOM order — independent of how many reveals precede it on the
    // page. Capped so long lists don't drag. Case cards are exempt: they stack
    // one per row, so they enter the viewport one at a time and a stagger would
    // only make some of them arrive late.
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    const idx = el.classList.contains("case-card") ? 0 : Math.max(0, sibs.indexOf(el));
    el.style.transitionDelay = Math.min(idx, 3) * 80 + "ms";
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
    const href = casePageUrl(s.slug);
    const tags = (s.meta.tags || [])
      .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
      .join("");
    return `
      <a href="${href}" id="case-${escapeHtml(casePageUrl(s.slug))}" class="case-card reveal">
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

/* ── Homepage: process steps ── */
const ICONS_DIR = "assets/tabler/icons";
const iconCache = {};

/* Fetches a stroke-based Tabler SVG (see assets/tabler/icons/) and caches
   the raw markup — used instead of the icon font so stroke-width is a real
   CSS property (font glyphs are flattened fills, no stroke to control). */
async function loadIconSvg(name) {
  if (name in iconCache) return iconCache[name];
  try {
    const raw = await (await fetch(`${ICONS_DIR}/${name}.svg`)).text();
    const svg = (raw.match(/<svg[\s\S]*<\/svg>/) || [""])[0]
      .replace("<svg", '<svg class="step-icon" aria-hidden="true" focusable="false"');
    iconCache[name] = svg;
    return svg;
  } catch (e) {
    console.error("Could not load icon:", name, e);
    iconCache[name] = "";
    return "";
  }
}

async function renderProcess(trackEl) {
  let meta;
  try { ({ meta } = parseFrontmatter(await (await fetch("content/process.md")).text())); }
  catch (e) { console.error("Could not load process content:", e); return; }

  const steps = meta.steps || [];
  const icons = await Promise.all(steps.map((s) => (s.icon ? loadIconSvg(s.icon) : "")));

  trackEl.innerHTML = steps.map((s, i) => {
    const items = (s.items || []).map((it) => `<li>${escapeHtml(it)}</li>`).join("");
    return `
      <div class="step reveal">
        <span class="pin"></span>
        <div class="step-head">
          <h3>${escapeHtml(s.title || "")}</h3>
          ${icons[i]}
        </div>
        <ul class="step-list">${items}</ul>
      </div>`;
  }).join("");

  observeReveals(trackEl);
}

/* ==phrase== inside a quote becomes a marker highlight. */
function highlightMarkup(text) {
  return escapeHtml(text).replace(/==(.+?)==/g, "<mark>$1</mark>");
}

/* ── Homepage: testimonials ── */
async function renderTestimonials(gridEl) {
  let meta;
  try { ({ meta } = parseFrontmatter(await (await fetch("content/testimonials.md")).text())); }
  catch (e) { console.error("Could not load testimonials:", e); return; }

  const items = (meta.items || []).filter((t) => t && t.quote);
  if (!items.length) { gridEl.closest("section").hidden = true; return; }

  gridEl.innerHTML = items.map((t) => {
    const name = escapeHtml(t.name || "");
    const nameHtml = t.linkedin
      ? `<a href="${escapeHtml(t.linkedin)}" target="_blank" rel="noopener">${name}</a>`
      : name;
    const avatar = t.avatar
      ? `<img class="t-avatar" src="${escapeHtml(t.avatar)}" alt="" width="48" height="48" loading="lazy" decoding="async" />`
      : "";
    return `
      <figure class="t-card reveal">
        <span class="pin"></span>
        <figcaption>
          ${avatar}
          <span class="t-who">
            <span class="t-name">${nameHtml}</span>
            <span class="t-role">${escapeHtml(t.role || "")}</span>
          </span>
        </figcaption>
        <blockquote><p>${highlightMarkup(t.quote)}</p></blockquote>
      </figure>`;
  }).join("");

  observeReveals(gridEl);
}

/* ── Case study page ── */
/* The page is static HTML (build.py); this only wires up the interactive parts. */
function initCaseStudy(rootEl) {
  hookEmbedFallbacks(rootEl);
  initCompare(rootEl);

  // Signal that the case study DOM is ready (js/analytics.js listens to track engagement).
  document.dispatchEvent(new CustomEvent("casestudy:rendered", { detail: { slug: rootEl.dataset.slug } }));
}

/* ── HTML partial includes (shared header / contact components) ──
   <div data-include="partials/header.html"></div> is replaced by the file's
   contents. On the home page, ./#… links are rewritten to #… so
   in-page smooth-scroll keeps working. */
// Home = the site root or index.html. Other standalone pages (case study, legal
// pages) keep their full "./#…" links so those navigate back to the home
// page instead of being rewritten to same-page anchors that don't exist there.
const ON_HOME = /(^|\/)(index\.html)?$/.test(window.location.pathname);

// /index.html and / are the same page; show the shorter address. (GitHub Pages
// can't redirect, so the address is rewritten in place — no reload.)
if (/(^|\/)index\.html$/.test(window.location.pathname)) {
  history.replaceState(null, "", window.location.pathname.replace(/index\.html$/, "") + window.location.search + window.location.hash);
}

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
          tpl.content.querySelectorAll('a[href^="./#"]').forEach((a) => {
            a.setAttribute("href", a.getAttribute("href").slice(2));
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
/* Track whether a button was activated via keyboard (Enter/Space) or a
   pointer (mouse/touch), so callers that move focus elsewhere afterwards
   can decide whether a visible focus ring is warranted there. keydown
   always precedes the synthesized click for keyboard activation; pointerdown
   always precedes click for pointer activation — so whichever fired last
   right before "click" tells us the source. */
function trackActivationSource(el) {
  el.addEventListener("pointerdown", () => { el.dataset.viaKeyboard = "0"; });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") el.dataset.viaKeyboard = "1";
  });
}

/* Move focus to `el` after a button activation. If that activation wasn't
   via keyboard, suppress the focus ring on `el` — browsers' :focus-visible
   heuristic doesn't reliably do this itself when focus jumps to a different
   element than the one actually pointed at (see .suppress-ring in styles.css). */
function focusFollowingActivation(el, viaKeyboard) {
  if (!el) return;
  if (!viaKeyboard) {
    el.classList.add("suppress-ring");
    el.addEventListener("blur", () => el.classList.remove("suppress-ring"), { once: true });
  }
  el.focus();
}

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
      trackActivationSource(menuBtn);
      menuBtn.addEventListener("click", () => {
        const open = !hdr.classList.contains("nav-open");
        setOpen(open);
        // .nav-links sits before menuBtn in the DOM, so once it's revealed,
        // move focus into it — otherwise Tab from menuBtn skips straight
        // past the now-visible links to whatever follows the header.
        if (open) focusFollowingActivation(hdr.querySelector(".nav-links a"), menuBtn.dataset.viaKeyboard === "1");
      });
      // close after picking a destination
      hdr.querySelectorAll(".nav-links a").forEach((a) =>
        a.addEventListener("click", () => setOpen(false))
      );
      // close on tap-outside or Escape, matching the lang-switch dropdown
      // on the legal page (see datenschutz.html) — same dismissal pattern.
      document.addEventListener("click", (e) => {
        if (hdr.classList.contains("nav-open") && !hdr.contains(e.target)) setOpen(false);
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && hdr.classList.contains("nav-open")) {
          setOpen(false);
          menuBtn.focus();
        }
      });
    }
  }
  // Case cards are tall enough (~half a viewport) that browsers' default
  // "nearest" focus-scroll heuristic can decide a card is "visible enough"
  // once its neighbor's scroll left a sliver of it on-screen, and skip
  // scrolling — making every other card seem to get tabbed past. Force a
  // deterministic top-aligned scroll on every card focus instead. Delegated
  // on document (via "focusin", which bubbles, unlike "focus") since cards
  // are injected by renderWork() after initChrome() runs.
  document.addEventListener("focusin", (e) => {
    const card = e.target.closest(".case-card");
    if (card && card.matches(":focus-visible")) card.scrollIntoView({ block: "start" });
  });

  initCardTilt();

  // Logo → "./" (clean URL). Already on the home page, that would reload it,
  // so scroll to the top instead.
  const brand = document.querySelector(".site-header .brand");
  if (brand && ON_HOME) {
    brand.addEventListener("click", (ev) => {
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // If a "./#section" link points at a section that exists on THIS
  // page (e.g. #contact on a case study), rewrite it to an in-page anchor so it
  // smooth-scrolls instead of navigating to the home page.
  document.querySelectorAll('a[href^="./#"]').forEach((a) => {
    const hash = a.getAttribute("href").slice(2);
    if (hash.length > 1 && document.getElementById(hash.slice(1))) {
      a.setAttribute("href", hash);
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (ev) => {
      const id = a.getAttribute("href");
      if (id.length > 1) {
        const t = document.querySelector(id);
        if (t) { ev.preventDefault(); window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 32, behavior: "smooth" }); }
      }
    });
  });
}

/* Pointer tilt on case cards. Maps the pointer inside the card to
   a small rotation (cards are wide, so a few degrees already moves the edges a
   lot), written as CSS vars styled in styles.css.
   Delegated on document because cards are injected by renderWork(). */
const TILT_MAX_DEG = 2;
function initCardTilt() {
  const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  let frame = 0;

  document.addEventListener("pointermove", (e) => {
    if (!mq.matches) return;
    const card = e.target.closest?.(".case-card");
    if (!card) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;   // 0 → 1
      const y = (e.clientY - r.top) / r.height;
      card.classList.add("is-tilting");
      card.style.setProperty("--ry", `${((x - 0.5) * 2 * TILT_MAX_DEG).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${((0.5 - y) * 2 * TILT_MAX_DEG).toFixed(2)}deg`);    });
  });

  document.addEventListener("pointerout", (e) => {
    const card = e.target.closest?.(".case-card");
    if (!card || card.contains(e.relatedTarget)) return;
    cancelAnimationFrame(frame);
    card.classList.remove("is-tilting");
    ["--rx", "--ry"].forEach((p) => card.style.removeProperty(p));
  });
}

/* Arriving at e.g. /#contact from another page: the browser's native
   hash jump fired before applyIncludes() injected the contact section, so it
   landed at the top. Now that the partials exist, jump to the target (with the
   same sticky-header offset the in-page anchor clicks use). */
function scrollToInitialHash() {
  const id = window.location.hash.slice(1);
  if (!id) return;
  const t = document.getElementById(id);
  if (!t) return;

  // The target keeps moving as the page settles after the first jump: async
  // partials, web-font swap and image decode all reflow the content above it.
  // Re-align on a short loop until the position holds steady (or we hit the
  // time cap), and bail the moment the visitor scrolls so we never fight them.
  let interrupted = false;
  const stop = () => { interrupted = true; };
  window.addEventListener("wheel", stop, { passive: true, once: true });
  window.addEventListener("touchmove", stop, { passive: true, once: true });

  const jump = () => {
    if (interrupted) return;
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 32, behavior: "auto" });
  };

  // Re-align across the first ~1.2s so a late web-font swap (which reflows the
  // text above the target) can't leave us short; the fonts.ready hook catches
  // anything slower still.
  jump();
  // Arriving on the home page from another page (header nav, "All work"): hide
  // the #hash right after the first jump so the address bar shows a clean "/".
  // The re-align loop below works from `id`, not the URL, so it isn't affected.
  // Home only: the legal page uses its hash (#de) for the language.
  if (ON_HOME) history.replaceState(null, "", window.location.pathname + window.location.search);
  let tries = 0;
  const timer = setInterval(() => {
    jump();
    if (interrupted || ++tries >= 20) clearInterval(timer);
  }, 60);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(jump);
}

/* Native Back/Forward restores scroll position from the browser's own cache
   (bfcache) fine, but when it instead does a full reload — common on the
   live site — it tries to restore scrollY before the async case cards have
   rendered, so the page is still short and the restore falls short. Save the
   homepage's scrollY just before leaving (sessionStorage — a tab-local value,
   never sent anywhere, cleared when the tab closes — see datenschutz.html),
   and re-apply it once the page is back to full height. */
const HOME_SCROLL_KEY = "ps-home-scroll-y";

if (ON_HOME) {
  window.addEventListener("pagehide", () => {
    try { sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY)); }
    catch (e) { /* storage unavailable (e.g. private browsing) — nothing to restore next time */ }
  });
}

/* Returns true if it handled the restore, so the boot sequence can skip the
   coarser hash-anchor jump below (an exact scrollY beats "top of card"). */
function restoreHomeScroll() {
  const nav = performance.getEntriesByType("navigation")[0];
  if (!nav || nav.type !== "back_forward") return false;

  let raw;
  try { raw = sessionStorage.getItem(HOME_SCROLL_KEY); }
  catch (e) { return false; }
  const targetY = parseFloat(raw);
  if (!Number.isFinite(targetY)) return false;

  // Same re-align-until-stable approach as scrollToInitialHash(), for the
  // same reason: async cards and font swap keep growing the page underneath.
  let interrupted = false;
  const stop = () => { interrupted = true; };
  window.addEventListener("wheel", stop, { passive: true, once: true });
  window.addEventListener("touchmove", stop, { passive: true, once: true });

  const jump = () => { if (!interrupted) window.scrollTo({ top: targetY, behavior: "auto" }); };

  jump();
  let tries = 0;
  const timer = setInterval(() => {
    jump();
    if (interrupted || ++tries >= 20) clearInterval(timer);
  }, 60);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(jump);
  return true;
}

/* ── Boot ── */
document.addEventListener("DOMContentLoaded", async () => {
  await applyIncludes();      // inject shared header + contact partials first
  initChrome();               // header now exists in the DOM
  observeReveals();           // static + injected .reveal elements

  const feature = document.getElementById("work-feature");
  const grid = document.getElementById("work-grid");
  if (feature && grid) await renderWork(feature, grid);

  const processTrack = document.getElementById("process-track");
  if (processTrack) await renderProcess(processTrack);

  const testimonialGrid = document.getElementById("testimonial-grid");
  if (testimonialGrid) await renderTestimonials(testimonialGrid);

  const cs = document.getElementById("case-study-root");
  if (cs) initCaseStudy(cs);

  // Honor #contact etc. only after the async work cards / case body are in the
  // DOM — they change page height and would otherwise leave the target stale.
  // A native Back/Forward's exact saved scrollY (home page only) takes
  // priority over the coarser hash-anchor jump when both could apply.
  const restoredScroll = ON_HOME && restoreHomeScroll();
  if (!restoredScroll) scrollToInitialHash();
});
