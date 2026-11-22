'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 国外短视频/平台入口。
 * 这类站点在国内直连环境下不可达：点击时先用 no-cors 探测外网连通性，
 * 探测失败即判定「未连接外网」，弹出提示而不是让用户对着白屏猜。
 * （no-cors 拿不到响应内容，但能区分「连上了」与「网络错误/超时」。）
 */

const PROBE_TIMEOUT_MS = 4500;

async function canReachOverseas(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
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

type OverseasPlatform = {
  name: string;
  badge: string;
  desc: string;
  href: string;
  brand: string;
  tint: string;
};

const PLATFORMS: OverseasPlatform[] = [
  {
    name: 'YouTube',
    badge: 'YOUTUBE',
    desc: 'Shorts 短视频 · 全球创作者',
    href: 'https://www.youtube.com/',
    brand: '#FF0000',
    tint: 'rgba(255,0,0,0.14)',
  },
  {
    name: 'YouTube Shorts',
    badge: 'SHORTS',
    desc: '竖屏短视频专区',
    href: 'https://www.youtube.com/shorts/',
    brand: '#FF0000',
    tint: 'rgba(255,0,0,0.14)',
  },
  {
    name: 'TikTok',
    badge: 'TIKTOK',
    desc: '全球短视频 · For You',
    href: 'https://www.tiktok.com/',
    brand: '#000000',
    tint: 'rgba(0,0,0,0.12)',
  },
  {
    name: 'Instagram Reels',
    badge: 'IG REELS',
    desc: 'Ins 短视频 · 社交',
    href: 'https://www.instagram.com/reels/',
    brand: '#E1306C',
    tint: 'rgba(225,48,108,0.14)',
  },
  {
    name: 'Twitch',
    badge: 'TWITCH',
    desc: '游戏直播 · 电竞',
    href: 'https://www.twitch.tv/',
    brand: '#9146FF',
    tint: 'rgba(145,70,255,0.14)',
  },
  {
    name: 'Vimeo',
    badge: 'VIMEO',
    desc: '专业创作者 · 4K',
    href: 'https://vimeo.com/',
    brand: '#1AB7EA',
    tint: 'rgba(26,183,234,0.14)',
  },
];

function External() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

export function OverseasLinks() {
  const [probing, setProbing] = useState(false);
  const [blockedHref, setBlockedHref] = useState<string | null>(null);
  const [lastHref, setLastHref] = useState('');

  const openHref = useCallback(async (href: string) => {
    setLastHref(href);
    setProbing(true);
    try {
      const ok = await canReachOverseas();
      if (!ok) {
        setBlockedHref(href);
        return;
      }
      const win = window.open(href, '_blank');
      if (win) win.opener = null;
      else setBlockedHref(href);
    } finally {
      setProbing(false);
    }
  }, []);

  // Esc 关闭提示
  useEffect(() => {
    if (!blockedHref) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBlockedHref(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blockedHref]);

  return (
    <>
      {PLATFORMS.map((p) => (
        <button
          key={p.name}
          type="button"
          onClick={() => void openHref(p.href)}
          disabled={probing}
          className="group card p-4 text-left hover:border-accent/50 transition-colors disabled:opacity-70"
        >
          <div className="flex items-start justify-between">
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-semibold"
              style={{ background: p.tint, color: p.brand }}
            >
              {p.name.slice(0, 1)}
            </span>
            <span className="text-[10px] tracking-wide text-faint">
              {p.badge}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-content">{p.name}</h3>
              <span className="chip bg-chip text-faint text-[10px]">需外网</span>
            </div>
            <p className="mt-1 text-xs text-muted leading-relaxed flex items-center gap-1">
              {probing && lastHref === p.href ? '正在检测外网连接…' : p.desc}
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted transition-colors group-hover:text-accent">
            打开
            <External />
          </span>
        </button>
      ))}

      {blockedHref && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 animate-fade-in"
            onClick={() => setBlockedHref(null)}
            aria-hidden
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="无法访问"
            className="relative bg-surface-raised rounded-xl w-full max-w-sm shadow-2xl p-5 animate-slide-up border border-line"
          >
            <h2 className="text-base font-semibold text-content mb-2">无法访问</h2>
            <p className="text-sm text-muted leading-relaxed">
              抱歉，您没连接外网，无法访问该平台。
            </p>
            <p className="mt-2 text-xs text-faint leading-relaxed">
              请先连接外网（VPN / 代理）后再访问。已连接外网仍提示失败时，可直接点下方链接在浏览器打开。
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <a
                href={blockedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-sm"
              >
                仍然打开
              </a>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => setBlockedHref(null)}
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
