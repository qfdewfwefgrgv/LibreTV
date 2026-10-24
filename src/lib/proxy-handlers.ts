import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-guard';
import { checkLiveUrlAllowed, checkUpstreamAllowed } from '@/lib/ssrf';
import { fetchWithSafeRedirects } from '@/lib/fetch-utils';
import { rewriteM3u8, LIVE_STREAM_BASE } from '@/lib/m3u8';

/**
 * 代理目标地址的两种传入形式：
 * - 路径段：/api/proxy/<encodeURIComponent(url)>（旧形式，保持兼容）；
 * - 查询串：/api/proxy?url=<encodeURIComponent(url)>（新形式）。
 *
 * 路径形式在 EdgeOne 等会做 URL 归一化的网关上有致命缺陷：路径里的 %2F
 * 会在路由匹配前被解码成 /，多段路径令单段动态路由 [url] 匹配失败（404）。
 * 查询串不参与路径归一化，全平台行为一致；路由同时支持两种形式，
 * 旧地址（缓存页 / 已下发的播放列表）不受影响。
 */

const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT || '8000', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '1', 10);
const HEADER_TIMEOUT_MS = 15_000;
const UA =
  process.env.USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * 精确域名匹配：仅 `douban.com` 本身及其子域放行。
 * 不能用 endsWith('douban.com')——那样 `evil-douban.com` 也会命中，形成鉴权绕过。
 */
function isDoubanHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'douban.com' || h.endsWith('.douban.com') ||
    h === 'doubanio.com' || h.endsWith('.doubanio.com')
  );
}

/** 解码路径段形式的代理目标（网关可能已把 %2F 解码为 /，失败时原样返回） */
export function decodePathTarget(encodedUrl: string): string {
  try { return decodeURIComponent(encodedUrl); } catch { return encodedUrl; }
}

/**
 * 通用流式代理（点播 / 图片）：
 * - 免登录即可播放：访客直接观看时，m3u8 与分片同样经本站同源转发；
 * - m3u8 文本重写为代理地址，分片/key/map 全部经本站转发，规避上游 CORS；
 * - 所有目标统一走 SSRF 校验。
 */
export async function handleProxyRequest(req: Request, targetUrl: string): Promise<Response> {
  // 与采集站共用同一套校验：部署者显式开启 SOURCE_ALLOW_PRIVATE=1 时放行回环/内网地址，
  // 让自建影库的封面与影片能经本站代理转发（对外只保留一个端口）。
  const verdict = await checkUpstreamAllowed(targetUrl);
  if (!verdict.ok) {
    return jsonError(verdict.reason, 403);
  }

  const headers: Record<string, string> = { 'User-Agent': UA, Accept: '*/*' };
  try {
    if (isDoubanHost(new URL(targetUrl).hostname)) {
      headers.Referer = 'https://movie.douban.com/';
    }
  } catch { /* 忽略非法 URL */ }

  const range = req.headers.get('range');
  if (range) headers.Range = range;

  let response: Response | undefined;
  let finalUrl = targetUrl;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 超时只覆盖「等响应头」这一段：AbortSignal.timeout 会被整条响应流继承，
    // 直接拿它包住媒体请求会让大文件播几秒就被掐断（直播侧同理，故单独处理）。
    // 客户端断开时仍通过同一个 controller 终止上游连接，避免连接泄漏。
    const controller = new AbortController();
    const headerTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onClientAbort = () => controller.abort();
    req.signal.addEventListener('abort', onClientAbort, { once: true });
    try {
      const result = await fetchWithSafeRedirects(targetUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(headerTimer);
      response = result.res;
      finalUrl = result.finalUrl;
      lastError = null;
      break;
    } catch (err) {
      clearTimeout(headerTimer);
      lastError = err;
    }
  }
  if (!response) {
    return new NextResponse(
      `代理请求失败: ${lastError instanceof Error ? lastError.message : '未知错误'}`,
      { status: 502 }
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const isM3u8 =
    contentType.includes('mpegurl') || contentType.includes('x-mpegurl') ||
    targetUrl.toLowerCase().endsWith('.m3u8');

  // m3u8 文本：重写为代理地址（以重定向后的最终 URL 为 base 解析相对地址）
  if (isM3u8) {
    // 响应流已不再带整体超时，这里给「读文本」单独设上限，避免上游卡住时请求挂死
    const text = await Promise.race([
      response.text(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (text === null) return jsonError('上游播放列表读取超时', 504);
    return new NextResponse(rewriteM3u8(text, finalUrl), {
      status: response.status,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 其余（图片 / JSON / 分片 / key）流式透传
  const outHeaders = new Headers();
  for (const name of ['content-type', 'accept-ranges', 'content-range', 'etag', 'last-modified']) {
    const v = response.headers.get(name);
    if (v) outHeaders.set(name, v);
  }
  // 上游没有压缩时，把长度头也带上：视频播放器要靠它判断文件有多大
  // （无 Range 的请求若既没有 Content-Length 也没有 Content-Range，浏览器
  // 就不知道总长度——拖进度失效，部分播放器会直接放弃播放）。
  // 上游带 content-encoding 时不能带：fetch 已经解压过，原长度对不上，
  // 浏览器会按错误的长度截断响应。
  if (!response.headers.get('content-encoding')) {
    const len = response.headers.get('content-length');
    if (len) outHeaders.set('content-length', len);
  }
  // 图片基本不变：长缓存交给浏览器与边缘 CDN（分片 / key 仍保守 1 小时）
  outHeaders.set(
    'Cache-Control',
    contentType.startsWith('image/') ? 'public, max-age=2592000' : 'public, max-age=3600'
  );
  outHeaders.set('Access-Control-Allow-Origin', '*');

  return new NextResponse(response.body, {
    status: response.status,
    headers: outHeaders,
  });
}

/**
 * 直播流专用长连接代理（不复用 /api/proxy）：
 *
 * /api/proxy 的 AbortSignal.timeout(TIMEOUT_MS) 作用于整个响应流，
 * 8 秒后即切断长连接——对 HTTP-FLV（单一无限长连接）是致命的。
 * 本路由改为「仅对响应头等待设超时」（fetchWithSafeRedirects 的
 * headerTimeoutMs）：fetch 拿到响应头后立即清除计时器，
 * 之后 body 无限时长流式透传，直到客户端断开。
 *
 * - 不重试（重试对直播无意义）；
 * - m3u8 manifest 仍需重写（变体/分片地址改指本路由），FLV 等纯透传；
 * - 每一跳都强制 SSRF 校验（不信任解析阶段的校验结果）；
 * - 部署者可设 LIVE_ALLOW_PRIVATE=1 显式放行内网自建源（默认拒绝）。
 */
export async function handleLiveStreamRequest(req: Request, targetUrl: string): Promise<Response> {
  const verdict = await checkLiveUrlAllowed(targetUrl);
  if (!verdict.ok) return jsonError(verdict.reason, 403);

  const controller = new AbortController();
  // 客户端断开（切台/关页）时终止上游连接，防止连接泄漏
  const onClientAbort = () => controller.abort();
  req.signal.addEventListener('abort', onClientAbort, { once: true });

  const headers: Record<string, string> = { 'User-Agent': UA, Accept: '*/*' };

  let response: Response;
  let finalUrl: string;
  try {
    // 客户端断开（切台/关页）时经 controller.signal 终止上游连接，防止连接泄漏
    const result = await fetchWithSafeRedirects(
      targetUrl,
      { headers, signal: controller.signal },
      { allowPrivate: true, headerTimeoutMs: HEADER_TIMEOUT_MS }
    );
    response = result.res;
    finalUrl = result.finalUrl;
  } catch (err) {
    return jsonError(
      `直播流连接失败: ${err instanceof Error ? err.message : '未知错误'}`,
      502
    );
  }

  if (!response.ok && response.body) {
    // 非直播正常响应（403/404 等）：透传原始状态码便于前端与开发者工具定位
    // （一律包成 502 会掩盖「token 过期 403」与「源瞬断」的区别）
    try { await response.body.cancel(); } catch { /* 忽略 */ }
    return NextResponse.json(
      { error: `直播流上游返回 ${response.status}` },
      {
        status: response.status,
        headers: { 'Cache-Control': 'no-store', 'X-Live-Upstream-Status': String(response.status) },
      }
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const isM3u8 =
    contentType.includes('mpegurl') || contentType.includes('x-mpegurl') ||
    targetUrl.toLowerCase().split('?')[0].endsWith('.m3u8');

  // HLS manifest：重写变体/分片地址指向本路由，保证后续请求同源同鉴权。
  // 关键：以重定向后的最终 URL 为 base 解析相对地址（gslb 调度源 302 后路径会变）
  if (isM3u8) {
    const text = await response.text();
    return new NextResponse(rewriteM3u8(text, finalUrl, 0, LIVE_STREAM_BASE), {
      status: response.status,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      },
    });
  }

  // FLV / TS 等流媒体：纯流式透传（禁止缓冲与缓存）
  const outHeaders = new Headers();
  const ct = contentType || 'video/mp2t';
  outHeaders.set('Content-Type', ct);
  outHeaders.set('Cache-Control', 'no-store, no-transform');
  outHeaders.set('X-Accel-Buffering', 'no');

  return new NextResponse(response.body, {
    status: response.status,
    headers: outHeaders,
  });
}
