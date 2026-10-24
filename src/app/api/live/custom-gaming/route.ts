import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 内置游戏电竞频道订阅源。
 * 因 GTV 游戏竞技频道已停播，这里收录仍可访问的同类游戏电竞频道：
 *   - 游戏风云（SiTV Gamefy）
 *   - 游戏风云 HD
 *   - 电竞频道
 *
 * 在 .env 中通过 DEFAULT_LIVE_SOURCES 引用本地址即可自动出现在直播列表：
 *   {"name":"游戏电竞","url":"http://127.0.0.1:8080/api/live/custom-gaming"}
 * 需配合 LIVE_ALLOW_PRIVATE=1 放行回环地址。
 */
const CHANNELS: Array<{ name: string; url: string; logo?: string }> = [
  {
    name: '游戏风云',
    url: 'http://74.91.26.218:82/live/yxfy.m3u8',
    logo: 'https://gitee.com/suxuang/logo/raw/master/mylogo/游戏风云.png',
  },
  {
    name: '游戏风云 HD',
    url: 'http://63.141.230.178:82/gslb/zbdq5.m3u8?id=yxfyhd',
    logo: 'https://gitee.com/suxuang/logo/raw/master/mylogo/游戏风云.png',
  },
  {
    name: '电竞频道',
    url: 'http://74.91.26.218:82/live/dianjing.m3u8',
  },
];

function buildM3u(): string {
  const lines = ['#EXTM3U', '#PLAYLIST:游戏电竞频道'];
  for (const c of CHANNELS) {
    const logo = c.logo ? ` tvg-logo="${c.logo}"` : '';
    lines.push(`#EXTINF:-1 tvg-id="${c.name}" tvg-name="${c.name}"${logo} group-title="🎮游戏电竞",${c.name}`);
    lines.push(c.url);
  }
  return lines.join('\n');
}

export async function GET() {
  return new NextResponse(buildM3u(), {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
