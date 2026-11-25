'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 江湖世界层：可自由行走的洛阳城（Canvas 2.5D 俯视）
 * - WASD / 方向键移动，手机端拖拽虚拟摇杆
 * - 建筑与城墙有碰撞，城门可出城（切换城市）
 * - 靠近 NPC 显示交互提示，点击/按 E 触发对应剧情节点
 */

type Npc = {
  id: string;
  name: string;
  x: number;
  y: number;
  node: string;
  kind: 'main' | 'side';
  hint: string;
  questTitle?: string;
  questDone?: boolean;
  questActive?: boolean;
  /** 所属区域 key */
  region?: string;
};

type Region = { key: string; name: string; x: number; y: number; w: number; h: number };

type Building = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'house' | 'temple' | 'shop' | 'inn' | 'gate';
  name?: string;
};

type City = {
  key: string;
  name: string;
  w: number;
  h: number;
  ground: string;
  road: string;
  buildings: Building[];
  npcs: Npc[];
  regions?: Region[];
  props?: { x: number; y: number; kind: 'tree' | 'lantern' | 'stall'; scale?: number }[];
  water?: { x: number; y: number; w: number; h: number };
};

const LUOYANG: City = {
  key: 'luoyang',
  name: '洛阳',
  w: 2000,
  h: 1500,
  ground: '#2b2a26',
  road: '#4a463d',
  water: { x: 0, y: 1180, w: 2000, h: 120 },
  buildings: [
    // 北城墙 + 城门
    { x: 0, y: 0, w: 2000, h: 90, kind: 'house' },
    { x: 0, y: 0, w: 90, h: 1500, kind: 'house' },
    { x: 1910, y: 0, w: 90, h: 1500, kind: 'house' },
    { x: 0, y: 1410, w: 2000, h: 90, kind: 'house' },
    { x: 900, y: 0, w: 200, h: 90, kind: 'gate', name: '北门' },
    // 主干道两侧屋舍
    { x: 260, y: 260, w: 240, h: 170, kind: 'inn', name: '悦来客栈' },
    { x: 620, y: 220, w: 200, h: 150, kind: 'shop', name: '药铺' },
    { x: 1080, y: 240, w: 220, h: 160, kind: 'shop', name: '铁匠铺' },
    { x: 1480, y: 260, w: 260, h: 180, kind: 'house', name: '沈家旧宅' },
    { x: 240, y: 640, w: 210, h: 160, kind: 'house', name: '民居' },
    { x: 1520, y: 650, w: 230, h: 170, kind: 'house', name: '民居' },
    // 城中心：衙门
    { x: 780, y: 560, w: 440, h: 260, kind: 'temple', name: '洛阳衙署' },
    // 南侧集市
    { x: 340, y: 960, w: 260, h: 160, kind: 'shop', name: '灯市摊' },
    { x: 1180, y: 950, w: 300, h: 170, kind: 'shop', name: '茶楼' },
    // 西巷 / 东巷两侧屋舍（形成巷道层次）
    { x: 300, y: 440, w: 200, h: 130, kind: 'house', name: '民居' },
    { x: 300, y: 1080, w: 200, h: 130, kind: 'house', name: '民居' },
    { x: 1520, y: 460, w: 210, h: 140, kind: 'house', name: '民居' },
    { x: 1520, y: 1080, w: 210, h: 140, kind: 'house', name: '民居' },
    // 衙署两侧的偏院
    { x: 620, y: 560, w: 140, h: 110, kind: 'house', name: '偏院' },
    { x: 1250, y: 560, w: 140, h: 110, kind: 'house', name: '偏院' },
  ],
  props: [
    // 主街两侧灯笼
    { x: 770, y: 320, kind: 'lantern' }, { x: 770, y: 520, kind: 'lantern' },
    { x: 770, y: 900, kind: 'lantern' }, { x: 770, y: 1100, kind: 'lantern' },
    { x: 1230, y: 320, kind: 'lantern' }, { x: 1230, y: 520, kind: 'lantern' },
    { x: 1230, y: 900, kind: 'lantern' }, { x: 1230, y: 1100, kind: 'lantern' },
    // 广场四周树
    { x: 700, y: 520, kind: 'tree' }, { x: 1300, y: 520, kind: 'tree' },
    { x: 700, y: 880, kind: 'tree' }, { x: 1300, y: 880, kind: 'tree' },
    // 城门内两株古树
    { x: 880, y: 150, kind: 'tree' }, { x: 1120, y: 150, kind: 'tree' },
    { x: 260, y: 900, kind: 'tree' }, { x: 1740, y: 900, kind: 'tree' },
    { x: 260, y: 620, kind: 'tree' }, { x: 1740, y: 620, kind: 'tree' },
    { x: 520, y: 300, kind: 'lantern' }, { x: 1480, y: 300, kind: 'lantern' },
  ],
  npcs: [
    { id: 'n1', name: '顾长风', x: 1000, y: 900, node: 'a01', kind: 'main', hint: '主线 · 顾长风在等你', region: 'gov' },
    { id: 'n2', name: '苏挽', x: 520, y: 760, node: 'a05', kind: 'main', hint: '主线 · 白衣女子受了伤', region: 'guild' },
    { id: 'n3', name: '独眼掌柜', x: 380, y: 380, node: 'a06', kind: 'side', hint: '支线 · 悦来客栈有消息', region: 'inn' },
    { id: 'n4', name: '灯市老翁', x: 470, y: 1050, node: 'a04', kind: 'side', hint: '支线 · 灯市听棋', region: 'market' },
    { id: 'n5', name: '青城弟子', x: 1200, y: 400, node: 'a02', kind: 'side', hint: '支线 · 渡口风波', region: 'smith' },
  ],
  regions: [
    { key: 'gate', name: '洛阳城门', x: 760, y: 0, w: 480, h: 220 },
    { key: 'inn', name: '悦来客栈', x: 220, y: 220, w: 320, h: 250 },
    { key: 'herb', name: '百草堂', x: 580, y: 190, w: 280, h: 220 },
    { key: 'smith', name: '铁匠铺', x: 1040, y: 200, w: 300, h: 230 },
    { key: 'gov', name: '洛阳官府', x: 740, y: 520, w: 520, h: 330 },
    { key: 'guild', name: '武馆', x: 200, y: 600, w: 300, h: 260 },
    { key: 'market', name: '城南集市', x: 300, y: 930, w: 340, h: 230 },
    { key: 'black', name: '地下黑市', x: 1140, y: 900, w: 380, h: 260 },
    { key: 'street', name: '洛阳主街', x: 700, y: 180, w: 620, h: 760 },
    { key: 'woods', name: '城外山林', x: 0, y: 1240, w: 2000, h: 260 },
  ],
};

/** NPC -> 任务链 id 的显式映射（替代此前的下标取模） */
export const WORLD_NPC_QUESTS: Record<string, string> = {
  n1: 'q-ember-scout',
  n2: 'q-ember-letter',
  n3: 'q-temple-elder',
  n4: 'q-fuzhou-chain',
  n5: 'q-valley-herb',
};

const CITIES: Record<string, City> = { luoyang: LUOYANG };

/** 镜头缩放：0.55 表示视野放大，能同时看到半座城 */
const ZOOM = 0.55;

const ROOF: Record<Building['kind'], string> = {
  house: '#3a3f4a',
  temple: '#7a3a2a',
  shop: '#4a4230',
  inn: '#5a3a24',
  gate: '#2f3a44',
};

export type WorldHud = {
  activeTitle?: string;
  mainDone: number;
  mainTotal: number;
  sideDone: number;
  sideTotal: number;
  reputation?: number;
};

export function WorldScene({
  onEnterNode,
  onClose,
  school,
  hud,
  npcQuests,
}: {
  onEnterNode: (nodeId: string) => void;
  onClose: () => void;
  school: 'quan' | 'jian' | 'dao';
  hud?: WorldHud;
  npcQuests?: Record<string, { title: string; done: boolean; active: boolean }>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const joyRef = useRef<{ active: boolean; dx: number; dy: number; id: number }>({ active: false, dx: 0, dy: 0, id: -1 });
  const playerRef = useRef({ x: 1000, y: 1000, vx: 0, vy: 0, face: 1 });
  const cameraRef = useRef({ x: 0, y: 0 });
  const nearRef = useRef<Npc | null>(null);
  const questsRef = useRef<Record<string, { title: string; done: boolean; active: boolean }>>({});
  useEffect(() => { questsRef.current = npcQuests ?? {}; }, [npcQuests]);
  const [nearNpc, setNearNpc] = useState<Npc | null>(null);
  const [cityKey, setCityKey] = useState('luoyang');
  const [entered, setEntered] = useState(false);
  const [regionName, setRegionName] = useState('');
  const regionRef = useRef('');
  const spritesRef = useRef<Record<string, HTMLImageElement | null>>({});
  const city = CITIES[cityKey] ?? LUOYANG;

  // 预载贴片与主角小人
  useEffect(() => {
    const files: Record<string, string> = {
      'hero-dao': '/game/world/hero-dao.webp',
      'hero-jian': '/game/world/hero-jian.webp',
      'hero-quan': '/game/world/hero-quan.webp',
      ground: '/game/world/tiles/tile-ground.webp',
      ground1: '/game/world/tiles/tile-ground-1.webp',
      ground2: '/game/world/tiles/tile-ground-2.webp',
      ground3: '/game/world/tiles/tile-ground-3.webp',
      ground4: '/game/world/tiles/tile-ground-4.webp',
      road1: '/game/world/tiles/tile-road-1.webp',
      road2: '/game/world/tiles/tile-road-2.webp',
      road: '/game/world/tiles/tile-road.webp',
      'house-a': '/game/world/tiles/obj-house-a.webp',
      'house-b': '/game/world/tiles/obj-house-b.webp',
      temple: '/game/world/tiles/obj-temple.webp',
      inn: '/game/world/tiles/obj-inn.webp',
      gate: '/game/world/tiles/obj-gate.webp',
      wall: '/game/world/tiles/obj-wall.webp',
      bridge: '/game/world/tiles/obj-bridge.webp',
      tree: '/game/world/tiles/obj-tree.webp',
      lantern: '/game/world/tiles/obj-lantern.webp',
    };
    for (const k of Object.keys(files)) {
      const img = new Image();
      img.src = files[k];
      img.onload = () => { spritesRef.current[k] = img; };
    }
  }, []);

  const enterNpc = useCallback(
    (npc: Npc | null) => {
      if (!npc) return;
      onEnterNode(npc.node);
      onClose();
    },
    [onEnterNode, onClose]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if ((e.key === 'e' || e.key === 'E' || e.key === ' ') && nearRef.current) {
        e.preventDefault();
        enterNpc(nearRef.current);
      }
      if (e.key === 'Escape') onClose();
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enterNpc, onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const SOLID = city.buildings;

    /** 按矩形从最小优先匹配所在区域 */
    const regionAt = (x: number, y: number): Region | null => {
      const list = (city.regions ?? []).slice().sort((a, b) => a.w * a.h - b.w * b.h);
      for (const r of list) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
      }
      return null;
    };
    let groundPattern: CanvasPattern | null = null;
    let roadPattern: CanvasPattern | null = null;

    const hits = (x: number, y: number, r: number) =>
      SOLID.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h);

    const step = (dt: number) => {
      const p = playerRef.current;
      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      const joy = joyRef.current;
      if (joy.active) {
        dx = joy.dx;
        dy = joy.dy;
      }
      const len = Math.hypot(dx, dy) || 1;
      const speed = 260;
      const nx = (dx / len) * speed * dt;
      const ny = (dy / len) * speed * dt;

      if (Math.abs(dx) > 0.05) p.face = dx > 0 ? 1 : -1;

      const R = 16;
      if (!hits(p.x + nx, p.y, R)) p.x += nx;
      if (!hits(p.x, p.y + ny, R)) p.y += ny;
      p.x = Math.max(R, Math.min(city.w - R, p.x));
      p.y = Math.max(R, Math.min(city.h - R, p.y));

      // 最近可交互 NPC
      let best: Npc | null = null;
      let bestD = 90;
      for (const n of city.npcs) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      const rg = regionAt(p.x, p.y);
      const rname = rg?.name ?? city.name + '城内';
      if (regionRef.current !== rname) {
        regionRef.current = rname;
        setRegionName(rname);
      }

      nearRef.current = best;
      setNearNpc((prev) => (prev?.id === best?.id ? prev : best));

      const vw = canvas.clientWidth;
      const vh = canvas.clientHeight;
      const viewW = vw / ZOOM;
    const viewH = vh / ZOOM;
    cameraRef.current.x = Math.max(0, Math.min(Math.max(0, city.w - viewW), p.x - viewW / 2));
      cameraRef.current.y = Math.max(0, Math.min(Math.max(0, city.h - viewH), p.y - viewH / 2));
    };

    const buildingSprite = (b: Building) => {
      const R = spritesRef.current;
      switch (b.kind) {
        case 'temple': return R['temple'];
        case 'inn': return R['inn'];
        case 'gate': return R['gate'];
        case 'shop': return R['house-a'];
        default:
          // 民居按位置交替用两种屋顶，避免整条街重复
          return (Math.floor(b.x / 120) % 2 === 0 ? R["house-a"] : R["house-b"]);
      }
    };

    const drawBuilding = (b: Building) => {
      const { x, y, w, h } = b;
      const R = spritesRef.current;
      const sprite = buildingSprite(b);
      const isWall = b.w >= 700 || b.h >= 700;
      if (!isWall && b.kind !== 'gate') {
        // 统一光源（左上）：阴影朝右下偏移，形成一致的立体关系
        ctx.save();
        ctx.fillStyle = 'rgba(6,10,16,0.42)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2 + w * 0.10, y + h + 2, w * 0.54, h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        // 接地暗部：屋檐正下方压暗一圈，去掉“贴纸浮空”感
        const gg = ctx.createLinearGradient(0, y + h - h * 0.55, 0, y + h + 10);
        gg.addColorStop(0, 'rgba(0,0,0,0)');
        gg.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = gg;
        ctx.fillRect(x - 4, y + h - h * 0.55, w + 12, h * 0.55 + 10);
        ctx.restore();
      }
      const isLongWall = b.w >= 700 || b.h >= 700;
      const wallSprite = R['wall'];

      if (isLongWall && wallSprite) {
        // 城墙：沿长轴用城墙贴片平铺
        if (b.w >= b.h) {
          const th = Math.max(70, b.h * 1.9);
          const tw = th * (wallSprite.width / wallSprite.height);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y - th, w, h + th);
          ctx.clip();
          for (let px = x; px < x + w; px += tw) ctx.drawImage(wallSprite, px, y + h - th, tw, th);
          ctx.restore();
        } else {
          const tw2 = Math.max(70, b.w * 1.9);
          const th2 = tw2 * (wallSprite.height / wallSprite.width);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - tw2, y, w + tw2, h);
          ctx.clip();
          for (let py = y; py < y + h; py += th2) ctx.drawImage(wallSprite, x + w - tw2, py, tw2, th2);
          ctx.restore();
        }
      } else if (sprite) {
        if (b.kind === 'gate') {
          // 城门楼：居中放大，底边对齐
          const dh = Math.max(h * 2.4, 200);
          const dw = dh * (sprite.width / sprite.height);
          ctx.drawImage(sprite, x + (w - dw) / 2, y + h - dh, dw, dh);
        } else {
          // 普通建筑：最多按原图 1:1 绘制（不放大），底边对齐地块下沿
          const scale = Math.min((w * 1.12) / sprite.width, (h * 1.7) / sprite.height, 1);
          const dw = sprite.width * scale;
          const dh = sprite.height * scale;
          ctx.drawImage(sprite, x + (w - dw) / 2, y + h - dh, dw, dh);
        }
      } else {
        ctx.fillStyle = '#2a2e36';
        ctx.fillRect(x, y, w, h);
      }
      if (b.name) {
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, x + w / 2, y - 6);
        ctx.textAlign = 'left';
      }
    };

    const drawNpc = (n: Npc) => {
      const bob = Math.sin(performance.now() / 420 + n.x) * 2;
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 22, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // 身体
      ctx.fillStyle = n.kind === 'main' ? '#8c3a2a' : '#3a4a63';
      ctx.beginPath();
      ctx.roundRect(n.x - 11, n.y - 6 + bob, 22, 28, 6);
      ctx.fill();
      // 头
      ctx.fillStyle = '#d8b08a';
      ctx.beginPath();
      ctx.arc(n.x, n.y - 14 + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      // 任务标记：追踪中金色脉冲，未完成红色/蓝色，已完成淡灰
      const q = questsRef.current[n.id];
      const active = q?.active === true;
      const done = q?.done === true;
      const px = playerRef.current;
      if (active) {
        const pulse = 1 + Math.sin(performance.now() / 260) * 0.18;
        ctx.strokeStyle = 'rgba(255,209,102,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y - 6, 22 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = done ? 'rgba(160,170,180,0.45)' : active ? '#ffd166' : n.kind === 'main' ? '#e05a4a' : '#8ecae6';
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(done ? '·' : n.kind === 'main' ? '!' : '?', n.x, n.y - 32 + bob);
      if (active) {
        const dist = Math.round(Math.hypot(px.x - n.x, px.y - n.y) / 10);
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,209,102,0.95)';
        ctx.fillText(dist + 'm', n.x, n.y - 48 + bob);
      }
      ctx.textAlign = 'left';
    };

    const drawPlayer = () => {
      const p = playerRef.current;
      const bob = Math.sin(performance.now() / 220) * 1.5;
      const sprite = spritesRef.current[school];
      if (sprite) {
        const W = 78;
        const H = 90;
        ctx.save();
        ctx.translate(p.x, p.y + 6);
        if (p.face < 0) ctx.scale(-1, 1);
        ctx.drawImage(sprite, -W / 2, -H + 12 + bob, W, H);
        ctx.restore();
        return;
      }
      // 贴图未就绪时的占位小人
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 24, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // 衣袍
      ctx.fillStyle = school === 'dao' ? '#2a3550' : school === 'jian' ? '#4a5570' : '#5a4030';
      ctx.beginPath();
      ctx.roundRect(p.x - 13, p.y - 8 + bob, 26, 34, 8);
      ctx.fill();
      // 腰带
      ctx.fillStyle = '#b8912f';
      ctx.fillRect(p.x - 12, p.y + 8 + bob, 24, 5);
      // 头
      ctx.fillStyle = '#d8b08a';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 18 + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      // 发髻
      ctx.fillStyle = '#1a1a1e';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 26 + bob, 7, Math.PI, Math.PI * 2);
      ctx.fill();
      // 朝向
      ctx.fillStyle = '#0d0f12';
      ctx.beginPath();
      ctx.arc(p.x + p.face * 4, p.y - 18 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt);

      const vw = canvas.clientWidth;
      const vh = canvas.clientHeight;
      const cam = cameraRef.current;

      ctx.clearRect(0, 0, vw, vh);
      ctx.save();
      ctx.scale(ZOOM, ZOOM);
      ctx.translate(-cam.x, -cam.y);

      // 地面：按 512 网格随机取 4 种变体，消除平铺重复感
      const R0 = spritesRef.current;
      const gVariants = [R0['ground1'], R0['ground2'], R0['ground3'], R0['ground4']].filter(
        (im) => im && im.complete
      ) as HTMLImageElement[];
      const CELL = 256;
      if (gVariants.length) {
        for (let gy = 0; gy < city.h; gy += CELL) {
          for (let gx = 0; gx < city.w; gx += CELL) {
            const idx = (((gx / CELL) * 7 + (gy / CELL) * 13) | 0) % gVariants.length;
            ctx.drawImage(gVariants[idx], gx, gy, CELL, CELL);
          }
        }
      } else {
        const groundImg = R0['ground'];
        if (groundImg && groundImg.complete) {
          if (!groundPattern) groundPattern = ctx.createPattern(groundImg, 'repeat');
          if (groundPattern) {
            ctx.fillStyle = groundPattern;
            ctx.fillRect(0, 0, city.w, city.h);
          }
        } else {
          ctx.fillStyle = city.ground;
          ctx.fillRect(0, 0, city.w, city.h);
        }
      }

      // 主街：贴片平铺
      const roadImg = spritesRef.current['road1'] ?? spritesRef.current['road'];
      if (roadImg && roadImg.complete) {
        if (!roadPattern) roadPattern = ctx.createPattern(roadImg, 'repeat');
        if (roadPattern) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(760, 90, 480, city.h - 180);
          ctx.clip();
          ctx.fillStyle = roadPattern;
          ctx.fillRect(760, 90, 480, city.h - 180);
          ctx.restore();
          ctx.save();
          ctx.beginPath();
          ctx.rect(90, 700, city.w - 180, 180);
          ctx.clip();
          ctx.fillStyle = roadPattern;
          ctx.fillRect(90, 700, city.w - 180, 180);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = city.road;
        ctx.fillRect(760, 90, 480, city.h - 180);
        ctx.fillRect(90, 700, city.w - 180, 180);
      }

      // 主街交叉口：路面向外延展一圈，避免直角硬切
      const roadImg2 = spritesRef.current['road'];
      if (roadImg2 && roadImg2.complete) {
        if (!roadPattern) roadPattern = ctx.createPattern(roadImg2, 'repeat');
        if (roadPattern) {
          ctx.save();
          ctx.fillStyle = roadPattern;
          // 交叉口本体
          ctx.fillRect(700, 640, 600, 300);
          ctx.restore();
        }
      }

      // 砖缝
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < city.w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, city.h);
        ctx.stroke();
      }

      // 河
      if (city.water) {
        const w = city.water;
        const g = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
        g.addColorStop(0, '#0f2a33');
        g.addColorStop(0.45, '#1b4855');
        g.addColorStop(1, '#0d242c');
        ctx.fillStyle = g;
        ctx.fillRect(w.x, w.y, w.w, w.h);

        // 波纹
        ctx.strokeStyle = 'rgba(150,205,225,0.14)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 26; i++) {
          const rx = ((i * 173) % w.w) + w.x;
          const ry = w.y + 14 + ((i * 47) % (w.h - 28));
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.quadraticCurveTo(rx + 26, ry - 3, rx + 54, ry);
          ctx.stroke();
        }

        // 两岸石线
        ctx.strokeStyle = 'rgba(200,215,225,0.22)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w.x, w.y + 2);
        ctx.lineTo(w.x + w.w, w.y + 2);
        ctx.moveTo(w.x, w.y + w.h - 2);
        ctx.lineTo(w.x + w.w, w.y + w.h - 2);
        ctx.stroke();
      }

      city.buildings.forEach(drawBuilding);

      // 装饰物：按 y 排序，形成前后遮挡
      const propImg = (kind: 'tree' | 'lantern' | 'stall') =>
        kind === 'tree' ? R0['tree'] : kind === 'lantern' ? R0['lantern'] : R0['house-a'];
      const props = (city.props ?? []).slice().sort((a, b2) => a.y - b2.y);
      for (const pr of props) {
        const img = propImg(pr.kind);
        if (!img || !img.complete) continue;
        if (pr.kind === 'tree') {
          const h2 = 150 * (pr.scale ?? 1);
          const w2 = h2 * (img.width / img.height);
          ctx.save();
          ctx.fillStyle = 'rgba(6,10,16,0.36)';
          ctx.beginPath();
          ctx.ellipse(pr.x + w2 * 0.10, pr.y + 2, w2 * 0.34, w2 * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.drawImage(img, pr.x - w2 / 2, pr.y - h2 + 18, w2, h2);
        } else if (pr.kind === 'lantern') {
          // 灯笼：小尺寸挂在杆头，光晕淡一点
          const h2 = 40 * (pr.scale ?? 1);
          const w2 = h2 * (img.width / img.height);
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.drawImage(img, pr.x - w2 / 2, pr.y - h2 + 6, w2, h2);
          ctx.restore();
        } else {
          // 摊位：程序化棚子（支柱 + 布顶）
          const sw = 84 * (pr.scale ?? 1);
          const sh = 46 * (pr.scale ?? 1);
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.ellipse(pr.x, pr.y, sw * 0.5, sw * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          // 支柱
          ctx.fillStyle = '#3b3128';
          ctx.fillRect(pr.x - sw * 0.42, pr.y - sh, 5, sh);
          ctx.fillRect(pr.x + sw * 0.42 - 5, pr.y - sh, 5, sh);
          // 布顶
          ctx.fillStyle = '#8a4a34';
          ctx.beginPath();
          ctx.moveTo(pr.x - sw * 0.5, pr.y - sh);
          ctx.lineTo(pr.x + sw * 0.5, pr.y - sh);
          ctx.lineTo(pr.x + sw * 0.34, pr.y - sh * 1.55);
          ctx.lineTo(pr.x - sw * 0.34, pr.y - sh * 1.55);
          ctx.closePath();
          ctx.fill();
          // 摊面
          ctx.fillStyle = '#6d5a3f';
          ctx.fillRect(pr.x - sw * 0.44, pr.y - sh * 0.6, sw * 0.88, sh * 0.28);
          ctx.restore();
        }
      }
      city.npcs.forEach(drawNpc);
      drawPlayer();

      ctx.restore();

      // 氛围：冷调叠色 + 暗角，压掉糖果感
      ctx.save();
      ctx.fillStyle = 'rgba(22,30,44,0.18)';
      ctx.fillRect(0, 0, vw, vh);
      const vg = ctx.createRadialGradient(
        vw / 2, vh / 2, Math.min(vw, vh) * 0.30,
        vw / 2, vh / 2, Math.max(vw, vh) * 0.75
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [city, school, entered]);

  // 触屏摇杆
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    joyRef.current = { active: true, dx: 0, dy: 0, id: e.pointerId };
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const joy = joyRef.current;
    if (!joy.active || joy.id !== e.pointerId) return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = (e.clientX - rect.left - cx) / (rect.width / 2);
    const dy = (e.clientY - rect.top - cy) / (rect.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len) / len;
    joy.dx = dx * k;
    joy.dy = dy * k;
  };
  const onPointerUp = () => {
    joyRef.current = { active: false, dx: 0, dy: 0, id: -1 };
  };

  if (!entered) {
    return (
      <div className="fixed inset-0 z-[85] flex items-center justify-center overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/game/world/luoyang.webp" alt="洛阳城" className="absolute inset-0 h-full w-full object-cover opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/45" />
        <div className="relative flex flex-col items-center gap-3 px-6 text-center">
          <div className="text-[10px] tracking-[0.35em] text-white/40">OPEN WORLD</div>
          <h2 className="text-4xl font-black text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] sm:text-5xl">洛阳城</h2>
          <p className="max-w-md text-[11px] leading-relaxed text-white/65 sm:text-xs">
            WASD / 方向键行走，手机拖动屏幕任意位置当摇杆。
            <br />
            靠近头顶带 <span className="text-warning">!</span> 或 <span className="text-accent">?</span> 的人物，按 E 或点按钮交谈。
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => setEntered(true)}
              className="rounded-full bg-accent px-7 py-2.5 text-sm font-bold text-black shadow-lg transition hover:scale-105"
            >
              进入城中
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/30 px-7 py-2.5 text-sm text-white/85 hover:bg-white/10"
            >
              离开
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-black">
      {/* 顶栏 */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/70 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="rounded bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">🗺️ {city.name}城{regionName ? ` · ${regionName}` : ''}</span>
          <span className="text-[10px] text-white/45">WASD / 拖屏移动 · 靠近人物按 E 或点下方按钮</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/25 px-3 py-1 text-xs text-white/85 hover:bg-white/10"
        >
          离开世界
        </button>
      </div>

      {/* 任务 HUD */}
      {hud && (
        <div className="pointer-events-none absolute left-3 top-14 z-10 w-60 rounded-xl border border-white/12 bg-black/70 p-2.5 backdrop-blur-sm">
          <div className="text-[10px] tracking-wide text-white/40">洛阳 · 当前目标</div>
          <div className="mt-0.5 truncate text-[12px] font-semibold text-accent">
            {hud.activeTitle ?? '自由探索'}
          </div>
          <div className="mt-1.5 flex gap-3 text-[10px] text-white/60">
            <span>主线 {hud.mainDone}/{hud.mainTotal}</span>
            <span>支线 {hud.sideDone}/{hud.sideTotal}</span>
            {typeof hud.reputation === 'number' && <span>声望 {hud.reputation}</span>}
          </div>
        </div>
      )}

      {/* 画布 */}
      <div className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="h-full w-full touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {/* 交互提示 */}
        {nearNpc && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/15 bg-black/80 px-3 py-2 backdrop-blur">
              <div>
                <div className="text-[12px] font-semibold text-white/95">{nearNpc.name}</div>
                <div className="text-[10px] text-white/55">{nearNpc.hint}</div>
              </div>
              <button
                type="button"
                onClick={() => enterNpc(nearNpc)}
                className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-black"
              >
                交谈 (E)
              </button>
            </div>
          </div>
        )}
        {/* 摇杆提示 */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white/30">
          拖动屏幕任意位置 = 走动
        </div>
      </div>
    </div>
  );
}
