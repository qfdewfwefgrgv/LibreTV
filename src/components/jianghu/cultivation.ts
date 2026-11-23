/**
 * 经脉 / 生活技能 / 锻造 / 炼丹扩展 / 挂机加成
 */

export type LifeSkillKey = 'herb' | 'mine' | 'alchemy' | 'qinwine';

export type LifeSkills = Record<LifeSkillKey, { level: number; exp: number }>;

export type MeridianKey =
  | 'renmai'
  | 'dumai'
  | 'chongmai'
  | 'daimai'
  | 'yinwei'
  | 'yangwei'
  | 'yinqiao'
  | 'yangqiao'
  | 'shoujue'
  | 'zujue';

export type MeridianDef = {
  key: MeridianKey;
  name: string;
  desc: string;
  costExp: number;
  /** 点亮后加成 */
  bonus: {
    maxHp?: number;
    qi?: number;
    dodge?: number;
    parry?: number;
    idleMul?: number;
    crit?: number;
  };
  /** 前置穴位 */
  requires?: MeridianKey[];
};

export const MERIDIANS: MeridianDef[] = [
  { key: 'renmai', name: '任脉 · 承浆', desc: '气沉丹田，气血微涨。', costExp: 40, bonus: { maxHp: 8 } },
  { key: 'dumai', name: '督脉 · 百会', desc: '神清气爽，内力微增。', costExp: 45, bonus: { qi: 4 }, requires: ['renmai'] },
  { key: 'chongmai', name: '冲脉 · 气冲', desc: '气血贯通，气血再涨。', costExp: 55, bonus: { maxHp: 12 }, requires: ['renmai'] },
  { key: 'daimai', name: '带脉 · 章门', desc: '固护腰胁，招架略增。', costExp: 50, bonus: { parry: 3 }, requires: ['dumai'] },
  { key: 'yinwei', name: '阴维 · 筑宾', desc: '守中有攻，挂机略增。', costExp: 60, bonus: { idleMul: 0.08 }, requires: ['chongmai'] },
  { key: 'yangwei', name: '阳维 · 金门', desc: '身法轻灵，闪避略增。', costExp: 60, bonus: { dodge: 3 }, requires: ['daimai'] },
  { key: 'yinqiao', name: '阴跷 · 照海', desc: '步法沉稳，气血与挂机双增。', costExp: 75, bonus: { maxHp: 10, idleMul: 0.1 }, requires: ['yinwei'] },
  { key: 'yangqiao', name: '阳跷 · 申脉', desc: '先手之机，会心略增。', costExp: 75, bonus: { crit: 3, dodge: 2 }, requires: ['yangwei'] },
  { key: 'shoujue', name: '手厥阴 · 内关', desc: '掌心生力，内力与招架。', costExp: 90, bonus: { qi: 6, parry: 2 }, requires: ['yinqiao', 'yangqiao'] },
  { key: 'zujue', name: '足少阳 · 环跳', desc: '下盘稳固，气血大涨与挂机。', costExp: 100, bonus: { maxHp: 18, idleMul: 0.12 }, requires: ['shoujue'] },
];

export const LIFE_SKILL_LABEL: Record<LifeSkillKey, string> = {
  herb: '采药',
  mine: '挖矿',
  alchemy: '丹道',
  qinwine: '琴酒',
};

export function defaultLifeSkills(): LifeSkills {
  return {
    herb: { level: 1, exp: 0 },
    mine: { level: 1, exp: 0 },
    alchemy: { level: 1, exp: 0 },
    qinwine: { level: 1, exp: 0 },
  };
}

export function lifeSkillNeed(level: number): number {
  return 20 + (level - 1) * 15;
}

/** 给生活技能加熟练度，满则升级（上限 10） */
export function gainLifeSkill(skills: LifeSkills, key: LifeSkillKey, amount: number): LifeSkills {
  const cur = skills[key] ?? { level: 1, exp: 0 };
  let level = cur.level;
  let exp = cur.exp + amount;
  while (level < 10 && exp >= lifeSkillNeed(level)) {
    exp -= lifeSkillNeed(level);
    level += 1;
  }
  return { ...skills, [key]: { level, exp } };
}

export function meridianBonuses(opened: MeridianKey[]): {
  maxHp: number;
  qi: number;
  dodge: number;
  parry: number;
  idleMul: number;
  crit: number;
} {
  const total = { maxHp: 0, qi: 0, dodge: 0, parry: 0, idleMul: 0, crit: 0 };
  for (const key of opened) {
    const m = MERIDIANS.find((x) => x.key === key);
    if (!m) continue;
    total.maxHp += m.bonus.maxHp ?? 0;
    total.qi += m.bonus.qi ?? 0;
    total.dodge += m.bonus.dodge ?? 0;
    total.parry += m.bonus.parry ?? 0;
    total.idleMul += m.bonus.idleMul ?? 0;
    total.crit += m.bonus.crit ?? 0;
  }
  return total;
}

export function canOpenMeridian(opened: MeridianKey[], key: MeridianKey): boolean {
  const def = MERIDIANS.find((m) => m.key === key);
  if (!def || opened.includes(key)) return false;
  if (!def.requires?.length) return true;
  return def.requires.every((r) => opened.includes(r));
}

/** 锻造：消耗矿石与银两，强化一件已装备兵器的词条 */
export type ForgeBoost = { crit: number; lifesteal: number; speed: number; power: number };

export function defaultForge(): ForgeBoost {
  return { crit: 0, lifesteal: 0, speed: 0, power: 0 };
}

export const FORGE_COST = { ore: 2, silver: 40 };

/** 扩展炼丹配方 */
export type RecipeExt = {
  name: string;
  herbs: number;
  desc: string;
  /** 丹道等级不足时失败率（0-1） */
  failBase?: number;
  /** 非回血类效果标记 */
  kind?: 'heal' | 'atk' | 'intent' | 'cleanse';
  heal?: number;
};

export const RECIPES_EXT: RecipeExt[] = [
  { name: '金创药', herbs: 2, desc: '止血生肌，回复 30 气血', kind: 'heal', heal: 30, failBase: 0.05 },
  { name: '还魂草', herbs: 4, desc: '吊命续气，回复 55 气血', kind: 'heal', heal: 55, failBase: 0.08 },
  { name: '灵芝散', herbs: 6, desc: '灵芝入药，回复 80 气血', kind: 'heal', heal: 80, failBase: 0.1 },
  { name: '虎骨膏', herbs: 5, desc: '临时战意：下场战斗攻击 +8%', kind: 'atk', failBase: 0.15 },
  { name: '清心丹', herbs: 3, desc: '解毒清心，驱散流血', kind: 'cleanse', failBase: 0.06 },
  { name: '剑意丸', herbs: 7, desc: '吞服后剑意 +15', kind: 'intent', failBase: 0.18 },
];

/** 炼丹成功率：丹道等级越高失败越低 */
export function craftSuccessChance(alchemyLevel: number, failBase = 0.1): number {
  return Math.min(0.98, Math.max(0.35, 1 - failBase + alchemyLevel * 0.04));
}

/** 挂机收益倍率：经脉 + 生活技能 */
export function idleMultiplier(opened: MeridianKey[], skills: LifeSkills): number {
  const m = meridianBonuses(opened).idleMul;
  const life =
    ((skills.herb?.level ?? 1) + (skills.mine?.level ?? 1) + (skills.alchemy?.level ?? 1) + (skills.qinwine?.level ?? 1) - 4) *
    0.03;
  return 1 + m + Math.max(0, life);
}
