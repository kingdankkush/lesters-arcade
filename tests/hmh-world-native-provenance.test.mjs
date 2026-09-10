import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createWorldDesignAppearance } from '../apps/hmh-reboot/src/world-design-native-assets.mjs';
import { auditWorldDesignAssets } from '../scripts/hmh-world-design-production-asset-qa.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const relative='apps/portal/assets/generated/hmh-world-design';
const metadata=JSON.parse(readFileSync(path.join(root,relative,'world-design.json'),'utf8'));
const textures=m=>m.tiers.desktop.pages.map(page=>({source:{width:page.width,height:page.height}}));

test('native runtime rejects finite anchors outside the frame',()=>{
  for(const mutate of [m=>m.frames[0].tiers.desktop.anchor.x=1000,m=>m.frames[0].tiers.desktop.anchor.y=-0.1]){
    const changed=structuredClone(metadata);mutate(changed);
    assert.throws(()=>createWorldDesignAppearance(changed,textures(changed)),/projection|anchor/i);
  }
});

function fixture(t){
  const dir=mkdtempSync(path.join(os.tmpdir(),'hmh-world-proof-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const files=[`${relative}/world-design.json`,...Object.values(metadata.tiers).flatMap(tier=>tier.pages.map(page=>`${relative}/${page.image}`)),
    'scripts/hmh-blender/export-hmh-world-design.py','scripts/hmh-blender/export-hmh-tripo-props.py','scripts/hmh-world-design-published-image-qa.py'];
  const provenance='docs/hmh-reboot/world-design/NATIVE-WORLD-PROVENANCE.json';
  if(existsSync(path.join(root,provenance))) files.push(provenance);
  for(const file of files){const target=path.join(dir,file);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(root,file),target);}
  // Proves fixture completeness first. A missing dependency cannot masquerade
  // as successful rejection of the deliberately changed provenance field.
  assert.doesNotThrow(()=>auditWorldDesignAssets({repoRoot:dir}));
  return dir;
}
const mutations=[
  ['source model digest',m=>m.frames[0].sourceModelSha256='f'.repeat(64)],
  ['native A digest',m=>m.frames[0].nativeFrameSha256A='e'.repeat(64)],
  ['missing native B digest',m=>delete m.frames[0].nativeFrameSha256B],
  ['positive but wrong runtime scale',m=>m.frames[0].tiers.desktop.runtimeScale*=2],
  ['in-frame but source-misaligned anchor',m=>{const a=m.frames[0].tiers.desktop.anchor;a.x+=a.x<0.8?0.1:-0.1;}],
];
for(const [name,mutate] of mutations)test(`production world audit rejects a ${name}`,t=>{
  const dir=fixture(t);const changed=structuredClone(metadata);mutate(changed);
  writeFileSync(path.join(dir,relative,'world-design.json'),JSON.stringify(changed));
  assert.throws(()=>auditWorldDesignAssets({repoRoot:dir}),/source|native|provenance|frame|scale|anchor/i);
});
