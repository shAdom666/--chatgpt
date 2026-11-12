"""Editable parametric mesh and rig for the white/lilac dragon girl."""
from pathlib import Path
from math import sin,cos,pi,sqrt,exp
from glb import Avatar,sub,cross,unit
from movement import bake_clips
from drape import bind as bind_drape
from sweeps import build_crown, build_tail, face_framing_locks
from painted import PaintedMesh, build_face, build_ornament
from scalp import build_scalp
from limbs import build_arm, build_leg
from dress_details import brocade, flower_swatch, bell_sleeve, waist_sash
from costume import build_back_hair, build_gown, build_wing

here=Path(__file__).resolve().parent
avatar=Avatar()
bone=avatar.joint
colors=dict(skin='FFE1CE',blush='F3B8B3',hair='CFB6F5',shade='AA88D8',shine='EBDAFF',white='FFF6FF',silk='E2D0F7',trim='A782CA',horn='DABDEB',wing='C8A0EC',ink='62486E',gold='F1DBAE',gem='9264CE',sole='826992',brow='A98698',lip='CA7884')
colors.update(HandSkin='FFFFFF',LimbSkin='FFE3D6',Nail='F9D7D3',PearlKid='FFF7FF',VioletWelt='AA86BE',
              Heel='D8C1E7',Ribbon='DFC9F1',StrapEdge='A47FB6',SleeveLining='D7BDE9',RosePetal='FFF5FF')
m={name:avatar.material(name,color) for name,color in colors.items()}
m['SilkBrocade']=brocade(avatar)
m['CorsageSilk']=flower_swatch(avatar)
paint=PaintedMesh(avatar)

def grid(color,b,rows,cols,fn,weights=None,reverse=True):
    result=[]
    for r in range(rows+1):
        v=r/rows
        row=[]
        for c in range(cols+1):
            u=c/cols;p=fn(u,v)
            row.append((p,weights(p,u,v) if weights else None,(u,v)))
        result.append(row)
    avatar.surface(m[color],result,b,reverse)

def ball(color,b,p,s,limit=None,rows=12,cols=24):
    def sample(u,v):
        a=u*2*pi;t=.002+v*((limit(a) if limit else pi)-.004)
        return (p[0]+s[0]*sin(t)*sin(a),p[1]+s[1]*cos(t),p[2]+s[2]*sin(t)*cos(a))
    grid(color,b,rows,cols,sample)

def strand(color,b,path,width,depth=None,weights=None,sides=10):
    # Smooth Catmull-Rom centerline and elliptic cross section.
    def interp(data,t):
        q=min(t,1-1e-8)*(len(data)-1);i=int(q);f=q-i
        a,c0,c1,d=[data[max(0,min(len(data)-1,k))] for k in (i-1,i,i+1,i+2)]
        return .5*(2*c0+(-a+c1)*f+(2*a-5*c0+4*c1-d)*f*f+(-a+3*c0-3*c1+d)*f**3)
    axes=list(zip(*path))
    def point(t):return tuple(interp(axis,t) for axis in axes)
    rows=[]
    for k in range(4*(len(path)-1)+1):
        t=k/(4*(len(path)-1));center=point(t)
        along=unit(sub(point(min(1,t+.001)),point(max(0,t-.001))))
        ref=(0,0,1) if abs(along[2])<.97 else (0,1,0)
        a=unit(cross(along,ref));d=cross(along,a)
        w=max(.001,interp(width,t));h=max(.001,interp(depth or width,t))
        row=[]
        for j in range(sides+1):
            ang=2*pi*j/sides
            pos=tuple(center[q]+w*a[q]*cos(ang)+h*d[q]*sin(ang) for q in range(3))
            row.append((pos,weights(t) if weights else None,(j/sides,t)))
        rows.append(row)
    avatar.surface(m[color],rows,b)

bone('Hips',(0,.67,0))
bone('Chest',(0,1.,0),'Hips')
bone('Head',(0,1.22,0),'Chest')
# Waist, bodice and layered scalloped chiffon. The front slit exposes the legs.
bone('Skirt',(0,.76,0),'Hips')
bind_drape(avatar)
build_gown(paint,m)
waist_sash(avatar,m)
ball('skin','Head',(0,1.198,0),(.067,.089,.068))
build_face(paint,bone,strand)
build_scalp(paint)
face_framing_locks(avatar)
build_ornament(paint,strand,ball)
build_crown(paint)
for i in range(11):
    a=(i/10*1.22-.61)*pi
    x=.34*sin(a);z=-.175-.13*cos(a)
    name=bone('Lock'+str(i),(x,1.57,z),'Head')
    lower=bone('Curl'+str(i),(x*1.2,1.01,z),name)
build_back_hair(paint)
for s,label in [(-1,'L'),(1,'R')]:
    build_leg(avatar,m,s,label,ball,strand)
    build_arm(avatar,m,s,label,ball,strand)
    bell_sleeve(avatar,m,s,label)
    wing=bone('Wing'+label,(s*.125,1.03,-.115),'Chest')
    build_wing(paint,s,label)

# Articulated tapering tail with a ridge of lilac scales.
tail=[(0,.67,-.11),(.08,.51,-.32),(.25,.37,-.44),(.51,.31,-.48),(.637,.41,-.41),(.669,.56,-.335),(.627,.65,-.29)]
for i,p in enumerate(tail[:-1]):
    name=bone('Tail'+str(i),p,'Hips' if i==0 else 'Tail'+str(i-1))
build_tail(avatar,tail)
bake_clips(avatar)
avatar.save(here.parent/'live2d/model/dragon3d/Dragon.glb')
