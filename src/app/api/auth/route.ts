import { NextResponse } from 'next/server';
import {
  DEVICE_COOKIE,
  SESSION_COOKIE,
  checkGuestCode,
  checkRateLimit,
  clearRateLimit,
  readDeviceIdentity,
  sessionIdentityFromRequest,
  signDeviceToken,
  signSessionFor,
  type SessionIdentity,
} from '@/lib/auth';
import { verifyCaptcha } from '@/lib/captcha';
import { normalizeTarget, verifyOtp } from '@/lib/otp';
import {
  ensureContactUser,
  ensureDeveloper,
  ensureAdmin,
  findById,
  registerUser,
  toIdentity,
  verifyCredentials,
} from '@/lib/users';

export const runtime = 'nodejs';

type AuthMode = 'guest' | 'login' | 'register' | 'code' | 'device';

interface AuthBody {
  mode?: AuthMode;
  password?: string;
  username?: string;
  /** 注册时可绑定邮箱 */
  email?: string;
  /** 注册时可绑定手机号 */
  phone?: string;
  /** 验证码登录：channel + target + code */
  channel?: 'email' | 'sms';
  target?: string;
  code?: string;
  captchaId?: string;
  captchaCode?: string;
}

function secureCookie(req: Request): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  // 不能依赖 req.url（Next Route Handler 中是内部转发地址），按反代传来的协议判断
  return (req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http') === 'https';
}

/**
 * 签发会话，并顺带下发「本机免密凭证」。
 * 设备凭证只用于下次点「本机一键登录」换发会话，不能直接当 session 使用。
 */
function withSession(identity: SessionIdentity, req: Request) {
  const { token, expiresAt } = signSessionFor(identity);
  const device = signDeviceToken(identity);
  // token 同时下发到响应体，供外部/移动端存储后通过 Authorization: Bearer 调用 API；
  // 浏览器侧仍以 httpOnly Cookie 为准（防 XSS 窃取）。
  const res = NextResponse.json({ success: true, user: identity, token, expiresAt });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie(req),
    maxAge: Math.floor((expiresAt - Date.now()) / 1000),
    path: '/',
  });
  res.cookies.set(DEVICE_COOKIE, device.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie(req),
    maxAge: Math.floor((device.expiresAt - Date.now()) / 1000),
    path: '/',
  });
  return res;
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * 登录方式：
 * - guest：访客口令登录，输入 libretv 即可（默认值，可用 GUEST_CODE 覆盖），不要求验证码
 * - login：用户名 + 密码
 * - register：注册并自动登录（可绑定邮箱/手机号）
 * - code：邮箱/手机号验证码登录（未注册自动建号）
 * - device：本机一键登录（用设备凭证换发会话）
 *
 * 除 guest / device 外，其余模式都要先通过图形验证码（一次性），防止脚本爆破。
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: '尝试次数过多，请 10 分钟后再试' }, { status: 429 });
  }

  let body: AuthBody = {};
  try {
    body = (await req.json()) as AuthBody;
  } catch {
    return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
  }

  const mode: AuthMode = body.mode ?? (body.username ? 'login' : 'guest');

  // 确保内置账号（developer / admin）存在：任何认证请求都触发，
  // 避免首次登录时因账号尚未创建而被「用户名不存在」拦住。
  ensureDeveloper();
  ensureAdmin();

  // —— 本机一键登录：设备凭证本身即凭据，不再要求图形验证码 ——
  if (mode === 'device') {
    const device = readDeviceIdentity(req.headers.get('cookie'));
    if (!device) {
      return NextResponse.json(
        { success: false, error: '本机尚未绑定账号，请先用密码或验证码登录一次' },
        { status: 401 }
      );
    }
    const stored = device.role === 'guest' ? null : findById(device.sub);
    const identity: SessionIdentity = stored
      ? toIdentity(stored)
      : { sub: device.sub, username: device.username, role: device.role };
    clearRateLimit(ip);
    return withSession(identity, req);
  }

  const password = String(body.password ?? '');
  const username = String(body.username ?? '').trim();

  // —— 访客登录：只校验口令（默认 libretv），免图形验证码 ——
  if (mode === 'guest') {
    if (!checkGuestCode(password)) {
      return NextResponse.json({ success: false, error: '访客口令错误' }, { status: 401 });
    }
    clearRateLimit(ip);
    return withSession({ sub: 'guest', username: '访客', role: 'guest' }, req);
  }

  // —— 图形验证码：一次性，校验后即作废 ——
  if (!verifyCaptcha(body.captchaId, body.captchaCode)) {
    return NextResponse.json(
      { success: false, error: '图形验证码错误或已过期，请刷新验证码后重试', captcha: true },
      { status: 400 }
    );
  }

  if (mode === 'code') {
    const channel = body.channel === 'sms' ? 'sms' : 'email';
    const normalized = normalizeTarget(channel, body.target ?? '');
    if (normalized.error || !normalized.target) {
      return NextResponse.json({ success: false, error: normalized.error }, { status: 400 });
    }
    const verdict = verifyOtp(channel, normalized.target, String(body.code ?? ''));
    if (!verdict.ok) {
      return NextResponse.json({ success: false, error: verdict.error }, { status: 401 });
    }
    const user = ensureContactUser(channel, normalized.target);
    clearRateLimit(ip);
    return withSession(toIdentity(user), req);
  }

  if (mode === 'register') {
    let contact: { channel: 'email' | 'sms'; target: string } | undefined;
    if (body.email && String(body.email).trim()) {
      const normalized = normalizeTarget('email', String(body.email));
      if (normalized.error || !normalized.target) {
        return NextResponse.json({ success: false, error: normalized.error }, { status: 400 });
      }
      contact = { channel: 'email', target: normalized.target };
    } else if (body.phone && String(body.phone).trim()) {
      const normalized = normalizeTarget('sms', String(body.phone));
      if (normalized.error || !normalized.target) {
        return NextResponse.json({ success: false, error: normalized.error }, { status: 400 });
      }
      contact = { channel: 'sms', target: normalized.target };
    }
    const { user, error } = registerUser(username, password, contact);
    if (!user) return NextResponse.json({ success: false, error: error ?? '注册失败' }, { status: 400 });
    clearRateLimit(ip);
    return withSession(toIdentity(user), req);
  }

  // login
  const user = verifyCredentials(username, password);
  if (!user) {
    return NextResponse.json({ success: false, error: '用户名或密码错误' }, { status: 401 });
  }
  clearRateLimit(ip);
  return withSession(toIdentity(user), req);
}

/** GET：当前会话身份（未登录返回 user: null）。兼容 Cookie 与 Authorization: Bearer */
export async function GET(req: Request) {
  const identity = sessionIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ success: true, verified: false, user: null });
  // 角色可能在会话签发后被开发者改过（提升/取消管理员），以存储里的最新值为准
  if (identity.role !== 'guest') {
    const stored = findById(identity.sub);
    if (stored) {
      return NextResponse.json({ success: true, verified: true, user: toIdentity(stored), trusted: true });
    }
  }
  return NextResponse.json({ success: true, verified: true, user: identity });
}

/** DELETE：登出（保留设备凭证，方便下次一键登录） */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
