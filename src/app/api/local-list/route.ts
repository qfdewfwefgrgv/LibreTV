import { NextResponse } from 'next/server';
import { checkUpstreamAllowed } from '@/lib/ssrf';
import { fetchUpstream } from '@/lib/fetch-utils';
import { cmsRequestHeaders, parseSearchList } from '@/lib/cms-parser';
import { getEnvSources } from '@/lib/env-sources';

export const runtime = 'nodejs';

/**
 * 首页「我的影库」数据源。
 *
 * 把部署者在 .env 里配置的本地点播源（LOCAL_LIBRARY_URL）的全部条目取回来，
 * 供首页以卡片墙形式展示自有影片（点击直接进详情/播放）。
 * 未配置、地址不合法或拉取失败时返回空列表，首页自动不显示该区块。
 */
export async function GET() {
  const url = (process.env.LOCAL_LIBRARY_URL || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ list: [], unrecognized: [] });
  }

  const verdict = await checkUpstreamAllowed(url);
  if (!verdict.ok) {
    return NextResponse.json({ list: [], unrecognized: [] });
  }

  try {
    // 不带 wd 即「列出全部」，由本地点播源实现决定
    const res = await fetchUpstream(`${url}?ac=videolist`, {
      timeoutMs: 10000,
      headers: cmsRequestHeaders(),
    });
    if (!res.ok) return NextResponse.json({ list: [], unrecognized: [] });
    const data = await res.json();
    // 影库服务会把「扩展名不是视频格式、无法识别从而被跳过」的文件名放在 unrecognized 里，
    // 这里原样透传给前端，让用户看到哪些文件被忽略了。
    const unrecognized: string[] = Array.isArray(data?.unrecognized) ? data.unrecognized : [];
    // 条目最终要交给播放页按 sourceKey 找回点播源：客户端预置源的 key 是
    // env_0/env_1…（见 lib/env-sources.ts），这里必须用同一个 key，
    // 否则从首页「我的影库」点开影片会报「点播源不存在」。
    const sources = getEnvSources();
    const matched = sources.find((s) => s.url === url);
    const list = parseSearchList(data, {
      key: matched?.key ?? sources[0]?.key ?? 'local',
      name: matched?.name ?? '本地影库',
      url,
    });
    return NextResponse.json({ list, unrecognized });
  } catch {
    return NextResponse.json({ list: [], unrecognized: [] });
  }
}
