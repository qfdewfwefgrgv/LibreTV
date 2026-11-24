// 生成天牢场景 / 囚犯立绘 / 藏宝图道具（火山方舟 doubao-seedream）
// 用法：node scripts/gen-jail-assets.mjs [--only prison-l1,xuanyin]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = opt('base', 'https://ark.cn-beijing.volces.com/api/v3');
const KEY = opt('key', process.env.ARK_API_KEY || process.env.IMAGE_API_KEY || '');
const MODEL = opt('model', process.env.IMAGE_MODEL || 'doubao-seedream-5-5-261028');
const ONLY = opt('only', '');

if (!KEY) { console.error('缺少 ARK_API_KEY'); process.exit(2); }

const ROOT = path.join(process.cwd(), 'public', 'game');

const STYLE = '中国水墨武侠风格，写实光影，厚重笔触，无文字无水印';

/** 场景 16:9 */
const SCENES = {
  'prison-l1': `${STYLE}，天牢第一层地下石牢走廊，粗铁栅栏与厚重石门，墙上火把投下摇曳橙光，地面湿滑反光，纵深向黑暗处延伸，冷青灰主调，压抑阴森，横向宽幅构图，无人物`,
  'prison-l2': `${STYLE}，天牢第二层更深的石室，悬垂的铁链与镣铐，墙上有陈旧血痕，单盏油灯暖黄微光，暗红与冷灰强对比，横向宽幅构图，无人物`,
};

/** 立绘 3:4 竖版 */
const PORTRAITS = {
  'prisoner-duyan': `${STYLE}，人物立绘半身，独眼盗：独眼蒙黑布、络腮短须、破旧皮甲、肩甲残破、狞笑露齿，正面微侧，深暗背景，冷灰与皮革棕`,
  'prisoner-duanhun': `${STYLE}，人物立绘半身，断魂刀客：瘦高身形、斗笠压眉、眼神阴冷、手持窄刃短刀贴臂，正面微侧，深暗背景，青黑调`,
  'prisoner-duwang': `${STYLE}，人物立绘半身，毒王：灰白长发散乱、腰间挂满药囊与小瓶、指甲发黑、病态微笑，正面微侧，深暗背景，暗绿调`,
  'prisoner-xuanyin': `${STYLE}，人物立绘半身，玄阴老人：枯瘦老者、玄色宽袍、眼底泛青、双手笼在袖中、神情漠然，正面微侧，深暗背景，玄青调`,
  'prisoner-wujian': `${STYLE}，人物立绘半身，无名剑客：白衣、长发半遮面、抱剑而立、气质孤冷，正面微侧，深暗背景，素白与冷灰`,
  'prisoner-panmen': `${STYLE}，人物立绘半身，叛门长老：灰袍老者、额头旧疤、手持半卷残破经书、神情倨傲，正面微侧，深暗背景，灰褐调`,
};

/** 道具 */
const ITEMS = {
  'treasure-map': `${STYLE}，一张泛黄残破的羊皮藏宝图铺展，边缘焦黑卷曲，墨线绘山形与水路，纸面有水渍与折痕，俯视，深色背景衬托`,
  'treasure-chest': `${STYLE}，古旧木箱加铜锁，箱盖半开，露出一角布帛与金光，木纹与铜锈质感清晰，正视，深色背景`,
};

const TASKS = [
  ...Object.entries(SCENES).map(([key, prompt]) => ({ key, prompt, dir: 'scenes', w: 1600, h: 900, size: '2K' })),
  ...Object.entries(PORTRAITS).map(([key, prompt]) => ({ key, prompt, dir: 'portraits', w: 768, h: 1024, size: '2K' })),
  ...Object.entries(ITEMS).map(([key, prompt]) => ({ key, prompt, dir: 'items', w: 1024, h: 768, size: '2K' })),
];

async function generate(prompt, size, retries = 3) {
  const url = `${BASE}/images/generations`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: MODEL, prompt, size, response_format: 'url', output_format: 'png', watermark: false }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 260)}`);
      const data = JSON.parse(text);
      const item = data?.data?.[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
      if (item?.url) {
        const img = await fetch(item.url);
        if (!img.ok) throw new Error(`下载失败 HTTP ${img.status}`);
        return Buffer.from(await img.arrayBuffer());
      }
      throw new Error('响应无图：' + text.slice(0, 160));
    } catch (e) {
      console.error(`  第 ${attempt} 次失败：${e.message}`);
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 2500 * attempt));
    }
  }
}

const picked = ONLY ? TASKS.filter((t) => ONLY.split(',').map((s) => s.trim()).includes(t.key)) : TASKS;
let ok = 0;
const failed = [];

for (const t of picked) {
  process.stdout.write(`[${ok + failed.length + 1}/${picked.length}] ${t.key} ... `);
  try {
    const buf = await generate(t.prompt, t.size);
    const outDir = path.join(ROOT, t.dir);
    fs.mkdirSync(outDir, { recursive: true });
    const webp = await sharp(buf)
      .resize(t.w, t.h, { fit: 'cover', position: 'centre' })
      .webp({ quality: 88 })
      .toBuffer();
    fs.writeFileSync(path.join(outDir, `${t.key}.webp`), webp);
    console.log(`OK ${Math.round(webp.length / 1024)}KB -> ${t.dir}/${t.key}.webp`);
    ok++;
  } catch (e) {
    console.log(`失败：${e.message}`);
    failed.push(t.key);
  }
}

console.log(`\n完成 ${ok}/${picked.length}${failed.length ? `，失败：${failed.join(',')}` : ''}`);
process.exit(failed.length ? 1 : 0);
