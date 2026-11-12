// Preserve the saved atlas and neutral pose while keeping the standing feet
// grounded during the torso's preparation deformation.
import fs from 'node:fs/promises';import path from 'node:path';import {readProject,writeProject} from './cubism-project.mjs';
const file=path.resolve(process.argv[2]),project=await readProject(file),entry=project.entries.find(e=>e.path==='main.xml');let xml=entry.content.toString();
const macro=[...xml.matchAll(/<CWarpDeformerSource xs.id="[^"]+"[\s\S]*?<\/CWarpDeformerSource>/g)].map(m=>m[0]).find(b=>b.includes('>Posture prepare</s>'));
const target=macro.match(/<CDeformerGuid xs.n="targetDeformerGuid"[^>]*\/>/)[0],coord=macro.match(/<CoordType xs.n="coordType"[^>]*\/>/)[0],positions=macro.match(/<float-array xs.n="positions"[^>]*>([^<]+)<\/float-array>/)[1].trim().split(/\s+/).map(Number),xs=positions.filter((_,i)=>i%2===0),ys=positions.filter((_,i)=>i%2),x0=Math.min(...xs),y0=Math.min(...ys),width=Math.max(...xs)-x0,height=Math.max(...ys)-y0;let changed=0;
xml=xml.replace(/<CRotationDeformerSource xs.id="[^"]+"[\s\S]*?<\/CRotationDeformerSource>/g,b=>{
 if(!/>(legLeft|legRight)<\/s>/.test(b)||b.includes(target))return b;changed++;
 return b.replace(/<CDeformerGuid xs.n="targetDeformerGuid"[^>]*\/>/,target).replace(/<CRotationDeformerForm[^>]*>/g,tag=>tag.replace(/originX="([^"]+)"/,(_,v)=>'originX="'+(x0+Number(v)*width).toFixed(6)+'"').replace(/originY="([^"]+)"/,(_,v)=>'originY="'+(y0+Number(v)*height).toFixed(6)+'"')).replace(/<CoordType xs.n="coordType"[^>]*\/>/g,coord);
});
if(changed!==2)throw new Error('Expected two leg parents; do not apply twice');await fs.copyFile(file,file+'.pre-ground-fix.bak');entry.content=Buffer.from(xml);await writeProject(file,project);console.log('Anchored standing feet to the root ground plane');
