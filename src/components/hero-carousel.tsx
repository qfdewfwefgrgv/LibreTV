'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { SmartImage } from './smart-image';

/** 轮播项：封面 + 少量元信息 + 点击行为。数据由首页组装（本地影库优先，空则用豆瓣热门兜底） */
export interface HeroItem {
  key: string;
  title: string;
  cover?: string;
  year?: string;
  typeName?: string;
  area?: string;
  rating?: string;
  summary?: string;
  /**
   * 可选：背景视频（同源的自动剪辑高潮片段）。有就用它当 banner 背景自动播放，
   * 没有或加载失败就退回静图封面 —— 不依赖服务端返回「有没有片段」的元信息。
   */
  heroClip?: string;
  /** 主按钮文案，默认「立即查看」 */
  ctaLabel?: string;
  onSelect: () => void;
}

/** 自动切换间隔（ms），同时就是底部进度条走完一圈的时间 */
const AUTOPLAY_MS = 6000;

/**
 * 首页顶部大轮播：自动播放 + 鼠标悬停暂停 + 左右箭头 + 圆点 + 进度条。
 * 每张图常驻 DOM 只切 opacity（交叉淡入），切回来时图已在缓存里，不会闪白；
 * 当前帧叠一层缓慢推镜（Ken Burns），静态海报也能看出「在动」。
 */
export function HeroCarousel({ items }: { items: HeroItem[] }) {
  const imageProxyMode = useAppStore((s) => s.imageProxyMode);
  const customImageProxy = useAppStore((s) => s.customImageProxy);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  // 背景视频加载失败（比如这条片子没剪片段）→ 该条退回静图
  const [clipFailed, setClipFailed] = useState<Record<string, boolean>>({});
  // 系统开了「减少动态效果」就不放背景视频：这类用户的诉求就是别自己动
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const count = items.length;
  // 依赖 key 串而不是数组引用：首页每次重渲染都会重建 items 数组，
  // 若直接依赖 items，轮播会被一直按回第一张
  const signature = useMemo(() => items.map((i) => i.key).join('|'), [items]);

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  // 数据真的换了（切推荐源 / 影库刷新）才回到第一张
  useEffect(() => setIndex(0), [signature]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    // 系统开了「减少动态效果」就不自动播放：这类用户的诉求就是别自己动
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, signature]);

  if (count === 0) return null;
  const active = items[index] ?? items[0];

  return (
    <section
      aria-label="精选推荐"
      aria-roledescription="轮播"
      className="hero-shell mb-8 h-[240px] sm:h-[330px] lg:h-[460px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(index - 1);
        if (e.key === 'ArrowRight') go(index + 1);
      }}
    >
      {items.map((item, i) => {
        const isActive = i === index;
        // 只在「当前这张」挂 video：6 张一起挂会把带宽吃光（云端出口只有 3Mbps）
        const clipOk = Boolean(item.heroClip) && !clipFailed[item.key] && !reduceMotion;
        return (
          <div
            key={item.key}
            aria-hidden={!isActive}
            className={cn(
              'absolute inset-0 transition-opacity duration-700',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
          >
            {/* 静图始终铺在底下：既当视频的首帧占位，也是视频失败/未加载时的兜底 */}
            {item.cover && !failed[item.key] ? (
              <SmartImage
                url={item.cover}
                mode={imageProxyMode}
                customProxy={customImageProxy}
                alt={item.title}
                className={cn('h-full w-full object-cover', isActive && !clipOk && 'anim-kenburns')}
                onExhausted={() => setFailed((prev) => ({ ...prev, [item.key]: true }))}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-accent/25 via-card to-accent2/25" />
            )}

            {isActive && clipOk && (
              <video
                key={item.heroClip}
                className="absolute inset-0 h-full w-full object-cover"
                src={item.heroClip}
                poster={item.cover}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onError={() => setClipFailed((prev) => ({ ...prev, [item.key]: true }))}
                ref={(el) => {
                  if (!el) return;
                  // React 对 muted 只写属性、不保证写 DOM property，自动播放会因此被拦；
                  // 这里显式兜一手（静音自动播放是浏览器允许的）
                  el.muted = true;
                  void el.play().catch(() => {});
                }}
              />
            )}
          </div>
        );
      })}

      <div className="hero-scrim pointer-events-none absolute inset-0" />

      {/* 文案跟着图片一起淡入：图片是 0.7s 交叉淡入、标题却是瞬时切换的，
          不这样做就会有一瞬间「新标题压着旧图」，看起来像配错了封面 */}
      <div key={index} className="anim-rise absolute inset-x-0 bottom-0 p-4 sm:p-7">
        <div className="max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {active.typeName && (
              <span className="tag bg-accent/20 font-medium text-accent backdrop-blur">{active.typeName}</span>
            )}
            {active.year && <span className="tag bg-black/40 text-white/80 backdrop-blur">{active.year}</span>}
            {active.area && <span className="tag bg-black/40 text-white/80 backdrop-blur">{active.area}</span>}
            {active.rating && (
              <span className="tag bg-black/45 font-medium text-accent2 backdrop-blur">★ {active.rating}</span>
            )}
          </div>
          <h2 className="line-clamp-1 text-xl font-bold text-white drop-shadow sm:text-3xl" title={active.title}>
            {active.title}
          </h2>
          {active.summary && (
            <p className="line-clamp-2 mt-2 max-w-xl text-sm leading-relaxed text-white/70">{active.summary}</p>
          )}
          <button className="btn-primary mt-4 px-4 py-2 text-sm font-medium shadow-lg" onClick={active.onSelect}>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            {active.ctaLabel ?? '立即查看'}
          </button>
        </div>
      </div>

      {count > 1 && (
        <>
          <button className="hero-arrow left-3" aria-label="上一张" onClick={() => go(index - 1)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button className="hero-arrow right-3" aria-label="下一张" onClick={() => go(index + 1)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* 电脑端右下角竖版缩略图条：模仿影视站的海报预览，点击直接切到那一张 */}
          <div className="absolute bottom-4 right-4 z-10 hidden lg:flex items-end gap-2">
            {items.slice(0, 4).map((it, i) => (
              <button
                key={it.key}
                onClick={() => go(i)}
                aria-label={`切换到 ${it.title}`}
                aria-current={i === index}
                className={cn(
                  'relative w-16 h-24 rounded-lg overflow-hidden border transition-all duration-200 bg-card',
                  i === index
                    ? 'border-accent ring-2 ring-accent/50 scale-105'
                    : 'border-white/40 opacity-75 hover:opacity-100'
                )}
              >
                {it.cover ? (
                  <SmartImage
                    url={it.cover}
                    mode={imageProxyMode}
                    customProxy={customImageProxy}
                    alt={it.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-accent/30 to-accent2/30" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1 py-0.5 text-[10px] leading-tight text-white truncate">
                  {it.title}
                </span>
              </button>
            ))}
          </div>

          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 sm:bottom-6 sm:right-6 lg:hidden">
            {items.map((item, i) => (
              <button
                key={item.key}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-6 bg-accent' : 'w-1.5 bg-white/40 hover:bg-white/70'
                )}
                aria-label={`第 ${i + 1} 张：${item.title}`}
                aria-current={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>

          {/* 暂停时不渲染进度条：恢复播放后 key 未变，但组件重挂载会从 0 重新计时，
              与 interval 的重启时机一致 */}
          {!paused && (
            <div key={index} className="hero-progress" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
          )}
        </>
      )}
    </section>
  );
}
