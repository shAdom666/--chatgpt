function auditRig(core){
 const native=core.getModel(),p=native.parameters,ppu=native.canvasinfo.PixelsPerUnit;
 const snapshot=()=>Array.from({length:core.getDrawableCount()},(_,i)=>Float32Array.from(core.getDrawableVertices(i)));
 const reset=()=>{for(let i=0;i<p.count;i++)core.setParameterValueByIndex(i,p.defaultValues[i]);core.update();};
 const ids=core.getDrawableIds();reset();const baseline=snapshot(),parameters=[];
 for(let pi=0;pi<p.count;pi++){
  const displacement={};
  for(const value of [p.minimumValues[pi],p.maximumValues[pi]]){
   reset();core.setParameterValueByIndex(pi,value);core.update();
   for(let di=0;di<ids.length;di++){
    const vertices=core.getDrawableVertices(di);let max=0;
    for(let k=0;k<vertices.length;k+=2)max=Math.max(max,Math.hypot(vertices[k]-baseline[di][k],vertices[k+1]-baseline[di][k+1])*ppu);
    if(max>.01)displacement[ids[di]]=Math.max(displacement[ids[di]]||0,max);
   }
  }
  parameters.push({id:p.ids[pi],min:p.minimumValues[pi],max:p.maximumValues[pi],default:p.defaultValues[pi],displacement});
 }
 reset();return {parameters,neutral:baseline.map((v,i)=>({id:ids[i],bounds:[Math.min(...v.filter((_,k)=>k%2===0))*ppu,Math.min(...v.filter((_,k)=>k%2===1))*ppu,Math.max(...v.filter((_,k)=>k%2===0))*ppu,Math.max(...v.filter((_,k)=>k%2===1))*ppu]})),units:'maximum vertex displacement in source pixels',drawables:ids};
}
