import test from 'node:test';import assert from 'node:assert/strict';
import {resolveReadableGameplayZoom} from '../apps/hmh-reboot/src/game-feel.mjs';
import {roundedRoadNodes} from '../apps/hmh-reboot/src/road-presentation.mjs';
test('phone framing shows 25 percent more world without changing desktop framing',()=>{const args={viewportHeight:896,bodyHeight:53,framingZoom:.9};assert.equal(resolveReadableGameplayZoom({...args,mobile:true}),resolveReadableGameplayZoom(args)*.8);});
test('road corner refinement preserves endpoints and stays inside the existing road',()=>{const nodes=[{x:0,y:0},{x:300,y:0},{x:300,y:400}],saved=JSON.stringify(nodes),points=roundedRoadNodes(nodes,192);assert.equal(JSON.stringify(nodes),saved);assert.deepEqual(points[0],nodes[0]);assert.deepEqual(points.at(-1),nodes.at(-1));assert.ok(points.length>nodes.length);for(const p of points)assert.ok(Math.min(Math.abs(p.y),Math.abs(p.x-300))<=192/8);});
