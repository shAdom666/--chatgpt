// Render the independently authored Cubism side models at a shared sole line.
class SideViews {
 constructor(app,front){this.app=app;this.front=front;this.models={};this.turns={};this.controller=new SideMotion.Controller();this.ready=false;}
 async load(){
  const bundle=await window.pet.modelBundle();
  if(bundle.views.length!==2)return {ready:false,reason:'侧身模型尚未导出，当前显示原模型。',loaded:[]};
  for(const view of bundle.views){
   const m=await PIXI.live2d.Live2DModel.from(view.url,{autoInteract:false,autoUpdate:true});
   m.alpha=0;this.app.stage.addChild(m);this.models[view.id]=m;
   const texture=await PIXI.Texture.fromURL(view.turnUrl),turn=new PIXI.Sprite(texture);turn.alpha=0;this.app.stage.addChild(turn);this.turns[view.id]=turn;
   m.internalModel.on('beforeModelUpdate',()=>{
    for(const [id,value] of Object.entries(this.parameters||{}))m.internalModel.coreModel.setParameterValueById(id,value);
   });
  }
  this.ready=true;this.fit();return {ready:true,loaded:Object.keys(this.models)};
 }
 fit(){
  const scale=this.front.scale.x;
  const width=this.app.screen.width,height=this.app.screen.height;
  for(const m of [...Object.values(this.models),...Object.values(this.turns)]){
   m.anchor.set(0,0);m.pivot.set(512,1400);m.scale.set(scale);m.position.set(width/2,height-9);
  }
 }
 update(dt,locomotion,heading=0){
  if(!this.ready)return;
  this.parameters=this.controller.update(dt,locomotion);
  // Front-to-side silhouette changes happen only during preparation/turning,
  // while the native window is stationary or nearly stationary.
  const t=Math.min(2,Math.abs(heading)*2),ease=x=>x*x*(3-2*x),a=ease(Math.min(1,t)),b=ease(Math.max(0,t-1));
  this.front.alpha=1-a;
  for(const [id,m] of Object.entries(this.models)){
   const selected=((heading<0&&id==='left')||(heading>=0&&id==='right'));
   m.alpha=selected?b:0;this.turns[id].alpha=selected?a-b:0;
  }
 }
 bounds(){
  const visible=[...Object.values(this.models),...Object.values(this.turns)].find(m=>m.alpha>.5);
  return (visible||this.front).getBounds();
 }
}
