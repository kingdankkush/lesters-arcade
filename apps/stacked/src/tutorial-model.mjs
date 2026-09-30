// An interactive diagram, never a scored game or a source of run evidence.
const LESSONS=[
 ['move','Find your space','Move the piece left or right. Leave room for the pieces coming next.','← / → or the buttons below'],
 ['rotate','Turn it to fit','Rotate the T piece. You can turn pieces in either direction during a game.','Rotate button or ↑ / X'],
 ['hold','Save a piece for later','Hold this T to bring in the next piece. In a game, you can hold once per placed piece.','Hold button or C'],
 ['drop','Trust the landing guide','The outline shows where your piece will land. Hard drop places it instantly.','Drop button or Space'],
 ['halving','Four rows. One Halving.','This well is ready for a long piece. Drop it to clear all four rows together.','Drop button or Space'],
 ['complete','Ready to STACK','Fill rows, keep space at the top, and watch for your next Halving.','Your game is waiting.']
];
export function createTutorial(){
 let index,x,rotation,held,dropped,ready,cleared;
 const reset=()=>{index=0;x=3;rotation=0;held=null;dropped=false;ready=false;cleared=0;};reset();
 function cells(y){
  if(index===5||(index===4&&cleared))return[];
  const shape=index===4?[[0,0],[0,1],[0,2],[0,3]]:index>=3||held?[[0,0],[1,0],[2,0],[3,0]]:rotation%2?[[0,0],[0,1],[1,1],[0,2]]:[[1,0],[0,1],[1,1],[2,1]];
  return shape.map(([a,b])=>[a+(index===4?4:x),b+y]);
 }
 const landing=()=>index===4?4:index>=3||held?7:rotation%2?5:6;
 function snapshot(){
  const [step,title,copy,hint]=LESSONS[index],board=Array(80).fill(0);
  if(index===4&&!cleared)for(let y=4;y<8;y++)for(let a=0;a<10;a++)if(a!==4)board[y*10+a]=1;
  return{step,title,copy,hint,index,ready,cleared,hold:held,piece:index>=3||held?'I':'T',board,cells:cells(dropped?landing():1),ghost:cells(landing())};
 }
 function act(action){
  if(index===0&&(action==='left'||action==='right')){const next=Math.max(0,Math.min(7,x+(action==='left'?-1:1)));ready ||= next!==x;x=next;}
  else if(index===1&&action==='rotate'){rotation=(rotation+1)%2;ready=true;}
  else if(index===2&&action==='hold'&&!held){held='T';ready=true;}
  else if((index===3||index===4)&&action==='drop'){dropped=true;ready=true;if(index===4)cleared=4;}
 }
 return{snapshot,act,reset,next(){if(!ready||index===5)return false;index++;x=3;rotation=0;dropped=false;ready=false;return true;}};
}
