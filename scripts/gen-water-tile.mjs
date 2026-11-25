// 程序生成可平铺的水面材质（无需外部美术）
// 做法：多层正弦波纹 + 值噪声 + 微弱高光 → 四向镜像无缝 → 输出 1024
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = 'C:/Users/机智如我/Documents/Trae-CN/temp_20261018_01/libretv-space/public/game/world/tiles/tile-water.webp';

const S = 512; // 基础尺寸，镜像后 1024

// 简易可复现值噪声
function hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, y) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < 4; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    freq *= 2; amp *= 0.5;
  }
  return sum;
}

const buf = Buffer.alloc(S * S * 3);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    // 水面：以噪声为主，叠加被噪声扰动过的横向微波（避免规则干涉纹）
    const n1 = fbm(x / 90, y / 90);
    const n2 = fbm(x / 26 + 40, y / 26 + 17);
    const wave = Math.sin((y * 0.045 + n2 * 6.0) * Math.PI) * 0.5 + 0.5;
    let v = 0.48 + (n1 - 0.5) * 0.42 + (n2 - 0.5) * 0.26 + (wave - 0.5) * 0.14;
    v = Math.max(0, Math.min(1, v));

    // 深青绿 → 稍亮青绿
    const dark = [0.05, 0.16, 0.19];
    const light = [0.24, 0.44, 0.48];
    const t = v;
    const i = (y * S + x) * 3;
    buf[i] = Math.round((dark[0] + (light[0] - dark[0]) * t) * 255);
    buf[i + 1] = Math.round((dark[1] + (light[1] - dark[1]) * t) * 255);
    buf[i + 2] = Math.round((dark[2] + (light[2] - dark[2]) * t) * 255);
  }
}

const base = await sharp(buf, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer();

// 四向镜像 → 无缝
const fx = await sharp(base).flop().toBuffer();
const fy = await sharp(base).flip().toBuffer();
const fxy = await sharp(base).flop().flip().toBuffer();
const seamless = await sharp({
  create: { width: S * 2, height: S * 2, channels: 3, background: { r: 0, g: 0, b: 0 } },
})
  .composite([
    { input: base, left: 0, top: 0 },
    { input: fx, left: S, top: 0 },
    { input: fy, left: 0, top: S },
    { input: fxy, left: S, top: S },
  ])
  .png()
  .toBuffer();

const out = await sharp(seamless)
  .resize(1024, 1024, { fit: 'cover' })
  .blur(0.4)
  .webp({ quality: 90 })
  .toBuffer();

fs.writeFileSync(OUT, out);
console.log(path.basename(OUT), Math.round(out.length / 1024) + 'KB');
