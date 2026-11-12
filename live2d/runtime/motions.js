(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PetMotions=api;})(globalThis,function(){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const ease=v=>{v=clamp(v);return v*v*v*(10+v*(-15+v*6));};
 const mix=(a,b,w)=>a+(b-a)*w;
 const channels={hx:'ParamAngleX',hy:'ParamAngleY',hz:'ParamAngleZ',bx:'ParamBodyAngleX',by:'ParamBodyAngleY',bz:'ParamBodyAngleZ',body:'ParamRotation_body',breath:'ParamBreath',mouth:'ParamMouthOpenY',browL:'ParamBrowLY',browR:'ParamBrowRY',armL:'ParamRotation_armLeft',armR:'ParamRotation_armRight',elbowL:'ParamRotation_leftElbow',elbowR:'ParamRotation_rightElbow',wristL:'ParamWristL',wristR:'ParamWristR',legL:'ParamRotation_legLeft',legR:'ParamRotation_legRight',kneeL:'ParamKneeL',kneeR:'ParamKneeR',wingL:'ParamRotation_wingLeft',wingR:'ParamRotation_wingRight',tail:'ParamRotation_tail',eyeX:'ParamEyeBallX',eyeY:'ParamEyeBallY'};
 // Poses are additive to the relaxed pose. Quintic segments have zero velocity
 // and acceleration at each held pose; joint springs retain velocity on interruption.
 const catalog={
  idle:{label:'待机',duration:2.2,previewAt:1.2},walk:{label:'走路',duration:3.4,previewAt:1.9},
  wave:{label:'招手',duration:4.2,previewAt:1.9,keys:[
   [0,{}],[.35,{armR:3,elbowR:-5,wristR:6,bx:-.4,hz:-.8}],
   [1.05,{armR:-20,elbowR:-62,wristR:-2,bx:.5,hz:1,mouth:.12}],
   [2.95,{armR:-20,elbowR:-62,wristR:-2,bx:.5,hz:1,mouth:.12}],
   [3.55,{armR:-8,elbowR:-21,wristR:4,bx:.15,hz:.4}],[4.2,{}]]},
  stretch:{label:'伸懒腰',duration:5.3,previewAt:2.5,keys:[
   [0,{}],[.55,{by:-1.2,armL:-2,armR:3,elbowL:8,elbowR:-6,hy:-2}],
   [1.7,{armL:24,armR:-25,elbowL:56,elbowR:-61,by:1.7,hy:5,lift:1.3,close:.35}],
   [2.4,{armL:27,armR:-26,elbowL:65,elbowR:-67,by:2.2,hy:7,lift:2.1,close:.72,mouth:.5}],
   [3.05,{armL:26,armR:-25,elbowL:62,elbowR:-64,by:1.8,hy:5,lift:1.5,close:.4,mouth:.26}],
   [4.3,{armL:7,armR:-6,elbowL:18,elbowR:-16,by:.4,hy:1}],[5.3,{}]]},
  look:{label:'左右张望',duration:5.5,previewAt:3.6,keys:[
   [0,{}],[.95,{hx:-13,hy:2,hz:-2,bx:-.7,eyeX:-.45}],
   [1.75,{hx:-14,hy:1,hz:-1.7,bx:-1,eyeX:-.5}],
   [3.0,{hx:13,hy:2.5,hz:2,bx:.6,eyeX:.5}],
   [4.0,{hx:14,hy:1.5,hz:1.5,bx:1,eyeX:.45}],[5.5,{}]]},
  nod:{label:'点点头',duration:3.2,previewAt:1.1,keys:[
   [0,{}],[.45,{hy:2,by:.35}],[1.0,{hy:-10,by:-1.2,bx:.25,elbowL:2}],
   [1.5,{hy:1.8,by:.2}],[2.0,{hy:-6,by:-.65,elbowR:-1.5}],[3.2,{}]]},
  shrug:{label:'摊手歪头',duration:4.1,previewAt:1.9,keys:[
   [0,{}],[.45,{hy:-1,bx:-.3}],
   [1.45,{armL:10,armR:-9,elbowL:31,elbowR:-28,by:1,hz:-4,browL:.4,browR:.25,mouth:.15}],
   [2.35,{armL:11,armR:-8,elbowL:29,elbowR:-31,by:.9,hz:-3.5,browL:.3,browR:.35,mouth:.1}],
   [3.2,{armL:4,armR:-3,elbowL:13,elbowR:-10,hz:-1.2}],[4.1,{}]]},
  tidy:{label:'整理裙摆',duration:4.3,previewAt:2.0,keys:[
   [0,{}],[.8,{hx:5,hy:-6,bx:.6,armR:5,elbowR:12}],
   [1.55,{hx:6,hy:-8,bx:1,armR:13,elbowR:28,armL:2,skirt:.1}],
   [2.1,{hx:4,hy:-7,bx:.8,armR:11,elbowR:24,skirt:-.1}],
   [2.7,{hx:3,hy:-4,bx:.4,armR:9,elbowR:21,skirt:.06}],
   [3.4,{hy:-1,armR:3,elbowR:8}],[4.3,{}]]},
  happy:{label:'开心',duration:4.0,previewAt:1.8,keys:[
   [0,{}],[.4,{by:-1,lift:-1.7,kneeL:.13,kneeR:.15,armL:-2,armR:2}],
   [1.1,{armL:13,armR:-12,elbowL:25,elbowR:-26,lift:2,hy:3,mouth:.65,browL:.25,browR:.3}],
   [1.7,{armL:15,armR:-13,elbowL:29,elbowR:-25,lift:.3,hy:1,mouth:.7,bx:.65}],
   [2.3,{armL:12,armR:-14,elbowL:24,elbowR:-29,lift:1,hy:2,mouth:.5,bx:-.45}],
   [3.05,{armL:5,armR:-4,elbowL:9,elbowR:-10,mouth:.22}],[4,{}]]},
  jump:{label:'轻轻跳一下',duration:2.4,previewAt:.95,keys:[
   [0,{}],[.38,{by:-1.5,kneeL:.3,kneeR:.3,lift:-3.7,armL:-3,armR:3,hy:-2}],
   [.72,{armL:12,armR:-12,elbowL:18,elbowR:-20,kneeL:.45,kneeR:.5,lift:16,hy:3}],
   [1.02,{armL:14,armR:-13,elbowL:20,elbowR:-22,kneeL:.62,kneeR:.58,lift:21,hy:3.5}],
   [1.43,{armL:7,armR:-7,elbowL:11,elbowR:-12,kneeL:.08,kneeR:.09,lift:0}],
   [1.64,{by:-1,kneeL:.23,kneeR:.24,lift:-2.8,hy:-2}],[2.4,{}]]},
  crouch:{label:'蹲下',duration:3,previewAt:2.4},
  sleep:{label:'侧躺蜷睡',duration:4.8,previewAt:4.2},
  wake:{label:'慢慢醒来',duration:4.8,previewAt:2.3,keys:[
   [0,{close:.45,hy:-1,hz:.5}],[1,{close:.12,hy:.3}],[2,{hy:1,close:0}],
   [3.2,{hy:.4}],[4.8,{}]]},
  thinking:{label:'思考',duration:3.6,previewAt:1.8}
 };
 const showcase=['idle','walk','wave','stretch','look','nod','shrug','tidy','jump','happy','sleep','wake'];
 function sample(keys,time){
  if(!keys)return {};
  if(time<=keys[0][0])return {...keys[0][1]};
  for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){
   const a=keys[i-1],b=keys[i],w=ease((time-a[0])/(b[0]-a[0])),out={};
   for(const id of new Set([...Object.keys(a[1]),...Object.keys(b[1])]))out[id]=mix(a[1][id]||0,b[1][id]||0,w);
   return out;
  }
  return {...keys.at(-1)[1]};
 }
 function foot(phase){
  phase=((phase%1)+1)%1;
  if(phase<.62)return {angle:mix(-1,1,phase/.62),knee:0};
  const u=(phase-.62)/.38;return {angle:mix(1,-1,ease(u)),knee:Math.pow(Math.sin(Math.PI*u),1.7)*.82};
 }
 function spring(state,target,omega,dt){
  const offset=state.x-target,decay=Math.exp(-omega*dt),term=(state.v+omega*offset)*dt;
  state.x=target+(offset+term)*decay;state.v=(state.v-omega*term)*decay;return state.x;
 }
 class Controller{
  constructor(seed=.37){this.time=0;this.age=0;this.mode='idle';this.states={};this.seed=seed;this.walkBlend={x:0,v:0};}
  update(dt,input={}){
   dt=clamp(dt,0,.06);this.time+=dt;
   const mode=input.mode||'idle';if(mode!==this.mode||(input.token!==undefined&&input.token!==this.token)){this.mode=mode;this.age=0;this.token=input.token;}else this.age+=dt;
   const t=this.time+this.seed*31,gx=clamp(input.gaze?.x||0,-1,1),gy=clamp(input.gaze?.y||0,-1,1);
   const relaxed={hx:gx*9,hy:-gy*5,hz:.5*Math.sin(t*.63)+gx*.7,bx:.22*Math.sin(t*.42),by:.25*Math.sin(t*.58),bz:.18*Math.sin(t*.47),body:.12*Math.sin(t*.39),breath:.46+.23*Math.sin(t*1.35+.07*Math.sin(t*.18)),mouth:0,browL:0,browR:0,armL:1.2,armR:-1,elbowL:3.5+.5*Math.sin(t*.6-.4),elbowR:-3-.5*Math.sin(t*.6+.1),wristL:.7*Math.sin(t*.6-.9),wristR:-.7*Math.sin(t*.6-.4),legL:0,legR:0,kneeL:0,kneeR:0,wingL:1.1*Math.sin(t*.77)+.3*Math.sin(t*.31),wingR:-.95*Math.sin(t*.71+.4),tail:1.8*Math.sin(t*.57+.8)+.55*Math.sin(t*.23),eyeX:gx*.6,eyeY:-gy*.45,close:0,lift:0,offsetX:0,skirt:0};
   // A slow transfer of weight with a long rest, rather than constant whole-body rocking.
   const shiftPhase=((t+3)%13)/13,weight=(shiftPhase>.55&&shiftPhase<.9)?Math.sin(Math.PI*(shiftPhase-.55)/.35)**2:0;
   relaxed.bx+=weight*.65;relaxed.bz-=weight*.35;relaxed.armL+=weight*1.8;relaxed.hz-=weight*.6;
   const amount=spring(this.walkBlend,clamp(Math.abs(input.speed||0)/28),9,dt);
   if(amount>.0001){
    const phase=(input.distance||0)/29,L=foot(phase),R=foot(phase+.5),dir=input.direction||-1;
    relaxed.legL+=dir*L.angle*3.3*amount;relaxed.legR+=dir*R.angle*4.5*amount;
    relaxed.kneeL=L.knee*amount;relaxed.kneeR=R.knee*amount;
    const sway=Math.sin(phase*2*Math.PI),lag=Math.sin(phase*2*Math.PI-.45);
    relaxed.bx+=sway*.85*amount;relaxed.bz-=lag*.4*amount;relaxed.body+=lag*.15*amount;
    relaxed.armL-=lag*3.4*amount;relaxed.armR+=lag*3.8*amount;
    relaxed.elbowL+=Math.max(0,-lag)*7*amount;relaxed.elbowR-=Math.max(0,lag)*8*amount;
    relaxed.wristL+=Math.sin(phase*2*Math.PI-.8)*2.2*amount;relaxed.wristR-=Math.sin(phase*2*Math.PI-.8)*2.2*amount;
    relaxed.lift=(1-Math.cos(phase*4*Math.PI))*.5*1.1*amount;
    relaxed.offsetX=sway*.55*amount;
   }
   if(mode==='sleep')Object.assign(relaxed,{hx:0,hy:-8,hz:3.5,bx:0,by:-1.8,bz:.3,body:.5,armL:5,armR:-4,elbowL:10,elbowR:-11,wingL:2.3,wingR:-2.3,tail:3.3,eyeX:0,eyeY:0,close:1,breath:.43+.14*Math.sin(t*.95)});
   if(mode==='thinking'){relaxed.hy+=3;relaxed.hz+=2;relaxed.armR+=3;relaxed.elbowR-=7;relaxed.browL=.15;relaxed.mouth=.025;}
   const action=sample(catalog[mode]?.keys,this.age);
   for(const [id,value] of Object.entries(action))relaxed[id]=(relaxed[id]||0)+value;
   if(mode==='wave'){
    const envelope=ease((this.age-1)/.4)*(1-ease((this.age-2.7)/.45)),phase=(this.age-1.15)*Math.PI*2/.82;
    relaxed.armR+=Math.sin(phase+.35)*1.4*envelope;relaxed.elbowR+=Math.sin(phase)*7*envelope;relaxed.wristR+=Math.sin(phase-.55)*11*envelope;
   }
   if(mode==='stretch'){relaxed.wristL+=(action.armL||0)*.22;relaxed.wristR+=(action.armR||0)*.22;}
   if(mode==='shrug'){relaxed.wristL+=action.elbowL*.18||0;relaxed.wristR+=action.elbowR*.18||0;}
   const params={};let close=0,lift=0,offsetX=0,skirt=0;
   for(const [id,target] of Object.entries(relaxed)){
    const omega=id.startsWith('knee')?24:id.startsWith('leg')?20:id.startsWith('wrist')?13:id.startsWith('elbow')?11:id.startsWith('arm')?9:id.startsWith('wing')||id==='tail'?6:id==='lift'?18:id==='close'?11:9;
    const initial=id==='breath'?.46:0,state=this.states[id]||(this.states[id]={x:initial,v:0});let value=spring(state,target,omega,dt);
    if(['kneeL','kneeR','close','breath','mouth'].includes(id))value=clamp(value);
    if(id==='close')close=value;else if(id==='lift')lift=value;else if(id==='offsetX')offsetX=value;else if(id==='skirt')skirt=value;else params[channels[id]]=value;
   }
   return {params,close,lift,offsetX,skirt,age:this.age,mode};
  }
 }
 return {Controller,catalog,showcase,sample,foot,ease};
});
