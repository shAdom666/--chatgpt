"""Minimal glTF 2.0 writer for the dragon's weighted, indexed meshes (Y up)."""
import math
import json
import struct
from collections import defaultdict
from pathlib import Path

def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def unit(v):
    length=math.sqrt(sum(x*x for x in v)) or 1
    return tuple(x/length for x in v)

class Avatar:
    def __init__(self):
        self.doc=dict(asset=dict(version="2.0",generator="DragonPet character authoring"),scene=0,
                      scenes=[dict(nodes=[])],nodes=[],skins=[],meshes=[],materials=[],textures=[],
                      images=[],bufferViews=[],accessors=[],animations=[])
        self.blob=bytearray()
        self.bones={}
        self.centers={}
        self.parts=defaultdict(lambda:dict(p=[],n=[],j=[],w=[],uv=[],i=[]))

    def joint(self,name,coord,parent=None):
        idx=len(self.bones)
        self.bones[name]=idx
        self.centers[name]=coord
        position=sub(coord,self.centers[parent]) if parent else coord
        self.doc['nodes'].append(dict(name=name,translation=position))
        if parent: self.doc['nodes'][self.bones[parent]].setdefault('children',[]).append(idx)
        else: self.doc['scenes'][0]['nodes'].append(idx)
        return name

    def view(self,data):
        self.blob.extend(b'\0'*(-len(self.blob)%4))
        offset=len(self.blob)
        self.blob.extend(data)
        views=self.doc['bufferViews']
        views.append(dict(buffer=0,byteOffset=offset,byteLength=len(data)))
        return len(views)-1

    def array(self,values,kind,fmt='f',bounds=False):
        rows=[(v,) if isinstance(v,(int,float)) else v for v in values]
        pack=struct.Struct('<'+fmt*len(rows[0])).pack
        acc=dict(bufferView=self.view(b''.join(pack(*r) for r in rows)),componentType={'f':5126,'H':5123,'I':5125}[fmt],type=kind,count=len(rows))
        if bounds:
            acc.update(min=[min(col) for col in zip(*rows)],max=[max(col) for col in zip(*rows)])
        self.doc['accessors'].append(acc)
        return len(self.doc['accessors'])-1

    def material(self,name,color,texture=None):
        rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
        rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
        pbr=dict(baseColorFactor=rgb+[1],metallicFactor=0,roughnessFactor=.86)
        m=dict(name=name,pbrMetallicRoughness=pbr,doubleSided=True)
        if texture:
            images=self.doc['images']
            index=len(images)
            images.append(dict(bufferView=self.view(texture.read_bytes()),mimeType='image/png'))
            self.doc['textures'].append(dict(source=index))
            pbr['baseColorTexture']=dict(index=index)
            m.update(alphaMode='MASK',alphaCutoff=.39)
        self.doc['materials'].append(m)
        return len(self.doc['materials'])-1

    def surface(self,mat,rows,joint,reverse=False):
        # Rows are (position, optional second bone weight, UV) sampled around a ring.
        part=self.parts[mat]
        base=len(part['p'])
        cols=len(rows[0])
        points=[v for row in rows for v in row]
        normals=[[0.,0.,0.] for _ in points]
        for r in range(len(rows)-1):
            for c in range(cols-1):
                a=r*cols+c
                for tri in [(a,a+1,a+cols),(a+1,a+cols+1,a+cols)]:
                    if reverse: tri=tri[::-1]
                    x,y,z=[points[k][0] for k in tri]
                    n=cross(sub(y,x),sub(z,x))
                    for k in tri:
                        part['i'].append(base+k)
                        for d in range(3): normals[k][d]+=n[d]
        for (pos,weight,uv),n in zip(points,normals):
            if isinstance(weight,dict):
                influences=list(weight.items())
            else:
                other,w=weight or (joint,0.)
                influences=[(joint,1-w),(other,w)]
            ids=[self.bones[b] for b,_ in influences]; ws=[w for _,w in influences]
            part['p'].append(pos);part['n'].append(unit(n));part['uv'].append(uv)
            part['j'].append(ids+[0]*(4-len(ids)));part['w'].append(ws+[0]*(4-len(ws)))

    def save(self,path):
        matrices=[]
        for x,y,z in self.centers.values():
            matrices.append((1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1))
        self.doc['skins']=[dict(name='DragonRig',inverseBindMatrices=self.array(matrices,'MAT4'),joints=list(self.bones.values()),skeleton=0)]
        primitives=[]
        for material,p in self.parts.items():
            attr=dict(POSITION=self.array(p['p'],'VEC3',bounds=True),NORMAL=self.array(p['n'],'VEC3'),
                      JOINTS_0=self.array(p['j'],'VEC4','H'),WEIGHTS_0=self.array(p['w'],'VEC4'),TEXCOORD_0=self.array(p['uv'],'VEC2'))
            if 'color' in p:
                attr['COLOR_0']=self.array(p['color'],'VEC3')
            primitives.append(dict(material=material,attributes=attr,indices=self.array(p['i'],'SCALAR','I')))
        self.doc['meshes']=[dict(name='DragonGirl',primitives=primitives)]
        self.doc['scenes'][0]['nodes'].append(len(self.doc['nodes']))
        self.doc['nodes'].append(dict(name='DragonGirl',mesh=0,skin=0))
        self.blob.extend(b'\0'*(-len(self.blob)%4))
        self.doc['buffers']=[dict(byteLength=len(self.blob))]
        data=json.dumps(self.doc,separators=(',',':')).encode()
        data+=b' '*(-len(data)%4)
        path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(self.blob))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(self.blob),b'BIN\0')+self.blob)
        print(len(self.bones),'joints;',sum(len(p['i'])//3 for p in self.parts.values()),'triangles;',path.stat().st_size,'bytes')
