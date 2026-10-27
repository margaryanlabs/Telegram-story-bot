import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=new URL("../public/",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const file=new URL("vetogram-music-charts.js",root);
const source=readFileSync(file,"utf8");
const app=readFileSync(new URL("vetogram-music.js",root),"utf8");

test("Charts is a single music chart with no country tabs",()=>{
  assert.match(html,/data-view="charts"/);
  assert.match(html,/id="chartsTracks"/);
  assert.match(html,/id="chartsRefresh"/);
  assert.match(html,/data-chart-period="week"/);
  assert.match(html,/data-chart-genre="Pop"/);
  assert.match(html,/Чарты/);
  assert.doesNotMatch(html,/Чарты и страны|Россия · Армения|regionTracks|regionStations|data-region=|data-station=|data-home-region=/);
  assert.doesNotMatch(source,/bycountrycodeexact|regionTracks|regionStations/);
  assert.match(app,/vetogram:charts-open/);
});
test("Charts tracks come from real Audius trending endpoint",()=>{
  assert.match(source,/https:\/\/api\.audius\.co\/v1\/tracks\/trending/);
  assert.match(source,/data\.data\.map\(fromAudius\)/);
  assert.match(source,/is_stream_gated/);
  assert.match(source,/api\.play\(item,items\)/);
  assert.match(source,/AbortController/);
  assert.match(source,/Рейтинг Audius сейчас недоступен/);
  assert.doesNotMatch(source,/Math\.random\(|faker|fakeRanking|music\.yandex\.ru|vk\.com/);
  execFileSync(process.execPath,["--check",fileURLToPath(file)],{stdio:"pipe"});
});
