"""Blender background regression: intersect the rendered skirt's triangles with both legs and shoes."""
import json
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'live2d/model/dragon3d/Dragon.glb'))
rig=bpy.data.objects['DragonRig']
mesh=bpy.data.objects['DragonGirl']
rig.animation_data.action=next(a for a in bpy.data.actions if a.name.startswith('StandToCurledSleep'))
for track in rig.animation_data.nla_tracks:
    track.mute=True
groups=[g.name for g in mesh.vertex_groups]
def region(vertex):
    names=[groups[g.group] for g in vertex.groups if g.weight>1e-5]
    if any(n.startswith('Drape') for n in names):return 1
    if any(n.startswith(('Thigh','Shin','Foot')) for n in names):return 2
    return 0
tags=np.array([region(v) for v in mesh.data.vertices])
mesh.data.calc_loop_triangles()
tri=np.empty(len(mesh.data.loop_triangles)*3,dtype=np.int32)
mesh.data.loop_triangles.foreach_get('vertices',tri)
tri=tri.reshape(-1,3)
def subset(tag):
    faces=tri[(tags[tri]==tag).all(axis=1)]
    ids,indices=np.unique(faces,return_inverse=True)
    return ids,indices.reshape(-1,3).tolist()
cloth,legs=subset(1),subset(2)
assert len(cloth[1])>1000 and len(legs[1])>1000
scene=bpy.context.scene
coords=np.empty(len(mesh.data.vertices)*3,dtype=np.float32)
def tree(part):
    ids,faces=part
    return BVHTree.FromPolygons(coords.reshape(-1,3)[ids].tolist(),faces,all_triangles=True)
count=37 if '--quick' in sys.argv else 577 if '--dense' in sys.argv else 289
contacts=[]
for frame in np.linspace(0,rig.animation_data.action.frame_range[1],count):
    scene.frame_set(int(frame),subframe=float(frame%1))
    deformed=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    deformed.vertices.foreach_get('co',coords)
    overlap=tree(cloth).overlap(tree(legs))
    if overlap:contacts.append((float(frame),len(overlap)))
report=dict(samples=count,clothTriangles=len(cloth[1]),legTriangles=len(legs[1]),intersections=contacts)
out=root/'_build/dragon-review/skirt-contact.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(report,indent=2))
print('CLOTH CHECK',count,'poses,',len(contacts),'with intersections, peak',max([n for _,n in contacts],default=0))
if contacts:raise RuntimeError('Skirt/leg contacts, see '+str(out))
