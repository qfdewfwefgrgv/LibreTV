/**
 * 江湖同伴系统（阶段 B：最小可玩版本）
 *
 * 设计约束（来自交接文档）：
 * - 数据驱动，不把全部角色逻辑硬编码在单一大文件
 * - 概率/触发类机制做成可配置，并明确触发时机与次数上限
 * - 存档缺字段时用默认值，不崩溃
 *
 * 本版只启用沈青衣的「以身挡刃」，其余角色先登记设定，机制留待后续阶段。
 */

export type CompanionRole = '护卫' | '输出' | '治疗' | '控制' | '远程' | '爆发' | '防御' | '辅助' | '谋士' | '寻宝' | '传说';

export type CompanionDef = {
  id: string;
  name: string;
  role: CompanionRole;
  /** 立绘（缺图由 UI 回落） */
  portrait: string;
  /** 招募方式说明 */
  source: string;
  /** 被动说明 */
  passive: string;
  /** 主动技能说明 */
  active: string;
  /** 是否已实现机制 */
  implemented: boolean;
};

export const COMPANIONS: CompanionDef[] = [
  {
    id: 'shen-qingyi',
    name: '沈青衣',
    role: '护卫',
    portrait: '/game/portraits/shen-qingyi.webp',
    source: '支线《山道救孤》：在山道救下被围的侠客，追查其失踪师兄后加入。',
    passive: '以身挡刃：每场战斗首次致命伤由她代受 30%（剩余由你承担）。',
    active: '舍身护主（待实装）',
    implemented: true,
  },
  {
    id: 'gu-changfeng',
    name: '顾长风',
    role: '输出',
    portrait: '/game/portraits/gu-changfeng.webp',
    source: '主线《断剑重铸》：助其查明旧事。',
    passive: '剑意相授：全队会心 +3%（待实装）',
    active: '流云剑（待实装）',
    implemented: false,
  },
  {
    id: 'su-yueli',
    name: '苏月璃',
    role: '治疗',
    portrait: '/game/portraits/su-yueli.webp',
    source: '《药王谷秘闻》：谷中结识。',
    passive: '药香：丹药效果 +10%（待实装）',
    active: '回春术（待实装）',
    implemented: false,
  },
  {
    id: 'tang-wuying',
    name: '唐无影',
    role: '控制',
    portrait: '/game/portraits/tang-wuying.webp',
    source: '天牢特殊囚犯或相关剧情解锁。',
    passive: '封穴：概率使敌人失手（待实装）',
    active: '千机变（待实装）',
    implemented: false,
  },
  {
    id: 'liu-hongxiao',
    name: '柳红绡',
    role: '输出',
    portrait: '/game/portraits/liu-hongxiao.webp',
    source: '支线《红尘劫·不折傲骨》。',
    passive: '对男性敌人伤害 200%、受伤减免 50%（需先给敌人加标签，待实装）',
    active: '红绡断魂（待实装）',
    implemented: false,
  },
  {
    id: 'baili-shenji',
    name: '百里神机',
    role: '远程',
    portrait: '/game/portraits/baili-shenji.webp',
    source: '支线《最后一发子弹》。',
    passive: '临终遗藏：每战最多自动服药两次（待实装）',
    active: '穿云弹（待实装）',
    implemented: false,
  },
  {
    id: 'xiao-lie',
    name: '萧烈',
    role: '爆发',
    portrait: '/game/portraits/xiao-lie.webp',
    source: '支线《以命换命》。',
    passive: '焚血诀：消耗当前生命 15%，两回合伤害 300%，结束后扣最大生命 20%（待实装）',
    active: '血影斩（待实装）',
    implemented: false,
  },
  {
    id: 'murong-xue',
    name: '慕容雪',
    role: '控制',
    portrait: '/game/portraits/murong-xue.webp',
    source: '《雪山孤剑》。',
    passive: '寒气积累后冻结（待实装）',
    active: '冰封千里（待实装）',
    implemented: false,
  },
  {
    id: 'tie-shan',
    name: '铁山',
    role: '防御',
    portrait: '/game/portraits/tie-shan.webp',
    source: '《铁山不倒》。',
    passive: '低生命时防御提高（待实装）',
    active: '全队护盾（待实装）',
    implemented: false,
  },
  {
    id: 'bai-jiuer',
    name: '白九儿',
    role: '控制',
    portrait: '/game/portraits/bai-jiuer.webp',
    source: '《百毒谷》。',
    passive: '中毒层数越深，她伤害越高（待实装）',
    active: '蚀骨毒（待实装）',
    implemented: false,
  },
  {
    id: 'a-fu',
    name: '阿福',
    role: '辅助',
    portrait: '/game/portraits/a-fu.webp',
    source: '《一碗热粥》。',
    passive: '受击概率自疗（待实装）',
    active: '群体治疗（待实装）',
    implemented: false,
  },
  {
    id: 'ye-zhiqiu',
    name: '叶知秋',
    role: '谋士',
    portrait: '/game/portraits/ye-zhiqiu.webp',
    source: '《棋局之外》。',
    passive: '预判敌方行动（待实装）',
    active: '攻心（待实装）',
    implemented: false,
  },
  {
    id: 'han-qianren',
    name: '韩千刃',
    role: '爆发',
    portrait: '/game/portraits/han-qianren.webp',
    source: '《断臂之后》。',
    passive: '损失生命换攻击（待实装）',
    active: '残影一刀（待实装）',
    implemented: false,
  },
  {
    id: 'zhou-buyi',
    name: '周不疑',
    role: '寻宝',
    portrait: '/game/portraits/zhou-buyi.webp',
    source: '《古墓活人》。',
    passive: '提高藏宝图收益（待实装）',
    active: '识破机关（待实装）',
    implemented: false,
  },
  {
    id: 'dongfang-wuya',
    name: '东方无涯',
    role: '传说',
    portrait: '/game/portraits/dongfang-wuya.webp',
    source: '《天下无涯》：多段隐藏剧情后揭示身份。',
    passive: '解除全队负面状态（待实装）',
    active: '无涯剑（待实装）',
    implemented: false,
  },
];

export const companionById = (id: string) => COMPANIONS.find((c) => c.id === id) ?? null;

export type CompanionState = {
  /** 已加入的同伴：id -> 状态 */
  roster: Record<string, { affinity: number; joinedAt: number }>;
  /** 上阵同伴（本版最多 1） */
  active: string[];
};

export function defaultCompanions(): CompanionState {
  return { roster: {}, active: [] };
}

export function normalizeCompanions(c?: Partial<CompanionState> | null): CompanionState {
  const d = defaultCompanions();
  if (!c) return d;
  const roster: CompanionState['roster'] = {};
  if (c.roster && typeof c.roster === 'object') {
    for (const [k, v] of Object.entries(c.roster)) {
      if (!v || typeof v !== 'object') continue;
      const aff = Number((v as { affinity?: number }).affinity);
      const at = Number((v as { joinedAt?: number }).joinedAt);
      roster[k] = {
        affinity: Number.isFinite(aff) ? Math.max(0, Math.min(100, Math.floor(aff))) : 0,
        joinedAt: Number.isFinite(at) ? Math.floor(at) : 0,
      };
    }
  }
  const active = Array.isArray(c.active) ? c.active.filter((x) => typeof x === 'string' && roster[x]) : [];
  return { roster, active };
}

/** 招募：已在队中返回 false */
export function recruitCompanion(
  state: CompanionState,
  id: string,
  ts: number = Date.now()
): { state: CompanionState; recruited: boolean; name: string } {
  const def = companionById(id);
  if (!def) return { state, recruited: false, name: '' };
  if (state.roster[id]) return { state, recruited: false, name: def.name };
  return {
    state: {
      roster: { ...state.roster, [id]: { affinity: 10, joinedAt: ts } },
      active: state.active.length ? state.active : [id],
    },
    recruited: true,
    name: def.name,
  };
}

export function companionJoined(state: CompanionState, id: string): boolean {
  return Boolean(state.roster[id]);
}

export function companionActive(state: CompanionState, id: string): boolean {
  return state.active.includes(id) && Boolean(state.roster[id]);
}

/** 好感度变化 */
export function addAffinity(state: CompanionState, id: string, delta: number): CompanionState {
  const cur = state.roster[id];
  if (!cur) return state;
  const next = Math.max(0, Math.min(100, cur.affinity + delta));
  return { ...state, roster: { ...state.roster, [id]: { ...cur, affinity: next } } };
}

export type GuardResult = {
  /** 玩家实际承受的伤害 */
  damage: number;
  /** 沈青衣代受的伤害 */
  absorbed: number;
  /** 本次是否触发 */
  triggered: boolean;
};

/**
 * 沈青衣「以身挡刃」：每场战斗首次被打到 0 血时，她代受 30%。
 * 纯函数，便于测试 0 / 中间 / 边界。
 */
export function guardIntercept(
  incoming: number,
  playerHp: number,
  opts: { hasShen: boolean; usedThisBattle: boolean; ratio?: number }
): GuardResult {
  const ratio = opts.ratio ?? 0.3;
  const lethal = playerHp - incoming <= 0;
  if (!opts.hasShen || opts.usedThisBattle || !lethal || incoming <= 0) {
    return { damage: incoming, absorbed: 0, triggered: false };
  }
  const absorbed = Math.round(incoming * ratio);
  return { damage: Math.max(0, incoming - absorbed), absorbed, triggered: true };
}
