const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const report=JSON.parse(fs.readFileSync(path.join(__dirname,'live2d-rig.json'),'utf8'));
const before=JSON.parse(fs.readFileSync(path.join(__dirname,'live2d-neutral.fixture.json'),'utf8'));
const expected={ParamRotation_legLeft:'ArtMesh6',ParamRotation_legRight:'ArtMesh7',ParamRotation_wingLeft:'ArtMesh3',ParamRotation_wingRight:'ArtMesh4',ParamRotation_tail:'ArtMesh5'};
for(const [id,mesh] of Object.entries(expected)){const p=report.parameters.find(p=>p.id===id);assert(p?.displacement[mesh]>20,id+' must deform its own mesh');}
for(const mesh of ['ArtMesh8','ArtMesh9'])assert(report.parameters.find(p=>p.id==='ParamRotation_body').displacement[mesh]>20,'body must drive clothing');
for(const mesh of ['ArtMesh19','ArtMesh20','ArtMesh21','ArtMesh23'])assert(report.parameters.find(p=>p.id==='ParamAngleX').displacement[mesh]>5,'head ornaments must follow the head');
let neutralError=0;for(const p of report.neutral){const original=before.neutral.find(n=>n.id===p.id);if(!original){assert.equal(p.id,'ArtMesh33','only the new lining mesh may lack a baseline');continue;}p.bounds.forEach((v,i)=>{neutralError=Math.max(neutralError,Math.abs(v-original.bounds[i]));});}
assert(neutralError<.2,'Reparenting must preserve the neutral pose: '+neutralError+' source pixels');
console.log('PASS leg, wing, tail, clothing and head ornament bindings; neutral pose error '+neutralError.toFixed(4)+' source pixels');
const animation=JSON.parse(fs.readFileSync(path.join(__dirname,'live2d-animation.json'),'utf8'));
assert.equal(Object.keys(animation.captureStats).length,5);
for(const [mode,pixels] of Object.entries(animation.captureStats))assert(pixels>5000,mode+' must actually render visible pixels');
assert(animation.render.canvas[0]<=642&&animation.render.canvas[1]<=942,'movement must not inflate the rendering canvas');
assert(animation.parameterRanges.applied_rightElbow[0]<-45,'physics must preserve the deliberate wave elbow angle');
for(const id of ['ArtMesh6','ArtMesh7'])assert(animation.bodyMotion.walk[id]>25,'walk must visibly move both legs');
for(const id of ['ArtMesh3','ArtMesh4'])assert(animation.bodyMotion.idle[id]>1,'idle must gently move both wings');
assert(animation.bodyMotion.idle.ArtMesh5>1,'idle must gently move the tail');
assert(animation.bodyMotion.wave.ArtMesh15>100,'wave must move the arm mesh');
console.log('PASS actual runtime leg gait, wing/tail movement and wave after physics');
