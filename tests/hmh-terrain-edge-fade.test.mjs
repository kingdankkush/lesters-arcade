import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodePng} from '../scripts/hmh-reboot-visual-regression.mjs';

test('terrain shoulders, banks and scree meet surrounding ground with transparent outer edges',()=>{
  for(const name of ['road-shoulder','shore-band','scree-skirt']){
    const image=decodePng(readFileSync(new URL(`../apps/portal/assets/generated/hmh-terrain-tiles/${name}.png`,import.meta.url)));
    assert.equal(image.channels,4);
    let inner=0,outer=0;
    for(let x=0;x<image.width;x++){
      inner+=image.pixels[x*4+3];
      outer+=image.pixels[((image.height-1)*image.width+x)*4+3];
    }
    assert.ok(inner/image.width>200,`${name} must cover its physical edge`);
    assert.equal(outer,0,`${name} must dissolve fully into the surrounding material`);
  }
});
