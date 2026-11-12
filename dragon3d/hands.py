"""Sculpt a continuous wrist, palm, thumb web and five digits in hand-local space."""
from math import pi
import numpy as np

def unit(v):
    return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-12)

def ellipsoid(p,c,r):
    q=(p-c)/r
    return (np.linalg.norm(q,axis=-1)-1)*min(r)

def capsule(p,a,b,ra,rb):
    axis=b-a
    t=np.clip(np.sum((p-a)*axis,axis=-1)/np.dot(axis,axis),0,1)
    return np.linalg.norm(p-(a+t[...,None]*axis),axis=-1)-(ra+(rb-ra)*t)

def union(a,b,k):
    h=np.maximum(k-np.abs(a-b),0)/k
    return np.minimum(a,b)-k*.25*h*h

def smooth(t):
    t=np.clip(t,0,1)
    return t*t*(3-2*t)

def triangulate(field,origin,step):
    # One vertex per boundary cell, located at the mean of its surface crossings.
    offsets=np.array([[i,j,k] for i in range(2) for j in range(2) for k in range(2)])
    shape=np.array(field.shape)-1
    corners=[field[i:i+shape[0],j:j+shape[1],k:k+shape[2]] for i,j,k in offsets]
    mask=(np.minimum.reduce(corners)<=0)&(np.maximum.reduce(corners)>0)
    cells=np.argwhere(mask);values=np.stack([c[mask] for c in corners],axis=1)
    coords=np.zeros_like(cells,dtype=float);count=np.zeros(len(cells))
    for i,a in enumerate(offsets):
        for j,b in enumerate(offsets[:i]):
            if np.sum(np.abs(a-b))!=1:continue
            hits=(values[:,i]<=0)!=(values[:,j]<=0)
            t=values[hits,i]/(values[hits,i]-values[hits,j])
            coords[hits]+=a+t[:,None]*(b-a);count[hits]+=1
    vertices=origin+step*(cells+coords/count[:,None])
    ids=np.full(shape,-1);ids[mask]=np.arange(len(cells))
    tris=[]
    for axis in range(3):
        start=np.array([1,1,1]);start[axis]=0
        stop=np.array(field.shape)-1
        grid=tuple(slice(a,b) for a,b in zip(start,stop))
        shift=np.eye(3,dtype=int)[axis]
        other=tuple(slice(a,b) for a,b in zip(start+shift,stop+shift))
        hits=np.argwhere((field[grid]<=0)!=(field[other]<=0))+start
        u=np.eye(3,dtype=int)[(axis+1)%3];v=np.eye(3,dtype=int)[(axis+2)%3]
        quad=np.stack([ids[tuple(q.T)] for q in [hits-u-v,hits-v,hits,hits-u]],axis=1)
        reverse=field[tuple(hits.T)]>0
        quad[reverse]=quad[reverse,::-1]
        tris.extend([quad[:,[0,1,2]],quad[:,[0,2,3]]])
    return vertices,np.concatenate(tris)

def palm_basis(side):
    long=unit(np.array([.46,-.856,.233]))
    wide=unit(np.array([-long[1],long[0],0]))
    basis=np.stack((wide,long,-unit(np.cross(wide,long))),axis=1)
    basis[0]*=side
    return basis


def digit_proportions():
    # Digit centre lines; the staggered MCP heads follow a shallow transverse arch.
    digits=[
        [(-.022,.022,-.004),(-.040,.034,-.012),(-.055,.047,-.018),(-.069,.060,-.022)],
        [(-.025,.061,.001),(-.030,.082,.000),(-.032,.104,-.004),(-.034,.119,-.009)],
        [(-.007,.067,.003),(-.008,.093,.001),(-.009,.114,-.005),(-.010,.131,-.011)],
        [(.011,.066,.001),(.014,.089,-.001),(.016,.109,-.008),(.017,.123,-.015)],
        [(.028,.058,-.002),(.036,.076,-.004),(.040,.091,-.012),(.042,.101,-.020)]]
    digits=np.asarray(digits)
    radii=np.array([[.012,.011,.0097,.0062],[.010,.0090,.0076,.0058],[.0104,.0094,.0080,.0060],
                    [.0098,.0088,.0075,.0054],[.0084,.0077,.0066,.0048]])
    return digits,radii


DIGITS,RADII=digit_proportions()


def axis_euler(axis,angle):
    # Convert a hinge in bind space to XYZ Euler angles for the clip writer.
    x,y,z=unit(axis)*np.sin(angle/2)
    w=np.cos(angle/2)
    return (np.arctan2(2*(w*x-y*z),1-2*(x*x+y*y)),
            np.arcsin(np.clip(2*(x*z+w*y),-1,1)),
            np.arctan2(2*(w*z-x*y),1-2*(y*y+z*z)))


def resting_fingers(side,label,roll,curl):
    basis=palm_basis(side)
    def hinge(axis,angle):
        # An axis is an axial vector: reflect its handedness on the other hand.
        return axis_euler(np.linalg.det(basis)*(basis@unit(axis)),angle)
    result={}
    for name,angle in [('RingCup',.105),('LittleCup',.205)]:
        result[name+label]=hinge([0,1,.10],angle*curl)
    for i,chain in enumerate(DIGITS):
        # Ulnar digits yield first. The index stays long, under the cheek.
        delay=[.17,.14,.09,.045,0][i]
        closing=smooth((.12*roll+.88*curl-delay)/(1-delay))
        angles=[(.60,.38,.25),(.32,.52,.24),(.45,.68,.31),
                (.58,.78,.40),(.65,.87,.47)][i]
        for j,stem in enumerate(('Finger','FingerTip','Distal')):
            tangent=unit(chain[j+1]-chain[j])
            toward=np.array([-.12*(i-2),.10,-1.])
            if i==0:
                # Opposition brings the thumb pad across, toward the index,
                # without driving the thumb straight into the palm.
                toward=np.array([.66,.62,-.89]) if j==0 else np.array([.84,.45,-.46])
            axis=np.cross(tangent,toward)
            result[stem+label+str(i)]=hinge(axis,angles[j]*closing*(1 if side==1 else .88))
    return result


def build_hand(avatar,m,s,l):
    wrist=np.array(avatar.centers['Hand'+l])
    basis=palm_basis(s)
    def world(p):
        return np.asarray(p)@basis.T+wrist
    digits,radii=DIGITS,RADII
    cups=['RingCup'+l,'LittleCup'+l]
    for name,x in zip(cups,[.010,.023]):
        avatar.joint(name,tuple(world([x,.011,-.002])),'Hand'+l)
    names=[]
    for i,chain in enumerate(digits):
        labels=['Finger'+l+str(i),'FingerTip'+l+str(i),'Distal'+l+str(i)]
        for j,name in enumerate(labels):
            avatar.joint(name,tuple(world(chain[j])),(cups[i-3] if i>=3 else 'Hand'+l) if j==0 else labels[j-1])
        names.append(labels)
    def fields(p):
        palm=ellipsoid(p,[0,.033,0],[.037,.043,.014])
        palm=union(palm,ellipsoid(p,[.001,.002,0],[.023,.027,.016]),.004)
        # The thenar and hypothenar pads fall away into a shallow central cup.
        palm=union(palm,ellipsoid(p,[-.018,.029,-.009],[.020,.030,.013]),.005)
        palm=union(palm,ellipsoid(p,[.022,.034,-.008],[.014,.029,.011]),.004)
        parts=[]
        for i,chain in enumerate(digits):
            d=None
            for j in range(3):
                # Oval shafts narrow on the dorsal side between the knuckles.
                start,end=chain[j],chain[j+1]
                tangent=unit(end-start)
                transverse=unit(np.cross(tangent,[0,0,1]))
                back=np.cross(transverse,tangent)
                offset=p-start
                span=np.linalg.norm(end-start)
                along=np.sum(offset*tangent,axis=-1)
                fraction=np.clip(along/span,0,1)
                radius=radii[i,j]*(1-fraction)+radii[i,j+1]*fraction
                radius*=1-.046*np.sin(pi*fraction)**2
                across=np.sum(offset*transverse,axis=-1)
                depth=np.sum(offset*back,axis=-1)
                cap=along-fraction*span
                seg=np.sqrt((across/1.03)**2+(depth*np.where(depth>0,1.17,1.035))**2+cap**2)-radius
                d=seg if d is None else union(d,seg,.002)
            # Raised knuckle and fingertip pads soften the change of section
            # between the shafts while leaving a defined nail bed on the back.
            for j in (1,2):
                r=radii[i,j]
                d=union(d,ellipsoid(p,chain[j]+[0,0,r*.16],[r*1.018,r*1.26,r*.82]),.0011)
            r=radii[i,3]
            d=union(d,ellipsoid(p,chain[3]+[0,-.001,-r*.24],[r*.96,r*1.13,r*.86]),.001)
            parts.append(d)
            base=chain[0].copy();base[1]-=.006;base[2]-=.004
            palm=union(palm,ellipsoid(p,base,[radii[i,0]*1.27,.012,.010]),.004)
        # A sloping first interdigital web attaches the thumb to the index metacarpal.
        palm=union(palm,capsule(p,np.array([-.038,.036,-.008]),np.array([-.026,.055,0]),.007,.008),.005)
        # Low dorsal metacarpal ridges fan from the wrist into the knuckles.
        for i in range(1,5):
            end=digits[i,0].copy();end[2]+=.0059
            start=np.array([end[0]*.49,.014,.009])
            palm=union(palm,capsule(p,start,end,.0024,.0032),.0025)
        return palm,np.stack(parts,axis=-1)
    def sdf(p):
        skin,d=fields(p)
        for i in range(5):skin=union(skin,d[...,i],.004)
        return skin
    origin=np.array([-.079,-.036,-.038]);step=.00154
    coord=np.stack(np.meshgrid(*(np.arange(a,b,step) for a,b in zip(origin,[.058,.147,.031])),indexing='ij'),axis=-1)
    v,tri=triangulate(sdf(coord),origin,step)
    normal=unit(np.stack([(sdf(v+e*.00023)-sdf(v-e*.00023)) for e in np.eye(3)],axis=1))
    palm,d=fields(v)
    distance=np.column_stack((palm,d));weights=np.exp(-(distance-distance.min(axis=1)[:,None])/.0020)
    weights/=weights.sum(axis=1)[:,None]
    count=len(v);skin=np.zeros((count,18))
    skin[:,0]=weights[:,0]
    for i,chain in enumerate(digits):
        # Each bend influences the neighbouring shaft through an overlap band.
        f=[smooth((np.sum((v-p)*unit(chain[min(j+1,3)]-chain[max(0,j-1)]),axis=1)+.005)/.010)
           for j,p in enumerate(chain[:3])]
        w=weights[:,i+1];a=1+3*i
        skin[:,0]+=w*(1-f[0])
        skin[:,a]=w*f[0]*(1-f[1])
        skin[:,a+1]=w*f[0]*f[1]*(1-f[2])
        skin[:,a+2]=w*f[0]*f[1]*f[2]
    # Spread cupping through the fleshy heel instead of kinking the finger roots.
    band=smooth((v[:,1]-.012)/.042)*smooth((v[:,0]+.002)/.024)
    ulnar=smooth((v[:,0]-.013)/.015)
    skin[:,16]=skin[:,0]*band*(1-ulnar)
    skin[:,17]=skin[:,0]*band*ulnar
    skin[:,0]-=skin[:,16]+skin[:,17]
    ids=np.argsort(-skin,axis=1)[:,:4];ws=np.take_along_axis(skin,ids,axis=1);ws/=ws.sum(axis=1)[:,None]
    joints=np.array([avatar.bones['Hand'+l]]+[avatar.bones[n] for chain in names for n in chain]+[avatar.bones[b] for b in cups])
    # Low-contrast palmar creases and a warmer fingertip pad survive a close look.
    x,y,z=v.T
    crease=np.zeros(count)
    def stroke(points,width):
        value=np.zeros(count)
        for a,b in zip(points,points[1:]):
            a,b=np.array(a),np.array(b);ab=b-a
            u=np.clip(((v[:,:2]-a)@ab)/np.dot(ab,ab),0,1)
            diff=v[:,:2]-(a+u[:,None]*ab)
            value=np.maximum(value,np.exp(-np.sum(diff**2,axis=1)/(width**2)))
        return value
    for pts,width in [([(-.028,.049),(-.016,.045),(.001,.046),(.019,.052),(.029,.052)],.0013),
                      ([(-.032,.042),(-.018,.037),(-.009,.026),(-.008,.015),(-.013,.008)],.0015),
                      ([(-.012,.056),(.003,.054),(.019,.059),(.026,.058)],.0012),
                      ([(-.014,.006),(.002,.004),(.015,.006)],.0007)]:
        crease=np.maximum(crease,stroke(pts,width))
    for chain,rad in zip(digits,radii):
        for j in (1,2):
            cx,cy=chain[j,:2]
            width=rad[j]*.67
            crease=np.maximum(crease,.56*stroke([(cx-width,cy),(cx,cy-.0012),(cx+width,cy+.0003)],.0012))
    palmar=smooth((-normal[:,2]-.12)/.70)
    warm=smooth((y-.069)/.050)*.44+palmar*.19
    rgb=np.array([255,229,218])-warm[:,None]*[1,19,17]-((.36*crease+.085)*palmar)[:,None]*[13,47,39]
    # Colour attributes in glTF are linear.
    rgb=np.clip(rgb/255,0,1);rgb=np.where(rgb<.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    part=avatar.parts[m['HandSkin']];base=len(part['p'])
    part['p'].extend(world(v).tolist());part['n'].extend((normal@basis.T).tolist())
    part['j'].extend(joints[ids].tolist());part['w'].extend(ws.tolist())
    part['uv'].extend([(0,0)]*count);part.setdefault('color',[]).extend(rgb.tolist())
    if np.linalg.det(basis)<0:tri=tri[:,::-1]
    part['i'].extend((base+tri.ravel()).tolist())
    for i,chain in enumerate(digits):
        # A curved nail plate seated on the distal phalanx, with a tapered free edge.
        axis=unit(chain[3]-chain[2]);across=unit(np.cross(axis,[0,0,1]));up=unit(np.cross(across,axis))
        center=chain[3]-.0042*axis+radii[i,3]*.78*up
        rows=[]
        for j in range(13):
            t=j/12;ring=[]
            for k in range(17):
                u=k/8-1
                width=radii[i,3]*.80*(.34+.66*np.sin(pi*(.09+.82*t))**.6)
                p=center+axis*((t-.5)*.010+.0017*u*u*(1-2*t))+across*u*width+up*(.0015*(1-u*u)+.0007*np.sin(pi*t))
                ring.append((tuple(world(p)),None,(k/16,t)))
            rows.append(ring)
        avatar.surface(m['Nail'],rows,names[i][2],reverse=s<0)
        # Tint the nail bed from the cuticle to its narrow pearl free edge.
        part=avatar.parts[m['Nail']]
        swatch=part.setdefault('color',[])
        for t in np.linspace(0,1,13):
            for u in np.linspace(-1,1,17):
                moon=(1-smooth((t-.075+.09*u*u)/.105))*.39
                tip=smooth((t-.855-.045*u*u)/.105)*.69
                glow=.086*(1-u*u)*np.sin(pi*t)
                base=np.array([.95,.85,.88])
                swatch.append((base+(1-base)*min(1.,moon+tip+glow)).tolist())
