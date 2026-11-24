import { describe, expect, it } from 'vitest';
import {
  CHAPTER_SHARDS,
  SHARD_PER_MAP,
  claimChapterShards,
  craftMaps,
  defaultTreasure,
  normalizeTreasure,
  openTreasure,
  treasureDex,
} from './treasure';

describe('藏宝图 · 碎片与合成', () => {
  it('章节首发每章只能领一次', () => {
    let st = defaultTreasure();
    const first = claimChapterShards(st, 1);
    expect(first.gained).toBe(CHAPTER_SHARDS[1]);
    st = first.state;
    const again = claimChapterShards(st, 1);
    expect(again.gained).toBe(0);
    expect(again.message).toContain('已经领过');
  });

  it('五章碎片总量正好合成一张图', () => {
    let st = defaultTreasure();
    for (const ch of Object.keys(CHAPTER_SHARDS).map(Number)) {
      st = claimChapterShards(st, ch).state;
    }
    expect(st.shards).toBe(SHARD_PER_MAP);
    const r = craftMaps(st);
    expect(r.made).toBe(1);
    expect(r.state.shards).toBe(0);
    expect(r.state.maps).toHaveLength(1);
  });

  it('碎片不足时合成失败且不消耗', () => {
    const st = { ...defaultTreasure(), shards: 60 };
    const r = craftMaps(st);
    expect(r.made).toBe(0);
    expect(r.state.shards).toBe(60);
  });
});

describe('藏宝图 · 开启条件', () => {
  it('没有图时不能寻宝', () => {
    const r = openTreasure(defaultTreasure(), 30, undefined);
    expect(r.ok).toBe(false);
  });

  it('等级不足时拒绝', () => {
    const st = { ...defaultTreasure(), maps: [3] };
    const r = openTreasure(st, 1, { herb: { level: 9 }, mine: { level: 9 }, alchemy: { level: 9 } });
    expect(r.ok).toBe(false);
    expect(r.state.maps).toHaveLength(1);
  });

  it('生活技能不足时拒绝', () => {
    const st = { ...defaultTreasure(), maps: [2] };
    const r = openTreasure(st, 30, { herb: { level: 9 }, mine: { level: 1 }, alchemy: { level: 9 } });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('采矿');
  });

  it('条件满足时消耗一张图并记录已开启', () => {
    const st = { ...defaultTreasure(), maps: [1, 1] };
    const r = openTreasure(st, 5, { herb: { level: 1 }, mine: { level: 1 }, alchemy: { level: 1 } });
    expect(r.ok).toBe(true);
    expect(r.state.maps).toHaveLength(1);
    expect(r.state.opened).toHaveLength(1);
    expect(r.state.opened[0].startsWith('1-')).toBe(true);
    expect(r.rewards?.items.length).toBeGreaterThan(0);
  });
});

describe('藏宝图 · 存档兜底与图鉴', () => {
  it('旧存档缺字段时补默认值', () => {
    expect(normalizeTreasure(undefined)).toEqual(defaultTreasure());
    expect(normalizeTreasure({ shards: -5, maps: [0, 9, 3], opened: null as unknown as string[] })).toEqual({
      shards: 0,
      maps: [3],
      opened: [],
      claimedChapters: [],
    });
  });

  it('图鉴进度按微单位换算百分比', () => {
    const dex = treasureDex({ ...defaultTreasure(), shards: 50, maps: [1], opened: ['1-1'] });
    expect(dex.shardPercent).toBe(50);
    expect(dex.maps).toBe(1);
    expect(dex.opened).toBe(1);
    expect(dex.chaptersTotal).toBe(Object.keys(CHAPTER_SHARDS).length);
  });
});
