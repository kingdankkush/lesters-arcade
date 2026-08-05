import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * Upgrade program U1. The child shell defined its own literal palette, so the
 * portal and the game drifted apart every time either was restyled. The child
 * now imports the shared token sheet and derives its local aliases from it.
 */

const htmlUrl = new URL('../apps/portal/hmh-reboot/index.html', import.meta.url);
const cssUrl = new URL('../apps/portal/hmh-reboot/styles.css', import.meta.url);
const tokensUrl = new URL('../apps/portal/src/design-tokens.css', import.meta.url);

test('the child loads the shared design tokens', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  assert.match(html, /design-tokens\.css/, 'the child shell must import the token sheet');
  // It must load before the child stylesheet, or the child cannot reference
  // the variables it defines.
  const tokenAt = html.indexOf('design-tokens.css');
  const stylesAt = html.indexOf('styles.css');
  assert.ok(tokenAt > 0 && tokenAt < stylesAt, 'tokens must load before the child stylesheet');
});

test('the child palette derives from tokens rather than restating hexes', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  for (const alias of ['--cyan', '--gold', '--ink-muted']) {
    assert.ok(root.includes(alias), `${alias} must still exist for the child's own rules`);
  }
  // Each brand alias resolves through a token; a bare hex here is the drift
  // this task exists to remove.
  assert.match(root, /--cyan:\s*var\(--/, '--cyan must derive from a token');
  assert.match(root, /--gold:\s*var\(--/, '--gold must derive from a token');
});

test('every token the child references actually exists in the token sheet', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const tokens = await readFile(tokensUrl, 'utf8');
  const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
  const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  const referenced = [...root.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]);
  assert.ok(referenced.length > 0, 'the child must reference at least one token');
  for (const name of referenced) {
    assert.ok(defined.has(name), `${name} is referenced but not defined in design-tokens.css`);
  }
});
