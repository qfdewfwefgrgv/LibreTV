'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from './theme';
import { SourceManagerDrawer } from './source-manager';
import { HistoryPanel } from './history-panel';
import { requestShowDownloadManager } from './download-manager';
import { Icon } from './icon';
import { SearchHistoryDropdown, useSearchHistory } from './search-history';
import { CategoryNav } from './category-nav';
import { UserMenu } from './user-menu';
import { WallpaperMenu } from './wallpaper';
import { useAuth } from './auth';
import { cn } from '@/lib/utils';
import { useToast } from './toast';

/** 顶部导航：Logo、分类菜单、搜索框（首页外）、历史、设置 */
export function Header({ showSearch = false }: { showSearch?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { verified, openLogin } = useAuth();
  const { toast } = useToast();
  /** 刷新动效：Logo 旋转中 */
  const [logoSpinning, setLogoSpinning] = useState(false);

  const handleRefresh = useCallback(() => {
    setLogoSpinning(true);
    toast('已刷新', 'success', { duration: 1400 });
    router.refresh();
    // Next.js 同路径 push 会跳过，加时间戳强制重建页面骨架
    const sep = pathname.includes('?') ? '&' : '?';
    router.push(`${pathname}${sep}_=${Date.now()}`, { scroll: false });
    setTimeout(() => setLogoSpinning(false), 1200);
  }, [router, pathname, toast]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** 小屏「更多」菜单：短视频 / 平台直播 / 频道直播 / 关于 */
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  // 与首页搜索框共用同一套「最近搜索」下拉逻辑
  const searchHistory = useSearchHistory(query);

  const submitSearch = (text: string) => {
    const q = text.trim().slice(0, 100);
    if (!q) return;
    searchHistory.close();
    router.push(`/?s=${encodeURIComponent(q)}`, { scroll: false });
    // 顶栏搜索一并写入最近搜索（此前只有首页会记录）
    searchHistory.record(q);
  };

  const pickHistory = (text: string) => {
    setQuery(text);
    submitSearch(text);
  };

  // 小屏「更多」菜单：点击外部 / Esc 收起，路由变化也收起
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  return (
    <>
      <header className="glass sticky top-0 z-40 border-b">
        <div className="max-w-6xl lg:max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="刷新页面（点击 Logo）"
            title="刷新页面"
            className="flex items-center shrink-0 rounded-lg p-0.5 hover:bg-hover transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-512.png"
              alt="LibreTV"
              className={cn(
                'w-7 h-7 rounded-lg transition-transform',
                logoSpinning ? 'animate-[spin_0.9s_ease-in-out]' : 'hover:scale-105'
              )}
            />
          </button>

          <IconButton label="刷新页面" onClick={handleRefresh}>
            <Icon name="refresh" className={cn('w-5 h-5', logoSpinning && 'animate-spin')} />
          </IconButton>

          {/* 壁纸切换：紧挨 Logo 右侧，下拉里按 动态/美女/风景/漫画/现实景观/纯色/自定义 分组 */}
          <WallpaperMenu />

          {/* 分类菜单：手机隐藏、平板按宽度裁剪（电脑端改用左侧竖排，见 side-category-nav.tsx） */}
          <CategoryNav />

          {showSearch && (
            <form
              className="hidden md:block shrink-0 w-44 lg:w-auto lg:flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch(query);
              }}
            >
              <div ref={searchHistory.containerRef} className="relative w-full lg:max-w-xl lg:mx-auto">
                <input
                  className={cn(
                    'input w-full h-9',
                    // 展开时：上圆角与外框沿用聚焦样式，底边改为内部分隔线，与下拉拼成同一面板
                    searchHistory.visible &&
                      'rounded-b-none border-accent border-b-line bg-surface-raised focus-visible:ring-0'
                  )}
                  aria-label="搜索影片"
                  placeholder="搜索影片..."
                  value={query}
                  maxLength={100}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    searchHistory.resetActive();
                  }}
                  onFocus={searchHistory.onFocus}
                  onKeyDown={(e) => searchHistory.onKeyDown(e, pickHistory)}
                  role="combobox"
                  aria-expanded={searchHistory.visible}
                  aria-controls="header-search-history"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    searchHistory.visible && searchHistory.activeIndex >= 0
                      ? `header-search-history-${searchHistory.activeIndex}`
                      : undefined
                  }
                />
                {searchHistory.visible && (
                  <SearchHistoryDropdown
                    id="header-search-history"
                    matches={searchHistory.matches}
                    activeIndex={searchHistory.activeIndex}
                    onPick={pickHistory}
                    onRemove={searchHistory.remove}
                    onClearAll={searchHistory.clearAll}
                  />
                )}
              </div>
            </form>
          )}

          <div className="flex-1 sm:hidden" />

          <nav className="flex items-center gap-1 ml-auto">
            <HeaderLink href="/space" active={pathname === '/space'} className="hidden sm:inline-flex">
              探索宇宙
            </HeaderLink>
            <HeaderLink href="/live" active={pathname === '/live'}>
              直播
            </HeaderLink>
            <HeaderLink href="/game" active={pathname === '/game'} className="hidden sm:inline-flex" reload>
              游戏
            </HeaderLink>
            <HeaderLink href="/comic" active={pathname === '/comic'} className="hidden sm:inline-flex">
              漫画
            </HeaderLink>
            <HeaderLink href="/github" active={pathname === '/github'} className="hidden sm:inline-flex">
              GitHub
            </HeaderLink>
            {/* 小屏空间紧张：这两项与「关于」收进「更多」菜单，平板起直接平铺 */}
            <HeaderLink href="/short" active={pathname === '/short'} className="hidden sm:inline-flex">
              短视频
            </HeaderLink>
            <HeaderLink href="/platform-live" active={pathname === '/platform-live'} className="hidden sm:inline-flex">
              平台直播
            </HeaderLink>
            <HeaderLink href="/about" active={pathname === '/about'} className="hidden sm:inline-flex">
              关于
            </HeaderLink>
            <div ref={moreRef} className="relative sm:hidden">
              <IconButton label="更多导航" onClick={() => setMoreOpen((v) => !v)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </IconButton>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-line bg-surface shadow-xl p-1 z-50 animate-fade-in">
                  {[
                    { href: '/space', label: '探索宇宙' },
                    { href: '/game', label: '游戏中心' },
                    { href: '/comic', label: '漫画' },
                    { href: '/github', label: 'GitHub 榜单' },
                    { href: '/short', label: '短视频' },
                    { href: '/platform-live', label: '平台直播' },
                    { href: '/live', label: '频道直播' },
                    { href: '/about', label: '关于' },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => {
                        setMoreOpen(false);
                        // 游戏页依赖动态加载的 chunk，站内跳转在产物缺失时会整页报错；
                        // 这里强制整页导航，让服务端直出游戏列表，避免客户端路由加载失败。
                        if (item.href === '/game') {
                          e.preventDefault();
                          window.location.href = '/game';
                        }
                      }}
                      className={cn(
                        'block px-2.5 py-2 rounded-md text-sm transition-colors',
                        pathname === item.href
                          ? 'text-content bg-hover'
                          : 'text-muted hover:text-content hover:bg-hover'
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <ThemeToggle />
            <IconButton label="观看历史" onClick={() => setHistoryOpen(true)}>
              <Icon name="clock" />
            </IconButton>
            <IconButton
              label="下载管理"
              onClick={() => {
                if (!verified) {
                  openLogin();
                  return;
                }
                requestShowDownloadManager();
              }}
            >
              <Icon name="download" />
            </IconButton>
            <IconButton label="设置" onClick={() => setSettingsOpen(true)}>
              <Icon name="gear" />
            </IconButton>
            <UserMenu />
          </nav>
        </div>
      </header>

      <SourceManagerDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
}

function HeaderLink({
  href,
  active,
  children,
  className,
  reload = false,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
  /** 强制整页导航：用于依赖较多动态 chunk 的页面，避免客户端路由加载失败 */
  reload?: boolean;
}) {
  const classes = cn(
    'px-2.5 py-1.5 rounded-md text-sm transition-colors',
    active ? 'text-content bg-hover' : 'text-muted hover:text-content',
    className
  );

  if (reload) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="p-2 rounded-md text-muted hover:text-content hover:bg-hover transition-colors"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
