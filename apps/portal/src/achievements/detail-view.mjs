// Presentation-only focused badge. The collection supplies already-validated facts.
// No network, earning logic, WebGL or animation loop. The only persistence is
// the local, default-off device-tilt preference below; the only sensor is the
// DeviceOrientation listener that preference opts into.
export const ACHIEVEMENT_DETAIL_TILT_LIMIT=35;
export const ACHIEVEMENT_DETAIL_GYRO_KEY='lesters-arcade:achievement-detail:gyro';
const GYRO_GAIN=.5;
// Device orientation mapped to the same bounded tilt as a drag. `neutral` is the
// first sample after enabling, so the badge rests however the phone is held.
// Non-finite angles (no sensor, a partial event) map to null and are ignored.
export function gyroTilt(sample,neutral,{gain=GYRO_GAIN,limit=ACHIEVEMENT_DETAIL_TILT_LIMIT}={}) {
  const beta=sample?.beta,gamma=sample?.gamma;
  if(![beta,gamma,neutral?.beta,neutral?.gamma].every(Number.isFinite))return null;
  const bound=value=>Math.max(-limit,Math.min(limit,value));
  return{x:bound((neutral.beta-beta)*gain),y:bound((gamma-neutral.gamma)*gain)};
}
export function createAchievementDetail({documentRef=globalThis.document,windowRef=globalThis.window}={}) {
  let disposed=false,dialog,stage,art,title,game,requirement,record,status,rarityText,hint,closeButton;
  let pointer=null,start=null,x=0,y=0,returnFocus=null,closeTouch=null;
  let gyroOn=false,gyroNeutral=null,gyroButton=null,gyroListening=false;
  const media=windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced=()=>media?.matches===true;
  const clamp=value=>Math.max(-ACHIEVEMENT_DETAIL_TILT_LIMIT,Math.min(ACHIEVEMENT_DETAIL_TILT_LIMIT,value));
  // Local preference, default off. Storage can be absent, blocked or full: every
  // access is guarded and a failure only leaves the preference off.
  const storage=()=>{try{return windowRef?.localStorage??null;}catch{return null;}};
  const readGyroPreference=()=>{try{return storage()?.getItem(ACHIEVEMENT_DETAIL_GYRO_KEY)==='1';}catch{return false;}};
  const writeGyroPreference=on=>{try{const store=storage();if(!store)return;if(on)store.setItem(ACHIEVEMENT_DETAIL_GYRO_KEY,'1');else store.removeItem(ACHIEVEMENT_DETAIL_GYRO_KEY);}catch{}};
  const orientationApi=()=>windowRef?.DeviceOrientationEvent??null;
  const gyroSupported=()=>Boolean(orientationApi())&&typeof windowRef?.addEventListener==='function';
  function onOrientation(event){
    if(!gyroOn||reduced()||pointer!==null||!dialog?.open)return;
    if(!gyroNeutral){if(Number.isFinite(event?.beta)&&Number.isFinite(event?.gamma))gyroNeutral={beta:event.beta,gamma:event.gamma};return;}
    const tilt=gyroTilt(event,gyroNeutral);if(!tilt)return;
    x=tilt.x;y=tilt.y;if(art)art.style.transition='transform 120ms linear';draw();
  }
  function listenGyro(){if(gyroListening||!gyroSupported())return;windowRef.addEventListener('deviceorientation',onOrientation);gyroListening=true;}
  function unlistenGyro(){if(!gyroListening)return;windowRef.removeEventListener?.('deviceorientation',onOrientation);gyroListening=false;}
  function setGyro(on){gyroOn=on;gyroNeutral=null;if(on)listenGyro();else unlistenGyro();paintGyro();}
  function paintGyro(){
    if(!gyroButton)return;
    gyroButton.setAttribute('aria-pressed',String(gyroOn));gyroButton.disabled=reduced();
    gyroButton.textContent=gyroOn?'Device tilt: on':'Device tilt: off';
  }
  // Only a user gesture (the button) may ask iOS for sensor access; anything but
  // an explicit grant leaves the preference off, silently.
  async function toggleGyro(){
    if(disposed||reduced())return;
    if(gyroOn){writeGyroPreference(false);setGyro(false);reset();return;}
    const api=orientationApi();
    if(typeof api?.requestPermission==='function'){
      let state='denied';try{state=await api.requestPermission();}catch{state='denied';}
      if(disposed)return;
      if(state!=='granted'){paintGyro();return;}
    }
    writeGyroPreference(true);setGyro(true);
  }
  const element=(tag,className,text)=>{
    const node=documentRef.createElement(tag);node.className=className;
    if(text!==undefined)node.textContent=text;return node;
  };
  function draw(){if(art)art.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;}
  function reset(){
    const id=pointer;pointer=null;start=null;closeTouch=null;x=0;y=0;
    if(stage&&id!==null&&stage.hasPointerCapture?.(id))stage.releasePointerCapture(id);
    if(art)art.style.transition=reduced()?'none':'transform 460ms cubic-bezier(.2,.85,.3,1.12)';draw();
  }
  function syncMotion(){
    reset();if(!hint)return;
    hint.textContent=reduced()?'Static preview · reduced motion':gyroOn?'Tilt the phone or drag · arrow keys to rotate · Home to reset':'Drag to tilt · arrow keys to rotate · Home to reset';
    stage.setAttribute('aria-label',reduced()?'Badge preview':'Badge preview. Drag or use arrow keys to rotate; Home resets.');
    paintGyro();
  }
  function returnToCaller(){if(dialog?.open)return;const restore=returnFocus;returnFocus=null;reset();if(!disposed)restore?.();}
  function onVisibility(){if(documentRef.hidden)reset();}
  function ensure(){
    if(dialog)return;
    dialog=element('dialog','achievement-detail');dialog.setAttribute('aria-labelledby','achievement-detail-title');dialog.setAttribute('aria-describedby','achievement-detail-requirement');
    const heading=element('div','achievement-detail-heading');
    game=element('p','achievement-detail-game');title=element('h2','achievement-detail-title');title.id='achievement-detail-title';
    closeButton=element('button','achievement-detail-close','Close');closeButton.type='button';
    const close=()=>{if(dialog.open)dialog.close();};closeButton.addEventListener('click',close);
    // Native touch sequences can omit their compatibility click after a drag.
    // Accept a deliberate release on this control; leave keyboard click intact.
    closeButton.addEventListener('pointerdown',event=>{
      if(event.pointerType!=='touch'||event.isPrimary===false||event.button!==0)return;
      closeTouch={id:event.pointerId,x:event.clientX,y:event.clientY};event.preventDefault();
    });
    closeButton.addEventListener('pointermove',event=>{
      if(closeTouch?.id===event.pointerId&&Math.hypot(event.clientX-closeTouch.x,event.clientY-closeTouch.y)>10)closeTouch=null;
    });
    for(const name of ['pointercancel','lostpointercapture'])closeButton.addEventListener(name,event=>{if(closeTouch?.id===event.pointerId)closeTouch=null;});
    closeButton.addEventListener('pointerup',event=>{
      if(!closeTouch||event.pointerId!==closeTouch.id)return;
      const start=closeTouch;closeTouch=null;const rect=closeButton.getBoundingClientRect();
      if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<=10&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom){event.preventDefault();close();}
    });
    heading.append(game,title,closeButton);
    stage=element('div','achievement-detail-stage');stage.tabIndex=0;stage.setAttribute('role','group');
    art=element('div','achievement-detail-art');stage.append(art);
    hint=element('p','achievement-detail-hint');requirement=element('p','achievement-detail-requirement');requirement.id='achievement-detail-requirement';record=element('p','achievement-detail-record');
    status=element('p','achievement-detail-status');rarityText=element('p','achievement-detail-rarity');
    const body=element('div','achievement-detail-body'),visual=element('div','achievement-detail-visual'),facts=element('div','achievement-detail-facts');
    visual.append(stage,hint);
    // Device tilt is offered only where the sensor API exists; elsewhere the
    // control is absent and the drag/keyboard tilt is the whole feature.
    if(gyroSupported()){
      gyroButton=element('button','achievement-detail-gyro');gyroButton.type='button';gyroButton.setAttribute('aria-pressed','false');
      gyroButton.addEventListener('click',()=>{void toggleGyro();});visual.append(gyroButton);
      gyroOn=readGyroPreference();if(gyroOn)listenGyro();
    }
    facts.append(status,element('h3','achievement-detail-label','Requirement'),requirement,record,element('h3','achievement-detail-label','Ranked rarity'),rarityText);
    body.append(visual,facts);dialog.append(heading,body);documentRef.body.append(dialog);
    stage.addEventListener('pointerdown',event=>{
      if(reduced()||pointer!==null||event.isPrimary===false||event.button!==0)return;
      pointer=event.pointerId;start={x:event.clientX,y:event.clientY,rx:x,ry:y};
      art.style.transition='none';stage.setPointerCapture?.(pointer);
    });
    stage.addEventListener('pointermove',event=>{
      if(pointer===null||event.pointerId!==pointer||!start||reduced())return;
      x=clamp(start.rx-(event.clientY-start.y)*.25);y=clamp(start.ry+(event.clientX-start.x)*.25);draw();
    });
    for(const name of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(name,event=>{if(event.pointerId===pointer)reset();});
    stage.addEventListener('keydown',event=>{
      if(reduced()||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home'].includes(event.key))return;
      event.preventDefault();resetPointer();
      if(event.key==='Home')reset();
      else{x=clamp(x+(event.key==='ArrowUp'?5:event.key==='ArrowDown'?-5:0));y=clamp(y+(event.key==='ArrowRight'?5:event.key==='ArrowLeft'?-5:0));draw();}
    });
    dialog.addEventListener('close',returnToCaller);
    media?.addEventListener?.('change',syncMotion);windowRef?.addEventListener?.('blur',reset);documentRef.addEventListener?.('visibilitychange',onVisibility);
    syncMotion();
  }
  function resetPointer(){
    const id=pointer;pointer=null;start=null;
    if(id!==null&&stage.hasPointerCapture?.(id))stage.releasePointerCapture(id);
  }
  function open(row,{returnFocus:restore=null}={}){
    if(disposed)throw new Error('achievement detail disposed');ensure();reset();returnFocus=restore;
    title.textContent=row.title;game.textContent=`${row.gameTitle} · ${row.tier}`;requirement.textContent=row.description;
    const rarity=!row.rarity?'Rarity unavailable':row.rarity.percentage===null?`Early · ${row.rarity.unlockedPlayers} players`:`${row.rarity.label} · ${row.rarity.percentage<.1&&row.rarity.percentage>0?'less than 0.1':Number(row.rarity.percentage.toFixed(1))}% of this cabinet’s Ranked players`;
    status.textContent=row.unlocked?'Earned':'To earn';
    record.textContent=row.unlocked?(row.unlockedAt?`Earned ${row.unlockedAt.slice(0,10)}`:'Recorded in verified Ranked play.'):'Complete the requirement in a verified Ranked run.';
    rarityText.textContent=rarity;
    const image=element('img','achievement-detail-image');image.src=row.image;image.alt=row.title;image.draggable=false;image.width=256;image.height=256;
    if(typeof art.replaceChildren==='function')art.replaceChildren(image);else{art.textContent='';art.append(image);}
    dialog.setAttribute('data-tier',row.tier);dialog.setAttribute('data-earned',String(row.unlocked));
    if(!dialog.open)dialog.showModal();closeButton.focus({preventScroll:true});
  }
  function dispose(){
    if(disposed)return;disposed=true;returnFocus=null;reset();unlistenGyro();
    if(dialog){media?.removeEventListener?.('change',syncMotion);windowRef?.removeEventListener?.('blur',reset);documentRef.removeEventListener?.('visibilitychange',onVisibility);if(dialog.open)dialog.close();dialog.remove();}
  }
  return Object.freeze({open,dispose});
}
