"""Silk brocade, offset flounces and open bell sleeves in the dragon girl's palette."""
from math import cos, exp, pi, sin
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from painted import SOURCE, TEMP
from limbs import blend_joint

def brocade(avatar):
    # A repeat of mirrored leaf scrolls, with enough contrast to survive the desktop mip levels.
    size=512
    tile=Image.new('RGB',(size,size),(249,239,255))
    draw=ImageDraw.Draw(tile)
    def line(points,ink,width):
        draw.line([(round(x*size),round(y*size)) for x,y in points],fill=ink,width=width,joint='curve')
    for cx,cy in [(0,0),(1,0),(0,1),(1,1),(.5,.5)]:
        for dx in (-1,1):
            for dy in (-1,1):
                for scale in [1,.52]:
                    points=[]
                    for t in np.linspace(0,1,54):
                        a=1.7*pi*t
                        radius=.144*scale*(1-.85*t)
                        points.append((cx+dx*(.10*scale+radius*sin(a)),cy+dy*(.25*scale-radius*cos(a))))
                    line(points,(213,188,233),4)
                for t in [.38,.66]:
                    bx=cx+dx*.14*t;by=cy+dy*(.105+.21*t)
                    leaf=[(bx+dx*.045*sin(pi*u)+dx*.042*u,by+dy*.090*u) for u in np.linspace(0,1,12)]
                    leaf.extend((bx+dx*.042*u,by+dy*.090*u) for u in np.linspace(1,0,12))
                    draw.polygon([(int(x*size),int(y*size)) for x,y in leaf],fill=(222,202,240))
        line([(cx,cy-.086),(cx+.055,cy),(cx,cy+.086),(cx-.055,cy),(cx,cy-.086)],(211,184,232),4)
        draw.ellipse(((cx-.012)*size,(cy-.012)*size,(cx+.012)*size,(cy+.012)*size),fill=(190,162,218))
    path=Path(TEMP.name)/'SilkBrocade.png';tile.save(path)
    return avatar.material('SilkBrocade','FFFFFF',path)

def fabric_surface(avatar,material,bone,fn,rows,cols,weights=None,uv=None):
    rings=[]
    for j in range(rows+1):
        v=j/rows;ring=[]
        for k in range(cols+1):
            u=k/cols
            pos=fn(u,v)
            ring.append((pos,weights(pos,u,v) if weights else None,uv(u,v) if uv else (u,v)))
        rings.append(ring)
    avatar.surface(material,rings,bone,reverse=True)

def flower_swatch(avatar):
    flower=Image.open(SOURCE/'front-repair/arm_left.png').crop((373,619,444,683))
    path=Path(TEMP.name)/'CorsageSilk.png'
    flower.save(path)
    return avatar.material('CorsageSilk','FFFFFF',path)

def rosette(avatar,m,bone,center,radius,sign=0):
    # Curled petals open around a raised centre rather than lying on a flat medallion.
    cx,cy,cz=center
    for row,count in [(0,6),(1,5),(2,3)]:
        layer=(1,.67,.39)[row]
        for petal in range(count):
            base=2*pi*petal/count+row*.66
            def shape(u,v):
                w=sin(pi*u)**.7
                a=base+(u-.5)*(2*pi/count)*1.55+.91*v
                r=radius*layer*((.04 if row==2 else .38)+.60*v+.16*w*v)
                z=radius*(.05+row*.16+.42*w*sin(v*pi*.84)-.12*v)
                x=r*cos(a)
                return cx+x,cy+r*sin(a),cz+z-sign*.43*x
            def uv(u,v):
                x,y,z=shape(u,v)
                return .53+.40*(x-cx)/radius,.49-.40*(y-cy)/radius
            fabric_surface(avatar,m['CorsageSilk'],bone,shape,5,10,uv=uv)

def bell_sleeve(avatar,m,s,l):
    arm='Arm'+l;elbow='Forearm'+l
    def skin(pos,u,v):
        return blend_joint(arm,elbow,(.961-pos[1])/.073)
    def section(u,v,under=False):
        a=2*pi*u
        t=v
        spread=t*t*(1.15-.15*t)
        radius=.049+.042*spread
        if under:radius=.046+.035*spread
        radius*=1+.12*t*t*cos(7*a+.45*t)
        # The dorsal half trails the wrist; the palm side opens above the hand.
        y=1.055-.236*t-.063*t*t*(.5-.5*cos(a))+.013*t*t*cos(7*a+.45*t)
        if under:y-=.010*t*t
        axis=.18+(1.055-y)*.526
        z=.001+.079*min(.130,1.055-y)+.275*max(0,.925-y)
        return s*axis+radius*sin(a),y+s*.20*radius*sin(a),z+radius*.80*cos(a)
    fabric_surface(avatar,m['SleeveLining'],arm,lambda u,v:section(u,.52+.48*v,True),12,56,skin)
    fabric_surface(avatar,m['SilkBrocade'],arm,section,24,70,skin,lambda u,v:(3*u,1.6*v))
    def gathered_lip(u,v):
        a=2*pi*u
        t=.68+.21*v+.040*v*sin(3*a)
        x,y,z=section(u,t)
        extra=.003+.012*v*v*(1+.32*cos(7*a))
        return x+extra*sin(a),y+.004*v*cos(7*a),z+extra*cos(a)
    fabric_surface(avatar,m['SilkBrocade'],arm,gathered_lip,8,70,skin,lambda u,v:(3*u,1.04+.42*v))
    fabric_surface(avatar,m['Ribbon'],arm,lambda u,v:gathered_lip(u,.95+.05*v),2,70,skin)
    # Face the cut edge in lilac, then turn a fine white cord over the seam.
    for v0,v1,mat in [(.940,.975,'Ribbon'),(.975,1.,'PearlKid')]:
        def binding(u,v):
            x,y,z=section(u,v0+(v1-v0)*v);a=2*pi*u
            return x+.0018*sin(a),y,z+.0018*cos(a)
        fabric_surface(avatar,m[mat],arm,binding,3,70,skin)
    def turned_edge(u,v):
        outer=section(u,1);inner=section(u,1,True)
        return tuple((1-v)*a+v*b for a,b in zip(outer,inner))
    fabric_surface(avatar,m['Ribbon'],arm,turned_edge,2,70,skin)
    rosette(avatar,m,arm,(s*.195,1.045,.053),.043,s*.55)
    for d in [-1,1]:
        def bow(u,v):
            width=.012*(.7+v);drop=.057+.01*d
            x=s*(.196+.028*v+d*.019*v)+(u-.5)*2*width
            return x,1.025-drop*v+.009*abs(2*u-1)*v**6,.056+.008*sin(pi*v)
        fabric_surface(avatar,m['Ribbon'],arm,bow,8,6)

def waist_sash(avatar,m):
    def sash(u,v):
        a=2*pi*u
        return (.142+.003*sin(pi*v))*sin(a),.790+.016*v+.007*(1-cos(2*a)),(.118+.005*sin(pi*v))*cos(a)
    fabric_surface(avatar,m['Ribbon'],'Hips',sash,5,72)
    for s in (-1,1):
        rosette(avatar,m,'Hips',((-.115 if s<0 else .057),.792,.117),.029,s*.36)
