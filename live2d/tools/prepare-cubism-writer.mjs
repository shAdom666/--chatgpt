import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
// Adapter for pinned StretchyStudio 24a83a27ba43e43e9d2e3de5e33994594e6199c2.
export async function prepareWriter(){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),source=path.join(root,'third_party/stretchystudio/src/io/live2d/cmo3writer.js');
 let writer=await fs.readFile(source,'utf8');
 const edits=[
  ['const nativeWarpGroups = new Map();','const nativeWarpBboxes = new Map();\n  const nativeWarpGroups = new Map();'],
  ['// Rest grid using native col/row dimensions','for (const pm of members) nativeWarpBboxes.set(meshes[pm.mi].partId, { gridMinX: bboxMinX, gridMinY: bboxMinY, gridW: bboxW, gridH: bboxH });\n    // Rest grid using native col/row dimensions'],
  ['const rwBox = rigWarpBbox.get(partId);','const rwBox = rigWarpBbox.get(partId) || nativeWarpBboxes.get(partId);'],
  ['const emitArtMeshForm = (kfList, formGuidPid, positions, opacity = 1.0) => {',"const [meshFormCoordNode, meshFormCoordPid] = x.shared('CoordType');\n    x.sub(meshFormCoordNode, 's', { 'xs.n': 'coordName' }).text = rwBox ? 'DeformerLocal' : 'Canvas';\n    const emitArtMeshForm = (kfList, formGuidPid, positions, opacity = 1.0) => {"],
  ["x.subRef(adf, 'CoordType', pidCoord, { 'xs.n': 'coordType' });","x.subRef(adf, 'CoordType', meshFormCoordPid, { 'xs.n': 'coordType' });"],
  ['return { cmo3, deformerParamMap, rigDebugLog };','return { cmo3, deformerParamMap, rigDebugLog, sourceFiles:caffFiles };']
 ];
 for(const [from,to] of edits){if(!writer.includes(from))throw new Error('Pinned writer mismatch: '+from);writer=writer.replace(from,to);}
 const adapted=source.replace('.js','-pet-adapter.js');await fs.writeFile(adapted,writer);
 return import(pathToFileURL(adapted).href);
}
