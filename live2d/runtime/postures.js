(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PetPostures=api;})(globalThis,function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*t*(10+t*(-15+6*t));
 class Controller{
  constructor(){this.progress=0;this.position=0;this.time=0;}
  update(dt,{mode='idle',speed=0,heading=0}={}){
   dt=clamp(dt,0,.1);this.time+=dt;
   const target=mode==='crouch'?2:mode==='sleep'?5:0;
   // Finish braking and facing front before changing the supporting silhouette.
   if(this.position>0||target===0||(Math.abs(speed)<.15&&Math.abs(heading)<.03)){
    const rate=target<this.position?1.18:1.48;
    this.position+=clamp(target-this.position,-rate*dt,rate*dt);
   }
   const floor=Math.floor(this.position);this.progress=floor+ease(this.position-floor);
   return {progress:this.progress,alpha:clamp(this.progress,0,1),pose:Math.max(0,this.progress-1),breath:1+Math.sin(this.time*1.25)*.5,target};
  }
 }
 class Views{
  constructor(app,front,sides){this.app=app;this.front=front;this.sides=sides;this.controller=new Controller();this.ready=false;}
  async load(){
   const bundle=await window.pet.modelBundle();if(!bundle.postures)return {ready:false,reason:'姿势模型未导出'};
   const m=await PIXI.live2d.Live2DModel.from(bundle.postures.url,{autoInteract:false,autoUpdate:true});this.model=m;this.metadata=bundle.postures.bounds;
   m.alpha=0;this.app.stage.addChild(m);
   m.internalModel.on('beforeModelUpdate',()=>{const core=m.internalModel.coreModel;core.setParameterValueById('ParamPose',this.frame?.pose||0);core.setParameterValueById('ParamPostureBreath',this.frame?.breath??1);});
   this.ready=true;this.fit();return {ready:true,poses:this.metadata.poses.map(p=>p.id)};
  }
  fit(){if(!this.model)return;this.model.anchor.set(0,0);this.model.pivot.set(512,1400);this.model.scale.set(this.front.scale.x);this.model.position.set(this.app.screen.width/2,this.app.screen.height-9);}
  update(dt,input){
   if(!this.ready)return;this.frame=this.controller.update(dt,input);const a=this.frame.alpha;this.model.alpha=a;
   this.front.alpha*=1-a;
   if(this.sides)for(const m of [...Object.values(this.sides.models),...Object.values(this.sides.turns)])m.alpha*=1-a;
  }
  bounds(){
   if(!this.ready||!this.frame||this.frame.alpha<.5)return null;
   const pose=this.frame.pose,lo=Math.floor(pose),hi=Math.ceil(pose),a=this.metadata.poses[lo].rect,b=this.metadata.poses[hi].rect;
   const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]),x1=Math.max(a[2],b[2]),y1=Math.max(a[3],b[3]),scale=this.model.scale.x;
   return {x:this.model.x+(x0-512)*scale,y:this.model.y+(y0-1400)*scale,width:(x1-x0)*scale,height:(y1-y0)*scale};
  }
 }
 return {Controller,Views};
});
