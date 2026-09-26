// Per-frame scene state shared by the Chikun renderers. world.draw() writes it
// first every frame (main.mjs calls the world before the ground, obstacles and
// the character), so later draw calls in the same frame read the camera, the
// density, the scroll distance, the light rig and the region transition without
// recomputing them. Everything here is cosmetic: nothing is read back into the
// simulation, the evidence or the replay.
export function createSceneBus() {
  return {
    frame: 0,
    view: { left: 0, width: 1280, height: 720, density: 1, portrait: false },
    density: 1,
    tier: 't1',
    shakeX: 0, shakeY: 0,
    canvasWidth: 1280, canvasHeight: 720,
    tick: 0, distance: 0, reduced: false,
    region: null,          // courseRegionState() result for this frame
    rig: null,             // computeLightRig() result for this frame
    transition: null,      // see parallax.mjs transitionState()
    art: null,             // art loader
    stormInView: false,
    grounded: false,
    contactFamily: '',
  };
}

export const sceneBus = createSceneBus();

// Device-space x of a logical x on a layer scrolling at `rate` (the layer takes
// shake * max(rate, 0.2) of the screen shake).
export function deviceX(bus, x, rate = 1) {
  return (x - bus.view.left + bus.shakeX * Math.max(rate, 0.2)) * bus.density;
}
