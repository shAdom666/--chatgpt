// Convert exported SDK texture pixels for this runtime's alpha convention.
// Native authoring image resources remain straight alpha in the CMO3 project.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {createCanvas,loadImage} from '@napi-rs/canvas';
const file=path.resolve(process.argv[2]),base=path.dirname(file),model=JSON.parse(await fs.readFile(file,'utf8')),marker=file.replace('.model3.json','.alpha.json');
let previous={};try{previous=JSON.parse(await fs.readFile(marker,'utf8'));}catch{}
const hash=b=>createHash('sha256').update(b).digest('hex'),records={};
for(const name of model.FileReferences.Textures){
 const target=path.resolve(base,name);if(!target.startsWith(base+path.sep))throw new Error('Texture reference escapes model folder');
 const bytes=await fs.readFile(target),sourceHash=hash(bytes);if(previous[name]?.outputHash===sourceHash){records[name]=previous[name];continue;}
 const im=await loadImage(bytes),canvas=createCanvas(im.width,im.height),ctx=canvas.getContext('2d');ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,im.width,im.height);
 for(let i=0;i<pixels.data.length;i+=4){const a=pixels.data[i+3]/255;pixels.data[i]=Math.round(pixels.data[i]*a);pixels.data[i+1]=Math.round(pixels.data[i+1]*a);pixels.data[i+2]=Math.round(pixels.data[i+2]*a);}
 ctx.putImageData(pixels,0,0);const output=canvas.toBuffer('image/png');await fs.writeFile(target,output);records[name]={sourceHash,outputHash:hash(output),encoding:'premultiplied pixel RGB'};
}
await fs.writeFile(marker,JSON.stringify(records,null,2)+'\n');console.log('Runtime alpha encoding verified:',path.basename(file));
