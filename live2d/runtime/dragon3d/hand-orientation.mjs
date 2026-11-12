import {Matrix4,Quaternion,Vector3,MathUtils} from 'three';

const vec=(x=0,y=0,z=0)=>new Vector3(x,y,z);
const direction=vec(),normal=vec(),sideAxis=vec(),up=vec(),front=vec();
const desired=new Quaternion(),parent=new Quaternion(),rotation=new Quaternion(),basis=new Matrix4();

// Define a frame from a finger direction and the outward normal of its palm.
function frame(long,palm,out) {
  up.copy(long).normalize();
  sideAxis.crossVectors(up,palm).normalize();
  front.crossVectors(sideAxis,up).normalize();
  return out.setFromRotationMatrix(basis.makeBasis(sideAxis,up,front));
}

function orient(bone,long,palm,inverseBind,weight) {
  frame(long,palm,desired).multiply(inverseBind);
  bone.parent.getWorldQuaternion(parent).invert();
  bone.quaternion.slerp(desired.premultiply(parent),weight);
}

export function handGestures(bones) {
  const rig={};
  for(const [l,s] of [['L',-1],['R',1]]) {
    const arm=bones['Arm'+l],elbow=bones['Forearm'+l],hand=bones['Hand'+l];
    const joint=(name,i)=>bones[name+l+i].getWorldPosition(vec());
    const long=joint('FingerTip',2).sub(joint('Finger',2)).normalize();
    const wide=joint('Finger',4).sub(joint('Finger',1)).normalize();
    const palm=wide.cross(long).multiplyScalar(s).normalize();
    const palmFrame=frame(long,palm,new Quaternion()).invert();
    const forearm=hand.position.clone().normalize();
    rig[l]={arm,elbow,hand,long,palmFrame,forearm,forearmFrame:frame(forearm,palm,new Quaternion()).invert()};
  }
  let waving='R',lastToken,waveWeight=0;
  return function apply(input,facing,gait,freedom,params,dt) {
    if(input.mode==='wave'&&lastToken!==input.token) {
      // Choose the near arm when a wave starts during a turn, then keep it.
      waving=(Math.abs(input.heading)>.5?input.heading:facing)>.50?'L':'R';
      lastToken=input.token;
    }
    const bend=-params.ParamRotation_rightElbow;
    const lift=input.mode==='wave'?MathUtils.smoothstep(bend,4,43)*freedom*(1-gait):0;
    waveWeight=MathUtils.damp(waveWeight,lift,16,dt);
    for(const [l,s] of [['L',-1],['R',1]]) {
      const {arm,elbow,hand,long,palmFrame,forearm,forearmFrame}=rig[l];
      const wave=l===waving?waveWeight:0;
      const walking=Math.max(gait,Math.abs(Math.sin(facing)))*freedom*(1-wave);
      if(walking>.001) {
        // At the side of the thigh, turn the radius and wrist together.
        elbow.getWorldQuaternion(rotation);
        direction.copy(forearm).applyQuaternion(rotation);
        normal.set(-s,.04,.12).applyAxisAngle(Y,facing);
        orient(elbow,direction,normal,forearmFrame,.62*walking);
        hand.getWorldQuaternion(rotation);
        direction.copy(long).applyQuaternion(rotation);
        orient(hand,direction,normal,palmFrame,walking);
      }
      if(wave<.001)continue;
      const profile=Math.abs(Math.sin(facing));
      direction.set(s*(.92-.70*profile),.10,.40+.66*profile).normalize().applyAxisAngle(Y,facing);
      arm.parent.getWorldQuaternion(parent).invert();
      desired.setFromUnitVectors(up.copy(elbow.position).normalize(),direction.applyQuaternion(parent));
      arm.quaternion.slerp(desired,wave);
      const wrist=(params.ParamWristR||0)*Math.PI/180;
      direction.set(s*(.39-.22*profile+wrist*.20),.86,.19+.50*profile).normalize().applyAxisAngle(Y,facing);
      normal.set(s*.18,-.06,1);
      orient(elbow,direction,normal,forearmFrame,wave);
      const outward=MathUtils.lerp(s,Math.sign(facing),MathUtils.smoothstep(profile,.35,.93));
      direction.set(outward*(.16+wrist*1.5),1,.045).normalize();
      normal.set(-s*.055,.018,1);
      orient(hand,direction,normal,palmFrame,wave);
    }
    return {side:waving,weight:waveWeight};
  };
}
const Y=vec(0,1,0);
