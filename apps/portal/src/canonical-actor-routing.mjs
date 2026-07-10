const ACTORS_WITH_OWN_RUNTIME_KITS = Object.freeze([
  'coyote-pack-runner', 'wild-boar', 'buzzard', 'rattlesnake', 'scorpion-ambusher',
  'claim-jumper', 'scam-cult-zealot', 'rug-rat', 'sybil-drone', 'mev-reaper',
  'phishing-angler', 'slippage-skater', 'paper-hand', 'honeypot-turret',
  'liquidation-cascade-golem', 'plaza-warden', 'bridge-exploiter', 'the-obfuscator',
  'bitcoin-maximalist-riot-cop', 'dao-lobbyist', 'influencer-camera-drone',
  'nft-valet', 'stablecoin-socialite',
]);

export function canonicalActorIdForRuntimeEntity(entity = {}) {
  const hay = `${entity?.id ?? ''} ${entity?.title ?? ''} ${entity?.enemyKey ?? ''} ${entity?.class ?? ''}`.toLowerCase();
  for (const ownId of ACTORS_WITH_OWN_RUNTIME_KITS) {
    if (hay.includes(ownId)) return null;
  }
  if (hay.includes('cave-warren') || hay.includes('warren-alpha') || hay.includes('warren') || hay.includes('spear')) return 'warren-boss';
  if (hay.includes('bandit-captain') || hay.includes('salvage-mercenary') || hay.includes('ridge-raider')) return 'evil-banker';
  if (hay.includes('scam-cult') || hay.includes('zealot') || hay.includes('trench') || hay.includes('degen') || hay.includes('fud') || hay.includes('paper') || hay.includes('rug')) return 'trench-degen';
  if (hay.includes('bank')) return 'evil-banker';
  if (hay.includes('crypto') || hay.includes('bro') || hay.includes('kol')) return 'crypto-bro';
  if (hay.includes('gas') && hay.includes('beast')) return 'gas-beast';
  if (hay.includes('evil') && hay.includes('boss')) return 'evil-boss';
  return null;
}

export function manifestEnemyArtKeyForRuntimeEntity(entity = {}) {
  const canonical = canonicalActorIdForRuntimeEntity(entity);
  if (canonical === 'trench-degen') return 'trenchDegen';
  if (canonical === 'evil-banker') return 'evilBanker';
  if (canonical === 'crypto-bro') return 'cryptoBro';
  if (canonical === 'gas-beast') return 'gasBeast';
  if (canonical === 'warren-boss') return 'warrenSpearRider';
  if (canonical === 'evil-boss') return 'bitWhale';
  return null;
}
