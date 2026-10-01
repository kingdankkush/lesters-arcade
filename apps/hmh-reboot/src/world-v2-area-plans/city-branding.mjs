// Litecoin City sign slots -> brand names (brief 02: "a single slot-to-brand
// data file drives signs; official logos need verified primary sources,
// otherwise use names"). Names only: no logos, marks, rankings, follower
// counts, endorsements or partnership claims are encoded here.
//
// Each slot names its carrier: a free-standing kit card the City plan places
// with the deterministic id `litecoin-city-sign-<slot>` (gantry, shelter,
// kiosk, stall or rooftop tower), or an authored solid (`pieceId`) whose
// facade carries the sign. The area-art schema has no text primitive yet, so
// the carriers stand in the world now and the lettering is a renderer hook:
// a later renderer change resolves `signForProp(prop.id)` and draws `text`
// as a flat neutral panel on the carrier. Positions are relative to the City
// centre; every one passes the plan's placement guard (test-enforced).
import { freezeDeep } from '../value-guards.mjs';

export const CITY_BRANDING_SCHEMA = 'hmh-city-branding/v1';
export const CITY_SIGN_PREFIX = 'litecoin-city-sign-';
// Sign panels stay off the cue palette: chalk lettering on slate.
export const CITY_SIGN_STYLE = freezeDeep({ render: 'text-only', logos: false, panel: 0x4e5e62, text: 0xd8d5c6, font: 'condensed sans, uppercase' });

export const CITY_BRAND_SLOTS = freezeDeep([
  { slot: 'exchange-frontage', brand: 'Litecoin', carrier: 'facade', pieceId: 'litecoin-city-exchange' },
  { slot: 'market-corner', brand: "Lester's Arcade", carrier: 'facade', pieceId: 'litecoin-city-market-block' },
  { slot: 'tower-1', brand: 'LiteForge', carrier: 'tower', source: 'b1-12', x: 470, y: -1440, height: 600 },
  { slot: 'tower-2', brand: 'LitVM', carrier: 'tower', source: 'b1-52', x: 720, y: -1380, height: 540 },
  { slot: 'tower-3', brand: 'Grayscale', carrier: 'tower', source: 'b1-56', x: 980, y: -1450, height: 660 },
  { slot: 'tower-4', brand: 'Canary Capital', carrier: 'tower', source: 'b1-12', x: 1230, y: -1390, height: 620 },
  { slot: 'tower-5', brand: 'Lite Strategy', carrier: 'tower', source: 'b1-52', x: 1480, y: -1440, height: 560 },
  { slot: 'tower-6', brand: 'Luxxfolio', carrier: 'tower', source: 'b1-56', x: 1730, y: -1400, height: 600 },
  { slot: 'high-street-gantry', brand: 'WheelX', carrier: 'gantry', source: 'b2-51', x: -620, y: -210, height: 280 },
  { slot: 'river-street-gantry', brand: 'MidasPredict', carrier: 'gantry', source: 'b2-51', x: 210, y: -420, height: 280 },
  { slot: 'high-street-shelter', brand: 'OnChainGM', carrier: 'shelter', source: 'b2-53', x: -460, y: 170, height: 110 },
  { slot: 'junction-shelter', brand: 'Arkada', carrier: 'shelter', source: 'b2-53', x: 560, y: -180, height: 110 },
  { slot: 'river-street-shelter', brand: 'OmniHub', carrier: 'shelter', source: 'b2-53', x: -170, y: 560, height: 110 },
  { slot: 'plaza-stall-row', brand: 'Lester Labs', carrier: 'stall', source: 'b1-13', x: -260, y: 260, height: 120 },
  { slot: 'plaza-kiosk-1', brand: 'LitVMSwap', carrier: 'kiosk', source: 'b1-20', x: 400, y: 1200, height: 90 }, // off the Liquidator's exchange floor (its collider would block the floor)
  { slot: 'plaza-kiosk-2', brand: 'Dappit', carrier: 'kiosk', source: 'b1-20', x: 560, y: 1460, height: 90 },
  { slot: 'plaza-kiosk-3', brand: 'Lit Clinic', carrier: 'kiosk', source: 'b1-20', x: 1460, y: 1500, height: 90 },
  { slot: 'plaza-kiosk-4', brand: 'Litescribe', carrier: 'kiosk', source: 'b1-20', x: 1500, y: 700, height: 90 },
  { slot: 'plaza-kiosk-5', brand: 'Drunken Cats', carrier: 'kiosk', source: 'b1-20', x: 300, y: 1300, height: 90 },
]);

export const CITY_BRANDS = Object.freeze(CITY_BRAND_SLOTS.map(slot => slot.brand));

const bySignId = new Map(CITY_BRAND_SLOTS.filter(slot => !slot.pieceId).map(slot => [`${CITY_SIGN_PREFIX}${slot.slot}`, slot]));
const byPiece = new Map(CITY_BRAND_SLOTS.filter(slot => slot.pieceId).map(slot => [slot.pieceId, slot]));
// Renderer hook: the sign text for a placed carrier prop or a decorated solid, or null.
export const signForProp = propId => { const slot = bySignId.get(propId); return slot ? freezeDeep({ slot: slot.slot, text: slot.brand, style: CITY_SIGN_STYLE }) : null; };
export const signForPiece = pieceId => { const slot = byPiece.get(pieceId); return slot ? freezeDeep({ slot: slot.slot, text: slot.brand, style: CITY_SIGN_STYLE }) : null; };
