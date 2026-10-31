/* Pure Node regression gate for V6.1 shipping module syntax coverage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const modules=[
 'public/vetogram-universe.js','public/vetogram-universe-61-core.js',
 'public/vetogram-universe-61.js','public/vetogram-media-context.js',
 'public/vetogram-media-bridge.js','public/vetogram-music.js',
 'public/cinema.js','public/books.js'
];
test('release check syntax-parses every VETOGRAM 6.1 controller',()=>{
 for(const file of modules)
  assert.ok(manifest.scripts.check.includes('node --check '+file),'missing Node syntax gate: '+file);
});
test('offline Universe suite is included in npm scripts and production gate',()=>{
 assert.match(manifest.scripts['qa:universe'],/node --test tests\/vetogram-universe\*\.test\.js/);
 assert.match(manifest.scripts['vercel-build'],/npm run check/);
 assert.match(manifest.scripts['vercel-build'],/npm test/);
});
