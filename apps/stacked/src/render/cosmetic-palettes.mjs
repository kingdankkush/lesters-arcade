// STACKED unlockable looks (contract §7.9): piece palettes and scene grades,
// keyed by the bridge allowlist ids (stacked-bridge-protocol.mjs
// STACKED_COSMETIC_IDS). Render data only: this module loads with the lazy
// renderer, never with the STACKED entry, and nothing in the simulation,
// evidence or result tuple reads it.
//
// A palette keeps the seven pieces distinct from each other (the colour-blind
// piece marks still work on top of any palette). A scene grade is a Pixi tint
// on the backdrop and far-particle layers, so it colours every existing
// visualizer and scene; the visualizers themselves stay free.
const KINDS = Object.freeze(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);

export const STACKED_PIECE_PALETTES = Object.freeze({
  'stacked-pieces-silver': Object.freeze({ I: 0xe3edff, J: 0x8ea8d8, L: 0xc4d2ea, O: 0xf6f8ff, S: 0xa9bddc, T: 0x7d93c4, Z: 0x5f7196, garbage: 0x4a5570 }),
  'stacked-pieces-sunset': Object.freeze({ I: 0xffd166, J: 0xff6f59, L: 0xff9f43, O: 0xffe7a3, S: 0xf78fb3, T: 0xc56cf0, Z: 0xe0405a, garbage: 0x6b4a5a }),
  'stacked-pieces-seafoam': Object.freeze({ I: 0x7dffd1, J: 0x2fb886, L: 0xbaffdf, O: 0xecfff5, S: 0x39d9a6, T: 0x62c7e8, Z: 0x138f70, garbage: 0x3d5f55 }),
  'stacked-pieces-gold': Object.freeze({ I: 0xfff1a8, J: 0xc9951a, L: 0xffc53c, O: 0xffe36b, S: 0xe8b54f, T: 0xb87a2b, Z: 0x9a5e1c, garbage: 0x5f5033 }),
});

export const STACKED_SCENE_GRADES = Object.freeze({
  'stacked-scene-noir': 0xa9b8d8,
  'stacked-scene-sunset': 0xffb892,
  'stacked-scene-forge': 0x9dffbf,
});

// The palette for these settings, or null for the classic piece colours.
export const piecePaletteFor = settings => STACKED_PIECE_PALETTES[settings?.cosmetics?.pieceSkin] ?? null;

// The tint for the backdrop layers; white leaves every visualizer as authored.
export const sceneGradeFor = settings => STACKED_SCENE_GRADES[settings?.cosmetics?.scene] ?? 0xffffff;

// The seven piece colours in id order (board cell values 1-7), for effects
// that colour by a locked cell.
export const pieceColorList = palette => KINDS.map(kind => palette[kind]);
