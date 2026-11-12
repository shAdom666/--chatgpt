const assert=require('node:assert/strict');
const {advance}=require('../live2d/runtime/walker.cjs');
const {Controller,foot}=require('../live2d/runtime/side-motion.js');
for(const hz of [30,60,120,144,240]){
 let s={x:80,v:28,vRate:0,direction:1,turns:0,heading:1},turnFrames=0,maxHeadingStep=0,previous=s;
 for(let i=0;i<hz*5;i++){
  s=advance(s,1/hz,s.direction*28,0,100,true);
  assert(s.x>=0&&s.x<=100,'window must stay inside work area');
  if(s.stage==='turn'){turnFrames++;assert(Math.abs(s.v)<.31,'turn only after stopping');}
  maxHeadingStep=Math.max(maxHeadingStep,Math.abs(s.heading-previous.heading));previous=s;
 }
 assert(turnFrames>hz*.65,'turn must contain visible intermediate headings');
 assert(maxHeadingStep<.19,'heading must not flip on a single frame');
 const c=new Controller();let params;
 for(let i=0;i<hz*3;i++){
  params=c.update(1/hz,{speed:28,distance:i*28/hz});
  assert(Object.values(params).every(Number.isFinite));
  assert(params.ParamStrideNear>=0&&params.ParamStrideNear<16);
 }
 for(let i=0;i<hz*2;i++)params=c.update(1/hz,{speed:0,distance:84});
 assert(Math.abs(params.ParamStrideNear-4.96)<.001,'near foot must return to rest');
 assert(Math.abs(params.ParamStrideFar-4.96)<.001,'far foot must return to rest');
}
for(let i=0;i<1000;i++){
 const p=i/1000,L=foot(p),R=foot(p+.5);
 assert(L.support||R.support,'walking must always have at least one support foot');
 if(L.support)assert.equal(L.lift,0,'support sole stays on the ground');
}
console.log('PASS side-view locomotion at 30–240 Hz: braking, stationary turns, continuous heading, support feet and rest recovery');
