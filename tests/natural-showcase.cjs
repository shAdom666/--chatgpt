const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {showcase}=require('../live2d/runtime/motions.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const rig=read('live2d-rig.json'),video=read('live2d-showcase.json');
assert.equal(rig.parameters.length,36,'new model must contain the knee parameters');
for(const [id,mesh] of [['ParamKneeL','ArtMesh6'],['ParamKneeR','ArtMesh7']]){
 const parameter=rig.parameters.find(p=>p.id===id);assert(parameter?.displacement[mesh]>30,id+' must flex the leg mesh, not only exist');
 const range=video.parameterRanges[id];assert(range&&range[1]-range[0]>.5,id+' must actually animate');
}
for(const mode of showcase)assert(video.captureStats[mode]>5000,'missing rendered action '+mode);
for(const mode of ['stretch','shrug','tidy','wake'])assert(Math.max(video.bodyMotion[mode].ArtMesh14,video.bodyMotion[mode].ArtMesh15)>35,'new action must articulate the arms: '+mode);
assert(video.parameterRanges.ParamRotation_leftElbow[1]>50,'stretch must bend the left elbow');
assert(video.parameterRanges.applied_rightElbow[0]<-50,'wave must survive physics');
assert(video.render.canvas[0]<=642&&video.render.canvas[1]<=942,'render size must remain stable');
assert(video.videoBytes>100000,'preview must contain actual video frames');
console.log('PASS 12 rendered states, native knee deformation, arm gestures, physical parameter application and stable canvas');
