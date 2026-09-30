// Old links (case-study.html?id=2022-gas-stations) forward to the new
// per-study pages (gas-stations). Same slug rule as build.py.
(function () {
  var id = new URLSearchParams(location.search).get("id");
  location.replace(id && /^[\w-]+$/.test(id) ? id.replace(/^\d{4}-/, "") : "./#cases");
})();
