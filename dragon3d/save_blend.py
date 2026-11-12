"""Run with Blender --background --python save_blend.py."""
from pathlib import Path
import bpy
root=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root.parent/'live2d/model/dragon3d/Dragon.glb'))
for action in bpy.data.actions: action.use_fake_user=True
for arm in [obj for obj in bpy.context.scene.objects if obj.type=='ARMATURE']:
    arm.show_in_front=False
    if arm.animation_data:
        for track in arm.animation_data.nla_tracks: track.mute=True
        action=next(a for a in bpy.data.actions if a.name.startswith('StandToCurledSleep'))
        arm.animation_data.action=action
        bpy.context.scene.frame_start=int(action.frame_range[0])
        bpy.context.scene.frame_end=int(action.frame_range[1])
        bpy.context.scene.frame_set(bpy.context.scene.frame_start)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        from mathutils import Quaternion
        area.spaces.active.region_3d.view_rotation=Quaternion((1,0,0),1.5708)
        area.spaces.active.region_3d.view_distance=3.5
        area.spaces.active.region_3d.view_location=(0,0,1.)
        area.spaces.active.shading.color_type='TEXTURE'
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'Dragon.blend'),compress=True)
