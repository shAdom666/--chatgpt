// Check the posed skin normal, independently of the frame used to orient the wrist.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Bone,Group,Vector3,Quaternion} from '../live2d/runtime/dragon3d/node_modules/three/build/three.module.js';
import {handGestures} from '../live2d/runtime/dragon3d/hand-orientation.mjs';
import motions from '../live2d/runtime/motions.js';

const bytes=fs.readFileSync(new URL('../live2d/model/dragon3d/Dragon.glb',import.meta.url));
const length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+length));
function values(i) {
  const a=doc.accessors[i],v=doc.bufferViews[a.bufferView];
  const Type={5123:Uint16Array,5126:Float32Array}[a.componentType];
  return new Type(bytes.buffer,bytes.byteOffset+28+length+(v.byteOffset||0)+(a.byteOffset||0),a.count*({VEC3:3,VEC4:4}[a.type]));
}
const bones=doc.nodes.map(n=>{const b=new Bone();b.name=n.name;b.position.fromArray(n.translation||[0,0,0]);return b;});
for(const [i,n] of doc.nodes.entries())for(const child of n.children||[])bones[i].add(bones[child]);
const rig=Object.fromEntries(bones.map(b=>[b.name,b]));
const model=new Group();model.add(rig.Hips);
const hand=doc.meshes[0].primitives.find(p=>doc.materials[p.material].name==='HandSkin').attributes;
const normals=values(hand.NORMAL),indices=values(hand.JOINTS_0),weights=values(hand.WEIGHTS_0);
function palmSurface(l) {
  const id=doc.skins[0].joints.indexOf(bones.indexOf(rig['Hand'+l]));
  const sum=new Vector3();
  // Select vertices facing out of the palm in bind pose, away from the nails.
  for(let j=0;j<indices.length;j+=4){
    const n=new Vector3().fromArray(normals,j/4*3);
    if(indices[j]===id&&weights[j]>.95&&n.z<-.94)sum.add(n);
  }
  assert(sum.length()>30);
  return sum.normalize();
}
const palmNormals={L:palmSurface('L'),R:palmSurface('R')};
const dt=1/60;
for(const heading of [0,1,-1]) {
  model.rotation.y=0;
  for(const b of bones)b.quaternion.identity();
  const poseHands=handGestures(rig),controller=new motions.Controller();
  let worst=1,lowest=1,count=0;
  model.rotation.y=heading*Math.PI*.478;
  for(let i=0;i<202;i++){
    for(const b of bones)b.quaternion.identity();
    const input={mode:'wave',token:2,heading,speed:0,distance:0,gaze:{x:0,y:0}};
    const {params}=controller.update(dt,input);
    const {side,weight}=poseHands(input,model.rotation.y,0,1,params,dt);
    if(weight>.975){
      assert.equal(side,heading===1?'L':'R');
      const wrist=rig['Hand'+side];
      const q=wrist.getWorldQuaternion(new Quaternion());
      worst=Math.min(worst,palmNormals[side].clone().applyQuaternion(q).z);
      const tip=rig['FingerTip'+side+'2'].getWorldPosition(new Vector3());
      const base=rig['Finger'+side+'2'].getWorldPosition(new Vector3());
      lowest=Math.min(lowest,tip.sub(base).normalize().y);
      count++;
    }
  }
  assert(count>70&&worst>.90&&lowest>.86,JSON.stringify({heading,count,worst,lowest}));
  console.log('Wave',heading,count,'raised frames, minimum palm-to-view',worst.toFixed(3),'finger-up',lowest.toFixed(3));
}

for(const heading of [-1,1]) {
  model.rotation.y=0;
  for(const b of bones)b.quaternion.identity();
  const poseHands=handGestures(rig);
  model.rotation.y=heading*Math.PI*.478;
  poseHands({mode:'walk',heading,token:0},model.rotation.y,1,1,{ParamRotation_rightElbow:0},dt);
  for(const [l,s] of [['L',-1],['R',1]]){
    const normal=palmNormals[l].clone().applyQuaternion(rig['Hand'+l].getWorldQuaternion(new Quaternion()));
    const inward=new Vector3(-s,0,0).applyQuaternion(model.quaternion);
    assert(normal.dot(inward)>.84,'Walking palm must face its thigh');
  }
}
