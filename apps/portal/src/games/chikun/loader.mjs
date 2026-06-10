// Chikun — third-party flappy-bird style game (LitVM port).
//
// Pattern: identical to games/hmh/loader.mjs — a thin `loadChikunGame()`
// boundary that returns the game's assets + entry point. Called lazily from
// the cabinet-click handler so the parent shell stays small.
//
// The Chikun dev team can drop their code into this loader without touching
// any parent portal logic. The adapter in game-registry.mjs routes their
// submitRun() calls through the parent shared identity system.

export async function loadChikunGame() {
  // Currently a stub — Chikun asset manifest will be generated via Pixellab
  // or migrated from the LitVM prototype by the LitVM team. The structure is
  // ready for them to populate.
  const [chikunManifest] = await Promise.all([
    import('../../assets/generated/chikun/chikun-manifest.mjs').catch(() => ({
      // Graceful stub so the cabinet still launches in preview mode until the
      // real assets are onboarded by the Chikun dev team.
      id: 'chikun',
      title: 'Chikun: The Flying Coin',
      assets: [],
      sprites: {},
      audio: {},
      version: 'stub',
    })),
  ]);

  return Object.freeze({
    manifest: chikunManifest,
    entryPoint: () => {
      // This is where Chikun's game loop would start. For now it's a stub
      // that reports the load succeeded and the parent can render a placeholder.
      console.log('[Chikun] Game loaded via Lester\'s Arcade adapter.');
      return { loaded: true, manifest: chikunManifest };
    },
    adapter: {
      // Adapter methods the parent uses to normalize the Chikun run into the
      // shared ranked-run format.
      normalizeStats(raw) {
        return {
          score: raw.score ?? 0,
          coinsCollected: raw.coinsCollected ?? 0,
          survivalTime: raw.survivalTimeSeconds ?? 0,
          achievements: raw.achievements ?? [],
        };
      },
    },
  });
}
