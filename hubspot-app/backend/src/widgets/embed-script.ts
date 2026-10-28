/**
 * The website widget script, served at GET /widget/embed.js.
 *
 * Plain ES5-style JavaScript with no dependencies, so it runs on any site
 * (HubSpot pages, WordPress, Wix, Webflow, Shopify, plain HTML). It finds every
 * <div class="ra-reviews" data-widget="..."> on the page, loads that widget's
 * feed from this API and renders it inside a Shadow DOM, so the host site's CSS
 * cannot break it and its CSS cannot leak into the host site.
 *
 * Follows Google's display rules: each review shows the reviewer's name, the
 * date, the rating and a link back to Google.
 *
 * Kept as a string constant so it ships inside the compiled backend with no
 * extra build step.
 */
export const EMBED_SCRIPT = String.raw`(function () {
  "use strict";
  var script = document.currentScript;
  var src = script && script.src ? script.src : "";
  var API = src ? src.replace(/\/widget\/embed\.js(\?.*)?$/, "") : "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function stars(n) {
    var out = "";
    for (var i = 1; i <= 5; i++) out += '<span class="s' + (i <= n ? " on" : "") + '">★</span>';
    return '<span class="stars" aria-label="' + n + ' out of 5 stars">' + out + "</span>";
  }
  function date(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    } catch (e) {
      return "";
    }
  }
  function initials(name) {
    return esc(String(name || "?").trim().charAt(0).toUpperCase());
  }
  function css(t) {
    var accent = t.accent || "#1a73e8";
    var bg = t.background || "#ffffff";
    var text = t.text || "#202124";
    var r = typeof t.radius === "number" ? t.radius : 12;
    return (
      ":host{all:initial;display:block;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:" + text + "}" +
      "*{box-sizing:border-box}" +
      ".head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}" +
      ".avg{font-size:22px;font-weight:700}" +
      ".count{font-size:13px;opacity:.75}" +
      ".stars .s{color:#dadce0;font-size:16px}.stars .s.on{color:#fbbc04}" +
      ".track{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}" +
      ".grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}" +
      ".list{display:flex;flex-direction:column;gap:12px}" +
      ".card{background:" + bg + ";border:1px solid rgba(0,0,0,.1);border-radius:" + r + "px;padding:14px;min-width:0}" +
      ".track .card{flex:0 0 min(300px,85%);scroll-snap-align:start}" +
      ".who{display:flex;align-items:center;gap:10px;margin-bottom:8px}" +
      ".pic{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none;background:" + accent + ";color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600}" +
      ".name{font-weight:600;font-size:14px}.when{font-size:12px;opacity:.7}" +
      ".txt{font-size:14px;line-height:1.5;margin:8px 0 0;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}" +
      "a{color:" + accent + ";text-decoration:none;font-size:13px}a:hover{text-decoration:underline}" +
      ".foot{margin-top:10px;font-size:12px;opacity:.75}" +
      ".nav{display:flex;gap:8px;margin-left:auto}" +
      ".nav button{border:1px solid rgba(0,0,0,.15);background:" + bg + ";color:" + text + ";border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px}" +
      ".badge{display:inline-flex;align-items:center;gap:10px;background:" + bg + ";border:1px solid rgba(0,0,0,.1);border-radius:" + r + "px;padding:10px 14px}" +
      ".g{font-weight:700;color:" + accent + "}"
    );
  }
  function card(rv) {
    var pic = rv.reviewerPhotoUrl
      ? '<img class="pic" src="' + esc(rv.reviewerPhotoUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : '<span class="pic" aria-hidden="true">' + initials(rv.reviewerName) + "</span>";
    return (
      '<article class="card">' +
      '<div class="who">' + pic + '<div><div class="name">' + esc(rv.reviewerName) + '</div><div class="when">' + esc(date(rv.reviewedAt)) + "</div></div></div>" +
      stars(rv.rating) +
      (rv.text ? '<p class="txt">' + esc(rv.text) + "</p>" : "") +
      (rv.googleUrl ? '<div class="foot"><a href="' + esc(rv.googleUrl) + '" target="_blank" rel="noopener">Posted on Google</a></div>' : '<div class="foot">Posted on Google</div>') +
      "</article>"
    );
  }
  function render(root, feed) {
    var t = feed.theme || {};
    var head =
      '<div class="head"><span class="avg">' + esc(feed.averageRating.toFixed(1)) + "</span>" + stars(Math.round(feed.averageRating)) +
      '<span class="count">' + esc(feed.totalReviews) + " Google reviews</span>" +
      (feed.googleUrl ? '<a href="' + esc(feed.googleUrl) + '" target="_blank" rel="noopener">See all</a>' : "");
    var body;
    if (feed.layout === "BADGE") {
      body =
        '<a class="badge" href="' + esc(feed.googleUrl || "#") + '" target="_blank" rel="noopener"><span class="g">Google</span>' +
        '<span class="avg">' + esc(feed.averageRating.toFixed(1)) + "</span>" + stars(Math.round(feed.averageRating)) +
        '<span class="count">' + esc(feed.totalReviews) + " reviews</span></a>";
      root.innerHTML = "<style>" + css(t) + "</style>" + body;
      return;
    }
    var cards = feed.reviews.map(card).join("");
    if (feed.layout === "GRID") body = '<div class="grid">' + cards + "</div>";
    else if (feed.layout === "LIST") body = '<div class="list">' + cards + "</div>";
    else {
      head += '<div class="nav"><button type="button" data-d="-1" aria-label="Previous reviews">‹</button><button type="button" data-d="1" aria-label="Next reviews">›</button></div>';
      body = '<div class="track">' + cards + "</div>";
    }
    root.innerHTML = "<style>" + css(t) + "</style>" + head + "</div>" + body;
    var track = root.querySelector(".track");
    var buttons = root.querySelectorAll(".nav button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (e) {
        var d = Number(e.currentTarget.getAttribute("data-d"));
        if (track) track.scrollBy({ left: d * track.clientWidth * 0.9, behavior: "smooth" });
      });
    }
  }
  function mount(el) {
    if (el.getAttribute("data-ra-mounted")) return;
    el.setAttribute("data-ra-mounted", "1");
    var id = el.getAttribute("data-widget");
    if (!id || !API) return;
    var root = el.attachShadow ? el.attachShadow({ mode: "open" }) : el;
    fetch(API + "/public/widgets/" + encodeURIComponent(id) + "/feed", { credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (feed) {
        render(root, feed);
      })
      .catch(function (e) {
        if (window.console) console.warn("[reviews widget] " + id + ": " + e.message);
      });
  }
  function scan() {
    var els = document.querySelectorAll(".ra-reviews[data-widget]");
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
  window.RAReviews = { refresh: scan };
})();
`;
