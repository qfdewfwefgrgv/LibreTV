import crypto from 'node:crypto';
import net from 'node:net';
import os from 'node:os';
import tls from 'node:tls';

/**
 * 邮箱 / 手机验证码：生成、校验、发送。
 * - 6 位数字，5 分钟有效，最多试 5 次，同一目标 60 秒冷却；
 * - 发送通道按环境变量启用：SMTP_*（邮箱）、TENCENT_SMS_*（短信）；
 *   未配置时接口返回明确原因，前端据此提示「未开通」，不会静默失败。
 */

export type OtpChannel = 'email' | 'sms';

const TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

interface OtpEntry {
  code: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
}

const store = new Map<string, OtpEntry>();

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TENCENT_SMS_SECRET_ID &&
      process.env.TENCENT_SMS_SECRET_KEY &&
      process.env.TENCENT_SMS_SDK_APP_ID &&
      process.env.TENCENT_SMS_SIGN_NAME &&
      process.env.TENCENT_SMS_TEMPLATE_ID
  );
}

export function channelConfigured(channel: OtpChannel): boolean {
  return channel === 'email' ? isEmailConfigured() : isSmsConfigured();
}

/** 生成验证码；冷却期内返回剩余秒数 */
export function issueOtp(channel: OtpChannel, target: string): { code?: string; error?: string } {
  const key = `${channel}:${target}`;
  const now = Date.now();
  const current = store.get(key);
  if (current && now - current.sentAt < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - current.sentAt)) / 1000);
    return { error: `发送过于频繁，请 ${wait} 秒后再试` };
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  store.set(key, { code, expiresAt: now + TTL_MS, sentAt: now, attempts: 0 });
  return { code };
}

/** 发送失败时撤销本次占位，避免用户被冷却卡住却收不到码 */
export function cancelOtp(channel: OtpChannel, target: string): void {
  store.delete(`${channel}:${target}`);
}

/** 核对验证码：成功即作废；失败累计次数，超限作废 */
export function verifyOtp(channel: OtpChannel, target: string, code: string): { ok: boolean; error?: string } {
  const key = `${channel}:${target}`;
  const entry = store.get(key);
  if (!entry) return { ok: false, error: '验证码不存在或已过期，请重新获取' };
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { ok: false, error: '验证码已过期，请重新获取' };
  }
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, error: '验证码错误次数过多，请重新获取' };
  }
  if (entry.code !== code.trim()) {
    return { ok: false, error: `验证码不正确，还可尝试 ${MAX_ATTEMPTS - entry.attempts} 次` };
  }
  store.delete(key);
  return { ok: true };
}

/** 目标格式校验 */
export function normalizeTarget(channel: OtpChannel, raw: string): { target?: string; error?: string } {
  const value = String(raw || '').trim();
  if (!value) return { error: channel === 'email' ? '请输入邮箱地址' : '请输入手机号' };
  if (channel === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 120) return { error: '邮箱格式不正确' };
    return { target: value.toLowerCase() };
  }
  const digits = value.replace(/[\s-]/g, '');
  if (!/^(\+?86)?1[3-9]\d{9}$/.test(digits)) return { error: '手机号格式不正确（需中国大陆 11 位号码）' };
  return { target: digits.replace(/^\+?86/, '') };
}

// ———————— 发送通道 ————————

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function getSmtp(): SmtpConfig | null {
  if (!isEmailConfigured()) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  return {
    host: process.env.SMTP_HOST!.trim(),
    port: Number.isFinite(port) ? port : 465,
    secure,
    user: process.env.SMTP_USER!.trim(),
    pass: process.env.SMTP_PASS!.trim(),
    from: (process.env.SMTP_FROM || process.env.SMTP_USER!).trim(),
  };
}

/** 极简 SMTP 客户端：只做 AUTH LOGIN + 一封纯文本邮件，不引第三方包 */
class SmtpClient {
  private buf = '';
  private pending: { resolve: (s: string) => void; reject: (e: Error) => void } | null = null;
  private socket: net.Socket;

  constructor(host: string, port: number, secure: boolean) {
    this.socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });
    this.bind(this.socket);
    this.socket.setTimeout(15000, () => this.fail(new Error('SMTP 连接超时')));
  }

  private bind(socket: net.Socket) {
    socket.on('data', (chunk) => this.onData(chunk.toString('utf8')));
    socket.on('error', (err) => this.fail(err));
  }

  private onData(chunk: string) {
    this.buf += chunk;
    if (!this.buf.endsWith('\r\n')) return;
    const lines = this.buf.split('\r\n').filter(Boolean);
    if (lines.length === 0) return;
    if (!/^\d{3} /.test(lines[lines.length - 1])) return;
    const reply = this.buf;
    this.buf = '';
    const pending = this.pending;
    this.pending = null;
    pending?.resolve(reply);
  }

  private fail(err: Error) {
    const pending = this.pending;
    this.pending = null;
    pending?.reject(err);
    try { this.socket.destroy(); } catch { /* 忽略 */ }
  }

  expect(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
    });
  }

  async cmd(line: string, ok: number[]): Promise<string> {
    this.socket.write(line + '\r\n');
    const reply = await this.expect();
    const code = parseInt(reply.slice(0, 3), 10);
    if (!ok.includes(code)) throw new Error(`SMTP 拒绝（${reply.slice(0, 160).replace(/\r?\n/g, ' ')}）`);
    return reply;
  }

  async startTls(host: string) {
    const secured = tls.connect({ socket: this.socket, servername: host });
    this.socket = secured;
    this.bind(secured);
    await new Promise<void>((resolve, reject) => {
      secured.once('secureConnect', resolve);
      secured.once('error', reject);
    });
  }

  close() {
    try { this.socket.destroy(); } catch { /* 忽略 */ }
  }
}

function encodeHeader(value: string): string {
  return '=?UTF-8?B?' + Buffer.from(value, 'utf8').toString('base64') + '?=';
}

async function sendMail(cfg: SmtpConfig, to: string, subject: string, text: string): Promise<void> {
  const client = new SmtpClient(cfg.host, cfg.port, cfg.secure);
  try {
    const greeting = await client.expect();
    if (!/^220/.test(greeting)) throw new Error(`SMTP 服务未就绪（${greeting.slice(0, 80)}）`);
    const hostname = os.hostname() || 'libretv';
    await client.cmd(`EHLO ${hostname}`, [250]);
    if (!cfg.secure) {
      await client.cmd('STARTTLS', [220]);
      await client.startTls(cfg.host);
      await client.cmd(`EHLO ${hostname}`, [250]);
    }
    await client.cmd('AUTH LOGIN', [334]);
    await client.cmd(Buffer.from(cfg.user, 'utf8').toString('base64'), [334]);
    await client.cmd(Buffer.from(cfg.pass, 'utf8').toString('base64'), [235]);
    await client.cmd(`MAIL FROM:<${cfg.from}>`, [250]);
    await client.cmd(`RCPT TO:<${to}>`, [250, 251]);
    await client.cmd('DATA', [354]);

    const body = Buffer.from(text, 'utf8').toString('base64');
    const message = [
      `From: ${encodeHeader('LibreTV')} <${cfg.from}>`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      body,
      '',
      '.',
    ].join('\r\n');
    await client.cmd(message, [250]);
    await client.cmd('QUIT', [221]).catch(() => {});
  } finally {
    client.close();
  }
}

async function sendTencentSms(target: string, code: string): Promise<void> {
  const secretId = process.env.TENCENT_SMS_SECRET_ID!.trim();
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY!.trim();
  const host = 'sms.tencentcloudapi.com';
  const service = 'sms';
  const action = 'SendSms';
  const version = '2021-01-11';
  const region = (process.env.TENCENT_SMS_REGION || 'ap-guangzhou').trim();

  const payload = JSON.stringify({
    PhoneNumberSet: [target.startsWith('+') ? target : `+86${target}`],
    SmsSdkAppId: process.env.TENCENT_SMS_SDK_APP_ID!.trim(),
    SignName: process.env.TENCENT_SMS_SIGN_NAME!.trim(),
    TemplateId: process.env.TENCENT_SMS_TEMPLATE_ID!.trim(),
    TemplateParamSet: [code, '5'],
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${host}\n`,
    'content-type;host',
    payloadHash,
  ].join('\n');
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const secretDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`,
      'Content-Type': 'application/json; charset=utf-8',
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': region,
    },
    body: payload,
    signal: AbortSignal.timeout(12000),
  });
  const data = (await res.json().catch(() => null)) as
    | { Response?: { Error?: { Code?: string; Message?: string }; SendStatusSet?: { Code?: string }[] } }
    | null;
  const error = data?.Response?.Error;
  if (error) throw new Error(`短信发送失败：${error.Code || ''} ${error.Message || ''}`.trim());
  const status = data?.Response?.SendStatusSet?.[0]?.Code;
  if (status && status !== 'Ok') throw new Error(`短信发送失败：${status}`);
}

/** 发送验证码；未配置通道时抛出明确原因 */
export async function sendOtp(channel: OtpChannel, target: string, code: string): Promise<void> {
  if (channel === 'email') {
    const cfg = getSmtp();
    if (!cfg) throw new Error('未配置邮件服务（SMTP_HOST / SMTP_USER / SMTP_PASS），无法发送验证码');
    await sendMail(
      cfg,
      target,
      'LibreTV 登录验证码',
      `你的 LibreTV 登录验证码是 ${code}，5 分钟内有效。\r\n如非本人操作请忽略本邮件。`
    );
    return;
  }
  if (!isSmsConfigured()) {
    throw new Error('未配置短信服务（TENCENT_SMS_*），无法发送验证码');
  }
  await sendTencentSms(target, code);
}

if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expiresAt + 30 * 60 * 1000) store.delete(key);
    }
  }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}
