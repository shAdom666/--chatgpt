import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createCanvas,loadImage,Image} from '@napi-rs/canvas';import {prepareWriter} from './prepare-cubism-writer.mjs';import {readProject} from './cubism-project.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'live2d/source/front-repair'),scratch=path.join(root,'_build/front-fix');await fs.mkdir(out,{recursive:true});await fs.mkdir(scratch,{recursive:true});
const generated=process.argv[2];
const input={arms:'021c8298-29ac-4484-9a1c-ac951959b24a',skirtBack:'98c78001-544a-449a-a6a9-3a31e5863fd0',skirtFront:'a745f932-9195-4ab5-8acf-9431bb036dfc',bodice:'60efef0b-b7fc-4649-8b5f-761a18ef21f4'};
if(generated)for(const [name,id] of Object.entries(input))await fs.copyFile(path.join(generated,'exec-'+id+'.png'),path.join(out,name+'-raw.png'));
const records=[];
async function register(name,file,target,half){const im=await loadImage(path.join(out,file)),c=createCanvas(1024,1536),ctx=c.getContext('2d');ctx.drawImage(im,0,0,1024,1536);const p=ctx.getImageData(0,0,1024,1536).data;let x0=1024,y0=1536,x1=0,y1=0;
 for(let y=0;y<1536;y++)for(let x=half==='right'?512:0;x<(half==='left'?512:1024);x++)if(p[(y*1024+x)*4+3]>18){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
 const [tx0,ty0,tx1,ty1]=target;ctx.clearRect(0,0,1024,1536);ctx.drawImage(im,x0,y0,x1-x0,y1-y0,tx0,ty0,tx1-tx0,ty1-ty0);await fs.writeFile(path.join(out,name+'.png'),c.toBuffer('image/png'));records.push({name,source:[x0,y0,x1,y1],target});return c.toBuffer('image/png');}
await register('arm_left','arms-raw.png',[163,619,444,904],'left');await register('arm_right','arms-raw.png',[595,620,863,910],'right');
await register('dress_bodice','bodice-raw.png',[415,561,620,792]);
// Keep the original collar, embroidery and waist contacts over the cleaned
// underpaint. Shoulder roses belong only to the moving arm layers.
const bodice=createCanvas(1024,1536),bc=bodice.getContext('2d');bc.drawImage(await loadImage(path.join(out,'dress_bodice.png')),0,0);
const originalTorso=createCanvas(1024,1536),tc=originalTorso.getContext('2d');tc.drawImage(await loadImage(path.join(root,'live2d/source/layers/dress_bodice.png')),0,0);tc.clearRect(369,620,76,90);tc.clearRect(592,620,76,90);bc.drawImage(originalTorso,0,0);await fs.writeFile(path.join(out,'dress_bodice.png'),bodice.toBuffer('image/png'));
await register('dress_skirt','skirtFront-raw.png',[52,740,934,1410]);const back=await register('dress_lining','skirtBack-raw.png',[52,740,934,1410]);
await fs.writeFile(path.join(out,'registration.json'),JSON.stringify(records,null,2)+'\n');
// Produce a complete native resource graph for an independent back lining mesh.
globalThis.OffscreenCanvas=(w,h)=>createCanvas(w,h);globalThis.Image=Image;
const data=JSON.parse(await fs.readFile(path.join(root,'live2d/source/layers.json'))),skirt=data.layers.find(l=>l.name==='dress_skirt');
const {generateCmo3}=await prepareWriter();const result=await generateCmo3({canvasW:1024,canvasH:1536,modelName:'Front lining',generateRig:false,generatePhysics:false,meshes:[{...skirt,name:'dress_lining',partId:'dress_lining',parentGroupId:undefined,pngData:back,texWidth:1024,texHeight:1536,uvs:skirt.vertices.map((v,i)=>v/(i%2?1536:1024))}]});
await fs.writeFile(path.join(scratch,'lining.cmo3'),result.cmo3);await fs.writeFile(path.join(scratch,'lining.xml'),result.sourceFiles.find(e=>e.path==='main.xml').content);
console.log('Registered front repair assets and authored a back lining mesh');
