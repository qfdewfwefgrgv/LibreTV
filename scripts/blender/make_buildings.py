# -*- coding: utf-8 -*-
"""
按提示词规格，用 Blender 程序化建模并渲染俯视建筑素材（透明底 PNG）。

规格（来自场景提示词）：
  中式古风民居/店铺 —— 四合院制式、青瓦硬山屋顶、木构梁柱、青砖院墙、院内铺石
  正交俯视 + 轻微俯角，统一光源来自左上，透明背景

用法：
  blender -b -P scripts/blender/make_buildings.py -- <输出目录>
"""
import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
OUT = argv[0] if len(argv) > 0 else "public/game/buildings"

# 名称, 院落宽, 院落深, 屋顶主色, 院墙色
VARIANTS = [
    ("house-c", 6.0, 4.6, (0.20, 0.23, 0.26), (0.52, 0.50, 0.46)),
    ("shop-c", 6.8, 5.0, (0.24, 0.26, 0.28), (0.48, 0.46, 0.42)),
    ("temple-c", 8.0, 6.0, (0.18, 0.30, 0.26), (0.58, 0.40, 0.32)),
]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, rough=0.75, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def tex_mat(name, img_path, color=(1, 1, 1), rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    try:
        img = bpy.data.images.load(img_path, check_existing=True)
    except Exception:
        img = None
    tex = nt.nodes.new("ShaderNodeTexImage")
    if img:
        tex.image = img
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (2.2, 2.2, 2.2)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def cube(name, size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(m)
    return o


def gabled_roof(prefix, w, d, h, z, m_tile, m_ridge):
    """硬山屋顶：两坡 + 正脊 + 瓦垄"""
    half = d / 2
    slope = math.atan2(h, half)
    objs = []
    # 两坡屋面
    for sign in (-1, 1):
        length = math.hypot(half, h)
        o = cube(f"{prefix}_slope{sign}", (w, length, 0.12),
                 (0, sign * half / 2, z + h / 2), m_tile,
                 rot=(sign * slope, 0, 0))
        objs.append(o)
    # 正脊
    objs.append(cube(f"{prefix}_ridge", (w * 1.02, 0.22, 0.22), (0, 0, z + h + 0.06), m_ridge))
    # 瓦垄（沿坡面等距细条，增加瓦片节奏）
    cols = max(8, int(w / 0.34))
    for i in range(cols):
        x = -w / 2 + (i + 0.5) * (w / cols)
        for sign in (-1, 1):
            length = math.hypot(half, h)
            o = cube(f"{prefix}_tile{i}_{sign}", (0.07, length * 0.98, 0.09),
                     (x, sign * half / 2, z + h / 2 + 0.06), m_ridge,
                     rot=(sign * slope, 0, 0))
            objs.append(o)
    return objs


def build(cid, W, D, tile_c, wall_c):
    TILES = "C:/Users/机智如我/Documents/deepseek-harness/default-workspace/muse-new"
    roof_img = TILES + "/79769c8b23.png"   # 筒瓦
    brick_img = TILES + "/7843f6faad.png"  # 青砖
    earth_img = TILES + "/2ae69c3853.png"  # 夯土/石面
    m_tile = tex_mat(cid + "_tile", roof_img, rough=0.85)
    m_ridge = mat(cid + "_ridge", (tile_c[0] * 0.6, tile_c[1] * 0.6, tile_c[2] * 0.62), 0.85)
    m_wall = tex_mat(cid + "_wall", brick_img, rough=0.9)
    m_wood = mat(cid + "_wood", (0.30, 0.20, 0.13), 0.7)
    m_stone = mat(cid + "_stone", (0.44, 0.44, 0.42), 0.85)
    m_ground = tex_mat(cid + "_ground", earth_img, rough=0.92)

    # 台基
    cube(f"{cid}_base", (W, D, 0.24), (0, 0, 0.12), m_stone)
    # 院内铺装
    cube(f"{cid}_court", (W - 0.7, D - 0.7, 0.06), (0, 0, 0.25), m_ground)
    # 院墙（四面，留正面门口）
    t = 0.22
    cube(f"{cid}_wall_n", (W, t, 0.9), (0, D / 2 - t / 2, 0.70), m_wall)
    cube(f"{cid}_wall_w", (t, D, 0.9), (-W / 2 + t / 2, 0, 0.70), m_wall)
    cube(f"{cid}_wall_e", (t, D, 0.9), (W / 2 - t / 2, 0, 0.70), m_wall)
    cube(f"{cid}_wall_s1", ((W - 1.6) / 2, t, 0.9), (-(W / 2 - (W - 1.6) / 4), -D / 2 + t / 2, 0.70), m_wall)
    cube(f"{cid}_wall_s2", ((W - 1.6) / 2, t, 0.9), ((W / 2 - (W - 1.6) / 4), -D / 2 + t / 2, 0.70), m_wall)
    # 门枕
    for sx in (-0.9, 0.9):
        cube(f"{cid}_post{sx}", (0.18, 0.18, 1.1), (sx, -D / 2 + 0.11, 0.80), m_wood)

    # 正房（后方，抬高）
    hall_w = W * 0.86
    hall_d = D * 0.42
    hall_y = D / 2 - hall_d / 2 - 0.5
    cube(f"{cid}_hall", (hall_w, hall_d, 1.0), (0, hall_y, 0.75), m_wood)
    # 柱
    for i in range(5):
        x = -hall_w / 2 + 0.3 + i * (hall_w - 0.6) / 4
        cube(f"{cid}_pillar{i}", (0.14, 0.14, 1.15), (x, hall_y - hall_d / 2 + 0.16, 0.82), m_wood)
    gabled_roof(f"{cid}_hallroof", hall_w * 1.08, hall_d * 1.12, hall_d * 0.42, 1.28, m_tile, m_ridge)

    # 厢房（左右各一间）
    for sx in (-1, 1):
        wing_w = W * 0.22
        wing_d = D * 0.4
        wx = sx * (W / 2 - wing_w / 2 - 0.35)
        cube(f"{cid}_wing{sx}", (wing_w, wing_d, 0.85), (wx, 0.2, 0.68), m_wood)
        gabled_roof(f"{cid}_wingroof{sx}", wing_w * 1.1, wing_d * 1.12, wing_d * 0.4, 1.12, m_tile, m_ridge)


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"

    scene.world = bpy.data.worlds.new("W")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.35, 0.38, 0.42, 1)
    bg.inputs[1].default_value = 0.55

    # 主光：左上方向（与游戏内统一光源一致）
    bpy.ops.object.light_add(type="SUN", location=(-4, 4, 6))
    sun = bpy.context.object
    sun.data.energy = 3.2
    sun.data.angle = math.radians(6)
    sun.rotation_euler = (math.radians(38), 0, math.radians(-42))
    sun.data.use_shadow = True

    bpy.ops.object.light_add(type="SUN", location=(5, -4, 3))
    fill = bpy.context.object
    fill.data.energy = 1.0
    fill.data.angle = math.radians(25)
    fill.rotation_euler = (math.radians(60), 0, math.radians(120))
    fill.data.use_shadow = False


def render_top(cid, path, W, D):
    scene = bpy.context.scene
    # 阴影承接面：接收落地阴影，导出时保持透明
    bpy.ops.mesh.primitive_plane_add(size=max(W, D) * 3, location=(0, 0, 0.0))
    plane = bpy.context.object
    plane.name = f"{cid}_catcher"
    plane.is_shadow_catcher = True

    # 正交俯视，轻微俯角
    target = Vector((0, 0, 0.8))
    loc = Vector((0, -2.6, 9.0))
    rot = (target - loc).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=loc, rotation=rot)
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = max(W, D) * 1.22
    scene.camera = cam

    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for cid, W, D, tile_c, wall_c in VARIANTS:
        reset()
        setup_scene()
        build(cid, W, D, tile_c, wall_c)
        p = os.path.join(OUT, cid + ".png")
        render_top(cid, p, W, D)
        print(f"[BLD] {cid} -> {p}", flush=True)
    print("完成", len(VARIANTS), "个建筑", flush=True)


main()
