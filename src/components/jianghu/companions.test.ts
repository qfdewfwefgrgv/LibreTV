import { describe, expect, it } from 'vitest';
import {
  COMPANIONS,
  addAffinity,
  companionActive,
  companionJoined,
  defaultCompanions,
  guardIntercept,
  normalizeCompanions,
  recruitCompanion,
} from './companions';

describe('同伴 · 招募与存档', () => {
  it('招募后进入名册并自动上阵', () => {
    const r = recruitCompanion(defaultCompanions(), 'shen-qingyi', 1000);
    expect(r.recruited).toBe(true);
    expect(r.name).toBe('沈青衣');
    expect(companionJoined(r.state, 'shen-qingyi')).toBe(true);
    expect(companionActive(r.state, 'shen-qingyi')).toBe(true);
    expect(r.state.roster['shen-qingyi'].joinedAt).toBe(1000);
  });

  it('重复招募不会覆盖状态', () => {
    const first = recruitCompanion(defaultCompanions(), 'shen-qingyi', 1000).state;
    const second = recruitCompanion(first, 'shen-qingyi', 2000);
    expect(second.recruited).toBe(false);
    expect(second.state.roster['shen-qingyi'].joinedAt).toBe(1000);
  });

  it('未知 id 招募无效', () => {
    const r = recruitCompanion(defaultCompanions(), 'nobody');
    expect(r.recruited).toBe(false);
    expect(Object.keys(r.state.roster)).toHaveLength(0);
  });

  it('旧存档缺字段时补默认值且不崩溃', () => {
    expect(normalizeCompanions(undefined)).toEqual(defaultCompanions());
    const n = normalizeCompanions({
      roster: { 'shen-qingyi': { affinity: 999, joinedAt: 5 }, bad: null as unknown as { affinity: number; joinedAt: number } },
      active: ['shen-qingyi', 'ghost'],
    });
    expect(n.roster['shen-qingyi'].affinity).toBe(100);
    expect(n.roster.bad).toBeUndefined();
    expect(n.active).toEqual(['shen-qingyi']);
  });

  it('好感度夹在 0~100', () => {
    const s = recruitCompanion(defaultCompanions(), 'shen-qingyi').state;
    expect(addAffinity(s, 'shen-qingyi', 200).roster['shen-qingyi'].affinity).toBe(100);
    expect(addAffinity(s, 'shen-qingyi', -200).roster['shen-qingyi'].affinity).toBe(0);
  });
});

describe('同伴 · 沈青衣以身挡刃', () => {
  it('非致命伤不触发', () => {
    const r = guardIntercept(10, 100, { hasShen: true, usedThisBattle: false });
    expect(r.triggered).toBe(false);
    expect(r.damage).toBe(10);
  });

  it('致命伤首次触发，代受 30%', () => {
    const r = guardIntercept(100, 40, { hasShen: true, usedThisBattle: false });
    expect(r.triggered).toBe(true);
    expect(r.absorbed).toBe(30);
    expect(r.damage).toBe(70);
  });

  it('同一场战斗只触发一次', () => {
    const r = guardIntercept(100, 40, { hasShen: true, usedThisBattle: true });
    expect(r.triggered).toBe(false);
    expect(r.damage).toBe(100);
  });

  it('未上阵沈青衣不触发', () => {
    const r = guardIntercept(100, 40, { hasShen: false, usedThisBattle: false });
    expect(r.triggered).toBe(false);
  });

  it('边界：伤害为 0 或刚好打空血', () => {
    expect(guardIntercept(0, 10, { hasShen: true, usedThisBattle: false }).triggered).toBe(false);
    const exact = guardIntercept(10, 10, { hasShen: true, usedThisBattle: false });
    expect(exact.triggered).toBe(true);
    expect(exact.damage).toBe(7);
    expect(exact.absorbed).toBe(3);
  });
});

describe('同伴 · 数据完整性', () => {
  it('15 名同伴，id 唯一，只有沈青衣标记为已实现', () => {
    expect(COMPANIONS).toHaveLength(15);
    expect(new Set(COMPANIONS.map((c) => c.id)).size).toBe(15);
    const done = COMPANIONS.filter((c) => c.implemented).map((c) => c.id);
    expect(done).toEqual(['shen-qingyi']);
  });
});
