// Parameterize each painted row of the original opaque fabric so the print
// follows the circumference, including the back, without projecting a sprite.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('../live2d/tools/node_modules/@napi-rs/canvas');
async function unwrap(name,file,top,bottom,hair=false) {
  const image=await loadImage(path.join(__dirname,'../live2d/source',file));
  const src=createCanvas(image.width,image.height).getContext('2d');src.drawImage(image,0,0);
  const pixels=src.getImageData(0,0,image.width,image.height).data;
  const w=384,h=320,canvas=createCanvas(w,h),ctx=canvas.getContext('2d'),out=ctx.createImageData(w,h);
  let last=[];
  for(let y=0;y<h;y++){
    const row=Math.round(top+(bottom-top)*y/(h-1)),xs=[];
    for(let x=0;x<image.width;x++){
      const at=(row*image.width+x)*4;
      if(pixels[at+3]>218&&(!hair||pixels[at+2]>=pixels[at]))xs.push(at);
    }
    if(xs.length<4)xs.push(...last);else last=xs;
    for(let x=0;x<w;x++){
      const t=.5+.48*Math.sin(2*Math.PI*x/(w-1));
      const at=xs[Math.round((xs.length-1)*t)],dst=(y*w+x)*4;
      const strength=name==='bodice'?.87:name==='gown'?.23:.11;
      const base=name==='locks'?[202,177,235]:[249,232,254];
      const flow=x/w*2*Math.PI+.48*Math.sin(y/h*Math.PI*1.5);
      const streak=name==='locks'?10*Math.sin(3*flow)+7*Math.cos(5*flow):4*Math.sin(9*flow);
      for(let k=0;k<3;k++)out.data[dst+k]=(at==null?base[k]:pixels[at+k])*strength+(base[k]+streak)*(1-strength);
      out.data[dst+3]=255;
    }
  }
  ctx.putImageData(out,0,0);fs.writeFileSync(path.join(__dirname,'textures',name+'.png'),canvas.toBuffer('image/png'));
}
(async()=>{
  await unwrap('gown','front-repair/dress_skirt.png',785,1360);
  await unwrap('bodice','front-repair/dress_bodice.png',600,775);
  await unwrap('locks','layers/front_hair_left.png',247,642,true);
})();