import {Vector3,Quaternion,MathUtils} from 'three';

// Push an accessory's end point outside the moving body capsules. Solve in
// parent space so turning the whole character does not alter the response.
export function accessoryCollisions(bones) {
  const point=new Vector3(),closest=new Vector3(),axis=new Vector3(),normal=new Vector3();
  const inverse=new Quaternion(),start=new Vector3(),desired=new Vector3(),rotation=new Quaternion();
  const identity=new Quaternion();
  const chains=[];
  for(let i=0;i<11;i++)chains.push({bone:bones['Curl'+i],end:new Vector3(0,-.53,-.02),radius:.055});
  const segments=[['ThighL','ShinL',.085],['ThighR','ShinR',.085],['ShinL','FootL',.06],
    ['ShinR','FootR',.06],['Hips','Chest',.15]].map(([a,b,r])=>({a:bones[a],b:bones[b],r,from:new Vector3(),to:new Vector3()}));
  return function solve(floor) {
    for(const c of segments){c.a.getWorldPosition(c.from);c.b.getWorldPosition(c.to);}
    for(const c of chains){
      const bone=c.bone;
      bone.getWorldPosition(start);
      point.copy(c.end);bone.localToWorld(point);desired.copy(point);
      for(const s of segments){
        axis.subVectors(s.to,s.from);
        const t=MathUtils.clamp(normal.subVectors(desired,s.from).dot(axis)/Math.max(axis.lengthSq(),1e-8),0,1);
        closest.copy(s.from).addScaledVector(axis,t);normal.subVectors(desired,closest);
        const d=normal.length(),limit=c.radius+s.r;
        if(d<limit&&d>.00001)desired.addScaledVector(normal,(limit-d)/d);
      }
      desired.y=Math.max(floor+c.radius,desired.y);
      if(point.distanceToSquared(desired)<1e-7)continue;
      bone.parent.getWorldQuaternion(inverse).invert();
      point.sub(start).applyQuaternion(inverse).normalize();
      desired.sub(start).applyQuaternion(inverse).normalize();
      rotation.setFromUnitVectors(point,desired);
      const angle=2*Math.acos(MathUtils.clamp(rotation.w,-1,1));
      if(angle>.42) rotation.slerp(identity,1-.42/angle);
      bone.quaternion.premultiply(rotation);
    }
  };
}
