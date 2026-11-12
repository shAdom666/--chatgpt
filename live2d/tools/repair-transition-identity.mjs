// Repair the imported transition ID while preserving the Editor's atlas.
import fs from 'node:fs/promises';import path from 'node:path';import {readProject,writeProject} from './cubism-project.mjs';
const file=path.resolve(process.argv[2]),project=await readProject(file),entry=project.entries.find(e=>e.path==='main.xml');let xml=entry.content.toString(),count=0;
xml=xml.replace(/<CParameterSource>[\s\S]*?<\/CParameterSource>/g,p=>{
 if(!p.includes('<s xs.n="name">ParamTransition</s>'))return p;count++;
 return p.replace(/<CParameterId xs.n="id"[^>]*\/>/,'<CParameterId xs.n="id" idstr="ParamTransition" />');
});
if(count!==1)throw new Error('Expected exactly one transition parameter');
await fs.copyFile(file,file+'.pre-id-fix.bak');entry.content=Buffer.from(xml);await writeProject(file,project);console.log('Restored unique native ParamTransition identity');
