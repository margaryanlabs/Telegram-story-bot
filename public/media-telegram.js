/* VETO MEDIA V7 — Telegram Mini App bridge. Optional outside Telegram. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const webApp = window.Telegram?.WebApp;
  // The SDK script can also load in a normal browser. Only a Telegram launch
  // supplies initData; it is a host hint here, never an authentication proof.
  if (!webApp || typeof webApp.ready !== "function" ||
      typeof webApp.initData !== "string" || !webApp.initData.length) {
    document.documentElement.dataset.mediaHost = "browser";
    return;
  }
  document.documentElement.dataset.mediaHost = "telegram";
  function safeCall(fn) { try { return fn() } catch (err) { console.warn("VETO MEDIA Telegram integration",err?.message||err);return null } }
  safeCall(() => webApp.ready());
  safeCall(() => webApp.expand());
  safeCall(() => webApp.setHeaderColor?.("#090d18"));
  safeCall(() => webApp.setBackgroundColor?.("#090d18"));
  if (typeof webApp.isVersionAtLeast === "function" && webApp.isVersionAtLeast("7.10")) {
    safeCall(() => webApp.setBottomBarColor?.("#090d18"));
  }
  function insets() {
    const system=webApp.safeAreaInset||{},content=webApp.contentSafeAreaInset||{};
    const inset=(v,max)=>Number.isFinite(Number(v))?Math.max(0,Math.min(max,Number(v))):0;
    const root=document.documentElement.style;
    root.setProperty("--media-tg-top",inset(content.top??system.top,120)+"px");
    root.setProperty("--media-tg-bottom",inset(content.bottom??system.bottom,120)+"px");
    root.setProperty("--media-tg-left",inset(content.left??system.left,80)+"px");
    root.setProperty("--media-tg-right",inset(content.right??system.right,80)+"px");
    document.documentElement.dataset.mediaTelegramTheme=webApp.colorScheme==="light"?"light":"dark";
  }
  insets();
  for(const evt of ["safeAreaChanged","contentSafeAreaChanged","viewportChanged","themeChanged"]){
    safeCall(()=>webApp.onEvent?.(evt,insets));
  }
  const accessible = id => {
    const e=$(id);
    return Boolean(e && !e.classList.contains("hidden") &&
       (e.classList.contains("open") || e.classList.contains("active") ||
        e.classList.contains("is-active") || id==="readerBackdrop" || id==="vetoFilmOverlay" || id==="mediaEpubOverlay"));
  };
  // The BackButton steps out of modal readers and mini-app sections without
  // closing the Telegram sheet or exposing any account-sensitive state.
  function needsBack(){
    const modalOpen =
      accessible("mediaEpubOverlay") ||
      accessible("readerBackdrop") ||
      accessible("vetoFilmOverlay") ||
      accessible("v11DetailModal") ||
      $("v4Listening")?.classList.contains("open") ||
      Boolean($("v6SourceFlyout") && !$("v6SourceFlyout").classList.contains("hidden"));
    if(modalOpen)return true;
    const selected=document.querySelector(".tab.is-active")?.dataset.tab;
    return Boolean(selected && selected!=="home");
  }
  function syncBack() {
    const back=webApp.BackButton;
    if(!back)return;
    safeCall(()=>needsBack()?back.show?.():back.hide?.());
  }
  function back(){
    if(accessible("mediaEpubOverlay"))return $("mediaEpubOverlay").querySelector(".epub-action")?.click();
    if(accessible("readerBackdrop"))return $("closeReader")?.click();
    if(accessible("vetoFilmOverlay"))return $("vetoFilmClose")?.click();
    if(accessible("v11DetailModal"))return $("v11DetailClose")?.click();
    if($("v4Listening")?.classList.contains("open"))return $("v4ListenClose")?.click();
    if($("v6SourceFlyout") && !$("v6SourceFlyout").classList.contains("hidden"))return $("v6SourceButton")?.click();
    const home=document.querySelector('.tab[data-tab="home"]');
    if(home){home.click();window.scrollTo({top:0,behavior:"instant"})}
  }
  safeCall(()=>webApp.BackButton?.onClick?.(back));
  function initListeners(){
    const nodes=["mediaEpubOverlay","readerBackdrop","vetoFilmOverlay","v11DetailModal","v4Listening","v6SourceFlyout","mainTabs"]
      .map($).filter(Boolean);
    const observer = new MutationObserver(syncBack);
    for(const e of nodes) observer.observe(e,{attributes:true,attributeFilter:["class"],subtree:e.id==="mainTabs"});
    document.addEventListener("click",()=>{syncBack()});
    syncBack();
    // Native external links only on an explicit user gesture. This does not
    // bypass any content licence, payment wall, or user consent.
    document.addEventListener("click",event=>{
      if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const anchor=event.target.closest?.('a[target="_blank"]');
      if(!anchor || typeof webApp.openLink!=="function")return;
      let url;try{url=new URL(anchor.href)}catch{return}
      if(url.protocol!=="https:"||url.origin===location.origin)return;
      const result=safeCall(()=>webApp.openLink(url.href));
      // API is void on success. If an exception occurred, browser opens normally.
      if(result===null)return;
      event.preventDefault();
    },true);
    document.addEventListener("click",event=>{
      if(!event.target.closest?.(".tab,.v4-dock button,.v4-home-actions button"))return;
      safeCall(()=>webApp.HapticFeedback?.selectionChanged?.());
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initListeners,{once:true});
  else initListeners();
  window.VetoTelegramMedia={active:true,syncBack,insets};
})();