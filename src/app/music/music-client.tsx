'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';

type Platform = {
  name: string;
  badge: string;
  desc: string;
  href: string;
  brand: string;
  tint: string;
  /** 该平台是否对移动端网页版有完整适配。false 时卡片显示提示 chip */
  mobileOk: boolean;
  /** 需翻墙访问的平台：卡片显示 VPN chip，点击前探测网络 */
  needVpn: boolean;
};

const MUSIC: Platform[] = [
  {
    name: '网易云音乐',
    badge: 'NETEASE',
    desc: '华语歌曲 · 私人 FM · 热歌榜',
    href: 'https://music.163.com/',
    brand: '#D43B34',
    tint: 'rgba(212,59,52,0.16)',
    mobileOk: true,
    needVpn: false,
  },
  {
    name: 'QQ 音乐',
    badge: 'QQMUSIC',
    desc: '海量曲库 · 绿钻 · 现场演出',
    href: 'https://y.qq.com/',
    brand: '#31C27C',
    tint: 'rgba(49,194,124,0.16)',
    mobileOk: true,
    needVpn: false,
  },
  {
    name: '酷狗音乐',
    badge: 'KUGOU',
    desc: '热歌榜单 · 歌手视频 · 直播',
    href: 'https://www.kugou.com/',
    brand: '#4B9BE7',
    tint: 'rgba(75,155,231,0.16)',
    mobileOk: true,
    needVpn: false,
  },
  {
    name: '汽水音乐',
    badge: 'QISHUI',
    desc: '抖音旗下 · 热歌 · 歌单推荐',
    href: 'https://music.douyin.com/',
    brand: '#000000',
    tint: 'rgba(0,0,0,0.12)',
    mobileOk: false,
    needVpn: false,
  },
  {
    name: 'Spotify',
    badge: 'SPOTIFY',
    desc: '全球曲库 · Discover Weekly · 播客',
    href: 'https://open.spotify.com/',
    brand: '#1ED760',
    tint: 'rgba(30,215,96,0.16)',
    mobileOk: true,
    needVpn: true,
  },
  {
    name: 'Apple Music',
    badge: 'APPLE',
    desc: '无损音质 · 杜比全景声 · Radio',
    href: 'https://music.apple.com/',
    brand: '#FA243C',
    tint: 'rgba(250,36,60,0.16)',
    mobileOk: true,
    needVpn: true,
  },
  {
    name: 'YouTube Music',
    badge: 'YT MUSIC',
    desc: 'MV · 现场 · 全球热搜',
    href: 'https://music.youtube.com/',
    brand: '#FF0000',
    tint: 'rgba(255,0,0,0.16)',
    mobileOk: true,
    needVpn: true,
  },
  {
    name: '咪咕音乐',
    badge: 'MIGU',
    desc: '移动旗下 · 世界杯 · 独家版权',
    href: 'https://music.migu.cn/',
    brand: '#FA522C',
    tint: 'rgba(250,82,44,0.16)',
    mobileOk: true,
    needVpn: false,
  },
];

function External() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

/** 探测外网连通性（复用 overseas-links 的 no-cors 探测） */
async function canReachOverseas(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    await fetch(`https://www.youtube.com/favicon.ico?t=${Date.now()}`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default function MusicClient() {
  const [isMobile, setIsMobile] = useState(false);
  const [blockedHref, setBlockedHref] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const onCardClick = async (e: React.MouseEvent<HTMLAnchorElement>, p: Platform) => {
    if (!p.needVpn) return; // 国内平台直接走默认行为
    e.preventDefault();
    setProbing(true);
    try {
      const ok = await canReachOverseas();
      if (!ok) {
        setBlockedHref(p.href);
        return;
      }
      const win = window.open(p.href, '_blank');
      if (win) win.opener = null;
      else setBlockedHref(p.href);
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearch />

      <main className="flex-1 w-full max-w-6xl lg:max-w-7xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-content">音乐</h1>
          <p className="mt-1 text-xs text-faint">
            主流音乐平台网页版快捷入口，点击卡片直接在新窗口打开官方网站。
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MUSIC.map((p) => {
            const showMobileHint = isMobile && !p.mobileOk;
            return (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => void onCardClick(e, p)}
                className="group card p-4 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <span
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-semibold shrink-0"
                    style={{ background: p.tint, color: p.brand }}
                  >
                    {p.name.slice(0, 1)}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {p.needVpn && (
                      <span className="chip bg-warning/15 text-warning text-[10px] !px-1.5 !py-0.5">需外网</span>
                    )}
                    {showMobileHint && (
                      <span className="chip bg-danger/15 text-danger text-[10px] !px-1.5 !py-0.5">手机不适配</span>
                    )}
                    <span className="text-faint opacity-0 group-hover:opacity-100 transition-opacity">
                      <External />
                    </span>
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-content truncate">{p.name}</h2>
                    <span className="text-[10px] tracking-wide text-faint">{p.badge}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{p.desc}</p>
                  {showMobileHint && (
                    <p className="mt-1.5 text-[10px] text-danger/80 leading-relaxed">
                      汽水音乐暂无手机网页版，打开后仅显示桌面版窄条，建议用 App。
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>

        <p className="mt-5 text-[11px] text-faint leading-relaxed">
          说明：各平台网页版需要各自账号登录才能使用完整功能；部分平台的 Web 端曲目可能与 App 端不完全同步。
        </p>
      </main>

      {/* VPN 提示弹窗（复用 overseas-links 的 dialog 风格） */}
      {blockedHref && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={() => setBlockedHref(null)} aria-hidden />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative bg-surface-raised rounded-xl w-full max-w-sm shadow-2xl p-5 animate-slide-up border border-line"
          >
            <h2 className="text-base font-semibold text-content mb-2">无法访问</h2>
            <p className="text-sm text-muted leading-relaxed">抱歉，您没连接外网，无法访问该平台。</p>
            <p className="mt-2 text-xs text-faint leading-relaxed">
              请先连接外网（VPN / 代理）后再访问。已连接外网仍提示失败时，可直接点下方链接在浏览器打开。
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <a href={blockedHref} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm">
                仍然打开
              </a>
              <button type="button" className="btn-primary text-sm" onClick={() => setBlockedHref(null)}>
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
