// Presentation only: consumes committed snapshots; never feeds the simulation.
import { locateCommittedLock } from './lock-projection.mjs';
import { pieceColorList, piecePaletteFor } from './cosmetic-palettes.mjs';
export const mobilePresentation = ({ width = 1440, coarsePointer = false } = {}) => coarsePointer || width <= 600;
const COLORS = { I:0x32d9ff,J:0x5688ff,L:0xffa447,O:0xffd84d,S:0x60e889,T:0xb66cff,Z:0xff6078 };
const intensityFor = settings => settings.accessibility.reduceMotion ? 0 : Math.max(0, Math.min(1, settings.video.effectsIntensity ?? .7));

export function createGameplayParticles({ geometry, mobile = false }) {
  const capacity = mobile ? 256 : 384;
  const fields = Object.fromEntries(['x','y','vx','vy','born','life','size','spin'].map(key => [key,new Float32Array(capacity)]));
  const color = new Uint32Array(capacity), alive = new Uint8Array(capacity);
  const state = { ...fields, color, alive, capacity, count:0, emitted:0, lastEvent:'', clearTier:0, rows:new Int8Array(4).fill(-1), clearAt:-10000, combo:0, glows:Array.from({length:4},()=>({active:false,born:-10000,cells:[],color:0xffffff,serial:0})) };
  let glowCursor=0,glowSerial=0;
  let cursor=0, lastTick=-1, lastMove=-1000, lastDrop=-1000;
  const reset = () => { for(const g of state.glows)g.active=false; alive.fill(0); state.count=0; state.clearTier=0; state.rows.fill(-1); state.lastEvent=''; lastTick=-1; lastMove=lastDrop=-1000; };
  const emit = (x,y,vx,vy,life,size,tint,now,spin=0) => {
    const i=cursor; cursor=(cursor+1)%capacity;
    if(!alive[i]) state.count++;
    alive[i]=1; fields.x[i]=x; fields.y[i]=y; fields.vx[i]=vx; fields.vy[i]=vy;
    fields.born[i]=now; fields.life[i]=life; fields.size[i]=size; color[i]=tint; fields.spin[i]=spin; state.emitted++;
  };
  const burst = (cells, count, speed, tint, now, style, strength) => {
    if(!cells.length) return;
    for(let n=0;n<count;n++) {
      const [x,y]=cells[n%cells.length], angle=n*2.3999632297+state.emitted*.13;
      const radius=style==='rotate'?18:7, s=speed*(.55+(n%5)*.12);
      const dx=style==='left'?s:style==='right'?-s:Math.cos(angle)*s;
      const dy=style==='drop'?-s:style==='lock'?-Math.abs(Math.sin(angle)*s):Math.sin(angle)*s;
      emit(x*32+16+Math.cos(angle)*radius,(19-y)*32+16+Math.sin(angle)*radius,dx,dy,
        style==='lock'?460:style==='rotate'?360:240, (style==='lock'?2.8:1.8)*(.75+strength*.25),tint,now,angle);
    }
  };
  const landing = before => {
    const p=before.active;
    if(!p) return [];
    let y=p.y;
    while(y>-4&&!geometry.collides(before.board,geometry.cellsFor(p.kind,p.rotation,p.x,y-1))) y--;
    return geometry.cellsFor(p.kind,p.rotation,p.x,y);
  };
  const visible = cells => cells.filter(([x,y])=>x>=0&&x<10&&y>=0&&y<20);
  const step = (before, after, now, settings) => {
    if(after.tick<before.tick||after.piecesLocked<before.piecesLocked||after.lines<before.lines) { reset(); return; }
    if(after.tick<=lastTick) return;
    lastTick=after.tick;
    const strength=intensityFor(settings);
    if(!strength) { reset(); lastTick=after.tick; return; }
    const minimal=settings.video.reducedEffects, scale=(minimal?.3:1)*(.5+strength*.5);
    const a=before.active,b=after.active, locked=after.piecesLocked>before.piecesLocked;
    // Unlockable piece skin (contract §7.9): sparks match the skinned pieces.
    const palette=piecePaletteFor(settings)??COLORS, paletteList=palette===COLORS?Object.values(COLORS):pieceColorList(palette);
    const tint=palette[a?.kind]??0xa9f5ff;
    if(locked) {
      const placement=locateCommittedLock(before,after,geometry);
      const cells=visible(placement?.cells??landing(before));
      state.lastEvent='lock';
      Object.assign(state.glows[glowCursor],{active:true,born:now,cells:cells.map(c=>[...c]),color:tint,serial:++glowSerial});glowCursor=(glowCursor+1)%state.glows.length;
      burst(cells,Math.ceil(12*scale),105,tint,now,'lock',strength);
      if(after.hardDropCells>before.hardDropCells && a) {
        const top=(19-a.y)*32+16, bottom=cells.length?(19-cells[0][1])*32+16:top;
        for(let i=0;i<Math.ceil(10*scale);i++) emit(a.x*32+16+(i%2)*24,top+(bottom-top)*(i/10),0,-65,200,1.8,tint,now);
      }
      const tier=Math.min(4,Math.max(0,after.lines-before.lines));
      if(tier) {
        state.clearTier=tier; state.clearAt=now; state.combo=Math.min(8,Math.max(0,(after.comboCount??0)-1)); state.rows.fill(-1);
        // Identify the cleared bands from the pre-lock stack and projected landing.
        // No new board or delayed simulation is retained for the animation.
        const candidates=[];
        for(let y=0;y<20;y++) {
          let occupied=0,completed=0;
          for(let x=0;x<10;x++) { const set=!!before.board[y*10+x]; occupied+=Number(set); completed+=Number(set||cells.some(([cx,cy])=>cx===x&&cy===y)); }
          if(occupied>=6) candidates.push({y,rank:completed*10+occupied});
        }
        candidates.sort((a,b)=>b.rank-a.rank||a.y-b.y);
        const rows=placement?.rows??candidates.slice(0,tier).map(row=>row.y).sort((a,b)=>a-b);
        for(let i=0;i<tier;i++) state.rows[i]=rows[i]??Math.min(19,i);
        state.lastEvent=['','single','double','triple','halving'][tier];
        const count=Math.ceil(([0,48,96,160,224][tier]+state.combo*6)*scale);
        for(let i=0;i<count;i++) {
          const row=state.rows[i%tier], x=((i*.61803398875)%1)*316+2;
          const speed=45+tier*28+(i%7)*9, sign=x<160?-1:1;
          emit(x,(19-row)*32+16,sign*speed,-35-Math.sin(i*2.4)*speed*.55,520+tier*95+(i%4)*35,
            1.8+tier*.35,i%7===0?0xe8fcff:paletteList[Math.max(0,(before.board[row*10+Math.min(9,Math.floor(x/32))]||((i%7)+1))-1)]??tint,now,i*1.3);
        }
      }
    } else if(a&&b&&before.piecesSpawned===after.piecesSpawned&&before.holdsUsed===after.holdsUsed) {
      const cells=visible(geometry.cellsFor(b.kind,b.rotation,b.x,b.y));
      if(a.rotation!==b.rotation) { state.lastEvent='rotate'; burst(cells,Math.ceil(12*scale),90,tint,now,'rotate',strength); }
      if(a.x!==b.x&&now-lastMove>=32) { state.lastEvent='move'; lastMove=now; burst(cells,Math.ceil(4*scale),75,tint,now,b.x<a.x?'left':'right',strength); }
      if(a.y>b.y&&now-lastDrop>=50) { state.lastEvent='drop'; lastDrop=now; burst(cells,Math.ceil(4*scale),65,tint,now,'drop',strength); }
    }
  };
  const update = (now, settings) => {
    if(!intensityFor(settings)) { reset(); return state; }
    for(let i=0;i<capacity;i++) if(alive[i]&&now-fields.born[i]>=fields.life[i]) { alive[i]=0; state.count--; }
    for(const g of state.glows)if(now-g.born>=1000)g.active=false;
    if(now-state.clearAt>950) state.clearTier=0;
    return state;
  };
  return { state,step,update,reset };
}

export function createBoardParticles({ board, Graphics, geometry, mobile }) {
  const particles=createGameplayParticles({geometry,mobile});
  const shard=new Graphics().rect(-1,-.55,2,1.1).fill(0xffffff);
  const context=shard.context;
  const visuals=Array.from({length:particles.state.capacity},(_,i)=>i?shard.clone():shard);
  const bands=Array.from({length:4},()=>new Graphics().rect(0,0,1,1).fill(0xffffff));
  const glows=particles.state.glows.map(()=>new Graphics());
  for(const node of [...visuals,...bands,...glows]) { node.visible=false; board.layers.effectLayer.addChild(node); }
  return {
    ...particles,
    draw(now,settings) {
      const s=particles.update(now,settings), offset=board.frame==='wide'?96:0;
      for(let i=0;i<s.capacity;i++) {
        const node=visuals[i]; node.visible=!!s.alive[i]; if(!node.visible) continue;
        const age=Math.max(0,now-s.born[i]), t=age/1000, fade=1-age/s.life[i];
        const x=s.x[i]+s.vx[i]*t,y=s.y[i]+s.vy[i]*t+90*t*t;
        node.visible=x>1&&x<319&&y>1&&y<639;
        node.position.set(offset+x,y); node.rotation=s.spin[i]+t*3;
        node.scale.set(s.size[i]*(1+fade),s.size[i]*.7);
        node.tint=s.color[i]; node.alpha=fade*fade*.85*intensityFor(settings);
      }
      for(let i=0;i<glows.length;i++) {
        const node=glows[i],g=s.glows[i];node.visible=g.active;if(!g.active)continue;
        if(node.__serial!==g.serial) {
          node.clear();
          for(const [x,y] of g.cells) {
            const px=x*32,py=(19-y)*32;
            const edges=[[-1,0,px,py,px,py+32],[1,0,px+32,py,px+32,py+32],[0,1,px,py,px+32,py],[0,-1,px,py+32,px+32,py+32]];
            for(const [dx,dy,ax,ay,bx,by]of edges)if(!g.cells.some(([cx,cy])=>cx===x+dx&&cy===y+dy)) {
              node.moveTo(ax,ay).lineTo(bx,by).stroke({color:g.color,width:9,alpha:.18});
              node.moveTo(ax,ay).lineTo(bx,by).stroke({color:g.color,width:3,alpha:.9});
            }
          }
          node.__serial=g.serial;
        }
        node.position.set(offset,0);node.alpha=Math.max(0,1-(now-g.born)/1000)*intensityFor(settings);
      }
      const age=(now-s.clearAt)/1000;
      for(let i=0;i<4;i++) {
        const band=bands[i]; band.visible=i<s.clearTier&&age>=0&&age<.5&&!settings.accessibility.reduceMotion;
        if(!band.visible) continue;
        const width=320*Math.min(1,.2+age*3.5);
        band.position.set(offset+(320-width)/2,(19-s.rows[i])*32+16);
        band.scale.set(width,settings.accessibility.reduceFlash?1:2);
        band.alpha=(1-age/.5)*(settings.accessibility.reduceFlash?.16:.28)*intensityFor(settings);
        band.tint=0xb8f5ff;
      }
      return s;
    },
    destroy() { for(const node of [...visuals,...bands,...glows]) node.destroy(); context.destroy(); particles.reset(); },
  };
}
