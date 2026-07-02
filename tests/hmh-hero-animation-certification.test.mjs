import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildHeroAnimationCertification, renderHeroAnimationCertificationMarkdown } from '../scripts/hero-animation-certification.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-19 certifies all playable heroes across core runtime states and 8 directions', () => {
  const cert = buildHeroAnimationCertification();

  assert.equal(cert.version, 'wo-19-hero-animation-certification-v1');
  assert.equal(cert.summary.heroCount >= 4, true);
  assert.equal(cert.summary.failedHeroCount, 0);
  assert.equal(cert.summary.coreCertifiedHeroCount, cert.summary.heroCount);
  for (const hero of cert.heroes) {
    assert.equal(hero.coreCertified, true, `${hero.key} core certified`);
    assert.equal(hero.directionCoverage.complete, true, `${hero.key} has all 8 dirs`);
    assert.equal(hero.smoothness.pass, true, `${hero.key} smoothness pass`);
  }
});

test('WO-19 certification includes final completion-pack polish without relying on still fallbacks', () => {
  const cert = buildHeroAnimationCertification();

  assert.ok(cert.finalCompletionPack.heroPolishStates.length > 0);
  assert.ok(cert.finalCompletionPack.heroActorCount >= cert.summary.heroCount);
  assert.ok(cert.summary.averageMinFramesPerState >= 7);
  assert.ok(cert.recommendations.some((item) => /runtime roster/i.test(item)));
});

test('WO-19 certification markdown and scripts are wired', () => {
  const cert = buildHeroAnimationCertification();
  const markdown = renderHeroAnimationCertificationMarkdown(cert);
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.match(markdown, /# Hard Money Heroes Hero Animation Certification/i);
  assert.match(markdown, /Smoothness/i);
  assert.equal(packageJson.includes('design:hero-cert'), true);
  assert.equal(syntaxCheck.includes('scripts/hero-animation-certification.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-hero-animation-certification.test.mjs'), true);
});
