import type { LiveChannel } from './types';

/**
 * M3U 回看（catchup）地址生成。
 *
 * 常见写法：
 * - `catchup="append" catchup-source="?starttime=${start}&endtime=${end}"`
 * - `catchup="default" catchup-source="http://host/timeshift/${channel}/${(b)yyyyMMddHHmmss}.m3u8"`
 * - `catchup="shift" catchup-days="7"`
 *
 * 占位符支持：
 * - `${start}` / `${utc}`：开始时间（Unix 秒）
 * - `${end}` / `${lutc}`：结束时间（Unix 秒）
 * - `${(b)yyyyMMddHHmmss}`：北京时间（UTC+8）格式化
 * - `${(u)yyyyMMddHHmmss}`：UTC 格式化
 */

/** 回看最多展示的天数 */
export const MAX_REPLAY_DAYS = 3;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 按 `yyyyMMddHHmmss` 这类常见的日期格式串输出 */
function formatDate(ms: number, pattern: string, utc: boolean): string {
  const d = new Date(ms);
  const y = utc ? d.getUTCFullYear() : d.getFullYear();
  const mo = utc ? d.getUTCMonth() : d.getMonth();
  const day = utc ? d.getUTCDate() : d.getDate();
  const h = utc ? d.getUTCHours() : d.getHours();
  const mi = utc ? d.getUTCMinutes() : d.getMinutes();
  const s = utc ? d.getUTCSeconds() : d.getSeconds();
  const tokens: Record<string, string> = {
    yyyy: String(y),
    MM: pad(mo + 1),
    dd: pad(day),
    HH: pad(h),
    mm: pad(mi),
    ss: pad(s),
  };
  return Object.entries(tokens).reduce((out, [k, v]) => out.split(k).join(v), pattern);
}

/** 替换模板中的时间占位符 */
export function fillCatchupTemplate(template: string, startMs: number, stopMs: number): string {
  const startSec = Math.floor(startMs / 1000);
  const stopSec = Math.floor(stopMs / 1000);
  let out = template
    .replace(/\$\{(?:start|utc)\}/g, String(startSec))
    .replace(/\$\{(?:end|lutc)\}/g, String(stopSec))
    .replace(/\$\{now\}/g, String(Math.floor(Date.now() / 1000)));

  // ${(b)yyyyMMddHHmmss} / ${(u)yyyyMMddHHmmss}
  out = out.replace(/\$\{\(([bu])\)([^}]+)\}/g, (_m, zone: string, pattern: string) => {
    // (b) 北京时间 = UTC+8；(u) UTC。统一用 UTC 字段输出，避免受服务器本地时区影响
    const shifted = zone === 'b' ? startMs + 8 * 3600_000 : startMs;
    return formatDate(shifted, pattern, true);
  });
  return out;
}

/** 频道是否声明了可用的回看能力 */
export function hasCatchup(channel: LiveChannel): boolean {
  if (!channel.catchup && !channel.catchupSource) return false;
  // 只有 catchup 标记但没有任何地址模板：按通用 playseek 约定兜底
  return Boolean(channel.catchupSource || channel.catchup);
}

/** 可回看天数（最多 3 天；源未声明天数时按功能上限 3 天展示） */
export function replayDays(channel: LiveChannel): number {
  return Math.min(MAX_REPLAY_DAYS, Math.max(1, channel.catchupDays ?? MAX_REPLAY_DAYS));
}

/**
 * 生成某个时间段的回看播放地址。
 * 无回看能力时返回 undefined。
 */
export function buildCatchupUrl(
  channel: LiveChannel,
  startMs: number,
  stopMs: number
): string | undefined {
  if (!hasCatchup(channel)) return undefined;

  const template = channel.catchupSource?.trim();
  if (!template) {
    // 仅声明 catchup：按 IPTV 社区通用的 playseek 约定追加
    const sep = channel.url.includes('?') ? '&' : '?';
    return `${channel.url}${sep}playseek=${Math.floor(startMs / 1000)}-${Math.floor(stopMs / 1000)}`;
  }

  const filled = fillCatchupTemplate(template, startMs, stopMs);
  // 完整地址直接用；相对片段按 append 语义拼到直播地址后
  let replayUrl: string;
  if (/^https?:\/\//i.test(filled)) {
    replayUrl = filled;
  } else if (channel.catchup?.toLowerCase() === 'append' || filled.startsWith('?') || filled.startsWith('&')) {
    replayUrl = channel.url + filled;
  } else {
    // 其余情况把模板当作相对路径解析
    try {
      replayUrl = new URL(filled, channel.url).href;
    } catch {
      return undefined;
    }
  }

  try {
    return new URL(replayUrl).href;
  } catch {
    return undefined;
  }
}

/** 回看时段（无 EPG 时的兜底列表）：每 30 分钟一个时段 */
export interface ReplaySlot {
  start: number;
  stop: number;
  title: string;
}

/**
 * 生成某一天的回看时段。
 * @param dateMs 当天 00:00 的时间戳
 * @param now 当前时间（当天只列到当前时刻为止）
 */
export function buildReplaySlots(dateMs: number, now: number = Date.now()): ReplaySlot[] {
  const slots: ReplaySlot[] = [];
  const dayStart = new Date(dateMs);
  dayStart.setHours(0, 0, 0, 0);
  const startOfDay = dayStart.getTime();
  const endOfDay = startOfDay + 24 * 3600_000;
  for (let t = startOfDay; t < endOfDay; t += 30 * 60_000) {
    const stop = Math.min(t + 30 * 60_000, endOfDay);
    if (stop > now) break;
    const d = new Date(t);
    const label = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    slots.push({ start: t, stop, title: `${label} 时段回放` });
  }
  return slots;
}
