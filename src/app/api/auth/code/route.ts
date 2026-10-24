import { NextResponse } from 'next/server';
import { verifyCaptcha } from '@/lib/captcha';
import {
  cancelOtp,
  channelConfigured,
  issueOtp,
  normalizeTarget,
  sendOtp,
  type OtpChannel,
} from '@/lib/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 发送邮箱/手机验证码。
 * - 先校验图形验证码（一次性），通过后才允许发送；
 * - 通道未配置时返回 503 + 明确原因（前端据此提示管理员开通）；
 * - 同一目标 60 秒冷却，发送失败会撤销本次占位，不占用冷却。
 */
export async function POST(req: Request) {
  let body: {
    channel?: OtpChannel;
    target?: string;
    captchaId?: string;
    captchaCode?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
  }

  const channel: OtpChannel = body.channel === 'sms' ? 'sms' : 'email';

  if (!verifyCaptcha(body.captchaId, body.captchaCode)) {
    return NextResponse.json(
      { success: false, error: '图形验证码错误或已过期，请刷新验证码后重试', captcha: true },
      { status: 400 }
    );
  }

  const normalized = normalizeTarget(channel, body.target ?? '');
  if (normalized.error || !normalized.target) {
    return NextResponse.json({ success: false, error: normalized.error }, { status: 400 });
  }
  const target = normalized.target;

  if (!channelConfigured(channel)) {
    // 未配置邮件/短信通道：不阻断流程，而是把验证码打印到服务端日志，
    // 前端据此提示用户去终端查看。配置好 SMTP_* / TENCENT_SMS_* 后自动切回真实发送。
    const issued = issueOtp(channel, target);
    if (issued.error || !issued.code) {
      return NextResponse.json({ success: false, error: issued.error ?? '生成验证码失败' }, { status: 429 });
    }
    console.log(`[OTP] ${channel === 'email' ? '邮箱' : '手机'} ${target} 验证码：${issued.code}（5 分钟内有效）`);
    return NextResponse.json({ success: true, cooldown: 60, devMode: true });
  }

  const issued = issueOtp(channel, target);
  if (issued.error || !issued.code) {
    return NextResponse.json({ success: false, error: issued.error ?? '生成验证码失败' }, { status: 429 });
  }

  try {
    await sendOtp(channel, target, issued.code);
  } catch (err) {
    cancelOtp(channel, target);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : '验证码发送失败' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, cooldown: 60 });
}
