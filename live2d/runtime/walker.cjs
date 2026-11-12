// Continuous DIP coordinates; brake before turning. Renderers receive this
// measured speed and distance, including the last part of a deceleration.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));};
function advance(state,dt,target,min,max,canTurn){
 const s={heading:state.direction,stage:'idle',turnAge:0,...state};dt=clamp(dt,0,.1);
 if(max<=min)return {...s,x:min,v:0,vRate:0,heading:0,stage:'idle'};
 s.x=clamp(s.x,min,max);
 const moving=Math.abs(target)>.01,edge=s.direction<0?s.x-min:max-s.x;
 let command=target;
 if(s.stage==='turn'){
  command=0;s.turnAge+=dt;
  s.heading=s.turnFrom+(s.turnTo-s.turnFrom)*ease(s.turnAge/.72);
  if(s.turnAge>=.72){s.direction=s.turnTo;s.heading=s.direction;s.stage='walking';}
 }else if(moving){
  if(Math.abs(s.heading-s.direction)>.015&&Math.abs(s.v)<.15){
   s.stage='prepare';s.heading+=(s.direction-s.heading)*(1-Math.exp(-12*dt));command=0;
  }else{
   const wasBraking=s.stage==='braking';s.heading=s.direction;s.stage='walking';
   if(canTurn&&(wasBraking||edge<Math.abs(s.v)*.36+2)){command=0;s.stage='braking';}
   if(canTurn&&s.stage==='braking'&&Math.abs(s.v)<.3){
    s.stage='turn';s.turnAge=0;s.turnFrom=s.direction;s.turnTo=-s.direction;s.turns++;
   }
  }
 }else{
  command=0;s.stage=Math.abs(s.v)>.12?'settle':'idle';
  if(s.stage==='idle')s.heading*=Math.exp(-8*dt);
 }
 const offset=s.v-command,decay=Math.exp(-9*dt),term=(s.vRate+9*offset)*dt;
 s.v=command+(offset+term)*decay;s.vRate=(s.vRate-9*term)*decay;
 const candidate=s.x+s.v*dt;
 s.x=clamp(candidate,min,max);
 if(candidate<min||candidate>max){s.v=s.vRate=0;}
 if(Math.abs(s.v)<.002&&command===0){s.v=s.vRate=0;}
 return s;
}
if(typeof module==='object'&&module.exports)module.exports={advance};else globalThis.PetWalker={advance};
