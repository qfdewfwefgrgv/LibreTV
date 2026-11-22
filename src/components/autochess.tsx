'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Libre 自走棋（简化版）
 * 6×6 棋盘：上半场（0~2 行）是敌方区域，下半场（3~5 行）是我方部署区。
 * 准备阶段买棋子、凑羁绊；战斗阶段按 0.3s/tick 自动推进，直到一方全灭。
 * 所有棋子定义、商店、经济、升星、战斗结算都在一起，无第三方依赖。
 */

const ROWS = 6;
const COLS = 6;
const BOARD_SIZE = ROWS * COLS;
const DEPLOY_START = 3 * COLS;
const BENCH_SIZE = 9;
const TICK_MS = 300;
const TICK_SECONDS = TICK_MS / 1000;
const MAX_TICKS = 160;
const START_GOLD = 10;
const START_HP = 40;
const MAX_HP = 40;

type Trait = '战士' | '法师' | '刺客' | '射手' | '坦克' | '术士';
const TRAITS: Trait[] = ['战士', '法师', '刺客', '射手', '坦克', '术士'];

type Star = 1 | 2 | 3;
type Team = 'player' | 'enemy';
type Phase = 'prep' | 'battle' | 'result' | 'over';
type Outcome = 'win' | 'lose' | null;

interface UnitDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  hp: number;
  atk: number;
  aspd: number;
  range: number;
  trait: Trait;
}

interface Piece {
  uid: string;
  defId: string;
  star: Star;
}

interface ShopCard {
  uid: string;
  defId: string;
  sold: boolean;
}

interface BattleUnit {
  uid: string;
  name: string;
  emoji: string;
  team: Team;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  atk: number;
  aspd: number;
  range: number;
  trait: Trait;
  star: Star;
  crit: number;
  critMult: number;
  spell: number;
  armor: number;
  lifesteal: number;
  timer: number;
}

interface TickResult {
  units: BattleUnit[];
  events: string[];
  winner: Team | null;
}

/** 10 种棋子：费用 1~5，基础生命/攻击/攻速/射程/羁绊 */
const PIECES: UnitDef[] = [
  { id: 'warrior', name: '剑士', emoji: '🗡️', cost: 1, hp: 60, atk: 10, aspd: 1.0, range: 1, trait: '战士' },
  { id: 'guard', name: '盾卫', emoji: '🛡️', cost: 1, hp: 85, atk: 6, aspd: 0.8, range: 1, trait: '坦克' },
  { id: 'archer', name: '弓手', emoji: '🏹', cost: 2, hp: 50, atk: 12, aspd: 1.1, range: 2, trait: '射手' },
  { id: 'mage', name: '法师', emoji: '🔮', cost: 2, hp: 45, atk: 14, aspd: 0.9, range: 2, trait: '法师' },
  { id: 'rogue', name: '刺客', emoji: '🥷', cost: 2, hp: 55, atk: 15, aspd: 1.2, range: 1, trait: '刺客' },
  { id: 'warlock', name: '术士', emoji: '🧙', cost: 3, hp: 60, atk: 13, aspd: 0.9, range: 2, trait: '术士' },
  { id: 'knight', name: '骑士', emoji: '⚔️', cost: 3, hp: 100, atk: 12, aspd: 1.0, range: 1, trait: '战士' },
  { id: 'ranger', name: '游侠', emoji: '🎯', cost: 3, hp: 60, atk: 17, aspd: 1.2, range: 3, trait: '射手' },
  { id: 'witch', name: '巫女', emoji: '🪄', cost: 4, hp: 70, atk: 22, aspd: 1.0, range: 2, trait: '法师' },
  { id: 'beast', name: '巨兽', emoji: '🐉', cost: 5, hp: 160, atk: 24, aspd: 0.9, range: 1, trait: '坦克' },
];

const SYNERGY: Record<Trait, { icon: string; tier2: string; tier4: string }> = {
  战士: { icon: '⚔️', tier2: '护甲 +6', tier4: '护甲 +12' },
  法师: { icon: '✨', tier2: '法伤 +25%', tier4: '法伤 +50%' },
  刺客: { icon: '🗡️', tier2: '暴击 +25%', tier4: '暴击 +45%' },
  射手: { icon: '🎯', tier2: '攻速 +25%', tier4: '攻速 +50%' },
  坦克: { icon: '🧱', tier2: '生命 +20%', tier4: '生命 +40%' },
  术士: { icon: '🩸', tier2: '吸血 15%', tier4: '吸血 30%' },
};

const STAR_MULT: Record<Star, number> = { 1: 1, 2: 1.6, 3: 2.5 };

const SHOP_POOL: string[] = [];
for (const p of PIECES) {
  // 低费棋子出现概率更高
  for (let i = 0; i < 6 - p.cost; i++) SHOP_POOL.push(p.id);
}

let uidSeq = 0;
function nextUid(prefix: string): string {
  uidSeq += 1;
  return `${prefix}-${uidSeq}`;
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function getDef(id: string): UnitDef {
  return PIECES.find((p) => p.id === id) ?? PIECES[0]!;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function emptyBoard(): (Piece | null)[] {
  return Array.from({ length: BOARD_SIZE }, () => null);
}

function rollShop(): ShopCard[] {
  return Array.from({ length: 5 }, () => ({
    uid: nextUid('shop'),
    defId: rand(SHOP_POOL),
    sold: false,
  }));
}

function popCap(round: number): number {
  return Math.min(8, 3 + Math.floor((round - 1) / 2));
}

function streakBonusFor(streak: number): number {
  return Math.min(3, Math.floor(Math.abs(streak) / 2));
}

function costColor(cost: number): string {
  if (cost >= 5) return 'text-danger';
  if (cost === 4) return 'text-warning';
  if (cost === 3) return 'text-accent';
  if (cost === 2) return 'text-success';
  return 'text-faint';
}

function emptyTraitCounts(): Record<Trait, number> {
  return { 战士: 0, 法师: 0, 刺客: 0, 射手: 0, 坦克: 0, 术士: 0 };
}

function countTraits(board: (Piece | null)[]): Record<Trait, number> {
  const counts = emptyTraitCounts();
  for (const p of board) {
    if (p) counts[getDef(p.defId).trait] += 1;
  }
  return counts;
}

/** 棋盘/备战席通用槽位坐标 */
interface SlotRef {
  zone: 'board' | 'bench';
  index: number;
}

/**
 * 3 个同名 1 星 → 2 星，3 个同名 2 星 → 3 星；循环判定，支持连锁合成。
 * 棋盘 + 备战席一起参与合成（备战席就是给等升星的棋子准备的仓库）；
 * 合成后优先把升星结果留在棋盘上。
 */
function mergeAll(
  boardIn: (Piece | null)[],
  benchIn: (Piece | null)[],
): { board: (Piece | null)[]; bench: (Piece | null)[]; merges: string[] } {
  const board = [...boardIn];
  const bench = [...benchIn];
  const merges: string[] = [];
  let merged = true;

  const read = (s: SlotRef): Piece | null => (s.zone === 'board' ? board[s.index] : bench[s.index]) ?? null;
  const write = (s: SlotRef, v: Piece | null) => {
    if (s.zone === 'board') board[s.index] = v;
    else bench[s.index] = v;
  };

  while (merged) {
    merged = false;
    for (const star of [1, 2] as const) {
      const groups = new Map<string, SlotRef[]>();
      const collect = (arr: (Piece | null)[], zone: SlotRef['zone']) => {
        arr.forEach((p, i) => {
          if (p && p.star === star) {
            const list = groups.get(p.defId) ?? [];
            list.push({ zone, index: i });
            groups.set(p.defId, list);
          }
        });
      };
      collect(board, 'board');
      collect(bench, 'bench');

      for (const [defId, slots] of Array.from(groups.entries())) {
        if (slots.length >= 3) {
          const [keep, r1, r2] = slots as [SlotRef, SlotRef, SlotRef, ...SlotRef[]];
          const kept = read(keep)!;
          write(keep, { uid: kept.uid, defId: kept.defId, star: (star + 1) as Star });
          write(r1, null);
          write(r2, null);
          merges.push(`${getDef(defId).name} 升到 ${star + 1} 星`);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  return { board, bench, merges };
}

function makeBattleUnit(
  def: UnitDef,
  star: Star,
  team: Team,
  row: number,
  col: number,
  scale = 1,
): BattleUnit {
  const mult = STAR_MULT[star] * scale;
  const maxHp = Math.round(def.hp * mult);
  return {
    uid: nextUid(team),
    name: def.name,
    emoji: def.emoji,
    team,
    row,
    col,
    hp: maxHp,
    maxHp,
    atk: Math.round(def.atk * mult),
    aspd: def.aspd,
    range: def.range,
    trait: def.trait,
    star,
    crit: 0.05,
    critMult: 1.5,
    spell: 0,
    armor: 0,
    lifesteal: 0,
    timer: 0,
  };
}

function applySynergies(units: BattleUnit[], team: Team): void {
  const counts = emptyTraitCounts();
  for (const u of units) {
    if (u.team === team) counts[u.trait] += 1;
  }

  for (const u of units) {
    if (u.team !== team) continue;
    const count = counts[u.trait];
    if (count < 2) continue;
    const tier = count >= 4 ? 2 : 1;

    switch (u.trait) {
      case '战士':
        u.armor += tier === 2 ? 12 : 6;
        break;
      case '法师':
        u.spell += tier === 2 ? 0.5 : 0.25;
        break;
      case '刺客':
        u.crit += tier === 2 ? 0.45 : 0.25;
        break;
      case '射手':
        u.aspd *= tier === 2 ? 1.5 : 1.25;
        break;
      case '坦克':
        u.maxHp = Math.round(u.maxHp * (tier === 2 ? 1.4 : 1.2));
        u.hp = u.maxHp;
        break;
      case '术士':
        u.lifesteal += tier === 2 ? 0.3 : 0.15;
        break;
    }
  }
}

function buildPlayerUnits(board: (Piece | null)[]): BattleUnit[] {
  const units: BattleUnit[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const piece = board[i];
    if (!piece) continue;
    units.push(
      makeBattleUnit(getDef(piece.defId), piece.star, 'player', Math.floor(i / COLS), i % COLS),
    );
  }
  applySynergies(units, 'player');
  return units;
}

function enemyCountFor(round: number): number {
  return Math.min(7, 2 + Math.floor((round - 1) / 2));
}

function createEnemyUnits(round: number): BattleUnit[] {
  const count = enemyCountFor(round);
  const maxCost = Math.min(5, 1 + Math.floor(round / 2));
  const pool = PIECES.filter((p) => p.cost <= maxCost);
  const coords = shuffle(Array.from({ length: 2 * COLS }, (_, i) => i));
  const scale = 1 + (round - 1) * 0.08;
  const units: BattleUnit[] = [];

  for (let i = 0; i < count; i++) {
    const cell = coords[i]!;
    const def = rand(pool);
    units.push(makeBattleUnit(def, 1, 'enemy', Math.floor(cell / COLS), cell % COLS, scale));
  }
  applySynergies(units, 'enemy');
  return units;
}

function distance(a: BattleUnit, b: BattleUnit): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

function nearestEnemy(unit: BattleUnit, units: BattleUnit[]): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestDist = Infinity;
  for (const other of units) {
    if (other.team === unit.team || other.hp <= 0) continue;
    const d = distance(unit, other);
    if (d < bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

function nearestTargetInRange(unit: BattleUnit, units: BattleUnit[]): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestDist = Infinity;
  for (const other of units) {
    if (other.team === unit.team || other.hp <= 0) continue;
    const d = distance(unit, other);
    if (d <= unit.range && d < bestDist) {
      best = other;
      bestDist = d;
    }
  }
  return best;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function cellOccupied(units: BattleUnit[], row: number, col: number, ignoreUid: string): boolean {
  return units.some(
    (u) => u.uid !== ignoreUid && u.hp > 0 && u.row === row && u.col === col,
  );
}

function stepToward(
  unit: BattleUnit,
  target: BattleUnit,
  units: BattleUnit[],
): { row: number; col: number } | null {
  const dr = Math.sign(target.row - unit.row);
  const dc = Math.sign(target.col - unit.col);
  const candidates: [number, number][] = [];

  if (dr !== 0) candidates.push([unit.row + dr, unit.col]);
  if (dc !== 0) candidates.push([unit.row, unit.col + dc]);
  if (dr !== 0 && dc !== 0) {
    candidates.push([unit.row + dr, unit.col + dc]);
    candidates.push([unit.row + dr, unit.col - dc]);
  }
  // 被友军挡住时左右绕路
  candidates.push([unit.row, unit.col + 1], [unit.row, unit.col - 1]);
  candidates.push([unit.row + 1, unit.col], [unit.row - 1, unit.col]);

  const seen = new Set<string>();
  for (const [row, col] of candidates) {
    const key = `${row},${col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!inBounds(row, col)) continue;
    if (cellOccupied(units, row, col, unit.uid)) continue;
    return { row, col };
  }
  return null;
}

function unitLabel(u: BattleUnit): string {
  return `${u.team === 'enemy' ? '敌·' : ''}${u.name}${u.star > 1 ? ` ${'★'.repeat(u.star)}` : ''}`;
}

function aliveCount(units: BattleUnit[], team: Team): number {
  return units.filter((u) => u.team === team && u.hp > 0).length;
}

function simulateTick(input: BattleUnit[]): TickResult {
  const units = input.map((u) => ({ ...u }));
  const events: string[] = [];

  for (const u of units) {
    if (u.hp > 0) u.timer += u.aspd * TICK_SECONDS;
  }

  for (const u of units) {
    if (u.hp <= 0) continue;
    const nearest = nearestEnemy(u, units);
    if (!nearest) continue;

    const target = nearestTargetInRange(u, units);
    if (target) {
      if (u.timer < 1) continue;
      u.timer -= 1;

      let damage = u.atk;
      if (u.trait === '法师' || u.trait === '术士') damage *= 1 + u.spell;
      const crit = Math.random() < u.crit;
      if (crit) damage *= u.critMult;
      damage = Math.max(1, Math.round(damage - target.armor));

      target.hp -= damage;
      events.push(
        `${crit ? '💥' : '⚔️'} ${unitLabel(u)} → ${unitLabel(target)} -${damage}（剩 ${Math.max(0, target.hp)}）`,
      );

      if (u.lifesteal > 0) {
        const heal = Math.max(1, Math.round(damage * u.lifesteal));
        u.hp = Math.min(u.maxHp, u.hp + heal);
        events.push(`🩸 ${unitLabel(u)} 吸血 +${heal}`);
      }

      if (target.hp <= 0) events.push(`💀 ${unitLabel(target)} 倒下`);
    } else {
      const step = stepToward(u, nearest, units);
      if (step) {
        u.row = step.row;
        u.col = step.col;
      }
    }
  }

  const playerAlive = aliveCount(units, 'player');
  const enemyAlive = aliveCount(units, 'enemy');
  let winner: Team | null = null;
  if (enemyAlive === 0) winner = 'player';
  else if (playerAlive === 0) winner = 'enemy';

  return { units, events, winner };
}

function logTone(line: string): string {
  if (line.startsWith('✅') || line.startsWith('🩸')) return 'text-success';
  if (line.startsWith('❌') || line.startsWith('💀') || line.startsWith('💔')) return 'text-danger';
  if (line.startsWith('💥') || line.startsWith('✨')) return 'text-warning';
  if (line.startsWith('⚔️')) return 'text-content';
  return 'text-muted';
}

export function AutoChessGame() {
  const [board, setBoard] = useState<(Piece | null)[]>(() => emptyBoard());
  const [bench, setBench] = useState<(Piece | null)[]>(() =>
    Array.from({ length: BENCH_SIZE }, () => null),
  );
  const [shop, setShop] = useState<ShopCard[]>(() => rollShop());
  const [gold, setGold] = useState(START_GOLD);
  const [hp, setHp] = useState(START_HP);
  const [round, setRound] = useState(1);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>('prep');
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [battleUnits, setBattleUnits] = useState<BattleUnit[]>([]);
  const [battleOutcome, setBattleOutcome] = useState<Outcome>(null);
  const [gameResult, setGameResult] = useState<Outcome>(null);
  const [totalWins, setTotalWins] = useState(0);
  const [log, setLog] = useState<string[]>([
    '🎮 欢迎来到 Libre 自走棋：先买棋子布阵，凑齐羁绊后开始战斗。',
  ]);
  const [notice, setNotice] = useState('');

  const battleRef = useRef<BattleUnit[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickCountRef = useRef(0);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const cap = popCap(round);
  const pieceCount = board.filter((p) => p !== null).length;
  const benchCount = bench.filter((p) => p !== null).length;
  const selectedPiece = selected
    ? selected.zone === 'board'
      ? board[selected.index]
      : bench[selected.index]
    : null;
  const selectedDef = selectedPiece ? getDef(selectedPiece.defId) : null;

  const synergyList = useMemo(() => {
    const counts = countTraits(board);
    return TRAITS.map((trait) => {
      const count = counts[trait];
      const tier = count >= 4 ? 2 : count >= 2 ? 1 : 0;
      return { trait, count, tier };
    }).filter((item) => item.count > 0);
  }, [board]);

  const battleMap = useMemo(() => {
    const map = new Map<string, BattleUnit>();
    for (const u of battleUnits) {
      if (u.hp > 0) map.set(`${u.row}-${u.col}`, u);
    }
    return map;
  }, [battleUnits]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setNotice('');
      noticeTimerRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    const box = logBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [log]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const buyShop = (index: number) => {
    if (phase !== 'prep') return;
    const card = shop[index];
    if (!card || card.sold) return;

    const def = getDef(card.defId);
    if (gold < def.cost) {
      showNotice(`金币不足：${def.name} 需要 ${def.cost} 金币`);
      return;
    }

    // 买来的棋子先进备战席（不占人口），再从备战席上阵；备战席也参与 3 合 1 升星
    const emptyBench = bench.findIndex((p) => !p);
    if (emptyBench === -1) {
      showNotice('备战席已满：先上阵、出售或合成一些棋子');
      return;
    }

    const nextBench = [...bench];
    nextBench[emptyBench] = { uid: nextUid('piece'), defId: def.id, star: 1 };
    const merged = mergeAll(board, nextBench);

    setGold((g) => g - def.cost);
    setShop((prev) => prev.map((c, i) => (i === index ? { ...c, sold: true } : c)));
    setBoard(merged.board);
    setBench(merged.bench);
    setSelected(null);

    if (merged.merges.length > 0) {
      const text = `✨ ${merged.merges.join('，')}`;
      setLog((prev) => [...prev, text].slice(-120));
      showNotice(text);
    } else {
      showNotice(`已购入 ${def.name}`);
    }
  };

  const refreshShop = () => {
    if (phase !== 'prep') return;
    if (gold < 2) {
      showNotice('金币不足，刷新需要 2 金币');
      return;
    }
    setGold((g) => g - 2);
    setShop(rollShop());
    setSelected(null);
    showNotice('商店已刷新');
  };

  const sellSelected = () => {
    if (phase !== 'prep' || !selected) return;
    const piece = selected.zone === 'board' ? board[selected.index] : bench[selected.index];
    if (!piece) return;
    const def = getDef(piece.defId);

    if (selected.zone === 'board') {
      setBoard((prev) => prev.map((p, i) => (i === selected.index ? null : p)));
    } else {
      setBench((prev) => prev.map((p, i) => (i === selected.index ? null : p)));
    }
    setGold((g) => g + def.cost);
    setSelected(null);
    showNotice(`出售 ${def.name}，返还 ${def.cost} 金币`);
  };

  /** 把已选中的棋子移动 / 交换到目标槽位（棋盘↔备战席均可），落位后检查升星 */
  const moveSelected = (target: SlotRef) => {
    if (!selected) return;
    const from = selected;
    const srcPiece = from.zone === 'board' ? board[from.index] : bench[from.index];
    const dstPiece = target.zone === 'board' ? board[target.index] : bench[target.index];
    if (!srcPiece) {
      setSelected(null);
      return;
    }
    if (target.zone === 'board' && target.index < DEPLOY_START) {
      showNotice('只能部署在下半场（第 4~6 行）');
      return;
    }
    // 备战席 → 棋盘空格属于「上阵」，要校验人口；与棋子上棋子互换位置不占新人口
    if (from.zone === 'bench' && target.zone === 'board' && !dstPiece && pieceCount >= cap) {
      showNotice(`人口已满（${pieceCount}/${cap}）：先出售或换下一名棋子再上阵`);
      return;
    }

    const nextBoard = [...board];
    const nextBench = [...bench];
    const write = (s: SlotRef, v: Piece | null) => {
      if (s.zone === 'board') nextBoard[s.index] = v;
      else nextBench[s.index] = v;
    };
    write(target, srcPiece);
    write(from, dstPiece ?? null);

    const merged = mergeAll(nextBoard, nextBench);
    setBoard(merged.board);
    setBench(merged.bench);
    if (merged.merges.length > 0) {
      const text = `✨ ${merged.merges.join('，')}`;
      setLog((prev) => [...prev, text].slice(-120));
      showNotice(text);
    }
    setSelected(null);
  };

  const onCellClick = (index: number) => {
    if (phase !== 'prep') return;
    const piece = board[index];

    if (selected) {
      // 再点自己 = 取消选中；点其它格子 = 移动/交换
      if (selected.zone === 'board' && selected.index === index) {
        setSelected(null);
        return;
      }
      moveSelected({ zone: 'board', index });
      return;
    }

    if (piece) {
      setSelected({ zone: 'board', index });
    } else if (index < DEPLOY_START) {
      showNotice('只能部署在下半场（第 4~6 行）');
    }
  };

  const onBenchClick = (index: number) => {
    if (phase !== 'prep') return;
    const piece = bench[index];

    if (selected) {
      if (selected.zone === 'bench' && selected.index === index) {
        setSelected(null);
        return;
      }
      moveSelected({ zone: 'bench', index });
      return;
    }

    if (piece) setSelected({ zone: 'bench', index });
  };

  const finishBattle = (units: BattleUnit[], winner: Team) => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setBattleUnits(units);

    const enemiesLeft = aliveCount(units, 'enemy');
    const playersLeft = aliveCount(units, 'player');

    if (winner === 'player') {
      const newStreak = streak > 0 ? streak + 1 : 1;
      const newWins = totalWins + 1;
      const cleared = newStreak >= 10 || newWins >= 8;

      setStreak(newStreak);
      setTotalWins(newWins);
      setBattleOutcome('win');
      setLog((prev) =>
        [
          ...prev,
          `✅ 第 ${round} 回合胜利！我方存活 ${playersLeft} 人${cleared ? ' · 已达成通关条件！' : ''}`,
        ].slice(-120),
      );

      if (cleared) {
        setGameResult('win');
        setPhase('over');
      } else {
        setPhase('result');
      }
      return;
    }

    const damage = enemiesLeft * 2 + round;
    const newHp = Math.max(0, hp - damage);
    const newStreak = streak < 0 ? streak - 1 : -1;

    setHp(newHp);
    setStreak(newStreak);
    setBattleOutcome('lose');
    setLog((prev) =>
      [
        ...prev,
        `❌ 战斗失败 · 敌方剩余 ${enemiesLeft} 个单位，扣除 ${damage} 点生命`,
        `💔 剩余生命 ${newHp}/${MAX_HP}`,
      ].slice(-120),
    );

    if (newHp <= 0) {
      setGameResult('lose');
      setPhase('over');
    } else {
      setPhase('result');
    }
  };

  const startBattle = () => {
    if (phase !== 'prep') return;
    if (pieceCount === 0) {
      showNotice('先在下方部署区放置棋子');
      return;
    }

    if (tickRef.current) clearInterval(tickRef.current);
    tickCountRef.current = 0;

    const players = buildPlayerUnits(board);
    const enemies = createEnemyUnits(round);
    const all = [...players, ...enemies];
    const activeText =
      synergyList
        .filter((s) => s.tier > 0)
        .map((s) => `${SYNERGY[s.trait].icon}${s.trait}(${s.count})`)
        .join(' · ') || '暂无激活羁绊';

    battleRef.current = all;
    setBattleUnits(all);
    setSelected(null);
    setBattleOutcome(null);
    setPhase('battle');
    setLog([
      `⚔️ 第 ${round} 回合 · 战斗开始`,
      `我方 ${players.length} 人 vs 敌方 ${enemies.length} 人 · 羁绊：${activeText}`,
    ]);

    tickRef.current = setInterval(() => {
      tickCountRef.current += 1;
      const result = simulateTick(battleRef.current);
      battleRef.current = result.units;
      setBattleUnits(result.units);

      if (result.events.length > 0) {
        setLog((prev) => [...prev, ...result.events].slice(-120));
      }

      const finish = result.winner || tickCountRef.current >= MAX_TICKS;
      if (finish) {
        let winner: Team = result.winner ?? 'player';
        if (!result.winner) {
          const playerHp = result.units
            .filter((u) => u.team === 'player')
            .reduce((sum, u) => sum + Math.max(0, u.hp), 0);
          const enemyHp = result.units
            .filter((u) => u.team === 'enemy')
            .reduce((sum, u) => sum + Math.max(0, u.hp), 0);
          winner = playerHp >= enemyHp ? 'player' : 'enemy';
          setLog((prev) => [...prev, '⏱ 战斗超时，按剩余生命总量判定'].slice(-120));
        }
        finishBattle(result.units, winner);
      }
    }, TICK_MS);
  };

  const advanceRound = useCallback(() => {
    const interest = Math.min(5, Math.floor(gold / 10));
    const bonus = streakBonusFor(streak);
    const income = 5 + interest + bonus;

    setGold((g) => g + income);
    setRound((r) => r + 1);
    setShop(rollShop());
    setBattleUnits([]);
    setSelected(null);
    setBattleOutcome(null);
    setPhase('prep');
    setLog((prev) =>
      [
        ...prev,
        `🛒 第 ${round + 1} 回合 · 收入 +${income}（基础 5 / 利息 ${interest} / 战绩 ${bonus}）`,
        '🎲 商店已刷新，继续布阵吧。',
      ].slice(-120),
    );
  }, [gold, streak, round]);

  useEffect(() => {
    if (phase !== 'result') return;
    const timer = setTimeout(() => advanceRound(), 1500);
    return () => clearTimeout(timer);
  }, [phase, advanceRound]);

  const resetGame = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    battleRef.current = [];
    tickCountRef.current = 0;

    setBoard(emptyBoard());
    setBench(Array.from({ length: BENCH_SIZE }, () => null));
    setShop(rollShop());
    setGold(START_GOLD);
    setHp(START_HP);
    setRound(1);
    setStreak(0);
    setSelected(null);
    setBattleUnits([]);
    setBattleOutcome(null);
    setGameResult(null);
    setTotalWins(0);
    setPhase('prep');
    setLog(['🕹 新的一局开始：初始金币 10，先买棋子再去战斗。']);
    showNotice('');
  };

  return (
    <div className="relative w-full">
      {notice && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-on-accent shadow-lg">
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* 棋盘 */}
        <div className="min-w-0 flex-1">
          <div className="card relative mx-auto w-full max-w-[560px] p-2.5 sm:p-3">
            <div
              className="grid gap-1 rounded-lg border border-line bg-gradient-to-b from-danger/5 to-accent/5 p-1.5 sm:gap-1.5"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: ROWS }, (_, r) =>
                Array.from({ length: COLS }, (_, c) => {
                  const index = r * COLS + c;
                  const piece = board[index];
                  const battleUnit = battleMap.get(`${r}-${c}`);
                  const isSelected = selected?.zone === 'board' && selected.index === index;
                  const deployable = r >= 3;

                  const baseTone = battleUnit
                    ? battleUnit.team === 'player'
                      ? 'border-accent/50 bg-accent/10'
                      : 'border-danger/50 bg-danger/10'
                    : deployable
                      ? 'border-dashed border-line bg-accent/5 hover:bg-accent/10'
                      : r < 2
                        ? 'border-line bg-danger/5'
                        : 'border-line bg-chip/40';

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => onCellClick(index)}
                      title={
                        battleUnit
                          ? `${battleUnit.name} ${battleUnit.hp}/${battleUnit.maxHp}`
                          : piece
                            ? `${getDef(piece.defId).name} ${'★'.repeat(piece.star)}`
                            : undefined
                      }
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border transition-colors ${baseTone} ${
                        isSelected ? 'ring-2 ring-warning' : ''
                      }`}
                    >
                      {battleUnit ? (
                        <>
                          <span className="text-base leading-none sm:text-xl">{battleUnit.emoji}</span>
                          {battleUnit.star > 1 && (
                            <span className="absolute left-1 top-0.5 text-[9px] leading-none text-warning">
                              {'★'.repeat(battleUnit.star)}
                            </span>
                          )}
                          <div className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-line">
                            <div
                              className={`h-full rounded-full ${
                                battleUnit.team === 'player' ? 'bg-success' : 'bg-danger'
                              }`}
                              style={{
                                width: `${Math.max(0, battleUnit.hp) / battleUnit.maxHp * 100}%`,
                              }}
                            />
                          </div>
                        </>
                      ) : piece ? (
                        <>
                          <span className="text-base leading-none sm:text-xl">
                            {getDef(piece.defId).emoji}
                          </span>
                          <span className="absolute left-1 top-0.5 text-[9px] leading-none text-warning">
                            {'★'.repeat(piece.star)}
                          </span>
                          <span className="mt-0.5 max-w-full truncate px-1 text-[8px] leading-none text-faint sm:text-[9px]">
                            {getDef(piece.defId).name}
                          </span>
                        </>
                      ) : r < 2 ? (
                        <span className="text-[10px] leading-none text-danger/50">敌</span>
                      ) : deployable ? (
                        <span className="text-[10px] leading-none text-faint">＋</span>
                      ) : null}
                    </button>
                  );
                }),
              )}
            </div>

            {phase === 'result' && battleOutcome && (
              <div
                className={`absolute inset-x-3 top-3 z-20 rounded-lg border px-3 py-2 text-xs font-semibold backdrop-blur-sm ${
                  battleOutcome === 'win'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-danger/40 bg-danger/10 text-danger'
                }`}
              >
                {battleOutcome === 'win' ? '✅ 胜利！敌方全灭' : '❌ 失败，生命值已扣减'}
                <span className="ml-2 font-normal text-faint">下一回合准备中…</span>
              </div>
            )}
          </div>

          {/* 备战席：买来的棋子先进这里（不占人口），等升星或换阵；点棋子再点棋盘格即上阵 */}
          <div className="mx-auto mt-2 w-full max-w-[560px]">
            <div className="mb-1 flex items-center justify-between px-0.5 text-[11px] text-faint">
              <span>🪑 备战席 · 等升星/备用的棋子放这里（也参与 3 合 1）</span>
              <span className={benchCount >= BENCH_SIZE ? 'text-danger' : ''}>
                {benchCount}/{BENCH_SIZE}
              </span>
            </div>
            <div className="grid grid-cols-9 gap-1 rounded-lg border border-line bg-card/60 p-1.5">
              {bench.map((p, i) => {
                const isSel = selected?.zone === 'bench' && selected.index === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onBenchClick(i)}
                    title={p ? `${getDef(p.defId).name} ${'★'.repeat(p.star)}` : '备战席空位'}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-md border transition-colors ${
                      p
                        ? 'border-line bg-surface-raised hover:border-accent/50'
                        : 'border-dashed border-line/60 hover:bg-accent/5'
                    } ${isSel ? 'ring-2 ring-warning' : ''}`}
                  >
                    {p && (
                      <>
                        <span className="text-sm leading-none sm:text-base">
                          {getDef(p.defId).emoji}
                        </span>
                        <span className="absolute left-0.5 top-0 text-[8px] leading-none text-warning">
                          {'★'.repeat(p.star)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedPiece && selectedDef && phase === 'prep' && (
            <div className="mx-auto mt-2 flex w-full max-w-[560px] items-center gap-2 rounded-md border border-line bg-surface-raised px-3 py-2 text-[11px]">
              <span className="font-semibold text-content">
                {selectedDef.emoji} {selectedDef.name} {'★'.repeat(selectedPiece.star)}
              </span>
              <span className="text-faint">
                ❤️ {Math.round(selectedDef.hp * STAR_MULT[selectedPiece.star])} · ⚔️{' '}
                {Math.round(selectedDef.atk * STAR_MULT[selectedPiece.star])} · 🎯 {selectedDef.range}
              </span>
              <button
                type="button"
                onClick={sellSelected}
                className="chip ml-auto bg-danger/15 text-danger hover:bg-danger/25"
              >
                出售 +{selectedDef.cost}🪙
              </button>
            </div>
          )}

          <p className="mx-auto mt-2 max-w-[560px] text-center text-[11px] leading-relaxed text-faint">
            {phase === 'prep'
              ? selected !== null
                ? '已选中棋子：点棋盘格上阵 / 换位置，点备战席格子收回仓库，或点「出售」。'
                : `买棋子先入备战席（不占人口）· 点备战席棋子再点棋盘格上阵 · 棋盘+备战席凑 3 张同名自动升星 · 本回合敌方约 ${enemyCountFor(round)} 人`
              : phase === 'battle'
                ? '⚔️ 自动战斗中：单位会靠近并攻击射程内最近的敌人…'
                : phase === 'result'
                  ? '回合结算中，马上进入下一回合…'
                  : '本局已结束，点击「再来一局」重新开始。'}
          </p>
        </div>

        {/* 右侧面板 */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[340px]">
          {/* 状态 + 操作 */}
          <div className="card p-3">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="chip bg-chip text-content">🪙 {gold}</span>
              <span className="chip bg-chip text-danger">
                ❤️ {hp}/{MAX_HP}
              </span>
              <span className="chip bg-chip text-muted">🏁 第 {round} 回合</span>
              <span className="chip bg-chip text-muted">
                👥 {pieceCount}/{cap}
              </span>
              <span
                className={`chip ${
                  streak > 0
                    ? 'bg-success/15 text-success'
                    : streak < 0
                      ? 'bg-danger/15 text-danger'
                      : 'bg-chip text-faint'
                }`}
              >
                {streak > 0
                  ? `🔥 连胜 ${streak}`
                  : streak < 0
                    ? `❄️ 连败 ${Math.abs(streak)}`
                    : '⚖️ 无连胜'}
              </span>
            </div>

            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={startBattle}
                disabled={phase !== 'prep'}
                className="btn-primary flex-1 text-xs"
              >
                {phase === 'battle'
                  ? '⚔️ 战斗中…'
                  : phase === 'result'
                    ? '⏳ 结算中…'
                    : '⚔️ 开始战斗'}
              </button>
              <button
                type="button"
                onClick={refreshShop}
                disabled={phase !== 'prep'}
                className="btn-ghost text-xs"
              >
                🔄 刷新 2🪙
              </button>
            </div>
          </div>

          {/* 商店 */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-content">🛒 商店</h3>
              <span className="text-[10px] text-faint">3 个同名自动升星</span>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {shop.map((card, index) => {
                const def = getDef(card.defId);
                return (
                  <button
                    key={card.uid}
                    type="button"
                    onClick={() => buyShop(index)}
                    disabled={phase !== 'prep' || card.sold}
                    className={`flex items-center gap-2 rounded-md border border-line bg-surface-raised px-2 py-1.5 text-left transition-colors disabled:opacity-40 ${
                      card.sold ? '' : 'hover:border-accent/50 hover:bg-hover'
                    }`}
                  >
                    <span className="text-lg leading-none">{def.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-content">{def.name}</span>
                        <span className="chip bg-chip !px-1.5 text-[9px] text-faint">{def.trait}</span>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-faint">
                        ❤️ {def.hp} · ⚔️ {def.atk} · 🎯 {def.range}
                      </span>
                    </span>
                    {card.sold ? (
                      <span className="chip bg-chip text-[10px] text-faint">已售</span>
                    ) : (
                      <span className={`chip bg-chip text-[10px] font-semibold ${costColor(def.cost)}`}>
                        {def.cost}🪙
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              购买自动放入部署区空位 · 出售返还原价 · 3 个 1 星合成 2 星（属性 ×1.6），3 个 2 星合成 3 星（×2.5）
            </p>
          </div>

          {/* 羁绊 */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-content">🔗 羁绊</h3>
              <span className="text-[10px] text-faint">同羁绊 2 / 4 个触发</span>
            </div>
            <div className="mt-2 space-y-1">
              {synergyList.length === 0 ? (
                <p className="rounded-md border border-line bg-surface-raised px-2 py-1.5 text-[10px] text-faint">
                  还没有上阵棋子，先去商店买几个吧。
                </p>
              ) : (
                synergyList.map(({ trait, count, tier }) => (
                  <div
                    key={trait}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] ${
                      tier > 0
                        ? 'border-accent/30 bg-accent/5'
                        : 'border-line bg-surface-raised'
                    }`}
                  >
                    <span>{SYNERGY[trait].icon}</span>
                    <span className={tier > 0 ? 'font-semibold text-accent' : 'text-muted'}>
                      {trait}
                    </span>
                    <span className="ml-auto text-[10px] text-faint">{count}/4</span>
                    <span className={tier > 0 ? 'text-success' : 'text-faint'}>
                      {tier === 2
                        ? SYNERGY[trait].tier4
                        : tier === 1
                          ? SYNERGY[trait].tier2
                          : `再 ${2 - count} 个激活`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 战斗日志 */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-content">📜 战斗日志</h3>
              <span className="text-[10px] text-faint">每 0.3 秒一个 tick</span>
            </div>
            <div
              ref={logBoxRef}
              className="scrollbar-thin mt-2 h-40 overflow-y-auto rounded-md border border-line bg-surface-raised px-2 py-1.5 text-[10px] leading-relaxed lg:h-48"
            >
              {log.map((line, index) => (
                <p key={`${index}-${line}`} className={logTone(line)}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {phase === 'over' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 rounded-xl bg-card/95 px-6 text-center backdrop-blur-sm">
          <div className="text-4xl">{gameResult === 'win' ? '🏆' : '💀'}</div>
          <div className="text-lg font-bold text-content">
            {gameResult === 'win' ? '通关！你是自走棋大师' : '游戏结束'}
          </div>
          <p className="text-xs text-muted">
            第 {round} 回合 · 累计胜利 {totalWins} 次 · 当前金币 {gold}
          </p>
          <button type="button" onClick={resetGame} className="btn-primary">
            再来一局
          </button>
        </div>
      )}
    </div>
  );
}
