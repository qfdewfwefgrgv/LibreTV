import { describe, expect, it } from 'vitest';
import {
  buildCatchupUrl,
  buildReplaySlots,
  fillCatchupTemplate,
  hasCatchup,
  replayDays,
} from './catchup';
import type { LiveChannel } from './types';

function channel(overrides: Partial<LiveChannel> = {}): LiveChannel {
  return {
    id: 'gdty',
    name: '广东体育',
    url: 'https://live.example.com/gdty.m3u8',
    ...overrides,
  };
}

// 2026-10-23 12:00:00 +08:00
const START = Date.UTC(2026, 9, 23, 4, 0, 0);
const STOP = START + 30 * 60_000;

describe('fillCatchupTemplate', () => {
  it('替换 start/end 为 Unix 秒', () => {
    const out = fillCatchupTemplate('?start=${start}&end=${end}', START, STOP);
    expect(out).toBe(`?start=${Math.floor(START / 1000)}&end=${Math.floor(STOP / 1000)}`);
  });

  it('支持 UTC 与北京时间格式化占位符', () => {
    const utc = fillCatchupTemplate('${(u)yyyyMMddHHmmss}', START, STOP);
    const bj = fillCatchupTemplate('${(b)yyyyMMddHHmmss}', START, STOP);
    expect(utc).toBe('20261023040000');
    expect(bj).toBe('20261023120000');
  });

  it('未知占位符保持原样', () => {
    expect(fillCatchupTemplate('?x=${foo}', START, STOP)).toBe('?x=${foo}');
  });
});

describe('hasCatchup / replayDays', () => {
  it('没有 catchup 属性视为不支持', () => {
    expect(hasCatchup(channel())).toBe(false);
  });

  it('支持 catchup 标记或地址模板', () => {
    expect(hasCatchup(channel({ catchup: 'append' }))).toBe(true);
    expect(hasCatchup(channel({ catchupSource: '?start=${start}' }))).toBe(true);
  });

  it('回看天数限制在 1-3 天（未声明时默认展示 3 天）', () => {
    expect(replayDays(channel())).toBe(3);
    expect(replayDays(channel({ catchupDays: 7 }))).toBe(3);
    expect(replayDays(channel({ catchupDays: 2 }))).toBe(2);
  });
});

describe('buildCatchupUrl', () => {
  it('append 模式把模板拼到直播地址后', () => {
    const url = buildCatchupUrl(
      channel({ catchup: 'append', catchupSource: '?start=${start}&end=${end}' }),
      START,
      STOP
    );
    expect(url).toBe(
      `https://live.example.com/gdty.m3u8?start=${Math.floor(START / 1000)}&end=${Math.floor(
        STOP / 1000
      )}`
    );
  });

  it('完整模板地址直接使用', () => {
    const url = buildCatchupUrl(
      channel({ catchup: 'default', catchupSource: 'https://cdn.example.com/timeshift/${(b)yyyyMMddHHmmss}.m3u8' }),
      START,
      STOP
    );
    expect(url).toBe('https://cdn.example.com/timeshift/20261023120000.m3u8');
  });

  it('相对路径模板按直播地址解析', () => {
    const url = buildCatchupUrl(
      channel({ catchup: 'shift', catchupSource: '/replay/${start}.m3u8' }),
      START,
      STOP
    );
    expect(url).toBe(`https://live.example.com/replay/${Math.floor(START / 1000)}.m3u8`);
  });

  it('仅声明 catchup 时退回 playseek 约定', () => {
    const url = buildCatchupUrl(channel({ catchup: 'default' }), START, STOP);
    expect(url).toBe(
      `https://live.example.com/gdty.m3u8?playseek=${Math.floor(START / 1000)}-${Math.floor(
        STOP / 1000
      )}`
    );
  });

  it('不支持回看时返回 undefined', () => {
    expect(buildCatchupUrl(channel(), START, STOP)).toBeUndefined();
  });
});

describe('buildReplaySlots', () => {
  const NOW = new Date(2026, 9, 23, 12, 0, 0, 0).getTime();

  it('已结束的一天返回 48 个半小时时段', () => {
    const dayStart = new Date(2026, 9, 22, 0, 0, 0, 0).getTime();
    const slots = buildReplaySlots(dayStart, NOW);
    expect(slots).toHaveLength(48);
    expect(slots[0].stop - slots[0].start).toBe(30 * 60_000);
    expect(slots[47].stop).toBe(dayStart + 24 * 3600_000);
  });

  it('当天只列到当前时刻', () => {
    const dayStart = new Date(2026, 9, 23, 0, 0, 0, 0).getTime();
    const slots = buildReplaySlots(dayStart, NOW);
    expect(slots).toHaveLength(24); // 00:00 - 12:00
    expect(slots[slots.length - 1].stop).toBe(NOW);
  });
});
