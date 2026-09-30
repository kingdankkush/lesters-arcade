import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

test('test-source tripwire rejects direct Git probes and default sourceRevision calls', () => {
  const root = new URL('./', import.meta.url);
  const directGit = /(?:spawn(?:Sync)?|execFile(?:Sync)?|exec(?:Sync)?)\s*\(\s*['"]git(?:\.exe)?['"]/;
  const gitAvailability = /\b(?:gitAvailable|gitLfsAvailable|insideGitWorkTree)\s*\(/;
  const metadataDefaults = /\bsourceRevision\s*\(\s*[^,()]+\s*\)/;
  for (const file of readdirSync(root, { recursive: true }).filter(file => /\.(mjs|py)$/.test(file))) {
    const source = readFileSync(new URL(file.replaceAll('\\', '/'), root), 'utf8');
    assert.equal(metadataDefaults.test(source), false, `${file}: revision helper must use an injected command transcript`);
    assert.equal(directGit.test(source), false, `${file}: direct Git process inside a test`);
    assert.equal(gitAvailability.test(source), false, `${file}: missing Git must not turn an unexercised proof into a pass`);
  }
});
