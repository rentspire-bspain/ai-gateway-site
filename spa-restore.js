try{var q=new URLSearchParams(location.search).get("p");if(q&&/^\/t\//.test(q)){history.replaceState(null,"",q);}}catch(e){}
// pre-boot guard: on a thread route (or with an active thread) hide the landing + show a skeleton until the real boot resolves the route
try{(function(){var d=document.documentElement,p=location.pathname,s=null;try{s=sessionStorage.getItem("ai_current_thread")}catch(e){}
if(/^\/t\/./.test(p)||s){d.classList.add("pre-boot");window.__endPreBoot=function(){d.classList.remove("pre-boot")};setTimeout(window.__endPreBoot,3000)}else{window.__endPreBoot=function(){}}})()}catch(e){}

/* v232: PWA share_target — when another app shares text here (?q=), pre-fill the composer
   and auto-send once the app is ready. */
(function () {
  try {
    var q = new URLSearchParams(location.search).get("q");
    if (!q) return;
    function seed() {
      var composer = document.getElementById("composer") || document.querySelector("textarea,input[placeholder*=Ask]");
      if (!composer) return setTimeout(seed, 300);
      composer.value = String(q).slice(0, 8000);
      composer.dispatchEvent(new Event("input", { bubbles: true }));
      history.replaceState(null, "", "/");
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", seed);
    else seed();
  } catch (e) {}
})();
