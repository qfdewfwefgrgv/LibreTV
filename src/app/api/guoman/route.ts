import { NextResponse } from 'next/server';
import { cmsRequestHeaders, parseSearchList } from '@/lib/cms-parser';
import { getEnvSources } from '@/lib/env-sources';
import { fetchUpstream, getCache, setCache } from '@/lib/fetch-utils';
import type { GuomanResponse, SearchResultItem, SourceConfig } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * 国漫精选：首页「国漫」栏目的固定片单。
 * 资源不落在本站——每部片都去外部影库（量子/魔都/非凡）搜一条最匹配的资源，
 * 返回完整的 SearchResultItem，点海报直接进详情、选集、播放（播放直链由
 * /api/detail 转成站内 /api/proxy，用户拿不到上游地址）。
 * 只缓存片单与命中的 vodId，不做资源镜像；源站换 id 时 6 小时内最多回落到按片名搜索。
 */
const GUOMAN_TITLES = [
  '刺客伍六七',
  '伍六七之最强发型师',
  '伍六七之玄武国篇',
  '伍六七之暗影宿命',
  '伍六七之记忆碎片',
  '一人之下',
  '吞噬星空',
  '斗罗大陆',
  '斗破苍穹',
  '凡人修仙传',
  '完美世界',
  '仙逆',
  '遮天',
  '神印王座',
  '狐妖小红娘',
  '镇魂街',
];

const CACHE_TTL = 6 * 60 * 60 * 1000;
const TITLE_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 6000;

/** 只取外网采集源（本地影库 127.0.0.1 里没有这些片子），最多前 3 个 */
function pickSources(): SourceConfig[] {
  return getEnvSources()
    .filter((s) => !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(s.url))
    .slice(0, 3);
}

/** 片名匹配打分：完全同名最好，其次是「片名+季/集」这种前缀，解说/预告直接压掉 */
function scoreOf(item: SearchResultItem, title: string): number {
  const name = item.name || '';
  let score = -1;
  if (name === title) score = 100;
  else if (name.startsWith(title)) score = 80;
  else if (name.includes(title)) score = 60;
  if (score < 0) return -1;
  if (/解说|预告|花絮|片段|混剪/.test(name)) score -= 40;
  const type = item.typeName || '';
  if (/动画|动漫|国产/.test(type)) score += 10;
  if (item.pic) score += 1;
  return score;
}

/** 部分片名在采集源里是另一种写法（如《刺客伍六七》在百度源里叫《伍六七》） */
const GUOMAN_QUERY_ALIASES: Record<string, string[]> = {
  '刺客伍六七': ['伍六七'],
};

async function findBestByTitle(title: string, sources: SourceConfig[]): Promise<SearchResultItem | null> {
  for (const source of sources) {
    try {
      const url = `${source.url}?ac=videolist&wd=${encodeURIComponent(title)}`;
      const res = await fetchUpstream(url, { timeoutMs: FETCH_TIMEOUT_MS, headers: cmsRequestHeaders() });
      if (!res.ok) continue;
      const list = parseSearchList(await res.json(), source);
      const best = list
        .map((item) => ({ item, score: scoreOf(item, title) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (best) return best.item;
    } catch {
      // 该源失败就换下一个源
    }
  }
  return null;
}

async function findBest(title: string, sources: SourceConfig[]): Promise<SearchResultItem | null> {
  const queries = [title, ...(GUOMAN_QUERY_ALIASES[title] || [])];
  for (const q of queries) {
    const hit = await findBestByTitle(q, sources);
    if (hit) return hit;
  }
  return null;
}

/** 小并发池：并发 4 路足够快，又不会把上游打崩 */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function GET() {
  const cacheKey = 'guoman:v5';
  const cached = getCache<SearchResultItem[]>(cacheKey);
  if (cached) return NextResponse.json({ items: cached } satisfies GuomanResponse);

  const sources = pickSources();
  const found = sources.length
    ? await mapLimited(GUOMAN_TITLES, TITLE_CONCURRENCY, (title) => findBest(title, sources))
    : GUOMAN_TITLES.map(() => null);

  const items: SearchResultItem[] = GUOMAN_TITLES.map((title, i) => {
    const hit = found[i];
    if (!hit) {
      // 没搜到：给一个空 vodId 占位，前端点击回落到按片名搜索
      return { sourceKey: '', sourceName: '', vodId: '', name: title };
    }
    return { ...hit, name: title };
  });
  setCache(cacheKey, items, CACHE_TTL);
  return NextResponse.json({ items } satisfies GuomanResponse);
}
