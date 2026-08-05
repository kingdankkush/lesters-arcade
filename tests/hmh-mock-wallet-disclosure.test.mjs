import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWalletConnectionModel,
  SIMULATED_WALLET_ADDRESS,
} from '../apps/portal/src/arcade-core.mjs';

const REAL = '0xabcdef0123456789abcdef0123456789abcdef01';
const RIGHT_CHAIN = 4441; // LitVM LiteForge

// U11a. connectWallet() falls back to connectMockWallet() whenever no injected
// provider answers. Before this change the resulting model was byte-identical
// to a real connection -- same 'connected-valid-chain' status, same rendering
// path -- so a visitor with no wallet installed saw a connected wallet and had
// no way to learn otherwise. The whole point of the fix is that the model
// itself can tell the two apart.

test('the simulated wallet address is exported so callers stop hardcoding it', () => {
  assert.match(SIMULATED_WALLET_ADDRESS, /^0x[0-9a-f]{40}$/);
});

test('a real injected connection is not marked simulated', () => {
  const model = buildWalletConnectionModel({
    providerAvailable: true,
    wallet: REAL,
    chainId: RIGHT_CHAIN,
    connector: 'injected-evm',
  });
  assert.equal(model.simulated, false);
  assert.equal(model.status, 'connected-valid-chain');
  assert.equal(model.disclosure, null);
});

test('the mock connector produces a distinct status, not a connected one', () => {
  const model = buildWalletConnectionModel({
    providerAvailable: false,
    wallet: SIMULATED_WALLET_ADDRESS,
    chainId: RIGHT_CHAIN,
    connector: 'mock-wallet',
  });
  assert.equal(model.simulated, true);
  assert.equal(model.status, 'simulated-wallet');
  assert.notEqual(model.status, 'connected-valid-chain');
});

test('the simulated address is recognised even if the connector lies', () => {
  // Defence in depth: the address is the ground truth. A stale or wrong
  // connector string must not be able to promote a mock wallet to a real one.
  const model = buildWalletConnectionModel({
    providerAvailable: true,
    wallet: SIMULATED_WALLET_ADDRESS,
    chainId: RIGHT_CHAIN,
    connector: 'injected-evm',
  });
  assert.equal(model.simulated, true);
  assert.equal(model.status, 'simulated-wallet');
});

test('a simulated wallet carries disclosure copy that names it as not real', () => {
  const model = buildWalletConnectionModel({
    providerAvailable: false,
    wallet: SIMULATED_WALLET_ADDRESS,
    connector: 'mock-wallet',
  });
  assert.ok(model.disclosure, 'simulated wallets must carry disclosure copy');
  assert.match(model.disclosure.headline, /simulated/i);
  // The copy has to state the two consequences a user actually cares about:
  // nothing is on-chain, and this identity does not persist to a real account.
  const detail = model.disclosure.detail.toLowerCase();
  assert.ok(detail.includes('not'), 'detail must state what this wallet is not');
  assert.match(detail, /on-chain|blockchain|chain/);
  assert.ok(
    model.disclosure.action.length > 0,
    'disclosure must tell the user how to connect a real wallet',
  );
});

test('a simulated wallet cannot settle or play ranked', () => {
  const simulated = buildWalletConnectionModel({
    providerAvailable: false,
    wallet: SIMULATED_WALLET_ADDRESS,
    chainId: RIGHT_CHAIN,
    connector: 'mock-wallet',
  });
  const real = buildWalletConnectionModel({
    providerAvailable: true,
    wallet: REAL,
    chainId: RIGHT_CHAIN,
    connector: 'injected-evm',
  });
  assert.equal(simulated.canSettle, false);
  assert.equal(real.canSettle, true);
});

test('a simulated wallet never reports a satisfied chain guard', () => {
  // A mock wallet is on no chain at all. Reporting 'right-chain' would let the
  // ranked path believe the network precondition was met.
  const model = buildWalletConnectionModel({
    providerAvailable: false,
    wallet: SIMULATED_WALLET_ADDRESS,
    chainId: RIGHT_CHAIN,
    connector: 'mock-wallet',
  });
  assert.notEqual(model.chainGuard.status, 'right-chain');
});

test('the disconnected states are unchanged', () => {
  const guest = buildWalletConnectionModel({ providerAvailable: false });
  const ready = buildWalletConnectionModel({ providerAvailable: true });
  assert.equal(guest.status, 'mock-ready');
  assert.equal(ready.status, 'ready');
  assert.equal(guest.simulated, false);
  assert.equal(ready.simulated, false);
  assert.equal(guest.canSettle, false);
});
