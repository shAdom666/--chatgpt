"""Continuous arm and leg surfaces, articulated hands and fitted dancing shoes (Y up)."""
from math import cos, pi, sin
import numpy as np
from sweeps import spline
from hands import build_hand

def blend_joint(first,second,t):
    t=max(0.,min(1.,t))
    t=t*t*(3-2*t)
    return {first:1-t,second:t}

def loft(avatar,material,bone,sections,weights=None,rows=36,sides=32):
    """Interpolate anatomical cross sections (centre XYZ, transverse and sagittal radii)."""
    sections=np.asarray(sections)
    rings=[]
    for i in range(rows+1):
        t=i/rows
        x,y,z,rx,rz=spline(sections,t)
        w=weights(y) if weights else None
        ring=[]
        for k in range(sides+1):
            a=2*pi*k/sides
            ring.append(((x+max(.0002,rx)*sin(a),y,z+max(.0002,rz)*cos(a)),w,(k/sides,t)))
        rings.append(ring)
    avatar.surface(material,rings,bone,reverse=True)

def build_arm(avatar,m,s,l,ball,strand):
    arm='Arm'+l;elbow='Forearm'+l;hand='Hand'+l
    avatar.joint(arm,(s*.164,1.083,0),'Chest')
    avatar.joint(elbow,(s*.249,.925,.011),arm)
    avatar.joint(hand,(s*.342,.788,.051),elbow)
    sections=[(.163,1.124,-.001,.004,.004),(.167,1.100,0,.038,.041),
              (.179,1.073,0,.046,.049),(.200,1.021,.003,.040,.041),
              (.232,.955,.005,.033,.035),(.249,.925,.011,.034,.031),
              (.267,.895,.015,.039,.032),(.301,.850,.030,.032,.029),
              (.333,.799,.047,.023,.020),(.345,.783,.052,.019,.015)]
    def arm_weights(y):
        if y>.823:return blend_joint(arm,elbow,(.961-y)/.073)
        return blend_joint(elbow,hand,(.812-y)/.045)
    loft(avatar,m['LimbSkin'],arm,[(s*x,y,z,rx,rz) for x,y,z,rx,rz in sections],arm_weights)
    build_hand(avatar,m,s,l)

def build_leg(avatar,m,s,l,ball,strand):
    thigh='Thigh'+l;shin='Shin'+l;foot='Foot'+l
    cx=s*.112
    avatar.joint(thigh,(cx,.67,0),'Hips')
    avatar.joint(shin,(cx,.385,.012),thigh)
    avatar.joint(foot,(cx,.116,0),shin)
    def weights(y):
        if y>.18:return blend_joint(thigh,shin,(.415-y)/.060)
        return blend_joint(shin,foot,(.141-y)/.050)
    sections=[(.112,.714,-.003,.008,.012),(.112,.677,-.002,.054,.060),
              (.114,.622,-.003,.063,.067),(.117,.545,-.006,.062,.062),
              (.114,.464,.000,.053,.055),(.112,.410,.010,.043,.045),
              (.112,.385,.015,.042,.044),(.114,.356,.006,.042,.042),
              (.117,.303,-.006,.049,.049),(.117,.250,-.008,.043,.045),
              (.115,.183,-.006,.033,.036),(.112,.129,.000,.026,.030),
              (.112,.106,.012,.027,.027),(.112,.092,.027,.025,.023)]
    loft(avatar,m['LimbSkin'],thigh,[(s*x,y,z,rx,rz) for x,y,z,rx,rz in sections],weights)
    # A turned outsole, toe box and instep with a low separate block heel.
    shapes=[(.111,-.005,.021,.036),(.102,.005,.035,.046),(.090,.020,.040,.062),
            (.073,.048,.045,.087),(.058,.056,.048,.100),(.043,.055,.050,.104),
            (.036,.053,.049,.104)]
    loft(avatar,m['PearlKid'],foot,[(cx,y,z,rx,rz) for y,z,rx,rz in shapes],rows=26)
    loft(avatar,m['VioletWelt'],foot,[(cx,.041,.053,.050,.104),(cx,.035,.053,.051,.105),
        (cx,.030,.055,.050,.104),(cx,.027,.057,.047,.100),(cx,.026,.057,.0005,.0005)],rows=14)
    loft(avatar,m['Heel'],foot,[(cx,.039,-.023,.035,.031),(cx,.026,-.024,.034,.030),
         (cx,.015,-.025,.031,.029),(cx,.014,-.025,.001,.001)],rows=12)
    # Crossed satin straps follow the instep and finish at a real ankle ruffle.
    for direction in (-1,1):
        path=[(cx+direction*.033,.069,.109),(cx+direction*.017,.082,.091),
              (cx-direction*.001,.092,.065),(cx-direction*.020,.106,.035),
              (cx-direction*.028,.123,.008)]
        strand('StrapEdge',foot,path,[.006,.006,.006,.005,.004],sides=10)
        strand('Ribbon',foot,[(x,y+.0016,z+.0014) for x,y,z in path],
               [.0039,.0041,.0041,.0035,.0028],sides=10)
    ball('gem',foot,(cx,.090,.079),(.007,.010,.005),rows=6,cols=8)
    # The toe's embroidered lozenge reads above the welt even at desktop size.
    outline=[(cx,.075,.123),(cx+.018,.071,.129),(cx,.062,.148),
             (cx-.018,.071,.129),(cx,.075,.123)]
    strand('StrapEdge',foot,outline,[.003]*5,sides=9)
    ball('Ribbon',foot,(cx,.070,.131),(.009,.004,.010),rows=7,cols=8)
    for i in range(10):
        a=i*2*pi/10
        ball('PearlKid',foot,(cx+.029*sin(a),.132+.0015*cos(2*a),.001+.030*cos(a)),
             (.012,.010,.010),rows=6,cols=9)
    # Diamond-lattice garter sits on the thigh and bends with it.
    for j in range(2):
        points=[]
        for i in range(25):
            a=i*2*pi/24
            y=.535+.014*(1 if j else -1)*cos(4*a)
            points.append((cx+.062*sin(a),y,-.005+.064*cos(a)))
        strand('Ribbon',thigh,points,[.0037]*len(points),sides=6)
    strand('StrapEdge',thigh,[(cx,.522,.059),(cx,.499,.057),(cx,.491,.056)],
           [.002,.002,.001],sides=7)
    ball('gem',thigh,(cx,.486,.056),(.008,.013,.004),rows=6,cols=6)
