// Neutral-pose layer QA before the official Cubism render check.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createCanvas,loadImage} from '@napi-rs/canvas';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),data=JSON.parse(await fs.readFile(path.join(root,'live2d/source/layers.json'))),canvas=createCanvas(1024,1536),ctx=canvas.getContext('2d');
ctx.fillStyle='#e8e3ed';ctx.fillRect(0,0,1024,1536);
const fixed=new Set(['arm_left','arm_right','dress_bodice','dress_skirt']);
for(const layer of [...data.layers,{name:'dress_lining',drawOrder:55,bounds:[52,786,934,1410]}].sort((a,b)=>a.drawOrder-b.drawOrder)){
 const file=fixed.has(layer.name)||layer.name==='dress_lining'?'live2d/source/front-repair/'+layer.name+'.png':'live2d/source/'+layer.file;
 const im=await loadImage(path.join(root,file)),[x0,y0,x1,y1]=layer.bounds;ctx.save();ctx.beginPath();ctx.rect(x0-2,y0-2,x1-x0+4,y1-y0+4);ctx.clip();ctx.drawImage(im,0,0);ctx.restore();
}
await fs.writeFile(path.join(root,'_build/front-fix/layer-assembly.png'),canvas.toBuffer('image/png'));console.log('Neutral repaired layer assembly saved');
