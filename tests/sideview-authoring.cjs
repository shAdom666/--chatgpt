// Validate source structure, not an Editor runtime export.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const JSZip=require('../live2d/tools/node_modules/jszip');
async function readCaff(file){
 const b=fs.readFileSync(file);assert.equal(b.toString('ascii',0,4),'CAFF');let p=14;
 const key=b.readInt32BE(p);p=54;
 const i32=()=>{const v=b.readInt32BE(p)^key;p+=4;return v;};
 const byte=()=>b[p++]^(key&255);
 const mask=key<0?BigInt.asUintN(64,BigInt(key)):((BigInt(key)<<32n)|BigInt(key));
 const i64=()=>{const v=b.readBigUInt64BE(p)^mask;p+=8;return Number(v);};
 const string=()=>{let n=0,k;do{k=byte();n=(n<<7)|(k&127);}while(k&128);const s=Buffer.from(b.subarray(p,p+n));p+=n;for(let i=0;i<n;i++)s[i]^=key&255;return s.toString('utf8');};
 const n=i32(),entries=[];
 for(let i=0;i<n;i++){const e={path:string(),tag:string(),start:i64(),size:i32(),obfuscated:byte(),compress:byte()};p+=8;entries.push(e);}
 const e=entries.find(e=>e.path==='main.xml');assert(e);
 const data=Buffer.from(b.subarray(e.start,e.start+e.size));if(e.obfuscated)for(let i=0;i<data.length;i++)data[i]^=key&255;
 if(e.compress===16||e.compress===32)return data.toString('utf8');
 try{const z=await JSZip.loadAsync(data);return Object.values(z.files).find(f=>!f.dir).async('string');}
 catch(error){
  if(data.readUInt32LE(0)!==0x04034b50)throw error;
  const start=30+data.readUInt16LE(26)+data.readUInt16LE(28),size=data.readUInt32LE(18),payload=data.subarray(start,size?start+size:undefined);
  return (data.readUInt16LE(8)===8?require('node:zlib').inflateRawSync(payload):payload).toString('utf8');
 }
}
module.exports={readCaff};
if(require.main===module)(async()=>{
 for(const side of ['left','right']){
  const xml=await readCaff(path.join(__dirname,'../live2d/model/sideviews/GPTDragon-side-'+side+'.cmo3'));
  const ids=new Set([...xml.matchAll(/xs.id="([^"]+)"/g)].map(m=>m[1]));
  for(const m of xml.matchAll(/xs.ref="([^"]+)"/g))assert(ids.has(m[1]),'dangling native reference '+m[1]);
  const params=new Set([...xml.matchAll(/<CParameterId[^>]*idstr="([^"]+)"/g)].map(m=>m[1]));
  assert.equal(params.size,8);
  for(const id of ['ParamStrideNear','ParamStrideFar','ParamArmNear','ParamArmFar','ParamBodySway','ParamTail','ParamWing'])assert(params.has(id));
  assert.equal([...xml.matchAll(/<CArtMeshSource xs.id=/g)].length,7);
  const warps=[...xml.matchAll(/<CWarpDeformerSource xs.id="[^"]+"[\s\S]*?<\/CWarpDeformerSource>/g)].map(m=>m[0]);assert.equal(warps.length,7);
  const legs=warps.filter(w=>/<s xs.n="localName">[^<]*Leg/.test(w));assert.equal(legs.length,2);
  for(const leg of legs){
   const shapes=[...leg.matchAll(/<float-array xs.n="positions"[^>]*>([^<]+)<\/float-array>/g)].map(m=>m[1]);
   assert.equal(shapes.length,17);assert(new Set(shapes).size>=15,'leg must have distinct support/swing forms');
  }
  console.log('PASS '+side+': CAFF references, 7 mesh/warp pairs, 8 parameters, 17 leg keyforms; runtime export is verified separately by sideview-render');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
