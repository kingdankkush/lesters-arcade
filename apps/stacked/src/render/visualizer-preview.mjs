// Copy the actual cabinet immediately after app.render in the same frame.
// No readback, duplicate scene, extra WebGL context or texture allocation.
export function createVisualizerPreview(canvas,{source=()=>null}={}) {
  const context=canvas?.getContext('2d');
  return {
    draw(now, settings, info) {
      if(!context)return;
      const image=source(),width=canvas.width,height=canvas.height;
      context.fillStyle='#050910';context.fillRect(0,0,width,height);
      if(image?.width&&image?.height){
        const scale=Math.min(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;
        context.drawImage(image,(width-w)/2,(height-h)/2,w,h);
      }
      if(info?.sceneName){context.fillStyle='#d4efff';context.font='600 16px system-ui, sans-serif';context.textAlign='right';context.fillText(info.sceneName.toUpperCase(),width-14,28);context.textAlign='left';}
    },
  };
}
