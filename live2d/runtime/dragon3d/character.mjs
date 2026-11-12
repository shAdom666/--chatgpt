import {accessoryCollisions} from './collisions.mjs';
import * as T from 'three';
import {handGestures} from './hand-orientation.mjs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const clamp=T.MathUtils.clamp;
const smooth=(a,b,t)=>T.MathUtils.smoothstep(t,a,b);
const axis=new T.Euler();
const deltaRotation=new T.Quaternion();

function rotate(bone,x,y,z) {
  bone.quaternion.multiply(deltaRotation.setFromEuler(axis.set(x,y,z)));
}

// Track extremal vertices per bone. Ground and viewport follow the deformed
// character even while the pelvis is rolling onto its side.
function silhouetteSamples(meshes) {
  const directions=[];
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)
    if(x||y||z)directions.push(new T.Vector3(x,y,z).normalize());
  const samples=[];
  for(const mesh of meshes) {
    const {position,skinIndex}=mesh.geometry.attributes;
    const groups=new Map(),v=new T.Vector3();
    for(let i=0;i<position.count;i++) {
      const bone=skinIndex.getX(i);
      if(!groups.has(bone))groups.set(bone,directions.map(()=>({dot:-Infinity,index:0})));
      const choices=groups.get(bone);
      v.fromBufferAttribute(position,i);
      directions.forEach((dir,k)=>{
        const dot=v.dot(dir);
        if(dot>choices[k].dot)choices[k]={dot,index:i};
      });
    }
    const indices=new Set([...groups.values()].flat().map(c=>c.index));
    samples.push({mesh,indices:[...indices]});
  }
  return samples;
}

export async function createAvatar(canvas) {
  const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setClearColor(0,0);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  const scene=new T.Scene(), camera=new T.OrthographicCamera(-1,1,1,-1,.01,30);
  camera.position.set(0,1.05,7);
  camera.lookAt(0,1.05,0);
  scene.add(new T.HemisphereLight(0xfffaff,0xe1cbe5,1.25));
  const light=new T.DirectionalLight(0xfff4e9,1.28);
  light.position.set(-2,4,3);scene.add(light);
  const rim=new T.DirectionalLight(0xddd0ff,.58);rim.position.set(2,2,-3);scene.add(rim);
  const asset=await new GLTFLoader().loadAsync('pet://app/model/dragon3d/Dragon.glb');
  const model=asset.scene, bones={}, meshes=[];
  const shade=new T.DataTexture(new Uint8Array([125,161,203,244]),4,1,T.RedFormat);
  shade.minFilter=shade.magFilter=T.NearestFilter;shade.needsUpdate=true;
  model.traverse(o=>{
    if(o.isBone)bones[o.name]=o;
    if(!o.isSkinnedMesh)return;
    const source=o.material;
    o.material=new T.MeshToonMaterial({color:source.color,map:source.map,gradientMap:shade,
      alphaTest:source.alphaTest,vertexColors:source.vertexColors,side:T.DoubleSide});
    // Match the illustration's soft, violet contact shadows on the sculpted parts.
    const fabric=['PearlKid','Ribbon','RosePetal','SleeveLining','SilkBrocade','Nail','VioletWelt','Heel','StrapEdge'].includes(source.name);
    const skin=source.name==='LimbSkin'||source.name==='HandSkin';
    if(skin||fabric||source.map||source.name==='skin'){
      const shading=skin?'limb':fabric?'silk':'paint';
      const draped=['SilkBrocade','Ribbon','SleeveLining','TrainBack','EmbroideredOverskirt'].includes(source.name);
      const first=o.skeleton.bones.findIndex(b=>b.name==='Drape00_00');
      const last=o.skeleton.bones.findIndex(b=>b.name==='Drape08_23');
      o.material.customProgramCacheKey=()=>shading+(draped?'Drape':'');
      o.material.onBeforeCompile=shader=>{
        const shade=shading==='paint'?'outgoingLight = mix(diffuseColor.rgb, outgoingLight, 0.20);':`
          vec3 n = normalize(normal);
          float lightBand = smoothstep(-0.52, 0.80, dot(n, normalize(vec3(-0.42, 0.58, 0.68))));
          float edge = pow(1.0-clamp(abs(n.z),0.0,1.0), 2.6);
          vec3 shaded = diffuseColor.rgb * mix(${skin?'vec3(.76,.55,.55)':'vec3(.59,.45,.70)'}, vec3(1.035,1.006,1.025), lightBand);
          outgoingLight = mix(shaded, shaded*${skin?'vec3(.74,.57,.62)':'vec3(.59,.43,.70)'}, edge);
        `;
        let output=shade;
        if(draped&&first>=0){
          // The skirt uses translation controls. Recover its posed surface normal
          // from the rasterised triangle, including the sewn-in folds in the inset.
          shader.vertexShader='varying float vCloth;\n'+shader.vertexShader.replace('#include <skinning_vertex>',
            `#include <skinning_vertex>\n vCloth=step(${first}.0,skinIndex.x)*step(skinIndex.x,${last}.0);`);
          shader.fragmentShader='varying float vCloth;\n'+shader.fragmentShader;
          const folded=`vec3 clothNormal=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));
            float clothLight=smoothstep(-.55,.85,dot(clothNormal,normalize(vec3(-.40,.72,.57))));
            outgoingLight*=mix(vec3(1.),mix(vec3(.76,.67,.81),vec3(1.035,1.02,1.035),clothLight),vCloth);`;
          output+='\n'+folded;
        }
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',output+'\n#include <opaque_fragment>');
      };
    }
    o.frustumCulled=false;
    meshes.push(o);
  });
  const placement=new T.Group();placement.add(model);scene.add(placement);
  const mixer=new T.AnimationMixer(model);
  const track=name=>{
    const action=mixer.clipAction(T.AnimationClip.findByName(asset.animations,name));
    action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;
    return action;
  };
  const posture=track('StandToCurledSleep'), stride=track('Stride');
  const samples=silhouetteSamples(meshes);
  const point=new T.Vector3(),box=new T.Box3();
  const solveAccessories=accessoryCollisions(bones),foot=new T.Vector3();
  const jointRest=Object.values(bones).map(b=>[b,b.quaternion.clone()]);
  const orientHands=handGestures(bones);
  const secondary=new Map();
  let progress=0,time=0,gait=0,facing=0,worldWidth=1.5,visibleBounds;
  const look=new T.Vector2();
  function spring(key,target,dt){
    const state=secondary.get(key)||{x:target,v:0};
    const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
    for(let i=0;i<steps;i++){
      state.v+=((target-state.x)*86-state.v*13)*h;state.x+=state.v*h;
    }
    secondary.set(key,state);return state.x;
  }
  function frame(dt,input,motion) {
    dt=clamp(dt,0,.06);time+=dt;
    const target=input.mode==='sleep'?6:input.mode==='crouch'?2:0;
    if(progress>0||target===0||(Math.abs(input.speed)<.15&&Math.abs(input.heading)<.04))
      progress+=clamp(target-progress,-dt*1.55,dt*1.65);
    const standing=progress<.0001;
    gait=T.MathUtils.damp(gait,standing?clamp(input.speed/18,0,1):0,12,dt);
    facing=T.MathUtils.damp(facing,clamp(input.heading,-1,1)*Math.PI*.478,12,dt);
    model.rotation.y=facing;
    for(const [b,q] of jointRest)b.quaternion.copy(q);
    stride.time=(input.distance/49)%1;stride.weight=gait;
    posture.time=progress;posture.weight=1-gait;
    mixer.update(0);
    for(const [b,q] of jointRest)q.copy(b.quaternion);
    const freedom=1-smooth(0,1.9,progress),sleep=smooth(4.5,5.9,progress);
    const p=motion.params,rad=Math.PI/180;
    look.lerp(new T.Vector2(input.gazeX,input.gazeY),1-Math.exp(-5*dt));
    rotate(bones.Head,freedom*(-look.y*.09-p.ParamAngleY*rad*.35),
      freedom*((look.x*.18+p.ParamAngleX*rad*.6)*(1-.75*Math.abs(Math.sin(facing)))-.095*Math.sin(facing)),freedom*p.ParamAngleZ*rad*.7);
    rotate(bones.Chest,.019*Math.sin(time*1.9),0,freedom*p.ParamBodyAngleZ*rad*.65);
    const gesture=input.mode==='stretch'||input.mode==='shrug'||input.mode==='tidy';
    for(const [l,side] of [['L',-1],['R',1]]) {
      const arm=input.mode==='wave'&&l==='R'?0:p['ParamRotation_arm'+(side<0?'Left':'Right')]*rad;
      const bend=input.mode==='wave'&&l==='R'?0:p['ParamRotation_'+(side<0?'leftElbow':'rightElbow')]*rad;
      const strength=freedom*(1-gait);
      rotate(bones['Arm'+l],gesture?-.45*Math.abs(arm)*strength:0,0,-arm*strength*2);
      rotate(bones['Forearm'+l],-.4*Math.abs(bend)*strength,0,-bend*strength);
      if(input.mode!=='wave')rotate(bones['Hand'+l],0,0,(p['ParamWrist'+l]||0)*rad*strength);
      const blink=Math.max(0,1-Math.abs(time%3.9-3.6)/.11);
      const closed=Math.max(sleep,blink,motion.close||0);
      bones['Eye'+l].scale.setScalar(closed>.88?.0001:1);
      bones['Eye'+l].scale.y=Math.max(.0001,1-closed);
      bones['Lid'+l].scale.setScalar(closed>.88?1:.0001);
    }
    const wave=orientHands(input,facing,gait,freedom,p,dt);
    for(const [l,side] of [['L',-1],['R',1]]) {
      const opening=l===wave.side?wave.weight:0;
      for(let i=0;i<5;i++){
        const curl=(.12+.038*i+.040*Math.sin(time*1.3+i*.27))*(1-opening);
        rotate(bones['Finger'+l+i],curl*freedom,0,side*opening*(i-2)*.041);
        rotate(bones['FingerTip'+l+i],curl*.49*freedom,0,0);
        rotate(bones['Distal'+l+i],curl*.25*freedom,0,0);
      }
    }
    for(let i=0;i<11;i++) {
      bones['Curl'+i].scale.y=1-.14*smooth(0,2,progress);
      const target=.024*Math.sin(time*1.6+i*.46)+gait*.11*Math.sin(stride.time*2*Math.PI)-.21*(input.heading-facing/(Math.PI*.478));
      rotate(bones['Curl'+i],0,0,spring('curl'+i,target,dt));
    }
    for(let i=0;i<6;i++)
      rotate(bones['Tail'+i],0,spring('tail'+i,(.044+.05*gait)*Math.sin(time*1.7-i*.4),dt),0);
    // Drape translations are keyed to the same clip time as both legs.
    // Evaluate contacts before the final ground placement. At full side rest
    // the body supports its own weight; ankles cease to define the floor.
    placement.position.set(0,0,0);
    scene.updateMatrixWorld(true);
    const floor=Math.min(bones.FootL.getWorldPosition(foot).y,bones.FootR.getWorldPosition(foot).y)-.095;
    solveAccessories(floor-.9*smooth(2.5,5,progress));
    placement.position.set(0,0,0);
    scene.updateMatrixWorld(true);
    box.makeEmpty();
    for(const {mesh,indices} of samples){
      for(const index of indices){
        mesh.getVertexPosition(index,point).applyMatrix4(mesh.matrixWorld);
        box.expandByPoint(point);
      }
    }
    const w=canvas.clientWidth||320,h=canvas.clientHeight||470,ratio=w/h;
    const minWidth=Math.max(2.24*ratio,box.max.x-box.min.x+.16);
    worldWidth=Math.max(minWidth,T.MathUtils.damp(worldWidth,minWidth,6,dt));
    const height=worldWidth/ratio,ground=.035;
    placement.position.x=-(box.min.x+box.max.x)/2;
    placement.position.y=ground-box.min.y+Math.max(0,motion.lift||0)*.006*freedom;
    camera.position.y=height/2;
    camera.left=-worldWidth/2;camera.right=worldWidth/2;camera.top=height/2;camera.bottom=-height/2;
    camera.updateProjectionMatrix();
    if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
    renderer.render(scene,camera);
    visibleBounds={left:(box.min.x+placement.position.x)/worldWidth*w+w/2,
      right:(box.max.x+placement.position.x)/worldWidth*w+w/2,
      top:h-(box.max.y+placement.position.y)/height*h,bottom:h-ground/height*h};
    return {standing,progress,facing,bounds:visibleBounds,triangles:renderer.info.render.triangles};
  }
  return {frame,joints:Object.keys(bones).length};
}
