import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createDeformation} from './posture-deformation.mjs';import {readProject} from './cubism-project.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),scratch=path.join(root,'_build/posture-fix');
const faces=JSON.parse(await fs.readFile(path.join(scratch,'detected.json'))),metadata=JSON.parse(await fs.readFile(path.join(root,'live2d/model/postures-repair/bounds.json'))),poses=['front',...metadata.poses.map(p=>p.id)],result={};
const xml=await fs.readFile(path.join(scratch,'original.xml'),'utf8');
for(const block of [...xml.matchAll(/<CWarpDeformerSource xs.id="[^"]+"[\s\S]*?<\/CWarpDeformerSource>/g)].map(m=>m[0])){
 const id=block.match(/<s xs.n="localName">([^<]+)<\/s>/)[1].replace(/ Warp$/,''),index=poses.indexOf(id),forms=[...block.matchAll(/<CWarpDeformerForm>[\s\S]*?<float-array xs.n="positions"[^>]*>([^<]+)<\/float-array>[\s\S]*?<\/CWarpDeformerForm>/g)].map(m=>m[1].trim().split(/\s+/).map(Number));
 if(index<1||forms.length!==3)throw new Error('Unexpected pose warp '+id);
 const previous=createDeformation(id,poses[index-1],faces),next=index<poses.length-1?createDeformation(id,poses[index+1],faces):(x,y)=>[x,y];
 result[id]=forms.map(base=>[-1,0,1].map(direction=>{if(!direction)return base;const transform=direction<0?previous:next,out=[];for(let i=0;i<base.length;i+=2)out.push(...transform(base[i],base[i+1]));return out;}));
}
const frontXML=await fs.readFile(path.join(root,'_build/front-fix/base-repaired.xml'),'utf8'),body=[...frontXML.matchAll(/<CWarpDeformerSource[^>]*>[\s\S]*?<\/CWarpDeformerSource>/g)].map(m=>m[0]).find(b=>b.includes('>Body Warp Z</s>'));
const arrays=[...body.matchAll(/<float-array xs.n="positions"[^>]*>([^<]+)<\/float-array>/g)].map(m=>m[1].trim().split(/\s+/).map(Number)),original=arrays[1],morph=createDeformation('front','half',faces),xs=original.filter((_,i)=>i%2===0),ys=original.filter((_,i)=>i%2),bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],base=[];
for(let r=0;r<=12;r++)for(let c=0;c<=8;c++)base.push(bounds[0]+(bounds[2]-bounds[0])*c/8,bounds[1]+(bounds[3]-bounds[1])*r/12);
result.front={col:8,row:12,bounds,base,prepared:base.map((_,i)=>{const k=i-i%2;return morph(base[k],base[k+1]-19)[i%2]+(i%2?19:0);})};
await fs.writeFile(path.join(scratch,'deformation-grids.json'),JSON.stringify(result));
await fs.writeFile(path.join(root,'live2d/source/postures/transitions.json'),JSON.stringify({method:'exclusive-keypose-handoff-with-native-deformation',poses,handoff:.5,faceLandmarks:Object.fromEntries(Object.entries(faces).map(([id,v])=>[id,v.face.center]))},null,2)+'\n');
console.log('Prepared continuous landmark grids for',poses.length,'poses; full-body alpha blending disabled');
