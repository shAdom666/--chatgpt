"""A single painted scalp surface with a continuous part, fringe and side hairline."""
from math import pi
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from painted import SOURCE,TEMP,art,cut

def build_scalp(paint):
    front=art('front_hair_left','front_hair_center','front_hair_right')
    # The bangs terminate at the hairline in the registered front drawing.
    front=cut(front,[(231,419),(264,353),(318,323),(359,292),(387,240),(424,192),(465,164),
        (520,151),(578,165),(611,190),(643,227),(669,264),(721,306),(792,339),(834,395),
        (810,432),(750,440),(692,429),(666,443),(651,491),(623,531),(594,548),
        (616,497),(632,458),(638,425),(401,425),(402,480),(423,535),
        (395,524),(368,482),(332,441),(277,445)])
    profile=Image.open(SOURCE/'sideviews/right-body.png').convert('RGBA')
    profile=cut(profile,[(315,249),(439,202),(511,190),(560,199),(617,223),(665,258),
        (701,297),(720,341),(732,371),(707,359),(711,387),(696,415),(678,434),
        (686,397),(679,369),(662,352),(638,350),(614,379),(589,415),(584,444),
        (594,471),(617,500),(597,499),(616,513),(580,506),(556,487),(570,514),
        (543,500),(533,538),(512,573),(489,586),(502,558),(444,593),
        (368,571),(315,530),(295,435),(286,363)])
    back=art('back_hair_left','back_hair_center','back_hair_right')
    # Replace baked ears, horns and duplicated jewellery with adjoining hair strokes.
    # The corresponding sculpted parts remain independently visible on the model.
    def hair_only(im,side):
        data=np.array(im)
        y,x=np.mgrid[:im.height,:im.width]
        if side:
            ornament=((x-476)/53)**2+((y-354)/49)**2<1
            ornament|=(x>444)&(x<498)&(y>379)&(y<519)
            ornament|=(x<508)&(y<333)&(y>195)
            repl=np.clip(547+(x-477)*.36+9*np.sin(y*.012),515,582).astype(int)
            yy=np.clip(y-18,220,432)
        else:
            ornament=(x>644)&(y<518)&(x<787)
            repl=np.clip(1026-x,0,1023);yy=y
        feather=np.asarray(Image.fromarray(ornament.astype('uint8')*255).filter(ImageFilter.GaussianBlur(8)))/255
        mix=feather[:,:,None]
        data[:,:,:3]=data[:,:,:3]*(1-mix)+data[yy,repl,:3]*mix
        skin=data[:,:,0].astype(float)-data[:,:,2].astype(float)>12
        data[skin,3]=0
        return data
    front=hair_only(front,False);profile=hair_only(profile,True);back=np.asarray(back)
    def geometry(u,v):
        a=(u*2-1)*pi
        end=2.32-.38*np.cos(a)
        polar=.006+v*end
        radius=np.sin(polar)
        y=1.569+.345*np.cos(polar)
        x=.345*radius*np.sin(a)
        z=-.009+.308*radius*np.cos(a)
        # Pull the tapered cheek locks inward under the ears.
        x*=1-.13*np.clip((1.49-y)/.22,0,1)
        return x,y,z,a
    sy_keys=[0,159,553,620,770,1419,1536]
    y_keys=[2.18,1.91,1.235,1.105,.79,.023,-.13]
    w,h=1024,520
    vv,uu=np.mgrid[:h,:w]
    x,y,z,a=geometry(uu/(w-1),vv/(h-1))
    fy=np.interp(y,y_keys[::-1],sy_keys[::-1])
    fx=517+x/.00156
    sx=521+z/.00148
    sy=np.interp(fy,[130,158,300,440,553,625,710],[177,195,309,444,550,612,688])
    def read(im,x,y):
        return im[np.clip(np.rint(y).astype(int),0,1535),np.clip(np.rint(x).astype(int),0,1023)].astype(float)
    f=read(front,fx,fy);p=read(profile,sx,sy);b=read(back,fx,fy)
    crown=(y>1.84)
    f[crown&(f[:,:,3]<100)]=b[crown&(f[:,:,3]<100)]
    p[crown&(p[:,:,3]<100)]=b[crown&(p[:,:,3]<100)]
    # Use the clean reverse part low on the nape and at the crown pole.
    weight=np.clip((np.abs(a)-.60)/.84,0,1)
    weight=weight*weight*(3-2*weight)
    rear=np.clip((np.abs(a)-1.86)/.86,0,1)
    rear=rear*rear*(3-2*rear)
    def blend(im,over,k):
        k=k[:,:,None]
        alpha=im[:,:,3:]*(1-k)+over[:,:,3:]*k
        color=(im[:,:,:3]*im[:,:,3:]*(1-k)+over[:,:,:3]*over[:,:,3:]*k)/np.maximum(alpha,1)
        return np.concatenate([color,alpha],axis=2)
    rgba=blend(blend(f,p,weight),b,rear)
    # Above the temples the skull is covered even where an original drawing had a horn.
    covered=(y>1.695) | ((np.abs(a)>1.18)&(y>1.58))
    holes=covered&(rgba[:,:,3]<255)
    fill=read(back,510+x*280,np.clip(fy,182,483))
    opacity=rgba[holes,3:]/255
    rgba[holes,:3]=rgba[holes,:3]*opacity+fill[holes,:3]*(1-opacity)
    rgba[holes,3]=255
    path=Path(TEMP.name)/'crown-atlas.png';Image.fromarray(np.uint8(np.clip(rgba,0,255))).save(path)
    material=paint.avatar.material('PartedHair','FFFFFF',path)
    rows=[]
    for v in np.linspace(0,1,49):
        row=[]
        for u in np.linspace(0,1,109):
            x,y,z,a=geometry(u,v)
            row.append(((x,y,z),None,(u,v)))
        rows.append(row)
    paint.avatar.surface(material,rows,'Head',reverse=True)
