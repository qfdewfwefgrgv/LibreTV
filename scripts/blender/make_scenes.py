# -*- coding: utf-8 -*-
"""
程序化生成《江湖风云录》场景背景（Blender 4.2 headless, Cycles）
用法：
  blender -b -P scripts/blender/make_scenes.py -- <输出目录> [场景1,场景2...]
产物：<输出目录>/<key>.png  1600x900，带体积雾与真实光照
"""
import bpy
import bmesh
import math
import random
import sys
from mathutils import Vector, noise

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
OUT_DIR = argv[0] if len(argv) > 0 else "."
ONLY = argv[1].split(",") if len(argv) > 1 and argv[1] else None

# 场景配置：天空色、雾色雾密度、太阳方位/颜色、地形类型、道具
SCENES = {
    "luoyang-snow": dict(sky=(0.10, 0.14, 0.22), fog=(0.55, 0.62, 0.74), fogd=0.010,
                         sun=(-2.2, 0.30, 0.85), sunc=(0.85, 0.90, 1.0), sunp=90,
                         land="flat", props=["wall", "city"], snow=True),
    "village": dict(sky=(0.26, 0.18, 0.12), fog=(0.62, 0.48, 0.34), fogd=0.014,
                    sun=(-2.0, 0.26, 0.80), sunc=(1.0, 0.82, 0.58), sunp=140,
                    land="hill", props=["houses", "trees"]),
    "temple": dict(sky=(0.10, 0.15, 0.13), fog=(0.42, 0.52, 0.46), fogd=0.016,
                   sun=(-1.8, 0.28, 0.78), sunc=(0.78, 0.88, 0.80), sunp=80,
                   land="hill", props=["temple", "trees"]),
    "ferry": dict(sky=(0.09, 0.15, 0.19), fog=(0.48, 0.60, 0.64), fogd=0.020,
                  sun=(2.6, 0.22, 0.80), sunc=(0.80, 0.90, 0.95), sunp=120,
                  land="flat", water=True, props=["boat"]),
    "lantern": dict(sky=(0.14, 0.07, 0.10), fog=(0.52, 0.30, 0.28), fogd=0.018,
                    sun=(-2.4, 0.24, 0.72), sunc=(1.0, 0.72, 0.48), sunp=160,
                    land="flat", props=["city", "lanterns"]),
    "inn": dict(sky=(0.13, 0.10, 0.07), fog=(0.50, 0.40, 0.26), fogd=0.018,
                sun=(-2.0, 0.26, 0.74), sunc=(1.0, 0.82, 0.55), sunp=150,
                land="flat", props=["inn", "lanterns"]),
    "stronghold": dict(sky=(0.10, 0.06, 0.06), fog=(0.40, 0.22, 0.18), fogd=0.020,
                       sun=(-2.6, 0.20, 0.70), sunc=(1.0, 0.55, 0.40), sunp=120,
                       land="hill", props=["wall", "banners"]),
    "jiangnan": dict(sky=(0.09, 0.15, 0.14), fog=(0.50, 0.62, 0.56), fogd=0.016,
                     sun=(-2.2, 0.30, 0.86), sunc=(0.80, 0.92, 0.86), sunp=110,
                     land="flat", water=True, props=["bridge", "willow"]),
    "valley": dict(sky=(0.09, 0.14, 0.11), fog=(0.46, 0.58, 0.48), fogd=0.016,
                   sun=(-2.4, 0.28, 0.82), sunc=(0.86, 0.94, 0.84), sunp=100,
                   land="hill", water=True, props=["trees"]),
    "mist": dict(sky=(0.11, 0.13, 0.16), fog=(0.58, 0.64, 0.70), fogd=0.030,
                 sun=(-2.0, 0.30, 0.90), sunc=(0.80, 0.86, 0.94), sunp=70,
                 land="hill", props=["firs"]),
    "dungeon": dict(sky=(0.05, 0.04, 0.06), fog=(0.20, 0.14, 0.22), fogd=0.030,
                    sun=(-2.2, 0.16, 0.60), sunc=(1.0, 0.55, 0.35), sunp=110,
                    land="flat", props=["wall", "banners"], indoor=True),
    "sword-mound": dict(sky=(0.10, 0.12, 0.14), fog=(0.52, 0.58, 0.62), fogd=0.018,
                        sun=(-2.4, 0.26, 0.86), sunc=(0.84, 0.88, 0.92), sunp=90,
                        land="hill", props=["swords"]),
    "peak": dict(sky=(0.08, 0.12, 0.18), fog=(0.50, 0.60, 0.72), fogd=0.022,
                 sun=(-2.0, 0.32, 0.92), sunc=(0.82, 0.90, 1.0), sunp=80,
                 land="cliff", props=["firs"]),
    "huashan": dict(sky=(0.16, 0.10, 0.07), fog=(0.62, 0.44, 0.30), fogd=0.020,
                    sun=(-2.6, 0.22, 0.74), sunc=(1.0, 0.74, 0.45), sunp=190,
                    land="cliff", props=["firs"]),
    "fuzhou": dict(sky=(0.08, 0.13, 0.16), fog=(0.46, 0.58, 0.62), fogd=0.020,
                   sun=(2.4, 0.24, 0.82), sunc=(0.82, 0.92, 0.96), sunp=120,
                   land="flat", water=True, props=["boat", "city"]),
    "hanyang": dict(sky=(0.14, 0.11, 0.08), fog=(0.50, 0.40, 0.28), fogd=0.018,
                    sun=(-2.2, 0.26, 0.76), sunc=(1.0, 0.84, 0.56), sunp=150,
                    land="flat", props=["city", "lanterns"]),
    "taishan": dict(sky=(0.09, 0.11, 0.13), fog=(0.52, 0.58, 0.62), fogd=0.024,
                    sun=(-2.0, 0.30, 0.88), sunc=(0.86, 0.90, 0.94), sunp=80,
                    land="cliff", props=["stairs", "firs"]),
    "songshan": dict(sky=(0.07, 0.11, 0.09), fog=(0.44, 0.54, 0.46), fogd=0.018,
                     sun=(-2.2, 0.28, 0.84), sunc=(0.84, 0.92, 0.84), sunp=100,
                     land="hill", props=["temple", "firs"]),
    "shaolin": dict(sky=(0.15, 0.12, 0.07), fog=(0.54, 0.44, 0.28), fogd=0.016,
                    sun=(-2.4, 0.26, 0.78), sunc=(1.0, 0.86, 0.60), sunp=150,
                    land="hill", props=["temple", "firs"]),
    "wudang": dict(sky=(0.07, 0.12, 0.15), fog=(0.48, 0.60, 0.66), fogd=0.026,
                   sun=(-2.0, 0.30, 0.90), sunc=(0.82, 0.94, 0.98), sunp=80,
                   land="cliff", props=["temple"]),
    "emei": dict(sky=(0.16, 0.11, 0.07), fog=(0.60, 0.48, 0.32), fogd=0.022,
                 sun=(-2.6, 0.20, 0.72), sunc=(1.0, 0.80, 0.52), sunp=190,
                 land="cliff", props=["temple", "firs"]),
    "taiyi": dict(sky=(0.09, 0.08, 0.13), fog=(0.44, 0.40, 0.56), fogd=0.020,
                  sun=(-2.2, 0.26, 0.82), sunc=(0.86, 0.82, 0.96), sunp=110,
                  land="hill", props=["pagoda", "firs"]),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=0.7, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit > 0:
        b.inputs["Emission Color"].default_value = (color[0], color[1], color[2], 1.0)
        b.inputs["Emission Strength"].default_value = emit
    return m


def obj_from_mesh(name, verts, faces, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def terrain(kind, material, seed=1):
    """按类型生成起伏地形网格"""
    rnd = random.Random(seed)
    nx, ny = 40, 30
    sx, sy = 120.0, 90.0
    verts, faces = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x = (i / nx - 0.5) * sx
            y = (j / ny - 0.5) * sy
            if kind == "flat":
                z = rnd.uniform(-0.15, 0.15)
            elif kind == "hill":
                z = 6.0 * noise.noise(Vector((x * 0.03, y * 0.03, seed))) + 2.0
            else:  # cliff
                z = 10.0 * abs(noise.noise(Vector((x * 0.04, y * 0.04, seed)))) + 1.5
            verts.append((x, y, z))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    return obj_from_mesh("Terrain", verts, faces, material)


def ridge_wall(x_from, x_to, y, base_z, height, material, rnd):
    """远景山脊：一条起伏的立体墙"""
    verts, faces = [], []
    seg = 48
    for i in range(seg + 1):
        t = i / seg
        x = x_from + (x_to - x_from) * t
        h = height * (0.45 + 0.55 * abs(noise.noise(Vector((x * 0.05, y * 0.01, 3.7)))))
        verts.append((x, y, base_z))
        verts.append((x, y, base_z + h))
    for i in range(seg):
        a = i * 2
        faces.append((a, a + 2, a + 3, a + 1))
    return obj_from_mesh("Ridge", verts, faces, material)


def box(name, size, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(material)
    return o


def cylinder(name, r, depth, loc, material, rot=(0, 0, 0), verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    return o


def cone(name, r1, r2, depth, loc, material, verts=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2,
                                    depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    return o


def add_wall(M, z0=0.0):
    box("Wall", (46, 5, 9), (0, 16, z0 + 4.5), M["stone"])
    for i in range(-6, 7):
        box("Crenel", (1.6, 1.6, 2.0), (i * 3.4, 13.6, z0 + 9.6), M["stone"])
    box("GateTower", (12, 9, 11), (0, 17, z0 + 11.5), M["stone"])
    cone("GateRoof", 9.5, 1.2, 3.2, (0, 17, z0 + 18.5), M["roof"], 4, (0, 0, math.radians(45)))
    for i in range(-2, 3):
        box("Win", (1.0, 1.0, 1.6), (i * 2.2, 12.4, z0 + 11.0), M["glow"])


def add_city(M, rnd, z0=0.0):
    for i in range(10):
        x = -34 + i * 7.6 + rnd.uniform(-1, 1)
        h = rnd.uniform(5, 10)
        d = rnd.uniform(5, 8)
        box("House", (d, 6, h), (x, 4 + rnd.uniform(-2, 3), z0 + h / 2), M["wood"])
        cone("Roof", d * 0.85, 0.4, 2.2, (x, 4, z0 + h + 1.1), M["roof"], 4, (0, 0, math.radians(45)))
        if rnd.random() < 0.7:
            box("Win", (0.9, 0.9, 1.2), (x, 1.1, z0 + h * 0.55), M["glow"])


def add_houses(M, rnd, z0=0.0):
    for i in range(7):
        x = -26 + i * 9 + rnd.uniform(-1.5, 1.5)
        h = rnd.uniform(4, 6.5)
        box("Hut", (6, 5, h), (x, 6, z0 + h / 2), M["wood"])
        cone("Thatch", 5.2, 0.3, 1.8, (x, 6, z0 + h + 0.9), M["roof"], 4, (0, 0, math.radians(45)))
        if rnd.random() < 0.6:
            box("Win", (0.8, 0.8, 1.0), (x, 3.6, z0 + h * 0.6), M["glow"])


def add_inn(M, z0=0.0):
    box("InnBody", (16, 12, 9), (0, 6, z0 + 4.5), M["wood"])
    cone("InnRoof", 13.0, 1.0, 3.0, (0, 6, z0 + 10.2), M["roof"], 4, (0, 0, math.radians(45)))
    box("Balcony", (16.5, 1.2, 0.6), (0, 0.4, z0 + 5.4), M["wood"])
    for i in range(-1, 2):
        box("Sign", (3.0, 0.3, 2.2), (i * 4.2, -0.2, z0 + 7.2), M["red"])
    for i in range(-3, 4):
        box("Win", (1.2, 0.4, 1.6), (i * 2.2, -0.1, z0 + 3.2), M["glow"])


def add_temple(M, z0=0.0):
    box("Base", (26, 14, 1.4), (0, 10, z0 + 0.7), M["stone"])
    box("Hall", (18, 10, 8), (0, 10, z0 + 5.4), M["wood"])
    cone("HallRoof", 15.0, 1.0, 3.4, (0, 10, z0 + 11.2), M["roof"], 4, (0, 0, math.radians(45)))
    cone("HallTop", 7.0, 0.2, 2.0, (0, 10, z0 + 13.8), M["roof"], 4, (0, 0, math.radians(45)))
    box("DoorWay", (5, 0.6, 5), (0, 5.2, z0 + 3.2), M["dark"])
    for i in (-6.5, 6.5):
        cylinder("Pillar", 0.55, 7.0, (i, 5.4, z0 + 3.6), M["red"])
    for i in (-1, 1):
        box("Lantern", (0.9, 0.9, 1.2), (i * 4.0, 5.0, z0 + 6.2), M["glow"])


def add_pagoda(M, z0=0.0):
    for i in range(4):
        w = 7.0 - i * 1.3
        h = 3.2
        z = z0 + i * 3.6
        box("Tier", (w, w, h), (0, 10, z + h / 2), M["wood"])
        cone("Eave", w * 0.95, 0.4, 1.0, (0, 10, z + h + 0.5), M["roof"], 4, (0, 0, math.radians(45)))
    box("Spire", (0.5, 0.5, 2.4), (0, 10, z0 + 15.8), M["gold"])


def add_trees(M, rnd, z0=0.0, firs=False):
    for i in range(14):
        x = rnd.uniform(-30, 30)
        y = rnd.uniform(-4, 14)
        h = rnd.uniform(4, 9)
        cylinder("Trunk", 0.28, h * 0.5, (x, y, z0 + h * 0.25), M["trunk"])
        if firs:
            for k in range(3):
                cone("Canopy", 2.2 - k * 0.45, 0.2, h * 0.42,
                     (x, y, z0 + h * 0.5 + k * h * 0.22), M["leaf"], 8)
        else:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(x, y, z0 + h * 0.62))
            o = bpy.context.object
            o.scale = (2.0, 2.0, h * 0.32)
            o.data.materials.append(M["leaf"])


def add_boat(M, z0=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(6, 4, z0 + 0.5))
    o = bpy.context.object
    o.scale = (5.0, 1.6, 0.9)
    o.data.materials.append(M["wood"])
    cylinder("Mast", 0.16, 6.5, (6, 4, z0 + 3.6), M["trunk"])
    box("Sail", (0.2, 3.2, 4.0), (6, 6.6, z0 + 4.2), M["cloth"])
    box("Lantern", (0.5, 0.5, 0.7), (6, 2.1, z0 + 2.4), M["glow"])


def add_bridge(M, z0=0.0):
    for i in range(9):
        t = i / 8.0
        x = -24 + 48 * t
        z = z0 + 4.0 * math.sin(math.pi * t) + 0.6
        box("Plank", (6.4, 9, 0.5), (x, 8, z), M["stone"])
    for i in range(0, 9, 2):
        t = i / 8.0
        x = -24 + 48 * t
        z = z0 + 4.0 * math.sin(math.pi * t) + 0.6
        box("Rail", (0.35, 0.35, 2.0), (x, 3.6, z + 1.0), M["stone"])


def add_willow(M, rnd, z0=0.0):
    for i in range(6):
        x = -28 + i * 11 + rnd.uniform(-2, 2)
        y = 2 + rnd.uniform(-2, 4)
        cylinder("Trunk", 0.4, 5.0, (x, y, z0 + 2.5), M["trunk"])
        for k in range(10):
            a = rnd.uniform(-0.9, 0.9)
            box("Branch", (0.16, 3.2, 0.16), (x + a * 2.4, y + 3.0, z0 + 3.4), M["leaf"],
                (0, math.radians(rnd.uniform(55, 85)), 0))


def add_swords(M, rnd, z0=0.0):
    for i in range(90):
        x = rnd.uniform(-30, 30)
        y = rnd.uniform(-2, 18)
        h = rnd.uniform(2.5, 6.0)
        tilt = (rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), 0)
        box("Sword", (0.12, 0.12, h), (x, y, z0 + h / 2), M["steel"], tilt)
        box("Guard", (0.7, 0.16, 0.14), (x, y, z0 + h * 0.82), M["steel"], tilt)


def add_banners(M, rnd, z0=0.0):
    for i in range(6):
        x = -22 + i * 9 + rnd.uniform(-1, 1)
        y = rnd.uniform(4, 14)
        cylinder("Pole", 0.16, 8.0, (x, y, z0 + 4.0), M["trunk"])
        box("Flag", (0.12, 2.6, 3.2), (x + 1.4, y, z0 + 6.6), M["red"])


def add_lanterns(M, rnd, z0=0.0):
    for i in range(16):
        x = rnd.uniform(-26, 26)
        y = rnd.uniform(-2, 12)
        z = z0 + rnd.uniform(4.5, 9.0)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.55, location=(x, y, z))
        o = bpy.context.object
        o.data.materials.append(M["glow"])


def add_stairs(M, z0=0.0):
    for i in range(16):
        w = 8 + i * 1.6
        box("Step", (w, 3.0, 0.5), (0, 14 - i * 2.2, z0 + 0.4 + i * 0.55), M["stone"])


def build_scene(key, cfg):
    reset()
    rnd = random.Random(hash(key) & 0xFFFF)

    M = {
        "stone": mat("M_Stone", (0.20, 0.21, 0.23), 0.85),
        "wood": mat("M_Wood", (0.16, 0.11, 0.08), 0.80),
        "roof": mat("M_Roof", (0.07, 0.07, 0.08), 0.75),
        "red": mat("M_Red", (0.28, 0.05, 0.04), 0.65),
        "gold": mat("M_Gold", (0.55, 0.40, 0.12), 0.40, 0.6),
        "trunk": mat("M_Trunk", (0.10, 0.07, 0.05), 0.85),
        "leaf": mat("M_Leaf", (0.06, 0.13, 0.08), 0.80),
        "cloth": mat("M_Cloth", (0.55, 0.52, 0.45), 0.80),
        "steel": mat("M_Steel", (0.42, 0.45, 0.48), 0.35, 0.85),
        "glow": mat("M_Glow", (1.0, 0.72, 0.35), 0.40, 0.0, 6.0),
        "dark": mat("M_Dark", (0.03, 0.03, 0.035), 0.8),
    }
    if cfg.get("water"):
        M["water"] = mat("M_Water", (0.05, 0.10, 0.12), 0.12, 0.2)

    # 地面
    ground_mat = mat("M_Ground", (0.09, 0.09, 0.08), 0.9)
    terrain(cfg["land"], ground_mat, seed=int(hash(key) & 0xFF))

    # 远景山脊（两层，拉开空气透视）
    far = mat("M_Far", (cfg["sky"][0] * 0.9 + 0.06, cfg["sky"][1] * 0.9 + 0.06, cfg["sky"][2] * 0.9 + 0.07), 1.0)
    mid = mat("M_Mid", (cfg["sky"][0] * 0.55 + 0.03, cfg["sky"][1] * 0.55 + 0.03, cfg["sky"][2] * 0.55 + 0.04), 1.0)
    ridge_wall(-70, 70, 62, 0, 26, far, rnd)
    ridge_wall(-60, 60, 40, 0, 16, mid, rnd)

    if cfg.get("water"):
        bpy.ops.mesh.primitive_plane_add(size=140, location=(0, -12, 0.05))
        w = bpy.context.object
        w.data.materials.append(M["water"])

    z0 = 0.0
    for p in cfg["props"]:
        if p == "wall": add_wall(M, z0)
        elif p == "city": add_city(M, rnd, z0)
        elif p == "houses": add_houses(M, rnd, z0)
        elif p == "inn": add_inn(M, z0)
        elif p == "temple": add_temple(M, z0)
        elif p == "pagoda": add_pagoda(M, z0)
        elif p == "trees": add_trees(M, rnd, z0, False)
        elif p == "firs": add_trees(M, rnd, z0, True)
        elif p == "boat": add_boat(M, z0)
        elif p == "bridge": add_bridge(M, z0)
        elif p == "willow": add_willow(M, rnd, z0)
        elif p == "swords": add_swords(M, rnd, z0)
        elif p == "banners": add_banners(M, rnd, z0)
        elif p == "lanterns": add_lanterns(M, rnd, z0)
        elif p == "stairs": add_stairs(M, z0)

    # 雪
    if cfg.get("snow"):
        sm = mat("M_Snow", (0.85, 0.88, 0.95), 0.6, 0, 2.0)
        for i in range(700):
            x = rnd.uniform(-40, 40); y = rnd.uniform(-6, 42); z = rnd.uniform(2, 30)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rnd.uniform(0.035, 0.085),
                                                  location=(x, y, z))
            bpy.context.object.data.materials.append(sm)

    # 相机
    bpy.ops.object.camera_add(location=(0, -34, 7.5))
    cam = bpy.context.object
    cam.data.lens = 32
    cam.rotation_euler = (Vector((0, 8, 9)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    # 太阳
    lx, ly, lz = cfg["sun"]
    bpy.ops.object.light_add(type="SUN", location=(lx * 30, ly * 30, 40))
    sun = bpy.context.object
    sun.data.energy = cfg["sunp"] * 0.035
    sun.data.color = cfg["sunc"]
    sun.data.angle = math.radians(2.5)
    sun.rotation_euler = (Vector((0, 0, 0)) - sun.location).to_track_quat("-Z", "Y").to_euler()

    # 世界 + 体积雾
    scene = bpy.context.scene
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (cfg["sky"][0], cfg["sky"][1], cfg["sky"][2], 1.0)
    bg.inputs[1].default_value = 0.45

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 9))
    fogv = bpy.context.object
    fogv.name = "FogVolume"
    fogv.scale = (170, 170, 22)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    fm = bpy.data.materials.new("M_Fog")
    fm.use_nodes = True
    nodes = fm.node_tree.nodes
    for n in list(nodes):
        nodes.remove(n)
    out = nodes.new("ShaderNodeOutputMaterial")
    vol = nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (cfg["fog"][0], cfg["fog"][1], cfg["fog"][2], 1.0)
    vol.inputs["Density"].default_value = cfg["fogd"] * 0.18
    vol.inputs["Anisotropy"].default_value = 0.35
    fm.node_tree.links.new(vol.outputs[0], out.inputs["Volume"])
    fogv.data.materials.append(fm)

    # 渲染
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.cycles.volume_bounces = 1
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"

    out_path = OUT_DIR.rstrip("/\\") + "/" + key + ".png"
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print("SCENE_OK " + out_path, flush=True)


keys = ONLY if ONLY else list(SCENES.keys())
for k in keys:
    if k not in SCENES:
        print("skip unknown " + k, flush=True)
        continue
    print("SCENE_START " + k, flush=True)
    build_scene(k, SCENES[k])
print("ALL_DONE", flush=True)
