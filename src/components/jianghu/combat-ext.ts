/**
 * 技能 / 连招 / 敌人 AI / Boss 阶段
 */

export type SchoolKey = 'quan' | 'jian' | 'dao';

export type SkillId = 'basic' | 'school' | 'finisher' | 'inner';

export type SkillDef = {
  id: SkillId;
  name: string;
  desc: string;
  /** 伤害倍率 */
  powerMul: number;
  /** 消耗「内息」点数（战斗内资源，非永久 qi） */
  cost: number;
  /** 冷却回合 */
  cd: number;
  /** 命中后连招点 */
  comboGain: number;
};

export function schoolSkills(school: SchoolKey): Record<Exclude<SkillId, 'basic' | 'finisher' | 'inner'>, SkillDef> & {
  school: SkillDef;
  finisher: SkillDef;
  inner: SkillDef;
  basic: SkillDef;
} {
  const schoolSkill: Record<SchoolKey, SkillDef> = {
    quan: {
      id: 'school',
      name: '崩山拳',
      desc: '近战爆发，开碑裂石；高眩晕几率',
      powerMul: 1.35,
      cost: 2,
      cd: 2,
      comboGain: 2,
    },
    jian: {
      id: 'school',
      name: '飞花刺',
      desc: '灵动飘逸，双段轻击',
      powerMul: 0.85,
      cost: 1,
      cd: 1,
      comboGain: 2,
    },
    dao: {
      id: 'school',
      name: '封喉刀',
      desc: '势大力沉，易触发流血',
      powerMul: 1.45,
      cost: 2,
      cd: 2,
      comboGain: 2,
    },
  };
  return {
    basic: {
      id: 'basic',
      name: '普通攻击',
      desc: '稳扎稳打，攒连招',
      powerMul: 1,
      cost: 0,
      cd: 0,
      comboGain: 1,
    },
    school: schoolSkill[school],
    finisher: {
      id: 'finisher',
      name: school === 'quan' ? '开碑裂石' : school === 'jian' ? '万剑归宗' : '一刀封路',
      desc: '连招满点终结技，伤害极高',
      powerMul: 1.9,
      cost: 0,
      cd: 0,
      comboGain: 0,
    },
    inner: {
      id: 'inner',
      name: '内息护体',
      desc: '消耗内息回血，本回合不攻击',
      powerMul: 0,
      cost: 3,
      cd: 3,
      comboGain: 0,
    },
  };
}

export const COMBO_MAX = 5;

export type EnemyAiAction = 'attack' | 'heal' | 'charge' | 'rage';

export type BossPhase = 1 | 2 | 3;

/** Boss 阶段：按血量比例 */
export function bossPhase(hpRatio: number): BossPhase {
  if (hpRatio > 0.66) return 1;
  if (hpRatio > 0.33) return 2;
  return 3;
}

export function bossPhaseLabel(name: string, phase: BossPhase): string | null {
  if (phase === 1) return null;
  if (name === '殷无咎') {
    return phase === 2 ? '【阶段二】殷无咎刀势收束，杀意更冷' : '【阶段三】殷无咎燃尽内力，疯魔一击';
  }
  if (name === '黑塔') {
    return phase === 2 ? '【阶段二】黑塔怒吼，刀风更沉' : '【阶段三】黑塔弃守为攻，不计伤亡';
  }
  if (name === '魔教护法') {
    return phase === 2 ? '【阶段二】护法唤来魔焰护身' : '【阶段三】护法决死一搏';
  }
  return phase === 2 ? `【阶段二】${name}开始认真了` : `【阶段三】${name}陷入狂怒`;
}

/** 敌人 AI：按血量与是否 Boss 选行动 */
export function pickEnemyAction(
  hpRatio: number,
  isBoss: boolean,
  charged: boolean,
): EnemyAiAction {
  if (charged) return 'rage';
  if (isBoss) {
    if (hpRatio < 0.25 && Math.random() < 0.45) return 'heal';
    if (hpRatio < 0.4 && Math.random() < 0.3) return 'charge';
    if (hpRatio < 0.55 && Math.random() < 0.2) return 'heal';
    return 'attack';
  }
  if (hpRatio < 0.3 && Math.random() < 0.35) return 'heal';
  if (hpRatio < 0.5 && Math.random() < 0.15) return 'charge';
  return 'attack';
}

export const BOSS_NAMES = new Set(['殷无咎', '黑塔', '魔教护法', '铁拳门主']);

/** 阶段伤害倍率 */
export function phasePowerMul(phase: BossPhase): number {
  if (phase === 1) return 1;
  if (phase === 2) return 1.15;
  return 1.35;
}
