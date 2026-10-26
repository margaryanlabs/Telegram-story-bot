import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("../public/media.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/media.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../public/media.js", import.meta.url), "utf8");
const epub = readFileSync(new URL("../public/media-epub.js", import.meta.url), "utf8");

test("MEDIA standalone entrypoint, responsive design and shared mark are present", () => {
  for (const item of ['href="./veto-telegram-mark.svg"', 'href="./media.css"', 'src="./media.js"', 'name="viewport"']) {
    assert.ok(html.includes(item), item);
  }
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /media-reader\.css/);
  assert.match(html, /media-epub\.js/);
  assert.match(html, /epubjs@0\.3\.93/);
});

test("MEDIA app source parses and includes declared DOM IDs", () => {
  execFileSync(process.execPath, ["--check", join(process.cwd(), "public/media.js")], { stdio: "pipe" });
  execFileSync(process.execPath, ["--check", join(process.cwd(), "public/media-epub.js")], { stdio: "pipe" });
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const jsIds = [...js.matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]);
  for (const id of jsIds) assert.ok(ids.has(id), "Missing HTML id: " + id);
});

test("MEDIA keeps data sourcing separate from protected Telegram owner session", () => {
  assert.match(js, /https:\/\/api\.audius\.co\/v1/);
  assert.match(js, /https:\/\/gutendex\.com\/books/);
  assert.match(js, /https:\/\/librivox\.org\/api\/feed\/audiobooks\//);
  assert.doesNotMatch(js, /telegram-session-owner|\/api\/telegram-chats|TELEGRAM_BOT_TOKEN|api\.telegram\.org\/bot/i);
});

test("MEDIA sanitizes external URLs and avoids raw HTML injection", () => {
  assert.match(js, /url\.protocol === "https:"/);
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
  assert.match(js, /textContent/);
});


test("EPUB reader loads only user-provided local files and disables scripts", () => {
  assert.match(epub, /const MAX_FILE = 35 \* 1048576/);
  assert.match(epub, /indexedDB\.open\(DB,1\)/);
  assert.match(epub, /allowScriptedContent:false/);
  assert.match(epub, /crypto\.subtle\.digest\("SHA-256",buffer\)/);
  assert.match(epub, /"pure"/);
  assert.match(epub, /"cinema"/);
  assert.match(epub, /"deep"/);
  assert.doesNotMatch(epub, /uploadToServer|TELEGRAM_BOT_TOKEN|innerHTML\s*=/);
});

test("Films experience stays separate from messenger and validates archive items", () => {
  const films = readFileSync(new URL("../public/media-films.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../public/media-films.css", import.meta.url), "utf8");
  execFileSync(process.execPath, ["--check", join(process.cwd(), "public/media-films.js")], {stdio:"pipe"});
  assert.match(html, /id="filmsView"/);
  assert.match(html, /data-tab="films"/);
  assert.match(html, /media-films\.js/);
  assert.match(html, /media-films\.css/);
  for (const id of ["vetoFilmRail","vetoFilmHero","vetoFilmEmbed","vetoFilmClose"]) assert.ok(html.includes('id="'+id+'"'));
  assert.match(films, /licenseurl:\*publicdomain\*/);
  assert.match(films, /\/publicdomain\/i/);
  assert.match(films, /\/\^\[A-Za-z0-9_.-\]/);
  assert.match(styles, /veto-film-rail/);
  assert.doesNotMatch(films, /innerHTML\s*=/);
});

test("V4 entertainment home and full-screen listening room are isolated", () => {
  const v4 = readFileSync(new URL("../public/media-v4.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/media-v4.css", import.meta.url), "utf8");
  execFileSync(process.execPath, ["--check", join(process.cwd(), "public/media-v4.js")], {stdio:"pipe"});
  assert.match(html, /id="homeView"/);
  assert.match(html, /data-tab="home"/);
  assert.match(html, /media-v4\.css/);
  assert.match(html, /media-v4\.js/);
  assert.match(v4, /v4-listening/);
  assert.match(v4, /aria-modal/);
  assert.match(v4, /data-v4-search/);
  assert.match(v4, /v4PlayPause/);
  assert.match(v4, /localStorage\.setItem/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /v4-dock/);
  assert.doesNotMatch(v4, /TELEGRAM_BOT_TOKEN|telegram-session-owner|api\.telegram\.org\/bot/i);
});

test("V5 personal collections are browser-local, bounded and linked from media.html", () => {
  const v5=readFileSync(new URL("../public/media-v5.js", import.meta.url), "utf8");
  const visual=readFileSync(new URL("../public/media-v5.css", import.meta.url), "utf8");
  execFileSync(process.execPath, ["--check", join(process.cwd(),"public/media-v5.js")], {stdio:"pipe"});
  assert.match(html, /media-v5\.js/);
  assert.match(html, /media-v5\.css/);
  assert.match(v5, /veto-media-personal-v5/);
  assert.match(v5, /localStorage\.setItem/);
  assert.match(v5, /MAX=60/);
  assert.match(v5, /veto-media-v5-watchlist/);
  assert.match(v5, /v5SaveFilm/);
  assert.match(v5, /v5SaveBook/);
  assert.match(v5, /URL\.createObjectURL/);
  assert.match(visual, /v5-personal/);
  assert.match(visual, /prefers-reduced-motion/);
  assert.doesNotMatch(v5, /TELEGRAM_BOT_TOKEN|telegram-session-owner|api\.telegram\.org\/bot/i);
});

test("V6 source reporting, bounded collection restore and audio recovery", () => {
  const v6=readFileSync(new URL("../public/media-v6.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../public/media-v6.css",import.meta.url),"utf8");
  const v5=readFileSync(new URL("../public/media-v5.js",import.meta.url),"utf8");
  execFileSync(process.execPath,["--check",join(process.cwd(),"public/media-v6.js")],{stdio:"pipe"});
  assert.match(html,/media-v6\.js/);
  assert.match(html,/media-v6\.css/);
  assert.match(v6,/veto:provider/);
  assert.match(v6,/veto:stream-error/);
  assert.match(v6,/v6Recovery/);
  assert.match(v6,/v6Continue/);
  assert.match(v6,/v6ImportFile/);
  assert.match(v5,/window\.VetoPersonal/);
  assert.match(v5,/importCollection\(input\)/);
  assert.match(v5,/data\[type\]=previous/);
  assert.match(v5,/!persist\(\)/);
  assert.match(js,/AbortController/);
  assert.match(css,/v6-source-flyout/);
  assert.doesNotMatch(v6,/TELEGRAM_BOT_TOKEN|telegram-session-owner|api\.telegram\.org\/bot/i);
});

test("V7 Telegram native launch is optional and respects safe areas", () => {
  const sdk=readFileSync(new URL("../public/media-telegram.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../public/media-telegram.css",import.meta.url),"utf8");
  execFileSync(process.execPath,["--check",join(process.cwd(),"public/media-telegram.js")],{stdio:"pipe"});
  assert.match(html,/https:\/\/telegram\.org\/js\/telegram-web-app\.js/);
  assert.match(html,/media-telegram\.js/);
  assert.match(html,/media-telegram\.css/);
  assert.match(sdk,/typeof webApp\.initData/);
  assert.match(sdk,/webApp\.BackButton/);
  assert.match(sdk,/webApp\.openLink/);
  assert.match(sdk,/contentSafeAreaInset/);
  assert.match(sdk,/themeChanged/);
  assert.match(sdk,/mediaHost = "browser"/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/--media-tg-bottom/);
  assert.doesNotMatch(sdk,/TELEGRAM_BOT_TOKEN|telegram-session-owner|api\.telegram\.org\/bot/i);
});
test("V7 audiobook restores the last listening chapter without a backend", () => {
  assert.match(js,/AUDIO_PROGRESS_KEY/);
  assert.match(js,/readAudioBookmark/);
  assert.match(js,/rememberAudioBookmark/);
  assert.match(js,/loadedmetadata/);
  assert.match(js,/localStorage\.setItem\(AUDIO_PROGRESS_KEY/);
});
