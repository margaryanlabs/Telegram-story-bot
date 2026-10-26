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
