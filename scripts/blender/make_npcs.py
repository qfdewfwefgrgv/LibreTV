# -*- coding: utf-8 -*-
"""
生成洛阳城 5 个 NPC 的俯视小人（透明底 PNG，256×256）。
用法：blender -b -P scripts/blender/make_npcs.py -- <输出目录>
"""
import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
OUT = argv[0] if len(argv) > 0 else "public/game/npc"

NPCS = [
    ("npc-gu",    (0.18, 0.26, 0.32), (0.55, 0.60, 0.66), "sword"),
    ("npc-su",    (0.86, 0.87, 0.88), (0.62, 0.70, 0.78), "none"),
    ("npc-zhanggui", (0.26, 0.22, 0.18), (0.45, 0.36, 0.26), "none"),
    ("npc-laoweng", (0.55, 0.48, 0.36), (0.72, 0.64, 0.48), "staff"),
    ("npc-qingcheng", (0.20, 0.30, 0.24), (0.42, 0.56, 0.44), "sword"),
]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def sphere(name, scale, loc, m):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=loc, segments=20, ring_count=12)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def cyl(name, r, depth, loc, m, verts=14):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=verts)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def cone(name, r1, r2, depth, loc, m, verts=14):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, vertices=verts)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def build(cid, main_c, sub_c, weapon):
    m_main = mat(cid + "_m", main_c, 0.65)
    m_sub = mat(cid + "_s", sub_c, 0.5, 0.35 if weapon != "none" else 0.0)
    m_skin = mat(cid + "_sk", (0.80, 0.68, 0.57), 0.7)
    m_hair = mat(cid + "_h", (0.05, 0.05, 0.06), 0.85)

    for sx in (-0.075, 0.075):
        cyl(f"{cid}_leg{sx}", 0.06, 0.62, (sx, 0, 0.31), m_main)
    cone(f"{cid}_torso", 0.15, 0.20, 0.52, (0, 0, 0.86), m_main)
    cyl(f"{cid}_belt", 0.17, 0.05, (0, 0, 0.64), m_sub, verts=18)
    cone(f"{cid}_robe", 0.24, 0.16, 0.42, (0, 0, 0.45), m_main, verts=18)
    for sx in (-0.18, 0.18):
        sphere(f"{cid}_sh{sx}", (0.07, 0.07, 0.06), (sx, 0, 1.06), m_sub)
        cyl(f"{cid}_arm{sx}", 0.045, 0.42, (sx, 0, 0.86), m_main)
        sphere(f"{cid}_hand{sx}", (0.045, 0.045, 0.05), (sx, 0, 0.64), m_skin)
    cyl(f"{cid}_neck", 0.045, 0.07, (0, 0, 1.14), m_skin)
    sphere(f"{cid}_head", (0.105, 0.112, 0.125), (0, 0, 1.25), m_skin)
    sphere(f"{cid}_hair", (0.112, 0.116, 0.098), (0, -0.01, 1.29), m_hair)
    cyl(f"{cid}_tail", 0.036, 0.24, (0, -0.09, 1.14), m_hair, verts=10)
    for sx in (-0.038, 0.038):
        sphere(f"{cid}_eye{sx}", (0.014, 0.010, 0.016), (sx, -0.098, 1.252), m_hair)

    if weapon == "sword":
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.26, 0, 0.90))
        o = bpy.context.object
        o.name = f"{cid}_blade"
        o.scale = (0.035, 0.012, 0.78)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(m_sub)
    elif weapon == "staff":
        cyl(f"{cid}_staff", 0.02, 1.3, (0.26, 0, 0.78), m_sub, verts=10)
        sphere(f"{cid}_orb", (0.05, 0.05, 0.05), (0.26, 0, 1.46), m_sub)


def render_one(cid, path):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    scene.world = bpy.data.worlds.new("W")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.055, 0.06, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.22

    bpy.ops.object.light_add(type="AREA", location=(1.6, -2.0, 2.6))
    key = bpy.context.object
    key.data.energy = 220
    key.data.size = 2.5
    key.rotation_euler = (math.radians(52), 0, math.radians(28))

    bpy.ops.object.light_add(type="AREA", location=(-1.8, -1.4, 1.6))
    fill = bpy.context.object
    fill.data.energy = 70
    fill.data.size = 3.0
    fill.rotation_euler = (math.radians(62), 0, math.radians(-40))

    # 45 度俯视，正交投影，按包围盒自动取景
    xs, ys, zs = [], [], []
    for o in scene.objects:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    cx = (min(xs) + max(xs)) / 2
    cz = (min(zs) + max(zs)) / 2
    height = max(zs) - min(zs)
    width = max(xs) - min(xs)

    cam_loc = Vector((cx, -3.4, cz + 2.6))
    target = Vector((cx, 0, cz))
    cam_rot = (target - cam_loc).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(location=cam_loc, rotation=cam_rot)
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = max(width, height) * 0.92
    scene.camera = cam

    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for cid, main_c, sub_c, weapon in NPCS:
        reset()
        build(cid, main_c, sub_c, weapon)
        p = os.path.join(OUT, cid + ".png")
        render_one(cid, p)
        print(f"[NPC] {cid} -> {p}", flush=True)
    print("完成", len(NPCS), "个 NPC", flush=True)


main()
