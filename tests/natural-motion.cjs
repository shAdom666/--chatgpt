const assert=require('node:assert/strict');
const {Controller,catalog,showcase,foot}=require('../live2d/runtime/motions.js');
const poseAt=(mode,hz,seconds)=>{const c=new Controller(.37);let pose;for(let i=0;i<Math.round(hz*seconds);i++)pose=c.update(1/hz,{mode,speed:mode==='walk'?28:0,distance:(i+1)*28/hz,direction:-1,gaze:{x:.3,y:.1}});return pose;};
let maxRateDifference=0;
for(const mode of showcase){
 const reference=poseAt(mode,240,Math.min(catalog[mode].duration,2));
 for(const hz of [30,60,120,144]){
  const pose=poseAt(mode,hz,Math.min(catalog[mode].duration,2));
  for(const [id,value] of Object.entries(pose.params)){
   assert(Number.isFinite(value),mode+' '+id+' must remain finite');
   const diff=Math.abs(value-reference.params[id]);maxRateDifference=Math.max(maxRateDifference,diff);
   assert(diff<1.7,'frame-rate-dependent motion: '+mode+' '+id+' '+diff);
  }
 }
}
for(let i=0;i<1000;i++)assert(Math.min(foot(i/1000).knee,foot(i/1000+.5).knee)<.001,'walking needs a supporting foot');
const c=new Controller(.37);let previous,maximumStep=0,armExcursion=0,kneeExcursion=0;
for(const mode of ['walk','wave','stretch','sleep','wake','tidy','idle']){
 for(let i=0;i<300;i++){
  const pose=c.update(1/60,{mode,speed:mode==='walk'?28:0,distance:i*28/60,direction:1});
  for(const [id,value] of Object.entries(pose.params)){
   if(previous)maximumStep=Math.max(maximumStep,Math.abs(value-previous.params[id]));
   if(id.startsWith('ParamRotation_arm'))armExcursion=Math.max(armExcursion,Math.abs(value));
   if(id.startsWith('ParamKnee')){assert(value>=0&&value<=1,'knee flex must stay in model range');kneeExcursion=Math.max(kneeExcursion,value);}
  }
  previous=pose;
 }
}
assert(maximumStep<6,'interrupted gestures must not snap to a new pose');
assert(armExcursion>22&&kneeExcursion>.6,'arms and knees must articulate');
assert(Math.abs(previous.params.ParamRotation_armRight)<3,'arms must settle into a relaxed pose');
assert(previous.close<.02,'eyes must recover after waking');
console.log('PASS natural motion at 30–240 Hz; support foot, joint ranges, interrupted transitions, relaxed recovery');
console.log(JSON.stringify({maxRateDifference,maxJointStepPer60HzFrame:maximumStep,armExcursion,kneeExcursion}));
