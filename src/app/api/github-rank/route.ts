import { NextRequest } from 'next/server';
import { getGithubRank, refreshGithubRank } from '@/lib/github-rank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/github-rank —— 读取 GitHub 榜单缓存（超过 7 天自动后台刷新） */
export async function GET() {
  try {
    const data = await getGithubRank();
    return Response.json(data, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ ok: false, building: false, stale: false, error: '榜单暂不可用' }, { status: 502 });
  }
}

/** POST /api/github-rank —— 每周定时任务强制刷新，需要 x-refresh-token */
export async function POST(req: NextRequest) {
  const expected = process.env.GITHUB_RANK_TOKEN || '';
  const got = req.headers.get('x-refresh-token') || '';
  if (!expected || got !== expected) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  try {
    const data = await refreshGithubRank();
    return Response.json(
      { ok: true, updatedAt: data.updatedAt, weekly: data.weekly.length, allTime: data.allTime.length, practical: data.practical.length },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return Response.json({ ok: false, error: '刷新失败' }, { status: 502 });
  }
}
