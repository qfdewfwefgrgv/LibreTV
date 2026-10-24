import crypto from 'node:crypto';

/**
 * 图形验证码（服务端生成、一次性校验）。
 * 不引第三方包：直接拼 SVG，返回 data URI 交给前端 <img> 渲染。
 * 存储放内存 Map——单容器部署足够；重启后旧验证码失效，用户刷新即可。
 */

const TTL_MS = 5 * 60 * 1000;
/** 去掉 0/O/1/I/L 等易混淆字符 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const store = new Map<string, { code: string; expiresAt: number }>();

function randInt(min: number, max: number): number {
  return min + crypto.randomInt(Math.max(1, max - min + 1));
}

function renderSvg(code: string): string {
  const W = 120;
  const H = 44;
  const colors = ['#2563eb', '#0ea5e9', '#1d4ed8', '#0f766e', '#7c3aed', '#b45309'];

  let chars = '';
  for (let i = 0; i < code.length; i++) {
    const x = 14 + i * 26 + randInt(-3, 3);
    const y = 31 + randInt(-3, 3);
    const rotate = randInt(-16, 16);
    chars +=
      `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" ` +
      `font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" ` +
      `fill="${colors[randInt(0, colors.length - 1)]}">${code[i]}</text>`;
  }

  let lines = '';
  for (let i = 0; i < 3; i++) {
    lines +=
      `<path d="M${randInt(0, W)} ${randInt(0, H)} Q ${randInt(0, W)} ${randInt(0, H)} ` +
      `${randInt(0, W)} ${randInt(0, H)}" stroke="${colors[randInt(0, colors.length - 1)]}" ` +
      `stroke-opacity="0.35" stroke-width="1.2" fill="none"/>`;
  }

  let dots = '';
  for (let i = 0; i < 26; i++) {
    dots += `<circle cx="${randInt(2, W - 2)}" cy="${randInt(2, H - 2)}" r="1" fill="#94a3b8" fill-opacity="0.4"/>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#f1f5f9"/>${dots}${lines}${chars}</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

/** 生成一张验证码：返回 id 与可直接展示的图片 data URI */
export function createCaptcha(): { id: string; image: string } {
  const id = crypto.randomBytes(12).toString('hex');
  const code = Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  store.set(id, { code, expiresAt: Date.now() + TTL_MS });
  return { id, image: renderSvg(code) };
}

/** 校验并立即作废（一次性，防重放） */
export function verifyCaptcha(id: string | undefined, input: string | undefined): boolean {
  const key = String(id || '').trim();
  const value = String(input || '').trim();
  if (!key || !value) return false;
  const entry = store.get(key);
  if (!entry) return false;
  store.delete(key);
  if (Date.now() > entry.expiresAt) return false;
  return entry.code.toLowerCase() === value.toLowerCase();
}

/** 定期清理过期验证码，避免 Map 无界增长 */
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of store) {
      if (now > entry.expiresAt) store.delete(id);
    }
  }, 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}
