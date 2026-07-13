import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const skillNames = [
  'hmh-art-generator',
  'hmh-asset-qa',
  'hmh-atlas-packager',
  'hmh-level-integrator',
  'hmh-balance-tester',
];

for (const name of skillNames) {
  test(`project skill ${name} is standalone, scoped, and verifiable`, () => {
    const url = new URL(`../.agent/skills/${name}/SKILL.md`, import.meta.url);
    const text = readFileSync(url, 'utf8');
    assert.match(text, /^---\nname: [a-z0-9-]+\ndescription: .+/);
    assert.match(text, /## Trigger/);
    assert.match(text, /## Workflow/);
    assert.match(text, /## (Verification|Pitfalls|Safety|Guardrails|Rejection Rules)/);
    assert.match(text, /npm run/);
    assert.doesNotMatch(text, /ignore previous|seed phrase|private key/i);
  });
}
