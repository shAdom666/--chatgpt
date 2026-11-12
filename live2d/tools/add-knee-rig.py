"""Add editable knee/ankle flex keyforms to our own native Cubism project.

Preserves texture atlas, mesh IDs and the neutral pose. Official Editor export
is required; this script never writes or patches a runtime moc3.
"""
from pathlib import Path
import copy, math, re, sys, uuid
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'third_party/stretchystudio/docs/live2d-export/scripts'))
from cmo3_decrypt import CaffReader,inflate_zip
from caff_packer import pack_caff

source=ROOT/'live2d/model/GPTDragon.fullbody.cmo3'
reader=CaffReader(source.read_bytes());reader.skip(14);key=reader.read_int32();reader.skip(36)
entries=[]
for _ in range(reader.read_int32(key)):
    e=dict(path=reader.read_string(key),tag=reader.read_string(key),start=reader.read_int64(key),size=reader.read_int32(key),obfuscated=reader.read_bool(key),compress=reader.read_byte(key))
    reader.skip(8);entries.append(e)
for e in entries:
    reader.pos=e['start'];data=reader.read_bytes(e['size'],key if e['obfuscated'] else 0)
    e['content']=inflate_zip(data) if e['compress']!=16 else data
main=next(e for e in entries if e['path']=='main.xml');xml=main['content'].decode('utf-8');root=ET.fromstring(xml)
ids={e.get('xs.id'):e for e in root.iter() if e.get('xs.id')}
serial=max(int(i[1:]) for i in ids)+1
idx=max(int(e.get('xs.idx','0')) for e in root.iter())+1
added=[]
def new_shared(template):
    global serial,idx
    e=copy.deepcopy(template);e.set('xs.id','#'+str(serial));serial+=1;e.set('xs.idx',str(idx));idx+=1
    if 'uuid' in e.attrib:e.set('uuid',str(uuid.uuid4()))
    added.append(e);return e,e.get('xs.id')
def named(tag,name):return next(e for e in root.iter(tag) if any(c.get('xs.n')=='localName' and c.text==name for c in e.iter('s')))
def param(id):return next(e for e in root.iter('CParameterSource') if any(c.get('idstr')==id for c in e.iter('CParameterId')))
def field(e,tag,name):return next(c for c in e.iter(tag) if c.get('xs.n')==name)
def replace_shared(e):
    global xml
    pattern=r'<'+e.tag+r' xs.id="'+re.escape(e.get('xs.id'))+r'".*?</'+e.tag+'>'
    xml,count=re.subn(pattern,lambda _:ET.tostring(e,encoding='unicode'),xml,count=1,flags=re.S);assert count==1

mouth=named('CWarpDeformerSource','mouth Warp')
template_grid=ids[field(mouth,'KeyformGridSource','keyformGridSource').get('xs.ref')]
template_binding=ids[next(template_grid.iter('KeyformBindingSource')).get('xs.ref')]
template_param=param('ParamMouthOpenY');template_guid=ids[field(template_param,'CParameterGuid','guid').get('xs.ref')]
group=field(param('ParamRotation_armLeft'),'CParameterGroupGuid','parentGroupGuid').get('xs.ref')
source_set=next(root.iter('CParameterSourceSet'));sources=next(source_set.iter('carray_list'))
smooth=lambda x:(max(0,min(1,x))**2)*(3-2*max(0,min(1,x)))
for side,hip_y,knee_y,ankle_y,lift in [('Left',935,1160,1370,48),('Right',1070,1220,1370,43)]:
    pid='ParamKnee'+side[0];guid,param_ref=new_shared(template_guid);guid.set('note',pid)
    parameter=copy.deepcopy(template_param);field(parameter,'CParameterGuid','guid').set('xs.ref',param_ref)
    field(parameter,'CParameterId','id').set('idstr',pid);field(parameter,'s','name').text='Knee '+side+' Flex'
    field(parameter,'CParameterGroupGuid','parentGroupGuid').set('xs.ref',group);sources.append(parameter)
    warp=named('CWarpDeformerSource','leg_'+side.lower()+' Warp')
    forms=field(warp,'carray_list','keyforms');rest=copy.deepcopy(next(forms.iter('CWarpDeformerForm')))
    coordinates=[float(v) for v in next(rest.iter('float-array')).text.split()]
    x0,x1=min(coordinates[0::2]),max(coordinates[0::2]);y0,y1=min(coordinates[1::2]),max(coordinates[1::2])
    grid,grid_ref=new_shared(template_grid);binding,binding_ref=new_shared(template_binding)
    field(binding,'KeyformGridSource','_gridSource').set('xs.ref',grid_ref)
    field(binding,'CParameterGuid','parameterGuid').set('xs.ref',param_ref);field(binding,'s','description').text=pid
    for c in grid.iter('KeyformBindingSource'):c.set('xs.ref',binding_ref)
    form_guids=[]
    for k in (0,1):
        template=ids[list(template_grid.iter('CFormGuid'))[k].get('xs.ref')]
        form_guid,form_ref=new_shared(template);form_guid.set('note',pid+'_'+str(k));form_guids.append(form_ref)
    for c,ref in zip(grid.iter('CFormGuid'),form_guids):c.set('xs.ref',ref)
    field(warp,'KeyformGridSource','keyformGridSource').set('xs.ref',grid_ref)
    field(warp,'i','col').text='3';field(warp,'i','row').text='8'
    forms.clear();forms.set('xs.n','keyforms');forms.set('count','2')
    for k in (0,1):
        f=copy.deepcopy(rest);field(f,'CFormGuid','guid').set('xs.ref',form_guids[k]);values=[]
        for row in range(9):
            for col in range(4):
                x=x0+(x1-x0)*col/3;y=y0+(y1-y0)*row/8
                flex=smooth((y+hip_y-knee_y)/(ankle_y-knee_y+50))
                x+=k*(1 if side=='Left' else -1)*5*flex
                y-=k*lift*flex
                values.extend((x,y))
        a=field(f,'float-array','positions');a.set('count',str(len(values)));a.text=' '.join(f'{v:.7f}' for v in values);forms.append(f)
    replace_shared(warp)
sources.set('count',str(len(sources)))
xml,count=re.subn(r'<CParameterSourceSet xs.n="parameterSourceSet">.*?</CParameterSourceSet>',lambda _:ET.tostring(source_set,encoding='unicode'),xml,count=1,flags=re.S);assert count==1
xml=xml.replace('</shared>','\n'.join(ET.tostring(e,encoding='unicode') for e in added)+'\n</shared>',1)
ET.fromstring(xml);main['content']=xml.encode('utf-8')
target=ROOT/'live2d/model/GPTDragon.natural.cmo3';target.write_bytes(pack_caff(entries,obfuscate_key=key))
print('Added two native knee-flex parameters and 4x9 knee/ankle keyform grids:',target)
