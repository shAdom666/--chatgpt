const assert=require('node:assert/strict'),{Controller}=require('../live2d/runtime/postures.js');
const {readCaff}=require('./sideview-authoring.cjs'),path=require('node:path');
(async()=>{
 for(const hz of [30,60,120,144,240]){
  const c=new Controller();let previous=0,maxStep=0;
  for(let i=0;i<hz;i++)assert.equal(c.update(1/hz,{mode:'sleep',speed:4,heading:1}).progress,0,'brake before lowering');
  for(const [mode,seconds,target] of [['crouch',3,2],['sleep',4,7],['wake',5.6,0],['sleep',.8,null],['idle',2,0]]){
   for(let i=0;i<seconds*hz;i++){const f=c.update(1/hz,{mode});assert(f.progress>=0&&f.progress<=7);assert([0,1].includes(f.alpha),'whole character must never be cross-faded');assert(Number.isInteger(f.pose)&&f.pose>=0&&f.pose<=6,'native pose selector stays discrete');assert(Math.abs(f.morph)<=1);assert(f.prepare>=0&&f.prepare<=1);maxStep=Math.max(maxStep,Math.abs(f.progress-previous));previous=f.progress;}
   if(target!==null)assert.equal(c.progress,target);
  }
  assert(maxStep<.1,'continuous posture transitions '+hz+'Hz');
 }
 const xml=await readCaff(path.join(__dirname,'../live2d/model/postures-repair/GPTDragon-postures.cmo3'));
 const ids=new Set([...xml.matchAll(/xs.id="([^"]+)"/g)].map(m=>m[1]));for(const m of xml.matchAll(/xs.ref="([^"]+)"/g))assert(ids.has(m[1]),'dangling pose reference '+m[1]);
 const meshes=[...xml.matchAll(/<CArtMeshSource xs.id="[^"]+"[\s\S]*?<\/CArtMeshSource>/g)].map(m=>m[0]);assert.equal(meshes.length,7);
 for(const m of meshes){assert.equal([...m.matchAll(/<CArtMeshForm>/g)].length,7);assert.equal([...m.matchAll(/<f xs.n="opacity">1\.0<\/f>/g)].length,1);}
 const warps=[...xml.matchAll(/<CWarpDeformerSource xs.id="[^"]+"[\s\S]*?<\/CWarpDeformerSource>/g)].map(m=>m[0]);assert.equal(warps.length,7);
 for(const w of warps){
  const col=Number(w.match(/<i xs.n="col">(\d+)/)[1]),row=Number(w.match(/<i xs.n="row">(\d+)/)[1]);
  const forms=[...w.matchAll(/<float-array xs.n="positions"[^>]*>([^<]+)<\/float-array>/g)].map(m=>m[1].trim().split(/\s+/).map(Number));assert.equal(forms.length,9);
  for(const v of forms)for(let y=0;y<row;y++)for(let x=0;x<col;x++){
   const a=y*(col+1)+x,b=a+1,c=a+col+1,d=c+1;
   for(const [i,j,k] of [[a,b,c],[b,d,c]])assert((v[j*2]-v[i*2])*(v[k*2+1]-v[i*2+1])-(v[j*2+1]-v[i*2+1])*(v[k*2]-v[i*2])>0,'posture warp folds over');
  }
 }
 console.log('PASS exclusive posture transitions at 30–240 Hz, interruptions, brake-before-crouch, 7 native pose meshes and 9 non-folding transition/breathing forms per warp');
})().catch(e=>{console.error(e);process.exitCode=1;});
