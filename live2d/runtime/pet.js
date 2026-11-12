/* Genuine Cubism Core model, mesh parameters and exported physics. */
const statusNode=document.getElementById('status');
const app=new PIXI.Application({resizeTo:window,backgroundAlpha:0,antialias:true,autoDensity:true,preserveDrawingBuffer:true,resolution:Math.min(window.devicePixelRatio||1,2)});
document.body.appendChild(app.view);window.PIXI=PIXI;
let model,mode='idle',direction=-1,modeStarted=performance.now()/1000,gaze={x:0,y:0},gx=0,gy=0,clicking=false;
const ranges={};let vertexSamples=[],frameCount=0,reported=false;
const start=performance.now();
const controller=new PetMotions.Controller();let lastParameterTime=performance.now(),currentPose={params:{},close:0,lift:0,offsetX:0,skirt:0},locomotion={speed:0,distance:0},actionToken=0;
let testing=false,showcase=false,testStarted=0,testDistance=0,previewModeAge=0;const capturedModes=new Set(),captureStats={},bodyMotion={},bodyBaselines={};
let previewRecorder,previewStream,previewChunks=[];
let sideviews,postures,postureDiagnostics={ready:false},sideDiagnostics={ready:false,loaded:[]},lastSideFrame=performance.now();
async function finishPreview(){if(!previewRecorder)return 0;await new Promise(resolve=>{previewRecorder.onstop=resolve;previewRecorder.stop();});previewStream.getTracks().forEach(t=>t.stop());return window.pet.previewVideo(await new Blob(previewChunks,{type:'video/webm'}).arrayBuffer());}
window.pet.onState(state=>{if(testing)return;if(state.mode!==mode||actionToken!==state.token){modeStarted=performance.now()/1000;mode=state.mode;actionToken=state.token;}direction=state.direction;});
window.pet.onGaze(value=>{if(testing)return;gaze=value;locomotion={speed:value.speed||0,distance:value.distance||0};});
function range(name,value){const r=ranges[name]||(ranges[name]=[value,value]);r[0]=Math.min(r[0],value);r[1]=Math.max(r[1],value);}
function fit(){if(!model)return;const size=Math.min((innerWidth-16)/1024,(innerHeight-28)/1359);model.anchor.set(0,0);model.pivot.set(512,1419);model.scale.set(size);model.position.set(innerWidth/2,innerHeight-9);if(sideviews)sideviews.fit();if(postures)postures.fit();}
function set(id,value){model.internalModel.coreModel.setParameterValueById(id,value);range(id,value);}
function renderDiagnostics(){
 const core=model.internalModel.coreModel,b=model.getBounds();
 const pixels=app.renderer.extract.pixels();let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>10)visible++;
 const vertexBounds=[];for(let i=0;i<core.getDrawableCount();i++){const v=core.getDrawableVertices(i);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let k=0;k<v.length;k+=2){x0=Math.min(x0,v[k]);x1=Math.max(x1,v[k]);y0=Math.min(y0,v[k+1]);y1=Math.max(y1,v[k+1]);}vertexBounds.push([x0,y0,x1,y1]);}
 return {visiblePixels:visible,bounds:{x:b.x,y:b.y,width:b.width,height:b.height},scale:model.scale.x,canvas:[app.renderer.width,app.renderer.height],textures:model.textures.map(t=>({valid:t.valid,width:t.width,height:t.height})),vertexBounds};
}
(async()=>{
 try{
  model=await PIXI.live2d.Live2DModel.from(await window.pet.modelUrl(),{autoInteract:false,autoUpdate:true});
  if(await window.pet.rigCheck()){window.pet.rigResult(auditRig(model.internalModel.coreModel));return;}
  testing=await window.pet.validation();showcase=await window.pet.showcase();controller.seed=testing?.37:Math.random();testStarted=performance.now();
  if(testing){previewStream=app.view.captureStream(60);previewRecorder=new MediaRecorder(previewStream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm',videoBitsPerSecond:showcase?1200000:2000000});previewRecorder.ondataavailable=e=>{if(e.data.size)previewChunks.push(e.data);};previewRecorder.start();}
  app.stage.addChild(model);fit();window.addEventListener('resize',fit);
  if(!testing){sideviews=new SideViews(app,model);try{sideDiagnostics=await sideviews.load();}catch(error){sideDiagnostics={ready:false,loaded:[],reason:'侧身模型加载失败：'+error.message};}if(!sideDiagnostics.ready){statusNode.textContent=sideDiagnostics.reason;setTimeout(()=>statusNode.hidden=true,10000);}}
  if(!testing){postures=new PetPostures.Views(app,model,sideviews);try{postureDiagnostics=await postures.load();}catch(error){postureDiagnostics={ready:false,reason:error.message};}if(!postureDiagnostics.ready){statusNode.textContent='姿势模型加载失败：'+postureDiagnostics.reason;statusNode.classList.add('error');}}
  // Our clock drives breathing and head motion; avoid adding the SDK demo sway twice.
  model.internalModel.breath.setParameters([]);
  const plan=showcase?PetMotions.showcase.map(id=>({id,duration:PetMotions.catalog[id].duration})):['idle','walk','wave','happy','sleep'].map(id=>({id,duration:2.2}));
  const testDuration=plan.reduce((sum,p)=>sum+p.duration,0);
  model.internalModel.on('afterMotionUpdate',()=>{
   const now=performance.now(),dt=Math.min(.06,(now-lastParameterTime)/1000);lastParameterTime=now;
   if(testing){
    let elapsed=(now-testStarted)/1000,entry=plan.at(-1);
    for(const candidate of plan){entry=candidate;if(elapsed<candidate.duration)break;elapsed-=candidate.duration;}
    mode=entry.id;previewModeAge=elapsed;gaze={x:Math.sin(now/1000*.4)*.35,y:.1};
    const speed=mode==='walk'?28:0;testDistance+=speed*dt;locomotion={speed,distance:testDistance};
   }
   currentPose=controller.update(dt,{mode,gaze,speed:locomotion.speed,distance:locomotion.distance,direction,token:testing?mode:actionToken});
   for(const [id,value] of Object.entries(currentPose.params)){
    if(id==='ParamRotation_leftElbow'||id==='ParamRotation_rightElbow'){range(id,value);continue;}
    set(id,value);
   }
  });
  model.internalModel.on('beforeModelUpdate',()=>{
   const core=model.internalModel.coreModel;
   // Physics owns the idle elbow sway. Add the deliberate gesture afterwards,
   // so a 100% physics output cannot erase the wave's elbow keyform.
   for(const id of ['ParamRotation_leftElbow','ParamRotation_rightElbow'])core.setParameterValueById(id,(currentPose.params[id]||0)+core.getParameterValueById(id)*.45);
   for(const id of ['ParamEyeLOpen','ParamEyeROpen'])core.setParameterValueById(id,core.getParameterValueById(id)*(1-currentPose.close));
   core.addParameterValueById('ParamSkirt',currentPose.skirt);
   range('applied_rightElbow',core.getParameterValueById('ParamRotation_rightElbow'));
   range('blinkL',core.getParameterValueById('ParamEyeLOpen'));
   range('blinkR',core.getParameterValueById('ParamEyeROpen'));
   for(const id of ['ParamHairFront','ParamHairBack','ParamSkirt'])range(id,core.getParameterValueById(id));
  });
  app.ticker.add(()=>{
   const nowSide=performance.now(),viewDt=(nowSide-lastSideFrame)/1000;if(sideviews?.ready)sideviews.update(viewDt,locomotion,gaze.heading||0);else model.alpha=1;if(postures)postures.update(viewDt,{mode,speed:locomotion.speed,heading:gaze.heading||0});lastSideFrame=nowSide;
   const ratio=innerWidth/320;model.position.set(innerWidth/2+currentPose.offsetX*ratio,innerHeight-9-currentPose.lift*ratio);
   frameCount++;
   if(testing&&frameCount%8===0){
    const core=model.internalModel.coreModel,ids=core.getDrawableIds(),ppu=core.getModel().canvasinfo.PixelsPerUnit;
    const baseline=bodyBaselines[mode]||(bodyBaselines[mode]=Array.from({length:core.getDrawableCount()},(_,i)=>Float32Array.from(core.getDrawableVertices(i))));
    const measured=bodyMotion[mode]||(bodyMotion[mode]={});
    for(const i of [3,4,5,6,7,8,9,14,15]){const v=core.getDrawableVertices(i);let movement=0;for(let k=0;k<v.length;k+=2)movement=Math.max(movement,Math.hypot(v[k]-baseline[i][k],v[k+1]-baseline[i][k+1])*ppu);measured[ids[i]]=Math.max(measured[ids[i]]||0,movement);}
   }
   const core=model.internalModel.coreModel;
   if(frameCount<60||frameCount%30===0){const sample=[];for(const [i,id] of ['face_base','dress_bodice','front_hair_center'].entries()){let index=core.getDrawableIndex(id);if(index<0)index=i;if(index<core.getDrawableCount())sample.push(...Array.from(core.getDrawableVertices(index)).slice(0,12));}vertexSamples.push(sample);}
  });
  app.renderer.on('postrender',async()=>{
   if(testing&&!capturedModes.has(mode)&&previewModeAge>(showcase?PetMotions.catalog[mode].previewAt:1.65)){capturedModes.add(mode);captureStats[mode]=renderDiagnostics().visiblePixels;window.pet.capture(mode,app.renderer.extract.canvas().toDataURL('image/png'));}
   if(!reported&&performance.now()-(testing?testStarted:start)>(testing?testDuration*1000:9000)){reported=true;const core=model.internalModel.coreModel,different=vertexSamples.some(v=>v.some((x,i)=>Math.abs(x-(vertexSamples[0]?.[i]||0))>.000001)),render=renderDiagnostics();const videoBytes=await finishPreview();window.pet.ready({ok:true,engine:'Live2D Cubism Core',drawableCount:core.getDrawableCount(),parameterCount:core.getParameterCount(),physicsLoaded:!!model.internalModel.physics,vertexMotionVerified:different,frames:frameCount,seconds:(performance.now()-(testing?testStarted:start))/1000,parameterRanges:ranges,render,captureStats,bodyMotion,videoBytes,controller:'quintic-keyposes-and-joint-springs'});}
  });
  if(testing||(sideDiagnostics.ready&&postureDiagnostics.ready)){statusNode.textContent='点我聊天 · 右键动作菜单';setTimeout(()=>statusNode.hidden=true,6000);}
  window.pet.ready({ok:true,engine:'Live2D Cubism Core',loaded:true,sideviews:sideDiagnostics,postures:postureDiagnostics,physicsLoaded:!!model.internalModel.physics,drawableCount:model.internalModel.coreModel.getDrawableCount()});
 }catch(error){statusNode.classList.add('error');statusNode.textContent='Live2D 加载失败：'+error.message;window.pet.ready({ok:false,error:error.message});}
})();
app.view.addEventListener('pointerdown',event=>{if(event.button!==0)return;clicking=true;app.view.setPointerCapture(event.pointerId);window.pet.dragStart();});
app.view.addEventListener('pointerup',async event=>{if(event.button!==0||!clicking)return;clicking=false;const click=await window.pet.dragEnd();if(click)window.pet.action('chat');});
function cancelDrag(){if(clicking){clicking=false;window.pet.dragCancel();}}
app.view.addEventListener('pointercancel',cancelDrag);app.view.addEventListener('lostpointercapture',cancelDrag);window.addEventListener('blur',cancelDrag);
app.view.addEventListener('contextmenu',event=>{event.preventDefault();window.pet.action('menu');});
document.addEventListener('pointermove',event=>{if(clicking||!model)return;const b=postures?.bounds()||(sideviews?.ready?sideviews.bounds():model.getBounds());const inside=event.clientX>=b.x&&event.clientX<=b.x+b.width&&event.clientY>=b.y&&event.clientY<=b.y+b.height;window.pet.clickThrough(!inside);});
