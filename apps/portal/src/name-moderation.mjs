// Display-name moderation shared by the browser and the server (contract
// §7.8, A29). Anyone can call PlayerProfileRegistry.setProfile directly, so
// the server runs this on every mirrored name; the browser runs it first as a
// courtesy before the wallet prompt.
//
// Pure: no DOM, no clocks, no I/O. The only import is username-registry.mjs
// containsBlockedTerm (profanity and slurs, with its own leetspeak folding).

import { containsBlockedTerm } from './username-registry.mjs';

// Names that could pass as the arcade, its staff or its chain.
export const IMPERSONATION_TERMS = Object.freeze([
  'lester', 'lesters', 'lestersarcade', 'admin', 'official', 'moderator', 'support', 'litvm', 'dappit',
]);

const LOOK_ALIKES = Object.freeze({ 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' });

// Lowercase, fold look-alike characters, drop everything but letters, so
// "L3st3r", "Off1cial" and "a.d.m.i.n" all read as the word they imitate.
// A "1" is read both as "l" (the contract's folding) and as "i".
function foldedForms(name) {
  const lowered = String(name ?? '').toLowerCase();
  let asL = '';
  let asI = '';
  for (const ch of lowered) {
    const mapped = LOOK_ALIKES[ch] ?? ch;
    asL += mapped;
    asI += ch === '1' ? 'i' : mapped;
  }
  return [...new Set([asL, asI].map((form) => form.replace(/[^a-z]/g, '')))];
}

export function moderateName(cleaned) {
  const name = String(cleaned ?? '');
  if (containsBlockedTerm(name)) return { ok: false, reason: 'profanity' };
  const forms = foldedForms(name);
  if (forms.some((form) => IMPERSONATION_TERMS.some((term) => form.includes(term)))) return { ok: false, reason: 'impersonation' };
  return { ok: true, reason: null };
}
