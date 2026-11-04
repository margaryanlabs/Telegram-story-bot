import './check.mjs';
import {mkdir,cp,rm} from 'node:fs/promises';
const output=new URL('../dist/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('../index.html',import.meta.url),new URL('index.html',output));
await cp(new URL('../v10/',import.meta.url),new URL('v10/',output),{recursive:true});
console.log('V10 build: dist/ contains only site HTML and V10 assets. No backend source, tests or private data.');
