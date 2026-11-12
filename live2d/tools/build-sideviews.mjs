// Generate editable Cubism side-view projects. Runtime .moc3 files are exported
// by the official Editor, never synthesized or patched by this script.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createCanvas,loadImage,Image} from '@napi-rs/canvas';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
// The pinned upstream writer normalizes auto-rigged meshes, but omits that
// conversion for explicitly authored native warp groups. Apply a local adapter
// while keeping the upstream source unchanged and the fix reproducible.
const writerPath=path.join(root,'third_party/stretchystudio/src/io/live2d/cmo3writer.js');
let writer=await fs.readFile(writerPath,'utf8');
const edits=[
 ['const nativeWarpGroups = new Map();','const nativeWarpBboxes = new Map();\n  const nativeWarpGroups = new Map();'],
 ['// Rest grid using native col/row dimensions','for (const pm of members) nativeWarpBboxes.set(meshes[pm.mi].partId, { gridMinX: bboxMinX, gridMinY: bboxMinY, gridW: bboxW, gridH: bboxH });\n    // Rest grid using native col/row dimensions'],
 ['const rwBox = rigWarpBbox.get(partId);','const rwBox = rigWarpBbox.get(partId) || nativeWarpBboxes.get(partId);'],
 ["const emitArtMeshForm = (kfList, formGuidPid, positions, opacity = 1.0) => {", "const [meshFormCoordNode, meshFormCoordPid] = x.shared('CoordType');\n    x.sub(meshFormCoordNode, 's', { 'xs.n': 'coordName' }).text = rwBox ? 'DeformerLocal' : 'Canvas';\n    const emitArtMeshForm = (kfList, formGuidPid, positions, opacity = 1.0) => {"],
 ["x.subRef(adf, 'CoordType', pidCoord, { 'xs.n': 'coordType' });", "x.subRef(adf, 'CoordType', meshFormCoordPid, { 'xs.n': 'coordType' });"]
];
for(const [from,to] of edits){if(!writer.includes(from))throw new Error('Pinned writer adapter mismatch: '+from);writer=writer.replace(from,to);}
const adaptedPath=writerPath.replace('.js','-sideviews.js');await fs.writeFile(adaptedPath,writer);
const {generateCmo3}=await import(pathToFileURL(adaptedPath).href);
const src=path.join(root,'live2d/source/sideviews'),out=path.join(root,'live2d/model/sideviews');
await fs.mkdir(out,{recursive:true});
for(const side of ['left','right']){try{await fs.access(path.join(out,'GPTDragon-side-'+side+'.moc3'));throw new Error('Preserve official Editor projects; generate new drafts in a separate model folder.');}catch(e){if(e.code!=='ENOENT')throw e;}}
globalThis.OffscreenCanvas=(w,h)=>createCanvas(w,h);globalThis.Image=Image;
const W=1024,H=1536;
const configs={
 right:{sign:1,body:'right-body-repaired.png',limbs:'right-limbs.png',back:'right-back.png',
  nearArm:[405,580,602,1006],farArm:[610,625,785,1006],nearLeg:[550,1000,733,1420],farLeg:[400,1000,550,1420],
  wing:[145,565,485,900],tail:[25,930,355,1270]},
 left:{sign:-1,body:'left-body-repaired.png',limbs:'left-limbs.png',back:'left-back.png',
  nearArm:[420,575,595,1000],farArm:[230,620,405,985],nearLeg:[240,968,412,1420],farLeg:[412,968,565,1420],
  wing:[530,560,875,900],tail:[630,935,985,1270]}
};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
async function layer(file,rect,cut){
 const im=await loadImage(path.join(src,file)),c=createCanvas(W,H),ctx=c.getContext('2d');
 if(rect){const [x,y,x1,y1]=rect;ctx.drawImage(im,x,y,x1-x,y1-y,x,y,x1-x,y1-y);}else ctx.drawImage(im,0,0,W,H);
 if(cut)ctx.clearRect(...cut);
 const d=ctx.getImageData(0,0,W,H).data;let x0=W,y0=H,x1=0,y1=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(d[(y*W+x)*4+3]>18){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
 if(x1<=x0)throw new Error('Empty source layer '+file);
 return {pngData:c.toBuffer('image/png'),bounds:[x0,y0,x1,y1]};
}
function grid(bounds,col=4,row=14){
 const [x0,y0,x1,y1]=bounds,vertices=[],triangles=[];
 for(let y=0;y<=row;y++)for(let x=0;x<=col;x++)vertices.push(x0+(x1-x0)*x/col,y0+(y1-y0)*y/row);
 for(let y=0;y<row;y++)for(let x=0;x<col;x++){const a=y*(col+1)+x,b=a+col+1;triangles.push(a,a+1,b,a+1,b+1,b);}
 return {vertices,triangles,col,row};
}
const manifest={version:1,canvas:[W,H],cycleDistance:29,views:{},authoring:'Export side-left and side-right from the official Cubism Editor.'};
for(const [side,cfg] of Object.entries(configs)){
 const meshes=[],tracks=[],parameters=[],warpDeformerNodes=[],composition=createCanvas(W,H),ctx=composition.getContext('2d');
 const specs=[['tail',cfg.back,cfg.tail,'ParamTail'],['wing',cfg.back,cfg.wing,'ParamWing'],
  ['farLeg',cfg.limbs,cfg.farLeg,'ParamStrideFar'],['nearLeg',cfg.limbs,cfg.nearLeg,'ParamStrideNear'],
  ['farArm',cfg.limbs,cfg.farArm,'ParamArmFar'],['body',cfg.body,null,'ParamBodySway'],['nearArm',cfg.limbs,cfg.nearArm,'ParamArmNear']];
 for(const [name,file,rect,pid] of specs){
  const cut=side==='left'?(name==='farArm'?[310,965,100,45]:name==='nearArm'?[420,965,45,60]:null):null;
  const l=await layer(file,rect,cut),g=grid(l.bounds),id=side+'_'+name;
  const m={name:id,partId:id,vertices:g.vertices,triangles:g.triangles,uvs:g.vertices.map((v,i)=>v/(i%2?H:W)),
   pngData:l.pngData,texWidth:W,texHeight:H,warpDeformerParentId:id,warpDeformerParameterId:pid};
  meshes.push(m);ctx.drawImage(await loadImage(l.pngData),0,0);
  warpDeformerNodes.push({id,col:g.col,row:g.row,gridX:l.bounds[0],gridY:l.bounds[1],gridW:l.bounds[2]-l.bounds[0],gridH:l.bounds[3]-l.bounds[1]});
  const isLeg=name.endsWith('Leg'),keys=isLeg?17:3,max=keys-1;
  parameters.push({id:pid,min:0,max,default:isLeg?0:1});
  const keyframes=[];
  for(let k=0;k<keys;k++){
   const p=k/max,u=p<.62?p/.62:(p-.62)/.38,dx=cfg.sign*(p<.62?29-58*u:-29+58*smooth(u)),lift=p<.62?0:36*Math.sin(Math.PI*u)**1.6;
   const value=[];
   for(let i=0;i<g.vertices.length;i+=2){
    let x=g.vertices[i],y=g.vertices[i+1];
    if(isLeg){const t=Math.max(0,Math.min(1,(y-1000)/350));x+=dx*smooth(t)+cfg.sign*lift*.55*Math.sin(Math.PI*t);y-=lift*smooth(t);}
    else if(name.endsWith('Arm')){const pivotX=(l.bounds[0]+l.bounds[2])/2,pivotY=l.bounds[1]+30,a=(k-1)*.11,rx=x-pivotX,ry=y-pivotY;x=pivotX+rx*Math.cos(a)-ry*Math.sin(a);y=pivotY+rx*Math.sin(a)+ry*Math.cos(a);}
    else if(name==='body'){const weight=1-smooth((y-800)/600);x+=(k-1)*3*weight;y+=(k-1)*2*weight;}
    else {const weight=name==='tail'?smooth((y-960)/260):smooth(Math.abs(x-650)/360);x+=(k-1)*5*weight;y+=(k-1)*4*weight;}
    value.push({x,y});
   }
   keyframes.push({time:p,value});
  }
  tracks.push({nodeId:id,property:'mesh_verts',keyframes});
 }
 const result=await generateCmo3({canvasW:W,canvasH:H,meshes,parameters,warpDeformerNodes,animations:[{name:'Side gait',tracks}],modelName:'GPTDragon-side-'+side,generateRig:false,generatePhysics:false});
 await fs.writeFile(path.join(out,'GPTDragon-side-'+side+'.cmo3'),result.cmo3);
 await fs.writeFile(path.join(src,side+'-assembled.png'),composition.toBuffer('image/png'));
 manifest.views[side]={model:'sideviews/GPTDragon-side-'+side+'.model3.json',soles:1400,headTop:58,anchor:[512,1400],parameters:parameters.map(p=>p.id),meshCount:meshes.length};
 console.log('Built',side,result.cmo3.length,'bytes;',parameters.length+1,'parameters;',meshes.length,'meshes');
}
await fs.writeFile(path.join(root,'live2d/model/sideviews.json'),JSON.stringify(manifest,null,2)+'\n');
