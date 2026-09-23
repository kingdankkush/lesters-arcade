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

// Brand words are not English words, so they count anywhere inside a word
// ("LesterFan", "xLesterx"). Staff words are ordinary English and count only
// as a whole word (or its plural), so "Badminton", "Supporter" and
// "Hotsupport" stay legal while "Admin", "Support_Desk" and "The Moderator"
// do not. Words never join across a separator or a camel-case hump, so
// "Celeste Rivers" and "AliTvm" do not spell "lester" or "litvm".
const BRAND_TERMS = Object.freeze(['lester', 'lesters', 'lestersarcade', 'litvm', 'dappit']);
const STAFF_TERMS = Object.freeze(['admin', 'official', 'moderator', 'support']);

const LOOK_ALIKES = Object.freeze({ 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' });
const SEPARATORS = /[\s_.\-]+/;

const isUpper = (ch) => ch >= 'A' && ch <= 'Z';
const isLower = (ch) => ch >= 'a' && ch <= 'z';

// Lowercase, fold look-alike characters, drop everything but letters, so
// "L3st3r", "Off1cial" and "4dm1n" read as the word they imitate. A "1" is
// read both as "l" (the contract's folding) and as "i".
function foldedForms(text) {
  const lowered = String(text ?? '').toLowerCase();
  let asL = '';
  let asI = '';
  for (const ch of lowered) {
    const mapped = LOOK_ALIKES[ch] ?? ch;
    asL += mapped;
    asI += ch === '1' ? 'i' : mapped;
  }
  return [...new Set([asL, asI].map((form) => form.replace(/[^a-z]/g, '')))].filter(Boolean);
}

// Splits before a capital that starts a capitalised word: "AdminBob" → Admin,
// Bob; "LTCSupport" → LTC, Support; "LitVMTeam" → LitVM, Team. All-caps runs
// such as "LitVM" and "L3ST3R" stay whole.
function camelParts(piece) {
  const parts = [];
  let start = 0;
  for (let i = 1; i < piece.length; i += 1) {
    const prev = piece[i - 1];
    if (isUpper(piece[i]) && isLower(piece[i + 1] ?? '') && (isLower(prev) || isUpper(prev))) {
      parts.push(piece.slice(start, i));
      start = i;
    }
  }
  parts.push(piece.slice(start));
  return parts;
}

// The folded words of a name. A run of single characters is read as one word
// ("a.d.m.i.n", "L-E-S-T-E-R"), and a word's leading or trailing digits are
// read both as look-alikes and as decoration ("Admin1", "1337admin").
function words(name) {
  const pieces = String(name ?? '').split(SEPARATORS).filter(Boolean).flatMap(camelParts);
  const out = new Set();
  const add = (word) => {
    for (const variant of new Set([word, word.replace(/^[0-9]+|[0-9]+$/g, '')])) {
      for (const form of foldedForms(variant)) out.add(form);
    }
  };
  let singles = '';
  for (const piece of pieces) {
    if (piece.length === 1) { singles += piece; continue; }
    if (singles) { add(singles); singles = ''; }
    add(piece);
  }
  if (singles) add(singles);
  return [...out];
}

function impersonates(name) {
  return words(name).some((word) => STAFF_TERMS.some((term) => word === term || word === `${term}s`)
    || BRAND_TERMS.some((term) => word.includes(term)));
}

export function moderateName(cleaned) {
  const name = String(cleaned ?? '');
  // containsBlockedTerm reads "1" as "i"; the contract folds "1" to "l", so
  // both readings are checked ("Sh1t", "S1ut", "Assho1e").
  if (containsBlockedTerm(name) || containsBlockedTerm(name.replace(/1/g, 'l'))) return { ok: false, reason: 'profanity' };
  if (impersonates(name)) return { ok: false, reason: 'impersonation' };
  return { ok: true, reason: null };
}
