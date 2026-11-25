// 统一美术调色：降饱和、压亮部、加对比、轻微锐化 → 更写实沉稳
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const TILES = 'C:/Users/机智如我/Documents/Trae-CN/temp_20261018_01/libretv-space/public/game/world/tiles';

const FILES = [
  'tile-ground-1.webp',
  'tile-ground-2.webp',
  'tile-ground-3.webp',
  'tile-ground-4.webp',
  'tile-road-1.webp',
  'tile-road-2.webp',
  'obj-house-a.webp',
  'obj-house-b.webp',
  'obj-temple.webp',
  'obj-inn.webp',
  'obj-gate.webp',
  'obj-wall.webp',
  'obj-tree.webp',
  'obj-lantern.webp',
  'obj-bridge.webp',
];

for (const f of FILES) {
  const p = path.join(TILES, f);
  if (!fs.existsSync(p)) { console.log('缺图:', f); continue; }
  const src = fs.readFileSync(p);
  const meta = await sharp(src).metadata();
  const out = await sharp(src)
    // 降饱和 + 压 brightness，去掉糖果感
    .modulate({ saturation: 0.68, brightness: 0.94 })
    // 对比：out = in * 1.08 - 10
    .linear(1.08, -10)
    // 轻微锐化，保留细节
    .sharpen({ sigma: 0.6 })
    .webp({ quality: 88 })
    .toBuffer();
  fs.writeFileSync(p, out);
  console.log(f.padEnd(22), `${meta.width}x${meta.height}`, Math.round(out.length / 1024) + 'KB');
}
