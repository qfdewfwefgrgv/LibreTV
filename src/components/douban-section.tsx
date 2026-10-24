'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { DoubanItem, SearchResultItem } from '@/lib/types';
import { DoubanCard } from './video-card';

const MOVIE_TAGS = ['热门', '最新', '经典', '豆瓣高分', '冷门佳片', '华语', '欧美', '韩国', '日本', '动画'];
const TV_TAGS = ['热门', '美剧', '英剧', '韩剧', '日剧', '国产剧', '港剧', '日本动画', '综艺', '纪录片'];
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 首页「我的影库」：展示 .env 里配置的本地点播源（LOCAL_LIBRARY_URL）的全部条目。
 * 点击卡片直接打开详情弹窗，可播放 / 选集，与搜索结果里的交互一致。
 */
export function LocalLibraryRow({ onOpen }: { onOpen: (item: SearchResultItem) => void }) {
  const query = useQuery({
    queryKey: ['local-list'],
    queryFn: () => api.localList(),
    staleTime: 30_000,
  });
  const items = query.data?.list ?? [];
  const unrecognized = query.data?.unrecognized ?? [];
  // 有未识别文件时也要渲染这一块：否则「目录里全是认不出的格式」时整块消失，
  // 又变回「什么都看不到、也没有任何提示」的静默状态
  if (items.length === 0 && unrecognized.length === 0) return null;

  return (
    <section id="library" aria-label="我的影库" className="mb-8 scroll-mt-20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-heading text-content">我的影库 · 本地文件</h2>
        <span className="chip bg-chip text-muted">{items.length} 个</span>
      </div>
      {unrecognized.length > 0 && (
        <p className="text-xs text-faint mb-3">另有 {unrecognized.length} 个文件未识别（扩展名不是视频格式）：{unrecognized.join('、')}</p>
      )}
      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {items.map((it, i) => (
            // 外层只负责入场错峰：动画的 fill 模式会锁住 transform，
            // 挂在卡片本身会让 .poster:hover 的上浮失效
            <div key={`${it.sourceKey}-${it.vodId}`} className="anim-rise" style={{ animationDelay: `${Math.min(i, 16) * 35}ms` }}>
              <DoubanCard
                item={{
                  title: it.name,
                  cover: it.pic || '',
                  kind: it.typeName,
                  year: it.year,
                  area: it.area,
                  tags: it.tags,
                  summary: it.content?.trim() || [it.year, it.area, it.remarks].filter(Boolean).join(' · '),
                }}
                onClick={() => onOpen(it)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** 首页推荐区：数据源由设置决定（豆瓣热门 / Bangumi 新番放送 / 影视热榜），二选一展示 */
export function RecommendSection({
  onPick,
  initialType,
  initialTag,
}: {
  onPick: (title: string) => void;
  /** 顶部分类菜单传进来的初始分类（电影/剧集） */
  initialType?: 'movie' | 'tv';
  /** 顶部分类菜单传进来的初始标签（热门/综艺/纪录片…） */
  initialTag?: string;
}) {
  const doubanEnabled = useAppStore((s) => s.doubanEnabled);
  const recommendSource = useAppStore((s) => s.recommendSource);

  // 顶部分类菜单明确指定了电影/剧集或标签时，一律走豆瓣分类视图：
  // 热榜、Bangumi 新番都不支持按标签筛选，落到它们身上点了等于没反应
  if (initialType || initialTag) return <DoubanView onPick={onPick} initialType={initialType} initialTag={initialTag} />;

  if (!doubanEnabled) return null;
  if (recommendSource === 'bangumi') return <BangumiView onPick={onPick} />;
  if (recommendSource === 'hot-list') return <HotListView onPick={onPick} />;
  return <DoubanView onPick={onPick} />;
}

/**
 * 豆瓣推荐：影视切换 + 标签筛选。
 * 一次性渲染全部条目：数据本就一次拉全（50 条），卡片图片又是 lazy 加载，
 * 视口外的图不会请求，因此不需要「加载更多」这类本地切片分页来打断浏览。
 */
function DoubanView({
  onPick,
  initialType,
  initialTag,
}: {
  onPick: (title: string) => void;
  initialType?: 'movie' | 'tv';
  initialTag?: string;
}) {
  const [type, setType] = useState<'movie' | 'tv'>(initialType ?? 'movie');
  const [tag, setTag] = useState(initialTag ?? '热门');

  // 顶部分类菜单跳转后 URL 参数变化：同步切换推荐分类
  useEffect(() => {
    if (initialType) setType(initialType);
    if (initialTag) setTag(initialTag);
  }, [initialType, initialTag]);

  const tags = type === 'movie' ? MOVIE_TAGS : TV_TAGS;
  // URL 带来的标签若不属于当前分类，回落到该分类的「热门」
  const activeTag = tags.includes(tag) ? tag : '热门';

  const query = useQuery({
    queryKey: ['douban', type, activeTag],
    queryFn: ({ signal }) => api.douban(type, activeTag, 0, 50, signal),
  });

  const items = query.data?.items ?? [];

  const switchType = (t: 'movie' | 'tv') => {
    if (t === type) return;
    setType(t);
    setTag('热门');
  };

  return (
    <section id="recommend" aria-label="影视推荐" className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-heading text-content">影视推荐</h2>
        <div className="flex bg-chip rounded-lg p-0.5">
          <TypeButton active={type === 'movie'} onClick={() => switchType('movie')}>
            电影
          </TypeButton>
          <TypeButton active={type === 'tv'} onClick={() => switchType('tv')}>
            剧集
          </TypeButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {tags.map((t) => (
          <button
            key={t}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs transition-colors',
              t === activeTag ? 'chip-active' : 'bg-chip text-muted hover:text-content hover:bg-hover'
            )}
            onClick={() => setTag(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTag === '综艺' && <ShowShortcuts onPick={onPick} />}

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-faint py-8">该分类暂无推荐内容</p>
      ) : (
        <PosterGrid items={items} onPick={onPick} />
      )}
    </section>
  );
}

/** Bangumi 每日放送：星期筛选，一次拉全量无分页 */
function BangumiView({ onPick }: { onPick: (title: string) => void }) {
  const [weekday, setWeekday] = useState<number | 'all'>('all');

  const query = useQuery({
    queryKey: ['bangumi-calendar'],
    queryFn: ({ signal }) => api.bangumiCalendar(signal),
  });

  let items: DoubanItem[] = [];
  if (query.data) {
    items = weekday === 'all'
      ? query.data.days.flatMap((d) => d.items)
      : (query.data.days.find((d) => d.weekday === weekday)?.items ?? []);
  }

  return (
    <section id="recommend" aria-label="新番放送推荐" className="scroll-mt-20">
      <div className="flex flex-wrap gap-1.5 mb-4">
        <ChipButton active={weekday === 'all'} onClick={() => setWeekday('all')}>
          全部
        </ChipButton>
        {WEEKDAYS.map((name, i) => (
          <ChipButton key={name} active={weekday === i + 1} onClick={() => setWeekday(i + 1)}>
            {name}
          </ChipButton>
        ))}
      </div>

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : (
        <PosterGrid items={items} onPick={onPick} />
      )}
    </section>
  );
}

const HOT_LISTS = [
  { id: 'douban_movie_weekly', label: '电影周榜' },
  { id: 'douban_tv_chinese', label: '国产剧周榜' },
  { id: 'douban_tv_global', label: '海外剧周榜' },
  { id: 'douban_show_chinese', label: '国内综艺' },
  { id: 'douban_show_global', label: '海外综艺' },
  { id: 'baidu_teleplay', label: '百度热播剧' },
];

/** 「国内综艺」下的常驻热门节目入口：点击直接用片名去各点播源搜索 */
const CHINESE_SHOW_SHORTCUTS = ['奔跑吧', '哈哈哈哈哈', '大侦探', '快乐大本营', '王牌对王牌'];

function ShowShortcuts({ onPick }: { onPick: (title: string) => void }) {
  return (
    <div className="mb-4 rounded-xl border border-line bg-surface/70 p-3">
      <p className="mb-2 text-xs text-faint">热门综艺 · 点击直接搜索片源</p>
      <div className="flex flex-wrap gap-1.5">
        {CHINESE_SHOW_SHORTCUTS.map((name) => (
          <button key={name} type="button" className="btn-ghost btn-sm" onClick={() => onPick(name)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 影视热榜（60s API）：豆瓣五个周榜 + 百度热播剧，chips 切换 */
function HotListView({ onPick }: { onPick: (title: string) => void }) {
  const [listId, setListId] = useState(HOT_LISTS[0].id);

  const query = useQuery({
    queryKey: ['hot-list', listId],
    queryFn: ({ signal }) => api.hotList(listId, signal),
  });

  const items = query.data?.items ?? [];

  return (
    <section id="recommend" aria-label="影视榜单推荐" className="scroll-mt-20">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {HOT_LISTS.map((l) => (
          <ChipButton key={l.id} active={listId === l.id} onClick={() => setListId(l.id)}>
            {l.label}
          </ChipButton>
        ))}
      </div>

      {listId === 'douban_show_chinese' && <ShowShortcuts onPick={onPick} />}

      {query.isError ? (
        <p className="text-center text-sm text-faint py-8">推荐内容加载失败，可稍后重试或在设置中关闭</p>
      ) : query.isLoading ? (
        <GridSkeleton />
      ) : (
        <PosterGrid items={items} onPick={onPick} />
      )}
    </section>
  );
}

/** 海报墙：8 列栅格 + 逐张错峰入场（影库之外的三种推荐视图共用同一套） */
function PosterGrid({ items, onPick }: { items: DoubanItem[]; onPick: (title: string) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
      {items.map((item, i) => (
        // 外层只负责入场错峰：动画 fill 模式会锁住 transform，挂在卡片上会让悬停上浮失效
        <div key={item.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 16) * 35}ms` }}>
          <DoubanCard item={{ ...item, kind: item.isTv ? '剧集' : '电影' }} onClick={() => onPick(item.title)} />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] rounded-lg skeleton" />
          <div className="h-3 mt-2 rounded skeleton" />
        </div>
      ))}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={cn(
        'px-2.5 py-1 rounded-full text-xs transition-colors',
        active ? 'chip-active' : 'bg-chip text-muted hover:text-content hover:bg-hover'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TypeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={cn('px-3.5 py-1.5 rounded-md text-sm transition-colors', active ? 'bg-accent text-on-accent' : 'text-muted hover:text-content')}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
