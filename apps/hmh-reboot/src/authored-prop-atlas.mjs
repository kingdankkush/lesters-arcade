// Compatibility exports for asset tooling and existing consumers. The game
// loads the display module at its authored-asset readiness boundary.
export * from './authored-prop-layout.mjs';
export { createAuthoredHeldWeaponDisplay, createAuthoredPropDisplay } from './authored-prop-display.mjs';
