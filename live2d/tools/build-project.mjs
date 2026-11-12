import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, Image, ImageData, loadImage } from '@napi-rs/canvas';
import agPsd from 'ag-psd';
import { generateCmo3 } from '../../third_party/stretchystudio/src/io/live2d/cmo3writer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'live2d/source');
const output = path.join(root, 'live2d/model');
const data = JSON.parse(await fs.readFile(path.join(source, 'layers.json')));
await fs.mkdir(output, { recursive: true });
// Canvas/Image shims let the upstream authoring library measure the actual alpha
// contours for eye closure and body proportions in this offline Node build.
const blobs = new Map(); let serial = 0;
globalThis.URL.createObjectURL = blob => { const url = 'blob:rig-'+serial++; blobs.set(url,blob); return url; };
globalThis.URL.revokeObjectURL = url => blobs.delete(url);
globalThis.Image = class extends Image {
  set src(value) {
    if (blobs.has(value)) blobs.get(value).arrayBuffer().then(b => { super.src = Buffer.from(b); });
    else super.src = value;
  }
  get src() { return super.src; }
};
globalThis.OffscreenCanvas = function(w,h) { return createCanvas(w,h); };
agPsd.initializeCanvas(createCanvas, (w,h) => new ImageData(w,h));

const group = (id, parent, x, y, role=id) => ({ id, name:id, parent, boneRole:role, transform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1,pivotX:x,pivotY:y} });
const groups = [
 group('body', null,512,800,'root'), group('head','body',512,547,'head'),
 group('armLeft','body',415,650,'leftArm'), group('armRight','body',624,650,'rightArm'),
 group('leftElbow','armLeft',319,757,'leftElbow'), group('rightElbow','armRight',710,757,'rightElbow'),
 group('legLeft',null,455,935,'leftLeg'), group('legRight',null,582,1070,'rightLeg'),
 group('wingLeft','body',413,650,'wing'), group('wingRight','body',610,650,'wing'),
 group('tail','body',830,1030,'tail'),
];
const meshes=[]; const psdLayers=[];
for (const layer of data.layers) {
  const pngData = await fs.readFile(path.join(source,layer.file));
  const img = await loadImage(pngData);
  const [x0,y0,x1,y1] = layer.bounds;
  const canvas = createCanvas(x1-x0,y1-y0); canvas.getContext('2d').drawImage(img,-x0,-y0);
  psdLayers.unshift({name:layer.name+' ['+layer.tag+']',left:x0,top:y0,canvas});
  meshes.push({...layer,partId:layer.name,parentGroupId:layer.group,pngData,texWidth:1024,texHeight:1536,
    uvs:layer.vertices.map((v,i)=>v/(i%2===0?1024:1536))});
}
console.log('Writing editable PSD...');
const psd = agPsd.writePsdBuffer({width:1024,height:1536,children:psdLayers},{generateThumbnail:true});
await fs.writeFile(path.join(source,'GPTDragon.layers.psd'),psd);
if(process.argv.includes('--psd-only')){console.log('PSD refreshed without changing the open Cubism project');process.exit(0);}
console.log('Building',meshes.length,'meshes with native alpha contours...');
const result = await generateCmo3({canvasW:1024,canvasH:1536,meshes,groups,modelName:'GPTDragon',generateRig:true,generatePhysics:true});
await fs.writeFile(path.join(output,'GPTDragon.cmo3'),result.cmo3);
await fs.writeFile(path.join(output,'GPTDragon.rig.log.json'),JSON.stringify(result.rigDebugLog,null,2));
await fs.writeFile(path.join(output,'deformer-parameters.json'),JSON.stringify(Object.fromEntries(result.deformerParamMap),null,2));
await fs.copyFile(path.join(root,'third_party/stretchystudio/LICENSE'),path.join(output,'StretchyStudio-LICENSE.txt'));
await fs.writeFile(path.join(output,'authoring-provenance.json'),JSON.stringify({tool:'StretchyStudio',revision:'24a83a27ba43e43e9d2e3de5e33994594e6199c2',license:'MIT',model:'GPTDragon',meshes:meshes.length,generatedBy:'build-project.mjs',status:'authoring project; runtime export and visual validation still required'},null,2));
console.log('Saved',path.join(output,'GPTDragon.cmo3'),result.cmo3.length,'bytes');
console.log('Physics:',result.rigDebugLog.physics,'Warnings:',result.rigDebugLog.warnings);
