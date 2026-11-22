import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export type PlatformLiveResponse = {
  platform: string;
  roomId: string;
  title: string;
  live: boolean;
  url?: string;
  /** 未开播 / 无法解析时的说明 */
  message?: string;
};

async function platformJson<T>(url: string, referer: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: referer, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`上游返回 ${res.status}`);
  return (await res.json()) as T;
}

/** B站：房间号 → 真实 room_id → 直播状态 → H5 版 m3u8 地址 */
async function resolveBilibili(id: string): Promise<PlatformLiveResponse> {
  const biliJson = <T,>(url: string) => platformJson<T>(url, 'https://live.bilibili.com/');
  const init = await biliJson<{ code: number; message?: string; data?: { room_id: number; live_status: number } }>(
    `https://api.live.bilibili.com/room/v1/Room/room_init?id=${encodeURIComponent(id)}`
  );
  if (init.code !== 0 || !init.data) {
    throw new Error(init.message || '房间不存在');
  }
  const roomId = String(init.data.room_id);

  const info = await biliJson<{ code: number; data?: { title?: string } }>(
    `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`
  );
  const title = info.data?.title || `直播间 ${roomId}`;

  if (init.data.live_status !== 1) {
    return { platform: 'bilibili', roomId, title, live: false, message: '主播未开播' };
  }

  // platform=h5 返回 m3u8（web 返回 flv），qn=400 超清，码率低、适合窄带宽服务器
  const play = await biliJson<{ code: number; message?: string; data?: { durl?: { url?: string }[] } }>(
    `https://api.live.bilibili.com/room/v1/Room/playUrl?cid=${roomId}&qn=400&platform=h5`
  );
  const url = play.data?.durl?.[0]?.url;
  if (play.code !== 0 || !url) {
    return { platform: 'bilibili', roomId, title, live: true, message: play.message || '未获取到播放地址' };
  }
  return { platform: 'bilibili', roomId, title, live: true, url };
}

type HuyaStream = {
  sCdnType?: string;
  sStreamName?: string;
  sFlvUrl?: string;
  sFlvUrlSuffix?: string;
  sFlvAntiCode?: string;
};

/**
 * 虎牙：房间号 → mp.huya.com 房间信息 → 免签名 FLV 地址。
 * 该接口下发的 sFlvAntiCode 已含 wsSecret/wsTime，可直接拼出可播地址（无需逆向签名）。
 * HLS 版同参数会 403，故统一走 FLV（前端 mpegts.js 可播，且经本站代理绕开 CORS）。
 */
async function resolveHuya(id: string): Promise<PlatformLiveResponse> {
  const json = await platformJson<{
    status: number;
    message?: string;
    data?: {
      liveStatus?: string;
      liveData?: { introduction?: string; roomName?: string; nick?: string; profileRoom?: number };
      stream?: { baseSteamInfoList?: HuyaStream[]; baseStreamInfoList?: HuyaStream[] };
    };
  }>(`https://mp.huya.com/cache.php?m=Live&do=profileRoom&roomid=${encodeURIComponent(id)}`, 'https://www.huya.com/');

  if (json.status !== 200 || !json.data) {
    throw new Error(json.message || '房间不存在');
  }

  const data = json.data;
  const liveData = data.liveData;
  const roomId = String(liveData?.profileRoom || id);
  const title = [liveData?.nick, liveData?.introduction || liveData?.roomName]
    .filter(Boolean)
    .join(' · ') || `虎牙直播间 ${roomId}`;

  if (data.liveStatus !== 'ON') {
    return { platform: 'huya', roomId, title, live: false, message: '主播未开播' };
  }

  // 阿里云源（sCdnType=AL）离本机最近；没有则取第一条
  const list = data.stream?.baseSteamInfoList ?? data.stream?.baseStreamInfoList ?? [];
  const stream = list.find((s) => s.sCdnType === 'AL') ?? list[0];
  if (!stream?.sFlvUrl || !stream.sStreamName || !stream.sFlvUrlSuffix || !stream.sFlvAntiCode) {
    return { platform: 'huya', roomId, title, live: true, message: '未获取到播放地址' };
  }

  const url = `${stream.sFlvUrl}/${stream.sStreamName}.${stream.sFlvUrlSuffix}?${stream.sFlvAntiCode}`;
  return { platform: 'huya', roomId, title, live: true, url };
}

/**
 * 个人直播平台解析。
 * GET /api/live/platform?platform=bilibili|huya&id=<房间号>
 * 抖音 / 快手 / 斗鱼 的播放地址需要登录态或签名（斗鱼 getH5Play 带时间戳+签名校验），
 * 服务端无法稳定取得直链，故只在前端提供「打开直播间」外链。
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const platform = (sp.get('platform') || 'bilibili').trim().toLowerCase();
  const id = (sp.get('id') || '').trim();

  if (!id) return jsonError('缺少房间号', 400);
  if (!/^[0-9A-Za-z_-]{1,32}$/.test(id)) return jsonError('房间号格式不正确', 400);

  try {
    if (platform === 'bilibili' || platform === 'bili' || platform === 'b') {
      const data = await resolveBilibili(id);
      return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (platform === 'huya' || platform === 'hy') {
      const data = await resolveHuya(id);
      return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (platform === 'douyu' || platform === 'douyin' || platform === 'kuaishou') {
      return jsonError('该平台播放地址需要签名/登录态，暂不支持站内播放，请使用「打开直播间」', 501);
    }
    return jsonError('不支持的平台', 400);
  } catch (err) {
    return jsonError(`解析失败: ${err instanceof Error ? err.message : '未知错误'}`, 502);
  }
}
