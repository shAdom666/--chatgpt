// Crop the existing, registered facial features without changing their artwork.
const fs=require('node:fs'), path=require('node:path');
const {createCanvas,loadImage}=require('../live2d/tools/node_modules/@napi-rs/canvas');
const source=path.join(__dirname,'../live2d/source/layers');
async function crop(name,files,rect){
 const [x,y,w,h]=rect,canvas=createCanvas(w,h),ctx=canvas.getContext('2d');
 for(const file of files) ctx.drawImage(await loadImage(path.join(source,file+'.png')),-x,-y);
 fs.writeFileSync(path.join(__dirname,'textures',name+'.png'),canvas.toBuffer('image/png'));
}
(async()=>{
 for(const side of ['l','r']) await crop('eye_'+side,['eye_white_'+side,'iris_'+side,'eyelash_'+side],side==='l'?[378,393,125,100]:[548,393,117,100]);
})();