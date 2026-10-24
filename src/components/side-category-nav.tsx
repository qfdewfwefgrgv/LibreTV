'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, MORE_ITEMS } from './category-nav';
import { Icon } from './icon';
import { cn } from '@/lib/utils';

/**
 * 电脑端左侧竖排分类菜单。只在 lg（≥1024）出现；平板继续用顶栏横排、手机保持默认布局。
 *
 * 位置：挂在轮播容器内、占据左侧一列（不是浮在海报上）。展开时由父组件
 * 给轮播加左内边距，把画面整体右移，菜单正好落进腾出的空白带——
 * 这样任何时刻都不会压住轮播的高燃画面。
 *
 * 交互：收起时只露出贴在左缘的窄把手；鼠标移上去（或点击把手固定）
 * 整条菜单向右拉出，移开自动收回。
 */
export function SideCategoryNav({ onExpandedChange }: { onExpandedChange?: (expanded: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  // 悬停 / 菜单打开 / 点击把手固定，任一成立都保持拉出态
  const expanded = hovered || open || pinned;

  // 把展开状态交给父组件：父组件据此给轮播让出左侧空白带
  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  const scrollTo = (id: string) => () => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: 'smooth' });
    setTimeout(() => {
      const again = document.getElementById(id);
      if (!again) return;
      const target = again.getBoundingClientRect().top + window.scrollY - 64;
      if (Math.abs(window.scrollY - target) > 60) window.scrollTo({ top: target });
    }, 700);
  };

  const handleClick = (e: React.MouseEvent, href: string) => {
    setOpen(false);
    setPinned(false);
    if (href === '/#library') {
      e.preventDefault();
      if (pathname === '/') {
        scrollTo('library')();
        window.history.replaceState(null, '', '/#library');
      } else {
        router.push('/#library');
        setTimeout(scrollTo('library'), 600);
      }
      return;
    }
    if (href.startsWith('/?cat=')) {
      setTimeout(scrollTo('recommend'), 350);
      setTimeout(() => {
        const el = document.getElementById('recommend');
        if (el && Math.abs(el.getBoundingClientRect().top - 64) > 60) scrollTo('recommend')();
      }, 1000);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 z-30 w-11"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 收起态把手：贴屏幕左缘的窄拉手，点击可固定展开 */}
      <button
        type="button"
        aria-label="展开分类导航"
        aria-expanded={expanded}
        onClick={() => setPinned((v) => !v)}
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 z-10 flex h-24 w-3.5 items-center justify-center',
          'rounded-r-lg border border-l-0 border-line/80 bg-surface/80 backdrop-blur-xl shadow-lg',
          'transition-opacity duration-300',
          expanded ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
      >
        <Icon name="chevronDown" className="w-3 h-3 -rotate-90 text-muted" />
      </button>

      {/* 拉出层：整条菜单连同「更多」面板一起向右滑出 */}
      <div
        className={cn(
          'relative transition-[opacity,transform] duration-300 ease-out',
          expanded ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0 pointer-events-none'
        )}
      >
        <nav
          aria-label="电影分类"
          className="flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-full bg-surface/75 backdrop-blur-xl border border-line/80 shadow-lg"
        >
          {CATEGORIES.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={(e) => handleClick(e, item.href)}
              style={{ writingMode: 'vertical-rl' }}
              className="px-1.5 py-2 rounded-full text-[13px] leading-none text-content/85 hover:text-accent hover:bg-hover transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{ writingMode: 'vertical-rl' }}
            className={cn(
              'px-1.5 py-2 rounded-full text-[13px] leading-none transition-colors',
              open ? 'text-accent bg-hover' : 'text-content/85 hover:text-accent hover:bg-hover'
            )}
          >
            更多
          </button>
        </nav>

        {open && (
          <div
            ref={panelRef}
            role="menu"
            className="absolute left-full top-0 ml-2 w-64 max-h-[70vh] overflow-auto rounded-xl border border-line bg-surface shadow-xl p-3 animate-fade-in"
          >
            <p className="px-1 mb-1 text-[11px] text-faint">影视分类</p>
            <div className="grid grid-cols-3 gap-1">
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  onClick={(e) => handleClick(e, item.href)}
                  className="px-2 py-1.5 rounded-md text-sm text-muted hover:text-accent hover:bg-hover transition-colors truncate"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
