const validPads = pads => Array.from(pads ?? []).filter((pad,index) => pad?.index === index && pad.connected === true && pad.mapping === 'standard' && typeof pad.id === 'string' && pad.id.length > 0 && pad.buttons?.length >= 16 && pad.axes?.length >= 2 && Array.from(pad.axes).every(Number.isFinite));
export const recommendedLocalControls = pads => validPads(pads).length >= 2 ? 'two-pads' : 'keyboard-pad';
export function localDevices(choice, pads) {
  const available = validPads(pads);
  let claims;
  if (choice === 'split-keyboard') claims = [{kind:'keyboard-left'},{kind:'keyboard-right'}];
  else if (choice === 'keyboard-pad' && available.length >= 1) claims = [{kind:'keyboard'},{kind:'gamepad',index:available[0].index}];
  else if (choice === 'two-pads' && available.length >= 2) claims = available.slice(0,2).map(pad => ({kind:'gamepad',index:pad.index}));
  else throw new TypeError('Connect the required standard controller(s), then press any controller button.');
  return Object.freeze(claims.map(Object.freeze));
}

// DOM HUD labels retain CSS-pixel size while only the canonical wells scale.
// 768px landscape is the minimum; narrower layouts pause both players.
export function localBoardLayout(width,height) {
  if (![width,height].every(value=>Number.isFinite(value)&&value>0)) throw new TypeError('positive finite viewport required');
  if (width < 768 || width < height || height < 220) return Object.freeze({playable:false,slots:Object.freeze([])});
  const column=width/2,scale=Math.min((column-160)/320,(height-8)/640,1.2),wellWidth=320*scale;
  return Object.freeze({playable:true,slots:Object.freeze([0,1].map(i=>Object.freeze({frame:'wide',x:i*column+(column-wellWidth)/2-96*scale-8,y:(height-640*scale)/2,scale,visible:true})))});
}
