// 批量生成人物立绘（Seedream，1:1，深色背景半身像）
// 用法：node scripts/gen-portraits-ai.mjs --provider ark [--only tatarchief]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const KEY = opt('key', process.env.ARK_API_KEY || '');
const BASE = opt('base', 'https://ark.cn-beijing.volces.com/api/v3');
const MODEL = opt('model', process.env.IMAGE_MODEL || 'doubao-seedream-5-5-261028');
const ONLY = opt('only', '');
const OUT = path.join(process.cwd(), 'public', 'game', 'portraits');

if (!KEY) { console.error('缺少 ARK_API_KEY'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const STYLE = '中国水墨武侠风格人物半身像立绘，写实古风，深墨色背景，正面微四分之三侧脸，眼神坚定，无文字无水印，方形构图，胸像及肩';

const PORTRAITS = {
  tatarchief: '北地鞑靼千夫长，甲胄结霜的厚重皮铠，络腮短须，戴铁盔，肩上披狼皮，手持弯刀露出刀柄',
  liangguan: '边军粮官，深色圆领文官袍外罩旧甲，面容削瘦、眼神闪烁，手中攥着粮册与算筹',
  zhenbei: '镇北侯，边军主帅，玄色重甲配兽吞护肩，长须及胸，一手按剑，气势威严',
};

async function gen(prompt, retries = 4) {
  for (let a = 1; a <= retries; a++) {
    try {
      const r = await fetch(`${BASE}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: MODEL, prompt, size: '2K', response_format: 'url', output_format: 'png', watermark: false }),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      const item = JSON.parse(t)?.data?.[0];
      if (item?.url) {
        const img = await fetch(item.url);
        if (!img.ok) throw new Error('下载失败 ' + img.status);
        return Buffer.from(await img.arrayBuffer());
      }
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
      throw new Error('无 url/b64: ' + t.slice(0, 160));
    } catch (e) {
      console.error(`  第 ${a} 次失败：${e.message}`);
      if (a === retries) throw e;
      await new Promise((res) => setTimeout(res, 2500 * a));
    }
  }
}

const keys = ONLY ? ONLY.split(',').map((s) => s.trim()).filter(Boolean) : Object.keys(PORTRAITS);
let ok = 0;
for (const k of keys) {
  if (!PORTRAITS[k]) { console.warn('未知立绘 ' + k); continue; }
  process.stdout.write(`[${k}] ... `);
  try {
    const buf = await gen(`${STYLE}：${PORTRAITS[k]}`);
    const webp = await sharp(buf).resize(768, 768, { fit: 'cover', position: 'top' }).webp({ quality: 88 }).toBuffer();
    fs.writeFileSync(path.join(OUT, `${k}.webp`), webp);
    console.log(`OK ${Math.round(webp.length / 1024)}KB`);
    ok++;
  } catch (e) {
    console.log(`失败：${e.message}`);
  }
}
console.log(`\n完成 ${ok}/${keys.length}`);
