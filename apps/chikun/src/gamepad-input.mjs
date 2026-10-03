// Standard controller -> the same flap/glide actions keyboard and touch use.
// This adapter owns edge latches only; no simulation, course or clock access.
export function createChikunGamepadInput() {
  let ownerIndex = -1, ownerId = null, jumpHeld = false, pauseHeld = false;
  const frame = { connected:false, flap:false, glide:false, pause:false };
  const pressed = (pad, index) => pad.buttons?.[index]?.pressed === true || pad.buttons?.[index]?.value > .5;
  function reset() { ownerIndex = -1; ownerId = null; jumpHeld = false; pauseHeld = false; }
  return {
    reset,
    sample(pads, { enabled = true } = {}) {
      frame.connected = false; frame.flap = false; frame.glide = false; frame.pause = false;
      let pad = null;
      for (let i = 0; i < (pads?.length ?? 0); i++) {
        if (pads[i]?.connected === true && pads[i].mapping === 'standard') { pad = pads[i]; break; }
      }
      if (!pad) { reset(); return frame; }
      frame.connected = true;
      if (!enabled) { reset(); return frame; }
      const jump = pressed(pad,0) || pressed(pad,7) || pressed(pad,12), pause = pressed(pad,9);
      if (ownerIndex === pad.index && ownerId === pad.id) {
        frame.flap = jump && !jumpHeld;
        frame.pause = pause && !pauseHeld;
        frame.glide = jump;
      }
      ownerIndex = pad.index; ownerId = pad.id; jumpHeld = jump; pauseHeld = pause;
      return frame;
    },
  };
}
