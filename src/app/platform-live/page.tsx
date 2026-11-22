'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { Spinner } from '@/components/states';
import { cn } from '@/lib/utils';

const LivePlayer = dynamic(() => import('@/components/live-player').then((m) => m.LivePlayer), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <Spinner size="lg" />
    </div>
  ),
});

type PlatformId = 'douyin' | 'kuaishou' | 'huya' | 'douyu' | 'bilibili';

type Platform = {
  id: PlatformId;
  name: string;
  badge: string;
  desc: string;
  home: string;
  roomLabel: string;
  placeholder: string;
  /** 房间号 → 平台直播间网页地址 */
  roomUrl: (id: string) => string;
  /** 是否支持站内直接播放（虎牙 FLV / B站 HLS 可解析，其余需登录态或签名） */
  inSite: boolean;
  brand: string;
  tint: string;
};

const PLATFORMS: Platform[] = [
  {
    id: 'douyin',
    name: '抖音直播',
    badge: 'DOUYIN',
    desc: '娱乐 · 带货 · 户外，需抖音登录态，仅外链打开',
    home: 'https://live.douyin.com/',
    roomLabel: '直播间号',
    placeholder: 'web_rid，如 123456789',
    roomUrl: (id) => `https://live.douyin.com/${id}`,
    inSite: false,
    brand: '#FE2C55',
    tint: 'rgba(254,44,85,0.16)',
  },
  {
    id: 'kuaishou',
    name: '快手直播',
    badge: 'KUAISHOU',
    desc: '游戏 · 才艺 · 电商，仅外链打开',
    home: 'https://live.kuaishou.com/',
    roomLabel: '快手号 / 房间号',
    placeholder: '快手ID，如 kwai123',
    roomUrl: (id) => `https://live.kuaishou.com/u/${id}`,
    inSite: false,
    brand: '#FF5000',
    tint: 'rgba(255,80,0,0.16)',
  },
  {
    id: 'huya',
    name: '虎牙直播',
    badge: 'HUYA',
    desc: '游戏赛事与娱乐，可输入房间号在本站直接观看',
    home: 'https://www.huya.com/',
    roomLabel: '房间号',
    placeholder: '如 660000',
    roomUrl: (id) => `https://www.huya.com/${id}`,
    inSite: true,
    brand: '#F5A623',
    tint: 'rgba(245,166,35,0.18)',
  },
  {
    id: 'douyu',
    name: '斗鱼直播',
    badge: 'DOUYU',
    desc: '游戏 · 二次元 · 户外，取流需签名，仅外链打开',
    home: 'https://www.douyu.com/',
    roomLabel: '房间号',
    placeholder: '如 9999',
    roomUrl: (id) => `https://www.douyu.com/${id}`,
    inSite: false,
    brand: '#FF7A00',
    tint: 'rgba(255,122,0,0.16)',
  },
  {
    id: 'bilibili',
    name: 'B站直播',
    badge: 'BILIBILI',
    desc: '虚拟主播 · 游戏 · 学习区，可输入房间号在本站直接观看',
    home: 'https://live.bilibili.com/',
    roomLabel: '房间号',
    placeholder: '如 6',
    roomUrl: (id) => `https://live.bilibili.com/${id}`,
    inSite: true,
    brand: '#00A1D6',
    tint: 'rgba(0,161,214,0.16)',
  },
];

function External() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

/** 平台直播页：虎牙 / B站 输入房间号即在本站起播；抖音 / 快手 / 斗鱼 跳转原站直播间 */
export default function PlatformLivePage() {
  const [inputs, setInputs] = useState<Partial<Record<PlatformId, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<PlatformId, string>>>({});
  const [loadingId, setLoadingId] = useState<PlatformId | null>(null);
  const [playing, setPlaying] = useState<{ url: string; title: string; platform: string } | null>(null);

  const setInput = (id: PlatformId, value: string) => {
    setInputs((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const openRoomPage = useCallback((p: Platform) => {
    const id = (inputs[p.id] || '').trim();
    window.open(id ? p.roomUrl(id) : p.home, '_blank', 'noopener,noreferrer');
  }, [inputs]);

  const playInSite = useCallback(
    async (p: Platform) => {
      const id = (inputs[p.id] || '').trim();
      if (!id || loadingId) return;
      setLoadingId(p.id);
      setErrors((prev) => ({ ...prev, [p.id]: '' }));
      try {
        const res = await fetch(`/api/live/platform?platform=${p.id}&id=${encodeURIComponent(id)}`, {
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
          setErrors((prev) => ({ ...prev, [p.id]: data.error || '解析失败' }));
          return;
        }
        if (!data.live || !data.url) {
          setErrors((prev) => ({ ...prev, [p.id]: data.message || '主播未开播' }));
          return;
        }
        // 平台 CDN 校验 UA/Referer 且不发 CORS 头，统一走同源代理
        setPlaying({
          url: `/api/live/stream?url=${encodeURIComponent(data.url)}`,
          title: data.title || `${p.name} ${data.roomId || id}`,
          platform: p.name,
        });
      } catch (err) {
        setErrors((prev) => ({ ...prev, [p.id]: err instanceof Error ? err.message : '请求失败' }));
      } finally {
        setLoadingId(null);
      }
    },
    [inputs, loadingId]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearch />

      <main className="flex-1 w-full max-w-6xl lg:max-w-7xl mx-auto px-4 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-content">平台直播</h1>
            <p className="mt-1 text-xs text-faint">
              抖音 / 快手 / 虎牙 / 斗鱼 / B站 直播间入口。虎牙与 B站 可输入房间号在本站直接观看，其余平台跳转原站。
            </p>
          </div>
          <Link href="/live" className="text-xs text-muted hover:text-accent transition-colors">
            前往频道直播（IPTV 频道） →
          </Link>
        </div>

        {playing && (
          <section className="card mb-4 overflow-hidden">
            <div className="aspect-video bg-black">
              <LivePlayer url={playing.url} title={playing.title} />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-t border-line">
              <span className="live-dot shrink-0" />
              <span className="text-sm text-content truncate flex-1">{playing.title}</span>
              <span className="tag bg-chip text-faint shrink-0">{playing.platform}</span>
              <button
                type="button"
                onClick={() => setPlaying(null)}
                className="text-xs text-muted hover:text-accent transition-colors shrink-0"
              >
                关闭
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.map((p) => {
            const busy = loadingId === p.id;
            const err = errors[p.id];
            return (
              <div key={p.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ background: p.tint, color: p.brand }}
                  >
                    {p.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-sm font-semibold text-content truncate">{p.name}</h2>
                      <span
                        className={cn(
                          'chip text-[10px]',
                          p.inSite ? 'bg-accent/15 text-accent' : 'bg-chip text-faint'
                        )}
                      >
                        {p.inSite ? '站内播放' : '外链'}
                      </span>
                    </div>
                    <p className="text-[11px] text-faint truncate">{p.badge}</p>
                  </div>
                </div>

                <p className="text-xs text-muted leading-relaxed">{p.desc}</p>

                <div className="flex items-center gap-2">
                  <input
                    value={inputs[p.id] || ''}
                    onChange={(e) => setInput(p.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (p.inSite) void playInSite(p);
                      else openRoomPage(p);
                    }}
                    placeholder={p.placeholder}
                    aria-label={`${p.name}${p.roomLabel}`}
                    className="input h-8 flex-1 min-w-0 text-xs"
                  />
                  {p.inSite ? (
                    <button
                      type="button"
                      disabled={busy || !(inputs[p.id] || '').trim()}
                      onClick={() => void playInSite(p)}
                      className="btn-primary btn-sm shrink-0"
                    >
                      {busy ? '解析中…' : '站内播放'}
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => openRoomPage(p)}
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
                  >
                    {p.inSite ? '在平台打开' : '打开直播间'}
                    <External />
                  </button>
                  <a
                    href={p.home}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-faint hover:text-accent transition-colors"
                  >
                    平台首页
                    <External />
                  </a>
                </div>

                {err && <p className="text-xs text-danger">{err}</p>}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-faint leading-relaxed">
          说明：抖音 / 快手 / 斗鱼的播放地址需要登录态或签名校验，无法在第三方站点内拉流，只能跳转原站；
          虎牙、B站的直播地址由本站服务端解析并以同源代理转发，房间号对应的直播地址会随开播状态变化，关闭直播后需重新解析。
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
