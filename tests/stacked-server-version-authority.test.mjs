import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { verifyStackedRun, createStackedVerifier } from '../server/verify/stacked.mjs';
import { bindRankedIdentity, verifyRankedRun, reverifyStoredRun } from '../server/verify/index.mjs';
import { createCanonicalSessionIdentity } from '../apps/portal/src/session-integrity.mjs';
import { resolveStackedLedgerPacing } from '../apps/portal/src/stacked-ledger-rules.mjs';
import { issueSeedTicket } from '../server/verify/seed-ticket.mjs';
import { GAME_VERSION } from '../apps/portal/src/version-tracking.mjs';
import { FIXTURE_SEED_SECRET, FIXTURE_VERIFY_AT_MS, fixtureVerifyOptions } from './fixtures/ranked/build-fixtures.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/ranked/stacked-valid.json',import.meta.url)));
const futureBuild = version => `site-${version}:game-${version}:cabinet-0.2.0`;
const [deployedMajor,deployedMinor] = GAME_VERSION.split('.').map(Number);
const unpublishedVersions = [`${deployedMajor}.${deployedMinor+1}.0`,'99.0.0'];

test('deployed verifier rejects an unpublished game version before inspecting evidence', async () => {
  for(const version of unpublishedVersions) {
    const identity = await createCanonicalSessionIdentity({...fixture.body.identity,buildHash:futureBuild(version)});
    const result = await verifyStackedRun({identity,evidence:null,nowMs:FIXTURE_VERIFY_AT_MS});
    assert.equal(result.error,'unsupported-game-version',JSON.stringify(result));
  }
});

test('a valid future-version seed MAC does not grant future replay rules, including stored reverification', async () => {
  for(const version of unpublishedVersions) {
    const requested = {...fixture.body.identity,buildHash:futureBuild(version)};
    const {seed,seedTicket} = await issueSeedTicket({...requested,secret:FIXTURE_SEED_SECRET,nowMs:FIXTURE_VERIFY_AT_MS,randomBytes:()=>Buffer.alloc(16,7)});
    const identity = await createCanonicalSessionIdentity({...requested,seed});
    const body = {...fixture.body,identity:{...requested,seed},sessionId32:identity.sessionKey,seedTicket,evidence:null};
    assert.equal((await bindRankedIdentity(body,fixtureVerifyOptions())).ok,true,'attacker obtained a correctly bound ticket');
    assert.equal((await verifyRankedRun(body,fixtureVerifyOptions())).error,'unsupported-game-version');
    const stored = await reverifyStoredRun({gameId:'stacked',identity,evidence:{encoding:'stacked-sic1+base64',text:'not-even-base64'}},{nowMs:FIXTURE_VERIFY_AT_MS});
    assert.equal(stored.error,'unsupported-game-version');
  }
});

test('unknown future rules never inherit the 2.2 ledger schedule automatically', () => {
  for(const version of ['2.3.0','2.9.0','3.0.0','99.0.0']) assert.throws(()=>resolveStackedLedgerPacing({gameVersion:version}),/unsupported.*gameVersion/i);
  assert.equal(resolveStackedLedgerPacing({gameVersion:'2.2.1'}).id,'2.2');
});

test('an isolated candidate verifier has a fixed ceiling, and historical deployed labels still verify', async () => {
  const candidate = createStackedVerifier({deployedGameVersion:'2.2.0'});
  for(const version of ['2.2.1','2.3.0','99.0.0']) {
    const identity = await createCanonicalSessionIdentity({...fixture.body.identity,buildHash:futureBuild(version)});
    assert.equal((await candidate({identity,evidence:null,nowMs:FIXTURE_VERIFY_AT_MS})).error,'unsupported-game-version');
  }
  assert.throws(()=>createStackedVerifier({deployedGameVersion:'99.0.0'}),/unsupported.*gameVersion/i);
  const original = await verifyStackedRun({identity:await createCanonicalSessionIdentity(fixture.body.identity),evidence:fixture.body.evidence,nowMs:FIXTURE_VERIFY_AT_MS});
  assert.equal(original.ok,true);
  for(const version of ['1.9.4','2.0.0','2.1.0','2.1.1']) {
    const identity = await createCanonicalSessionIdentity({...fixture.body.identity,buildHash:futureBuild(version)});
    const verified = await verifyStackedRun({identity,evidence:fixture.body.evidence,nowMs:FIXTURE_VERIFY_AT_MS});
    assert.equal(verified.ok,true,`${version}: ${JSON.stringify(verified)}`);
    assert.equal(verified.stats.boardHash,original.stats.boardHash);
  }
});
