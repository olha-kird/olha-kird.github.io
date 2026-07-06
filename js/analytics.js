// PostHog analytics — EU cloud. Loaded from <head> on every page.
// The Project API key (phc_...) is a public client-side key; safe to commit.
// 1. Replace POSTHOG_KEY below with your key from PostHog → Settings → Project.
// 2. That's it — pageviews + autocapture are on by default.
(function () {
  var POSTHOG_KEY = "phc_zHi6GBzfxwqnpT8H5Vj9nBiNRNf5WmaMCgn2WqzptXs4";

  // Don't load analytics on local development.
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;

  // Flag/unflag this browser as internal via URL (handy on mobile, no console needed):
  //   https://your-site/?ph_internal=1  → opt out of analytics on this device
  //   https://your-site/?ph_internal=0  → opt back in
  var phParam = new URLSearchParams(location.search).get("ph_internal");
  if (phParam === "1") localStorage.setItem("ph_internal", "1");
  if (phParam === "0") localStorage.removeItem("ph_internal");

  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init(POSTHOG_KEY, {
    api_host: "https://eu.i.posthog.com",
    person_profiles: "identified_only", // anonymous visitors don't create person profiles → cheaper, more privacy-friendly
    persistence: "memory", // cookie-less: nothing stored on the visitor's device → no consent banner needed
    disable_session_recording: true, // session replay needs storage/consent; off to stay cookie-less
  });

  // Exclude your own visits: tag events as internal if this browser is flagged.
  // Set once on the live site via console: localStorage.setItem('ph_internal','1')
  // Then in PostHog, filter out events where internal = true.
  if (localStorage.getItem("ph_internal")) {
    posthog.register({ internal: true });
  }

  // Tidy the address bar: strip tracking params after PostHog has captured them
  // (init() above already sent the pageview with UTMs), so visitors can copy a
  // clean URL. Only removes known tracking keys — functional params like ?id= stay.
  (function cleanUrl() {
    var url = new URL(location.href);
    var dirty = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ph_internal"];
    var changed = false;
    dirty.forEach(function (p) {
      if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true; }
    });
    if (changed) history.replaceState({}, "", url.pathname + url.search + url.hash);
  })();

  // --- Custom events ---------------------------------------------------------

  // Case study viewed: fired on case-study.html, tagged with the slug from ?id=.
  // Lets us chart which case studies get opened (autocapture only sees the URL).
  var caseStudyId = new URLSearchParams(location.search).get("id");
  if (location.pathname.indexOf("case-study.html") !== -1 && caseStudyId) {
    posthog.capture("case_study_viewed", { slug: caseStudyId });
  }

  // Contact intent: clicks on the email or LinkedIn links. Delegated on document
  // because the contact section is injected late via data-include in js/site.js.
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (href.indexOf("mailto:") === 0) {
      posthog.capture("contact_click", { method: "email" });
    } else if (href.indexOf("linkedin.com/in/") !== -1) {
      // Only the profile link counts as contact intent — not any linkedin.com URL
      // (e.g. an article linked from a case study would otherwise be miscounted).
      posthog.capture("contact_click", { method: "linkedin" });
    }
  });

  // Case study engagement: how far visitors scroll, how long they stay, and which
  // sections they read (dwell >= 4s of active time) vs skip. Accumulates in memory
  // and fires ONE summary event when they leave. No storage used (cookie-less safe).
  document.addEventListener("casestudy:rendered", function (ev) {
    var slug = ev.detail && ev.detail.slug;
    if (!slug) return;

    var READ_MS = 4000;       // dwell to count a section as "read"
    var heads = [].slice.call(document.querySelectorAll(".cs-prose h2"));
    if (!heads.length) return;

    // Section label: prefer an author-assigned id (`## Title {#id}`, set by site.js)
    // so it survives heading rewrites; else fall back to de-duplicated slugified text.
    var seen = {};
    var sections = heads.map(function (h) {
      if (h.id) return { el: h, label: h.id };
      var base = (h.textContent || "section").trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
      seen[base] = (seen[base] || 0) + 1;
      var label = seen[base] > 1 ? base + "-" + seen[base] : base;
      return { el: h, label: label };
    });

    var dwellMs = {};
    sections.forEach(function (s) { dwellMs[s.label] = 0; });

    // Section vertical ranges, recomputed each tick so late-loading images / resizes
    // (which shift layout without a reliable single event) can't misattribute dwell.
    function buildRanges() {
      var docH = document.documentElement.scrollHeight;
      return sections.map(function (s, i) {
        var next = sections[i + 1];
        return {
          label: s.label,
          top: s.el.getBoundingClientRect().top + window.pageYOffset,
          bottom: next ? next.el.getBoundingClientRect().top + window.pageYOffset : docH
        };
      });
    }

    // Measure completion against the case-study content, not the whole document:
    // the contact footer is a sibling injected late via data-include, so counting
    // it would mark a reader who finished the article as short of the end.
    // Recomputed each scroll so late layout shifts (images, the footer) self-correct.
    var contentEl = document.getElementById("case-study-root");
    function contentBottom() {
      if (contentEl) return contentEl.getBoundingClientRect().bottom + window.pageYOffset;
      return document.documentElement.scrollHeight;
    }

    var maxScrollPct = 0;
    function updateScroll() {
      var h = contentBottom();
      var pct = h > 0 ? ((window.pageYOffset + window.innerHeight) / h) * 100 : 0;
      if (pct > maxScrollPct) maxScrollPct = Math.min(100, pct);
    }
    var rafPending = false;
    window.addEventListener("scroll", function () {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () { rafPending = false; updateScroll(); });
    }, { passive: true });
    updateScroll();

    // 1s tick: credit active time to whichever section holds the viewport center.
    var activeMs = 0;
    var tick = setInterval(function () {
      if (document.hidden) return;
      activeMs += 1000;
      var ranges = buildRanges();
      var center = window.pageYOffset + window.innerHeight / 2;
      for (var i = 0; i < ranges.length; i++) {
        if (center >= ranges[i].top && center < ranges[i].bottom) {
          dwellMs[ranges[i].label] += 1000;
          break;
        }
      }
    }, 1000);

    var sent = false;
    function sendSummary() {
      if (sent) return;
      sent = true;
      clearInterval(tick);

      var read = [], skipped = [], dwellSecs = {};
      sections.forEach(function (s) {
        dwellSecs[s.label] = Math.round(dwellMs[s.label] / 1000);
        (dwellMs[s.label] >= READ_MS ? read : skipped).push(s.label);
      });

      posthog.capture("case_study_engaged", {
        slug: slug,
        active_seconds: Math.round(activeMs / 1000),
        max_scroll_pct: Math.round(maxScrollPct),
        reached_end: maxScrollPct >= 90,
        sections_total: sections.length,
        sections_read: read,
        sections_skipped: skipped,
        read_count: read.length,
        skipped_count: skipped.length,
        section_dwell: dwellSecs
      });
    }

    // visibilitychange->hidden is the reliable exit signal (esp. mobile); pagehide backs it up.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) sendSummary();
    });
    window.addEventListener("pagehide", sendSummary);
  });
})();
