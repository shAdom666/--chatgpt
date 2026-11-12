const {app,BrowserWindow,ipcMain,Menu,Tray,screen,protocol,net} = require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {advance}=require('./walker.cjs');
const {dock,settle}=require('./desktop.cjs');
const {catalog}=require('./motions.js');
const root=path.resolve(__dirname,'../..');
const engineCheck=process.argv.includes('--engine-check');
const preview=process.argv.includes('--preview');
const showcaseCheck=process.argv.includes('--showcase-check');
const animationCheck=showcaseCheck||process.argv.includes('--animation-check');
const rigCheck=process.argv.includes('--rig-check');
const placementCheck=process.argv.includes('--placement-check');
const multiviewCheck=process.argv.includes('--multiview-check');
const verifyMode=engineCheck||animationCheck||rigCheck||placementCheck||multiviewCheck||process.argv.includes('--model-check');
if(verifyMode)app.setPath('userData',path.join(app.getPath('userData'),'validation'));
const modelFolder=path.join(root,engineCheck?'live2d/validation/Hiyori':'live2d/model');
protocol.registerSchemesAsPrivileged([{scheme:'pet',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let petWindow,chatWindow,tray,timer,pending,drag=null,menuOpen=false,placed=false,mode='idle',modeUntil=0;
let walking=true,top=true,grounded=true,autoGestures=true,x=0,y=0,v=0,vRate=0,direction=-1,last=Date.now(),nextWalk=Date.now()+20000,walkUntil=0,turns=0,walkDistance=0,actionToken=0,nextGesture=Date.now()+11000;
let modelDiagnostics=null,lastGesture='',multiviewStarted=false;
let gait={heading:0,stage:'idle',turnAge:0},queuedAction=null;
const petSize={width:animationCheck?640:320,height:animationCheck?940:470};
if(!app.requestSingleInstanceLock()){app.quit();} else {
app.on('second-instance',(_event,args)=>{ if(args.includes('--chat'))showChat(); else if(petWindow){if(petWindow.isMinimized())petWindow.restore();petWindow.show();home();} });
app.whenReady().then(start);
}
function safeWindow(file,options){
 const win=new BrowserWindow({...options,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,...(verifyMode?{offscreen:true}:{})}});
 win.removeMenu();
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 if(process.argv.includes('--diagnostics')||verifyMode)win.webContents.on('console-message',(_event,details,message)=>{fs.appendFileSync(path.join(root,'tests/live2d-console.log'),(typeof details==='object'?details.message:message)+'\n');});
 win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('pet://app/runtime/'))event.preventDefault();});
 win.loadURL('pet://app/runtime/'+file);return win;
}
function sendState(){if(petWindow&&!petWindow.isDestroyed())petWindow.webContents.send('pet:state',{mode:menuOpen&&mode==='walk'?'idle':mode,direction,walking,token:actionToken});}
function act(value,duration){
 if(!['sleep','crouch','wake'].includes(value)&&(['sleep','crouch'].includes(mode)||(mode==='wake'&&queuedAction))){queuedAction={value,duration};if(mode==='wake')return;value='wake';duration=4800;}else queuedAction=null;
 mode=value;actionToken++;modeUntil=Date.now()+(duration??((catalog[value]?.duration||3)*1000));walkUntil=0;nextWalk=modeUntil+10000+Math.random()*12000;nextGesture=modeUntil+12000+Math.random()*16000;sendState();
}
function stopGait(){v=vRate=0;gait={heading:0,stage:'idle',turnAge:0};if(petWindow&&!petWindow.isDestroyed())petWindow.webContents.send('pet:gaze',{x:0,y:0,speed:0,distance:walkDistance/(petSize.width/320),heading:0,stage:'idle'});}
// Never feed getBounds().width/height back into a move: fractional Windows DPI
// rounds that size outwards, and setPosition() can grow the window each frame.
function movePet(px,py){petWindow.setBounds({x:Math.round(px),y:Math.round(py),...petSize},false);}
function home(){if(!petWindow)return;const a=screen.getPrimaryDisplay().workArea,position=dock(a,petSize);x=position.x;y=position.y;stopGait();direction=-1;drag=null;movePet(x,y);placed=true;last=Date.now();sendState();}
function finishDrag(){if(!petWindow)return 0;const moved=drag?.moved||0;drag=null;const b=petWindow.getBounds();x=b.x;y=b.y;stopGait();nextWalk=Date.now()+8000;return moved;}
function showChat(settings=false){
 if(!chatWindow||chatWindow.isDestroyed()){
  chatWindow=safeWindow('chat.html',{title:'和 ChatGPT 娘聊聊 · Live2D',width:460,height:660,minWidth:380,minHeight:480,backgroundColor:'#f9f7fd',icon:path.join(root,'assets/pet.ico')});
  chatWindow.once('ready-to-show',()=>{if(chatWindow.isMinimized())chatWindow.restore();chatWindow.show();chatWindow.focus();});
  if(settings)chatWindow.webContents.once('did-finish-load',()=>chatWindow.webContents.send('chat:settings'));
 }else{chatWindow.show();chatWindow.focus();if(settings)chatWindow.webContents.send('chat:settings');}
}
function senderAllowed(event){return event.senderFrame?.url?.startsWith('pet://app/runtime/');}
function rpc(payload,isReply=false){return new Promise((resolve,reject)=>{
 const child=spawn(path.join(root,'GptBridge.exe'),[],{windowsHide:true,cwd:root,stdio:['pipe','pipe','pipe']});
 if(isReply)pending=child;let output='',error='';
 const timeout=setTimeout(()=>{child.kill();reject(new Error('连接超时，请重试。'));},125000);
 child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2000000)child.kill();});
 child.stderr.on('data',()=>{});
 child.on('error',()=>{clearTimeout(timeout);if(pending===child)pending=null;reject(new Error('GPT 连接组件无法启动，请重新构建程序。'));});
 child.on('close',()=>{clearTimeout(timeout);if(pending===child)pending=null;try{resolve(JSON.parse(output.trim().replace(/^\uFEFF/,'')));}catch{reject(new Error('请求已停止或连接组件未返回回复。'));}});
 child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(payload)+'\n');
 });}
async function start(){
 protocol.handle('pet',request=>{
  try{const u=new URL(request.url);if(u.hostname!=='app')return new Response('',{status:403});
   const part=decodeURIComponent(u.pathname);let base,relative;
   if(part.startsWith('/runtime/')){base=__dirname;relative=part.slice(9);}else if(part.startsWith('/model/')){base=modelFolder;relative=part.slice(7);}else return new Response('',{status:404});
   const file=path.resolve(base,relative);if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return new Response('',{status:404});
   return net.fetch(pathToFileURL(file).toString());
  }catch{return new Response('',{status:400});}
 });
 petWindow=safeWindow('pet.html',{title:'ChatGPT 娘 · Live2D',...petSize,frame:preview,transparent:!preview,alwaysOnTop:!verifyMode,show:!verifyMode,skipTaskbar:!process.argv.includes('--diagnostics'),resizable:false,hasShadow:false,backgroundColor:preview?'#f3eef8':'#00000000',icon:path.join(root,'assets/pet.ico')});
 home();
 if(placementCheck)setTimeout(()=>{
  const dimensions=[];for(let i=0;i<240;i++){movePet(x+(i%2),y);const b=petWindow.getBounds();dimensions.push([b.width,b.height]);}
  home();const area=screen.getPrimaryDisplay().workArea,expected=dock(area,petSize);
  // Exercise the same native-window path as a completed drag, then let tick land it.
  movePet(x,area.y+50);drag={moved:180};const dragDistance=finishDrag();
  setTimeout(()=>{
   const actual=petWindow.getBounds(),rightGap=area.x+area.width-actual.x-actual.width,bottomGap=area.y+area.height-actual.y-actual.height;
   const sizeStable=dimensions.every(([w,h])=>Math.abs(w-petSize.width)<=2&&Math.abs(h-petSize.height)<=2),landed=!drag&&dragDistance===180&&Math.abs(actual.y-expected.y)<=1;
   const ok=sizeStable&&landed&&rightGap>=0&&rightGap<=40&&bottomGap>=0&&bottomGap<=24;
   fs.writeFileSync(path.join(root,'tests/live2d-placement.json'),JSON.stringify({ok,expected,actual,rightGap,bottomGap,sizeStable,landed,moves:dimensions.length,firstSize:dimensions[0],lastSize:dimensions.at(-1),area,scale:screen.getPrimaryDisplay().scaleFactor},null,2));app.exit(ok?0:1);
  },1300);
 },800);
 petWindow.once('ready-to-show',()=>{home();if(!verifyMode){petWindow.showInactive();if(preview){movePet(200,100);petWindow.show();}}});
 if(process.argv.includes('--diagnostics'))setInterval(()=>{fs.writeFileSync(path.join(root,'tests/live2d-window.json'),JSON.stringify({args:process.argv,visible:petWindow.isVisible(),minimized:petWindow.isMinimized(),opacity:petWindow.getOpacity(),bounds:petWindow.getBounds(),offscreen:petWindow.webContents.isOffscreen(),displays:screen.getAllDisplays().map(d=>({id:d.id,bounds:d.bounds,workArea:d.workArea,scale:d.scaleFactor}))},null,2));},3000);
 if(verifyMode)petWindow.webContents.setFrameRate(60);
 ipcMain.handle('pet:model',e=>e.sender===petWindow.webContents?'pet://app/model/'+(engineCheck?'Hiyori':'GPTDragon')+'.model3.json':null);
 ipcMain.handle('pet:model-bundle',e=>{
  if(e.sender!==petWindow.webContents)return {views:[]};
  const views=[];
  for(const id of ['left','right']){
   const relative='sideviews/GPTDragon-side-'+id+'.model3.json',file=path.join(modelFolder,relative);
   if(!fs.existsSync(file))continue;
   try{const data=JSON.parse(fs.readFileSync(file,'utf8')),base=path.dirname(file),files=[data.FileReferences.Moc,...data.FileReferences.Textures];
    const turn='sideviews/turn-'+id+'.png';
    if(fs.existsSync(path.join(modelFolder,turn))&&files.every(f=>typeof f==='string'&&path.resolve(base,f).startsWith(base+path.sep)&&fs.existsSync(path.resolve(base,f))))views.push({id,url:'pet://app/model/'+relative,turnUrl:'pet://app/model/'+turn});
   }catch{}
  }
  let postures=null;
  try{const relative='postures/GPTDragon-postures.model3.json',file=path.join(modelFolder,relative),base=path.dirname(file),data=JSON.parse(fs.readFileSync(file,'utf8'));if([data.FileReferences.Moc,...data.FileReferences.Textures].every(f=>typeof f==='string'&&path.resolve(base,f).startsWith(base+path.sep)&&fs.existsSync(path.resolve(base,f))))postures={url:'pet://app/model/'+relative,bounds:JSON.parse(fs.readFileSync(path.join(base,'bounds.json'),'utf8'))};}catch{}
  return {views,postures};
 });
 ipcMain.handle('pet:validation',e=>e.sender===petWindow.webContents&&animationCheck);
 ipcMain.handle('pet:showcase',e=>e.sender===petWindow.webContents&&showcaseCheck);
 ipcMain.handle('pet:rig-check',e=>e.sender===petWindow.webContents&&rigCheck);
 ipcMain.handle('pet:preview-video',(e,value)=>{if(!animationCheck||e.sender!==petWindow.webContents||!(value instanceof ArrayBuffer)||value.byteLength>16000000)throw new Error('Invalid preview video');const folder=path.join(root,'live2d/preview');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,showcaseCheck?'natural-actions.webm':'actions.webm'),Buffer.from(value));return value.byteLength;});
 ipcMain.on('pet:rig-result',(e,info)=>{if(rigCheck&&e.sender===petWindow.webContents){fs.writeFileSync(path.join(root,'tests/live2d-rig.json'),JSON.stringify(info,null,2));app.exit(0);}});
 ipcMain.on('pet:capture',(e,value)=>{if(!animationCheck||e.sender!==petWindow.webContents||!Object.hasOwn(catalog,value.mode)||typeof value.png!=='string'||value.png.length>5000000)return;const folder=path.join(root,'live2d/preview');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,value.mode+'.png'),Buffer.from(value.png.replace(/^data:image\/png;base64,/,''),'base64'));});
 const menu=()=>Menu.buildFromTemplate([
  {label:'和 GPT 聊天',click:()=>showChat()}, {label:'连接设置',click:()=>showChat(true)},
  {type:'separator'},{label:'招手',click:()=>act('wave')},{label:'开心',click:()=>act('happy')},{label:'轻轻跳一下',click:()=>act('jump')},
  {label:'日常动作',submenu:['stretch','look','nod','shrug','tidy'].map(id=>({label:catalog[id].label,click:()=>act(id)}))},
  {label:'蹲下',click:()=>act('crouch',3600000)},{label:'侧躺蜷睡',click:()=>act('sleep',3600000)},{label:'起身',click:()=>act(['sleep','crouch'].includes(mode)?'wake':'idle')},
  {label:'日常小动作',type:'checkbox',checked:autoGestures,click:item=>{autoGestures=item.checked;nextGesture=Date.now()+15000;}},
  {label:'自由走动',type:'checkbox',checked:walking,click:item=>{walking=item.checked;if(['sleep','crouch'].includes(mode))act('wake');else{mode='idle';modeUntil=walkUntil=0;nextWalk=Date.now()+8000;sendState();}}},
  {label:'贴住屏幕底边',type:'checkbox',checked:grounded,click:item=>{grounded=item.checked;}},
  {label:'总在最前',type:'checkbox',checked:top,click:item=>{top=item.checked;petWindow.setAlwaysOnTop(top);}},
  {label:'回到右下角',click:home},
  {label:'大小',submenu:[240,320,400].map(width=>({label:width+' 像素',click:()=>{petSize.width=width;petSize.height=Math.round(width*1.47);home();}}))},
  {type:'separator'},{label:'退出',click:()=>app.quit()}
 ]);
 tray=new Tray(path.join(root,'assets/pet.ico'));tray.setToolTip('ChatGPT 娘 · 真正 Live2D');tray.on('right-click',()=>tray.popUpContextMenu(menu()));tray.on('double-click',()=>showChat());
 ipcMain.handle('pet:action',(e,name)=>{if(!senderAllowed(e))return; if(name==='menu'){menuOpen=true;sendState();menu().popup({window:petWindow,callback:()=>{menuOpen=false;sendState();}});return;}if(name==='chat')showChat();else if(name==='settings')showChat(true);});
 ipcMain.on('pet:drag-start',e=>{if(e.sender!==petWindow.webContents)return;const p=screen.getCursorScreenPoint(),b=petWindow.getBounds();if(mode==='walk')mode='idle';walkUntil=0;stopGait();sendState();drag={x:p.x,y:p.y,windowX:b.x,windowY:b.y,moved:0};petWindow.setIgnoreMouseEvents(false);});
 ipcMain.handle('pet:drag-end',e=>{if(e.sender!==petWindow.webContents||!drag)return false;return finishDrag()<5;});
 ipcMain.on('pet:drag-cancel',e=>{if(e.sender===petWindow.webContents)finishDrag();});
 petWindow.on('blur',()=>{if(drag)finishDrag();});
 ipcMain.on('pet:click-through',(e,enabled)=>{if(e.sender===petWindow.webContents&&!drag)petWindow.setIgnoreMouseEvents(enabled,{forward:true});});
 ipcMain.on('pet:ready',(e,info)=>{if(e.sender!==petWindow.webContents)return;modelDiagnostics=info;if(!verifyMode&&!petWindow.isVisible()&&(info.loaded||!info.ok)){home();petWindow.showInactive();}if(process.argv.includes('--diagnostics')||verifyMode)fs.writeFileSync(path.join(root,engineCheck?'tests/live2d-engine.json':showcaseCheck?'tests/live2d-showcase.json':animationCheck?'tests/live2d-animation.json':'tests/live2d-runtime.json'),JSON.stringify(info,null,2));sendState();if(multiviewCheck&&info.loaded&&!multiviewStarted){multiviewStarted=true;validateMultiview();}if(verifyMode&&!multiviewCheck&&(!info.ok||info.seconds))app.exit(info.ok&&info.vertexMotionVerified&&info.render?.visiblePixels>5000?0:1);});
 ipcMain.handle('gpt:config',e=>senderAllowed(e)?rpc({op:'config'}):null);
 ipcMain.handle('gpt:save',(e,value)=>senderAllowed(e)&&typeof value.key==='string'&&value.key.length<1000&&typeof value.model==='string'&&value.model.length<200?rpc({op:'save',...value}):null);
 ipcMain.handle('gpt:clear-key',e=>senderAllowed(e)?rpc({op:'clear-key'}):null);
 ipcMain.handle('gpt:reply',async(e,value)=>{
  if(!senderAllowed(e)||pending)throw new Error('请等待当前回复。');
  if(typeof value.text!=='string'||value.text.length>8000||!Array.isArray(value.history))throw new Error('消息格式有误。');
  act('thinking',130000);
  try{const result=await rpc({op:'reply',text:value.text,history:value.history.slice(-20)},true);act(result.ok?'happy':'idle',result.ok?2000:500);return result;}
  finally{if(mode==='thinking')act('idle',500);}
 });
 ipcMain.handle('gpt:cancel',e=>{if(senderAllowed(e)&&pending){pending.kill();pending=null;act('idle',500);}});
 timer=setInterval(tick,16);if(verifyMode)setTimeout(()=>app.exit(2),showcaseCheck?58000:25000);if(process.argv.includes('--chat'))showChat();
}
async function validateMultiview(){
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),checks=[];
 const inspect=()=>petWindow.webContents.executeJavaScript('({progress:postures?.frame?.progress,posturesReady:postures?.ready,sidesReady:sideviews?.ready,frontAlpha:model.alpha})');
 try{
  walking=autoGestures=false;act('crouch',3600000);await wait(2200);const crouch=await inspect();checks.push({name:'crouch holds',ok:mode==='crouch'&&Math.abs(crouch.progress-2)<.01,...crouch});
  act('sleep',3600000);await wait(2500);const sleeping=await inspect();checks.push({name:'sleep curls',ok:mode==='sleep'&&Math.abs(sleeping.progress-5)<.01,...sleeping});
  act('wave');await wait(500);const waking=await inspect();checks.push({name:'gesture waits for get-up',ok:mode==='wake'&&queuedAction?.value==='wave'&&waking.progress>0,...waking});
  await wait(4600);const standing=await inspect();checks.push({name:'gesture begins standing',ok:mode==='wave'&&standing.progress===0&&standing.frontAlpha===1&&standing.posturesReady&&standing.sidesReady,...standing});
  const ok=checks.every(c=>c.ok);fs.writeFileSync(path.join(root,'tests/live2d-multiview.json'),JSON.stringify({ok,checks,apiCalls:0},null,2));app.exit(ok?0:1);
 }catch(error){fs.writeFileSync(path.join(root,'tests/live2d-multiview.json'),JSON.stringify({ok:false,error:error.stack,checks},null,2));app.exit(1);}
}
function tick(){
 if(!petWindow||petWindow.isDestroyed()||!placed)return;
 if(verifyMode&&!placementCheck&&!multiviewCheck)return;
 const now=Date.now(),dt=Math.min(.1,(now-last)/1000);last=now;
 const p=screen.getCursorScreenPoint(),b=petWindow.getBounds();
 if(drag){const nx=drag.windowX+p.x-drag.x,ny=drag.windowY+p.y-drag.y;drag.moved=Math.max(drag.moved,Math.abs(p.x-drag.x)+Math.abs(p.y-drag.y));movePet(nx,ny);x=nx;y=ny;return;}
 if(now>modeUntil&&queuedAction){const queued=queuedAction;queuedAction=null;act(queued.value,queued.duration);}
 if(now>modeUntil){if(mode!=='idle'&&mode!=='walk'){mode='idle';sendState();}
  if(now>nextWalk){nextWalk=now+20000;if(walking)walkUntil=now+4500;}
  const next=walking&&now<walkUntil?'walk':'idle';if(next!==mode){mode=next;sendState();}
  if(mode==='idle'&&autoGestures&&!menuOpen&&now>nextGesture){const options=['nod','look','shrug','tidy','stretch'].filter(id=>id!==lastGesture);lastGesture=options[Math.floor(Math.random()*options.length)];act(lastGesture);}
 }
 const target=mode==='walk'&&!menuOpen?direction*28:0,a=screen.getDisplayMatching(b).workArea,min=a.x,max=Math.max(min,a.x+a.width-petSize.width),previousDirection=direction;
 const previousX=x;gait=advance({...gait,x,v,vRate,direction,turns},dt,target,min,max,mode==='walk');({x,v,vRate,direction,turns}=gait);walkDistance+=Math.abs(x-previousX);
 if(direction!==previousDirection)sendState();
 if(grounded)y=settle(y,dock(a,petSize).y,dt);else y=b.y;
 const px=Math.round(x),py=Math.round(y);if(px!==b.x||py!==b.y)movePet(px,py);
 const displayRatio=petSize.width/320;
 petWindow.webContents.send('pet:gaze',{x:Math.max(-1,Math.min(1,(p.x-b.x-b.width/2)/500)),y:Math.max(-1,Math.min(1,(p.y-b.y-b.height/3)/500)),speed:Math.abs(v)/displayRatio,distance:walkDistance/displayRatio,heading:gait.heading,stage:gait.stage});
}
app.on('window-all-closed',()=>{});
app.on('before-quit',()=>{if(timer)clearInterval(timer);if(pending)pending.kill();if(tray)tray.destroy();});
