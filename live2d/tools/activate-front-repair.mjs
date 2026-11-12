// Run only after the official Editor has exported the repaired native model.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),folder=path.join(root,'live2d/model'),relative='front-repair/GPTDragon-front.model3.json';
const model=JSON.parse(await fs.readFile(path.join(folder,relative),'utf8'));
for(const name of [model.FileReferences.Moc,...model.FileReferences.Textures])await fs.access(path.resolve(folder,'front-repair',name));
const physics=JSON.parse(await fs.readFile(path.join(folder,'GPTDragon.natural.physics3.json'),'utf8'));
physics.PhysicsSettings=physics.PhysicsSettings.map(s=>({...s,Output:s.Output.filter(o=>!['ParamRotation_leftElbow','ParamRotation_rightElbow'].includes(o.Destination.Id)).map(o=>['ParamShirt','ParamBust'].includes(o.Destination.Id)?{...o,Weight:30}:o)})).filter(s=>s.Output.length);
physics.Meta.PhysicsSettingCount=physics.PhysicsSettings.length;physics.Meta.TotalInputCount=physics.PhysicsSettings.reduce((n,s)=>n+s.Input.length,0);physics.Meta.TotalOutputCount=physics.PhysicsSettings.reduce((n,s)=>n+s.Output.length,0);physics.Meta.VertexCount=physics.PhysicsSettings.reduce((n,s)=>n+s.Vertices.length,0);
physics.Meta.PhysicsDictionary=physics.Meta.PhysicsDictionary.filter(d=>physics.PhysicsSettings.some(s=>s.Id===d.Id));
await fs.writeFile(path.join(folder,'front-repair/GPTDragon-front.physics3.json'),JSON.stringify(physics,null,2)+'\n');
for(const [key,value] of Object.entries(model.FileReferences)){if(typeof value==='string')model.FileReferences[key]='front-repair/'+value;else if(Array.isArray(value))model.FileReferences[key]=value.map(f=>'front-repair/'+f);}
model.FileReferences.Physics='front-repair/GPTDragon-front.physics3.json';model.Groups=[{Target:'Parameter',Name:'EyeBlink',Ids:['ParamEyeLOpen','ParamEyeROpen']},{Target:'Parameter',Name:'LipSync',Ids:['ParamMouthOpenY']}];
await fs.writeFile(path.join(folder,'GPTDragon.model3.json'),JSON.stringify(model,null,2)+'\n');console.log('Activated repaired front model with single-owner arm control and restrained clothing physics');
