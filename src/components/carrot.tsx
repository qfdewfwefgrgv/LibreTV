'use client';

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

/**
 * 保卫萝卜（简化版）：固定折线路径 + 3 种可升级塔 + 10 波敌人（第 5 波小 BOSS、第 10 波大 BOSS）。
 * 纯 canvas 绘制，rAF 驱动；高频数据存在 ref 中，仅界面数字变化时才 setState。
 */

const SIZE = 640;
const GRID = 20;
const CELL = SIZE / GRID;
const TOTAL_WAVES = 10;
const START_GOLD = 160;
const START_LIVES = 20;
const MAX_LEVEL = 3;

/** 路径关键点（网格坐标，[-1 列表示屏幕外入口]） */
const PATH_CELLS: [number, number][] = [
  [-1, 4], [3, 4], [3, 11], [7, 11], [7, 3], [11, 3], [11, 14], [15, 14], [15, 6], [18, 6],
];

const PATH = PATH_CELLS.map(([c, r]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }));

const SEG_LEN: number[] = [];
for (let i = 0; i < PATH.length - 1; i++) {
  SEG_LEN.push(Math.hypot(PATH[i + 1].x - PATH[i].x, PATH[i + 1].y - PATH[i].y));
}
const PATH_LEN = SEG_LEN.reduce((a, b) => a + b, 0);

/** 按已走路程取路径上的坐标 */
function pointAt(dist: number) {
  let d = Math.max(0, Math.min(dist, PATH_LEN));
  for (let i = 0; i < SEG_LEN.length; i++) {
    if (d <= SEG_LEN[i]) {
      const p = PATH[i];
      const q = PATH[i + 1];
      const t = SEG_LEN[i] === 0 ? 0 : d / SEG_LEN[i];
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    }
    d -= SEG_LEN[i];
  }
  return PATH[PATH.length - 1];
}

/** 路径占用的格子（不可建塔） */
const PATH_KEYS = new Set<string>();
for (let i = 0; i < PATH_CELLS.length - 1; i++) {
  const [c1, r1] = PATH_CELLS[i];
  const [c2, r2] = PATH_CELLS[i + 1];
  const dc = Math.sign(c2 - c1);
  const dr = Math.sign(r2 - r1);
  let c = c1;
  let r = r1;
  PATH_KEYS.add(`${c},${r}`);
  while (c !== c2 || r !== r2) {
    c += dc;
    r += dr;
    PATH_KEYS.add(`${c},${r}`);
  }
}

type TowerKind = 'bottle' | 'sunflower' | 'fan';

interface TowerDef {
  kind: TowerKind;
  name: string;
  emoji: string;
  tip: string;
  cost: number;
  color: string;
  dmg: number;
  range: number;
  cd: number;
  splash: number;
  slow: number;
  knock: number;
}

const DEFS: Record<TowerKind, TowerDef> = {
  bottle: {
    kind: 'bottle', name: '瓶子塔', emoji: '🍾', tip: '单体高频',
    cost: 40, color: '#38BDF8', dmg: 8, range: 96, cd: 0.55, splash: 0, slow: 0, knock: 0,
  },
  sunflower: {
    kind: 'sunflower', name: '太阳花塔', emoji: '🌻', tip: '溅射 + 减速',
    cost: 60, color: '#F59E0B', dmg: 15, range: 108, cd: 1.25, splash: 52, slow: 0.45, knock: 0,
  },
  fan: {
    kind: 'fan', name: '风扇塔', emoji: '🌀', tip: '范围 + 击退',
    cost: 70, color: '#A78BFA', dmg: 11, range: 104, cd: 0.9, splash: 64, slow: 0, knock: 14,
  },
};

const TOWER_ORDER: TowerKind[] = ['bottle', 'sunflower', 'fan'];

interface Tower {
  id: number; kind: TowerKind; c: number; r: number; x: number; y: number;
  level: number; cd: number; spent: number;
}

interface Monster {
  id: number; dist: number; x: number; y: number;
  hp: number; maxHp: number; speed: number; boss: boolean; reward: number;
  slowT: number; slowPower: number; dead: boolean;
}

interface Projectile {
  id: number; x: number; y: number; targetId: number; dmg: number;
  splash: number; slow: number; knock: number; speed: number; color: string; done: boolean;
}

interface SpawnItem { at: number; hp: number; speed: number; boss: boolean; reward: number }

interface GameState {
  towers: Tower[];
  monsters: Monster[];
  projectiles: Projectile[];
  queue: SpawnItem[];
  clock: number;
  gold: number;
  lives: number;
  wave: number;
  status: 'ready' | 'wave' | 'paused' | 'over' | 'won';
  time: number;
  nextId: number;
}

function createState(): GameState {
  return {
    towers: [], monsters: [], projectiles: [], queue: [],
    clock: 0, gold: START_GOLD, lives: START_LIVES, wave: 0,
    status: 'ready', time: 0, nextId: 1,
  };
}

/** 第 n 波的生成计划（强度随波次递增，第 5 波小 BOSS、第 10 波大 BOSS） */
function wavePlan(n: number): SpawnItem[] {
  const hp = 42 + n * 16;
  const speed = 58 + n * 3;
  const count = 6 + n * 2;
  const gap = Math.max(0.45, 0.9 - n * 0.04);
  const items: SpawnItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      at: 0.4 + i * gap,
      hp: Math.round(hp * (1 + (i % 4) * 0.06)),
      speed: speed + (i % 3) * 3,
      boss: false,
      reward: 5 + Math.floor(n / 2),
    });
  }
  if (n === 5) {
    items.push({ at: 0.4 + count * gap + 1, hp: 280, speed: 40, boss: true, reward: 35 });
  }
  if (n === TOTAL_WAVES) {
    items.push({ at: 0.4 + count * gap + 1.5, hp: 1000, speed: 36, boss: true, reward: 120 });
  }
  return items;
}

/** 等级带来的数值成长 */
function statsOf(t: Tower) {
  const d = DEFS[t.kind];
  const lv = t.level - 1;
  return {
    dmg: Math.round(d.dmg * (1 + 0.5 * lv)),
    range: d.range + 16 * lv,
    cd: d.cd * (1 - 0.13 * lv),
    splash: d.splash ? d.splash + 10 * lv : 0,
  };
}

function upgradeCost(t: Tower) {
  return Math.round(DEFS[t.kind].cost * 0.8 * t.level);
}

function sellValue(t: Tower) {
  return Math.round(t.spent * 0.7);
}

function damageMonster(s: GameState, m: Monster, dmg: number) {
  if (m.dead) return;
  m.hp -= dmg;
  if (m.hp <= 0) {
    m.dead = true;
    s.gold += m.reward;
  }
}

/** 以 (x,y) 为圆心做范围伤害 / 减速 / 击退 */
function splashDamage(s: GameState, x: number, y: number, radius: number, dmg: number, slow: number, knock: number) {
  for (const m of s.monsters) {
    if (m.dead) continue;
    if (Math.hypot(m.x - x, m.y - y) > radius + 8) continue;
    damageMonster(s, m, dmg);
    if (slow > 0) {
      m.slowT = 1.2;
      m.slowPower = slow;
    }
    if (knock > 0 && !m.boss) m.dist = Math.max(0, m.dist - knock);
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface PanelInfo {
  id: number; kind: TowerKind; level: number;
  dmg: number; range: number; upgrade: number; sell: number;
}

function panelOf(t: Tower): PanelInfo {
  const st = statsOf(t);
  return {
    id: t.id, kind: t.kind, level: t.level,
    dmg: st.dmg, range: Math.round(st.range),
    upgrade: t.level < MAX_LEVEL ? upgradeCost(t) : 0,
    sell: sellValue(t),
  };
}

function drawCarrot(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, broken: boolean) {
  ctx.strokeStyle = 'rgba(251,146,60,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 24 + Math.sin(time * 2) * 2, 0, Math.PI * 2); ctx.stroke();
  // 叶子
  ctx.fillStyle = broken ? '#475569' : '#22C55E';
  ctx.beginPath();
  ctx.ellipse(x - 8, y - 18, 4.5, 10, -0.5, 0, Math.PI * 2);
  ctx.ellipse(x + 8, y - 18, 4.5, 10, 0.5, 0, Math.PI * 2);
  ctx.ellipse(x, y - 21, 4, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // 身体 + 眼睛
  ctx.fillStyle = broken ? '#64748B' : '#F97316';
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 8); ctx.quadraticCurveTo(x, y - 2, x + 12, y - 8);
  ctx.lineTo(x, y + 18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = broken ? '#334155' : '#C2410C'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.arc(x - 4, y + 1, 2, 0, Math.PI * 2); ctx.arc(x + 4, y + 1, 2, 0, Math.PI * 2); ctx.fill();
}

function drawTower(ctx: CanvasRenderingContext2D, t: Tower, time: number) {
  const def = DEFS[t.kind];
  roundedRect(ctx, t.x - 14, t.y - 14, 28, 28, 9);
  ctx.fillStyle = 'rgba(15,23,42,0.92)'; ctx.fill();
  ctx.strokeStyle = def.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;

  if (t.kind === 'bottle') {
    roundedRect(ctx, t.x - 8, t.y - 9, 16, 20, 6);
    ctx.fillStyle = def.color; ctx.fill();
    ctx.fillStyle = '#7DD3FC'; ctx.fillRect(t.x - 4, t.y - 15, 8, 7);
    ctx.fillStyle = '#E2E8F0'; ctx.fillRect(t.x - 5, t.y - 18, 10, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(t.x - 5, t.y - 4, 3, 10);
  } else if (t.kind === 'sunflower') {
    ctx.fillStyle = def.color;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.ellipse(t.x + Math.cos(a) * 10, t.y + Math.sin(a) * 10, 5.5, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7C2D12'; ctx.beginPath(); ctx.arc(t.x, t.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FDE68A'; ctx.beginPath(); ctx.arc(t.x, t.y, 3.2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(226,232,240,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(t.x, t.y, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = def.color;
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(time * 1.6 + (i * Math.PI * 2) / 3);
      ctx.beginPath(); ctx.ellipse(8, 0, 7, 3.2, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = '#EDE9FE'; ctx.beginPath(); ctx.arc(t.x, t.y, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  // 等级星
  ctx.fillStyle = '#FDE68A'; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('★'.repeat(t.level), t.x, t.y - 16);
}

function drawMonster(ctx: CanvasRenderingContext2D, m: Monster) {
  const r = m.boss ? 17 : 10;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(m.x, m.y + r + 3, r * 0.8, 3, 0, 0, Math.PI * 2); ctx.fill();

  const g = ctx.createRadialGradient(m.x - r / 3, m.y - r / 3, 1, m.x, m.y, r);
  if (m.boss) { g.addColorStop(0, '#C4B5FD'); g.addColorStop(1, '#6D28D9'); }
  else { g.addColorStop(0, '#FCA5A5'); g.addColorStop(1, '#DC2626'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = m.boss ? '#4C1D95' : '#7F1D1D'; ctx.lineWidth = 1.5; ctx.stroke();

  if (m.slowT > 0) {
    ctx.strokeStyle = 'rgba(96,165,250,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(m.x, m.y, r + 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(m.x - r * 0.3, m.y - r * 0.15, m.boss ? 3 : 2, 0, Math.PI * 2);
  ctx.arc(m.x + r * 0.3, m.y - r * 0.15, m.boss ? 3 : 2, 0, Math.PI * 2);
  ctx.fill();

  if (m.boss) {
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.moveTo(m.x - 9, m.y - r - 2); ctx.lineTo(m.x - 5, m.y - r - 9); ctx.lineTo(m.x - 1, m.y - r - 3);
    ctx.lineTo(m.x + 3, m.y - r - 10); ctx.lineTo(m.x + 7, m.y - r - 3); ctx.lineTo(m.x + 9, m.y - r - 8);
    ctx.lineTo(m.x + 9, m.y - r - 1); ctx.closePath(); ctx.fill();
  }
  // 血条
  const w = m.boss ? 34 : 20;
  const barY = m.y - r - 10;
  ctx.fillStyle = 'rgba(15,23,42,0.85)'; ctx.fillRect(m.x - w / 2, barY, w, 4);
  const ratio = Math.max(0, m.hp / m.maxHp);
  ctx.fillStyle = ratio > 0.5 ? '#22C55E' : ratio > 0.25 ? '#F59E0B' : '#EF4444';
  ctx.fillRect(m.x - w / 2 + 1, barY + 1, (w - 2) * ratio, 2);
}

export function CarrotGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createState());
  const pickRef = useRef<{ c: number; r: number } | null>(null);
  const towerSelRef = useRef<number | null>(null);
  const hudRef = useRef({ gold: START_GOLD, lives: START_LIVES, wave: 0, status: 'ready' as GameState['status'] });

  const [hud, setHud] = useState(hudRef.current);
  const [pick, setPick] = useState<{ c: number; r: number } | null>(null);
  const [panel, setPanel] = useState<PanelInfo | null>(null);

  const syncHud = () => {
    const s = stateRef.current;
    const prev = hudRef.current;
    if (prev.gold === s.gold && prev.lives === s.lives && prev.wave === s.wave && prev.status === s.status) return;
    const next = { gold: s.gold, lives: s.lives, wave: s.wave, status: s.status };
    hudRef.current = next;
    setHud(next);
  };

  const onCanvasClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    if (s.status === 'over' || s.status === 'won') return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (SIZE / rect.width);
    const y = (e.clientY - rect.top) * (SIZE / rect.height);
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (c < 0 || r < 0 || c >= GRID || r >= GRID) return;

    const tower = s.towers.find((t) => t.c === c && t.r === r);
    if (tower) {
      pickRef.current = null;
      setPick(null);
      towerSelRef.current = tower.id;
      setPanel(panelOf(tower));
      return;
    }
    towerSelRef.current = null;
    setPanel(null);
    if (PATH_KEYS.has(`${c},${r}`)) {
      pickRef.current = null;
      setPick(null);
      return;
    }
    const cur = pickRef.current;
    const same = cur && cur.c === c && cur.r === r;
    const next = same ? null : { c, r };
    pickRef.current = next;
    setPick(next);
  };

  const build = (kind: TowerKind) => {
    const s = stateRef.current;
    const p = pickRef.current;
    if (!p || s.status === 'over' || s.status === 'won') return;
    const def = DEFS[kind];
    if (s.gold < def.cost) return;
    if (PATH_KEYS.has(`${p.c},${p.r}`) || s.towers.some((t) => t.c === p.c && t.r === p.r)) return;
    s.gold -= def.cost;
    s.towers.push({
      id: s.nextId++, kind, c: p.c, r: p.r,
      x: p.c * CELL + CELL / 2, y: p.r * CELL + CELL / 2,
      level: 1, cd: 0, spent: def.cost,
    });
    pickRef.current = null;
    setPick(null);
    syncHud();
  };

  const upgrade = () => {
    const s = stateRef.current;
    if (!panel) return;
    const t = s.towers.find((x) => x.id === panel.id);
    if (!t || t.level >= MAX_LEVEL) return;
    const cost = upgradeCost(t);
    if (s.gold < cost) return;
    s.gold -= cost;
    t.level += 1;
    t.spent += cost;
    setPanel(panelOf(t));
    syncHud();
  };

  const sell = () => {
    const s = stateRef.current;
    if (!panel) return;
    const t = s.towers.find((x) => x.id === panel.id);
    if (!t) return;
    s.gold += sellValue(t);
    s.towers = s.towers.filter((x) => x.id !== t.id);
    towerSelRef.current = null;
    setPanel(null);
    syncHud();
  };

  const startWave = () => {
    const s = stateRef.current;
    if (s.status !== 'ready' || s.wave >= TOTAL_WAVES) return;
    s.wave += 1;
    s.queue = wavePlan(s.wave);
    s.clock = 0;
    s.status = 'wave';
    pickRef.current = null;
    setPick(null);
    syncHud();
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (s.status === 'wave') s.status = 'paused';
    else if (s.status === 'paused') s.status = 'wave';
    syncHud();
  };

  const restart = () => {
    stateRef.current = createState();
    pickRef.current = null;
    towerSelRef.current = null;
    setPick(null);
    setPanel(null);
    syncHud();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;

    const spawn = (s: GameState, item: SpawnItem) => {
      const pos = pointAt(0);
      s.monsters.push({
        id: s.nextId++, dist: 0, x: pos.x, y: pos.y,
        hp: item.hp, maxHp: item.hp, speed: item.speed, boss: item.boss,
        reward: item.reward, slowT: 0, slowPower: 0, dead: false,
      });
    };

    /** 每帧推进逻辑：只有 wave 状态才推进 */
    const step = (dt: number) => {
      const s = stateRef.current;
      s.time += dt;
      if (s.status !== 'wave') return;

      s.clock += dt;
      while (s.queue.length > 0 && s.queue[0].at <= s.clock) spawn(s, s.queue.shift()!);

      // 怪物前进 / 漏怪扣血
      for (const m of s.monsters) {
        if (m.dead) continue;
        if (m.slowT > 0) m.slowT -= dt;
        const slowMul = m.slowT > 0 ? 1 - m.slowPower : 1;
        m.dist += m.speed * slowMul * dt;
        if (m.dist >= PATH_LEN) {
          m.dist = PATH_LEN;
          m.dead = true;
          s.lives -= 1;
          continue;
        }
        const pos = pointAt(m.dist);
        m.x = pos.x;
        m.y = pos.y;
      }
      if (s.lives <= 0) {
        s.lives = 0;
        s.projectiles = [];
        s.status = 'over';
        return;
      }
      s.monsters = s.monsters.filter((m) => !m.dead);

      // 塔：射程内选择最靠近终点的怪物
      for (const t of s.towers) {
        const st = statsOf(t);
        t.cd -= dt;
        if (t.cd > 0) continue;
        let best: Monster | null = null;
        let bestD = Infinity;
        for (const m of s.monsters) {
          const d = Math.hypot(m.x - t.x, m.y - t.y);
          if (d > st.range || d >= bestD) continue;
          best = m;
          bestD = d;
        }
        if (!best) continue;
        t.cd = st.cd;
        const def = DEFS[t.kind];
        s.projectiles.push({
          id: s.nextId++, x: t.x, y: t.y, targetId: best.id, dmg: st.dmg,
          splash: st.splash, slow: def.slow, knock: def.knock,
          speed: t.kind === 'bottle' ? 420 : 260,
          color: def.color, done: false,
        });
      }

      // 投射物追踪目标
      for (const p of s.projectiles) {
        if (p.done) continue;
        const target = s.monsters.find((m) => m.id === p.targetId && !m.dead);
        if (!target) {
          p.done = true;
          continue;
        }
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          p.done = true;
          if (p.splash > 0) splashDamage(s, target.x, target.y, p.splash, p.dmg, p.slow, p.knock);
          else damageMonster(s, target, p.dmg);
          continue;
        }
        const move = Math.min(p.speed * dt, d);
        p.x += (dx / d) * move;
        p.y += (dy / d) * move;
      }
      s.projectiles = s.projectiles.filter((p) => !p.done);
      s.monsters = s.monsters.filter((m) => !m.dead);

      // 一波清空
      if (s.queue.length === 0 && s.monsters.length === 0) {
        s.gold += 15 + s.wave * 8;
        s.status = s.wave >= TOTAL_WAVES ? 'won' : 'ready';
      }
    };

    const paint = () => {
      const s = stateRef.current;
      const pickCell = pickRef.current;
      const selId = towerSelRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // 网格
      ctx.strokeStyle = 'rgba(148,163,184,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < GRID; i++) {
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, SIZE);
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(SIZE, i * CELL);
      }
      ctx.stroke();

      // 路径
      const walk = () => {
        ctx.beginPath();
        ctx.moveTo(PATH[0].x, PATH[0].y);
        for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
      };
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = CELL * 0.94;
      walk();
      ctx.stroke();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = CELL * 0.62;
      walk();
      ctx.stroke();
      ctx.setLineDash([7, 9]);
      ctx.strokeStyle = 'rgba(250,204,21,0.28)';
      ctx.lineWidth = 2;
      walk();
      ctx.stroke();
      ctx.setLineDash([]);

      // 入口箭头
      ctx.fillStyle = 'rgba(148,163,184,0.6)';
      ctx.beginPath();
      ctx.moveTo(2, PATH[0].y);
      ctx.lineTo(16, PATH[0].y - 8);
      ctx.lineTo(16, PATH[0].y + 8);
      ctx.closePath();
      ctx.fill();

      // 终点萝卜
      const end = PATH[PATH.length - 1];
      drawCarrot(ctx, end.x, end.y, s.time, s.status === 'over');

      // 待建格子高亮
      if (pickCell) {
        const px = pickCell.c * CELL;
        const py = pickCell.r * CELL;
        ctx.fillStyle = 'rgba(34,197,94,0.18)';
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.strokeStyle = 'rgba(34,197,94,0.75)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
      }

      // 塔 + 选中射程
      for (const t of s.towers) {
        if (t.id === selId) {
          const st = statsOf(t);
          ctx.beginPath();
          ctx.arc(t.x, t.y, st.range, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56,189,248,0.08)';
          ctx.fill();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = 'rgba(56,189,248,0.55)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        drawTower(ctx, t, s.time);
      }

      // 怪物
      for (const m of s.monsters) drawMonster(ctx, m);

      // 投射物
      for (const p of s.projectiles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 状态文字 / 遮罩
      ctx.textAlign = 'center';
      if (s.status === 'ready') {
        ctx.fillStyle = 'rgba(15,23,42,0.72)';
        ctx.fillRect(0, SIZE - 56, SIZE, 56);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '600 14px sans-serif';
        ctx.fillText(
          s.wave === 0 ? '点击空地建塔，准备好后开始第 1 波' : `第 ${s.wave} 波已清空 · 加固防线后继续`,
          SIZE / 2,
          SIZE - 22,
        );
      } else if (s.status === 'paused') {
        ctx.fillStyle = 'rgba(2,6,23,0.7)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#FDE68A';
        ctx.font = '700 24px sans-serif';
        ctx.fillText('⏸ 已暂停', SIZE / 2, SIZE / 2);
      } else if (s.status === 'over') {
        ctx.fillStyle = 'rgba(2,6,23,0.74)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#F87171';
        ctx.font = '700 26px sans-serif';
        ctx.fillText('🥕 萝卜被偷走了…', SIZE / 2, SIZE / 2 - 10);
        ctx.fillStyle = '#CBD5E1';
        ctx.font = '400 14px sans-serif';
        ctx.fillText(`坚持到第 ${s.wave} 波 · 点击「重开」再来一局`, SIZE / 2, SIZE / 2 + 22);
      } else if (s.status === 'won') {
        ctx.fillStyle = 'rgba(2,6,23,0.74)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#FDE68A';
        ctx.font = '700 26px sans-serif';
        ctx.fillText('🎉 守住全部 10 波！', SIZE / 2, SIZE / 2 - 10);
        ctx.fillStyle = '#CBD5E1';
        ctx.font = '400 14px sans-serif';
        ctx.fillText(`剩余生命 ${s.lives} · 金币 ${s.gold}`, SIZE / 2, SIZE / 2 + 22);
      }
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt);
      paint();
      syncHud();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const statusText =
    hud.status === 'ready' ? '准备中'
      : hud.status === 'wave' ? `第 ${hud.wave} 波进行中`
        : hud.status === 'paused' ? '已暂停'
          : hud.status === 'won' ? '守卫成功' : '失败';

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[640px] mx-auto">
      <div className="flex items-center gap-3 w-full bg-surface-raised border border-line rounded-lg px-3 py-2 text-xs">
        <span className="text-warning font-semibold">🪙 {hud.gold}</span>
        <span className="text-danger font-semibold">❤️ {hud.lives}</span>
        <span className="text-content font-semibold">🌊 {hud.wave}/{TOTAL_WAVES}</span>
        <span className="ml-auto text-faint">{statusText}</span>
      </div>

      <canvas
        ref={canvasRef}
        onClick={onCanvasClick}
        className="block w-full max-w-[640px] aspect-square rounded-xl border border-line bg-[#0f172a] cursor-pointer touch-none"
      />

      {panel ? (
        <div className="w-full bg-surface-raised border border-line rounded-lg px-3 py-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-semibold" style={{ color: DEFS[panel.kind].color }}>
            {DEFS[panel.kind].emoji} {DEFS[panel.kind].name} Lv.{panel.level}
          </span>
          <span className="text-faint">伤害 {panel.dmg} · 射程 {panel.range}</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={upgrade}
              disabled={panel.upgrade === 0 || hud.gold < panel.upgrade}
              className="px-2.5 py-1 rounded-md bg-accent text-on-accent font-semibold disabled:opacity-40"
            >
              {panel.upgrade === 0 ? '已满级' : `升级 🪙${panel.upgrade}`}
            </button>
            <button
              onClick={sell}
              className="px-2.5 py-1 rounded-md border border-line text-muted hover:text-content"
            >
              出售 🪙{panel.sell}
            </button>
          </div>
        </div>
      ) : pick ? (
        <div className="w-full bg-surface-raised border border-line rounded-lg px-2 py-2 flex items-center gap-2 text-xs">
          {TOWER_ORDER.map((k) => {
            const d = DEFS[k];
            const afford = hud.gold >= d.cost;
            return (
              <button
                key={k}
                onClick={() => build(k)}
                disabled={!afford}
                className="flex-1 px-2 py-1.5 rounded-md border border-line bg-card text-left hover:border-accent/50 disabled:opacity-40"
              >
                <span className="block font-semibold text-content">{d.emoji} {d.name}</span>
                <span className="block text-[10px] text-faint">{d.tip} · 🪙{d.cost}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="w-full text-[11px] text-faint text-center">点击空地选择塔 · 点击已有塔升级或出售</div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 w-full">
        <button
          onClick={startWave}
          disabled={hud.status !== 'ready' || hud.wave >= TOTAL_WAVES}
          className="px-3 py-1.5 rounded-lg bg-accent text-on-accent text-xs font-semibold disabled:opacity-40"
        >
          {hud.wave === 0 ? '开始第 1 波' : '开始下一波'}
        </button>
        <button
          onClick={togglePause}
          disabled={hud.status !== 'wave' && hud.status !== 'paused'}
          className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-content hover:border-accent/50 disabled:opacity-40"
        >
          {hud.status === 'paused' ? '继续' : '暂停'}
        </button>
        <button
          onClick={restart}
          className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-content hover:border-accent/50"
        >
          重开
        </button>
      </div>

      <p className="text-[11px] text-faint text-center leading-relaxed">
        怪物走到萝卜扣 1 点生命（共 20 点）· 10 波通关（第 5、10 波有 BOSS）· 击杀得金币，升级提升伤害与射程
      </p>
    </div>
  );
}


