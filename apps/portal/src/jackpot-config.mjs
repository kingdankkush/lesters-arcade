// Chikun's Escape Weekly Jackpot: the client flag (design §D.1, J14).
//
// Pure and import-free on purpose: the portal entry, the hosted views and the Chikun child all import
// it, so it must never pull anything into their initial chunks. It does NOT re-export LITVM_JACKPOT:
// esbuild keeps that frozen generated object in whatever chunk imports it, so only the lazy jackpot
// chunks and the owner page import apps/portal/src/generated/litvm-jackpot.mjs.
//
// JACKPOT_LIVE stays the literal `false` in every commit until the owner-approved flip (design §E step
// E10). tests/jackpot-ui-client.test.mjs pins the invariant
//   JACKPOT_LIVE => SETTLEMENT_LIVE && LITVM_JACKPOT.status === 'deployed'.
// While it is false no surface fetches /api/jackpot and no jackpot copy renders, except the soft-launch
// honesty lines of design §D.6. Tests switch a surface on through its loader's deps, never by editing
// this literal.
export const JACKPOT_LIVE = false;

// The games with a jackpot instance, and the public rules page (vercel.json rewrites it to
// /jackpot/chikun.html).
export const JACKPOT_GAMES = /* @__PURE__ */ Object.freeze(['chikun']);
export const JACKPOT_RULES_PATH = '/jackpot/chikun';
