import './check.mjs';
import {mkdir,cp,rm} from 'node:fs/promises';
const output=new URL('../dist/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(new URL('../index.html',import.meta.url),new URL('index.html',output));
await cp(new URL('../v10/',import.meta.url),new URL('v10/',output),{recursive:true});
console.log('V11 build: static HTML, original V10 modules and V11 visual layer. No backend or private data.');
