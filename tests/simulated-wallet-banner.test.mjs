// U11a shell banner (#simulatedWalletBanner). Its renderer ran only from
// renderLogin(), which lost its last caller in 372c7ef9 (2026-08-05), so the
// banner was never shown while every other U11a disclosure kept working. These
// tests read apps/portal/main.js itself: a call site counts only when the
// function it sits in is referenced somewhere else, and the real renderer runs
// in a VM against a fake banner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

import { buildWalletConnectionModel, SIMULATED_WALLET_ADDRESS } from '../apps/portal/src/arcade-core.mjs';

const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'module' });

// Every identifier named `name` that refers to a binding (not `x.name` or a
// `{ name: ... }` key), with its parent and the top-level statement it sits in.
function references(name) {
  const found = [];
  const visit = (node, parent, key, owner) => {
    if (node.type === 'Identifier' && node.name === name) {
      const memberProperty = parent?.type === 'MemberExpression' && key === 'property' && !parent.computed;
      const propertyKey = parent?.type === 'Property' && key === 'key' && !parent.computed && !parent.shorthand;
      if (!memberProperty && !propertyKey) found.push({ parent, key, owner });
    }
    for (const [childKey, value] of Object.entries(node)) {
      if (Array.isArray(value)) value.forEach((child) => child?.type && visit(child, node, childKey, owner));
      else if (value?.type) visit(value, node, childKey, owner);
    }
  };
  for (const statement of ast.body) visit(statement, null, null, statement);
  return found;
}

// The name a top-level statement declares, or null for code that runs at load.
function ownerName(owner) {
  if (owner.type === 'FunctionDeclaration') return owner.id.name;
  if (owner.type === 'VariableDeclaration') return owner.declarations[0]?.id?.name ?? null;
  return null;
}

// Runs at load, or is called (or handed on, as render is to the route
// controller) from outside its own body.
function isLive(owner) {
  const name = ownerName(owner);
  return name === null || references(name).some((reference) => reference.owner !== owner);
}

function functionSource(name) {
  const node = ast.body.find((entry) => entry.type === 'FunctionDeclaration' && entry.id.name === name);
  assert.ok(node, `main.js declares ${name}`);
  return main.slice(node.start, node.end);
}

test('renderSimulatedWalletBanner has a live caller', () => {
  const callers = references('renderSimulatedWalletBanner')
    .filter(({ parent, key }) => parent?.type === 'CallExpression' && key === 'callee')
    .map(({ owner }) => owner);
  const live = callers.filter(isLive).map((owner) => ownerName(owner) ?? '(module load)');
  assert.ok(
    live.length > 0,
    `renderSimulatedWalletBanner() is called only from ${callers.map(ownerName).join(', ') || 'nowhere'}, and nothing calls those`,
  );
  // render() is the shell render path: sign-in, the simulated fallback,
  // accountsChanged, restore, and sign-out (through setView) all end there.
  assert.ok(live.includes('render'), `expected render() among the live callers, got ${live.join(', ')}`);
});

test('no dead function still calls renderSimulatedWalletBanner', () => {
  // renderLogin() kept its call for weeks after nothing called renderLogin, so
  // the source read as if the banner were wired up while it never rendered.
  const dead = references('renderSimulatedWalletBanner')
    .filter(({ parent, key }) => parent?.type === 'CallExpression' && key === 'callee')
    .map(({ owner }) => owner)
    .filter((owner) => !isLive(owner))
    .map(ownerName);
  assert.deepEqual(dead, [], `dead callers of renderSimulatedWalletBanner: ${dead.join(', ')}`);
});

const REAL = `0x${'ab'.repeat(20)}`;

function bannerHarness() {
  const banner = {
    hidden: true,
    dataset: {},
    children: [],
    rebuilds: 0,
    replaceChildren(...nodes) { this.rebuilds += 1; this.children = nodes; },
    append(node) { this.children.push(node); },
  };
  const context = {
    dom: { simulatedWalletBanner: banner },
    connectedWallet: null,
    walletConnector: 'none',
    connectedChainId: null,
    SIMULATED_WALLET_ADDRESS,
    buildWalletConnectionModel,
    detectEthereumProvider: () => null,
    appendText: (parent, tagName, text) => parent.append({ tagName, text }),
  };
  const render = runInNewContext(
    `${functionSource('isSimulatedWalletActive')}\n${functionSource('renderSimulatedWalletBanner')}\nrenderSimulatedWalletBanner`,
    context,
  );
  return { banner, context, render };
}

test('the banner shows only while the simulated identity is signed in, and is not rebuilt per route', () => {
  const { banner, context, render } = bannerHarness();
  render();
  assert.equal(banner.hidden, true, 'a guest has nothing to disclose');
  assert.equal(banner.rebuilds, 0);

  Object.assign(context, { connectedWallet: SIMULATED_WALLET_ADDRESS, walletConnector: 'mock-wallet' });
  render();
  assert.equal(banner.hidden, false);
  assert.equal(banner.dataset.simulatedWallet, 'true');
  assert.deepEqual(banner.children.map((node) => node.tagName), ['strong', 'span', 'small']);
  assert.match(banner.children[0].text, /simulated/i);
  assert.match(banner.children[1].text, /blockchain|on-chain/i);

  // render() runs on every route change; a rebuilt role=status region would
  // be announced again each time.
  const [headline] = banner.children;
  render();
  render();
  assert.equal(banner.rebuilds, 1);
  assert.equal(banner.children[0], headline);

  Object.assign(context, { connectedWallet: null, walletConnector: 'none' });
  render();
  assert.equal(banner.hidden, true, 'sign-out hides it');
  assert.deepEqual(banner.children, []);
});

test('a real wallet never shows the banner', () => {
  const { banner, context, render } = bannerHarness();
  Object.assign(context, {
    connectedWallet: REAL,
    walletConnector: 'injected-evm',
    connectedChainId: '0x1159',
    detectEthereumProvider: () => ({ request: async () => null }),
  });
  render();
  assert.equal(banner.hidden, true);
  assert.deepEqual(banner.children, []);

  // Switching from the simulated identity to a real wallet takes it down.
  Object.assign(context, { connectedWallet: SIMULATED_WALLET_ADDRESS, walletConnector: 'mock-wallet' });
  render();
  assert.equal(banner.hidden, false);
  Object.assign(context, { connectedWallet: REAL, walletConnector: 'injected-evm' });
  render();
  assert.equal(banner.hidden, true);
  assert.deepEqual(banner.children, []);
});

test('active play hides the banner with the rest of the shell chrome', () => {
  // Above the game frame it pushed the frame's bottom off screen; the nav and
  // footer are hidden in play for the same reason.
  const css = readFileSync(new URL('../apps/portal/styles.css', import.meta.url), 'utf8');
  assert.match(css, /html\[data-ingame="true"\] \.simulated-wallet-banner \{\s*display: none;\s*\}/);
});
