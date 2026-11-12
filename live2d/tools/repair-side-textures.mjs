// Replace a registered body underpaint and recompose its existing atlas region.
// Mesh topology, warp keyforms and the officially exported MOC3 stay unchanged.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import JSZip from 'jszip';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {packCaff} from '../../third_party/stretchystudio/src/io/live2d/caffPacker.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
async function unpack(file){
 const b=await fs.readFile(file);if(b.toString('ascii',0,4)!=='CAFF')throw new Error('Not a Cubism project');
 let p=14;const key=b.readInt32BE(p);p=54;
 const i32=()=>{const v=b.readInt32BE(p)^key;p+=4;return v;},byte=()=>b[p++]^(key&255);
 const mask=key<0?BigInt.asUintN(64,BigInt(key)):((BigInt(key)<<32n)|BigInt(key));
 const i64=()=>{const v=b.readBigUInt64BE(p)^mask;p+=8;return Number(v);};
 const string=()=>{let n=0,k;do{k=byte();n=(n<<7)|(k&127);}while(k&128);const s=Buffer.from(b.subarray(p,p+n));p+=n;for(let i=0;i<n;i++)s[i]^=key&255;return s.toString('utf8');};
 const entries=[],n=i32();for(let i=0;i<n;i++){const e={path:string(),tag:string(),start:i64(),size:i32(),obfuscated:byte(),compress:byte()};p+=8;entries.push(e);}
 for(const e of entries){if(e.size===0){e.content=Buffer.alloc(0);e.compress=16;continue;}let d=Buffer.from(b.subarray(e.start,e.start+e.size));if(e.obfuscated)for(let i=0;i<d.length;i++)d[i]^=key&255;
  if(e.compress!==16&&e.compress!==32){try{const z=await JSZip.loadAsync(d);d=await Object.values(z.files).find(f=>!f.dir).async('nodebuffer');}catch(error){if(d.length<30||d.readUInt32LE(0)!==0x04034b50)throw new Error('Unsupported entry '+e.path+' size '+e.size+' compression '+e.compress+' header '+d.subarray(0,8).toString('hex'));const start=30+d.readUInt16LE(26)+d.readUInt16LE(28),size=d.readUInt32LE(18);d=inflateRawSync(d.subarray(start,size?start+size:undefined));}}
  e.content=d;e.compress=33;
 }
 return {entries,key};
}
for(const side of ['left','right']){
 const folder=path.join(root,'live2d/model/sideviews'),file=path.join(folder,'GPTDragon-side-'+side+'.cmo3');
 const {entries,key}=await unpack(file),main=entries.find(e=>e.path==='main.xml');let xml=main.content.toString('utf8');
 const imageBlock=[...xml.matchAll(/<CModelImage modelImageVersion="0">[\s\S]*?<\/CModelImage>/g)].map(m=>m[0]).find(b=>b.includes('<s xs.n="name">'+side+'_body</s>'));
 if(!imageBlock)throw new Error('Body model image missing');
 const guid=imageBlock.match(/<CModelImageGuid xs.n="guid" xs.ref="([^"]+)"/)[1],resource=imageBlock.match(/<CImageResource xs.n="_filteredImage" xs.ref="([^"]+)"/)[1];
 const resources=[...xml.matchAll(/<CImageResource [^>]*xs.id="[^"]+"[^>]*>[\s\S]*?<\/CImageResource>/g)].map(m=>m[0]);
 const resourceBlock=resources.find(b=>b.includes('xs.id="'+resource+'"')),sourcePath=resourceBlock.match(/path="([^"]+)"/)[1];
 const atlasBlock=xml.match(/<CTextureAtlas xs.id="[^"]+"[\s\S]*?<\/CTextureAtlas>/)[0],atlasResource=atlasBlock.match(/<CImageResource xs.n="cachedAtlasImage" xs.ref="([^"]+)"/)[1];
 const atlasResourceBlock=resources.find(b=>b.includes('xs.id="'+atlasResource+'"')),atlasPath=atlasResourceBlock.match(/path="([^"]+)"/)[1];
 const entry=[...atlasBlock.matchAll(/<ModelImageEntry>[\s\S]*?<\/ModelImageEntry>/g)].map(m=>m[0]).find(b=>b.includes('xs.ref="'+guid+'"'));
 const affine=entry.match(/<CAffine xs.n="atlasLocalToCanvasTransform"[^>]+/)[0];
 const number=k=>Number(affine.match(new RegExp(k+'="([^"]+)"'))[1]);
 const a=number('m00'),b=number('m01'),c=number('m02'),d=number('m10'),e=number('m11'),f=number('m12'),det=a*e-b*d;
 const sourceEntry=entries.find(e=>e.path===sourcePath),atlasEntry=entries.find(e=>e.path===atlasPath);
 const oldBody=await loadImage(sourceEntry.content),atlas=await loadImage(atlasEntry.content),body=await loadImage(path.join(root,'live2d/source/sideviews',side+'-body-repaired.png'));
 if(body.width!==1024||body.height!==1536)throw new Error('Underpaint must retain registered canvas size');
 const canvas=createCanvas(atlas.width,atlas.height),ctx=canvas.getContext('2d');ctx.drawImage(atlas,0,0);
 ctx.setTransform(e/det,-d/det,-b/det,a/det,(b*f-e*c)/det,(d*c-a*f)/det);
 ctx.globalCompositeOperation='destination-out';ctx.drawImage(oldBody,0,0);ctx.globalCompositeOperation='source-over';ctx.drawImage(body,0,0);
 sourceEntry.content=await fs.readFile(path.join(root,'live2d/source/sideviews',side+'-body-repaired.png'));
 const changedResources=[[resourceBlock,sourceEntry.content]];
 // The generated limb sheet has neighboring thigh pixels underneath the hand
 // in the rectangular crop. Trim only that neighboring tile, retaining fingers.
 if(side==='left')for(const [name,cut] of [['farArm',[310,965,100,45]],['nearArm',[420,965,45,60]]]){
  const block=[...xml.matchAll(/<CModelImage modelImageVersion="0">[\s\S]*?<\/CModelImage>/g)].map(m=>m[0]).find(b=>b.includes('<s xs.n="name">left_'+name+'</s>'));
  const armGuid=block.match(/<CModelImageGuid xs.n="guid" xs.ref="([^"]+)"/)[1],armResource=block.match(/<CImageResource xs.n="_filteredImage" xs.ref="([^"]+)"/)[1];
  const rb=resources.find(b=>b.includes('xs.id="'+armResource+'"')),armEntry=entries.find(e=>e.path===rb.match(/path="([^"]+)"/)[1]);
  const old=await loadImage(armEntry.content),isolated=createCanvas(1024,1536),ic=isolated.getContext('2d');ic.drawImage(old,0,0);ic.clearRect(...cut);
  const armAtlas=[...atlasBlock.matchAll(/<ModelImageEntry>[\s\S]*?<\/ModelImageEntry>/g)].map(m=>m[0]).find(b=>b.includes('xs.ref="'+armGuid+'"'));
  const at=armAtlas.match(/<CAffine xs.n="atlasLocalToCanvasTransform"[^>]+/)[0],num=k=>Number(at.match(new RegExp(k+'="([^"]+)"'))[1]);
  const aa=num('m00'),bb=num('m01'),cc=num('m02'),dd=num('m10'),ee=num('m11'),ff=num('m12'),detArm=aa*ee-bb*dd;
  ctx.setTransform(ee/detArm,-dd/detArm,-bb/detArm,aa/detArm,(bb*ff-ee*cc)/detArm,(dd*cc-aa*ff)/detArm);
  ctx.globalCompositeOperation='destination-out';ctx.drawImage(old,0,0);ctx.globalCompositeOperation='source-over';ctx.drawImage(isolated,0,0);
  armEntry.content=isolated.toBuffer('image/png');changedResources.push([rb,armEntry.content]);
 }
 atlasEntry.content=canvas.toBuffer('image/png');
 for(const [block,data] of [...changedResources,[atlasResourceBlock,atlasEntry.content]])xml=xml.replace(block,block.replace(/imageFileBuf_size="\d+"/,'imageFileBuf_size="'+data.length+'"'));
 main.content=Buffer.from(xml,'utf8');
 await fs.writeFile(file.replace('.cmo3','.repaired.cmo3'),await packCaff(entries,key));
 // The runtime texture uses the same atlas mapping as the saved project.
 const manifest=JSON.parse(await fs.readFile(path.join(folder,'GPTDragon-side-'+side+'.model3.json'),'utf8'));
 const target=path.resolve(folder,manifest.FileReferences.Textures[0]);
 if(!target.startsWith(folder+path.sep))throw new Error('Invalid atlas path');
 // Editor caches use straight alpha; SDK exports have the checked
 // premultiplied-alpha option. Preserve that runtime texture convention.
 const runtime=createCanvas(atlas.width,atlas.height),runtimeCtx=runtime.getContext('2d'),pixels=ctx.getImageData(0,0,atlas.width,atlas.height);
 for(let i=0;i<pixels.data.length;i+=4){const alpha=pixels.data[i+3]/255;pixels.data[i]=Math.round(pixels.data[i]*alpha);pixels.data[i+1]=Math.round(pixels.data[i+1]*alpha);pixels.data[i+2]=Math.round(pixels.data[i+2]*alpha);}
 runtimeCtx.putImageData(pixels,0,0);await fs.writeFile(target,runtime.toBuffer('image/png'));
 console.log('Repaired registered body and atlas for',side);
}
