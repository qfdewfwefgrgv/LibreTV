import { NextResponse } from 'next/server';
import { cmsRequestHeaders, parseSearchList } from '@/lib/cms-parser';
import { getEnvSources } from '@/lib/env-sources';
import { fetchUpstream, getCache, setCache } from '@/lib/fetch-utils';
import type { GuomanResponse, SearchResultItem, SourceConfig } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * 豆瓣高分电影：首页「豆瓣高分」栏目的固定片单。
 * 沿用国漫精选的做法：不在本站存片，每部片去外部影库搜一条最匹配的资源，
 * 返回完整的 SearchResultItem；点海报直接进详情、选集、播放。
 * 影库搜不到的片，退回豆瓣搜索补一张海报，点击时回落按片名搜索。
 */
const CLASSIC_TITLES = [
  '肖申克的救赎',
  '霸王别姬',
  '阿甘正传',
  '这个杀手不太冷',
  '星际穿越',
  '盗梦空间',
  '楚门的世界',
  '三傻大闹宝莱坞',
  '我不是药神',
  '无间道',
  '疯狂动物城',
  '寻梦环游记',
  '复仇者联盟',
  '复仇者联盟4：终局之战',
  '蝙蝠侠：黑暗骑士',
  '教父',
  '当幸福来敲门',
  '摔跤吧！爸爸',
  '触不可及',
  '海上钢琴师',
  '大话西游之大圣娶亲',
  '美丽人生',
  '放牛班的春天',
  '忠犬八公的故事',
  '狮子王',
  '天空之城',
  '心灵捕手',
  '猫鼠游戏',
  '死亡诗社',
  '搏击俱乐部',
];

/** 采集源里常见的别名写法 */
const CLASSIC_ALIASES: Record<string, string[]> = {
  '肖申克的救赎': ['肖申克救赎'],
  '三傻大闹宝莱坞': ['三傻大闹宝莱坞', '三傻大闹宝来坞'],
  '摔跤吧！爸爸': ['摔跤吧爸爸'],
  '复仇者联盟4：终局之战': ['复仇者联盟4', '复仇者联盟：终局之战'],
  '蝙蝠侠：黑暗骑士': ['黑暗骑士'],
};

const CACHE_TTL = 6 * 60 * 60 * 1000;
const TITLE_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 6000;

/** 只取外网采集源（本地影库里没有这些院线片），最多前 3 个 */
function pickSources(): SourceConfig[] {
  return getEnvSources()
    .filter((s) => !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(s.url))
    .slice(0, 3);
}

/** 片名匹配打分：完全同名为准，解说/预告/速看/合集直接压掉，电影类目加分 */
function scoreOf(item: SearchResultItem, title: string): number {
  const name = item.name || '';
  let score = -1;
  if (name === title) score = 100;
  else if (name.startsWith(title)) score = 80;
  else if (name.includes(title)) score = 60;
  if (score < 0) return -1;
  if (/解说|预告|花絮|片段|混剪|速看|合集|盘点|影评/.test(name)) score -= 50;
  const type = item.typeName || '';
  if (/电影|剧情|动作|科幻|喜剧|爱情|动画/.test(type)) score += 10;
  if (item.pic) score += 1;
  return score;
}

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
  const queries = [title, ...(CLASSIC_ALIASES[title] || [])];
  for (const q of queries) {
    const hit = await findBestByTitle(q, sources);
    if (hit) return hit;
  }
  return null;
}

/** 影库没有时补封面：豆瓣按片名搜索取一张海报，只用来占位，不参与播放 */
async function doubanPoster(title: string): Promise<{ pic?: string; year?: string }> {
  try {
    const url =
      'https://movie.douban.com/j/search_subjects?' +
      `type=movie&tag=${encodeURIComponent(title)}&sort=recommend&page_limit=20&page_start=0`;
    const res = await fetchUpstream(url, {
      timeoutMs: 5000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Referer: 'https://movie.douban.com/',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { subjects?: Array<{ title?: string; cover?: string }> };
    const list = data.subjects || [];
    // 优先同名（个别条目带「(1997)」这类年份后缀），取不到再退回第一条
    const hit = list.find((it) => it.title === title) || list.find((it) => it.title?.startsWith(title)) || list[0];
    return { pic: hit?.cover || undefined };
  } catch {
    return {};
  }
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
  const cacheKey = 'classic:v1';
  const cached = getCache<SearchResultItem[]>(cacheKey);
  if (cached) return NextResponse.json({ items: cached } satisfies GuomanResponse);

  const sources = pickSources();
  const found = sources.length
    ? await mapLimited(CLASSIC_TITLES, TITLE_CONCURRENCY, (title) => findBest(title, sources))
    : CLASSIC_TITLES.map(() => null);

  const items: SearchResultItem[] = CLASSIC_TITLES.map((title, i) => {
    const hit = found[i];
    if (hit) return { ...hit, name: title };
    // 影库没搜到：先占位，下面用豆瓣封面补齐，点击回落到按片名搜索
    return { sourceKey: '', sourceName: '', vodId: '', name: title };
  });

  // 补齐没有封面的条目（豆瓣片名建议接口）
  const missing = items.filter((it) => !it.vodId && !it.pic);
  const posters = await mapLimited(missing, 6, (it) => doubanPoster(it.name));
  missing.forEach((it, i) => {
    it.pic = posters[i].pic;
    it.year = posters[i].year;
  });

  setCache(cacheKey, items, CACHE_TTL);
  return NextResponse.json({ items } satisfies GuomanResponse);
}
