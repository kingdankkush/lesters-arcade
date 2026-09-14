export function createBoardFeedback({ board, Graphics, Text }) {
  const rail = new Graphics().rect(-4,-4,328,648).stroke({color:0xffffff,width:2});
  const impact = new Graphics().rect(0,0,320,3).fill(0xffffff);
  const caption = new Text({text:'',style:{fill:'#c9fbff',fontFamily:'system-ui, sans-serif',fontSize:14,fontWeight:'800',wordWrap:true,wordWrapWidth:86,lineHeight:21}});
  board.root.addChild(rail, impact, caption);
  return {
    draw(feedback, color, settings) {
      const wide=board.frame==='wide', x=wide?96:0;
      const minimal=settings.accessibility.reduceMotion||settings.video.reducedEffects;
      const intensity=settings.video.effectsIntensity??.7;
      rail.position.set(x,0); rail.tint=feedback.danger>.1?0xffab8c:color;
      rail.alpha=feedback.danger*.6+(minimal?0:feedback.clear*.55*intensity);
      impact.position.set(x,642); impact.tint=color; impact.alpha=minimal?0:feedback.impact*.7*intensity;
      const visible=feedback.label && feedback.labelAge<2.2;
      caption.text=visible ? feedback.label+(feedback.detail?(wide?'\n':' · ')+feedback.detail:'') : feedback.danger>.1?(wide?'DANGER\nCLEAR SPACE':'DANGER · CLEAR SPACE'):'';
      caption.alpha=visible&&!minimal?Math.min(1,(2.2-feedback.labelAge)*3):1;
      caption.position.set(wide?0:8,wide?180:794);
      caption.style.fontSize=wide?14:11; caption.style.lineHeight=wide?21:14; caption.style.wordWrapWidth=wide?86:304;
    },
  };
}
