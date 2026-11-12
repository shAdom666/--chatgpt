const assert=require('node:assert/strict'),path=require('node:path'),{readCaff}=require('./sideview-authoring.cjs');
(async()=>{
 const xml=await readCaff(path.join(__dirname,'../live2d/model/front-repair/GPTDragon-front.cmo3'));
 const ids=[...xml.matchAll(/xs.id="([^"]+)"/g)].map(m=>m[1]),known=new Set(ids);assert.equal(ids.length,known.size);for(const ref of xml.matchAll(/xs.ref="([^"]+)"/g))assert(known.has(ref[1]),'dangling reference '+ref[1]);
 const fixedFilters={CLayerSelector:'5e9fe1ea-0ec3-4d68-a5fa-018fc7abe301',CLayerFilter:'4083cd1f-40ba-4eda-8400-379019d55ed8'};
 for(const m of xml.matchAll(/<StaticFilterDefGuid[^>]*>/g)){const tag=m[0],name=tag.match(/note="([^"]+)"/)?.[1];if(fixedFilters[name])assert(tag.includes('uuid="'+fixedFilters[name]+'"'),'native static filter identity must be preserved');}
 const parameters=[...xml.matchAll(/<CParameterSource>[\s\S]*?<\/CParameterSource>/g)].map(m=>m[0]);assert.equal(parameters.length,39);
 for(const id of ['ParamWristL','ParamWristR','ParamCrouchPrepare']){
  const definition=[...xml.matchAll(/<CParameterId[^>]*>/g)].map(m=>m[0]).find(p=>p.includes('idstr="'+id+'"')),ref=definition?.match(/xs.id="([^"]+)"/)?.[1];
  assert(definition&&parameters.some(p=>p.includes('idstr="'+id+'"')||(ref&&p.includes('<CParameterId xs.n="id" xs.ref="'+ref+'"'))),'missing '+id);
 }
 const meshes=[...xml.matchAll(/<CArtMeshSource xs.id="[^"]+"[\s\S]*?<\/CArtMeshSource>/g)].map(m=>m[0]);assert.equal(meshes.length,34);
 const named=(list,name)=>list.find(b=>b.includes('>'+name+'</s>'));
 for(const name of ['arm_left','arm_right']){
  const mesh=named(meshes,name),forms=[...mesh.matchAll(/<CArtMeshForm>[\s\S]*?<\/CArtMeshForm>/g)].map(m=>m[0]);assert.equal(forms.length,27);
  const values=f=>f.match(/<float-array xs.n="positions"[^>]*>([^<]+)<\/float-array>/)[1].trim().split(/\s+/).map(Number),a=values(forms[4]),b=values(forms[22]);let maximum=0,unchanged=0;
  for(let i=0;i<a.length;i+=2){const d=Math.hypot(a[i]-b[i],a[i+1]-b[i+1]);maximum=Math.max(maximum,d);if(d<.001)unchanged++;}
  assert(maximum>15,'wrist must move the hand');assert(unchanged>a.length/5,'wrist must leave upper arm/sleeve attachment fixed');
 }
 const warps=[...xml.matchAll(/<CWarpDeformerSource xs.id="[^"]+"[\s\S]*?<\/CWarpDeformerSource>/g)].map(m=>m[0]);
 for(const name of ['dress_bodice Warp','dress_skirt Warp']){
  const warp=named(warps,name),col=Number(warp.match(/<i xs.n="col">(\d+)/)[1])+1,forms=[...warp.matchAll(/<float-array xs.n="positions"[^>]*>([^<]+)<\/float-array>/g)].map(m=>m[1].trim().split(/\s+/).map(Number));
  for(const form of forms)for(let i=0;i<col*2;i++)assert(Math.abs(form[i]-forms[0][i])<.0001,'neckline/waist anchor drift '+name);
  if(name==='dress_bodice Warp')for(const form of forms)for(let i=form.length-col*2;i<form.length;i++)assert(Math.abs(form[i]-forms[0][i])<.0001,'bodice waist drift');
 }
 const lining=named(meshes,'dress_lining');assert(lining.includes('>55</i>'),'lining must render behind legs');const prepare=named(warps,'Posture prepare');assert(prepare);
 // The editor's part tree is separate from the global source set. A resource
 // with valid references but no parent membership becomes an orphan on load.
 const parts=[...xml.matchAll(/<CPartSource xs.id="[^"]+"[\s\S]*?<\/CPartSource>/g)].map(m=>m[0]);
 for(const [source,kind] of [[lining,'CDrawableGuid'],[prepare,'CDeformerGuid']]){
  const parent=source.match(/<CPartGuid xs.n="parentGuid" xs.ref="([^"]+)"/)[1],guid=source.match(new RegExp('<'+kind+' xs.n="guid" xs.ref="([^"]+)"'))[1];
  const part=parts.find(p=>p.includes('<CPartGuid xs.n="guid" xs.ref="'+parent+'"'));assert(part?.match(/<carray_list xs.n="_childGuids"[^>]*>([\s\S]*?)<\/carray_list>/)?.[1].includes('xs.ref="'+guid+'"'),'new rig resource must belong to its parent part');
 }
 console.log('PASS front rig authoring: shared contacts, independent lining, 27 elbow/wrist forms per arm and native crouch preparation');
})().catch(e=>{console.error(e);process.exitCode=1;});
