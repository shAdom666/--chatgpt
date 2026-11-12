const assert=require('node:assert/strict');
const {advance}=require('../live2d/runtime/walker.cjs');
let checks=0;
for(const hz of [30,60,120,144,240])for(const direction of [-1,1]){
 let s={x:500,v:0,vRate:0,direction,turns:0};let previous=s.x;
 for(let i=0;i<hz*4;i++){s=advance(s,1/hz,direction*28,0,1000,true);assert((s.x-previous)*direction>=-1e-10);assert.equal(s.direction,direction);assert.equal(s.turns,0);previous=s.x;}
 assert(Math.abs(s.x-500)>95);
 for(let i=0;i<hz*2;i++)s=advance(s,1/hz,0,0,1000,false);
 assert.equal(s.direction,direction);assert.equal(s.turns,0);assert(Math.abs(s.v)<.001);checks++;
}
for(const direction of [-1,1]){
 let s={x:direction<0?.001:999.999,v:direction*28,vRate:0,direction,turns:0};
 for(let i=0;i<60;i++)s=advance(s,1/60,s.direction*28,0,1000,true);
 assert.equal(s.turns,1);assert.equal(s.direction,-direction);checks++;
}
let narrow=advance({x:10,v:2,vRate:0,direction:1,turns:0},1/60,28,-500,-500,true);
assert.equal(narrow.x,-500);assert.equal(narrow.turns,0);assert.equal(narrow.v,0);checks++;
console.log('PASS '+checks+' Live2D movement regressions (30–240 Hz, smooth stopping, real walls, narrow display)');
const {dock,settle}=require('../live2d/runtime/desktop.cjs');
assert.deepEqual(dock({x:0,y:0,width:1707,height:1020},{width:320,height:470}),{x:1363,y:538});
assert.deepEqual(dock({x:-1920,y:-200,width:1920,height:1080},{width:320,height:470}),{x:-344,y:398});
assert.deepEqual(dock({x:0,y:0,width:200,height:300},{width:320,height:470}),{x:0,y:0});
for(const hz of [30,60,120,144,240]){let y=200;for(let i=0;i<hz;i++){const next=settle(y,800,1/hz);assert(next>=y&&next<=800);y=next;}assert.equal(y,800);}
console.log('PASS bottom-right placement, negative monitor origins, small work area and frame-independent landing');
