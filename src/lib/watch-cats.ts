'use client';

/**
 * 观看偏好记录（浏览器本地）：
 * 用户每播放一部片，就给它所属分类 +1；首页「猜你喜欢」取票数最高的分类，
 * 去豆瓣拉同类内容推荐。数据只存在 localStorage，不上传服务端。
 */

export type CategoryKey = 'movie' | 'tv' | 'anime' | 'variety' | 'doc';

export interface CategoryTarget {
  key: CategoryKey;
  /** 豆瓣接口的分类维度 */
  type: 'movie' | 'tv';
  /** 豆瓣标签 */
  tag: string;
  /** 展示名 */
  label: string;
}

export const CATEGORY_TARGETS: Record<CategoryKey, CategoryTarget> = {
  movie: { key: 'movie', type: 'movie', tag: '热门', label: '电影' },
  tv: { key: 'tv', type: 'tv', tag: '热门', label: '剧集' },
  anime: { key: 'anime', type: 'tv', tag: '日本动画', label: '动漫' },
  variety: { key: 'variety', type: 'tv', tag: '综艺', label: '综艺' },
  doc: { key: 'doc', type: 'tv', tag: '纪录片', label: '纪录片' },
};

const STATS_KEY = 'libretv-cat-stats';

/** 从片名/类型名推断分类（采集站的 typeName 五花八门，用关键词兜底） */
export function categoryFromText(typeName?: string, name?: string): CategoryKey | null {
  const text = `${typeName ?? ''} ${name ?? ''}`;
  if (/(动漫|动画|番剧|日漫|国漫|新番)/.test(text)) return 'anime';
  if (/(综艺|真人秀|脱口秀|访谈)/.test(text)) return 'variety';
  if (/(纪录)/.test(text)) return 'doc';
  if (/(连续剧|电视剧|美剧|韩剧|日剧|港剧|英剧|剧集|短剧)/.test(text)) return 'tv';
  if (/(电影|影片|剧场版)/.test(text)) return 'movie';
  return null;
}

function readStats(): Partial<Record<CategoryKey, number>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<CategoryKey, number>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** 记录一次播放 */
export function recordWatchCategory(key: CategoryKey) {
  if (typeof window === 'undefined') return;
  const stats = readStats();
  stats[key] = (stats[key] ?? 0) + 1;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    // 通知同页面的「猜你喜欢」区块刷新（自定义事件，避免引入全局状态库）
    window.dispatchEvent(new CustomEvent('libretv:watch-category'));
  } catch {
    // localStorage 写满等异常忽略：推荐降级为不展示
  }
}

/** 票数最高的分类；没有记录返回 null */
export function topCategory(): CategoryTarget | null {
  const stats = readStats();
  let best: CategoryKey | null = null;
  let bestCount = 0;
  (Object.keys(CATEGORY_TARGETS) as CategoryKey[]).forEach((key) => {
    const count = stats[key] ?? 0;
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  });
  return best ? CATEGORY_TARGETS[best] : null;
}

export function clearWatchCategories() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STATS_KEY);
  window.dispatchEvent(new CustomEvent('libretv:watch-category'));
}
