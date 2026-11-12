"""Loft painted garment and anatomy sections from the original registered drawings."""
from math import cos, pi, sin, sqrt
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image, ImageDraw, ImageChops

SOURCE = Path(__file__).resolve().parents[1] / 'live2d/source'
LAYERS = SOURCE / 'layers'
TEMP = TemporaryDirectory()
SCALE = .00156
CENTER = 517

def art(*names):
    result = Image.new('RGBA', (1024, 1536))
    for name in names:
        result.alpha_composite(Image.open(LAYERS / (name + '.png')).convert('RGBA'))
    return result

def cut(image, polygon):
    mask = Image.new('L', image.size)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    result = image.copy()
    result.putalpha(ImageChops.multiply(mask, image.getchannel('A')))
    return result

def height(y):
    return float(np.interp(y, [0, 159, 553, 620, 770, 1419, 1536],
                           [2.18, 1.91, 1.235, 1.105, .79, .023, -.13]))

def local_x(x):
    return (x - CENTER) * SCALE

def cylindrical_atlas(crop, y0, profile, lining, width=768):
    """Project front and profile art once into a continuous, angular UV atlas."""
    source=np.asarray(crop)
    theta=(np.arange(width)+.5)/width*2*pi-pi/2
    a,f=np.sin(theta),np.cos(theta)
    side=np.clip((np.abs(a)-.83)/.165,0,1)
    side=(side*side*(3-2*side))[:,None]
    back=np.asarray(lining.resize(crop.size)) if lining is not None else None
    profile_image,section=profile if profile is not None else (None,None)
    if profile_image is not None: profile_image=np.asarray(profile_image)
    atlas=np.zeros((crop.height,width,4),dtype=np.uint8)
    for y,line in enumerate(source):
        opaque=np.flatnonzero(line[:,3]>64)
        if len(opaque)<2: continue
        l,r=opaque[[0,-1]]
        indices=np.clip(np.rint((l+r)/2+(r-l)/2*a).astype(int),l,r)
        front=line[indices].copy()
        # A one-pixel ink edge is for the silhouette, not the middle of the profile.
        if back is not None: front[f<0]=back[y,indices[f<0]]
        if section is None:
            sx=(l+r)/2+(r-l)*.37*f
            sample=np.stack([np.interp(sx,opaque,line[opaque,k]) for k in range(3)],axis=1)
        else:
            py,left,right=section(y+y0)
            py=int(np.clip(round(py),0,profile_image.shape[0]-1))
            sx=np.clip(np.rint((left+right)/2+(right-left)*.48*f).astype(int),0,profile_image.shape[1]-1)
            sample=profile_image[py,sx,:3]
        atlas[y,:,:3]=np.round(front[:,:3]*(1-side)+sample*side)
        atlas[y,:,3]=np.round(front[:,3]*(1-side[:,0])+255*side[:,0])
    return Image.fromarray(atlas)

class PaintedMesh:
    def __init__(self, avatar):
        self.avatar = avatar

    def surface(self, name, image, bone, shape, *, weights=None, step=11, sides=52, lining=None, profile=None):
        """Use the drawing's row contour as a longitudinal section. UVs follow both halves of the volume."""
        box = image.getchannel('A').point(lambda a: 255 if a > 68 else 0).getbbox()
        x0, y0, x1, y1 = box
        crop = image.crop(box)
        texture = cylindrical_atlas(crop,y0,profile,lining,width=min(2048,max(768,3*crop.width)))
        path = Path(TEMP.name) / (name + '.png')
        texture.save(path)
        mat = self.avatar.material(name, 'FFFFFF', path)
        alpha = np.asarray(crop.getchannel('A'))
        rows = []
        for raw_y in np.linspace(0, crop.height-1, max(6, int(crop.height / step)) + 1):
            row = round(raw_y)
            xs = np.where(alpha[max(0,row-1):row+2].max(axis=0) > 48)[0]
            if len(xs) < 2:
                continue
            mid = x0 + (xs[0] + xs[-1]) * .5
            radius = max(1., (xs[-1] - xs[0]) * .5)
            y = y0 + raw_y
            ring = []
            for col in range(sides+1):
                # Start and finish at the left seam. Both side edges share UVs.
                angle = (col/sides*2-.5)*pi
                across, forward = sin(angle), cos(angle)
                px = mid + across*radius
                vertex = shape(px, y, mid, radius, across, forward)
                ring.append((vertex, weights(vertex,y,angle) if weights else None,
                             (col/sides,(raw_y+.5)/crop.height)))
            rows.append(ring)
        self.avatar.surface(mat,rows,bone,reverse=True)

    def patch(self, name, image, bone, shape, step=8):
        box=image.getchannel('A').getbbox()
        x0,y0,x1,y1=box
        crop=image.crop(box)
        path=Path(TEMP.name)/(name+'.png')
        crop.save(path)
        mat=self.avatar.material(name,'FFFFFF',path)
        rows=[]
        for v in np.linspace(0,1,max(3,(y1-y0)//step)+1):
            y=y0+(y1-y0-1)*v
            row=[]
            for u in np.linspace(0,1,max(4,(x1-x0)//step)+1):
                x=x0+(x1-x0-1)*u
                row.append((shape(x,y),None,(u,v)))
            rows.append(row)
        self.avatar.surface(mat,rows,bone,reverse=True)

def build_face(paint,bone,strand):
    # Sculpted jaw section and profile. The cheek, muzzle and nose all share the skin mesh.
    ys=[188,208,250,320,389,432,464,485,507,530,546,554]
    widths=[8,79,126,157,166,165,160,153,140,112,70,5]
    fronts=[.04,.12,.205,.253,.251,.247,.263,.288,.251,.226,.18,.14]
    def section(y):
        return float(np.interp(y,ys,widths))*SCALE,float(np.interp(y,ys,fronts))
    def depth(px,y):
        radius,front=section(y)
        q=min(.999,abs(local_x(px))/max(.001,radius))
        nose=.022*np.exp(-((px-CENTER)/17)**2-((y-476)/15)**2)
        return .018+(front-.018)*sqrt(max(0,1-q**2)) + nose
    # Use a solid skin base with a subtle blush. The original face-base sprite includes ear fragments.
    face=Image.new('RGBA',(1024,1536))
    draw=ImageDraw.Draw(face)
    for y in range(188,555):
        radius=section(y)[0]/SCALE
        draw.line((CENTER-radius,y,CENTER+radius,y),fill=(255,232,219,255))
    data=np.array(face)
    yy,xx=np.mgrid[188:555,345:690]
    flush=np.exp(-((np.abs(xx-CENTER)-115)/39)**2-((yy-482)/19)**2)
    skin=data[188:555,345:690,:3]
    skin[:]=skin*(1-flush[...,None]*.28)+np.array([248,159,166])*flush[...,None]*.28
    def head(px,y,mid,radius,a,f):
        z=depth(px,y) if f>=0 else .018+.225*f*(radius/166)**.75
        return local_x(px),height(y),z
    paint.surface('Complexion',Image.fromarray(data),'Head',head,step=5,sides=80)
    for sign,label,suffix in [(-1,'L','l'),(1,'R','r')]:
        x=CENTER+sign*83
        eye=bone('Eye'+label,(local_x(x),height(443),depth(x,443)),'Head')
        eye_image=art('eye_white_'+suffix,'iris_'+suffix,'eyelash_'+suffix)
        pixels=np.array(eye_image)
        yy,xx=np.mgrid[:eye_image.height,:eye_image.width]
        rim=((xx-(442 if sign<0 else 606))/55)**2+((yy-444)/44)**2
        skin=(pixels[:,:,0].astype(float)>pixels[:,:,2].astype(float)+10)&(pixels[:,:,0]>177)
        pixels[:,:,3][skin&(rim>.66)]=0
        eye_image=Image.fromarray(pixels)
        paint.patch('PaintedEye'+label,eye_image,eye,
                    lambda x,y:(local_x(x),height(y),depth(x,y)+.004),step=5)
        lid=bone('Lid'+label,(local_x(x),height(450),depth(x,450)),'Head')
        pts=[(x+sign*t,y) for t,y in [(-48,448),(-26,454),(0,457),(30,452),(50,442)]]
        strand('ink',lid,[(local_x(u),height(v),depth(u,v)+.008) for u,v in pts],
               [.0007,.0028,.0038,.003,.0006],sides=8)
        brow=[(x+sign*t,y) for t,y in [(-39,369),(0,358),(39,363)]]
        strand('brow','Head',[(local_x(u),height(v),depth(u,v)+.003) for u,v in brow],
               [.0005,.0037,.0007],sides=8)
        ear=art('ear_left' if sign<0 else 'ear_right')
        paint.surface('Ear'+label,ear,'Head',lambda px,y,m,r,a,f:(local_x(px),height(y),.004+.032*f*(r/60)),step=4)
    mouth=[(495,515),(506,516),(520,517),(533,515),(543,514)]
    strand('lip','Head',[(local_x(x),height(y),depth(x,y)+.004) for x,y in mouth],
           [.0007,.0024,.0026,.002,.0005],sides=10)

def build_ornament(paint,strand,ball):
    # A convex rosette with an actual open diamond chain and bell tassel.
    cx,cy,cz=.297,height(321),.149
    angle=.56
    def jewel(u,v,d):
        return cx+cos(angle)*u+sin(angle)*d,cy+v,cz-sin(angle)*u+cos(angle)*d
    texture=art('hair_ornament').crop((659,273,758,359))
    path=Path(TEMP.name)/'rosette.png';texture.save(path)
    mat=paint.avatar.material('SilkRosette','FFFFFF',path)
    rows=[]
    for j in range(24):
        t=.003+(pi-.006)*j/23;ring=[]
        for k in range(49):
            a=2*pi*k/48;u,v=sin(t)*sin(a),cos(t)
            ring.append((jewel(.082*u,.075*v,.040*sin(t)*cos(a)),None,(.50+.46*u,.51-.46*v)))
        rows.append(ring)
    paint.avatar.surface(mat,rows,'Head',reverse=True)
    for y in [-.103,-.154]:
        p=[jewel(x,y+v,.020) for x,v in [(0,.023),(.019,0),(0,-.024),(-.019,0),(0,.023)]]
        strand('trim','Head',p,[.006]*5,sides=10)
        ball('gem','Head',jewel(0,y,.020),(.007,.010,.007),rows=8,cols=8)
    ball('trim','Head',jewel(0,-.193,.021),(.014,.009,.012))
    strand('white','Head',[jewel(0,y,.021) for y in [-.197,-.220,-.264,-.272]],
           [.009,.011,.017,.014],[.008,.009,.013,.011])
