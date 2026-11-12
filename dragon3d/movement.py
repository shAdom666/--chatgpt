"""Pose library in rig-local coordinates; glTF rotations are xyzw."""
from math import sin,cos,pi
import drape
import clearance
from hands import resting_fingers
import numpy as np

def quat(x=0,y=0,z=0,hip_yaw=0):
    x,y,z=x/2,y/2,z/2
    q=(sin(x)*cos(y)*cos(z)+cos(x)*sin(y)*sin(z),cos(x)*sin(y)*cos(z)-sin(x)*cos(y)*sin(z),
            cos(x)*cos(y)*sin(z)+sin(x)*sin(y)*cos(z),cos(x)*cos(y)*cos(z)-sin(x)*sin(y)*sin(z))

    if not hip_yaw:
        return q
    # Turn the hip flexion plane toward the chest while keeping the ankle and knee in one chain.
    a,b=sin(hip_yaw/2),cos(hip_yaw/2)
    x,y,z,w=q
    return (b*x+a*z,b*y+a*w,b*z-a*x,b*w-a*y)

def posture(fold,sit,side,curl):
    pose=dict(Hips=(0,.06*side,1.49*side),Chest=(.44*fold-.22*curl,.03*side,-.38*curl),
              Head=(-.24*fold-.04*curl,-.10*side,-.19*curl),Skirt=(0,0,0))
    for sign,label in [(-1,'L'),(1,'R')]:
        pose['Thigh'+label]=(-1.02*fold-.68*sit+(-.15-.035*sign)*curl,.12*sign*(sit-curl),sign*(.09*fold-.19*curl),(.09-.14*sign)*curl)
        pose['Shin'+label]=(1.88*fold+.53*sit-(.22+.12*sign)*curl,0,0)
        pose['Foot'+label]=(-.87*fold+.14*side+(1.04+.08*sign)*curl,0,0)
        pose['Arm'+label]=(-.72*fold-.65*curl,.16*sign*side,sign*(.08-.38*side))
        pose['Forearm'+label]=(-.70*fold-.77*curl,sign*.15*side,-sign*.65*curl)
        pose['Hand'+label]=(-.13*fold-.13*curl,-sign*.28*curl,sign*(.15*side+.10*curl))
        pose['Wing'+label]=(.16*side,sign*(.35*fold+.65*side),-sign*.22*side)
        pose.update(resting_fingers(sign,label,side,curl))
    for i in range(11):
        pose['Lock'+str(i)]=(-.09*fold+.38*curl,-.05*side,.10*side)
        pose['Curl'+str(i)]=(.12*fold+.21*side,0,.15*side)
    for i in range(6):pose['Tail'+str(i)]=(-.16*side,.18*curl,.035*fold)
    return pose

def bake_clips(avatar):
    def clip(name,times,poses):
        samplers=[];channels=[];time=avatar.array(times,'SCALAR',bounds=True)
        for joint in sorted(set.union(*(set(p) for p in poses))):
            rots=[quat(*p.get(joint,(0,0,0))) for p in poses]
            output=avatar.array(rots,'VEC4')
            channels.append(dict(sampler=len(samplers),target=dict(node=avatar.bones[joint],path='rotation')))
            samplers.append(dict(input=time,output=output,interpolation='LINEAR'))
        avatar.doc['animations'].append(dict(name=name,channels=channels,samplers=samplers))
    stages=[(0,0,0,0),(.28,0,0,0),(.96,0,0,0),(1,.88,0,0),(1,1,.48,.20),(1,1,.9,.78),(1,1,1,1)]
    def pose_at(t):
        k=min(int(t),5);u=t-k;u=u*u*(3-2*u)
        stage=[a+(b-a)*u for a,b in zip(stages[k],stages[k+1])]
        return posture(*stage),stage
    times=[i/20 for i in range(121)]
    clip('StandToCurledSleep',times,[pose_at(t)[0] for t in times])
    cloth_times,cloth_frames=drape.frames(avatar,pose_at,quat)
    clearance.fit(avatar,cloth_times,cloth_frames,pose_at,quat)
    drape.emit(avatar,avatar.doc['animations'][-1],cloth_times,cloth_frames)
    poses=[]
    for i in range(33):
        phase=2*pi*i/32;pose={'Chest':(.025,.065*sin(phase),.022*cos(phase)),'Head':(0,-.04*sin(phase),0)}
        for s,l in [(-1,'L'),(1,'R')]:
            swing=s*sin(phase);bend=max(0,-s*cos(phase))
            pose.update({ 'Thigh'+l:(.50*swing,0,0),'Shin'+l:(.57*bend+.045,0,0),
                'Foot'+l:(-.42*swing-.45*bend,0,0),'Arm'+l:(-.31*swing,0,-s*.085),
                'Forearm'+l:(-.19-.11*swing,0,0),'Hand'+l:(.07*swing,0,0)})
        poses.append(pose)
    clip('Stride',[i/32 for i in range(33)],poses)

    # A stride starts from the same fitted neutral skirt as the posture clip.
    phases=np.linspace(0,2*pi,33)[:,None,None]
    row=np.linspace(0,1,drape.LEVELS)[None,:,None]
    angle=np.arange(drape.PANELS)[None,None,:]*2*pi/drape.PANELS
    walking=np.tile(cloth_frames[0],(33,1,1,1))
    walking[...,2]+=.048*row**1.5*np.sin(angle)*np.sin(phases-.5*row)
    walking[...,0]+=.013*row**2*np.cos(phases-.6*row)
    drape.emit(avatar,avatar.doc['animations'][-1],np.linspace(0,1,33),walking)
