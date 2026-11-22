import { NextResponse } from 'next/server';
import { cmsRequestHeaders, parseDetail, parseDetailPageHtml } from '@/lib/cms-parser';
import { fetchUpstream, getCache, setCache } from '@/lib/fetch-utils';
import { checkUpstreamAllowed } from '@/lib/ssrf';
import type { SourceConfig, VideoDetail } from '@/lib/types';

export const runtime = 'nodejs';

/** 详情结果短缓存：换源测速/多人观看同一影片时避免重复打上游 */
const DETAIL_CACHE_TTL = 60 * 1000;

function parseSource(raw: string | null): SourceConfig | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as SourceConfig;
    if (!obj || !/^https?:\/\//.test(obj.url || '')) return null;
    return obj;
  } catch {
    return null;
  }
}

/** 本站自己的域名：这些地址本来就归本站直出，不能再套一层代理（会白耗 CPU 与带宽） */
const PLATFORM_HOSTS = new Set(
  (process.env.PLATFORM_HOSTS || '8.138.8.89,127.0.0.1,localhost,dianying.ltd')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
);

function isPlatformHost(url: string): boolean {
  try {
    return PLATFORM_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * 当前请求的页面来源：浏览器是用哪个 host 打开站点的，就用哪个 host 拼播放地址。
 * 这样 http://8.138.8.89 与 https://www.dianying.online 两个通道拿到的都是同源地址，
 * 既不会跨域、也不依赖客户端能否解析域名（本地代理 fake-ip 会让域名解析失败）。
 */
function pageOrigin(req: Request): string {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').trim();
  if (!host) return '';
  const proto = (req.headers.get('x-forwarded-proto') || 'http').split(',')[0].trim() || 'http';
  return `${proto}://${host}`;
}

/**
 * 外部影库「只能在我们平台观看」：把外部播放直链改写成同源代理地址，
 * 客户端拿不到上游真实地址，播放请求统一由本站中转（m3u8 与分片都会被 proxy-handlers 再重写）。
 * 本站自己的地址（本地影库、直播、HLS）改写成当前页面来源，走 nginx 直出快路径；
 * 相对地址保持原样。
 */
function toPlatformUrls(detail: VideoDetail, origin: string): VideoDetail {
  return {
    ...detail,
    episodes: detail.episodes.map((url) => {
      if (url.startsWith('/api/proxy')) return url;
      if (!/^https?:\/\//i.test(url)) return url;
      if (isPlatformHost(url)) {
        if (!origin) return url;
        try {
          const u = new URL(url);
          return `${origin}${u.pathname}${u.search}`;
        } catch {
          return url;
        }
      }
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }),
  };
}

/**
 * 视频详情：优先走列表接口 ?ac=videolist&ids=，
 * 拿不到播放地址时（部分源需要爬详情页）降级到 detail 页 HTML 提取。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').trim();
  const source = parseSource(url.searchParams.get('source'));
  const baseUrl = (url.searchParams.get('baseUrl') || '').trim(); // 可选：详情页根地址

  if (!id || !/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: '无效的视频ID' }, { status: 400 });
  }
  if (!source) {
    return NextResponse.json({ error: '无效的点播源配置' }, { status: 400 });
  }

  try {
    // 详情页根地址：显式 detail 优先，其次 baseUrl 参数，最后用接口地址的 origin 推导
    // （Apple CMS 的详情页通常与接口同域）。脏 URL 会让 new URL 抛错，由外层 catch 兜底
    const detailRoot = (source.detail || baseUrl || new URL(source.url).origin).replace(/\/+$/, '');
    const cacheKey = `detail:${source.url}|${detailRoot}|${id}`;
    const origin = pageOrigin(req);
    const cached = getCache<VideoDetail>(cacheKey);
    if (cached) {
      return NextResponse.json(toPlatformUrls(cached, origin));
    }

    // 用户可控地址发起服务端请求，先过 SSRF 校验（协议白名单 + 内网/保留地址）
    const listVerdict = await checkUpstreamAllowed(source.url);
    if (!listVerdict.ok) {
      return NextResponse.json({ error: listVerdict.reason }, { status: 400 });
    }

    let resolved: VideoDetail | null = null;

    // 1) 标准列表接口
    const api = `${source.url.replace(/\/+$/, '')}?ac=videolist&ids=${encodeURIComponent(id)}`;
    const res = await fetchUpstream(api, { timeoutMs: 10000, headers: cmsRequestHeaders() });
    if (res.ok) {
      const data = await res.json();
      try {
        const detail = parseDetail(data, source);
        if (detail.episodes.length > 0) {
          resolved = detail;
        }
        // 有详情但无播放地址 → 继续尝试详情页
      } catch {
        // 列表接口无内容 → 继续尝试详情页
      }
    }

    // 2) 详情页 HTML 提取
    if (!resolved && /^https?:\/\//.test(detailRoot)) {
      const detailVerdict = await checkUpstreamAllowed(detailRoot);
      if (!detailVerdict.ok) {
        return NextResponse.json({ error: detailVerdict.reason }, { status: 400 });
      }
      const detailUrl = `${detailRoot}/index.php/vod/detail/id/${id}.html`;
      const detailRes = await fetchUpstream(detailUrl, {
        timeoutMs: 10000,
        headers: { 'User-Agent': cmsRequestHeaders()['User-Agent'] },
      });
      if (detailRes.ok) {
        const html = await detailRes.text();
        resolved = parseDetailPageHtml(html, source);
      }
    }

    if (!resolved || resolved.episodes.length === 0) {
      return NextResponse.json({ error: '未找到播放资源' }, { status: 404 });
    }
    setCache(cacheKey, resolved, DETAIL_CACHE_TTL);
    return NextResponse.json(toPlatformUrls(resolved, origin));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '获取详情失败' },
      { status: 502 }
    );
  }
}
