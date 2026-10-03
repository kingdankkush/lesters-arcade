// Screen-space warning only. Camera, input, locked attack geometry and tick
// authority remain with the existing runtime. No cosmetic random stream.
const RADIUS = 20;
const PAD = 50;
const BOLT = Object.freeze([-1,-12,-8,2,-1,2,-4,12,8,-3,1,-3,4,-12]);
const finite = Number.isFinite;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inset = v => finite(v) ? Math.max(0, v) : 0;
const outside = (p, view) => p.x < 0 || p.x > view.width || p.y < 0 || p.y > view.height;
function chargeOrigin(shape, depth = 0) {
  if (!shape || depth > 4) return null;
  if (shape.type === 'charge-lane' && finite(shape.origin?.x) && finite(shape.origin?.y)) return shape.origin;
  if (shape.type === 'union' && Array.isArray(shape.shapes)) {
    for (let i = 0; i < Math.min(16, shape.shapes.length); i++) {
      const origin = chargeOrigin(shape.shapes[i], depth + 1);
      if (origin) return origin;
    }
  }
  return null;
}

export function resolveBossEdgeWarning({ boss, hero, view, project, tick, zoom = 1, bodyHeight = 84, insets = {}, out = {} } = {}) {
  out.visible = false;
  if (!boss?.active || !finite(boss.x) || !finite(boss.y) || !finite(hero?.x) || !finite(hero?.y)
    || !finite(view?.width) || !finite(view?.height) || !finite(tick) || !finite(zoom) || zoom <= 0 || typeof project !== 'function') return out;
  if (!finite(boss.groundZ ?? 0) || !finite(hero.groundZ ?? hero.z ?? 0)) return out;
  const minX = inset(insets.left) + PAD, maxX = view.width - inset(insets.right) - PAD;
  const minY = inset(insets.top) + PAD, maxY = view.height - inset(insets.bottom) - PAD;
  if (maxX <= minX || maxY <= minY) return out;
  let target = null, locked = null;
  const pending = boss.pendingAttacks;
  if (Array.isArray(pending)) for (let i = 0; i < Math.min(32, pending.length); i++) {
    const attack = pending[i];
    if (!finite(attack?.tellStartTick) || !finite(attack.resolveTick) || tick < attack.tellStartTick || tick >= attack.resolveTick) continue;
    const origin = chargeOrigin(attack.geometry);
    if (!origin) continue;
    const screen = project({ x: origin.x, y: origin.y, z: boss.groundZ ?? 0 });
    if (!finite(screen.x) || !finite(screen.y) || !outside(screen, view)) continue;
    if (!locked || attack.resolveTick < locked.resolveTick) { locked = attack; target = screen; }
  }
  if (!target) {
    target = project({ x: boss.x, y: boss.y, z: boss.groundZ ?? 0 });
    if (!finite(target.x) || !finite(target.y)) return out;
    const halfWidth = (finite(boss.radius) && boss.radius > 0 ? boss.radius : 56) * zoom;
    const height = (finite(bodyHeight) && bodyHeight > 0 ? bodyHeight : 84) * zoom;
    if (target.x + halfWidth >= 0 && target.x - halfWidth <= view.width && target.y >= 0 && target.y - height <= view.height) return out;
  }
  const heroScreen = project({ x: hero.x, y: hero.y, z: hero.groundZ ?? hero.z ?? 0 });
  const dx = target.x - heroScreen.x, dy = target.y - heroScreen.y, length = Math.hypot(dx,dy);
  if (!finite(length) || length === 0) return out;
  const dirX = dx / length, dirY = dy / length;
  // Place the card on a safe rectangle edge, bearing from the actual hero.
  // Never move the camera to make room; short/occluded viewports suppress it.
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const scale = Math.min(dirX ? (maxX-minX)/2/Math.abs(dirX) : Infinity, dirY ? (maxY-minY)/2/Math.abs(dirY) : Infinity);
  out.x = clamp(cx + dirX * scale,minX,maxX); out.y = clamp(cy + dirY * scale,minY,maxY);
  out.directionX = dirX; out.directionY = dirY;
  out.kind = locked ? 'charge' : 'boss'; out.attackId = locked?.attackId ?? '';
  out.tellStartTick = locked?.tellStartTick ?? -1;
  out.progress = locked ? clamp((tick-locked.tellStartTick)/Math.max(1,locked.resolveTick-locked.tellStartTick),0,1) : 0;
  out.remainingSeconds = locked ? Math.max(0,(locked.resolveTick-tick)/60) : 0;
  out.visible = true;
  return out;
}

export function createBossEdgeWarning({ ContainerClass, GraphicsClass, TextClass, announce = () => {}, documentRef = null, windowRef = null, controlsRoot = null, touchEnabled = false } = {}) {
  const display = new ContainerClass(), graphics = new GraphicsClass();
  const label = new TextClass({ text: '', style: { fontFamily:'Arial, sans-serif',fontSize:10,fontWeight:'700',fill:0xffede1,stroke:{color:0x07101c,width:3} } });
  label.anchor.set(.5,0);
  display.addChild(graphics,label); display.visible = false;
  const row = { visible:false }, arrow = new Array(6), glyph = new Array(14), shoulders = new Array(8);
  let disposed = false, announced = '', lastLabel = '';
  const insets = { top:16,right:16,bottom:96,left:16 };
  let insetTick = -Infinity, width = 0, height = 0;
  const readInsets = args => {
    if (!args.boss?.active || !(args.tick < insetTick || args.tick-insetTick >= 60 || args.view.width !== width || args.view.height !== height)) return insets;
    insetTick=args.tick;width=args.view.width;height=args.view.height;
    const visual=windowRef?.visualViewport;
    insets.top=16+Math.max(0,visual?.offsetTop ?? 0);
    insets.left=16+Math.max(0,visual?.offsetLeft ?? 0);
    insets.right=16+Math.max(0,width-(visual?.width ?? width)-(visual?.offsetLeft ?? 0));
    // The objective strip owns the bottom band even on desktop.
    insets.bottom=Math.max(96,16+Math.max(0,height-(visual?.height ?? height)-(visual?.offsetTop ?? 0)));
    const hudBounds=documentRef?.getElementById('hmhHud')?.getBoundingClientRect();
    if(hudBounds?.height > 0)insets.top=Math.max(insets.top,hudBounds.bottom+8);
    if(touchEnabled && controlsRoot)for(const control of controlsRoot.querySelectorAll('[data-hmh-control]')){
      const bounds=control.getBoundingClientRect();
      if(bounds.height > 0)insets.bottom=Math.max(insets.bottom,height-bounds.top+8);
    }
    return insets;
  };
  const reset = () => { row.visible=false; display.visible=false; graphics.clear(); announced='';insetTick=-Infinity; };
  return {
    display, graphics,
    update(args) {
      if (disposed) { row.visible=false; return row; }
      resolveBossEdgeWarning({ ...args, insets:args.insets ?? readInsets(args), out:row });
      display.visible = row.visible; graphics.clear();
      if (!row.visible) { announced=''; return row; }
      const { x,y,directionX:dx,directionY:dy } = row;
      const charge = row.kind === 'charge', color = charge ? 0xffc36d : 0xf98f83;
      graphics.circle(x,y,RADIUS+4).fill({color:0x06101a,alpha:.96});
      graphics.circle(x,y,RADIUS+4).stroke({color,width:2,alpha:.9});
      if (charge && row.progress > 0) graphics.arc(x,y,RADIUS,-Math.PI/2,-Math.PI/2+Math.PI*2*row.progress).stroke({color,width:4,alpha:1});
      const tip = RADIUS + 13, base = RADIUS + 5;
      arrow[0]=x+dx*tip; arrow[1]=y+dy*tip;
      arrow[2]=x+dx*base-dy*6; arrow[3]=y+dy*base+dx*6;
      arrow[4]=x+dx*base+dy*6; arrow[5]=y+dy*base-dx*6;
      graphics.poly(arrow,true).fill({color,alpha:1});
      graphics.poly(arrow,true).stroke({color:0x06101a,width:2,alpha:1});
      if (charge) {
        for(let i=0;i<14;i+=2){glyph[i]=x+BOLT[i];glyph[i+1]=y+BOLT[i+1];}
        graphics.poly(glyph,true).fill({color:0xfff0d4,alpha:1});
      } else {
        graphics.circle(x,y-6,4).fill({color:0xffe9dc,alpha:1});
        shoulders[0]=x-8;shoulders[1]=y+8;shoulders[2]=x-6;shoulders[3]=y+1;shoulders[4]=x+6;shoulders[5]=y+1;shoulders[6]=x+8;shoulders[7]=y+8;
        graphics.poly(shoulders,true).fill({color:0xffe9dc,alpha:1});
      }
      const text = charge ? `CHARGE ${row.remainingSeconds.toFixed(1)}s` : 'BOSS';
      if(text !== lastLabel){label.text=text;lastLabel=text;}
      label.position.set(x,y+35);
      // Accessible status changes once per warning, never every clock frame.
      const key=charge ? `${row.attackId}:${row.tellStartTick}` : 'boss';
      if(key !== announced){announce(charge ? 'Boss charge approaching from offscreen.' : 'Boss is offscreen; follow the direction marker.');announced=key;}
      return row;
    },
    reset,
    dispose(){if(disposed)return;reset();disposed=true;display.destroy({children:true});},
  };
}
