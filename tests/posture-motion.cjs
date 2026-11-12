const assert=require('node:assert/strict'),{Controller}=require('../live2d/runtime/postures.js');
const {readCaff}=require('./sideview-authoring.cjs'),path=require('node:path');
(async()=>{
 for(const hz of [30,60,120,144,240]){
  const c=new Controller();let previous=0,maxStep=0;
  for(let i=0;i<hz;i++)assert.equal(c.update(1/hz,{mode:'sleep',speed:4,heading:1}).progress,0,'brake before lowering');
  for(const [mode,seconds,target] of [['crouch',3,2],['sleep',4,5],['wake',4.8,0],['sleep',.8,null],['idle',2,0]]){
   for(let i=0;i<seconds*hz;i++){const f=c.update(1/hz,{mode});assert(f.progress>=0&&f.progress<=5);assert(f.alpha>=0&&f.alpha<=1);assert(f.pose>=0&&f.pose<=4);maxStep=Math.max(maxStep,Math.abs(f.progress-previous));previous=f.progress;}
   if(target!==null)assert.equal(c.progress,target);
  }
  assert(maxStep<.1,'continuous posture transitions '+hz+'Hz');
 }
 const xml=await readCaff(path.join(__dirname,'../live2d/model/postures/GPTDragon-postures.cmo3'));
 const ids=new Set([...xml.matchAll(/xs.id="([^"]+)"/g)].map(m=>m[1]));for(const m of xml.matchAll(/xs.ref="([^"]+)"/g))assert(ids.has(m[1]),'dangling pose reference '+m[1]);
 const meshes=[...xml.matchAll(/<CArtMeshSource xs.id="[^"]+"[\s\S]*?<\/CArtMeshSource>/g)].map(m=>m[0]);assert.equal(meshes.length,5);
 for(const m of meshes){assert.equal([...m.matchAll(/<CArtMeshForm>/g)].length,5);assert.equal([...m.matchAll(/<f xs.n="opacity">1\.0<\/f>/g)].length,1);}
 assert.equal([...xml.matchAll(/<CWarpDeformerSource xs.id=/g)].length,5);
 console.log('PASS posture transitions at 30–240 Hz, interruptions, brake-before-crouch, 5 native pose meshes and opacity keyforms');
})().catch(e=>{console.error(e);process.exitCode=1;});
