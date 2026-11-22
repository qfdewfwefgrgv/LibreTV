import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 站内图片代理（目前只服务豆瓣图床）：/api/pic?url=<encodeURIComponent(原图地址)>
 *
 * 为什么不复用 /api/proxy：豆瓣图床对空 Referer 返回 418、对非豆瓣来源页返回 403，
 * 公共镜像（cmliussss 等）在部分网络下会连上但不回包。这里由服务端固定带
 * Referer: https://movie.douban.com/ 取图，命中后进内存缓存，浏览器拿到的永远是
 * 本站同源的 200 图片，既不受图床反爬影响，也不会出现「<img> 一直挂起不报错」。
 *
 * 白名单只放豆瓣，避免这个接口被当成通用开放代理。
 */
const ALLOWED = /^https?:\/\/img\d*\.doubanio\.com\//i;
const TTL = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 400;
const MAX_CONCURRENCY = 4;

interface Entry {
  body: ArrayBuffer;
  type: string;
  at: number;
}

const cache = new Map<string, Entry>();
let running = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<void> | void {
  if (running < MAX_CONCURRENCY) {
    running += 1;
    return;
  }
  return new Promise<void>((resolve) => waiting.push(resolve));
}

function release() {
  running -= 1;
  const next = waiting.shift();
  if (next) next();
}

async function load(url: string): Promise<Entry | null> {
  await acquire();
  try {
    const res = await fetch(url, {
      headers: {
        // 豆瓣图床只认自家来源页
        Referer: 'https://movie.douban.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const entry: Entry = { body: await res.arrayBuffer(), type, at: Date.now() };
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(url, entry);
    return entry;
  } catch {
    return null;
  } finally {
    release();
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url') || '';
  if (!ALLOWED.test(url)) return new NextResponse('forbidden', { status: 403 });

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) {
    return new NextResponse(hit.body, {
      headers: {
        'Content-Type': hit.type,
        'Cache-Control': 'public, max-age=86400',
        'X-Pic-Cache': 'hit',
      },
    });
  }

  const entry = await load(url);
  if (!entry) return new NextResponse('upstream error', { status: 404 });

  return new NextResponse(entry.body, {
    headers: {
      'Content-Type': entry.type,
      'Cache-Control': 'public, max-age=86400',
      'X-Pic-Cache': 'miss',
    },
  });
}
