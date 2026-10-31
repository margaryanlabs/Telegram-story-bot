#!/usr/bin/env node
// Usage: node scripts/validate-vetogram-game.mjs path/to/game.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePlayManifest } from '../lib/vetogram-play-manifest.js';

const input=process.argv[2];
if(!input){console.error('Usage: node scripts/validate-vetogram-game.mjs path/to/game.json');process.exitCode=1;}
else {
  try {
    const manifest=JSON.parse(readFileSync(resolve(input),'utf8'));
    const result=validatePlayManifest(manifest);
    if(!result.valid) { for(const issue of result.errors)console.error('• '+issue);process.exitCode=1; }
    else console.log('Game metadata validated. This is NOT a security or publication approval.');
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
