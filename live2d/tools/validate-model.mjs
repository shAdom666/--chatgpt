import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../model');
const manifestPath=path.join(directory,'GPTDragon.model3.json');
const errors=[];
if(!fs.existsSync(manifestPath)){console.error('NOT COMPLETE: GPTDragon.model3.json has not been exported from Cubism.');process.exit(1);}
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8').replace(/^\uFEFF/,''));
if(manifest.Version!==3)errors.push('Unsupported model manifest version');
const files=manifest.FileReferences||{};
const names=[files.Moc,...(files.Textures||[]),files.Physics].filter(Boolean);
if(!files.Moc)errors.push('Missing Moc reference');
if(!files.Textures?.length)errors.push('No texture atlas');
if(!files.Physics)errors.push('No exported physics settings');
for(const group of Object.values(files.Motions||{}))for(const item of group)names.push(item.File);
for(const item of files.Expressions||[])names.push(item.File);
for(const name of names){const target=path.resolve(directory,name);if(!target.startsWith(directory+path.sep))errors.push('File reference escapes model folder: '+name);else if(!fs.existsSync(target))errors.push('Missing file: '+name);}
if(files.Moc&&fs.existsSync(path.join(directory,files.Moc))){const bytes=fs.readFileSync(path.join(directory,files.Moc));if(bytes.length<64||bytes.subarray(0,4).toString('ascii')!=='MOC3')errors.push('Invalid or incomplete MOC3 file');}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('PASS real model bundle references, MOC3 header, texture atlases and physics');
console.log('Next: run electron . --model-check to verify actual Cubism mesh motion.');
