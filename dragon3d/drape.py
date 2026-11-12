"""Bake skirt controls against the moving legs in world space. Y is up."""
from math import atan2, pi
import numpy as np

PANELS=24
LEVELS=9
WAIST=.814
LENGTH=.80

def control(row,col):
    return f'Drape{row:02d}_{col%PANELS:02d}'

def cage():
    t=np.linspace(0,1,LEVELS)[:,None]
    a=np.arange(PANELS)[None,:]*2*pi/PANELS
    return np.stack([(.15+.407*t**1.12)*np.sin(a),
                     np.broadcast_to(WAIST-LENGTH*t,(LEVELS,PANELS)),
                     (.124+.157*t)*np.cos(a)-.022*t],axis=-1)

def bind(avatar):
    for j,ring in enumerate(cage()):
        for k,p in enumerate(ring):
            avatar.joint(control(j,k),tuple(p),'Skirt')

def weights(pos):
    x,y,z=pos
    t=np.clip((WAIST-y)/LENGTH,0,1)
    angle=atan2(x/(.15+.407*t**1.12),(z+.022*t)/(.124+.157*t))
    col=(angle*PANELS/(2*pi))%PANELS
    row=t*(LEVELS-1)
    i=min(int(row),LEVELS-2);k=int(col)
    v=row-i;u=col-k
    return {control(i,k):(1-v)*(1-u),control(i,k+1):(1-v)*u,
            control(i+1,k):v*(1-u),control(i+1,k+1):v*u}

def matrix(q):
    x,y,z,w=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                     [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                     [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])

def leg_geometry(avatar,pose,quat):
    root=np.asarray(avatar.centers['Hips'])
    hips=matrix(quat(*pose['Hips']))
    capsules=[]
    ground=[]
    for l in 'LR':
        thigh,shin,foot=['%s%s'%(j,l) for j in ['Thigh','Shin','Foot']]
        h,k,f=[np.asarray(avatar.centers[j]) for j in (thigh,shin,foot)]
        leg=hips@matrix(quat(*pose[thigh]))
        calf=leg@matrix(quat(*pose[shin]))
        shoe=calf@matrix(quat(*pose[foot]))
        hip=root+hips@(h-root)
        knee=hip+leg@(k-h)
        ankle=knee+calf@(f-k)
        toe=ankle+shoe@[0,-.066,.120]
        heel=ankle+shoe@[0,-.085,-.022]
        capsules.extend([(hip,knee,.075),(knee,ankle,.058),(heel,toe,.064)])
        ground.extend([toe[1]-.045,heel[1]-.019,knee[1]-.049])
    ground.extend([root[1]-.14,(root+hips@[0,.36,0])[1]-.17])
    return hips,root,capsules,min(ground)

def push_capsules(p,capsules,margin):
    for a,b,r in capsules:
        axis=b-a
        t=np.clip(np.sum((p-a)*axis,axis=-1)/np.dot(axis,axis),0,1)
        d=p-(a+t[...,None]*axis)
        dist=np.linalg.norm(d,axis=-1)
        p+=d*(np.maximum(0,r+margin-dist)/np.maximum(dist,1.e-8))[...,None]

def batches(rest):
    ids=np.arange(LEVELS*PANELS).reshape(LEVELS,PANELS)
    result=[]
    def links(a,b,stiff):
        a=a.ravel();b=b.ravel()
        length=np.linalg.norm(rest[b]-rest[a],axis=1)
        result.append((a,b,length,stiff))
    # Disjoint batches make the distance solve deterministic without indexed write races.
    for phase in (0,1):
        a=ids[:,phase::2]
        links(a,np.roll(ids,-1,axis=1)[:,phase::2],.82)
        links(ids[phase:-1:2],ids[phase+1::2],.96)
        for side in (-1,1):
            links(ids[phase:-1:2],np.roll(ids,-side,axis=1)[phase+1::2],.38)
    for phase in range(4):
        links(ids[phase:-2:4],ids[phase+2::4],.36)
        links(ids[:,phase::4],np.roll(ids,-2,axis=1)[:,phase::4],.20)
    return result

def frames(avatar,pose_at,quat):
    ring=cage();rest=ring.reshape(-1,3)
    pos=rest.copy();old=pos.copy()
    inv_mass=np.repeat(np.r_[0.,.65,np.ones(LEVELS-2)],PANELS)
    constraints=batches(rest)
    u=np.repeat(np.linspace(0,1,LEVELS),PANELS)
    angular=np.tile(np.arange(PANELS)*2*pi/PANELS,LEVELS)
    times=[];local=[]
    # Simulate in small fixed increments; replay uses the same cached path in either direction.
    for tick in range(361):
        time=tick/60
        pose,stage=pose_at(time)
        hips,root,body,floor=leg_geometry(avatar,pose,quat)
        floor-=.105*stage[3]  # The head and hair cushion the rolled pelvis above the ground.
        anchor=(rest-root)@hips.T+root
        active=min(1.,time/.85)
        if tick:
            velocity=(pos-old)*.88
            old=pos.copy()
            pos+=velocity
            pos[:,1]-=.00155*active*u
            # A loose bias cut retains a little flare. During the roll the free
            # train trails on the ground rather than rotating rigidly with the pelvis.
            bias=anchor.copy()
            curl=stage[3]
            bias[:,1]-=.30*curl*u**1.1
            bias[:,0]+=.09*curl*u
            bias[:,2]+=.028*curl*u*np.cos(6*angular+.7*u)
            # On the side, each front panel goes over its supporting knee first.
            # The free length beyond that ridge hangs in world-down and fans onto the floor.
            across=(1+np.sin(angular))*.5
            front=(1+np.cos(angular))*.5
            knee=body[0][1]+(body[3][1]-body[0][1])*across[:,None]
            ankle=body[1][1]+(body[4][1]-body[1][1])*across[:,None]
            waist=np.tile(anchor[:PANELS],(LEVELS,1))
            # Carry the two lips around opposite sides of the knees. The
            # upper seam rides the patella; the lower seam settles on the ground.
            side=np.sin(angular)
            ridge=knee.copy()
            ridge[:,0]+=.025+.175*(1-front)
            ridge[:,1]+=.028+.172*np.tanh(2.0*side)
            ridge[:,2]=waist[:,2]+front*(knee[:,2]+.107-waist[:,2])-.10*(1-front)
            fold=np.cos(4*angular-.48*u)
            edge=ankle.copy()
            edge[:,0]+=.092+.12*(1-front)-.080*front**4+.005*fold
            # The top lip rests across the shin and descends at its far end.
            # Let the opposite lip reach the floor, leaving the slippers visible.
            upper=.5+.5*np.tanh(2.6*side)
            edge[:,1]=floor+.020+.038*across+.207*upper*front**1.5+.007*(1+fold)
            edge[:,2]+=.137*np.cos(angular)+.007*fold
            # A rounded support and a common tangent keep the fabric grain
            # continuous as it changes from bearing weight to hanging freely.
            split=.44+.05*side
            t=np.clip(u/split,0,1)[:,None]
            h=np.maximum(0,(u-split)/(1-split))[:,None]
            crest=.33*(edge-waist)
            crest[:,1]*=.26
            crest[:,2]*=.12
            crown=(1-t)**2*waist+2*t*(1-t)*(ridge-crest*.5)+t*t*ridge
            # Carry the seam along the calf before the free end drops at the shoe.
            shin=.54*ridge+.46*edge
            shin[:,1]+=.030*upper*front
            shin[:,2]+=.020*front
            fall=(1-h)**3*ridge+3*h*(1-h)**2*(ridge+crest/3)+3*h*h*(1-h)*shin+h**3*edge
            hanging=np.where((u<=split)[:,None],crown,fall)
            hanging[:,2]+=.014*front*fold*np.sin(pi*u)**2
            guide=curl*curl*(3-2*curl)
            bias=bias*(1-guide)+hanging*guide
            follow=(.006+.026*(1-u)**3+(.27+.14*front)*guide)[:,None]
            pos+=(bias-pos)*follow
            for _ in range(8):
                for a,b,length,stiff in constraints:
                    delta=pos[b]-pos[a]
                    dist=np.linalg.norm(delta,axis=1)
                    amount=(1-length/np.maximum(dist,1.e-8))*stiff/np.maximum(1.e-8,inv_mass[a]+inv_mass[b])
                    amount=np.where(dist<length,amount*(1-.76*guide),amount)
                    correction=delta*amount[:,None]
                    pos[a]+=inv_mass[a,None]*correction
                    pos[b]-=inv_mass[b,None]*correction
                push_capsules(pos,body,.036)
                pos[:,1]=np.maximum(pos[:,1],floor+.012+.009*(1+np.cos(8*angular))*u**3)
                pos[:PANELS]=anchor[:PANELS]
        if tick%3==0 or time>=5:
            # Use true bind coordinates at progress zero, including the neutral hem clearance.
            fade=min(1.,time/.85);fade=fade*fade*(3-2*fade)
            # Turn the free corners behind the ankle rather than letting the
            # embroidered outer face hang vertically across the toe box. This
            # correction is fitted against the full leg meshes in the next pass.
            shaped=pos.copy()
            ankle_x=.5*(body[1][1][0]+body[4][1][0])
            past=np.maximum(0.,pos[:,0]-ankle_x+.025)
            tail=np.clip((u-.38)/.53,0,1)
            tail*=tail*(3-2*tail)
            front_arc=np.clip((np.cos(angular)+.45)/1.15,0,1)
            wrap=(stage[3]**2)*tail*front_arc
            shaped[:,0]-=wrap*.77*past
            shaped[:,2]-=wrap*.185*(1-np.exp(-past/.092))
            turn=1-np.exp(-past/.12)
            upper_lip=np.clip(np.sin(angular)*1.8,0,1)
            shaped[:,1]+=wrap*turn*(.069*upper_lip-.038)
            local.append((rest*(1-fade)+((shaped-root)@hips+root)*fade).reshape(LEVELS,PANELS,3))
            times.append(time)
    return np.asarray(times),np.asarray(local)

def emit(avatar,clip,times,local):
    time=avatar.array(times.tolist(),'SCALAR',bounds=True)
    origin=np.asarray(avatar.centers['Skirt'])
    for j in range(LEVELS):
        for k in range(PANELS):
            joint=control(j,k)
            data=(local[:,j,k]-origin).tolist()
            out=avatar.array(data,'VEC3')
            clip['channels'].append(dict(sampler=len(clip['samplers']),target=dict(node=avatar.bones[joint],path='translation')))
            clip['samplers'].append(dict(input=time,output=out,interpolation='LINEAR'))
