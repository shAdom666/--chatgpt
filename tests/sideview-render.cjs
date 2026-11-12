const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
app.setPath('userData',path.join(__dirname,'.side-render-profile'));
app.whenReady().then(()=>{
 const w=new BrowserWindow({width:640,height:940,show:false,webPreferences:{offscreen:true,preload:path.join(__dirname,'sideview-render-preload.cjs'),contextIsolation:true,sandbox:true}});
 w.webContents.setFrameRate(60);
 w.webContents.on('console-message',(_e,d)=>{if(d.level>=2)process.stderr.write(d.message+'\n');});
 ipcMain.handle('side:result',(_e,result)=>{
  fs.writeFileSync(path.join(__dirname,'sideview-render.json'),JSON.stringify(result,null,2));
  app.exit(result.ok?0:1);
 });
 ipcMain.handle('side:capture',(_e,{side,png})=>{
  if(!['left','right'].includes(side))throw new Error('Invalid view');
  fs.writeFileSync(path.join(root,'live2d/preview','side-'+side+'.png'),Buffer.from(png.split(',')[1],'base64'));
 });
 ipcMain.handle('side:video',(_e,buffer)=>{if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>20000000)throw new Error('Invalid video');fs.writeFileSync(path.join(root,'live2d/preview/side-walk-turn.webm'),Buffer.from(buffer));return buffer.byteLength;});
 w.loadFile(path.join(__dirname,'sideview-render.html'));setTimeout(()=>app.exit(2),35000);
});
