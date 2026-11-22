'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MOVIE_TAGS, TV_TAGS } from './douban-section';

/**
 * 左侧类型栏（参考传统影视站布局）：
 * - 桌面（≥1024）：sticky 常驻在内容左侧，列全「电影 + 剧集」所有类型；
 *   点类型 → 右侧推荐区立刻换成该类型的影片网格（URL ?cat=&tag= 驱动，可分享/后退）。
 * - 平板 / 手机：顶部横向可滑动的类型胶囊条。
 * - 不点任何类型时，首屏就是「热门推荐」（hero 轮播 + 影库 + 榜单）。
 */

type MediaType = 'movie' | 'tv';

function useTypeNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cat = searchParams.get('cat');
  const tag = searchParams.get('tag');

  const isActive = (type: MediaType, t: string) =>
    cat === type && (tag ?? '热门') === t;

  const goType = (type: MediaType, t: string) => {
    router.push(`/?cat=${type}&tag=${encodeURIComponent(t)}`, { scroll: false });
    // 等推荐区渲染完再滚过去（与 page.tsx 的校正逻辑互补）
    setTimeout(() => {
      const el = document.getElementById('recommend');
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 300);
  };

  const goHome = () => {
    router.push('/', { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { cat, tag, isActive, goType, goHome };
}

const typeBtnCls = (active: boolean) =>
  cn(
    'block w-full text-left rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors cursor-pointer',
    active
      ? 'bg-accent/15 text-accent font-medium'
      : 'text-muted hover:bg-hover hover:text-content'
  );

function TypeGroup({
  title,
  type,
  tags,
  isActive,
  onPick,
}: {
  title: string;
  type: MediaType;
  tags: string[];
  isActive: (type: MediaType, t: string) => boolean;
  onPick: (type: MediaType, t: string) => void;
}) {
  return (
    <div>
      <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-faint">{title}</div>
      {tags.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onPick(type, t)}
          className={typeBtnCls(isActive(type, t))}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

const EXTRA_LINKS = [
  { label: '最新上架', href: '/#library' },
  { label: '直播', href: '/live' },
  { label: '短视频', href: '/short' },
  { label: '漫画', href: '/comic' },
  { label: '游戏中心', href: '/game' },
];

/** 桌面常驻左栏（sticky，随页面滚动一直可见） */
export function SideCategoryNav() {
  const { cat, tag, isActive, goType, goHome } = useTypeNav();
  const homeActive = !cat && !tag;

  return (
    <aside
      className="hidden lg:block w-[136px] shrink-0 sticky top-16 self-start max-h-[calc(100vh-5.5rem)] overflow-y-auto no-scrollbar rounded-xl border border-line bg-surface/80 backdrop-blur-sm p-1.5"
      aria-label="类型导航"
    >
      <button
        type="button"
        onClick={goHome}
        className={typeBtnCls(homeActive)}
      >
        🔥 热门推荐
      </button>

      <div className="my-1.5 h-px bg-line" />

      <TypeGroup title="电影" type="movie" tags={MOVIE_TAGS} isActive={isActive} onPick={goType} />

      <div className="my-1.5 h-px bg-line" />

      <TypeGroup title="剧集" type="tv" tags={TV_TAGS} isActive={isActive} onPick={goType} />

      <div className="my-1.5 h-px bg-line" />

      {EXTRA_LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="block rounded-md px-2.5 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-hover hover:text-content"
        >
          {l.label}
        </Link>
      ))}
    </aside>
  );
}

/** 平板 / 手机横向类型胶囊条（全部类型平铺，可左右滑） */
export function CategoryChips({ className }: { className?: string }) {
  const { cat, tag, isActive, goType, goHome } = useTypeNav();
  const homeActive = !cat && !tag;

  const chipCls = (active: boolean) =>
    cn(
      'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
      active
        ? 'border-accent/60 bg-accent/10 text-accent font-medium'
        : 'border-line bg-chip text-muted hover:border-accent/60 hover:text-content'
    );

  return (
    <nav
      aria-label="类型导航"
      className={cn('lg:hidden -mx-4 px-4 mb-4 overflow-x-auto no-scrollbar', className)}
    >
      <div className="flex gap-2">
        <button type="button" onClick={goHome} className={chipCls(homeActive)}>
          🔥 热门推荐
        </button>
        {MOVIE_TAGS.map((t) => (
          <button key={`m-${t}`} type="button" onClick={() => goType('movie', t)} className={chipCls(isActive('movie', t))}>
            {t}
          </button>
        ))}
        {TV_TAGS.map((t) => (
          <button key={`t-${t}`} type="button" onClick={() => goType('tv', t)} className={chipCls(isActive('tv', t))}>
            {t}
          </button>
        ))}
      </div>
    </nav>
  );
}
