import { NextResponse } from 'next/server';
import { createCaptcha } from '@/lib/captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 图形验证码：返回 { id, image }，image 是可直接塞进 <img src> 的 SVG data URI。
 * 前端提交登录/注册/发验证码时回传 id + 用户输入，服务端一次性校验。
 */
export async function GET() {
  const { id, image } = createCaptcha();
  return NextResponse.json({ id, image }, { headers: { 'Cache-Control': 'no-store' } });
}
