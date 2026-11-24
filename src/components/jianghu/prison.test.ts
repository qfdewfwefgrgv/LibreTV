import { describe, expect, it } from 'vitest';
import {
  PRISONERS,
  SHARD_RECIPES,
  canChallenge,
  craftFromShards,
  defaultPrison,
  normalizePrison,
  prisonSummary,
  recordVictory,
  refreshDaily,
  todayKey,
} from './prison';

const DAY1 = new Date('2026-11-25T10:00:00+08:00').getTime();
const DAY2 = new Date('2026-11-26T10:00:00+08:00').getTime();

describe('天牢 · 每日刷新', () => {
  it('首次挑战可用，击败后当日不可再领', () => {
    let st = refreshDaily(defaultPrison(), DAY1);
    expect(canChallenge(st, 'p-l1-bandit')).toBe(true);
    const r = recordVictory(st, 'p-l1-bandit', DAY1);
    expect(r.granted).toBe(true);
    st = r.state;
    expect(canChallenge(st, 'p-l1-bandit')).toBe(false);
    const again = recordVictory(st, 'p-l1-bandit', DAY1);
    expect(again.granted).toBe(false);
    expect(again.state.shards['shard-wuhu']).toBe(1);
  });

  it('跨天刷新资格，但碎片永久保留', () => {
    let st = recordVictory(refreshDaily(defaultPrison(), DAY1), 'p-l1-bandit', DAY1).state;
    st = refreshDaily(st, DAY2);
    expect(canChallenge(st, 'p-l1-bandit')).toBe(true);
    expect(st.shards['shard-wuhu']).toBe(1);
  });

  it('时钟回拨不会刷新资格', () => {
    let st = recordVictory(refreshDaily(defaultPrison(), DAY2), 'p-l1-bandit', DAY2).state;
    const back = DAY1;
    st = refreshDaily(st, back);
    expect(canChallenge(st, 'p-l1-bandit')).toBe(false);
    expect(st.lastTime).toBeGreaterThanOrEqual(DAY2);
  });

  it('日键格式为 YYYY-MM-DD', () => {
    expect(todayKey(DAY1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('天牢 · 碎片与合成', () => {
  it('碎片不足时不能合成且不消耗', () => {
    const st = { ...defaultPrison(), shards: { 'shard-wuhu': 2 } };
    const r = craftFromShards(st, 'shard-wuhu');
    expect(r.ok).toBe(false);
    expect(r.state.shards['shard-wuhu']).toBe(2);
  });

  it('碎片够时合成成功并扣除碎片', () => {
    const st = { ...defaultPrison(), shards: { 'shard-wuhu': 3 } };
    const r = craftFromShards(st, 'shard-wuhu');
    expect(r.ok).toBe(true);
    expect(r.state.shards['shard-wuhu']).toBe(0);
    expect(r.state.crafted).toContain('shard-wuhu');
  });

  it('已合成的秘籍不能重复合成', () => {
    const st = { ...defaultPrison(), shards: { 'shard-wuhu': 6 } };
    const first = craftFromShards(st, 'shard-wuhu');
    const second = craftFromShards(first.state, 'shard-wuhu');
    expect(second.ok).toBe(false);
    expect(second.message).toContain('已经合成过');
  });

  it('配方数量符合等级设计（普通3/中级5/高阶8）', () => {
    expect(SHARD_RECIPES.find((r) => r.key === 'shard-wuhu')?.need).toBe(3);
    expect(SHARD_RECIPES.find((r) => r.key === 'shard-dujing')?.need).toBe(5);
    expect(SHARD_RECIPES.find((r) => r.key === 'shard-xuanyin')?.need).toBe(8);
  });
});

describe('天牢 · 存档兜底与统计', () => {
  it('旧存档缺字段补默认值', () => {
    expect(normalizePrison(undefined)).toEqual(defaultPrison());
    const n = normalizePrison({ shards: { a: -3, b: 2.7 }, floor: 9, crafted: null as unknown as string[] });
    expect(n.shards.a).toBe(0);
    expect(n.shards.b).toBe(2);
    expect(n.floor).toBe(5);
    expect(n.crafted).toEqual([]);
  });

  it('统计返回当日完成数与总量', () => {
    let st = refreshDaily(defaultPrison(), DAY1);
    st = recordVictory(st, 'p-l1-bandit', DAY1).state;
    const sum = prisonSummary(st);
    expect(sum.doneToday).toBe(1);
    expect(sum.total).toBe(PRISONERS.length);
  });
});
