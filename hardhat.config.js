// Hardhat 3 configuration: the in-process EDR chain only (contract A21).
//
// chainId 4441 matches LitVM LiteForge, so EIP-712 domains, session keys and
// LITVM_LITEFORGE_NETWORK work unchanged against the local chain. There is no
// `solidity` section and no source path is compiled: tests and the rehearsal
// deploy the committed contracts/artifacts/*.json bytecode. Nothing here needs
// network access (no forking, no remote network), and Hardhat never downloads a
// compiler for it. tests/local-deploy-harness.test.mjs proves both offline.
//
//   const { provider } = await (await import('hardhat')).default.network.connect();
//   await provider.request({ method: 'eth_chainId' }); // '0x1159'
//
// scripts/lib/local-chain.mjs wraps this network for tests and the rehearsal.
export default {
  networks: {
    default: {
      type: 'edr-simulated',
      chainId: 4441,
    },
  },
};
