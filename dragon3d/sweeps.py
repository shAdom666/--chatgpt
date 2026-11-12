"""Curved, closed cross sections for the crown curl, spiral horns and scaled tail."""
from math import cos, pi, sin
from pathlib import Path
import numpy as np
from PIL import Image
from painted import TEMP, art, height, local_x

def spline(points,t):
    index=min(int(t*(len(points)-1)),len(points)-2)
    u=t*(len(points)-1)-index
    a,b,c,d=(points[max(0,min(len(points)-1,k))] for k in (index-1,index,index+1,index+2))
    return .5*(2*b+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u**3)

def crown_sweep(paint,name,knots):
    image=np.asarray(art(name))
    knots=np.array(knots,dtype=float)
    width,height_px=256,384
    atlas=np.zeros((height_px,width,3),dtype=np.uint8)
    def section(t):
        x,y,z,w=spline(knots,t)
        tangent=spline(knots,min(1,t+.001))[:2]-spline(knots,max(0,t-.001))[:2]
        normal=np.array([-tangent[1],tangent[0]])/max(.001,np.linalg.norm(tangent))
        return x,y,z,max(.4,w),normal
    angles=np.arange(width)*2*pi/(width-1)
    for j,t in enumerate(np.linspace(0,1,height_px)):
        x,y,z,r,normal=section(t)
        # Sample the painted interior along a section orthogonal to the spine.
        across=np.linspace(-1,1,160)
        px=np.rint(x+normal[0]*r*across).astype(int)
        py=np.rint(y+normal[1]*r*across).astype(int)
        samples=image[py,px]
        valid=(samples[:,3]>110)&(np.abs(across)<.96)
        if not np.any(valid):
            atlas[j]=atlas[max(0,j-1)] if j else [211,184,231]
            continue
        a=np.sin(angles)*.96
        atlas[j]=np.stack([np.interp(a,across[valid],samples[valid,k]) for k in range(3)],axis=1)
    path=Path(TEMP.name)/(name+'-sweep.png');Image.fromarray(atlas).save(path)
    mat=paint.avatar.material('Sculpted'+name,'FFFFFF',path)
    rows=[]
    for t in np.linspace(0,1,57):
        x,y,z,r,normal=section(t);ring=[]
        for k in range(33):
            a=k/32*2*pi
            px=x+normal[0]*r*sin(a);py=y+normal[1]*r*sin(a)
            ring.append(((local_x(px),height(py),z+.00123*r*cos(a)),None,(k/32,t)))
        rows.append(ring)
    paint.avatar.surface(mat,rows,'Head')

def build_crown(paint):
    crown_sweep(paint,'horn_left',[(315,293,-.065,24),(324,262,-.061,46),(349,214,-.058,47),
        (380,171,-.053,33),(392,142,-.028,24),(380,119,.003,17),(356,107,.048,12),
        (332,108,.078,6),(318,120,.097,.5)])
    crown_sweep(paint,'horn_right',[(696,291,-.067,29),(693,252,-.061,46),(672,204,-.058,43),
        (645,163,-.044,33),(625,132,-.018,23),(629,107,.009,17),(650,93,.053,12),
        (675,90,.083,6),(691,100,.101,.5)])
    crown_sweep(paint,'ahoge',[(496,167,-.028,3),(467,138,-.015,17),(452,99,.006,22),
        (464,62,.031,22),(497,36,.061,18),(535,31,.087,13),(569,43,.112,9),(592,72,.13,.6)])

def build_tail(avatar,points):
    yy,xx=np.mgrid[0:384,0:256]
    # Curved rows of overlapping scales, with a lilac ink seam and reflected light.
    v=yy/383;u=xx/255
    row=v*19;band=np.floor(row)
    arc=(u*10+.5*(band%2))%1
    edge=np.abs(row%1-(.21+.60*(1-(2*arc-1)**2)))
    seam=np.exp(-(edge/.055)**2)
    light=.5+.5*np.cos(2*pi*u)
    shade=np.array([195,159,218])+light[...,None]*np.array([44,55,34])-seam[...,None]*np.array([54,62,40])
    path=Path(TEMP.name)/'scales.png';Image.fromarray(np.uint8(np.clip(shade,0,255))).save(path)
    mat=avatar.material('PearlScales','FFFFFF',path)
    points=np.asarray(points);rows=[]
    for k,t in enumerate(np.linspace(0,1,73)):
        center=spline(points,t)
        along=spline(points,min(1,t+.001))-spline(points,max(0,t-.001));along/=np.linalg.norm(along)
        side=np.cross(along,[0,1,0]);side/=np.linalg.norm(side);up=np.cross(side,along)
        r=.008+.094*(1-t)**.70
        slot=min(t*6,5.9999);index=min(int(slot),5)
        w={'Tail'+str(index):1.}
        if index<5:w={'Tail'+str(index):1-slot%1,'Tail'+str(index+1):slot%1}
        ring=[]
        for j in range(33):
            a=2*pi*j/32;pos=center+r*(up*cos(a)+side*sin(a))
            ring.append((tuple(pos),w,(j/32,t)))
        rows.append(ring)
    avatar.surface(mat,rows,'Tail0')


def face_framing_locks(avatar):
    """Tapered locks turn around the temple and curl back toward the collar."""
    y,x=np.mgrid[0:384,0:256]
    t=y/383;a=2*pi*x/255
    stripe=a-.37*np.sin(2*pi*t+.3)
    base=.46+.28*np.cos(stripe)+.13*np.cos(2*stripe-.4)
    fine=.065*np.cos(4*stripe+.3)+.026*np.cos(9*stripe+.6*t)
    sheen=.17*np.exp(-((t-.30-.035*np.sin(a))/.12)**2)
    value=np.clip(base+fine+sheen,0,1)
    rgb=np.array([161,122,192])+value[...,None]*np.array([85,108,60])
    path=Path(TEMP.name)/'temple-silk.png';Image.fromarray(np.uint8(rgb)).save(path)
    mat=avatar.material('TempleRinglets','FFFFFF',path)
    # (x, y, z, half-width); the second curl passes behind the ear.
    locks=[[(.060,1.897,.036,.008),(.183,1.843,.119,.042),(.257,1.73,.164,.057),
            (.298,1.57,.148,.054),(.284,1.43,.153,.043),(.263,1.354,.136,.035),
            (.229,1.308,.144,.003)],
           [(.244,1.764,-.075,.022),(.319,1.64,-.09,.055),(.337,1.47,-.111,.052),
            (.310,1.34,-.085,.058),(.252,1.249,-.022,.053),(.245,1.194,.046,.045),
            (.296,1.139,.070,.033),(.321,1.080,.042,.018),(.301,1.057,.025,.002)]]
    for sign in (-1,1):
        for knots in locks:
            knots=np.asarray(knots);rows=[]
            for t in np.linspace(0,1,53):
                cx,cy,cz,r=spline(knots,t)
                tangent=(spline(knots,min(t+.001,1))-spline(knots,max(0,t-.001)))[:3]
                tangent/=np.linalg.norm(tangent)
                normal=np.array([.84,0,.54])
                width=np.cross(tangent,normal);width/=np.linalg.norm(width)
                outward=np.cross(width,tangent)
                ring=[]
                for k in range(25):
                    a=2*pi*k/24
                    pos=np.array([cx,cy,cz])+r*(width*np.sin(a)+.49*outward*np.cos(a))
                    pos[0]*=sign
                    ring.append((tuple(pos),None,(k/24,t)))
                rows.append(ring)
            avatar.surface(mat,rows,'Head',reverse=sign<0)
