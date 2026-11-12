const {app,BrowserWindow,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path');
const folder=path.join(__dirname,'../_build/front-review');fs.mkdirSync(folder,{recursive:true});
app.setPath('userData',path.join(folder,'profile'));
app.whenReady().then(()=>{const w=new BrowserWindow({width:640,height:940,show:false,webPreferences:{offscreen:true,preload:path.join(__dirname,'front-review-preload.cjs'),contextIsolation:true,sandbox:true}});w.webContents.setFrameRate(60);
 ipcMain.handle('front:capture',(_e,{name,png,info})=>{if(!/^[a-z0-9-]+$/.test(name))throw new Error('Invalid name');fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(png.split(',')[1],'base64'));fs.writeFileSync(path.join(folder,name+'.json'),JSON.stringify(info,null,2));});
 ipcMain.handle('front:done',(_e,value)=>{fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(value,null,2));app.exit(value.ok?0:1);});
 w.loadFile(path.join(__dirname,'front-review.html'));setTimeout(()=>app.exit(2),30000);
});
