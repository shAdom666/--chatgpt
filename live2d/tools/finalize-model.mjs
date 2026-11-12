import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../model');
const source=process.argv[2]||'GPTDragon.natural.model3.json';
if(path.basename(source)!==source)throw new Error('Use a model manifest name in live2d/model');
const model=JSON.parse(await fs.readFile(path.join(folder,source),'utf8'));
model.Groups=[
 {Target:'Parameter',Name:'EyeBlink',Ids:['ParamEyeLOpen','ParamEyeROpen']},
 {Target:'Parameter',Name:'LipSync',Ids:['ParamMouthOpenY']},
];
await fs.writeFile(path.join(folder,'GPTDragon.model3.json'),JSON.stringify(model,null,2)+'\n');
console.log('Registered Cubism EyeBlink and LipSync parameter groups.');
