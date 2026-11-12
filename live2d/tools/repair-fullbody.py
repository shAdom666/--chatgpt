"""Repair our native Cubism hierarchy, preserving every texture and keyform.

Reopen the result in official Cubism Editor and export a new moc3.
Rotation children use pixel offsets; warp children use normalized coordinates.
"""
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'third_party/stretchystudio/docs/live2d-export/scripts'))
from cmo3_decrypt import CaffReader,inflate_zip
from caff_packer import pack_caff

source=ROOT/'live2d/model/GPTDragon.refined.cmo3'
target=ROOT/'live2d/model/GPTDragon.fullbody.cmo3'
reader=CaffReader(source.read_bytes());reader.skip(14);key=reader.read_int32();reader.skip(36)
entries=[]
for _ in range(reader.read_int32(key)):
    entry=dict(path=reader.read_string(key),tag=reader.read_string(key),start=reader.read_int64(key),size=reader.read_int32(key),obfuscated=reader.read_bool(key),compress=reader.read_byte(key))
    reader.skip(8);entries.append(entry)
files=[]
for entry in entries:
    reader.pos=entry['start'];content=reader.read_bytes(entry['size'],key if entry['obfuscated'] else 0)
    if entry['compress']!=16:content=inflate_zip(content)
    files.append({**entry,'content':content})
main=next(f for f in files if f['path']=='main.xml');xml=main['content'].decode('utf-8');tree=ET.fromstring(xml)
def named(tag,name):
    return next(e for e in tree.iter(tag) if any(c.get('xs.n')=='localName' and c.text==name for c in e.iter('s')))
def guid(e):return next(c.get('xs.ref') for c in e.iter('CDeformerGuid') if c.get('xs.n')=='guid')
def block(e):
    return re.search(r'<'+e.tag+r' xs.id="'+re.escape(e.get('xs.id'))+r'".*?</'+e.tag+'>',xml,re.S).group()
def replace(e,text):
    global xml
    pattern=r'<'+e.tag+r' xs.id="'+re.escape(e.get('xs.id'))+r'".*?</'+e.tag+'>'
    xml=re.sub(pattern,lambda _:text,xml,count=1,flags=re.S)

# Body-Z is the outermost warp, in canvas coordinates. Its neutral form is
# the midpoint keyform; all other structural rest grids are affine at neutral.
bz=named('CWarpDeformerSource','Body Warp Z')
bz_forms=list(bz.iter('CWarpDeformerForm'))
grid=[float(v) for v in next(bz_forms[len(bz_forms)//2].iter('float-array')).text.split()]
bz_min=[min(grid[axis::2]) for axis in (0,1)]
bz_span=[max(grid[axis::2])-bz_min[axis] for axis in (0,1)]
def to_canvas(value,axis):
    breath=value*.8+.1
    body_y=breath*.89+.055
    body_z=body_y*.87+.065
    return bz_min[axis]+body_z*bz_span[axis]

targets={
 'leg_left Warp':('legLeft',(455,935)),
 'leg_right Warp':('legRight',(582,1070)),
 'wing_left Warp':('wingLeft',(413,650)),
 'wing_right Warp':('wingRight',(610,650)),
 'tail Warp':('tail',(830,1030)),
 'dress_skirt Warp':('body',(512,800)),
 'dress_bodice Warp':('body',(512,800)),
}
for name,(rotation,pivot) in targets.items():
    e=named('CWarpDeformerSource',name);text=block(e)
    text=re.sub(r'(<CDeformerGuid xs.n="targetDeformerGuid" xs.ref=")[^"]+',lambda m:m[1]+guid(named('CRotationDeformerSource',rotation)),text,count=1)
    def positions(match):
        values=[float(v) for v in match[2].split()]
        values=[to_canvas(v,i%2)-pivot[i%2] for i,v in enumerate(values)]
        return match[1]+' '.join(f'{v:.7f}' for v in values)+match[3]
    text=re.sub(r'(<float-array xs.n="positions"[^>]*>)(.*?)(</float-array>)',positions,text,flags=re.S)
    replace(e,text)

# Horns and hair ornaments must follow the same head transform as the face.
fp=named('CWarpDeformerSource','FaceParallax');forms=list(fp.iter('CWarpDeformerForm'))
grid=[float(v) for v in next(forms[len(forms)//2].iter('float-array')).text.split()]
face_rotation=named('CRotationDeformerSource','Face Rotation')
form=list(face_rotation.iter('CRotationDeformerForm'))[1]
face_pivot=(512+float(form.get('originX')),547+float(form.get('originY')))
fp_min=[min(grid[a::2])+face_pivot[a] for a in (0,1)]
fp_span=[max(grid[a::2])-min(grid[a::2]) for a in (0,1)]
for name in ['horn_left Warp','horn_right Warp','crown_root_details Warp','hair_ornament Warp']:
    e=named('CWarpDeformerSource',name);text=block(e)
    text=re.sub(r'(<CDeformerGuid xs.n="targetDeformerGuid" xs.ref=")[^"]+',lambda m:m[1]+guid(fp),text,count=1)
    def positions(match):
        values=[float(v) for v in match[2].split()]
        values=[(to_canvas(v,i%2)-fp_min[i%2])/fp_span[i%2] for i,v in enumerate(values)]
        return match[1]+' '.join(f'{v:.8f}' for v in values)+match[3]
    text=re.sub(r'(<float-array xs.n="positions"[^>]*>)(.*?)(</float-array>)',positions,text,flags=re.S)
    replace(e,text)
ET.fromstring(xml);main['content']=xml.encode('utf-8')
target.write_bytes(pack_caff(files,obfuscate_key=key))
print('Reconnected 11 part warps; preserved texture atlas and neutral coordinates:',target)
