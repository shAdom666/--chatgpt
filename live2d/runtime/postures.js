(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PetPostures=api;})(globalThis,function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*t*(10+t*(-15+6*t));
 class Controller{
  constructor(max=7){this.progress=0;this.position=0;this.time=0;this.max=max;}
  update(dt,{mode='idle',speed=0,heading=0}={}){
   dt=clamp(dt,0,.1);this.time+=dt;
   const target=mode==='crouch'?2:mode==='sleep'?this.max:0;
   // Finish braking and facing front before changing the supporting silhouette.
   if(this.position>0||target===0||(Math.abs(speed)<.15&&Math.abs(heading)<.03)){
    const rate=target<this.position?1.45:1.6;
    this.position+=clamp(target-this.position,-rate*dt,rate*dt);
   }
   const floor=Math.floor(this.position);this.progress=clamp(floor+ease(this.position-floor),0,this.max);
   const selected=Math.min(this.max,Math.round(this.progress));
   return {progress:this.progress,selected,alpha:selected?1:0,pose:Math.max(0,selected-1),morph:selected?clamp(2*(this.progress-selected),-1,1):0,prepare:selected?1:clamp(2*this.progress,0,1),standing:this.position<.0001,breath:1+Math.sin(this.time*1.25)*.5,target};
  }
 }
 class Views{
  constructor(app,front,sides){this.app=app;this.front=front;this.sides=sides;this.controller=new Controller();this.ready=false;}
  async load(){
   const bundle=await window.pet.modelBundle();if(!bundle.postures)return {ready:false,reason:'姿势模型未导出'};
   const m=await PIXI.live2d.Live2DModel.from(bundle.postures.url,{autoInteract:false,autoUpdate:false});this.model=m;this.metadata=bundle.postures.bounds;this.controller.max=this.metadata.poses.length;
   m.alpha=0;this.app.stage.addChild(m);
   m.internalModel.on('beforeModelUpdate',()=>{const core=m.internalModel.coreModel;core.setParameterValueById('ParamPose',this.frame?.pose||0);core.setParameterValueById('ParamTransition',this.frame?.morph||0);core.setParameterValueById('ParamPostureBreath',this.frame?.breath??1);});
   this.front.internalModel.on('beforeModelUpdate',()=>{const core=this.front.internalModel.coreModel,prepare=this.frame?.prepare||0;core.setParameterValueById('ParamCrouchPrepare',prepare);if(prepare)core.addParameterValueById('ParamAngleX',prepare*12);});
   this.ready=true;this.fit();return {ready:true,poses:this.metadata.poses.map(p=>p.id)};
  }
  fit(){if(!this.model)return;this.model.anchor.set(0,0);this.model.pivot.set(512,1400);this.model.scale.set(this.front.scale.x);this.model.position.set(this.app.screen.width/2,this.app.screen.height-9);}
  update(dt,input){
   if(!this.ready)return;this.frame=this.controller.update(dt,input);const a=this.frame.alpha;this.model.alpha=a;
   this.front.alpha*=1-a;
   if(this.sides)for(const m of [...Object.values(this.sides.models),...Object.values(this.sides.turns)])m.alpha*=1-a;
   PetModelClock.advance(this.model,dt);
  }
  bounds(){
   if(!this.ready||!this.frame||!this.frame.alpha)return null;
   const pose=this.frame.pose,a=this.metadata.poses[pose].rect,next=this.frame.morph<0?pose-1:pose+1,b=Math.abs(this.frame.morph)>.001?(this.metadata.poses[next]?.rect||(next<0?[15,2,1008,1400]:a)):a;
   const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]),x1=Math.max(a[2],b[2]),y1=Math.max(a[3],b[3]),scale=this.model.scale.x;
   return {x:this.model.x+(x0-512)*scale,y:this.model.y+(y0-1400)*scale,width:(x1-x0)*scale,height:(y1-y0)*scale};
  }
 }
 return {Controller,Views};
});
