// Preserve an Editor-saved atlas while fixing a one-form imported mesh whose
// writer-only constant parameter was not copied into the destination model.
import fs from 'node:fs/promises';import path from 'node:path';import {readProject,writeProject} from './cubism-project.mjs';
const file=path.resolve(process.argv[2]),project=await readProject(file),entry=project.entries.find(e=>e.path==='main.xml');let xml=entry.content.toString();
const parameters=[...xml.matchAll(/<CParameterSource>[\s\S]*?<\/CParameterSource>/g)].map(m=>m[0]),guids=new Set(parameters.map(p=>p.match(/<CParameterGuid xs.n="guid" xs.ref="([^"]+)"/)[1])),constant=[...guids][0];let fixed=0;
xml=xml.replace(/<KeyformBindingSource xs.id="[^"]+"[\s\S]*?<\/KeyformBindingSource>/g,b=>{
 const tag=b.match(/<CParameterGuid xs.n="parameterGuid"[^>]*\/>/)[0],guid=tag.match(/xs.ref="([^"]+)"/)?.[1];if(guids.has(guid))return b;
 if(!/<array_list xs.n="keys" count="1">\s*<f>[-\d.]+<\/f>\s*<\/array_list>/.test(b)||!b.includes('>ParamOpacity</s>'))throw new Error('Nonconstant binding missing parameter '+guid);
 fixed++;return b.replace(tag,'<CParameterGuid xs.n="parameterGuid" xs.ref="'+constant+'" />');
});
if(fixed){entry.content=Buffer.from(xml);await fs.copyFile(file,file+'.pre-binding-fix.bak');await writeProject(file,project);}console.log('Repaired constant mesh bindings:',fixed);
