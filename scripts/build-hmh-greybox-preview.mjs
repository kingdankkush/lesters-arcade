// Explicit local preview build only. Normal production build.mjs does not
// import this development entry or these world data. No Git/runtime queries.
import { build,stop } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(repo,'apps/hmh-reboot/src/dev'),output=path.join(repo,'apps/portal/dist/hmh-greybox');
fs.mkdirSync(output,{recursive:true});
let result;
try{result=await build({entryPoints:{entry:path.join(source,'greybox-entry.mjs')},absWorkingDir:repo,outdir:output,bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',minify:true,metafile:true,chunkNames:'chunks/[name]-[hash]'});}
finally{stop();}
fs.writeFileSync(path.join(output,'meta.json'),JSON.stringify(result.metafile,null,2));
fs.copyFileSync(path.join(source,'greybox-preview.css'),path.join(output,'preview.css'));
fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HMH ten-area local Free greybox</title><link rel="stylesheet" href="./preview.css"></head><body><main data-greybox-root></main><script type="module" src="./entry.js"></script></body></html>');
console.log(JSON.stringify({output,scope:'Separate local Free greybox preview only; absent from normal production entry',inputs:Object.keys(result.metafile.inputs).length,outputs:Object.keys(result.metafile.outputs).length}));
