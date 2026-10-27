/* VETOGRAM CINEMA — transport adapter for rights-cleared movies, not a content source.
 * Never interprets a metadata listing as permission to stream.
 * Supports MP4/WebM, HLS, and expressly allowed embeds. No piracy hosts configured.
 */
(function () {
  "use strict";
  const HLS_JS_URL = "https://cdn.jsdelivr.net/npm/hls.js@1.6.13/dist/hls.min.js";
  let loader = null;
  const isHttps = (url) => {
    try { return new URL(url).protocol === "https:"; } catch (_) { return false; }
  };
  function assertAuthorized(item) {
    if (!item || !isHttps(item.url)) throw new Error("Для просмотра нужен HTTPS-видеопоток.");
    if (item.licensed !== true || !item.license || !item.credit) {
      throw new Error("Этот видеопоток не подтверждён правообладателем.");
    }
    return item;
  }
  function detectType(item) {
    if (item.type === "iframe" || item.type === "hls" || item.type === "video") return item.type;
    if (/\.m3u8(?:[?#]|$)/i.test(item.url)) return "hls";
    return "video";
  }
  function loadHls() {
    if (window.Hls && window.Hls.isSupported()) return Promise.resolve(window.Hls);
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HLS_JS_URL;
      script.crossOrigin = "anonymous";
      script.async = true;
      script.onload = () => {
        if (window.Hls && window.Hls.isSupported()) resolve(window.Hls);
        else reject(new Error("Встроенный браузер не поддерживает HLS через MediaSource."));
      };
      script.onerror = () => reject(new Error("Не удалось загрузить модуль HLS."));
      document.head.append(script);
    }).catch((error) => { loader = null; throw error; });
    return loader;
  }
  /**
   * Attaches a playback source. For iframe playback, the provider must be explicitly
   * allowlisted in allowedIframeOrigins. This is a safety/rights control, NOT a proxy.
   * Caller must invoke cleanup() on switching sources or closing the film.
   */
  async function attach(options) {
    const {video, container, source, allowedIframeOrigins = [], onError = () => {}} = options;
    assertAuthorized(source);
    const type = detectType(source);
    if (type === "iframe") {
      const url = new URL(source.url);
      if (!allowedIframeOrigins.includes(url.origin)) {
        throw new Error("Этот видеопровайдер не разрешён для встраивания.");
      }
      const frame = document.createElement("iframe");
      frame.src = url.href;
      frame.title = source.label || "Лицензированный киноплеер";
      frame.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
      frame.allowFullscreen = true;
      frame.referrerPolicy = "no-referrer";
      frame.className = "cinema-provider-frame";
      video.hidden = true;
      container.append(frame);
      return {mode:"iframe", cleanup() {frame.remove(); video.hidden = false;}};
    }
    video.hidden = false;
    const url = source.url;
    if (type !== "hls") {
      video.src = url;
      video.load();
      return {mode:"video", cleanup() {video.pause();video.removeAttribute("src");video.load();}};
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.load();
      return {mode:"hls-native", cleanup() {video.pause();video.removeAttribute("src");video.load();}};
    }
    const Hls = await loadHls();
    const hls = new Hls({enableWorker: true, lowLatencyMode: false, backBufferLength: 40});
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data && data.fatal) {
        onError(data.details || "Ошибка воспроизведения HLS.");
      }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    return {mode:"hls-js", cleanup() {hls.destroy();video.pause();video.removeAttribute("src");video.load();}};
  }
  window.VetogramCinemaProvider = Object.freeze({attach, detectType, assertAuthorized, isHttps});
})();