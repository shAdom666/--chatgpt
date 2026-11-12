// Author key-pose meshes and local breathing warps; export runtime in Cubism.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createCanvas,loadImage,Image} from '@napi-rs/canvas';
import {packCaff} from '../../third_party/stretchystudio/src/io/live2d/caffPacker.js';
import {prepareWriter} from './prepare-cubism-writer.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {generateCmo3}=await prepareWriter();
globalThis.OffscreenCanvas=(w,h)=>createCanvas(w,h);globalThis.Image=Image;
const src=path.join(root,'live2d/source/postures'),out=path.join(root,'live2d/model/postures');
await fs.mkdir(src,{recursive:true});await fs.mkdir(out,{recursive:true});
const target=path.join(out,'GPTDragon-postures.cmo3');
try{await fs.access(path.join(out,'GPTDragon-postures.moc3'));throw new Error('Preserve the exported authoring project; build drafts in a separate folder.');}catch(e){if(e.code!=='ENOENT')throw e;}
const images={half:'84373674-780a-4dd5-8e4b-d6ab03afbb82',crouch:'9b0b4092-6c68-4fe7-a11b-17f63dfd8bd7',sit:'46faa38c-5b3e-49fb-a022-892417f144b9',lean:'600d1f3e-f2d1-4ef2-a9e1-52aeb16fa193',sleep:'b55479ee-4c56-4a82-b990-de3606aa35d4'};
const generated=process.argv[2];
const meshes=[],warpDeformerNodes=[],tracks=[],bounds=[];
for(const [id,generatedId] of Object.entries(images)){
 const file=path.join(src,id+'.png');if(generated)await fs.copyFile(path.join(generated,'exec-'+generatedId+'.png'),file);
 const im=await loadImage(file),canvas=createCanvas(1024,1536),ctx=canvas.getContext('2d');ctx.drawImage(im,0,0,1024,1536);
 const pixels=ctx.getImageData(0,0,1024,1536).data;let x0=1024,y0=1536,x1=0,y1=0;
 for(let y=0;y<1536;y++)for(let x=0;x<1024;x++)if(pixels[(y*1024+x)*4+3]>18){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
 if(x1<=x0)throw new Error('Empty pose '+id);
 const groundShift=1400-y1;ctx.clearRect(0,0,1024,1536);ctx.drawImage(im,0,groundShift,1024,1536);y0+=groundShift;y1=1400;
 bounds.push({id,rect:[x0,y0,x1,y1],sourceGroundShift:groundShift});
 const col=8,row=10,vertices=[],triangles=[];
 for(let y=0;y<=row;y++)for(let x=0;x<=col;x++)vertices.push(x0+(x1-x0)*x/col,y0+(y1-y0)*y/row);
 for(let y=0;y<row;y++)for(let x=0;x<col;x++){const a=y*(col+1)+x,b=a+col+1;triangles.push(a,a+1,b,a+1,b+1,b);}
 meshes.push({name:id,partId:id,vertices,triangles,uvs:vertices.map((v,i)=>v/(i%2?1536:1024)),pngData:canvas.toBuffer('image/png'),texWidth:1024,texHeight:1536,warpDeformerParentId:id,warpDeformerParameterId:'ParamPostureBreath'});
 warpDeformerNodes.push({id,col,row,gridX:x0,gridY:y0,gridW:x1-x0,gridH:y1-y0});
 const keyframes=[0,1,2].map(k=>({time:k/2,value:Array.from({length:vertices.length/2},(_,i)=>{const x=vertices[i*2],y=vertices[i*2+1],weight=Math.max(0,Math.min(1,(1400-y)/600));return {x:x+(k-1)*(x-512)*.002*weight,y:y-(k-1)*2.5*weight};})}));
 tracks.push({nodeId:id,property:'mesh_verts',keyframes});
}
const result=await generateCmo3({canvasW:1024,canvasH:1536,meshes,parameters:[{id:'ParamPose',min:0,max:4,default:0},{id:'ParamPostureBreath',min:0,max:2,default:1}],warpDeformerNodes,animations:[{name:'Posture breathing',tracks}],modelName:'GPTDragon-postures',generateRig:false,generatePhysics:false});
const main=result.sourceFiles.find(e=>e.path==='main.xml');let xml=Buffer.from(main.content).toString('utf8');
const poseParam=[...xml.matchAll(/<CParameterSource>[\s\S]*?<\/CParameterSource>/g)].map(m=>m[0]).find(b=>b.includes('>ParamPose<'));
if(!poseParam)throw new Error('Pose parameter missing');
const poseGuid=poseParam.match(/<CParameterGuid xs.n="guid" xs.ref="([^"]+)"/)[1];
let serial=Math.max(...[...xml.matchAll(/xs.id="#(\d+)"/g)].map(m=>+m[1]))+1;
let shared='';
for(let index=0;index<meshes.length;index++){
 const name=meshes[index].name;
 const source=[...xml.matchAll(/<CArtMeshSource xs.id="[^"]+"[\s\S]*?<\/CArtMeshSource>/g)].map(m=>m[0]).find(b=>b.includes('<s xs.n="localName">'+name+'</s>'));
 if(!source)throw new Error('Mesh missing '+name);
 const gridId=source.match(/<KeyformGridSource xs.n="keyformGridSource" xs.ref="([^"]+)"/)[1];
 const grid=xml.match(new RegExp('<KeyformGridSource xs.id="'+gridId+'"[\\s\\S]*?<\\/KeyformGridSource>'))[0];
 const bindingId=grid.match(/<KeyformBindingSource xs.n="binding" xs.ref="([^"]+)"/)[1];
 const binding=xml.match(new RegExp('<KeyformBindingSource xs.id="'+bindingId+'"[\\s\\S]*?<\\/KeyformBindingSource>'))[0];
 const form=source.match(/<CArtMeshForm>[\s\S]*?<\/CArtMeshForm>/)[0],originalGuid=form.match(/<CFormGuid xs.n="guid" xs.ref="([^"]+)"/)[1];
 const template=grid.match(/<KeyformOnGrid>[\s\S]*?<\/KeyformOnGrid>/)[0];
 const guids=Array.from({length:5},(_,i)=>{if(i===0)return originalGuid;const number=serial++,guid='#'+number;shared+='<CFormGuid xs.id="'+guid+'" xs.idx="'+number+'" uuid="'+randomUUID()+'" note="'+name+'_pose_'+i+'"/>\n';return guid;});
 const forms=guids.map((g,i)=>form.replace('xs.ref="'+originalGuid+'"','xs.ref="'+g+'"').replace(/<f xs.n="opacity">[^<]+/, '<f xs.n="opacity">'+(i===index?'1.0':'0.0'))).join('');
 const newSource=source.replace(/<carray_list xs.n="keyforms" count="1">[\s\S]*?<\/carray_list>/,'<carray_list xs.n="keyforms" count="5">'+forms+'</carray_list>');
 const newGrid=grid.replace('keyformsOnGrid" count="1"','keyformsOnGrid" count="5"').replace(template,guids.map((g,i)=>template.replace('xs.ref="'+originalGuid+'"','xs.ref="'+g+'"').replace('<i xs.n="keyIndex">0</i>','<i xs.n="keyIndex">'+i+'</i>')).join(''));
 const newBinding=binding.replace(/<CParameterGuid xs.n="parameterGuid" xs.ref="[^"]+"/,'<CParameterGuid xs.n="parameterGuid" xs.ref="'+poseGuid+'"').replace(/<array_list xs.n="keys" count="1">[\s\S]*?<\/array_list>/,'<array_list xs.n="keys" count="5">'+[0,1,2,3,4].map(i=>'<f>'+i+'.0</f>').join('')+'</array_list>').replace('>ParamOpacity<','>ParamPose<');
 xml=xml.replace(source,newSource).replace(grid,newGrid).replace(binding,newBinding);
}
xml=xml.replace('</shared>',shared+'</shared>');main.content=Buffer.from(xml);
await fs.writeFile(target,await packCaff(result.sourceFiles,42));
await fs.writeFile(path.join(out,'bounds.json'),JSON.stringify({canvas:[1024,1536],anchor:[512,1400],poses:bounds},null,2)+'\n');
console.log('Authored 5 pose meshes with shared pose opacity and breathing warps:',target);
