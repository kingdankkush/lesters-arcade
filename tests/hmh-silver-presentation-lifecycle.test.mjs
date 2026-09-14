import test from 'node:test';
import assert from 'node:assert/strict';
import {Container,Graphics,Sprite,Texture,TextureSource,Rectangle} from 'pixi.js';
import {createSilverDropPresentation} from '../apps/hmh-reboot/src/silver-drop-presentation.mjs';

test('silver presentation releases its fixed pool and frame views exactly once while retaining the shared atlas',async()=>{
  const source=new TextureSource({width:576,height:192}), atlas=new Texture({source});
  const display=await createSilverDropPresentation({Assets:{load:async()=>atlas},Container,Graphics,Sprite,Texture,Rectangle});
  const sprites=display.container.children.filter(c=>c instanceof Sprite);
  assert.equal(sprites.length,64);
  const frame=sprites[0].texture;
  assert.equal(typeof display.destroy,'function');
  display.destroy();display.destroy();
  assert.ok(display.container.destroyed);
  assert.ok(sprites.every(s=>s.destroyed));
  assert.ok(frame.destroyed);
  assert.equal(source.destroyed,false);
  atlas.destroy(true);
});
