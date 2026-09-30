// Parent-owned achievements (gameId 'arcade'). They are not a cabinet: any
// cabinet's server-verified Ranked run can earn them, the settle server records
// the unlock under that run's cabinet (achievement_unlocks.game_id allows only
// the three games), and their ids are reserved across every game catalog so a
// wallet holds each one once (index.mjs derivation and the §6.5 history's
// shared ids). Pure ESM like the game catalogs: no DOM, clock or environment.
import { defineCatalog, verifiedBefore } from './entry.mjs';

export const ARCADE_ACHIEVEMENT_GAME_ID = 'arcade';

// Early Supporter: at least one server-verified Ranked run, in any cabinet,
// stamped before this cutoff. PLACEHOLDER: the 2.0 release commit fixes the
// real cutoff (docs/2.0/ACHIEVEMENTS-UNLOCKABLES-SITE-BLOG-PLAN.md, Early
// Supporter status). The stamp is the server's verifiedAt, never a client field.
export const EARLY_SUPPORTER_CUTOFF_ISO = '2026-10-31T00:00:00Z';
export const EARLY_SUPPORTER_ID = 'early-supporter';

const specs = [
  { id: EARLY_SUPPORTER_ID, title: 'Early Supporter', tier: 'gold', category: 'founder', description: 'Finished a server-verified Ranked run in any cabinet before the 2.0 launch cutoff.', rule: verifiedBefore(EARLY_SUPPORTER_CUTOFF_ISO) },
];

// PLACEHOLDER ART: the Cabinet Pioneer badge stands in until the Early
// Supporter badge is drawn under the 2.0 badge theme (plan track G1).
const catalog = defineCatalog(ARCADE_ACHIEVEMENT_GAME_ID, specs, () => ({
  image: '/assets/generated/achievement-badges/cabinet-pioneer.png',
  lockedImage: '/assets/generated/achievement-badges/locked-cabinet-pioneer.png',
}));
export const ARCADE_ACHIEVEMENTS = catalog.entries;
export const ARCADE_HISTORY_FIELDS = catalog.historyFields;
