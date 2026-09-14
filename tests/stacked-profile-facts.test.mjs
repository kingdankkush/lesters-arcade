import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStackedProfileFacts,stackedInputLabel} from '../apps/portal/src/stacked-profile.mjs';
test('profile facts preserve unknown fields and reject other games, wallets and archive identities',()=>{
 const row={sessionId:'run-one',gameId:'stacked',wallet:'alice',status:'local-replay-preview',canonical:{gameId:'stacked',score:90,lines:8,pieces:30,quadClears:2,level:2,maxCombo:2}};
 const progress={rankedArchive:{'run-one':row,'wrong-game':{...row,sessionId:'wrong-game',gameId:'chikun'},'wrong-wallet':{...row,sessionId:'wrong-wallet',wallet:'bob'},bad:row}};
 const facts=buildStackedProfileFacts(progress,'alice');
 assert.equal(facts.runs,1);assert.equal(facts.totalLines,8);assert.equal(facts.totalHalvings,2);assert.equal(facts.spins,null);assert.equal(facts.ledgerReceived,null);
 assert.equal(stackedInputLabel(''), 'Input not recorded');assert.equal(stackedInputLabel('mixed'),'Mixed inputs');
});
