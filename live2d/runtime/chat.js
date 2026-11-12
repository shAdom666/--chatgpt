const $=id=>document.getElementById(id);let history=[],busy=false,configured=false;
function message(name,text,type=''){const entry=document.createElement('div');entry.className='message '+type;const label=document.createElement('span');label.className='name';label.textContent=name;entry.append(label,document.createTextNode(text));$('messages').append(entry);$('messages').scrollTop=$('messages').scrollHeight;}
function welcome(){message('ChatGPT 娘','我在这里陪你。可以和我聊想法、问问题，或者一起安排今天要做的事。');}
async function refresh(){try{const c=await window.pet.config();configured=c.configured;$('model').value=c.model;$('state').textContent=configured?'已配置 · '+c.model:'尚未连接 · 请先设置 API Key';}catch(e){$('state').textContent=e.message;}}
function openSettings(){if(busy)return;$('key').value='';$('config-error').textContent='';$('config').showModal();}
$('settings').onclick=openSettings;window.pet.onOpenSettings(openSettings);$('cancel-config').onclick=()=>$('config').close();
$('config-form').onsubmit=async event=>{event.preventDefault();try{const result=await window.pet.save($('key').value,$('model').value);if(!result.ok)throw new Error(result.error);$('key').value='';$('config').close();await refresh();}catch(e){$('config-error').textContent=e.message;}};
$('clear').onclick=()=>{if(busy)return;history=[];$('messages').replaceChildren();welcome();};
$('input').onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('compose').requestSubmit();}};
$('compose').onsubmit=async event=>{
 event.preventDefault();if(busy){await window.pet.cancel();return;}
 const text=$('input').value.trim();if(!text)return;if(!configured){openSettings();return;}
 message('你',text,'user');$('input').value='';busy=true;$('send').textContent='停止';$('clear').disabled=$('settings').disabled=true;$('state').textContent='正在思考…';
 try{const result=await window.pet.reply(text,history);if(!result.ok)throw new Error(result.error);message('ChatGPT 娘',result.text);history.push({role:'user',content:text},{role:'assistant',content:result.text});history=history.slice(-20);$('state').textContent='已连接 · '+result.model;}
 catch(e){message('连接提示',e.message,'error');$('state').textContent='本次未完成';if(!$('input').value)$('input').value=text;}
 finally{busy=false;$('send').textContent='发送';$('clear').disabled=$('settings').disabled=false;}
};
welcome();refresh();
