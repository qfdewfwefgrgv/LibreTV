'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icon';
import { cn } from '@/lib/utils';

/**
 * 顶部电影分类菜单。
 * 响应式三档：
 *  - 手机（<768）：整条菜单隐藏，沿用原有「Logo + 图标」默认布局；
 *  - 平板（768~1279）：按容器实际可用宽度计算能放几项，放不下的折叠进「更多」；
 *  - 桌面（≥1280）：宽度足够，显示全部分类，最后固定一个「更多」。
 * 是否裁剪由 ResizeObserver 量出来的真实宽度决定，而不是写死断点，
 * 这样侧边栏/字体缩放等造成的宽度变化也能自适应。
 */

export const CATEGORIES = [
  { label: '电影', href: '/?cat=movie&tag=热门' },
  { label: '剧集', href: '/?cat=tv&tag=热门' },
  { label: '综艺', href: '/?cat=tv&tag=综艺' },
  { label: '动漫', href: '/?cat=tv&tag=日本动画' },
  { label: '纪录片', href: '/?cat=tv&tag=纪录片' },
  { label: '我的影库', href: '/#library' },
  { label: '直播', href: '/live' },
];

export const MORE_ITEMS = [
  { label: '最新电影', href: '/?cat=movie&tag=最新' },
  { label: '豆瓣高分', href: '/?cat=movie&tag=豆瓣高分' },
  { label: '经典电影', href: '/?cat=movie&tag=经典' },
  { label: '冷门佳片', href: '/?cat=movie&tag=冷门佳片' },
  { label: '华语电影', href: '/?cat=movie&tag=华语' },
  { label: '欧美电影', href: '/?cat=movie&tag=欧美' },
  { label: '韩国电影', href: '/?cat=movie&tag=韩国' },
  { label: '日本电影', href: '/?cat=movie&tag=日本' },
  { label: '动画电影', href: '/?cat=movie&tag=动画' },
  { label: '美剧', href: '/?cat=tv&tag=美剧' },
  { label: '英剧', href: '/?cat=tv&tag=英剧' },
  { label: '韩剧', href: '/?cat=tv&tag=韩剧' },
  { label: '日剧', href: '/?cat=tv&tag=日剧' },
  { label: '国产剧', href: '/?cat=tv&tag=国产剧' },
  { label: '港剧', href: '/?cat=tv&tag=港剧' },
  { label: '关于本站', href: '/about' },
];

/** 单项宽度估算（含左右内边距与间距），用于按像素宽度算能放几项 */
const ITEM_WIDTH = 72;
/** 「更多」按钮宽度估算 */
const MORE_WIDTH = 82;

export function CategoryNav() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(CATEGORIES.length);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // 「我的影库」是页内锚点；分类项点击后主动滚到推荐区。
  // 不能只依赖首页的 effect：同页点击只改 query，Next 不会重新挂载页面，
  // 而且导航结束后它会把滚动位置重置回顶部，所以这里延时滚动并做一次校正。
  const scrollTo = (id: string) => () => {
    const el = document.getElementById(id);
    if (!el) return;
    // 直接算绝对位置滚 window：比 scrollIntoView 更可控（sticky 头高 56px，留 8px 余量）
    const top = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: 'smooth' });
    // 兜底：平滑滚动可能被导航的「滚回顶部」打断或禁用，补一次瞬时滚动
    setTimeout(() => {
      const again = document.getElementById(id);
      if (!again) return;
      const target = again.getBoundingClientRect().top + window.scrollY - 64;
      if (Math.abs(window.scrollY - target) > 60) window.scrollTo({ top: target });
    }, 700);
  };
  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (href === '/#library') {
      e.preventDefault();
      if (pathname === '/') {
        scrollTo('library')();
        setTimeout(scrollTo('library'), 350);
        window.history.replaceState(null, '', '/#library');
      } else {
        router.push('/#library');
        setTimeout(scrollTo('library'), 600);
      }
      return;
    }
    if (href.startsWith('/?cat=')) {
      // 延时等推荐区渲染，1 秒后再校正一次（避免被 Next 的滚回顶部覆盖）
      setTimeout(scrollTo('recommend'), 350);
      setTimeout(() => {
        const el = document.getElementById('recommend');
        if (el && Math.abs(el.getBoundingClientRect().top - 64) > 60) scrollTo('recommend')();
      }, 1000);
    }
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const calc = () => {
      // 始终给「更多」留位置：即使全部放得下，也保留这个入口
      const fit = Math.floor((el.clientWidth - MORE_WIDTH) / ITEM_WIDTH);
      setVisibleCount(Math.max(1, Math.min(CATEGORIES.length, fit)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
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

  const shown = CATEGORIES.slice(0, visibleCount);
  const overflow = CATEGORIES.slice(visibleCount);
  const moreGroups = [
    { title: '更多分类', items: overflow },
    { title: '影视标签', items: MORE_ITEMS },
  ].filter((g) => g.items.length > 0);

  return (
    <div ref={wrapRef} className="hidden md:flex lg:hidden items-center min-w-0 flex-1">
      <nav aria-label="电影分类" className="flex items-center gap-0.5 min-w-0">
        {shown.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={(e) => handleNavClick(e, item.href)}
            className="px-2.5 py-1.5 rounded-md text-sm text-muted hover:text-accent hover:bg-hover transition-colors whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          className={cn(
            'flex items-center gap-0.5 px-2.5 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap',
            open ? 'text-accent bg-hover' : 'text-muted hover:text-accent hover:bg-hover'
          )}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          更多
          <Icon name="chevronDown" className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 top-full mt-1.5 w-[22rem] max-w-[80vw] rounded-xl border border-line bg-surface shadow-xl p-3 z-50 animate-fade-in"
          >
            {moreGroups.map((group) => (
              <div key={group.title} className="mb-2 last:mb-0">
                <p className="px-1 mb-1 text-[11px] text-faint">{group.title}</p>
                <div className="grid grid-cols-3 gap-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="px-2 py-1.5 rounded-md text-sm text-muted hover:text-accent hover:bg-hover transition-colors truncate"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
