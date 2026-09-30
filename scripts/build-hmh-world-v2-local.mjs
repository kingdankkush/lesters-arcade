// Explicit private build only. Normal build.mjs never imports this entry.
import { build, stop } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(repo,'apps/hmh-reboot/src/dev');
const portal=path.join(repo,'apps/portal'),output=path.join(portal,'dist/hmh-world-v2-local');
if(!output.startsWith(portal+path.sep))throw Error('private output must remain within this portal');
for(const location of [portal,path.join(portal,'dist'),output]){
  if(fs.existsSync(location)&&fs.lstatSync(location).isSymbolicLink())throw Error('private output ancestry must not be a junction or symlink');
}
fs.mkdirSync(output,{recursive:true});
if(fs.realpathSync(output)!==output)throw Error('private output must resolve to its owned path');
let result;
try{result=await build({entryPoints:{entry:path.join(source,'world-v2-local-entry.mjs')},absWorkingDir:repo,outdir:output,bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',minify:true,metafile:true,chunkNames:'chunks/[name]-[hash]'});}
finally{stop();}
fs.writeFileSync(path.join(output,'meta.json'),JSON.stringify(result.metafile,null,2));
fs.copyFileSync(path.join(source,'world-v2-local.css'),path.join(output,'world.css'));
fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark"><title>HMH · Local Free world test</title><link rel="stylesheet" href="./world.css"></head><body><main data-world-root></main><script type="module" src="./entry.js"></script></body></html>');
console.log(JSON.stringify({output,scope:'Private loopback Free world movement only; no normal build or official entry',inputs:Object.keys(result.metafile.inputs).length,outputs:Object.keys(result.metafile.outputs).length}));
