'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { buildCatchupUrl, buildReplaySlots, hasCatchup, replayDays } from '@/lib/catchup';
import type { EpgProgram } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Spinner } from './states';
import type { LiveChannelItem } from './live-channel-list';

/**
 * 近期回放面板：按「直播源声明的 catchup 能力」列出最近 3 天的可回看时段。
 * - 源声明了 catchup / catchup-source：按日期 + 节目（有 EPG 时）或 30 分钟时段回看；
 * - 源未声明：明确提示不支持，不生成无效地址。
 */

interface LiveReplayPanelProps {
  channel: LiveChannelItem;
  onPlay: (url: string, info: { title: string; start: number; stop: number }) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  );
}

function dayLabel(offset: number, dayStart: number): string {
  if (offset === 0) return '今天';
  if (offset === 1) return '昨天';
  const d = new Date(dayStart);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface ReplayItem {
  start: number;
  stop: number;
  title: string;
}

export function LiveReplayPanel({ channel, onPlay }: LiveReplayPanelProps) {
  const [dayOffset, setDayOffset] = useState(0);
  const now = Date.now();
  const days = replayDays(channel);
  const supported = hasCatchup(channel);
  const todayStart = startOfDay(now);
  const dayStart = todayStart - dayOffset * 24 * 3600_000;

  const epgEnabled = Boolean(channel.epg && channel.tvgId);
  const epgQuery = useQuery({
    queryKey: ['liveReplayEpg', channel.epg, channel.tvgId, days],
    queryFn: ({ signal }) => api.liveEpg(channel.epg!, channel.tvgId!, false, signal, days),
    enabled: supported && epgEnabled,
    staleTime: 10 * 60_000,
  });

  const items = useMemo<ReplayItem[]>(() => {
    if (!supported) return [];
    const fromEpg: EpgProgram[] = (epgQuery.data?.programs ?? [])
      .filter((p) => sameDay(p.start, dayStart) && p.stop <= now)
      .sort((a, b) => a.start - b.start);
    if (fromEpg.length > 0) {
      return fromEpg.map((p) => ({ start: p.start, stop: p.stop, title: p.title }));
    }
    // 无 EPG（或当天无节目数据）时退回 30 分钟时段
    return buildReplaySlots(dayStart, now);
  }, [supported, epgQuery.data, dayStart, now]);

  if (!supported) {
    return (
      <p className="text-xs text-faint leading-relaxed">
        当前直播源未声明回看能力（M3U 缺少 catchup / catchup-source），无法回放已播节目。
        换用支持回看的直播源后，此处会自动列出最近三天的节目。
      </p>
    );
  }

  const loading = epgEnabled && epgQuery.isLoading && items.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: days }, (_, i) => {
          const start = todayStart - i * 24 * 3600_000;
          return (
            <button
              key={i}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs transition-colors',
                dayOffset === i ? 'bg-accent text-on-accent' : 'bg-chip text-muted hover:bg-hover'
              )}
              onClick={() => setDayOffset(i)}
            >
              {dayLabel(i, start)}
            </button>
          );
        })}
        <span className="ml-auto text-[10px] text-faint">源声明可回看 {channel.catchupDays ?? days} 天</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-faint text-center py-3">该日期暂无可回放的节目</p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {items.map((item) => {
            const url = buildCatchupUrl(channel, item.start, item.stop);
            return (
              <li key={`${item.start}-${item.title}`}>
                <button
                  className={cn(
                    'w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md text-left transition-colors',
                    url ? 'text-muted hover:bg-hover hover:text-content' : 'text-faint/60 cursor-not-allowed'
                  )}
                  disabled={!url}
                  title={url ? '回放该时段' : '该源未提供可用的回看地址'}
                  onClick={() => {
                    if (!url) return;
                    onPlay(url, { title: item.title, start: item.start, stop: item.stop });
                  }}
                >
                  <span className="text-faint tabular-nums shrink-0">
                    {fmtTime(item.start)} - {fmtTime(item.stop)}
                  </span>
                  <span className="truncate">{item.title}</span>
                  {url && (
                    <svg
                      className="w-3.5 h-3.5 ml-auto shrink-0 text-accent"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
