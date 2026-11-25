// 从现有贴片生成无缝变体：镜像接缝 + 色调分离，输出 1024×1024
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = 'C:/Users/机智如我/Documents/Trae-CN/temp_20261018_01/libretv-space/public/game/world/tiles';

/** 把图做成四向镜像的 2×2 块 → 保证上下左右无缝 */
async function seamless(buf) {
  const meta = await sharp(buf).metadata();
  const w = meta.width;
  const h = meta.height;
  const flipX = await sharp(buf).flop().toBuffer();
  const flipY = await sharp(buf).flip().toBuffer();
  const flipXY = await sharp(buf).flop().flip().toBuffer();
  return sharp({ create: { width: w * 2, height: h * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: buf, left: 0, top: 0 },
      { input: flipX, left: w, top: 0 },
      { input: flipY, left: 0, top: h },
      { input: flipXY, left: w, top: h },
    ])
    .png()
    .toBuffer();
}

async function make(srcName, outPrefix, variants) {
  const src = path.join(DIR, srcName);
  if (!fs.existsSync(src)) { console.log('缺图:', srcName); return; }
  const raw = fs.readFileSync(src);
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    let img = sharp(raw);
    if (v.mirror) {
      img = sharp(await seamless(raw));
    }
    img = img.modulate({
      brightness: v.brightness ?? 1,
      saturation: v.saturation ?? 1,
      hue: v.hue ?? 0,
    });
    if (v.contrast) img = img.linear(v.contrast, -(128 * (v.contrast - 1)));
    const out = await img.resize(1024, 1024, { fit: 'cover', position: 'centre' }).webp({ quality: 90 }).toBuffer();
    const name = `${outPrefix}-${i + 1}.webp`;
    fs.writeFileSync(path.join(DIR, name), out);
    console.log(name, Math.round(out.length / 1024) + 'KB');
  }
}

await make('tile-ground.webp', 'tile-ground', [
  { mirror: true, brightness: 1.0, saturation: 1.0, hue: 0 },
  { mirror: false, brightness: 0.94, saturation: 0.88, hue: -6 },
  { mirror: true, brightness: 1.05, saturation: 1.08, hue: 8 },
  { mirror: false, brightness: 1.0, saturation: 0.95, hue: -14, contrast: 1.08 },
]);

await make('tile-road.webp', 'tile-road', [
  { mirror: true, brightness: 1.0, saturation: 1.0, hue: 0 },
  { mirror: false, brightness: 0.96, saturation: 0.9, hue: 6, contrast: 1.06 },
]);
