import fs from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
import JSZip from 'jszip';
import {packCaff} from '../../third_party/stretchystudio/src/io/live2d/caffPacker.js';
export async function readProject(file){
 const b=await fs.readFile(file);if(b.toString('ascii',0,4)!=='CAFF')throw new Error('Not a Cubism project');
 let p=54;const key=b.readInt32BE(14),mask=key<0?BigInt.asUintN(64,BigInt(key)):((BigInt(key)<<32n)|BigInt(key));
 const i32=()=>{const v=b.readInt32BE(p)^key;p+=4;return v;},byte=()=>b[p++]^(key&255),i64=()=>{const v=b.readBigUInt64BE(p)^mask;p+=8;return Number(v);};
 const string=()=>{let n=0,k;do{k=byte();n=(n<<7)|(k&127);}while(k&128);const s=Buffer.from(b.subarray(p,p+n));p+=n;for(let i=0;i<n;i++)s[i]^=key&255;return s.toString('utf8');};
 const entries=[];for(let i=0,n=i32();i<n;i++){entries.push({path:string(),tag:string(),start:i64(),size:i32(),obfuscated:byte(),compress:byte()});p+=8;}
 for(const e of entries){let d=Buffer.from(b.subarray(e.start,e.start+e.size));if(e.obfuscated)for(let i=0;i<d.length;i++)d[i]^=key&255;
  if(d.length&&e.compress!==16&&e.compress!==32){try{const z=await JSZip.loadAsync(d);d=await Object.values(z.files).find(f=>!f.dir).async('nodebuffer');}catch(error){if(d.length<30||d.readUInt32LE(0)!==0x04034b50)throw error;const start=30+d.readUInt16LE(26)+d.readUInt16LE(28),size=d.readUInt32LE(18);d=d.readUInt16LE(8)===8?inflateRawSync(d.subarray(start,size?start+size:undefined)):d.subarray(start,start+size);}}
  e.content=d;e.compress=d.length?33:16;
 }
 return {entries,key};
}
export async function writeProject(file,project){await fs.writeFile(file,await packCaff(project.entries,project.key));}
