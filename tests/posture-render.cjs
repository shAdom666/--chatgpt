const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const output=path.join(root,'_build/posture-review');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',path.join(__dirname,'.posture-render-profile'));
app.whenReady().then(()=>{
 const w=new BrowserWindow({width:640,height:940,show:false,webPreferences:{offscreen:true,preload:path.join(__dirname,'posture-render-preload.cjs'),contextIsolation:true,sandbox:true}});w.webContents.setFrameRate(60);
 ipcMain.handle('pose:result',(_e,result)=>{fs.writeFileSync(path.join(__dirname,'posture-render.json'),JSON.stringify(result,null,2));app.exit(result.ok?0:1);});
 ipcMain.handle('pose:capture',(_e,{name,png})=>{if(!/^(half|crouch|reach|sit|elbow|lean|sleep|standing|handoff-\d+(?:-before)?)$/.test(name))throw new Error('Invalid pose');fs.writeFileSync(path.join(output,'posture-'+name+'.png'),Buffer.from(png.split(',')[1],'base64'));});
 ipcMain.handle('pose:video',(_e,value)=>{if(!(value instanceof ArrayBuffer)||value.byteLength>25000000)throw new Error('Invalid video');fs.writeFileSync(path.join(output,'posture-cycle.webm'),Buffer.from(value));return value.byteLength;});
 w.loadFile(path.join(__dirname,'posture-render.html'));setTimeout(()=>app.exit(2),45000);
});
