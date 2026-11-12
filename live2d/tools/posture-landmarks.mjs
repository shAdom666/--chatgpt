import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createCanvas,loadImage} from '@napi-rs/canvas';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'_build/posture-fix');await fs.mkdir(out,{recursive:true});
const metadata=JSON.parse(await fs.readFile(path.join(root,'live2d/model/postures-repair/bounds.json'))),layers=JSON.parse(await fs.readFile(path.join(root,'live2d/source/layers.json')));
const faces={};
for(const pose of [{id:'front',sourceGroundShift:-19},...metadata.poses]){
 const image=await loadImage(path.join(root,pose.id==='front'?'live2d/source/layers/face_base.png':'live2d/source/postures/'+pose.id+'.png'));
 const c=createCanvas(1024,1536),ctx=c.getContext('2d');
 if(pose.id==='front'){for(const layer of [...layers.layers].sort((a,b)=>a.drawOrder-b.drawOrder))ctx.drawImage(await loadImage(path.join(root,'live2d/source',layer.file)),0,-19,1024,1536);}else ctx.drawImage(image,0,pose.sourceGroundShift||0,1024,1536);
 const pixels=ctx.getImageData(0,0,1024,1536).data,mask=new Uint8Array(1024*1536),queue=new Int32Array(mask.length),components=[];
 for(let i=0;i<mask.length;i++){const p=i*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];if(pixels[p+3]>100&&r>150&&g>70&&r>g*1.025&&r>b*.985)mask[i]=1;}
 for(let i=0;i<mask.length;i++)if(mask[i]){let first=0,last=1,count=0,x0=1024,y0=1536,x1=0,y1=0,sx=0,sy=0;queue[0]=i;mask[i]=0;
  while(first<last){const index=queue[first++],x=index%1024,y=Math.floor(index/1024);count++;sx+=x;sy+=y;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);for(const next of [x>0?index-1:-1,x<1023?index+1:-1,y>0?index-1024:-1,y<1535?index+1024:-1])if(next>=0&&mask[next]){mask[next]=0;queue[last++]=next;}}
  if(count>3000)components.push({area:count,rect:[x0,y0,x1,y1],center:[sx/count,sy/count]});
 }
 components.sort((a,b)=>a.rect[1]-b.rect[1]);if(!components.length)throw new Error('No face landmarks '+pose.id);faces[pose.id]={face:components[0],skinComponents:components};
 ctx.strokeStyle='#ef5170';ctx.lineWidth=4;ctx.strokeRect(components[0].rect[0],components[0].rect[1],components[0].rect[2]-components[0].rect[0],components[0].rect[3]-components[0].rect[1]);await fs.writeFile(path.join(out,pose.id+'-landmarks.png'),c.toBuffer('image/png'));
}
await fs.writeFile(path.join(out,'detected.json'),JSON.stringify(faces,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(faces).map(([id,v])=>[id,v.face])),null,2));
