import {createAvatar} from './character.mjs';
const canvas=document.querySelector('canvas');
const input={mode:'idle',token:0,direction:1,heading:0,speed:0,distance:0,gazeX:0,gazeY:0};
window.pet.onState(s=>Object.assign(input,{mode:s.mode,token:s.token,direction:s.direction}));
window.pet.onGaze(g=>Object.assign(input,{heading:g.heading||0,speed:g.speed||0,distance:g.distance||0,gazeX:g.x||0,gazeY:g.y||0}));
const controller=new PetMotions.Controller();
let frame,drag=false,standing=true;
canvas.onpointerdown=e=>{if(e.button===0){drag=true;canvas.setPointerCapture(e.pointerId);window.pet.dragStart();}};
canvas.onpointerup=async e=>{if(e.button===0&&drag){drag=false;if(await window.pet.dragEnd())window.pet.action('chat');}};
function cancel(){if(drag){drag=false;window.pet.dragCancel();}}
canvas.onlostpointercapture=cancel;canvas.onpointercancel=cancel;window.addEventListener('blur',cancel);
canvas.oncontextmenu=e=>{e.preventDefault();window.pet.action('menu');};
document.onpointermove=e=>{if(!drag&&frame){const b=frame.bounds;window.pet.clickThrough(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom);}};
createAvatar(canvas).then(avatar=>{
  let last=performance.now();
  function draw(now){
    const dt=Math.min(.06,(now-last)/1000);last=now;
    const motion=controller.update(dt,{...input,gaze:{x:input.gazeX,y:input.gazeY}});
    frame=avatar.frame(dt,input,motion);
    if(frame.standing!==standing){standing=frame.standing;window.pet.postureStatus(standing);}
    requestAnimationFrame(draw);
  }
  draw(last);
  window.pet.ready({ok:true,loaded:true,engine:'Three.js',joints:avatar.joints});
}).catch(e=>{document.querySelector('output').textContent='3D 角色加载失败：'+e.message;window.pet.ready({ok:false,error:e.message});});
