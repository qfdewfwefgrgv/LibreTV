// 批量生成《江湖风云录》22 张场景原画（OpenAI 兼容图像接口）
// 用法：
//   node scripts/gen-scenes-ai.mjs --base https://api.example.com/v1 --key sk-xxx --model gpt-image-1 [--size 1536x1024] [--only huashan,inn]
// 产物：public/game/scenes/<key>.webp（1600x900）
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = (opt('base', process.env.IMAGE_BASE_URL || (opt('provider', 'openai') === 'ark' ? 'https://ark.cn-beijing.volces.com/api/v3' : ''))).replace(/\/+$/, '');
const KEY = opt('key', process.env.IMAGE_API_KEY || process.env.ARK_API_KEY || '');
const PROVIDER = opt('provider', 'openai');
const MODEL = opt('model', process.env.IMAGE_MODEL || (PROVIDER === 'ark' ? 'doubao-seedream-5-5-261028' : 'gpt-image-1'));
// 方舟 5.x 支持 "1K"/"2K"/"4K" 档位；先出 2K，再由 sharp 裁成 1600x900
const SIZE = opt('size', PROVIDER === 'ark' ? '2K' : '1536x1024');
const OUT_FORMAT = opt('format', 'png');
const ONLY = opt('only', '');
const OUT = path.join(process.cwd(), 'public', 'game', 'scenes');

if (!BASE || !KEY) {
  console.error('缺少参数：--base <接口地址> 与 --key <密钥>');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

// 每个场景单独写的提示词：统一水墨武侠横版构图，各自有明确主体
const SCENES = {
  'luoyang-snow': '中国水墨武侠风格场景插画，洛阳古城雪夜，青灰城墙与重檐城楼覆着残雪，城门洞透出暖黄灯火，远处群山淡墨，夜色冷蓝，横向宽幅构图，无人物无文字',
  village: '中国水墨武侠风格场景插画，山脚小村落黄昏，茅草屋顶与木栅栏，几缕炊烟，牛车与柴垛，暖褐色天光，横向宽幅构图，无人物无文字',
  temple: '中国水墨武侠风格场景插画，深山破庙，斑驳朱漆山门与残破飞檐，石阶生苔，廊下一点孤灯，青绿冷调，横向宽幅构图，无人物无文字',
  ferry: '中国水墨武侠风格场景插画，江边渡口清晨薄雾，一叶乌篷船系在木桩旁，水面淡墨倒影，远岸芦苇与低山，青蓝冷调，横向宽幅构图，无人物无文字',
  lantern: '中国水墨武侠风格场景插画，上元灯市夜，街道两侧木楼挂满朱红灯笼，暖光映雪，人流虚化剪影，横向宽幅构图，无文字',
  inn: '中国水墨武侠风格场景插画，古镇客栈夜景，两层木楼挑着酒旗与灯笼，门前石阶与马车，窗内透出暖黄灯光，横向宽幅构图，无人物无文字',
  stronghold: '中国水墨武侠风格场景插画，山寨聚义厅，木栅城墙上插着朱红破旗，火盆与兵器架，暗红火光，阴云压顶，横向宽幅构图，无人物无文字',
  jiangnan: '中国水墨武侠风格场景插画，江南水乡，白墙黛瓦沿河而建，石拱桥横跨水面，垂柳拂水，烟雨朦胧，青绿淡雅，横向宽幅构图，无人物无文字',
  valley: '中国水墨武侠风格场景插画，药王谷深处，竹篱茅舍与药圃，石径旁晾着草药，溪流与薄雾，柔和青绿光，横向宽幅构图，无人物无文字',
  mist: '中国水墨武侠风格场景插画，浓雾森林，高大松树的黑色剪影层层递进，雾气弥漫留白，冷灰调，横向宽幅构图，无人物无文字',
  dungeon: '中国水墨武侠风格场景插画，地下石室，粗糙石壁与铁链，火把投下暗红光影，地面刻着暗纹，幽深压抑，横向宽幅构图，无人物无文字',
  'sword-mound': '中国水墨武侠风格场景插画，剑冢，黄土丘上插满无数残破长剑，锈迹斑斑直指天空，薄雾与冷光，横向宽幅构图，无人物无文字',
  peak: '中国水墨武侠风格场景插画，断魂崖，陡峭绝壁与翻涌云海，崖边一棵孤松，天光从云隙洒下，冷蓝灰调，横向宽幅构图，无人物无文字',
  huashan: '中国水墨武侠风格场景插画，华山之巅日出，险峻花岗岩峰林与苍劲松树，云海翻腾被朝阳染成金红，气势开阔，横向宽幅构图，无人物无文字',
  fuzhou: '中国水墨武侠风格场景插画，福州港城，码头木栈桥与停泊的帆船，海面粼粼，岸边商铺旗幡，青蓝海色，横向宽幅构图，无人物无文字',
  hanyang: '中国水墨武侠风格场景插画，汉阳药市街景，两侧店铺挂着药字幌子与灯笼，石板路与木棚，暖黄灯光，人流虚化，横向宽幅构图，无文字',
  taishan: '中国水墨武侠风格场景插画，泰山十八盘，陡直石阶蜿蜒上山的之字形，两侧绝壁与松树，晨雾弥漫，冷灰-blue 调，横向宽幅构图，无人物无文字',
  songshan: '中国水墨武侠风格场景插画，嵩山山门，古朴石牌坊与松林，山道通向云中殿宇，青灰墨绿调，横向宽幅构图，无人物无文字',
  shaolin: '中国水墨武侠风格场景插画，少林藏经阁，青砖殿宇与层层飞檐，院内古柏与石灯，香烟缭绕，赭黄金调，横向宽幅构图，无人物无文字',
  wudang: '中国水墨武侠风格场景插画，武当金顶，绝壁之上铜殿与云海，松枝横斜，青蓝云雾，横向宽幅构图，无人物无文字',
  emei: '中国水墨武侠风格场景插画，峨眉金顶云海佛光，金色殿宇与经幡，雪松与云涛，暖金晨光，横向宽幅构图，无人物无文字',
  taiyi: '中国水墨武侠风格场景插画，太乙山三生塔，三层古塔立于山脊，野草石阶，暮色苍茫，紫青色调，横向宽幅构图，无人物无文字',
};

async function generate(prompt, retries = 3) {
  const url = `${BASE}/images/generations`;
  const body = PROVIDER === 'ark'
    ? { model: MODEL, prompt, size: SIZE, response_format: 'url', output_format: OUT_FORMAT, watermark: false }
    : { model: MODEL, prompt, n: 1, size: SIZE };
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const item = data?.data?.[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
      if (item?.url) {
        const img = await fetch(item.url);
        if (!img.ok) throw new Error(`下载失败 HTTP ${img.status}`);
        return Buffer.from(await img.arrayBuffer());
      }
      throw new Error('响应里既没有 b64_json 也没有 url：' + text.slice(0, 200));
    } catch (e) {
      console.error(`  第 ${attempt} 次失败：${e.message}`);
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const keys = ONLY ? ONLY.split(',').map((s) => s.trim()).filter(Boolean) : Object.keys(SCENES);
let ok = 0;
const failed = [];

for (const key of keys) {
  const prompt = SCENES[key];
  if (!prompt) { console.warn(`跳过未知场景 ${key}`); continue; }
  process.stdout.write(`[${ok + failed.length + 1}/${keys.length}] ${key} ... `);
  try {
    const buf = await generate(prompt);
    const webp = await sharp(buf).resize(1600, 900, { fit: 'cover', position: 'centre' }).webp({ quality: 88 }).toBuffer();
    fs.writeFileSync(path.join(OUT, `${key}.webp`), webp);
    console.log(`OK ${Math.round(webp.length / 1024)}KB`);
    ok++;
  } catch (e) {
    console.log(`失败：${e.message}`);
    failed.push(key);
  }
}

console.log(`\n完成 ${ok}/${keys.length}${failed.length ? `，失败：${failed.join(',')}` : ''}`);
process.exit(failed.length ? 1 : 0);
