"""Registered couture, hair and wing surfaces, rigged in character space."""
from math import atan2, cos, exp, pi, sin, sqrt
import numpy as np
from PIL import Image
from painted import SOURCE, TEMP, art, height, local_x
from pathlib import Path
from dress_details import fabric_surface
from drape import weights as drape_weights

def amount(value):
    return max(0., min(1., value))

def build_back_hair(paint):
    hair=art('back_hair_left','back_hair_center','back_hair_right')
    profile=Image.open(SOURCE/'sideviews/right-body.png').convert('RGBA')
    heights=[158,230,320,420,510,570,650,750,850,930,1010,1100,1200,1280,1369]
    ys=[200,252,335,431,510,568,646,745,840,913,990,1068,1104,1120,1116]
    left=[480,420,370,313,275,261,228,199,198,159,157,162,165,165,169]
    right=[558,555,541,429,415,521,503,534,449,374,330,273,251,244,235]
    def profile_section(y):
        return tuple(float(np.interp(y,heights,key)) for key in (ys,left,right))
    def shape(px,y,mid,radius,a,f):
        t=amount((y-170)/1190)
        x=local_x(px)*(.98-.13*t)
        _,lo,hi=profile_section(y)
        zmid=((hi+lo)*.5-528)*.00136
        thick=max(.014,(hi-lo)*.00068)
        ridges=.018*cos(14*a+2.8*sin(9*t))+.009*cos(25*a-6*t)
        return x,height(y),zmid+(thick+ridges)*f
    def weights(pos,y,angle):
        # The same ring is bound to left, centre and right curl chains around its circumference.
        x,_,z=pos
        slot=amount(.5+x/(1.40 if z<-.25 else 1.20))*10
        left=min(9,int(slot));mix=slot-left
        root=amount((y-225)/200)
        tip=amount((y-570)/400)
        if root<1:
            return {'Head':1-root,'Lock'+str(left):root*(1-mix),'Lock'+str(left+1):root*mix}
        return {'Lock'+str(left):(1-tip)*(1-mix),'Lock'+str(left+1):(1-tip)*mix,
                'Curl'+str(left):tip*(1-mix),'Curl'+str(left+1):tip*mix}
    paint.surface('LongRinglets',hair,'Head',shape,weights=weights,step=9,sides=128,profile=(profile,profile_section))

def build_gown(paint,m):
    bodice=Image.open(SOURCE/'front-repair/dress_bodice.png').convert('RGBA')
    def corset(x,y,mid,r,a,f):
        return local_x(x)*.98,height(y),.005+(.105+.035*exp(-((y-650)/55)**2))*f
    def corset_weights(pos,y,angle):
        waist=amount((y-669)/86)
        return {'Hips':waist,'Chest':1-waist}
    def foundation(u,v):
        y=1.101-.323*v
        width=float(np.interp(v,[0,.17,.35,.60,.85,1],[.133,.136,.124,.102,.105,.116]))
        depth=float(np.interp(v,[0,.20,.40,.72,1],[.080,.103,.094,.074,.084]))
        a=2*pi*u
        return width*sin(a),y,.001+depth*cos(a)
    def foundation_weights(pos,u,v):
        waist=amount((1.01-pos[1])/.18)
        return {'Hips':waist,'Chest':1-waist}
    fabric_surface(paint.avatar,m['SilkBrocade'],'Chest',foundation,19,52,foundation_weights,
                   lambda u,v:(3*u,2*v))
    reference_fabric(paint,bodice,'LacedBodice','Chest',corset,corset_weights,m['SilkBrocade'],5,52)
    skirt=Image.open(SOURCE/'front-repair/dress_skirt.png').convert('RGBA')
    # Elevation in the painted flounces is reconstructed along their actual rolled seams.
    # Coordinates are in the registered dress drawing, so the highlights move with the cloth.
    ygrid,xgrid=np.mgrid[720:1420,0:950]
    ridges=np.zeros_like(xgrid,dtype=float)
    seams=[[(248,994),(272,983),(318,990),(352,973),(358,959),(341,942),(364,937),(398,957),(431,946),(457,921)],
           [(157,1172),(201,1159),(252,1168),(286,1176),(330,1161),(339,1144),(319,1118),(304,1094),(331,1080),(374,1067),(399,1044)],
           [(59,1312),(94,1293),(135,1287),(174,1295),(211,1272),(236,1242),(217,1224),(195,1222),(220,1221),(255,1240),(289,1237),(347,1211),(374,1190)]]
    for seam in seams:
        for mirror in [False,True]:
            pts=[(988-x if mirror else x,y) for x,y in seam]
            for (x1,y1),(x2,y2) in zip(pts,pts[1:]):
                # Limit each segment's work to its strip of fabric.
                left=max(0,min(x1,x2)-42);right=min(950,max(x1,x2)+43)
                low=max(720,min(y1,y2)-42);high=min(1420,max(y1,y2)+43)
                yy=ygrid[low-720:high-720,left:right]-y1;xx=xgrid[low-720:high-720,left:right]-x1
                dx=x2-x1;dy=y2-y1
                u=np.clip((xx*dx+yy*dy)/(dx*dx+dy*dy),0,1)
                bump=np.exp(-((xx-u*dx)**2+(yy-u*dy+4)**2)/270)
                region=ridges[low-720:high-720,left:right]
                np.maximum(region,bump,out=region)
    def skirt_shape(px,y,mid,r,a,f):
        t=amount((y-740)/670)
        drape=1+.082*t*cos(9*atan2(a,f)+t)
        x=(px-517)*(.0014-.00006*t)
        z=-.060*t**1.4+(.125+.224*t)*f*drape
        if f>0:
            z+=.024*t*f*sin(3*pi*a+.5*t)+.024*ridges[round(y)-720,round(px)]*f
        return x,height(y)-.008,z
    def skirt_weights(pos,y,ang):
        return drape_weights(pos)
    reference_fabric(paint,skirt,'EmbroideredOverskirt','Hips',skirt_shape,skirt_weights,m['SilkBrocade'],6,92)
    # The illustrated side flounces live on the outer silk. Cut vents in the
    # lining behind them so the calf reads through the side opening as it swings.
    def lining(u,v,panel):
        opening=.24+.60*v
        vent=.21*amount((v-.26)/.74)**.78
        side=1.18+.08*v
        limits=[(opening,side-vent),(side+vent,2*pi-side-vent),
                (2*pi-side+vent,2*pi-opening)]
        lo,hi=limits[panel]
        a=lo+(hi-lo)*u
        wave=cos(16*a+.35*v)
        radius=.122+.368*v**1.25+.012*v*v*wave
        x=radius*sin(a)
        z=(.095+.183*v+.007*wave*v)*cos(a)-.055*v**1.4
        y=.775-.676*v+.010*v*v*(1+wave)+.061*v**3*max(0,cos(a))**5
        return x,y,z
    for panel in range(3):
        def section(u,v):return lining(u,v,panel)
        def ribbon(u,v):
            x,y,z=section(u,.992+.008*v)
            return x*1.001,y-.0004,z*1.001
        fabric_surface(paint.avatar,m['SleeveLining'],'Hips',section,28,(24,94,24)[panel],
                       lambda pos,u,v:drape_weights(pos))
        fabric_surface(paint.avatar,m['Ribbon'],'Hips',ribbon,2,(24,94,24)[panel],
                       lambda pos,u,v:drape_weights(pos))
    # Two bias-cut facings frame the illustrated opening. Each has its own
    # hanging lip, narrowing from the knee rose toward the scalloped hem.
    for side in (-1,1):
        def facing(u,v):
            inner=.11+.58*v**.74
            a=side*(inner+(.36+.12*v-.18*v**2)*u)
            rib=cos(2*pi*(u-.09*v))
            tail=.55+.085*u-.034*(1-u)**2
            y=.783-tail*v+.012*v**2*(1-rib)
            x=(.130+.30*v**1.18)*sin(a)
            z=(.102+.139*v)*cos(a)-.015*v+.010*v**.76*(1-.44*v)*rib
            return x,y,z
        fabric_surface(paint.avatar,m['SilkBrocade'],'Hips',facing,34,24,
                       lambda pos,u,v:drape_weights(pos),lambda u,v:(.65*u,1.65*v))
def wrapped_train(crop,bounds):
    # The front and back use angular UVs so each side can carry its painted
    # trailing panel, forward panel and the negative space between them.
    x0,y0,_,_=bounds
    front=np.asarray(crop)
    profile=np.asarray(Image.open(SOURCE/'sideviews/right-body.png').convert('RGBA'))
    tile=np.asarray(Image.open(Path(TEMP.name)/'SilkBrocade.png').convert('RGB'))
    keys=[740,805,890,975,1060,1155,1265,1409]
    source_y=[758,812,890,968,1054,1146,1248,1344]
    rear_x=[563,491,399,312,264,218,182,118]
    lead_x=[658,697,721,739,741,750,781,816]
    # The rear mask follows the seam between hair and silk in the drawing.
    mid_x=[606,602,595,585,571,562,548,540]
    width=1200
    u=(np.arange(width)+.5)/width
    images=[]
    for rear in [False,True]:
        angle=(u-.5)*pi+(pi if rear else 0)
        side=np.sin(angle);depth=np.cos(angle)
        blend=np.clip((np.abs(side)-.57)/.34,0,1)
        blend=(blend*blend*(3-2*blend))[:,None]
        out=np.zeros((crop.height,width,4),dtype=np.uint8)
        for r in range(crop.height):
            y=y0+r
            sy=int(np.interp(y,keys,source_y))
            lo,hi,mid=[np.interp(y,keys,values) for values in (rear_x,lead_x,mid_x)]
            sx=np.rint(mid+np.where(depth<0,mid-lo,hi-mid)*depth).astype(int)
            profile_row=profile[sy,sx].astype(float)
            span=np.flatnonzero(front[max(0,r-2):r+3,:,3].max(axis=0)>48)
            if not len(span):continue
            if rear:
                original=np.ones((width,4))*255
                original[:,:3]=tile[int(r*2.2)%len(tile),(u*4*tile.shape[1]).astype(int)%tile.shape[1]]*(.92+.045*np.cos(8*pi*u))[:,None]
            else:
                original=front[r,np.rint((span[0]+span[-1])*.5+(span[-1]-span[0])*.5*side).astype(int).clip(0,crop.width-1)].astype(float)
            alpha=original[:,3:]*(1-blend)+profile_row[:,3:]*blend
            rgb=(original[:,:3]*original[:,3:]*(1-blend)+profile_row[:,:3]*profile_row[:,3:]*blend)/np.maximum(alpha,1)
            out[r]=np.concatenate([rgb,alpha],axis=1).clip(0,255)
        images.append(Image.fromarray(out))
    return images

def reference_fabric(paint,image,name,bone,shape,weights,back_material,step,cols):
    """UV-project the intact embroidery onto a fitted front and sew a separate back at the side seams."""
    crop_box=image.getbbox();x0,y0,x1,y1=crop_box
    crop=image.crop(crop_box);alpha=np.asarray(crop.getchannel('A'))
    painted_back=name=='EmbroideredOverskirt'
    if painted_back:
        crop,back_image=wrapped_train(crop,crop_box)
        rear_path=Path(TEMP.name)/'TrainBack.png'
        back_image.save(rear_path)
        back_material=paint.avatar.material('TrainBack','FFFFFF',rear_path)
    path=Path(TEMP.name)/(name+'.png');crop.save(path)
    mat=paint.avatar.material(name,'FFFFFF',path)
    ys=np.linspace(0,crop.height-1,max(8,crop.height//step)+1)
    front=[];back=[]
    for ry in ys:
        row=int(round(ry));pxs=np.where(alpha[max(0,row-2):row+3].max(axis=0)>48)[0]
        if len(pxs)<2:continue
        mid=x0+(pxs[0]+pxs[-1])/2;r=(pxs[-1]-pxs[0])/2
        y=y0+ry
        for rings,rear in [(front,False),(back,True)]:
            ring=[]
            for k in range(cols+1):
                u=k/cols;a=(u-.5)*pi+(pi if rear else 0)
                px=mid+r*sin(a)
                pos=shape(px,y,mid,r,sin(a),cos(a))
                if rear and name=='EmbroideredOverskirt':
                    # Drop the continuous back panel behind the legs and keep its
                    # scalloped edge higher than the embroidered front.
                    t=amount((y-740)/670)
                    lift=.074*t**3*cos(a)**2
                    pos=(pos[0],pos[1]+lift,pos[2]-.026*t*abs(cos(a)))
                if rear:
                    uv=(u,(ry+.5)/crop.height) if painted_back else (u*4,(y-y0)/165)
                else:
                    uv=(u if painted_back else (px-x0+.5)/crop.width,(ry+.5)/crop.height)
                ring.append((pos,weights(pos,y,a),uv))
            rings.append(ring)
    paint.avatar.surface(mat,front,bone,reverse=True)
    paint.avatar.surface(back_material,back,bone,reverse=True)

def build_wing(paint,sign,label):
    wing=art('wing_left' if sign<0 else 'wing_right')
    def camber(x,y):
        span=abs(x-517)/505
        return local_x(x)*.94,height(y),-.165-.09*span+.065*sin(pi*span)-.00023*(y-620)
    paint.patch('WingMembrane'+label,wing,'Wing'+label,camber,step=10)
