// Keep continuous coordinates; rounded native window positions are output only.
function advance(state,dt,target,min,max,canTurn){
 const s={...state};dt=Math.max(0,Math.min(.1,dt));
 const offset=s.v-target,decay=Math.exp(-8*dt),term=(s.vRate+8*offset)*dt;
 s.v=target+(offset+term)*decay;s.vRate=(s.vRate-8*term)*decay;
 if(max<=min){s.x=min;s.v=s.vRate=0;return s;}
 const candidate=s.x+s.v*dt;
 if(candidate<min||candidate>max){
  s.x=Math.max(min,Math.min(max,candidate));
  if(canTurn&&((candidate<min&&s.direction<0)||(candidate>max&&s.direction>0))){s.direction=candidate<min?1:-1;s.turns++;}
  s.v=s.vRate=0;
 }else s.x=candidate;
 return s;
}
module.exports={advance};
