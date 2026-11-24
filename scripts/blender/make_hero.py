# -*- coding: utf-8 -*-
"""
Procedural wuxia swordsman (Blender 4.2 headless).
Usage:
  blender -b -P scripts/blender/make_hero.py -- <png> <blend> <glb>
Body is built with the Skin modifier so limbs merge into one continuous form.
"""
import bpy
import math
import sys
import traceback
from mathutils import Vector

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
OUT_PNG = argv[0] if len(argv) > 0 else "hero.png"
OUT_BLEND = argv[1] if len(argv) > 1 else "hero.blend"
OUT_GLB = argv[2] if len(argv) > 2 else "hero.glb"

print("[STAGE] args ok", flush=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=0.55, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def assign(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True


def sphere(name, scale, loc, m, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=loc, rotation=rot,
                                         segments=28, ring_count=18)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o, m)
    smooth(o)
    return o


def box(name, scale, loc, m, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(o, m)
    return o


def cone(name, r1, r2, depth, loc, m, verts=24, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2,
                                    depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    assign(o, m)
    smooth(o)
    return o


# Skeleton nodes: (position, skin radius)
NODES = {
    "pelvis": ((0.00, 0.000, 0.98), 0.130),
    "spine": ((0.00, 0.005, 1.16), 0.145),
    "chest": ((0.00, 0.010, 1.36), 0.168),
    "neck": ((0.00, 0.010, 1.50), 0.052),
    "headbase": ((0.00, 0.010, 1.57), 0.060),
    "sh_l": ((-0.180, 0.010, 1.44), 0.072),
    "el_l": ((-0.268, 0.020, 1.20), 0.054),
    "wr_l": ((-0.305, 0.035, 0.98), 0.043),
    "hd_l": ((-0.318, 0.045, 0.91), 0.048),
    "sh_r": ((0.180, 0.010, 1.44), 0.072),
    "el_r": ((0.292, 0.070, 1.24), 0.054),
    "wr_r": ((0.350, 0.185, 1.12), 0.043),
    "hd_r": ((0.370, 0.228, 1.06), 0.048),
    "hip_l": ((-0.092, 0.000, 0.95), 0.080),
    "kn_l": ((-0.100, 0.010, 0.52), 0.068),
    "an_l": ((-0.100, 0.020, 0.07), 0.052),
    "hip_r": ((0.092, 0.000, 0.95), 0.080),
    "kn_r": ((0.100, 0.010, 0.52), 0.068),
    "an_r": ((0.100, 0.020, 0.07), 0.052),
}

EDGES = [
    ("pelvis", "spine"), ("spine", "chest"), ("chest", "neck"), ("neck", "headbase"),
    ("chest", "sh_l"), ("sh_l", "el_l"), ("el_l", "wr_l"), ("wr_l", "hd_l"),
    ("chest", "sh_r"), ("sh_r", "el_r"), ("el_r", "wr_r"), ("wr_r", "hd_r"),
    ("pelvis", "hip_l"), ("hip_l", "kn_l"), ("kn_l", "an_l"),
    ("pelvis", "hip_r"), ("hip_r", "kn_r"), ("kn_r", "an_r"),
]


def build_body(m_body):
    keys = list(NODES.keys())
    idx = dict((k, i) for i, k in enumerate(keys))

    mesh = bpy.data.meshes.new("BodyMesh")
    obj = bpy.data.objects.new("Body", mesh)
    bpy.context.collection.objects.link(obj)

    verts = [NODES[k][0] for k in keys]
    edges = [(idx[a], idx[b]) for a, b in EDGES]
    mesh.from_pydata(verts, edges, [])
    mesh.update()

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    obj.modifiers.new("Skin", "SKIN")
    sub = obj.modifiers.new("Sub", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2

    sv = mesh.skin_vertices[0].data
    for k, i in idx.items():
        r = NODES[k][1]
        sv[i].radius = (r, r)
    sv[idx["pelvis"]].use_root = True

    assign(obj, m_body)
    smooth(obj)

    # Skin + Subsurf 必须先应用：否则参与 object.join() 会让 Blender 原生崩溃
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier="Skin")
    bpy.ops.object.modifier_apply(modifier="Sub")
    print("[STAGE] modifiers applied", flush=True)

    return obj


def main():
    print("[STAGE] reset", flush=True)
    reset()

    SKIN_M = mat("M_Skin", (0.47, 0.30, 0.22), 0.58)
    ROBE = mat("M_Robe", (0.048, 0.060, 0.115), 0.72)
    TRIM = mat("M_Trim", (0.30, 0.045, 0.042), 0.60)
    SASH = mat("M_Sash", (0.52, 0.36, 0.085), 0.46, 0.30)
    HAIR = mat("M_Hair", (0.018, 0.016, 0.017), 0.40)
    STEEL = mat("M_Steel", (0.58, 0.62, 0.66), 0.20, 0.95)
    DARK = mat("M_Dark", (0.025, 0.025, 0.030), 0.70)
    EYE = mat("M_Eye", (0.012, 0.010, 0.010), 0.25)

    print("[STAGE] build_body", flush=True)
    body = build_body(ROBE)
    print("[STAGE] build_body done", flush=True)

    parts = [body]

    # head
    parts.append(sphere("Head", (0.096, 0.090, 0.110), (0, 0.012, 1.655), SKIN_M))
    parts.append(sphere("Jaw", (0.072, 0.074, 0.060), (0, 0.020, 1.600), SKIN_M))
    for x in (-0.091, 0.091):
        parts.append(sphere("Ear", (0.015, 0.021, 0.029), (x, 0.008, 1.652), SKIN_M))
    for x in (-0.037, 0.037):
        parts.append(sphere("Eye", (0.017, 0.013, 0.012), (x, 0.086, 1.664), EYE))
        tilt = 0.12 if x < 0 else -0.12
        parts.append(box("Brow", (0.036, 0.012, 0.009), (x, 0.089, 1.688), HAIR, (0.0, 0.0, tilt)))
    parts.append(sphere("Nose", (0.012, 0.019, 0.023), (0, 0.092, 1.645), SKIN_M))
    parts.append(box("Mouth", (0.028, 0.008, 0.007), (0, 0.086, 1.612), TRIM))

    # hair
    parts.append(sphere("HairCap", (0.102, 0.098, 0.102), (0, -0.004, 1.700), HAIR))
    parts.append(sphere("HairBun", (0.045, 0.043, 0.047), (0, -0.060, 1.760), HAIR))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.096, minor_radius=0.012,
                                     location=(0, 0.004, 1.734),
                                     rotation=(math.radians(6), 0, 0))
    band = bpy.context.object
    band.name = "Headband"
    assign(band, TRIM)
    smooth(band)
    parts.append(band)
    parts.append(box("Ribbon", (0.015, 0.010, 0.145), (0.092, -0.072, 1.660), TRIM,
                     (0.0, math.radians(16), 0.0)))

    # robe
    parts.append(cone("Skirt", 0.222, 0.140, 0.50, (0, 0, 0.70), ROBE, 28))
    parts.append(cone("SkirtHem", 0.230, 0.222, 0.042, (0, 0, 0.455), TRIM, 28))
    parts.append(cone("Sash", 0.160, 0.155, 0.080, (0, 0, 1.045), SASH, 28))
    parts.append(box("SashKnot", (0.072, 0.052, 0.080), (0, 0.142, 1.040), SASH))
    parts.append(box("CollarL", (0.030, 0.010, 0.235), (-0.035, 0.128, 1.395), TRIM,
                     (0.0, 0.0, -0.34)))
    parts.append(box("CollarR", (0.030, 0.010, 0.235), (0.035, 0.128, 1.395), TRIM,
                     (0.0, 0.0, 0.34)))
    for x in (-0.180, 0.180):
        parts.append(sphere("Pauldron", (0.078, 0.080, 0.068), (x, 0.008, 1.452), TRIM))
    parts.append(cone("CuffL", 0.050, 0.056, 0.048, (-0.292, 0.030, 1.020), TRIM, 16))
    parts.append(cone("CuffR", 0.050, 0.056, 0.048, (0.336, 0.150, 1.150), TRIM, 16))
    for x in (-0.100, 0.100):
        parts.append(box("Shoe", (0.098, 0.215, 0.070), (x, 0.038, 0.048), DARK))

    # sword in right hand
    hand = Vector((0.370, 0.228, 1.060))
    tilt = (math.radians(12), math.radians(-14), 0.0)
    parts.append(box("Blade", (0.019, 0.010, 0.58), (0.390, 0.258, 1.360), STEEL, tilt))
    parts.append(box("BladeEdge", (0.005, 0.013, 0.58), (0.401, 0.258, 1.360), STEEL, tilt))
    parts.append(box("Guard", (0.082, 0.040, 0.015), (0.376, 0.240, 1.080), SASH, tilt))
    parts.append(cone("Grip", 0.017, 0.017, 0.135, (0.366, 0.222, 1.010), DARK, 12, tilt))
    parts.append(box("Sheath", (0.025, 0.017, 0.46), (-0.170, 0.052, 0.780), DARK,
                     (math.radians(9), 0.0, math.radians(14))))

    print("[STAGE] join", flush=True)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    hero = bpy.context.object
    hero.name = "Hero_Swordsman"
    print("[STAGE] join done", flush=True)

    # camera
    bpy.ops.object.camera_add(location=(2.55, 3.55, 1.30))
    cam = bpy.context.object
    cam.data.lens = 70
    cam.rotation_euler = (Vector((0, 0, 0.95)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    def area(name, loc, energy, size, color):
        bpy.ops.object.light_add(type="AREA", location=loc)
        l = bpy.context.object
        l.name = name
        l.data.energy = energy
        l.data.size = size
        l.data.color = color
        l.rotation_euler = (Vector((0, 0, 1.15)) - l.location).to_track_quat("-Z", "Y").to_euler()
        return l

    area("Key", (-2.6, -3.0, 2.8), 520, 2.6, (1.0, 0.94, 0.86))
    area("Rim", (2.8, 2.2, 2.4), 760, 1.9, (0.68, 0.82, 1.0))
    area("Fill", (2.4, -2.8, 1.2), 150, 2.2, (0.86, 0.90, 1.0))

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"

    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.025, 0.035, 1)

    print("[STAGE] save blend", flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

    print("[STAGE] render", flush=True)
    scene.render.filepath = OUT_PNG
    bpy.ops.render.render(write_still=True)
    print("[STAGE] render done", flush=True)

    print("[STAGE] export glb", flush=True)
    bpy.ops.object.select_all(action="DESELECT")
    hero.select_set(True)
    bpy.context.view_layer.objects.active = hero
    bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB",
                              use_selection=True, export_apply=False)
    print("RENDER_OK " + OUT_PNG, flush=True)


try:
    main()
except Exception:
    traceback.print_exc()
    sys.exit(1)
