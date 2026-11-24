# -*- coding: utf-8 -*-
"""
按《江湖同伴》宣传图的人物设定，程序化生成 15 位同伴的低模 3D 角色。
每位导出独立 GLB，并渲染一张合影预览。

用法：
  blender -b -P scripts/blender/make_companions.py -- <preview_png> <out_glb_dir>
"""
import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
PREVIEW = argv[0] if len(argv) > 0 else "companions.png"
OUT_DIR = argv[1] if len(argv) > 1 else "public/game/models/companions"

# ── 同伴设定：id / 姓名 / 定位 / 主色 / 副色 / 兵器 ──────────────────────────
ROSTER = [
    ("shen-qingyi",   "沈青衣", "护卫", (0.16, 0.22, 0.26), (0.62, 0.68, 0.72), "shield"),
    ("liu-hongxiao",  "柳红绡", "克制", (0.42, 0.05, 0.08), (0.86, 0.20, 0.22), "saber"),
    ("gu-changfeng",  "顾长风", "剑客", (0.14, 0.28, 0.46), (0.78, 0.84, 0.90), "sword"),
    ("su-yueli",      "苏月璃", "治疗", (0.82, 0.86, 0.88), (0.42, 0.66, 0.70), "staff"),
    ("tang-wuying",   "唐无影", "控制", (0.07, 0.07, 0.09), (0.34, 0.18, 0.46), "dagger"),
    ("baili-shenji",  "百里神机", "远程", (0.30, 0.22, 0.14), (0.62, 0.46, 0.26), "gun"),
    ("xiao-lie",      "萧烈",   "爆血", (0.30, 0.10, 0.08), (0.70, 0.24, 0.14), "saber"),
    ("murong-xue",    "慕容雪", "冰霜", (0.74, 0.84, 0.90), (0.40, 0.62, 0.86), "sword"),
    ("tie-shan",      "铁山",   "防御", (0.24, 0.19, 0.14), (0.40, 0.34, 0.24), "fist"),
    ("bai-jiuer",     "白九儿", "毒术", (0.24, 0.10, 0.30), (0.34, 0.58, 0.30), "dagger"),
    ("a-fu",          "阿福",   "辅助", (0.72, 0.62, 0.38), (0.86, 0.62, 0.24), "beads"),
    ("ye-zhiqiu",     "叶知秋", "谋士", (0.58, 0.58, 0.56), (0.20, 0.22, 0.24), "fan"),
    ("han-qianren",   "韩千刃", "残刀", (0.22, 0.06, 0.06), (0.52, 0.14, 0.12), "saber"),
    ("dongfang-wuya", "东方无涯", "传说", (0.86, 0.84, 0.78), (0.78, 0.62, 0.24), "sword"),
    ("zhou-buyi",     "周不疑", "寻宝", (0.34, 0.28, 0.16), (0.24, 0.34, 0.22), "tool"),
]


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


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True


def assign(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)


def sphere(name, scale, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=loc, rotation=rot, segments=20, ring_count=12)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o, m)
    smooth(o)
    return o


def box(name, scale, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(o, m)
    return o


def cyl(name, r, depth, loc, m, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    assign(o, m)
    smooth(o)
    return o


def cone(name, r1, r2, depth, loc, m, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    assign(o, m)
    smooth(o)
    return o


def build(cid, name, role, main_c, sub_c, weapon, offset_x=0.0):
    """构建一个低模武侠角色，返回对象列表。脚底在 z=0，身高约 1.8。"""
    objs = []
    m_main = mat(cid + "_main", main_c, 0.62)
    m_sub = mat(cid + "_sub", sub_c, 0.45, 0.3 if weapon in ("sword", "saber", "dagger", "gun") else 0.0)
    m_skin = mat(cid + "_skin", (0.78, 0.66, 0.55), 0.7)
    m_hair = mat(cid + "_hair", (0.06, 0.06, 0.07), 0.8)

    ox = offset_x

    # 腿
    for sx in (-0.09, 0.09):
        objs.append(cyl(f"{cid}_leg{sx}", 0.075, 0.78, (ox + sx, 0, 0.39), m_main))
    # 靴
    for sx in (-0.09, 0.09):
        objs.append(box(f"{cid}_boot{sx}", (0.11, 0.16, 0.08), (ox + sx, 0.02, 0.05), m_hair))

    # 躯干（上宽下窄）
    objs.append(cone(f"{cid}_torso", 0.185, 0.24, 0.62, (ox, 0, 1.06), m_main))
    # 腰带
    objs.append(cyl(f"{cid}_belt", 0.20, 0.06, (ox, 0, 0.78), m_sub, verts=20))
    # 下摆（长袍）
    objs.append(cone(f"{cid}_robe", 0.30, 0.20, 0.52, (ox, 0, 0.55), m_main, verts=20))

    # 肩
    for sx in (-0.22, 0.22):
        objs.append(sphere(f"{cid}_shoulder{sx}", (0.085, 0.085, 0.075), (ox + sx, 0, 1.34), m_sub))
    # 手臂
    for sx in (-0.235, 0.235):
        objs.append(cyl(f"{cid}_arm{sx}", 0.055, 0.52, (ox + sx, 0, 1.06), m_main))
    # 手
    for sx in (-0.235, 0.235):
        objs.append(sphere(f"{cid}_hand{sx}", (0.055, 0.055, 0.06), (ox + sx, 0, 0.78), m_skin))

    # 脖子 + 头
    objs.append(cyl(f"{cid}_neck", 0.055, 0.09, (ox, 0, 1.44), m_skin))
    objs.append(sphere(f"{cid}_head", (0.125, 0.135, 0.15), (ox, 0, 1.58), m_skin))
    # 发
    objs.append(sphere(f"{cid}_hair", (0.135, 0.14, 0.115), (ox, -0.012, 1.63), m_hair))
    objs.append(cyl(f"{cid}_pigtail", 0.045, 0.30, (ox, -0.11, 1.44), m_hair, rot=(math.radians(14), 0, 0), verts=12))
    # 眼睛（让角色可辨认）
    for sx in (-0.045, 0.045):
        objs.append(sphere(f"{cid}_eye{sx}", (0.017, 0.012, 0.019), (ox + sx, -0.118, 1.585), m_hair))
    # 衣领
    objs.append(box(f"{cid}_collar", (0.20, 0.20, 0.05), (ox, 0, 1.395), m_sub))

    # 兵器
    wx = ox + 0.30
    if weapon == "sword":
        objs.append(box(f"{cid}_blade", (0.05, 0.016, 1.00), (wx, 0, 1.06), m_sub))
        objs.append(box(f"{cid}_guard", (0.10, 0.025, 0.025), (wx, 0, 0.56), m_sub))
        objs.append(cyl(f"{cid}_grip", 0.022, 0.16, (wx, 0, 0.47), m_hair, verts=10))
    elif weapon == "saber":
        objs.append(box(f"{cid}_blade", (0.058, 0.018, 0.86), (wx, 0, 1.08), m_sub, rot=(0, math.radians(-8), 0)))
        objs.append(box(f"{cid}_guard", (0.09, 0.03, 0.03), (wx, 0, 0.66), m_sub))
        objs.append(cyl(f"{cid}_grip", 0.024, 0.16, (wx, 0, 0.57), m_hair, verts=10))
    elif weapon == "dagger":
        objs.append(box(f"{cid}_blade", (0.022, 0.010, 0.34), (wx, 0, 1.18), m_sub))
        objs.append(cyl(f"{cid}_grip", 0.02, 0.12, (wx, 0, 1.00), m_hair, verts=10))
    elif weapon == "staff":
        objs.append(cyl(f"{cid}_staff", 0.024, 1.72, (wx, 0, 0.96), m_sub, verts=12))
        objs.append(sphere(f"{cid}_orb", (0.06, 0.06, 0.06), (wx, 0, 1.86), m_sub))
    elif weapon == "gun":
        objs.append(cyl(f"{cid}_barrel", 0.028, 1.05, (wx, 0, 1.20), m_sub, rot=(0, math.radians(-72), 0), verts=12))
        objs.append(box(f"{cid}_stock", (0.05, 0.09, 0.22), (wx - 0.20, 0, 1.05), m_hair))
    elif weapon == "fan":
        objs.append(cone(f"{cid}_fan", 0.22, 0.02, 0.02, (wx, 0, 1.10), m_sub, rot=(math.radians(90), 0, 0), verts=14))
        objs.append(cyl(f"{cid}_fanstick", 0.012, 0.20, (wx, 0, 1.02), m_hair, verts=8))
    elif weapon == "shield":
        objs.append(cyl(f"{cid}_shield", 0.26, 0.05, (ox - 0.34, 0.06, 1.02), m_sub, rot=(0, math.radians(90), 0), verts=20))
    elif weapon == "fist":
        for sx in (-0.235, 0.235):
            objs.append(sphere(f"{cid}_wrap{sx}", (0.075, 0.075, 0.08), (ox + sx, 0, 0.76), m_sub))
    elif weapon == "beads":
        for i in range(8):
            a = math.radians(i * 45)
            objs.append(sphere(f"{cid}_bead{i}", (0.035, 0.035, 0.035),
                               (ox + 0.16 * math.cos(a), 0.05, 1.24 + 0.16 * math.sin(a)), m_sub))
    elif weapon == "tool":
        objs.append(cyl(f"{cid}_handle", 0.018, 0.66, (wx, 0, 1.10), m_hair, verts=10))
        objs.append(box(f"{cid}_head", (0.10, 0.03, 0.10), (wx, 0, 1.44), m_sub))

    return objs


def export_glb(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )


def render_lineup(path, cols=8):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 360
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("W")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.045, 0.05, 0.06, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

    bpy.ops.object.light_add(type="AREA", location=(2.5, -4.0, 4.5))
    key = bpy.context.object
    key.data.energy = 900
    key.data.size = 4.0
    key.rotation_euler = (math.radians(58), 0, math.radians(28))

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -3.0, 3.0))
    fill = bpy.context.object
    fill.data.energy = 350
    fill.data.size = 5.0
    fill.rotation_euler = (math.radians(64), 0, math.radians(-38))

    # 依据所有模型的世界包围盒自动取景（正交投影，人物不变形）
    xs, ys, zs = [], [], []
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    cx = (min(xs) + max(xs)) / 2
    cz = (min(zs) + max(zs)) / 2
    width = max(xs) - min(xs)
    height = max(zs) - min(zs)

    bpy.ops.object.camera_add(location=(cx, -18.0, cz), rotation=(math.radians(90), 0, 0))
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = width * 1.02
    scene.camera = cam

    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.01))
    ground = bpy.context.object
    assign(ground, mat("ground", (0.07, 0.075, 0.085), 0.9))

    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    reset()
    os.makedirs(OUT_DIR, exist_ok=True)

    per_row = 15
    spacing = 1.30
    results = []

    for i, (cid, name, role, main_c, sub_c, weapon) in enumerate(ROSTER):
        col = i % per_row
        x = (col - (per_row - 1) / 2.0) * spacing
        y = 0.0

        objs = build(cid, name, role, main_c, sub_c, weapon, offset_x=x)
        # 同一场景里排布，方便渲染合影
        for o in objs:
            o.location.y += y

        # 单独导出（先移回原点再导出）
        for o in objs:
            o.location.x -= x
            o.location.y -= y
        glb = os.path.join(OUT_DIR, cid + ".glb")
        export_glb(objs, glb)
        size_kb = round(os.path.getsize(glb) / 1024) if os.path.exists(glb) else 0
        print(f"[{i+1}/{len(ROSTER)}] {name}({role}) -> {cid}.glb {size_kb}KB", flush=True)
        results.append((cid, size_kb))

        # 移回排布位置
        for o in objs:
            o.location.x += x
            o.location.y += y

    render_lineup(PREVIEW)
    print(f"\n合影已渲染: {PREVIEW}", flush=True)
    print("完成 %d 个模型" % len(results), flush=True)


try:
    main()
except Exception:
    traceback.print_exc()
    sys.exit(1)
