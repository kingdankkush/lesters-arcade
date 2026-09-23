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
