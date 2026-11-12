// Cubism expects binding[0] to vary fastest in multi-parameter grids. Keep
// keyform access keys and source form arrays in the same column-major order.
import fs from 'node:fs/promises';import path from 'node:path';import {readProject,writeProject} from './cubism-project.mjs';
const file=path.resolve(process.argv[2]),project=await readProject(file),entry=project.entries.find(e=>e.path==='main.xml');let xml=entry.content.toString();const orders=new Map();let changed=0;
const bindingBlocks=new Map([...xml.matchAll(/<KeyformBindingSource xs.id="([^"]+)"[\s\S]*?<\/KeyformBindingSource>/g)].map(m=>[m[1],m[0]]));
xml=xml.replace(/<KeyformGridSource xs.id="([^"]+)"[\s\S]*?<\/KeyformGridSource>/g,(block,id)=>{
 const list=block.match(/<array_list xs.n="keyformBindings"[^>]*>([\s\S]*?)<\/array_list>/)?.[1],bindings=[...(list||'').matchAll(/xs.ref="([^"]+)"/g)].map(m=>m[1]);if(bindings.length<2)return block;
 const sizes=bindings.map(b=>Number(bindingBlocks.get(b).match(/<array_list xs.n="keys" count="(\d+)"/)[1]));
 const forms=[...block.matchAll(/<KeyformOnGrid>[\s\S]*?<\/KeyformOnGrid>/g)].map(m=>{const keys=new Map([...m[0].matchAll(/<KeyOnParameter>[\s\S]*?xs.ref="([^"]+)"[\s\S]*?<i xs.n="keyIndex">(\d+)<\/i>[\s\S]*?<\/KeyOnParameter>/g)].map(k=>[k[1],+k[2]]));let ordinal=0,stride=1;for(let i=0;i<bindings.length;i++){if(!keys.has(bindings[i]))throw new Error('Grid missing binding '+id);ordinal+=keys.get(bindings[i])*stride;stride*=sizes[i];}return {xml:m[0],ordinal,guid:m[0].match(/<CFormGuid xs.n="keyformGuid" xs.ref="([^"]+)"/)[1]};});
 const sorted=[...forms].sort((a,b)=>a.ordinal-b.ordinal);if(new Set(sorted.map(f=>f.ordinal)).size!==sizes.reduce((a,b)=>a*b,1))throw new Error('Incomplete native grid '+id);
 if(forms.some((f,i)=>f.guid!==sorted[i].guid)){orders.set(id,sorted.map(f=>f.guid));changed++;let i=0;return block.replace(/<KeyformOnGrid>[\s\S]*?<\/KeyformOnGrid>/g,()=>sorted[i++].xml);}return block;
});
xml=xml.replace(/<(CArtMeshSource|CWarpDeformerSource) xs.id="[^"]+"[\s\S]*?<\/\1>/g,(source,type)=>{
 const grid=source.match(/<KeyformGridSource xs.n="keyformGridSource" xs.ref="([^"]+)"/)?.[1],order=orders.get(grid);if(!order)return source;const formType=type==='CArtMeshSource'?'CArtMeshForm':'CWarpDeformerForm',re=new RegExp('<'+formType+'>[\\s\\S]*?<\\/'+formType+'>','g'),forms=[...source.matchAll(re)].map(m=>m[0]),byGuid=new Map(forms.map(f=>[f.match(/<CFormGuid xs.n="guid" xs.ref="([^"]+)"/)[1],f]));let i=0;return source.replace(re,()=>{const form=byGuid.get(order[i++]);if(!form)throw new Error('Missing native form');return form;});
});
if(changed){await fs.copyFile(file,file+'.pre-grid-fix.bak');entry.content=Buffer.from(xml);await writeProject(file,project);}console.log('Canonicalized native multi-parameter grids:',changed);
