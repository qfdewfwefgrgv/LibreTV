/**
 * 藏宝图与江湖秘藏系统（纯数据 + 纯函数，便于测试与存档兼容）
 *
 * 计量方式：1 张完整藏宝图 = 100 「微单位」。
 * 章节首发奖励按实际 5 章重新分配（原方案为 7 章）：
 *   第一章 50 / 第二章 20 / 第三章 10 / 第四章 10 / 第五章 10 = 100
 */

export type TreasureState = {
  /** 已累计的碎片微单位 */
  shards: number;
  /** 已合成、尚未开启的藏宝图等级（1~6） */
  maps: number[];
  /** 已开启过的宝藏 id（一次性奖励，不可重复领取） */
  opened: string[];
  /** 已领取过碎片的章节号 */
  claimedChapters: number[];
};

export const SHARD_PER_MAP = 100;

export const CHAPTER_SHARDS: Record<number, number> = {
  1: 50,
  2: 20,
  3: 10,
  4: 10,
  5: 10,
};

export const TREASURE_TIERS: {
  tier: number;
  name: string;
  color: string;
  desc: string;
  minLevel: number;
  /** 可选的额外门槛：生活技能等级 */
  skill?: { key: 'herb' | 'mine' | 'alchemy'; level: number };
  /** 需要消耗的工具/道具 */
  needItem?: string;
  rewards: { exp: number; silver: number; items: string[] };
}[] = [
  {
    tier: 1,
    name: '江湖残图',
    color: 'border-line text-muted',
    desc: '边角磨损的旧图，标的不过是城郊一处土坡。',
    minLevel: 1,
    rewards: { exp: 40, silver: 60, items: ['草药', '草药', '金创药'] },
  },
  {
    tier: 2,
    name: '山河秘图',
    color: 'border-success/50 text-success',
    desc: '图上画着洛阳周边的山形水势，某处标记被反复描过。',
    minLevel: 3,
    skill: { key: 'mine', level: 2 },
    rewards: { exp: 80, silver: 120, items: ['矿石', '矿石', '矿石'] },
  },
  {
    tier: 3,
    name: '古墓藏宝图',
    color: 'border-accent/50 text-accent',
    desc: '纸背有朱砂印记，像是某个已灭门派的墓志。',
    minLevel: 6,
    skill: { key: 'herb', level: 3 },
    rewards: { exp: 140, silver: 180, items: ['真武剑', '金创药', '金创药'] },
  },
  {
    tier: 4,
    name: '门派秘藏图',
    color: 'border-warning/50 text-warning',
    desc: '图上盖着半枚门主印，指的是某派后山的旧藏。',
    minLevel: 10,
    skill: { key: 'alchemy', level: 4 },
    rewards: { exp: 220, silver: 260, items: ['虎骨膏', '草药', '草药'] },
  },
  {
    tier: 5,
    name: '天机残卷',
    color: 'border-danger/60 text-danger',
    desc: '残卷上的墨迹遇光会变，据说是某位天机老人的手笔。',
    minLevel: 15,
    rewards: { exp: 320, silver: 400, items: ['矿石', '矿石', '藏宝图碎片'] },
  },
  {
    tier: 6,
    name: '天下秘藏图',
    color: 'border-danger text-danger',
    desc: '整张图没有一笔是多余的，落款只两个字：天下。',
    minLevel: 20,
    rewards: { exp: 500, silver: 800, items: ['镇远剑', '真武剑'] },
  },
];

export function defaultTreasure(): TreasureState {
  return { shards: 0, maps: [], opened: [], claimedChapters: [] };
}

/** 读档兜底 */
export function normalizeTreasure(t?: Partial<TreasureState> | null): TreasureState {
  const d = defaultTreasure();
  if (!t) return d;
  return {
    shards: Number.isFinite(t.shards) ? Math.max(0, Math.floor(t.shards as number)) : 0,
    maps: Array.isArray(t.maps) ? t.maps.filter((m) => m >= 1 && m <= 6) : [],
    opened: Array.isArray(t.opened) ? t.opened.filter((x) => typeof x === 'string') : [],
    claimedChapters: Array.isArray(t.claimedChapters)
      ? t.claimedChapters.filter((c) => Number.isFinite(c))
      : [],
  };
}

/** 领取某章首发碎片（每章一次） */
export function claimChapterShards(
  state: TreasureState,
  chapter: number
): { state: TreasureState; gained: number; message: string } {
  const amount = CHAPTER_SHARDS[chapter];
  if (!amount) return { state, gained: 0, message: '该章节没有藏宝图奖励。' };
  if (state.claimedChapters.includes(chapter)) {
    return { state, gained: 0, message: '本章的藏宝图碎片已经领过了。' };
  }
  return {
    state: {
      ...state,
      shards: state.shards + amount,
      claimedChapters: [...state.claimedChapters, chapter],
    },
    gained: amount,
    message: `【藏宝图】第 ${chapter} 章首发：碎片 +${amount}（${(amount / SHARD_PER_MAP * 100).toFixed(0)}%）`,
  };
}

/** 碎片合成藏宝图，返回可合成的张数 */
export function craftMaps(state: TreasureState): { state: TreasureState; made: number } {
  const made = Math.floor(state.shards / SHARD_PER_MAP);
  if (made <= 0) return { state, made: 0 };
  const tier = Math.min(6, 1 + Math.floor(state.claimedChapters.length / 1.2));
  const maps = [...state.maps];
  for (let i = 0; i < made; i++) maps.push(tier);
  return { state: { ...state, shards: state.shards - made * SHARD_PER_MAP, maps }, made };
}

export type OpenResult = {
  ok: boolean;
  message: string;
  tier?: number;
  rewards?: { exp: number; silver: number; items: string[] };
  state: TreasureState;
};

/** 开启一张藏宝图：校验等级与生活技能，产出奖励，消耗该图 */
export function openTreasure(
  state: TreasureState,
  level: number,
  skills: Record<string, { level: number }> | undefined
): OpenResult {
  if (!state.maps.length) return { ok: false, message: '你手上还没有合成好的藏宝图。', state };
  const tier = state.maps[0];
  const def = TREASURE_TIERS.find((t) => t.tier === tier);
  if (!def) return { ok: false, message: '这张图的字迹已经看不清了。', state };

  if (level < def.minLevel) {
    return { ok: false, message: `【${def.name}】需要 ${def.minLevel} 级才看得懂图上的标记（当前 ${level} 级）。`, state };
  }
  if (def.skill) {
    const lv = skills?.[def.skill.key]?.level ?? 1;
    if (lv < def.skill.level) {
      const label = def.skill.key === 'herb' ? '采药' : def.skill.key === 'mine' ? '采矿' : '炼丹';
      return { ok: false, message: `【${def.name}】需要在${label}上有些门道（${label} Lv.${def.skill.level}，当前 Lv.${lv}）。`, state };
    }
  }

  const key = `${tier}-${state.opened.filter((o) => o.startsWith(`${tier}-`)).length + 1}`;
  return {
    ok: true,
    message: `【${def.name}】你按图索骥，在一处隐蔽的土石下挖到了东西。`,
    tier,
    rewards: def.rewards,
    state: {
      ...state,
      maps: state.maps.slice(1),
      opened: [...state.opened, key],
    },
  };
}

/** 图鉴进度 */
export function treasureDex(state: TreasureState) {
  const total = Object.values(CHAPTER_SHARDS).reduce((a, b) => a + b, 0);
  return {
    shards: state.shards,
    shardPercent: Math.min(100, Math.round((state.shards / SHARD_PER_MAP) * 100)),
    maps: state.maps.length,
    opened: state.opened.length,
    chaptersClaimed: state.claimedChapters.length,
    chaptersTotal: Object.keys(CHAPTER_SHARDS).length,
    totalShardPool: total,
  };
}
