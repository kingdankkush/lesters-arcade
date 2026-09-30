// Minimal Pixi transform/resource protocol. Source tests do not certify WebGL.
import assert from 'node:assert/strict';
export class Container {
  constructor() {
    this.children=[];this.visible=true;this.alpha=1;this.rotation=0;
    this.position={x:0,y:0,set:(x,y=x)=>{this.position.x=x;this.position.y=y;}};
    this.scale={x:1,y:1,set:(x,y=x)=>{this.scale.x=x;this.scale.y=y;}};
  }
  addChild(...nodes) { for(const node of nodes){if(node.parent)node.parent.children=node.parent.children.filter(child=>child!==node);node.parent=this;this.children.push(node);}return nodes.at(-1); }
  destroy({children=false}={}) {
    assert.equal(this.destroyed,undefined,'resource destroyed twice');this.destroyed=true;
    if(children)for(const child of [...this.children])child.destroy({children:true});
    this.children=[];
    if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);
  }
}
export class Graphics extends Container {
  constructor(){super();this.commands=[];this.context={destroyed:false,destroy(){this.destroyed=true;}};}
  circle(...args){this.commands.push(['circle',...args]);return this;}
  rect(...args){this.commands.push(['rect',...args]);return this;}
  poly(...args){this.commands.push(['poly',...args]);return this;}
  fill(){return this;}stroke(){return this;}
  clear(){this.commands=[];return this;}
  clone(){const node=new Graphics();node.context=this.context;node.commands=this.commands;return node;}
}
export class Text extends Container {
  constructor({text,style}){super();this.text=text;this.style=style;this.anchor={set(){}};}
}
