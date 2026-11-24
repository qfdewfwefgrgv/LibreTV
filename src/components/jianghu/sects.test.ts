import { describe, expect, it } from 'vitest';
import {
  SECT_RANKS,
  applyPromote,
  checkPromote,
  manualGradeAllowed,
  nextRank,
  rankOf,
  rankProgress,
} from './sects';

describe('门派身份 · 分级与默认值', () => {
  it('未设定身份时视为外门弟子', () => {
    expect(rankOf(undefined).name).toBe('外门弟子');
    expect(rankOf(null).name).toBe('外门弟子');
  });

  it('越界身份被夹在合法区间', () => {
    expect(rankOf(-5).name).toBe('外门弟子');
    expect(rankOf(99).name).toBe('掌门候选');
  });

  it('六阶身份顺序与品级上限正确', () => {
    expect(SECT_RANKS).toHaveLength(6);
    expect(SECT_RANKS.map((r) => r.name)).toEqual([
      '外门弟子', '内门弟子', '精英弟子', '亲传弟子', '核心弟子', '掌门候选',
    ]);
    expect(SECT_RANKS[0].maxManualGrade).toBe('D');
    expect(SECT_RANKS[5].maxManualGrade).toBe('S');
  });
});

describe('门派身份 · 武学品级门槛', () => {
  it('外门弟子只能学 D 级', () => {
    expect(manualGradeAllowed(0, 'D')).toBe(true);
    expect(manualGradeAllowed(0, 'C')).toBe(false);
  });

  it('内门弟子可学 C，精英可学 B，亲传可学 A', () => {
    expect(manualGradeAllowed(1, 'C')).toBe(true);
    expect(manualGradeAllowed(1, 'B')).toBe(false);
    expect(manualGradeAllowed(2, 'B')).toBe(true);
    expect(manualGradeAllowed(3, 'A')).toBe(true);
    expect(manualGradeAllowed(3, 'S')).toBe(false);
  });

  it('只有掌门候选能学 S 级', () => {
    expect(manualGradeAllowed(4, 'S')).toBe(false);
    expect(manualGradeAllowed(5, 'S')).toBe(true);
  });
});

describe('门派身份 · 晋升判定', () => {
  it('贡献不足被拒且不改状态', () => {
    const r = applyPromote(0, 10, 10);
    expect(r.ok).toBe(false);
    expect(r.rank).toBe(0);
    expect(r.contribution).toBe(10);
    expect(r.message).toContain('贡献');
  });

  it('等级不足被拒', () => {
    const r = checkPromote(0, 100, 1);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('境界');
  });

  it('条件满足时晋升并扣除贡献', () => {
    const r = applyPromote(0, 50, 5);
    expect(r.ok).toBe(true);
    expect(r.rank).toBe(1);
    expect(r.contribution).toBe(50 - SECT_RANKS[1].needContribution);
  });

  it('掌门候选封顶', () => {
    const r = checkPromote(5, 9999, 99);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('掌门候选');
  });

  it('nextRank 在顶端返回 null', () => {
    expect(nextRank(5)).toBeNull();
    expect(nextRank(0)?.name).toBe('内门弟子');
  });
});

describe('门派身份 · 进度条数据', () => {
  it('贡献与等级百分比夹在 0~100', () => {
    const p = rankProgress(0, 15, 2);
    expect(p.contribPct).toBe(50);
    expect(p.levelPct).toBe(50);
    const over = rankProgress(0, 999, 99);
    expect(over.contribPct).toBe(100);
    expect(over.levelPct).toBe(100);
  });

  it('封顶身份进度为满', () => {
    const p = rankProgress(5, 0, 1);
    expect(p.nxt).toBeNull();
    expect(p.contribPct).toBe(100);
  });
});
