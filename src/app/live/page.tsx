'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { copyToClipboard } from '@/lib/clipboard';
import { Header } from '@/components/header';
// 播放器（artplayer + hls.js）按需加载：拆出独立 chunk，不占首屏 First Load JS
import dynamic from 'next/dynamic';
const LivePlayer = dynamic(() => import('@/components/live-player').then((m) => m.LivePlayer), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <Spinner size="lg" />
    </div>
  ),
});
import { LiveChannelList, type LiveChannelItem } from '@/components/live-channel-list';
import { LiveEpgPanel } from '@/components/live-epg-panel';
import { LiveReplayPanel } from '@/components/live-replay-panel';
import { Spinner } from '@/components/states';
import { allLiveSources, useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { SmartImage } from '@/components/smart-image';

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 直播页顶部的平台直播入口（外链直达官方直播网页版，站内嵌框会被平台拦截） */
const QUICK_PLATFORMS = [
  { id: 'douyin', name: '抖音', desc: '娱乐 · 带货 · 户外', home: 'https://live.douyin.com/', brand: '#FE2C55', tint: 'rgba(254,44,85,0.14)' },
  { id: 'kuaishou', name: '快手', desc: '游戏 · 才艺 · 电商', home: 'https://live.kuaishou.com/', brand: '#FF5000', tint: 'rgba(255,80,0,0.14)' },
  { id: 'huya', name: '虎牙', desc: '游戏赛事 · 娱乐', home: 'https://www.huya.com/', brand: '#F5A623', tint: 'rgba(245,166,35,0.16)' },
  { id: 'douyu', name: '斗鱼', desc: '游戏 · 二次元 · 户外', home: 'https://www.douyu.com/', brand: '#FF7A00', tint: 'rgba(255,122,0,0.14)' },
  { id: 'bilibili', name: 'B站', desc: '虚拟主播 · 游戏 · 学习', home: 'https://live.bilibili.com/', brand: '#00A1D6', tint: 'rgba(0,161,214,0.14)' },
] as const;

/** 卫视台/央视官方直播网页版入口（同样在新窗口打开，不嵌框），按类别分组 */
interface TvEntry { id: string; name: string; home: string; brand: string; playUrl?: string }
const SATELLITE_GROUPS: { label: string; emoji: string; tvs: TvEntry[] }[] = [
  {
    label: '央视', emoji: '📺',
    tvs: [
      { id: 'cctv1', name: 'CCTV1 综合', home: 'https://tv.cctv.com/live/cctv1/', brand: '#C8102E', playUrl: 'https://www.dianying.online/hls/cctv1.m3u8' },
      { id: 'cctv13', name: 'CCTV13 新闻', home: 'https://tv.cctv.com/live/cctv13/', brand: '#C8102E', playUrl: 'https://www.dianying.online/hls/cctv13.m3u8' },
      { id: 'cctv6', name: 'CCTV6 电影', home: 'https://tv.cctv.com/live/cctv6/', brand: '#C8102E', playUrl: 'https://www.dianying.online/hls/cctv6.m3u8' },
    ],
  },
  {
    label: '体育', emoji: '⚽',
    tvs: [
      { id: 'cctv5', name: 'CCTV5', home: 'https://tv.cctv.com/live/cctv5/', brand: '#0E7A3D', playUrl: 'https://www.dianying.online/hls/cctv5.m3u8' },
      { id: 'cctv5p', name: 'CCTV5+', home: 'https://tv.cctv.com/live/cctv5plus/', brand: '#0E7A3D', playUrl: 'https://www.dianying.online/hls/cctv5p.m3u8' },
      { id: 'gdsports', name: '广东体育', home: 'https://www.gdtv.cn/tvChannelDetail/43', brand: '#E65100', playUrl: 'https://www.dianying.online/hls/gdty.m3u8' },
    ],
  },
  {
    label: '特色卫视', emoji: '🌟',
    tvs: [
      { id: 'gba', name: '大湾区卫视', home: 'https://www.gdtv.cn/tvChannelDetail/44', brand: '#007A5E', playUrl: 'https://www.dianying.online/hls/dwq.m3u8' },
      { id: 'guangdong', name: '广东卫视', home: 'https://www.gdtv.cn/', brand: '#007A5E', playUrl: 'https://www.dianying.online/hls/gdws.m3u8' },
      { id: 'shenzhen', name: '深圳卫视', home: 'https://www.sztv.com.cn/', brand: '#1E90FF', playUrl: 'https://www.dianying.online/hls/sztv.m3u8' },
      { id: 'hunan', name: '湖南卫视', home: 'https://www.mgtv.com/', brand: '#FF6B35', playUrl: 'https://www.dianying.online/hls/hunan.m3u8' },
      { id: 'zhejiang', name: '浙江卫视', home: 'https://www.cztv.com/', brand: '#1B3A6B', playUrl: 'https://www.dianying.online/hls/zjtv.m3u8' },
      { id: 'beijing', name: '北京卫视', home: 'https://www.btime.com/', brand: '#D7263D', playUrl: 'https://www.dianying.online/hls/btv.m3u8' },
    ],
  },
];

/**
 * 直播页：左侧播放器 + 频道信息 + 节目单；右侧频道侧栏。
 * 状态由 URL 驱动（?url=&name=&group=&tvgId=&epg=），支持频道深链与刷新保持。
 * 换台路径：侧栏点击、全局 ↑↓ 键盘、播放器控制条上一台/下一台（全屏可用）。
 * 移动端侧栏为底部抽屉（右下角 FAB 呼出，选中频道后自动收起）。
 */
export default function LivePage() {
  return (
    <Suspense>
      <LiveContent />
    </Suspense>
  );
}

function LiveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // 精确订阅所需字段：任何其他 store 变化（如测活写回）不应触发本组件重渲染
  const liveSelectedUrls = useAppStore((s) => s.liveSelectedUrls);
  const liveEnvSources = useAppStore((s) => s.liveEnvSources);
  const liveSubscriptions = useAppStore((s) => s.liveSubscriptions);
  const liveFavorites = useAppStore((s) => s.liveFavorites);
  const imageProxyMode = useAppStore((s) => s.imageProxyMode);
  const customImageProxy = useAppStore((s) => s.customImageProxy);
  const [copied, setCopied] = useState(false);
  // 移动端频道抽屉开合
  const [listOpen, setListOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  /** 平台直播间：B站房间号输入与解析状态 */
  const [roomInput, setRoomInput] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState('');
  /** 侧栏上报的筛选排序结果（键盘换台沿此列表顺序）；ref 存储，不触发重渲染 */
  const filteredRef = useRef<LiveChannelItem[]>([]);
  /** 当前频道镜像：selectChannel 内读取最近一次播放的频道，用于记录"上一个频道" */
  const currentChannelRef = useRef<LiveChannelItem | undefined>(undefined);
  /** 上一个频道：退格键/按钮一键切回（电视遥控器 back 键习惯） */
  const lastChannelRef = useRef<LiveChannelItem | null>(null);
  /** 当前回放（非空时播放器播放回看地址，而不是直播地址） */
  const [replay, setReplay] = useState<{
    url: string;
    title: string;
    start: number;
    stop: number;
  } | null>(null);

  // 仅聚合已启用的直播源（设置 → 直播源中的勾选状态）
  const sources = useMemo(() => {
    const selected = new Set(liveSelectedUrls);
    return allLiveSources({ liveEnvSources, liveSubscriptions }).filter((s) => selected.has(s.url));
  }, [liveSelectedUrls, liveEnvSources, liveSubscriptions]);

  // 聚合全部直播源的 M3U 解析结果（单源失败不影响整体）
  const playlistsQuery = useQuery({
    queryKey: ['livePlaylists', sources.map((s) => s.url).join('|')],
    queryFn: async () => {
      const results = await Promise.allSettled(sources.map((s) => api.livePlaylist(s.url)));
      return sources.map((source, i) => ({ source, result: results[i] }));
    },
    enabled: sources.length > 0,
    staleTime: 10 * 60_000,
  });

  const { channels, groups, failedCount } = useMemo(() => {
    const list: LiveChannelItem[] = [];
    const seen = new Set<string>();
    let failed = 0;
    for (const { source, result } of playlistsQuery.data ?? []) {
      if (result.status !== 'fulfilled') {
        failed++;
        continue;
      }
      for (const c of result.value.channels) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        list.push({ ...c, epg: source.epg, sourceUrl: source.url });
      }
    }
    const groups = [...new Set(list.map((c) => c.group).filter((g): g is string => Boolean(g)))].sort(
      (a, b) => a.localeCompare(b, 'zh')
    );
    return { channels: list, groups, failedCount: failed };
  }, [playlistsQuery.data]);

  // 当前频道：优先取列表内完整对象（含台标），否则由 URL 参数重建
  const currentUrl = searchParams.get('url') || '';
  const currentChannel = useMemo(() => {
    const found = channels.find((c) => c.url === currentUrl);
    if (found) return found;
    if (!currentUrl) return undefined;
    return {
      id: searchParams.get('tvgId') || currentUrl,
      url: currentUrl,
      name: searchParams.get('name') || '未知频道',
      group: searchParams.get('group') || undefined,
      tvgId: searchParams.get('tvgId') || undefined,
      epg: searchParams.get('epg') || undefined,
    } as LiveChannelItem;
  }, [channels, currentUrl, searchParams]);

  useEffect(() => {
    setLogoFailed(false);
  }, [currentChannel?.url]);

  /** 去掉线路后缀，得到干净的频道名 */
  const cleanChannelName = useCallback(
    (name: string) =>
      name
        .replace(/[（(]\s*备用\s*[）)]/g, '')
        .replace(/[·•]\s*线路\s*\d+/g, '')
        .trim(),
    []
  );

  /** 线路归并键：同名视为同一频道的不同线路 */
  const lineKey = useCallback(
    (name: string) => cleanChannelName(name).toLowerCase(),
    [cleanChannelName]
  );

  /** 按线路归并后的分组：key → 该频道的全部线路 */
  const channelGroups = useMemo(() => {
    const map = new Map<string, LiveChannelItem[]>();
    for (const c of channels) {
      const k = lineKey(c.name);
      const arr = map.get(k);
      if (arr) arr.push(c);
      else map.set(k, [c]);
    }
    return map;
  }, [channels, lineKey]);

  /** 侧栏只展示一条：优先用正在播放的那条线路，保证高亮与点选一致 */
  const displayChannels = useMemo(() => {
    const out: LiveChannelItem[] = [];
    for (const list of channelGroups.values()) {
      const active = list.find((c) => c.url === currentUrl) ?? list[0];
      // 名称去掉线路后缀，列表里只显示一次干净台名
      out.push({ ...active, name: cleanChannelName(active.name) });
    }
    return out;
  }, [channelGroups, currentUrl, cleanChannelName]);

  /** 当前频道的可切换线路（多于 1 条时才渲染切换条） */
  const currentLines = useMemo(() => {
    if (!currentChannel) return [];
    return channelGroups.get(lineKey(currentChannel.name)) ?? [];
  }, [channelGroups, currentChannel, lineKey]);

  // 换台即退出回放态（回放地址只对当前频道有效）
  useEffect(() => {
    setReplay(null);
  }, [currentUrl]);
  useEffect(() => {
    currentChannelRef.current = currentChannel;
  }, [currentChannel]);

  const selectChannel = useCallback(
    (c: LiveChannelItem) => {
      const cur = currentChannelRef.current;
      if (cur && cur.url !== c.url) lastChannelRef.current = cur;
      const sp = new URLSearchParams({ url: c.url, name: c.name });
      if (c.group) sp.set('group', c.group);
      if (c.tvgId) sp.set('tvgId', c.tvgId);
      if (c.epg) sp.set('epg', c.epg);
      router.replace(`/live?${sp.toString()}`, { scroll: false });
      useAppStore.getState().addLiveRecent({
        url: c.url,
        name: c.name,
        logo: c.logo,
        group: c.group,
        tvgId: c.tvgId,
        epg: c.epg,
        sourceUrl: c.sourceUrl,
      });
    },
    [router]
  );

  const handleFilteredChange = useCallback((list: LiveChannelItem[]) => {
    filteredRef.current = list;
  }, []);

  /** 解析 B站 房间号并直接起播（解析出的 m3u8 交给播放器，直连失败会自动走代理） */
  const openPlatformRoom = useCallback(async () => {
    const id = roomInput.trim();
    if (!id || roomLoading) return;
    setRoomLoading(true);
    setRoomError('');
    try {
      const res = await fetch(`/api/live/platform?platform=bilibili&id=${encodeURIComponent(id)}`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        live?: boolean;
        url?: string;
        roomId?: string;
        title?: string;
      };
      if (!res.ok) {
        setRoomError(data.error || '解析失败');
        return;
      }
      if (!data.live || !data.url) {
        setRoomError(data.message || '主播未开播');
        return;
      }
      // B站 CDN 对直连做 UA/Referer 校验（实测直连 403），一开始就走同源代理，
      // 不要先交给播放器直连再回退——那条回退路径对 https 源不可靠。
      const proxied = `/api/live/stream?url=${encodeURIComponent(data.url)}`;
      selectChannel({
        id: `bilibili-${data.roomId}`,
        url: proxied,
        name: data.title || `B站 ${data.roomId}`,
        group: '平台直播',
        tvgId: `bilibili-${data.roomId}`,
      } as LiveChannelItem);
      setRoomInput('');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setRoomLoading(false);
    }
  }, [roomInput, roomLoading, selectChannel]);

  /** 沿侧栏当前筛选排序的列表顺序切上一台/下一台（循环） */
  const switchChannelByOffset = useCallback(
    (delta: 1 | -1) => {
      const list = filteredRef.current;
      if (list.length === 0) return;
      const nowUrl = new URLSearchParams(window.location.search).get('url') || '';
      const idx = list.findIndex((c) => c.url === nowUrl);
      const next =
        idx === -1 ? (delta === 1 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length;
      selectChannel(list[next]);
    },
    [selectChannel]
  );

  const goPrevChannel = useCallback(() => switchChannelByOffset(-1), [switchChannelByOffset]);
  const goNextChannel = useCallback(() => switchChannelByOffset(1), [switchChannelByOffset]);

  /** 切回上一个频道（Backspace / 信息条按钮） */
  const backToPrevChannel = useCallback(() => {
    const prev = lastChannelRef.current;
    if (!prev) return;
    lastChannelRef.current = null;
    selectChannel(prev);
  }, [selectChannel]);

  // 全局键盘：↑↓ 直接切台，Backspace 切回上一个频道。
  // 输入框/列表光标导航场景让位（列表聚焦时由列表内 ↑↓ 管理光标）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isChannelKey = e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Backspace';
      if (!isChannelKey) return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        if (target.isContentEditable) return;
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.closest('[data-channel-list]')) return;
      }
      e.preventDefault();
      if (e.key === 'Backspace') backToPrevChannel();
      else switchChannelByOffset(e.key === 'ArrowDown' ? 1 : -1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [switchChannelByOffset, backToPrevChannel]);

  const handleSelect = useCallback(
    (c: LiveChannelItem) => {
      selectChannel(c);
      // 移动端抽屉：选中即收起
      setListOpen(false);
    },
    [selectChannel]
  );

  const logo = currentChannel?.logo;
  const isFavorite = currentChannel ? liveFavorites.includes(currentChannel.url) : false;

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearch />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 overflow-x-clip">
        {/* 平台直播入口：抖音 / 快手 / 虎牙 / 斗鱼 / B站，点击直达官方直播网页版 */}
        <div className="mb-2 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          <span className="shrink-0 text-xs text-muted">平台直播</span>
          {QUICK_PLATFORMS.map((p) => (
            <a
              key={p.id}
              href={p.home}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-content transition-colors hover:border-accent/50 hover:text-accent"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.brand }} />
              {p.name}
            </a>
          ))}
        </div>

        {/* 卫视台/央视官方直播网页版入口（分组：央视 / 体育 / 特色卫视） */}
        <div className="mb-3 space-y-1.5">
          {SATELLITE_GROUPS.map((g) => (
            <div key={g.label} className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
              <span className="shrink-0 text-xs text-muted">{g.emoji} {g.label}</span>
              {g.tvs.map((p) => (
                <a
                  key={p.id}
                  href={p.playUrl ? `/live?url=${encodeURIComponent(p.playUrl)}&name=${encodeURIComponent(p.name)}` : p.home}
                  {...(p.playUrl ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-content transition-colors hover:border-accent/50 hover:text-accent"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.brand }} />
                  {p.name}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* 平台直播间：输入 B站 房间号直接起播 */}
        <form
          className="mb-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void openPlatformRoom();
          }}
        >
          <span className="text-xs text-muted">B站直播间</span>
          <input
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="房间号，如 6"
            inputMode="numeric"
            className="input h-8 w-32 text-sm"
          />
          <button
            type="submit"
            disabled={roomLoading || !roomInput.trim()}
            className="btn-primary btn-sm"
          >
            {roomLoading ? '解析中…' : '播放'}
          </button>
          {roomError && <span className="text-xs text-danger">{roomError}</span>}
        </form>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* 主栏：播放器 + 信息条 + 节目单 */}
          <div className="min-w-0">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {currentUrl ? (
                <LivePlayer
                  url={replay?.url ?? currentUrl}
                  title={
                    replay
                      ? `${currentChannel ? cleanChannelName(currentChannel.name) : '直播'} · 回放 ${fmtClock(replay.start)}-${fmtClock(replay.stop)}`
                      : currentChannel
                        ? cleanChannelName(currentChannel.name)
                        : '直播'
                  }
                  isReplay={Boolean(replay)}
                  onPrevChannel={goPrevChannel}
                  onNextChannel={goNextChannel}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
                  <span className="live-dot" />
                  <p className="text-white/60 text-sm">
                    {sources.length === 0
                      ? liveEnvSources.length + liveSubscriptions.length > 0
                        ? '所有直播源均已停用，请在设置中勾选启用'
                        : '请先在设置中添加直播源（M3U 订阅）'
                      : playlistsQuery.isLoading
                        ? '频道列表加载中...'
                        : '从右侧选择一个频道开始观看'}
                  </p>
                </div>
              )}
            </div>

            {/* 回放状态条：明确当前播放的是回看而不是直播 */}
            {replay && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
                <span className="text-[10px] font-semibold text-warning bg-warning/15 px-1.5 py-0.5 rounded-full shrink-0">
                  回放
                </span>
                <span className="text-xs text-muted truncate flex-1">
                  {replay.title} · {fmtClock(replay.start)}-{fmtClock(replay.stop)}
                </span>
                <button
                  className="text-xs text-accent hover:underline shrink-0"
                  onClick={() => setReplay(null)}
                >
                  返回直播
                </button>
              </div>
            )}

            {/* 线路切换：同一频道有多条源时，某条卡顿可手动换线 */}
            {currentLines.length > 1 && !replay && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted shrink-0">线路</span>
                {currentLines.map((line, i) => (
                  <button
                    key={line.url}
                    type="button"
                    onClick={() => selectChannel({ ...line, name: cleanChannelName(line.name) })}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs transition-colors',
                      line.url === currentUrl
                        ? 'border-accent/40 bg-accent/15 text-accent'
                        : 'border-line bg-chip text-muted hover:text-content'
                    )}
                  >
                    线路 {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* 频道信息条 */}
            {currentChannel && (
              <div className="bg-surface-raised border border-line rounded-lg p-3 mt-3 flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded bg-chip flex items-center justify-center overflow-hidden">
                  {logo && !logoFailed ? (
                    <SmartImage
                      url={logo}
                      mode={imageProxyMode}
                      customProxy={customImageProxy}
                      alt=""
                      className="w-full h-full object-contain"
                      onExhausted={() => setLogoFailed(true)}
                    />
                  ) : (
                    <span className="text-xs text-faint">{currentChannel.name.slice(0, 1)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="live-dot shrink-0" />
                    <h1 className="text-sm font-semibold text-content truncate">{cleanChannelName(currentChannel.name)}</h1>
                    {currentChannel.group && (
                      <span className="tag bg-chip text-faint shrink-0">{currentChannel.group}</span>
                    )}
                  </div>
                  <p className="text-xs text-faint truncate mt-0.5">{currentChannel.url}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className={cn(
                      'rounded-md p-2 transition-colors',
                      lastChannelRef.current
                        ? 'text-muted hover:text-accent hover:bg-hover'
                        : 'text-faint/40 cursor-default'
                    )}
                    aria-label="上一个频道"
                    title={lastChannelRef.current ? `上一个频道：${lastChannelRef.current.name}（Backspace）` : '暂无上一个频道'}
                    onClick={backToPrevChannel}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 15L4 10l5-5m-5 5h10.5a5.5 5.5 0 015.5 5.5V17"
                      />
                    </svg>
                  </button>
                  <button
                    className="rounded-md p-2 text-muted hover:text-accent hover:bg-hover transition-colors"
                    aria-label="上一台"
                    title="上一台（↑）"
                    onClick={goPrevChannel}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    className="rounded-md p-2 text-muted hover:text-accent hover:bg-hover transition-colors"
                    aria-label="下一台"
                    title="下一台（↓）"
                    onClick={goNextChannel}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <button
                    className={cn(
                      'rounded-md p-2 transition-colors',
                      isFavorite ? 'text-warning' : 'text-muted hover:text-warning hover:bg-hover'
                    )}
                    aria-label={isFavorite ? '取消收藏' : '收藏'}
                    title={isFavorite ? '取消收藏' : '收藏'}
                    onClick={() => useAppStore.getState().toggleLiveFavorite(currentChannel.url)}
                  >
                    <svg
                      className="w-4 h-4"
                      fill={isFavorite ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </button>
                  <button
                    className="rounded-md p-2 text-muted hover:text-accent hover:bg-hover transition-colors"
                    aria-label="复制播放地址"
                    title="复制播放地址"
                    onClick={async () => {
                      const ok = await copyToClipboard(currentChannel.url);
                      if (ok) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }
                    }}
                  >
                    {copied ? (
                      <span className="text-[10px] text-success">已复制</span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 节目单 */}
            {currentChannel && (
              <section className="bg-surface-raised border border-line rounded-lg p-3 mt-3">
                <h2 className="text-sm font-semibold text-content mb-2.5">节目单</h2>
                <LiveEpgPanel epgUrl={currentChannel.epg} tvgId={currentChannel.tvgId} />
              </section>
            )}

            {/* 近期回放（近三天） */}
            {currentChannel && (
              <section className="bg-surface-raised border border-line rounded-lg p-3 mt-3">
                <h2 className="text-sm font-semibold text-content mb-2.5">近期回放（近 3 天）</h2>
                <LiveReplayPanel
                  channel={currentChannel}
                  onPlay={(url, info) => setReplay({ url, ...info })}
                />
              </section>
            )}
          </div>

          {/* 移动端抽屉遮罩 */}
          {listOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              aria-hidden="true"
              onClick={() => setListOpen(false)}
            />
          )}

          {/* 侧栏：桌面常驻 sticky；移动端底部抽屉 */}
          <aside
            className={cn(
              'bg-surface-raised border border-line flex-col overflow-hidden',
              'fixed inset-x-0 bottom-0 z-40 h-[75vh] rounded-t-2xl shadow-2xl',
              listOpen ? 'flex' : 'hidden',
              'lg:sticky lg:top-20 lg:flex lg:h-[calc(100vh-6.5rem)] lg:rounded-xl lg:shadow-none'
            )}
          >
            {/* 抽屉把手栏（仅移动端） */}
            <div className="flex items-center justify-between px-3 pt-3 pb-1 shrink-0 lg:hidden">
              <span className="text-sm font-semibold text-content">频道列表</span>
              <button
                className="rounded-md p-1.5 text-muted hover:text-content hover:bg-hover transition-colors"
                aria-label="关闭频道列表"
                onClick={() => setListOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              {playlistsQuery.isLoading && channels.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <Spinner size="lg" />
                </div>
              ) : (
                <LiveChannelList
                  channels={displayChannels}
                  groups={groups}
                  currentUrl={currentUrl}
                  onSelect={handleSelect}
                  onFilteredChange={handleFilteredChange}
                />
              )}
              {(failedCount > 0 || sources.length === 0) && (
                <p className="text-[10px] text-faint px-3 py-1.5 border-t border-line shrink-0">
                  {sources.length === 0
                    ? liveEnvSources.length + liveSubscriptions.length > 0
                      ? '所有直播源均已停用，请在设置中勾选启用'
                      : '暂无直播源，请在设置 → 直播源中添加'
                    : `${failedCount > 0 ? `${failedCount} 个订阅拉取失败 · ` : ''}共 ${sources.length} 个已启用源`}
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* 未选频道时：用平台直播卡片填满下方空白，也作为平台直播的入口 */}
        {!currentUrl && (
          <section className="mt-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-x-3">
              <div className="min-w-0">
                <h2 className="section-heading text-content">平台直播</h2>
                <p className="mt-1 text-xs text-faint">抖音 / 快手 / 虎牙 / 斗鱼 / B站 官方直播间</p>
              </div>
              <a
                href="/platform-live"
                className="shrink-0 self-start text-xs text-muted transition-colors hover:text-accent sm:self-auto"
              >
                站内播放 →
              </a>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {QUICK_PLATFORMS.map((p) => (
                <a
                  key={p.id}
                  href={p.home}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group card p-3 transition-colors hover:border-accent/50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
                      style={{ background: p.tint, color: p.brand }}
                    >
                      {p.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-content">{p.name}直播</p>
                      <p className="truncate text-[11px] text-faint">{p.desc}</p>
                    </div>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted transition-colors group-hover:text-accent">
                    打开直播间
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
                    </svg>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* 移动端呼出频道列表的悬浮按钮 */}
        {!listOpen && channels.length > 0 && (
          <button
            className="fixed bottom-4 right-4 z-30 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm text-on-accent shadow-lg lg:hidden"
            onClick={() => setListOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            频道
          </button>
        )}
      </main>
    </div>
  );
}
