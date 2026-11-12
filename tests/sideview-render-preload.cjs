const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('sideTest',{result:r=>ipcRenderer.invoke('side:result',r),capture:r=>ipcRenderer.invoke('side:capture',r),video:r=>ipcRenderer.invoke('side:video',r)});
