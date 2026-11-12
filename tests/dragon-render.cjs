const {app,BrowserWindow,ipcMain,protocol,net}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'_build','dragon-review');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',path.join(out,'profile'));
protocol.registerSchemesAsPrivileged([{scheme:'pet',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
app.whenReady().then(async()=>{
  protocol.handle('pet',r=>{
    const url=new URL(r.url),file=path.resolve(root,'live2d','.'+decodeURIComponent(url.pathname));
    if(url.hostname!=='app'||!file.startsWith(path.join(root,'live2d')+path.sep))return new Response('',{status:403});
    return net.fetch(pathToFileURL(file).href);
  });
  const w=new BrowserWindow({show:false,width:480,height:690,transparent:true,frame:false,webPreferences:{
    offscreen:true,preload:path.join(root,'live2d/runtime/preload.cjs'),sandbox:true,contextIsolation:true,backgroundThrottling:false}});
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const ready=new Promise(r=>ipcMain.once('pet:ready',(_e,v)=>r(v)));
  const statuses=[];ipcMain.on('pet:posture-status',(_e,v)=>statuses.push(v));
  const renderErrors=[];
  w.webContents.on('console-message',(_e,d)=>{if(d.level==='error'){renderErrors.push(d.message);console.error(d.message);}});
  await w.loadURL('pet://app/runtime/dragon3d.html');
  const result=await ready;if(!result.ok)throw Error(result.error);
  await w.webContents.executeJavaScript(`{
    const stream=document.querySelector('canvas').captureStream(25);
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:1800000});
    const chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);
    window.finishVideo=()=>new Promise(resolve=>{
      recorder.onstop=()=>{
        stream.getTracks().forEach(track=>track.stop());
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));
      };
      recorder.stop();
    });
    recorder.start();
  }`);
  let token=0,distance=0;
  async function shot(name,mode,ms,heading=0,speed=0){
    w.webContents.send('pet:state',{mode,token:++token,direction:1});
    const tick=()=>{distance+=speed*.05;w.webContents.send('pet:gaze',{heading,speed,distance,x:0,y:0});};
    tick();const timer=setInterval(tick,50);
    const milestones=mode==='sleep'?[450,1050,1700,2250]:mode==='wake'?[400,1150,1900,2500,3100]:[];
    const start=Date.now();
    for(const at of milestones){
      await delay(Math.max(0,at-(Date.now()-start)));
      const frame=await w.webContents.capturePage();
      fs.writeFileSync(path.join(out,mode+'-'+at+'.png'),frame.toPNG());
    }
    await delay(Math.max(0,ms-(Date.now()-start)));clearInterval(timer);
    const im=await w.webContents.capturePage();fs.writeFileSync(path.join(out,name+'.png'),im.toPNG());
    const {width,height}=im.getSize(),buffer=im.toBitmap();
    let visible=0,minY=height,maxY=0;
    for(let i=3;i<buffer.length;i+=4)if(buffer[i]>100){visible++;let y=Math.floor((i>>2)/width);minY=Math.min(y,minY);maxY=Math.max(y,maxY);}
    if(visible<5000)throw Error('Empty '+name);
    return {name,visible,minY,maxY,height,width};
  }
  const samples=[];
  for(const args of [['front','idle',600],['wave','wave',1900],['quarter','walk',850,.52,25],['side','walk',1150,1,32],['wave-right','wave',1750,1],['left','walk',1050,-1,30],['wave-left','wave',1750,-1],['crouch','crouch',2400],['sleep','sleep',4100],['wake','wake',5300]])samples.push(await shot(...args));
  if(!statuses.includes(false)||statuses.at(-1)!==true)throw Error('Posture did not recover: '+statuses);
  if(samples.find(s=>s.name==='sleep').minY<samples[0].minY+60)throw Error('Sleep silhouette did not lower');
  const video=await w.webContents.executeJavaScript('finishVideo()');
  fs.writeFileSync(path.join(out,'dragon-3d.webm'),Buffer.from(video,'base64'));
  // Reverse once on the way down and again on the way up.
  const firstReversal=statuses.length;
  for(const [mode,ms] of [['sleep',1850],['wake',540],['sleep',750],['wake',4000]]){
    w.webContents.send('pet:state',{mode,token:++token,direction:1});
    await delay(ms);
  }
  if(JSON.stringify(statuses.slice(firstReversal))!==JSON.stringify([false,true]))throw Error('Interrupted sleep did not recover: '+statuses);
  for(const width of [240,400]){
    w.setContentSize(width,Math.round(width*1.47));
    samples.push(await shot('idle-'+width,'idle',450));
  }
  if(renderErrors.length)throw Error('Renderer errors: '+renderErrors.join(' | '));
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({result,samples,statuses},null,2));console.log('PASS',JSON.stringify(samples));app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
setTimeout(()=>{console.error('3D review timed out');app.exit(2)},60000);
