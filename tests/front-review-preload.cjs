const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('frontReview',{capture:v=>ipcRenderer.invoke('front:capture',v),done:v=>ipcRenderer.invoke('front:done',v)});
