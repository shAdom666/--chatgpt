(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SideMotion=api;})(globalThis,function(){
 'use strict';
 const wrap=p=>((p%1)+1)%1;
 function foot(phase){
  const p=wrap(phase),u=p<.62?p/.62:(p-.62)/.38;
  return {x:p<.62?29-58*u:-29+58*u*u*(3-2*u),lift:p<.62?0:36*Math.sin(Math.PI*u)**1.6,support:p<.62};
 }
 class Controller{
  constructor(){this.near=.31;this.far=.31;this.time=0;this.amount=0;}
  update(dt,{distance=0,speed=0}={}){
   dt=Math.max(0,Math.min(.1,dt));this.time+=dt;
   const cycleDistance=58*(304/1024)/.62;
   const moving=speed>.12,w=1-Math.exp(-16*dt),phase=distance/cycleDistance;
   const follow=(value,target)=>value+(wrap(target-value+.5)-.5)*w;
   this.near=follow(this.near,moving?phase:.31);
   this.far=follow(this.far,moving?phase+.5:.31);
   this.amount+=(Math.min(1,speed/28)-this.amount)*(1-Math.exp(-9*dt));
   const swing=Math.sin(phase*Math.PI*2)*this.amount;
   return {ParamStrideNear:wrap(this.near)*16,ParamStrideFar:wrap(this.far)*16,
    ParamArmNear:1+swing*.7,ParamArmFar:1-swing*.7,
    ParamBodySway:1+.35*Math.sin(this.time*1.3)+swing*.2,
    ParamTail:1+.55*Math.sin(this.time*.9-.7),ParamWing:1+.35*Math.sin(this.time*1.1-.3)};
  }
 }
 return {Controller,foot};
});
