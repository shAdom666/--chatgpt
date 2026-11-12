// Landmark motion is shared by outgoing and incoming key poses. Only one
// pose is rendered; deformation brings its joints to the handoff contacts.
export const anatomy={
 front:{neck:[512,548],shoulderL:[415,631],shoulderR:[624,631],waist:[512,776],hip:[520,940],handL:[250,811],handR:[795,821],kneeL:[450,1141],kneeR:[585,1201],footL:[440,1400],footR:[590,1400],angle:0},
 half:{neck:[625,747],shoulderL:[485,790],shoulderR:[700,800],waist:[570,1010],hip:[590,1120],handL:[555,1060],handR:[685,1060],kneeL:[570,1230],kneeR:[670,1230],footL:[520,1400],footR:[680,1400],angle:0},
 crouch:{neck:[610,885],shoulderL:[500,935],shoulderR:[725,945],waist:[595,1090],hip:[600,1220],handL:[580,1100],handR:[705,1110],kneeL:[620,1180],kneeR:[750,1190],footL:[535,1400],footR:[635,1400],angle:0},
 reach:{neck:[570,885],shoulderL:[425,1000],shoulderR:[660,950],waist:[560,1110],hip:[650,1250],handL:[300,1360],handR:[720,1110],kneeL:[705,1180],kneeR:[775,1260],footL:[625,1375],footR:[860,1345],angle:-4},
 sit:{neck:[570,945],shoulderL:[460,1010],shoulderR:[690,1020],waist:[540,1160],hip:[565,1280],handL:[290,1360],handR:[710,1170],kneeL:[740,1280],kneeR:[800,1310],footL:[840,1380],footR:[905,1385],angle:0},
 elbow:{neck:[435,1148],shoulderL:[350,1170],shoulderR:[555,1100],waist:[565,1260],hip:[730,1300],handL:[260,1120],handR:[530,1310],kneeL:[760,1320],kneeR:[880,1325],footL:[845,1385],footR:[920,1385],angle:-14},
 lean:{neck:[410,1175],shoulderL:[350,1210],shoulderR:[535,1155],waist:[595,1235],hip:[730,1280],handL:[280,1360],handR:[245,1190],kneeL:[780,1320],kneeR:[900,1320],footL:[830,1385],footR:[895,1385],angle:-14},
 sleep:{neck:[410,1200],shoulderL:[410,1240],shoulderR:[500,1185],waist:[630,1220],hip:[780,1230],handL:[250,1280],handR:[230,1220],kneeL:[660,1305],kneeR:[760,1330],footL:[735,1360],footR:[800,1375],angle:-24}
};
export function createDeformation(source,target,faces,amount=.5){
 // A monotone centerline keeps the layered dress and head from folding over
 // themselves during large silhouette changes. Each side reaches the same
 // face/neck/waist contact heights at the exclusive handoff.
 const sourceBody=anatomy[source],targetBody=anatomy[target],sourceFace=faces[source].face.center,targetFace=faces[target].face.center;
 const sourcePoints=[sourceFace,sourceBody.neck,sourceBody.waist,sourceBody.hip,[512,1400]],targetPoints=[targetFace,targetBody.neck,targetBody.waist,targetBody.hip,[512,1400]];
 const destinations=sourcePoints.map((p,i)=>[p[0]+(targetPoints[i][0]-p[0])*amount,p[1]+(targetPoints[i][1]-p[1])*amount]);
 for(let i=1;i<sourcePoints.length;i++)if(sourcePoints[i][1]<=sourcePoints[i-1][1]||destinations[i][1]<=destinations[i-1][1])throw new Error('Unordered posture contacts '+source+' -> '+target);
 return (x,y)=>{let i=0;while(i<sourcePoints.length-1&&y>sourcePoints[i+1][1])i++;
  if(y<=sourcePoints[0][1])return [x+destinations[0][0]-sourcePoints[0][0],y+destinations[0][1]-sourcePoints[0][1]];
  if(i===sourcePoints.length-1)return [x,y];
  const u=(y-sourcePoints[i][1])/(sourcePoints[i+1][1]-sourcePoints[i][1]),dx0=destinations[i][0]-sourcePoints[i][0],dx1=destinations[i+1][0]-sourcePoints[i+1][0];
  return [x+dx0+(dx1-dx0)*u,destinations[i][1]+(destinations[i+1][1]-destinations[i][1])*u];
 };
}
