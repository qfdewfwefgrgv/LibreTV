import crypto from 'node:crypto';

/**
 * 会话鉴权：httpOnly cookie + HMAC 签名。
 *
 * 相比旧版的改进：
 * - 页面源码不再下发 sha256(password)，前端拿不到任何可重放的凭证；
 * - 兼容模式「哈希即凭证」被彻底移除；
 * - 登录接口只接受 POST body，不再把明文密码放 query。
 */

export const SESSION_COOKIE = 'ltv_session';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 天

export function getPassword(): string {
  return process.env.PASSWORD || '';
}

export function isPasswordConfigured(): boolean {
  return getPassword().length > 0;
}

function getSecret(): string {
  if (process.env.PROXY_SECRET) return process.env.PROXY_SECRET;
  return crypto.createHash('sha256').update(getPassword() + ':libretv::session-salt').digest('hex');
}

function hmac(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/** 生成签名会话 token：`<expiresAtMs>.<hmac>` */
export function signSession(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return { token: `${payload}.${hmac(payload)}`, expiresAt };
}

/** 校验会话 token 的签名与有效期 */
export function verifySession(token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const expiresAt = parseInt(payload, 10);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

/** 访客口令：默认 libretv，可用 GUEST_CODE 覆盖；无需注册、无需图形验证码 */
export function getGuestCode(): string {
  return process.env.GUEST_CODE || 'libretv';
}

/** 恒定时间比较访客口令 */
export function checkGuestCode(input: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(getGuestCode()).digest();
  return crypto.timingSafeEqual(a, b);
}

/** 恒定时间比较密码（比较 sha256 摘要避免长度泄漏） */
export function checkPassword(input: string): boolean {
  const password = getPassword();
  if (!password) return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(password).digest();
  return crypto.timingSafeEqual(a, b);
}

/** 从请求 Cookie 中解析会话 */
export function sessionFromCookieHeader(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const eq = c.indexOf('=');
    if (eq === -1) continue;
    const name = c.slice(0, eq).trim();
    if (name === SESSION_COOKIE) {
      return verifySession(decodeURIComponent(c.slice(eq + 1).trim()));
    }
  }
  return false;
}

// —— 带用户身份的会话（访客 / 普通用户 / 管理员 / 开发者） ——

export interface SessionIdentity {
  sub: string;
  username: string;
  role: 'guest' | 'user' | 'admin' | 'developer';
}

/** 生成携带身份的会话：`<expiresAt>.<base64url(json)>.<hmac>` */
export function signSessionFor(identity: SessionIdentity): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const encoded = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url');
  const payload = `${expiresAt}.${encoded}`;
  return { token: `${payload}.${hmac(payload)}`, expiresAt };
}

/** 解析身份会话；旧格式（只有过期时间）按访客处理，保证老 cookie 不被强制登出 */
export function readSessionIdentity(token: string | undefined | null): SessionIdentity | null {
  const raw = decodeSignedToken(token);
  if (!raw) return null;
  // 设备免密凭证不能直接当会话用：必须走一次 /api/auth mode=device 换发
  if ('dv' in raw) return null;
  if (typeof raw.sub === 'string' && typeof raw.username === 'string' && typeof raw.role === 'string') {
    return { sub: raw.sub, username: raw.username, role: raw.role as SessionIdentity['role'] };
  }
  return null;
}

/** 签名 token 的通用解码：校验签名与有效期，返回 JSON 载荷 */
function decodeSignedToken(token: string | undefined | null): Record<string, unknown> | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const segments = payload.split('.');
  const expiresAt = parseInt(segments[0], 10);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return null;

  if (segments.length === 1) {
    // 旧格式：只有过期时间，说明是早期「统一密码」会话 → 访客
    return { sub: 'guest', username: '访客', role: 'guest' };
  }
  try {
    return JSON.parse(Buffer.from(segments.slice(1).join('.'), 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function sessionIdentityFromCookieHeader(cookieHeader: string | null): SessionIdentity | null {
  return readSessionIdentity(readCookie(cookieHeader, SESSION_COOKIE));
}

/** 从 Authorization 头提取 Bearer token */
function readBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(authHeader);
  return m ? m[1] : null;
}

/**
 * 从请求中解析会话身份：优先 Cookie，其次 Authorization: Bearer <token>。
 * 浏览器走 Cookie（httpOnly，防 XSS 窃取）；外部/移动端可直接带 token 调用 API。
 */
export function sessionIdentityFromRequest(req: Request): SessionIdentity | null {
  const fromCookie = sessionIdentityFromCookieHeader(req.headers.get('cookie'));
  if (fromCookie) return fromCookie;
  return readSessionIdentity(readBearerToken(req.headers.get('authorization')));
}

/** 简化版：仅判断是否已登录（不关心身份），同样兼容 Cookie 与 Bearer */
export function sessionFromRequest(req: Request): boolean {
  if (sessionFromCookieHeader(req.headers.get('cookie'))) return true;
  return verifySession(readBearerToken(req.headers.get('authorization')));
}

/** 读取指定 cookie（已做 URL 解码） */
export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const c of cookieHeader.split(';')) {
    const eq = c.indexOf('=');
    if (eq === -1) continue;
    if (c.slice(0, eq).trim() === name) return decodeURIComponent(c.slice(eq + 1).trim());
  }
  return null;
}

// —— 本机免密凭证（设备 cookie）——

export const DEVICE_COOKIE = 'ltv_device';
const DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 天

/**
 * 设备凭证：登录成功后下发，用于「本机一键登录」。
 * 只作为换发会话的凭据，不能直接当 session（见 readSessionIdentity 对 dv 的拒绝）。
 */
export function signDeviceToken(identity: SessionIdentity): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + DEVICE_TTL_MS;
  const encoded = Buffer.from(JSON.stringify({ ...identity, dv: 1 }), 'utf8').toString('base64url');
  const payload = `${expiresAt}.${encoded}`;
  return { token: `${payload}.${hmac(payload)}`, expiresAt };
}

/** 解析设备 cookie；无效/过期/不是设备凭证都返回 null */
export function readDeviceIdentity(cookieHeader: string | null): SessionIdentity | null {
  const raw = decodeSignedToken(readCookie(cookieHeader, DEVICE_COOKIE));
  if (!raw || raw.dv !== 1) return null;
  if (typeof raw.sub === 'string' && typeof raw.username === 'string' && typeof raw.role === 'string') {
    return { sub: raw.sub, username: raw.username, role: raw.role as SessionIdentity['role'] };
  }
  return null;
}

// —— 登录速率限制（内存实现，单实例部署足够；多实例可换 Redis） ——

const attemptMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attemptMap.get(ip);
  if (!entry || now > entry.resetAt) {
    attemptMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export function clearRateLimit(ip: string): void {
  attemptMap.delete(ip);
}

// 定期清理过期限流记录，避免长期运行下 Map 膨胀
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of attemptMap) {
      if (now > entry.resetAt) attemptMap.delete(ip);
    }
  }, 60 * 1000);
  // 不阻止 Node 进程退出
  if (typeof timer.unref === 'function') timer.unref();
}
