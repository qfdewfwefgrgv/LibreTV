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
};

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
  ],
  npcs: [
    { id: 'n1', name: '顾长风', x: 1000, y: 900, node: 'a01', kind: 'main', hint: '主线 · 顾长风在等你' },
    { id: 'n2', name: '苏挽', x: 520, y: 760, node: 'a05', kind: 'main', hint: '主线 · 白衣女子受了伤' },
    { id: 'n3', name: '独眼掌柜', x: 380, y: 380, node: 'a06', kind: 'side', hint: '支线 · 悦来客栈有消息' },
    { id: 'n4', name: '灯市老翁', x: 470, y: 1050, node: 'a04', kind: 'side', hint: '支线 · 灯市听棋' },
    { id: 'n5', name: '青城弟子', x: 1200, y: 400, node: 'a02', kind: 'side', hint: '支线 · 渡口风波' },
  ],
};

const CITIES: Record<string, City> = { luoyang: LUOYANG };

const ROOF: Record<Building['kind'], string> = {
  house: '#3a3f4a',
  temple: '#7a3a2a',
  shop: '#4a4230',
  inn: '#5a3a24',
  gate: '#2f3a44',
};

export function WorldScene({
  onEnterNode,
  onClose,
  school,
}: {
  onEnterNode: (nodeId: string) => void;
  onClose: () => void;
  school: 'quan' | 'jian' | 'dao';
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const joyRef = useRef<{ active: boolean; dx: number; dy: number; id: number }>({ active: false, dx: 0, dy: 0, id: -1 });
  const playerRef = useRef({ x: 1000, y: 1000, vx: 0, vy: 0, face: 1 });
  const cameraRef = useRef({ x: 0, y: 0 });
  const nearRef = useRef<Npc | null>(null);
  const [nearNpc, setNearNpc] = useState<Npc | null>(null);
  const [cityKey, setCityKey] = useState('luoyang');
  const [entered, setEntered] = useState(false);
  const spritesRef = useRef<Record<string, HTMLImageElement | null>>({});
  const city = CITIES[cityKey] ?? LUOYANG;

  // 预载贴片与主角小人
  useEffect(() => {
    const files: Record<string, string> = {
      'hero-dao': '/game/world/hero-dao.webp',
      'hero-jian': '/game/world/hero-jian.webp',
      'hero-quan': '/game/world/hero-quan.webp',
      ground: '/game/world/tiles/tile-ground.webp',
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
      nearRef.current = best;
      setNearNpc((prev) => (prev?.id === best?.id ? prev : best));

      const vw = canvas.clientWidth;
      const vh = canvas.clientHeight;
      cameraRef.current.x = Math.max(0, Math.min(city.w - vw, p.x - vw / 2));
      cameraRef.current.y = Math.max(0, Math.min(city.h - vh, p.y - vh / 2));
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
      const sprite = buildingSprite(b);
      if (sprite) {
        // 按宽度铺满地块，底边对齐地块下沿，保持原图比例
        const scale = (w * 1.18) / sprite.width;
        const dw = sprite.width * scale;
        const dh = sprite.height * scale;
        ctx.drawImage(sprite, x + (w - dw) / 2, y + h - dh, dw, dh);
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
      // 标记
      ctx.fillStyle = n.kind === 'main' ? '#ffd166' : '#8ecae6';
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.kind === 'main' ? '!' : '?', n.x, n.y - 32 + bob);
      ctx.textAlign = 'left';
    };

    const drawPlayer = () => {
      const p = playerRef.current;
      const bob = Math.sin(performance.now() / 220) * 1.5;
      const sprite = spritesRef.current[school];
      if (sprite) {
        const W = 64;
        const H = 74;
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
      ctx.translate(-cam.x, -cam.y);

      // 地面：贴片平铺，缺图回落纯色
      const groundImg = spritesRef.current['ground'];
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

      // 主街：贴片平铺
      const roadImg = spritesRef.current['road'];
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
        ctx.fillStyle = '#16333d';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = 'rgba(140,200,220,0.10)';
        for (let i = 0; i < 30; i++) {
          const rx = ((i * 137) % w.w) + w.x;
          const ry = w.y + 10 + ((i * 53) % (w.h - 20));
          ctx.fillRect(rx, ry, 60, 2);
        }
      }

      city.buildings.forEach(drawBuilding);
      city.npcs.forEach(drawNpc);
      drawPlayer();

      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [city, school]);

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
          <span className="rounded bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">🗺️ {city.name}城</span>
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
