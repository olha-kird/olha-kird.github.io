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
    } else if (href.indexOf("linkedin.com") !== -1) {
      posthog.capture("contact_click", { method: "linkedin" });
    }
  });
})();
