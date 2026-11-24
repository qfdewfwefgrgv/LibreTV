/**
 * 门派身份与晋升体系（交接文档「门派关系与师徒传承」基础层）
 *
 * 六阶身份，逐级解锁更高品级武学：
 *   外门 → 内门 → 精英 → 亲传 → 核心 → 掌门候选
 *
 * 晋升三要素：门派贡献 + 境界等级 + 已学本门武学数（体现「师门考验」）。
 * 全部为纯函数，便于测试。
 */

export type SectRank = {
  /** 0-based 索引 */
  index: number;
  name: string;
  /** 晋升所需贡献 */
  needContribution: number;
  /** 晋升所需等级 */
  needLevel: number;
  /** 晋升所需已学本门秘籍数与等级下限 */
  needManualGrade?: number;
  /** 可修习的最高秘籍品级 */
  maxManualGrade: 'D' | 'C' | 'B' | 'A' | 'S';
  /** 身份说明 */
  desc: string;
};

export const SECT_RANKS: SectRank[] = [
  {
    index: 0,
    name: '外门弟子',
    needContribution: 0,
    needLevel: 1,
    maxManualGrade: 'D',
    desc: '在演武场扫地、挑水，师父只教你最粗浅的架子。',
  },
  {
    index: 1,
    name: '内门弟子',
    needContribution: 30,
    needLevel: 4,
    maxManualGrade: 'C',
    desc: '得准入内门听讲，可以借阅堂口的入门拳谱。',
  },
  {
    index: 2,
    name: '精英弟子',
    needContribution: 80,
    needLevel: 8,
    maxManualGrade: 'B',
    desc: '在师门比试中胜过同辈，堂主开始单独指点你。',
  },
  {
    index: 3,
    name: '亲传弟子',
    needContribution: 150,
    needLevel: 12,
    maxManualGrade: 'A',
    desc: '师父将你唤到后院，说这门外功过后，才是本门真正的东西。',
  },
  {
    index: 4,
    name: '核心弟子',
    needContribution: 260,
    needLevel: 16,
    maxManualGrade: 'A',
    desc: '掌门在册上记下你的名字，从此你可代师门出战。',
  },
  {
    index: 5,
    name: '掌门候选',
    needContribution: 400,
    needLevel: 20,
    maxManualGrade: 'S',
    desc: '长老们在你身后低声议论：下一任掌门，或许就是此人。',
  },
];

const GRADE_ORDER = ['D', 'C', 'B', 'A', 'S'] as const;

export function rankOf(value: number | undefined | null): SectRank {
  const i = Number.isFinite(value as number) ? Math.max(0, Math.min(SECT_RANKS.length - 1, Math.floor(value as number))) : 0;
  return SECT_RANKS[i];
}

export function nextRank(value: number | undefined | null): SectRank | null {
  const i = rankOf(value).index + 1;
  return i < SECT_RANKS.length ? SECT_RANKS[i] : null;
}

/** 当前身份能否修习该品级秘籍 */
export function manualGradeAllowed(rankValue: number | undefined | null, grade: string): boolean {
  const allowed = GRADE_ORDER.indexOf(rankOf(rankValue).maxManualGrade);
  const want = GRADE_ORDER.indexOf(grade as (typeof GRADE_ORDER)[number]);
  if (want < 0) return false;
  return want <= allowed;
}

export type PromoteResult = {
  ok: boolean;
  message: string;
  rank?: number;
  name?: string;
};

/** 晋升校验（不修改数据，只判定） */
export function checkPromote(
  rankValue: number | undefined | null,
  contribution: number,
  level: number
): PromoteResult {
  const cur = rankOf(rankValue);
  const nxt = nextRank(rankValue);
  if (!nxt) return { ok: false, message: '你已身居掌门候选，再上一步便是掌门之位。' };
  if (contribution < nxt.needContribution) {
    return {
      ok: false,
      message: `晋升${nxt.name}需门派贡献 ${nxt.needContribution}（现有 ${contribution}）。`,
    };
  }
  if (level < nxt.needLevel) {
    return {
      ok: false,
      message: `晋升${nxt.name}需境界 ${nxt.needLevel} 层（当前 ${level}）。`,
    };
  }
  return {
    ok: true,
    message: `【师门】你自${cur.name}晋为${nxt.name}。${nxt.desc}`,
    rank: nxt.index,
    name: nxt.name,
  };
}

/** 执行晋升：扣除贡献并返回新身份 */
export function applyPromote(
  rankValue: number | undefined | null,
  contribution: number,
  level: number
): { ok: boolean; message: string; rank: number; contribution: number } {
  const r = checkPromote(rankValue, contribution, level);
  if (!r.ok) {
    return { ok: false, message: r.message, rank: rankOf(rankValue).index, contribution };
  }
  return {
    ok: true,
    message: r.message,
    rank: r.rank as number,
    contribution: contribution - SECT_RANKS[r.rank as number].needContribution,
  };
}

/** 面板用的进度信息 */
export function rankProgress(rankValue: number | undefined | null, contribution: number, level: number) {
  const cur = rankOf(rankValue);
  const nxt = nextRank(rankValue);
  if (!nxt) return { cur, nxt: null, contribPct: 100, levelPct: 100 };
  const base = cur.needContribution;
  const span = Math.max(1, nxt.needContribution - base);
  const contribPct = Math.max(0, Math.min(100, Math.round(((contribution - base) / span) * 100)));
  const levelPct = Math.max(0, Math.min(100, Math.round((level / nxt.needLevel) * 100)));
  return { cur, nxt, contribPct, levelPct };
}
