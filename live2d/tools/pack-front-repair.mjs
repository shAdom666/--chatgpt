import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {readProject,writeProject} from './cubism-project.mjs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),scratch=path.join(root,'_build/front-fix'),out=path.join(root,'live2d/model/front-repair');
const original=await readProject(path.join(root,'live2d/model/GPTDragon.natural.cmo3')),lining=await readProject(path.join(scratch,'lining.cmo3'));
const oldContents=new Map(original.entries.map(e=>[e.path,e.content]));
const map=JSON.parse((await fs.readFile(path.join(scratch,'resources.json'),'utf8')).replace(/^\uFEFF/,''));
for(const entry of original.entries)if(map[entry.path])entry.content=await fs.readFile(map[entry.path]);
for(const entry of lining.entries)if(entry.path!=='main.xml')original.entries.push({...entry,path:'repair_back_'+entry.path.replaceAll('/','_')});
let xml=await fs.readFile(path.join(scratch,'repaired.xml'),'utf8');
const resourceBlocks=[...xml.matchAll(/<CImageResource [^>]*xs.id="[^"]+"[^>]*>[\s\S]*?<\/CImageResource>/g)].map(m=>m[0]),resource=id=>resourceBlocks.find(b=>b.includes('xs.id="'+id+'"')),entryFor=id=>original.entries.find(e=>e.path===resource(id).match(/path="([^"]+)"/)[1]);
const atlasBlock=xml.match(/<CTextureAtlas xs.id="[^"]+"[\s\S]*?<\/CTextureAtlas>/)[0],atlasResource=atlasBlock.match(/<CImageResource xs.n="cachedAtlasImage" xs.ref="([^"]+)"/)[1],atlasEntry=entryFor(atlasResource),atlas=await loadImage(atlasEntry.content),canvas=createCanvas(atlas.width,atlas.height),ctx=canvas.getContext('2d');ctx.drawImage(atlas,0,0);
const limits={dress_bodice:[369,575,666,792],dress_skirt:[52,786,934,1410],arm_left:[163,619,444,904],arm_right:[595,620,863,910]};
for(const [name,[x0,y0,x1,y1]] of Object.entries(limits)){
 const block=[...xml.matchAll(/<CModelImage modelImageVersion="0">[\s\S]*?<\/CModelImage>/g)].map(m=>m[0]).find(b=>b.includes('>'+name+'</s>')),guid=block.match(/<CModelImageGuid xs.n="guid" xs.ref="([^"]+)"/)[1],imageId=block.match(/<CImageResource xs.n="_filteredImage" xs.ref="([^"]+)"/)[1],imageEntry=entryFor(imageId);
 const tile=[...atlasBlock.matchAll(/<ModelImageEntry>[\s\S]*?<\/ModelImageEntry>/g)].map(m=>m[0]).find(b=>b.includes('xs.ref="'+guid+'"')),affine=tile.match(/<CAffine xs.n="atlasLocalToCanvasTransform"[^>]+/)[0],num=k=>Number(affine.match(new RegExp(k+'="([^"]+)"'))[1]),a=num('m00'),b=num('m01'),c=num('m02'),d=num('m10'),e=num('m11'),f=num('m12'),det=a*e-b*d;
 ctx.save();ctx.setTransform(e/det,-d/det,-b/det,a/det,(b*f-e*c)/det,(d*c-a*f)/det);ctx.beginPath();ctx.rect(x0,y0,x1-x0,y1-y0);ctx.clip();ctx.globalCompositeOperation='destination-out';ctx.drawImage(await loadImage(oldContents.get(imageEntry.path)),0,0);ctx.globalCompositeOperation='source-over';ctx.drawImage(await loadImage(imageEntry.content),0,0);ctx.restore();
}
atlasEntry.content=canvas.toBuffer('image/png');const atlasRB=resource(atlasResource);xml=xml.replace(atlasRB,atlasRB.replace(/imageFileBuf_size="\d+"/,'imageFileBuf_size="'+atlasEntry.content.length+'"'));
original.entries.find(e=>e.path==='main.xml').content=Buffer.from(xml);
const ids=new Set([...xml.matchAll(/xs.id="([^"]+)"/g)].map(m=>m[1]));for(const m of xml.matchAll(/xs.ref="([^"]+)"/g))if(!ids.has(m[1]))throw new Error('Dangling native reference '+m[1]);
await fs.mkdir(out,{recursive:true});await writeProject(path.join(out,'GPTDragon-front.cmo3'),original);console.log('Saved repaired authoring project; official Cubism export required');
