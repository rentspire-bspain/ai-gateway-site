try{var q=new URLSearchParams(location.search).get("p");if(q&&/^\/t\//.test(q)){history.replaceState(null,"",q);}}catch(e){}
// pre-boot guard: on a thread route (or with an active thread) hide the landing + show a skeleton until the real boot resolves the route
try{(function(){var d=document.documentElement,p=location.pathname,s=null;try{s=sessionStorage.getItem("ai_current_thread")}catch(e){}
if(/^\/t\/./.test(p)||s){d.classList.add("pre-boot");window.__endPreBoot=function(){d.classList.remove("pre-boot")};setTimeout(window.__endPreBoot,3000)}else{window.__endPreBoot=function(){}}})()}catch(e){}
