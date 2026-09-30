import {createTutorial} from './tutorial-model.mjs';
// The cabinet stays paused underneath this self-contained practice diagram.
export function mountTutorial({overlay,onExit}){
 const doc=overlay.ownerDocument,model=createTutorial(),previous=[...overlay.children].map(node=>[node,node.hidden]);
 const labels=['aria-labelledby','aria-describedby'].map(key=>[key,overlay.getAttribute(key)]);
 const node=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
 const panel=node('div','panel tutorial-panel'),progress=node('p','eyebrow'),title=node('h2'),copy=node('p'),hint=node('p','tutorial-hint');
 title.id='tutorialTitle';copy.id='tutorialCopy';overlay.setAttribute('aria-labelledby',title.id);overlay.setAttribute('aria-describedby',copy.id);
 const scene=node('div','tutorial-scene'),board=node('div','tutorial-board'),aside=node('div','tutorial-aside'),hold=node('p'),feedback=node('p','tutorial-feedback');
 board.setAttribute('role','img');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const squares=Array.from({length:80},()=>{const e=node('span','tutorial-cell');e.setAttribute('aria-hidden','true');board.append(e);return e;});
 aside.append(node('span','eyebrow','HOLD'),hold,node('p','fine-print','Practice only. Your game stays paused.'));scene.append(board,aside);
 const controls=node('div','tutorial-controls'),actions=[['left','← Move'],['right','Move →'],['rotate','↻ Rotate'],['hold','Hold'],['drop','Drop ⇓']];
 const buttons=actions.map(([action,label])=>{const b=node('button','',label);b.type='button';b.dataset.lessonAction=action;b.addEventListener('click',()=>act(action));controls.append(b);return b;});
 const next=node('button','primary','Next'),skip=node('button','','Skip tutorial'),footer=node('div','result-actions');next.type=skip.type='button';footer.append(next,skip);
 panel.append(progress,title,copy,scene,hint,controls,feedback,footer);previous.forEach(([e])=>e.hidden=true);overlay.append(panel);
 let disposed=false;
 function paint(focus=false){
  const s=model.snapshot(),complete=s.step==='complete';progress.textContent=complete?'TRAINING COMPLETE':`QUICK START · ${s.index+1} / 5`;
  title.textContent=s.title;copy.textContent=s.copy;hint.textContent=s.hint;hold.textContent=s.hold??'Empty';
  squares.forEach((e,i)=>{const active=s.cells.some(([x,y])=>y*10+x===i),ghost=s.ghost.some(([x,y])=>y*10+x===i);e.className='tutorial-cell'+(s.board[i]?' is-stack':'')+(ghost&&!active?' is-guide':'')+(active?' is-piece':'');e.textContent=active?'•':'';});
  board.setAttribute('aria-label',s.cleared?'Halving: four complete rows cleared.':`${s.piece} piece on a ten-column practice board. ${s.step==='halving'?'Four rows have a one-column gap.':'Outlined squares show its landing.'}`);
  board.hidden=complete;aside.hidden=complete;controls.hidden=complete;
  const accepted=s.step==='move'?['left','right']:s.step==='halving'?['drop']:[s.step];
  buttons.forEach(b=>b.hidden=!accepted.includes(b.dataset.lessonAction));
  feedback.textContent=s.cleared?'4 lines cleared · HALVING':s.ready?'Got it. Continue when you’re ready.':'';
  next.disabled=!complete&&!s.ready;next.textContent=complete?'Back to game':'Next';skip.textContent=complete?'Practice again':'Skip tutorial';
  if(focus)(complete?next:buttons.find(b=>!b.hidden))?.focus({preventScroll:true});
 }
 function act(action){if(disposed)return;model.act(action);paint();}
 function destroy(){if(disposed)return;disposed=true;overlay.removeEventListener('keydown',keydown,true);panel.remove();previous.forEach(([e,hidden])=>e.hidden=hidden);for(const[key,value]of labels)if(value===null)overlay.removeAttribute(key);else overlay.setAttribute(key,value);}
 function finish(completed){destroy();onExit(completed);}
 function keydown(event){
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(false);return;}
  const action={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',KeyX:'rotate',KeyC:'hold',Space:'drop'}[event.code];
  // Enter/Space on a focused button retain their standard activation.
  if(!action||(event.code==='Space'&&event.target?.tagName==='BUTTON'))return;
  event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)act(action);
 }
 next.addEventListener('click',()=>{if(model.snapshot().step==='complete')finish(true);else if(model.next())paint(true);});
 skip.addEventListener('click',()=>{if(model.snapshot().step==='complete'){model.reset();paint(true);}else finish(false);});
 overlay.addEventListener('keydown',keydown,true);paint(true);
 return{destroy};
}
