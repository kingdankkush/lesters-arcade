import {createChikunObstacleLoopLoader,sampleChikunObstacleLoop} from './obstacle-loop.mjs';
export function createChikunObstacleLoopView(options) {
 const loader=createChikunObstacleLoopLoader(options);
 return Object.freeze({
  ready:loader.load(),
  draw(ctx,obstacle,tick,reduced,x,y,width,height) {
   if(!loader.ready||obstacle?.variant!==loader.metadata.actor||obstacle.family!=='sky')return false;
   const crop=sampleChikunObstacleLoop(loader.metadata,tick/60,loader.tier,{reducedMotion:reduced});
   ctx.drawImage(loader.image,crop.x,crop.y,crop.width,crop.height,x,y,width,height);
   return true;
  },
  dispose:()=>loader.dispose(),
 });
}
