/**
 * 天牢 · 江湖群雄（首版：第一层 + 第二层完整可玩）
 *
 * 设计要点：
 * - 每日刷新只刷新「挑战资格」，已获得碎片永久保留。
 * - 每个囚犯每天只能领一次奖励（按本地日键 + 时钟回拨检测）。
 * - 碎片数量按秘籍等级：普通 3 / 中级 5 / 高阶内功 8。
 */

export type Prisoner = {
  id: string;
  floor: 1 | 2;
  name: string;
  title: string;
  story: string;
  taunt: string;
  enemy: string;
  difficulty: number;
  minLevel: number;
  /** 击败后掉落的碎片 key 与数量 */
  shard: string;
  shardName: string;
  shardCount: number;
};

export const PRISONERS: Prisoner[] = [
  {
    id: 'p-l1-bandit',
    floor: 1,
    name: '独眼盗',
    title: '江洋大盗',
    story: '在洛阳城外劫了三年商队，落网时身上还揣着半块没吃完的饼。',
    taunt: '「小娃娃，爷爷劫道的时候，你还在娘胎里打转呢。」',
    enemy: '血手堂杀手',
    difficulty: 6,
    minLevel: 1,
    shard: 'shard-wuhu',
    shardName: '五虎断门刀残页',
    shardCount: 1,
  },
  {
    id: 'p-l1-blade',
    floor: 1,
    name: '断魂刀客',
    title: '江湖杀手',
    story: '接过的活都是三十两以下的散单，刀法狠，命却不值钱。',
    taunt: '「我的刀只问价钱，不问缘由。你挡在这儿，就是挡了三十两。」',
    enemy: '刀客',
    difficulty: 9,
    minLevel: 2,
    shard: 'shard-duanhun',
    shardName: '断魂刀法残页',
    shardCount: 1,
  },
  {
    id: 'p-l1-poison',
    floor: 1,
    name: '毒王',
    title: '用毒高手',
    story: '年轻时有名的药商，后来发现卖毒比卖药来钱快，一步步走成了这副样子。',
    taunt: '「别急着动手。你方才进门时，已经吸了三口我熬的东西。」',
    enemy: '血手堂杀手',
    difficulty: 11,
    minLevel: 3,
    shard: 'shard-dujing',
    shardName: '毒经残页',
    shardCount: 1,
  },
  {
    id: 'p-l2-xuanyin',
    floor: 2,
    name: '玄阴老人',
    title: '邪派高手',
    story: '四十年前玄阴教的护法，教主死了，他活着，被关了半辈子。',
    taunt: '「年轻人，你可知道我当年纵横江湖时，你还未出生。想从我这里拿走东西？先接我三招！」',
    enemy: '魔教护法',
    difficulty: 18,
    minLevel: 6,
    shard: 'shard-xuanyin',
    shardName: '玄阴内功残卷',
    shardCount: 1,
  },
  {
    id: 'p-l2-sword',
    floor: 2,
    name: '无名剑客',
    title: '失踪的剑道高手',
    story: '没人知道他的名字。他自己也忘了，只记得剑。',
    taunt: '「出剑吧。让我看看这些年江湖的剑，退步了多少。」',
    enemy: '青城弟子',
    difficulty: 22,
    minLevel: 8,
    shard: 'shard-wujian',
    shardName: '高阶剑法残页',
    shardCount: 1,
  },
  {
    id: 'p-l2-elder',
    floor: 2,
    name: '叛门长老',
    title: '某门派前长老',
    story: '带走了半卷心法，也带走了三十个弟子的命。',
    taunt: '「门规？我写的门规，比你见过的刀还多。你也配提门规。」',
    enemy: '铁拳门主',
    difficulty: 26,
    minLevel: 10,
    shard: 'shard-sect',
    shardName: '门派高阶心法残页',
    shardCount: 1,
  },
];

/** 秘籍合成配方：所需碎片数按等级递进 */
export const SHARD_RECIPES: { key: string; name: string; need: number; grade: string }[] = [
  { key: 'shard-wuhu', name: '五虎断门刀', need: 3, grade: 'D' },
  { key: 'shard-duanhun', name: '断魂刀法', need: 3, grade: 'D' },
  { key: 'shard-dujing', name: '毒经', need: 5, grade: 'C' },
  { key: 'shard-wujian', name: '无名剑法', need: 5, grade: 'C' },
  { key: 'shard-xuanyin', name: '玄阴内功', need: 8, grade: 'A' },
  { key: 'shard-sect', name: '门派高阶心法', need: 8, grade: 'A' },
];

export type PrisonState = {
  /** 最近一次记录的日键 YYYY-MM-DD */
  day: string;
  /** 囚犯 id -> 击败当日 */
  defeated: Record<string, string>;
  /** 碎片 key -> 数量 */
  shards: Record<string, number>;
  /** 已合成的秘籍 key */
  crafted: string[];
  /** 已解锁最高层 */
  floor: number;
  /** 上次保存的时间戳，用于时钟回拨检测 */
  lastTime: number;
};

export function defaultPrison(): PrisonState {
  return { day: '', defeated: {}, shards: {}, crafted: [], floor: 1, lastTime: 0 };
}

export function normalizePrison(p?: Partial<PrisonState> | null): PrisonState {
  const d = defaultPrison();
  if (!p) return d;
  const shards: Record<string, number> = {};
  if (p.shards && typeof p.shards === 'object') {
    for (const [k, v] of Object.entries(p.shards)) {
      if (Number.isFinite(v)) shards[k] = Math.max(0, Math.floor(v as number));
    }
  }
  const defeated: Record<string, string> = {};
  if (p.defeated && typeof p.defeated === 'object') {
    for (const [k, v] of Object.entries(p.defeated)) {
      if (typeof v === 'string') defeated[k] = v;
    }
  }
  return {
    day: typeof p.day === 'string' ? p.day : '',
    defeated,
    shards,
    crafted: Array.isArray(p.crafted) ? p.crafted.filter((x) => typeof x === 'string') : [],
    floor: Number.isFinite(p.floor) ? Math.min(5, Math.max(1, Math.floor(p.floor as number))) : 1,
    lastTime: Number.isFinite(p.lastTime) ? Math.max(0, Math.floor(p.lastTime as number)) : 0,
  };
}

/** 本地日键 */
export function todayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 时钟回拨检测：系统时间明显早于上次记录，视为可疑 */
export function clockRolledBack(state: PrisonState, ts: number = Date.now()): boolean {
  if (!state.lastTime) return false;
  return ts + 5 * 60 * 1000 < state.lastTime;
}

/** 刷新：仅当日键变化才重置挑战资格；时钟回拨则保持不变 */
export function refreshDaily(state: PrisonState, ts: number = Date.now()): PrisonState {
  const key = todayKey(ts);
  if (clockRolledBack(state, ts)) {
    return { ...state, lastTime: Math.max(state.lastTime, ts) };
  }
  if (state.day === key) return { ...state, lastTime: Math.max(state.lastTime, ts) };
  return { ...state, day: key, defeated: {}, lastTime: Math.max(state.lastTime, ts) };
}

export function canChallenge(state: PrisonState, prisonerId: string): boolean {
  return state.defeated[prisonerId] !== state.day || !state.day;
}

export type VictoryResult = {
  state: PrisonState;
  granted: boolean;
  shard?: string;
  shardName?: string;
  amount?: number;
  message: string;
};

/** 记录一次胜利：同一囚犯当日只发一次碎片 */
export function recordVictory(
  state: PrisonState,
  prisonerId: string,
  ts: number = Date.now()
): VictoryResult {
  const cur = refreshDaily(state, ts);
  const p = PRISONERS.find((x) => x.id === prisonerId);
  if (!p) return { state: cur, granted: false, message: '牢房里已经没有这个人了。' };
  if (cur.defeated[p.id] === cur.day) {
    return { state: cur, granted: false, message: `【天牢】今日已从${p.name}身上取过东西，明日再来。` };
  }
  const amount = p.shardCount;
  return {
    state: {
      ...cur,
      defeated: { ...cur.defeated, [p.id]: cur.day },
      shards: { ...cur.shards, [p.shard]: (cur.shards[p.shard] ?? 0) + amount },
    },
    granted: true,
    shard: p.shard,
    shardName: p.shardName,
    amount,
    message: `【天牢】击败${p.name}，获得《${p.shardName}》×${amount}。`,
  };
}

export type CraftResult = {
  state: PrisonState;
  ok: boolean;
  message: string;
  name?: string;
  grade?: string;
};

/** 碎片合成完整秘籍 */
export function craftFromShards(state: PrisonState, recipeKey: string): CraftResult {
  const r = SHARD_RECIPES.find((x) => x.key === recipeKey);
  if (!r) return { state, ok: false, message: '没有这个配方。' };
  if (state.crafted.includes(recipeKey)) {
    return { state, ok: false, message: `《${r.name}》已经合成过了。` };
  }
  const have = state.shards[recipeKey] ?? 0;
  if (have < r.need) {
    return { state, ok: false, message: `《${r.name}》还差 ${r.need - have} 片（${have}/${r.need}）。` };
  }
  return {
    state: {
      ...state,
      shards: { ...state.shards, [recipeKey]: have - r.need },
      crafted: [...state.crafted, recipeKey],
    },
    ok: true,
    message: `【天牢】碎片拼合，《${r.name}》（${r.grade} 级）入手。`,
    name: r.name,
    grade: r.grade,
  };
}

/** 面板统计 */
export function prisonSummary(state: PrisonState) {
  const total = PRISONERS.length;
  const done = PRISONERS.filter((p) => state.defeated[p.id] === state.day).length;
  return {
    day: state.day,
    doneToday: done,
    total,
    shardKinds: Object.values(state.shards).filter((n) => n > 0).length,
    crafted: state.crafted.length,
    floor: state.floor,
  };
}
