// The server's own read provider (guide §5.2 item 6, contract §9.2 RPC_URL).
//
// staticNetwork: the chain id is fixed, so the provider never probes the
// network on construction and never follows a node that reports another
// chain. The URL may carry credentials; it is never logged or echoed.

import { ethers } from 'ethers';

export const LITEFORGE_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
export const LITEFORGE_CHAIN_ID = 4441;

export function createPublicProvider({ rpcUrl = LITEFORGE_RPC_URL, chainId = LITEFORGE_CHAIN_ID } = {}) {
  return new ethers.JsonRpcProvider(rpcUrl || LITEFORGE_RPC_URL, Number(chainId), { staticNetwork: true });
}

// Gives handler deps a `provider` that is created on first use and cached in
// the calling module's scope. An override (tests, the local rehearsal) wins.
export function attachLazyProvider(deps, overrides = {}, cache = {}) {
  let provider = overrides.provider ?? null;
  Object.defineProperty(deps, 'provider', {
    enumerable: true,
    configurable: true,
    get() {
      if (!provider) {
        if (!cache.provider || cache.rpcUrl !== deps.config.rpcUrl || cache.chainId !== deps.config.chainId) {
          cache.provider = createPublicProvider({ rpcUrl: deps.config.rpcUrl, chainId: deps.config.chainId });
          cache.rpcUrl = deps.config.rpcUrl;
          cache.chainId = deps.config.chainId;
        }
        provider = cache.provider;
      }
      return provider;
    },
  });
  return deps;
}
