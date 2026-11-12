"""Check separated digit surfaces and fingertips against their own palm in the baked action."""
from itertools import combinations
from pathlib import Path
import re
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'live2d/model/dragon3d/Dragon.glb'))
mesh=bpy.data.objects['DragonGirl']
rig=bpy.data.objects['DragonRig']
rig.animation_data.action=next(a for a in bpy.data.actions if a.name.startswith('StandToCurledSleep'))
for track in rig.animation_data.nla_tracks:
    track.mute=True
names=[g.name for g in mesh.vertex_groups]
material_ids={i for i,m in enumerate(mesh.material_slots) if m.name in ('HandSkin','Nail')}
mesh.data.calc_loop_triangles()
tri=np.array([t.vertices[:] for t in mesh.data.loop_triangles if t.material_index in material_ids])
groups=[names[max(v.groups,key=lambda g:g.weight).group] if v.groups else '' for v in mesh.data.vertices]
def part_name(name):
    digit=re.fullmatch(r'(FingerTip|Finger|Distal)([LR])(\d)',name)
    if digit:return digit[2]+digit[3]
    if name.startswith(('Hand','LittleCup','RingCup')):return name[-1]+'Palm'
    return ''
labels=np.array([part_name(n) for n in groups])
distal=np.array([n.startswith('Distal') for n in groups])
def subset(faces):
    indices,local=np.unique(faces,return_inverse=True)
    assert len(indices)>40
    return indices,local.reshape(-1,3).tolist()
parts={}
pairs=[]
for side in 'LR':
    fingers=[side+str(i) for i in range(5)]
    palm=side+'Palm'
    for name in [palm]+fingers:
        faces=tri[(labels[tri]==name).all(axis=1)]
        parts[name]=subset(faces)
        if name!=palm:
            parts[name+'Tip']=subset(faces[distal[faces].all(axis=1)])
            pairs.append((name+'Tip',palm))
    pairs.extend(combinations(fingers,2))
face_materials={i for i,m in enumerate(mesh.material_slots) if m.name in ('Complexion','EarR','EarL')}
parts['Face']=subset(np.array([t.vertices[:] for t in mesh.data.loop_triangles if t.material_index in face_materials]))
for side in 'LR':
    parts[side+'Hand']=subset(tri[np.char.startswith(labels[tri],side).all(axis=1)])
    pairs.append((side+'Hand','Face'))
pairs.append(('LHand','RHand'))
scene=bpy.context.scene
coords=np.empty(len(groups)*3,dtype=np.float32)
bad=[]
samples=49
for frame in np.linspace(0,rig.animation_data.action.frame_range[1],samples):
    scene.frame_set(int(frame),subframe=float(frame%1))
    mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices.foreach_get('co',coords)
    trees={n:BVHTree.FromPolygons(coords.reshape(-1,3)[ids].tolist(),faces,all_triangles=True)
           for n,(ids,faces) in parts.items()}
    for a,b in pairs:
        overlaps=trees[a].overlap(trees[b])
        if overlaps:bad.append((frame,a,b,len(overlaps)))
if bad:raise RuntimeError(f'{len(bad)} overlaps, first {bad[:8]}, last {bad[-8:]}')
print(f'PASS fingers, {samples} poses, {len(pairs)} finger, palm, hand and face pairs.')
