// 生成《江湖风云录》本地场景背景（水墨武侠风 SVG · 具象版）
// 用法：node scripts/gen-jianghu-scenes.mjs
// 产物：public/game/scenes/<key>.svg
// 说明：全部为程序绘制的矢量插画，不复制任何第三方美术资源。
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'public', 'game', 'scenes');
fs.mkdirSync(OUT, { recursive: true });

const W = 1600, H = 900;

/** 场景配置 */
const SCENES = {
  'luoyang-snow': { sky: ['#0f1826', '#2c4763', '#9fb6cc'], light: ['#e8f2ff', 1180, 170, 170], props: ['wall', 'snowtree'], snow: true, weather: 'snow' },
  village:        { sky: ['#241a12', '#6b4f33', '#d3a874'], light: ['#ffd79a', 380, 200, 150], props: ['houses', 'trees'], smoke: true },
  temple:         { sky: ['#131c18', '#2f4a3b', '#7f9b83'], light: ['#e8f0d8', 860, 190, 150], props: ['temple'], mist: 1 },
  ferry:          { sky: ['#0e1c23', '#28505c', '#8fb8be'], light: ['#cfeef2', 1300, 220, 150], props: ['boat', 'water'], water: true },
  lantern:        { sky: ['#1d0c14', '#6b2b32', '#d1784f'], light: ['#ffcf8a', 760, 210, 180], props: ['houses', 'lanterns'], lanterns: 10 },
  inn:            { sky: ['#1c150e', '#5b4425', '#c39a5e'], light: ['#ffdca0', 1060, 230, 160], props: ['inn'], lanterns: 6 },
  stronghold:     { sky: ['#160c0c', '#43181a', '#8c4a3a'], light: ['#ff9a6a', 480, 190, 140], props: ['wall', 'banners'], fire: true },
  jiangnan:       { sky: ['#0f1d1b', '#2b5449', '#9cc4ad'], light: ['#e6f6e2', 1200, 200, 160], props: ['bridge', 'water', 'willow'], water: true },
  valley:         { sky: ['#111b14', '#31513a', '#9dbf95'], light: ['#eaf6e0', 820, 190, 150], props: ['trees', 'water'], water: true, mist: 1 },
  mist:           { sky: ['#141a21', '#364654', '#a6b7c3'], light: ['#e2eef7', 700, 180, 190], props: ['trees', 'pines'], mist: 1.6 },
  dungeon:        { sky: ['#0e0a12', '#281a30', '#5b4058'], light: ['#c9a0d8', 960, 250, 120], props: ['wall', 'banners'], fire: true },
  'sword-mound':  { sky: ['#12171b', '#33424a', '#93a1a9'], light: ['#e6f0f5', 1240, 190, 150], props: ['swords'], mist: 1.1 },
  peak:           { sky: ['#0b1420', '#264664', '#9dc0d9'], light: ['#d9ecff', 1060, 160, 150], props: ['cliff', 'pines'], mist: 1.2 },
  huashan:        { sky: ['#1d1410', '#6b4526', '#e8b476'], light: ['#ffd08a', 1140, 155, 185], props: ['cliff', 'pines'] },
  fuzhou:         { sky: ['#0b1a22', '#20495a', '#8ab9c4'], light: ['#cdeef5', 1330, 225, 150], props: ['boat', 'water', 'houses'], water: true },
  hanyang:        { sky: ['#191410', '#4f3b26', '#b8925f'], light: ['#ffd9a0', 600, 225, 155], props: ['houses', 'lanterns'], lanterns: 8 },
  taishan:        { sky: ['#101418', '#33444d', '#9aacb4'], light: ['#e8f2f7', 900, 165, 145], props: ['cliff', 'stairs'], mist: 1.3 },
  songshan:       { sky: ['#0d1613', '#284132', '#8aa590'], light: ['#e2f2df', 1100, 180, 150], props: ['temple', 'pines'], mist: 1 },
  shaolin:        { sky: ['#181309', '#513e1f', '#c9a870'], light: ['#ffdca6', 760, 195, 155], props: ['temple'], smoke: true },
  wudang:         { sky: ['#0a1620', '#264653', '#96c2ca'], light: ['#d9f4f7', 1250, 185, 150], props: ['temple', 'cliff'], mist: 1.4 },
  emei:           { sky: ['#171009', '#5c4526', '#e0b878'], light: ['#ffe1a8', 500, 170, 175], props: ['temple', 'pines'], mist: 1.1 },
  taiyi:          { sky: ['#100e1a', '#362c4d', '#9b8cbd'], light: ['#e8dff7', 1000, 195, 155], props: ['pagoda', 'pines'], mist: 1.2 },
};

function rng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

const n = (v) => Number(v.toFixed(1));

/* ───────────── 山脉 ───────────── */
function ridge(rand, baseY, amp, fill, op, steps = 10) {
  let d = `M -80 ${baseY}`;
  for (let i = 0; i <= steps; i++) {
    const x = -80 + ((W + 160) / steps) * i;
    const y = baseY - amp * (0.3 + rand() * 0.7) * (i % 2 ? 0.6 : 1);
    const cx = x - (W + 160) / steps / 2;
    const cy = baseY - amp * (0.15 + rand() * 0.55);
    d += ` Q ${n(cx)} ${n(cy)} ${n(x)} ${n(y)}`;
  }
  return `<path d="${d} L ${W + 80} ${H + 80} L -80 ${H + 80} Z" fill="${fill}" opacity="${op}" filter="url(#rough)"/>`;
}

/* ───────────── 云 ───────────── */
function clouds(rand, tint) {
  return Array.from({ length: 5 }, () => {
    const cx = rand() * W, cy = 80 + rand() * 220, rx = 180 + rand() * 260;
    return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(rx * 0.18)}" fill="${tint}" opacity="${(0.04 + rand() * 0.07).toFixed(3)}" filter="url(#soft)"/>`;
  }).join('');
}

/* ───────────── 飞鸟 ───────────── */
function birds(rand) {
  return Array.from({ length: 5 }, () => {
    const x = 200 + rand() * 1200, y = 120 + rand() * 200, s = 5 + rand() * 5;
    return `<path d="M ${n(x - s)} ${n(y)} Q ${n(x - s / 2)} ${n(y - s * 0.6)} ${n(x)} ${n(y)} Q ${n(x + s / 2)} ${n(y - s * 0.6)} ${n(x + s)} ${n(y)}" fill="none" stroke="#0b1014" stroke-width="1.6" opacity="0.35"/>`;
  }).join('');
}

/* ───────────── 城墙 / 城楼 ───────────── */
function wall(rand, dark) {
  const top = H - 300;
  const parts = [];
  parts.push(`<rect x="-40" y="${top}" width="${W + 80}" height="${300 + 40}" fill="${dark}"/>`);
  for (let i = 0; i < 16; i++) parts.push(`<rect x="${i * 104}" y="${top - 44}" width="64" height="46" fill="${dark}"/>`);
  // 城门洞
  parts.push(`<path d="M 700 ${H} L 700 ${top + 120} Q 800 ${top + 40} 900 ${top + 120} L 900 ${H} Z" fill="#05070a" opacity="0.92"/>`);
  // 城楼
  const cx = 800;
  for (let i = 0; i < 2; i++) {
    const w = 420 - i * 120, y = top - 60 - i * 96;
    parts.push(`<path d="M ${cx - w / 2} ${y} L ${cx + w / 2} ${y} L ${cx + w * 0.34} ${y - 46} L ${cx - w * 0.34} ${y - 46} Z" fill="${dark}"/>`);
    parts.push(`<rect x="${cx - w * 0.36}" y="${y}" width="${w * 0.72}" height="58" fill="${dark}"/>`);
  }
  // 亮着的窗
  for (let i = 0; i < 7; i++) {
    const x = cx - 150 + i * 50;
    parts.push(`<rect x="${x}" y="${top - 46}" width="16" height="22" fill="#ffca7a" opacity="${(0.35 + rand() * 0.4).toFixed(2)}"/>`);
  }
  return parts.join('');
}

/* ───────────── 民居群 ───────────── */
function houses(rand, dark) {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const x = -40 + i * 190 + rand() * 40;
    const h = 170 + rand() * 170;
    const w = 150 + rand() * 60;
    const y = H - h;
    parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${dark}"/>`);
    // 双坡屋顶
    parts.push(`<path d="M ${n(x - 26)} ${n(y)} L ${n(x + w / 2)} ${n(y - 60)} L ${n(x + w + 26)} ${n(y)} Z" fill="${dark}"/>`);
    // 窗
    for (let k = 0; k < 3; k++) {
      if (rand() > 0.45) {
        parts.push(`<rect x="${n(x + 24 + k * 40)}" y="${n(y + 50 + rand() * 60)}" width="20" height="26" fill="#ffca7a" opacity="${(0.3 + rand() * 0.45).toFixed(2)}"/>`);
      }
    }
  }
  return parts.join('');
}

/* ───────────── 宝塔 ───────────── */
function pagodaTiers(rand, dark, cx) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const w = 260 - i * 40, y = H - 120 - i * 96;
    parts.push(`<rect x="${n(cx - w * 0.32)}" y="${n(y)}" width="${n(w * 0.64)}" height="${n(96 + i * 4)}" fill="${dark}"/>`);
    // 飞檐
    parts.push(`<path d="M ${n(cx - w / 2 - 18)} ${n(y)} Q ${n(cx - w / 2)} ${n(y - 16)} ${n(cx - w * 0.36)} ${n(y - 30)} L ${n(cx + w * 0.36)} ${n(y - 30)} Q ${n(cx + w / 2)} ${n(y - 16)} ${n(cx + w / 2 + 18)} ${n(y)} Z" fill="${dark}"/>`);
    // 塔窗
    parts.push(`<rect x="${n(cx - 12)}" y="${n(y + 26)}" width="24" height="30" fill="#ffca7a" opacity="${(0.3 + rand() * 0.4).toFixed(2)}"/>`);
  }
  // 塔尖
  parts.push(`<path d="M ${n(cx - 10)} ${n(H - 600)} L ${n(cx)} ${n(H - 690)} L ${n(cx + 10)} ${n(H - 600)} Z" fill="${dark}"/>`);
  return parts.join('');
}

/* ───────────── 寺庙山门 ───────────── */
function templeGate(rand, dark) {
  const gateW = 620, cx = 800, top = H - 400;
  const parts = [];
  parts.push(`<rect x="${cx - gateW / 2}" y="${top}" width="${gateW}" height="400" fill="${dark}" opacity="0.96"/>`);
  // 大屋顶
  parts.push(`<path d="M ${cx - gateW / 2 - 70} ${top} Q ${cx - gateW / 2} ${top - 40} ${cx - gateW * 0.34} ${top - 96} L ${cx + gateW * 0.34} ${top - 96} Q ${cx + gateW / 2} ${top - 40} ${cx + gateW / 2 + 70} ${top} Z" fill="${dark}"/>`);
  parts.push(`<path d="M ${cx - gateW * 0.34} ${top - 96} L ${cx} ${top - 150} L ${cx + gateW * 0.34} ${top - 96} Z" fill="${dark}"/>`);
  // 门洞
  parts.push(`<path d="M ${cx - 110} ${H} L ${cx - 110} ${top + 170} Q ${cx} ${top + 100} ${cx + 110} ${top + 170} L ${cx + 110} ${H} Z" fill="#06090c" opacity="0.9"/>`);
  // 柱与灯笼
  for (const dx of [-240, -160, 160, 240]) {
    parts.push(`<rect x="${cx + dx}" y="${top + 40}" width="22" height="360" fill="${dark}"/>`);
  }
  for (const dx of [-200, 200]) {
    parts.push(`<circle cx="${cx + dx}" cy="${top + 150}" r="16" fill="#ffb968" opacity="0.9" filter="url(#glowSm)"/>`);
  }
  return parts.join('');
}

/* ───────────── 客栈 ───────────── */
function inn(rand, dark) {
  const parts = [];
  const x = 420, w = 760, h = 420, y = H - h;
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${dark}"/>`);
  parts.push(`<path d="M ${x - 60} ${y} L ${x + w / 2} ${y - 110} L ${x + w + 60} ${y} Z" fill="${dark}"/>`);
  // 二楼栏杆
  parts.push(`<rect x="${x}" y="${y + 120}" width="${w}" height="12" fill="${dark}"/>`);
  for (let i = 0; i < 12; i++) parts.push(`<rect x="${x + 30 + i * 60}" y="${y + 60}" width="8" height="70" fill="${dark}"/>`);
  // 窗光
  for (let i = 0; i < 6; i++) {
    parts.push(`<rect x="${x + 60 + i * 120}" y="${y + 190}" width="56" height="70" fill="#ffca7a" opacity="${(0.4 + rand() * 0.4).toFixed(2)}"/>`);
  }
  // 招牌
  parts.push(`<rect x="${x + w / 2 - 60}" y="${y + 140}" width="120" height="70" rx="6" fill="#7a2a1e"/>`);
  // 门前灯笼
  for (const dx of [x + 90, x + w - 90]) {
    parts.push(`<circle cx="${dx}" cy="${y + 330}" r="20" fill="#ffb968" opacity="0.92" filter="url(#glowSm)"/>`);
  }
  return parts.join('');
}

/* ───────────── 桥 ───────────── */
function bridge(rand, dark) {
  const y = H - 210, parts = [];
  parts.push(`<path d="M -40 ${y + 40} Q 800 ${y - 140} 1640 ${y + 40} L 1640 ${y + 80} Q 800 ${y - 90} -40 ${y + 80} Z" fill="${dark}"/>`);
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 180;
    parts.push(`<rect x="${x}" y="${y - 60 + Math.abs(4 - i) * 10}" width="10" height="70" fill="${dark}" opacity="0.85"/>`);
  }
  return parts.join('');
}

/* ───────────── 柳树 / 松树 ───────────── */
function willows(rand, dark) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const x = 120 + i * 420 + rand() * 80;
    const h = 300 + rand() * 120;
    parts.push(`<path d="M ${n(x)} ${H} Q ${n(x + 10)} ${n(H - h * 0.6)} ${n(x - 6)} ${n(H - h)}" stroke="${dark}" stroke-width="12" fill="none"/>`);
    for (let k = 0; k < 7; k++) {
      const dx = -70 + k * 24 + rand() * 12;
      parts.push(`<path d="M ${n(x + dx * 0.3)} ${n(H - h)} Q ${n(x + dx)} ${n(H - h * 0.7)} ${n(x + dx * 1.4)} ${n(H - h * 0.25)}" stroke="${dark}" stroke-width="3" fill="none" opacity="0.65"/>`);
    }
  }
  return parts.join('');
}

function pines(rand, dark) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const x = 40 + i * 230 + rand() * 70;
    const h = 200 + rand() * 190;
    parts.push(`<path d="M ${n(x)} ${H} L ${n(x)} ${n(H - h * 0.5)}" stroke="${dark}" stroke-width="10" fill="none"/>`);
    for (let k = 0; k < 3; k++) {
      const yy = H - h * (0.45 + k * 0.22), w = 90 - k * 22;
      parts.push(`<path d="M ${n(x - w)} ${n(yy)} L ${n(x)} ${n(yy - h * 0.22)} L ${n(x + w)} ${n(yy)} Z" fill="${dark}" opacity="${0.9 - k * 0.1}"/>`);
    }
  }
  return parts.join('');
}

/* ───────────── 悬崖 ───────────── */
function cliff(rand, dark) {
  const parts = [];
  parts.push(`<path d="M ${W} ${H} L ${W} ${H - 620} L 1180 ${H - 520} L 1120 ${H - 360} L 1240 ${H - 250} L 1160 ${H} Z" fill="${dark}"/>`);
  parts.push(`<path d="M 0 ${H} L 0 ${H - 520} L 260 ${H - 430} L 320 ${H - 280} L 200 ${H - 160} L 300 ${H} Z" fill="${dark}" opacity="0.95"/>`);
  return parts.join('');
}

/* ───────────── 石阶 ───────────── */
function stairs(rand, dark) {
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const w = 260 + i * 42, y = H - 40 - i * 30;
    parts.push(`<rect x="${n(800 - w / 2)}" y="${n(y)}" width="${n(w)}" height="14" fill="${dark}" opacity="${(0.7 - i * 0.03).toFixed(2)}"/>`);
  }
  return parts.join('');
}

/* ───────────── 船 ───────────── */
function boat(rand, dark) {
  const x = 1040, y = H - 230;
  const parts = [];
  parts.push(`<path d="M ${x - 170} ${y} Q ${x} ${y + 70} ${x + 190} ${y - 10} Q ${x + 130} ${y + 46} ${x - 170} ${y} Z" fill="${dark}"/>`);
  parts.push(`<path d="M ${x + 6} ${y - 6} L ${x + 6} ${y - 120}" stroke="${dark}" stroke-width="8"/>`);
  parts.push(`<path d="M ${x + 110} ${y - 20} L ${x + 110} ${y - 130} Q ${x + 40} ${y - 96} ${x + 112} ${y - 60} Z" fill="${dark}" opacity="0.9"/>`);
  parts.push(`<circle cx="${x + 6}" cy="${y - 140}" r="14" fill="#ffb968" opacity="0.9" filter="url(#glowSm)"/>`);
  // 水面倒影
  for (let i = 0; i < 6; i++) {
    parts.push(`<rect x="${x - 120 + rand() * 240}" y="${y + 60 + i * 18}" width="${n(80 + rand() * 140)}" height="5" rx="3" fill="#cfeef2" opacity="${(0.05 + rand() * 0.08).toFixed(2)}"/>`);
  }
  return parts.join('');
}

/* ───────────── 剑冢 ───────────── */
function swordMound(rand, dark) {
  const parts = [];
  parts.push(`<path d="M -40 ${H} Q 800 ${H - 220} 1640 ${H} Z" fill="${dark}" opacity="0.95"/>`);
  for (let i = 0; i < 28; i++) {
    const x = 60 + i * 56 + rand() * 30;
    const h = 120 + rand() * 260;
    const tilt = ((rand() - 0.5) * 30).toFixed(1);
    const baseY = H - 110 + Math.abs(800 - x) / 12;
    parts.push(`<rect x="${n(x)}" y="${n(baseY - h)}" width="8" height="${n(h)}" fill="${dark}" transform="rotate(${tilt} ${n(x)} ${n(baseY)})" opacity="${(0.55 + rand() * 0.4).toFixed(2)}"/>`);
    parts.push(`<rect x="${n(x - 14)}" y="${n(baseY - h)}" width="36" height="8" fill="${dark}" transform="rotate(${tilt} ${n(x)} ${n(baseY)})" opacity="0.8"/>`);
  }
  return parts.join('');
}

/* ───────────── 旗帜 ───────────── */
function banners(rand, dark) {
  return Array.from({ length: 5 }, () => {
    const x = 120 + rand() * 1300, h = 150 + rand() * 120;
    return `<rect x="${n(x)}" y="${n(H - 330)}" width="8" height="${n(h + 120)}" fill="${dark}"/><path d="M ${n(x + 8)} ${n(H - 330)} L ${n(x + 78)} ${n(H - 320)} L ${n(x + 76)} ${n(H - 250)} L ${n(x + 8)} ${n(H - 262)} Z" fill="#7a1f1f" opacity="0.75"/>`;
  }).join('');
}

/* ───────────── 灯笼串 ───────────── */
function lanterns(rand, count) {
  return Array.from({ length: count }, () => {
    const x = 100 + rand() * (W - 200), y = 300 + rand() * 300;
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(7 + rand() * 6)}" fill="#ffc06a" opacity="0.92" filter="url(#glowSm)"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(3 + rand() * 2)}" fill="#fff2cf"/>`;
  }).join('');
}

/* ───────────── 雪 / 雨 ───────────── */
function weather(kind, rand) {
  if (kind === 'snow') {
    return Array.from({ length: 110 }, () => {
      const x = rand() * W, y = rand() * H, r = 1 + rand() * 2.4;
      return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#ffffff" opacity="${(0.25 + rand() * 0.5).toFixed(2)}"/>`;
    }).join('');
  }
  return '';
}

function smoke(rand) {
  return Array.from({ length: 6 }, () => {
    const x = 200 + rand() * 1200;
    return `<ellipse cx="${n(x)}" cy="${n(120 + rand() * 160)}" rx="${n(50 + rand() * 60)}" ry="${n(18 + rand() * 16)}" fill="#ffffff" opacity="0.05" filter="url(#soft)"/>`;
  }).join('');
}

/* ───────────── 组装 ───────────── */
let count = 0;
for (const [key, cfg] of Object.entries(SCENES)) {
  const rand = rng(key);
  const [gx, gy, gr] = cfg.light;
  const dark = '#151d26';
  const mid = 'rgba(6,10,14,0.55)';

  const farRidge = ridge(rand, 380, 200, cfg.sky[2], 0.35);
  const midRidge = ridge(rand, 470, 170, cfg.sky[1], 0.55);
  const nearRidge = ridge(rand, 560, 130, cfg.sky[1], 0.75);

  const propSvg = cfg.props.map((p) => {
    switch (p) {
      case 'wall': return wall(rand, dark);
      case 'houses': return houses(rand, dark);
      case 'temple': return templeGate(rand, dark);
      case 'inn': return inn(rand, dark);
      case 'bridge': return bridge(rand, dark);
      case 'trees': return willows(rand, dark);
      case 'pines': return pines(rand, dark);
      case 'cliff': return cliff(rand, dark);
      case 'stairs': return stairs(rand, dark);
      case 'boat': return boat(rand, dark);
      case 'swords': return swordMound(rand, dark);
      case 'banners': return banners(rand, dark);
      case 'pagoda': return pagodaTiers(rand, dark, 800);
      case 'snowtree': return pines(rand, dark);
      case 'water': return '';
      default: return '';
    }
  }).join('');

  const waterLayer = cfg.water
    ? `<rect x="0" y="${H - 260}" width="${W}" height="270" fill="url(#water)"/>` +
      Array.from({ length: 12 }, () => {
        const yy = H - 250 + rand() * 240;
        return `<rect x="${n(rand() * W * 0.8)}" y="${n(yy)}" width="${n(120 + rand() * 420)}" height="5" rx="3" fill="#cfeef2" opacity="${(0.04 + rand() * 0.07).toFixed(2)}"/>`;
      }).join('')
    : '';

  const mistLayer = cfg.mist
    ? Array.from({ length: 3 }, (_, i) => {
        const y = 420 + i * 130 + rand() * 40;
        return `<rect x="-80" y="${n(y)}" width="${W + 160}" height="${n(70 + rand() * 70)}" fill="#ffffff" opacity="${((0.05 + rand() * 0.05) * cfg.mist).toFixed(3)}" filter="url(#soft)"/>`;
      }).join('')
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${cfg.sky[0]}"/><stop offset="0.5" stop-color="${cfg.sky[1]}"/><stop offset="1" stop-color="${cfg.sky[2]}"/>
</linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${cfg.sky[2]}" stop-opacity="0.55"/><stop offset="1" stop-color="#05080b" stop-opacity="0.85"/>
</linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="${cfg.light[0]}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${cfg.light[0]}" stop-opacity="0.22"/><stop offset="1" stop-color="${cfg.light[0]}" stop-opacity="0"/>
</radialGradient>
<filter id="soft" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="30"/></filter>
<filter id="glowSm" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer></filter>
<linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#000" stop-opacity="0.5"/><stop offset="0.4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.68"/>
</linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${clouds(rand, '#ffffff')}
<circle cx="${gx}" cy="${gy}" r="${n(gr * 2.6)}" fill="url(#glow)"/>
<circle cx="${gx}" cy="${gy}" r="${n(gr * 0.3)}" fill="${cfg.light[0]}" opacity="0.92"/>
${birds(rand)}
${farRidge}
${midRidge}
${mistLayer}
${nearRidge}
<rect width="${W}" height="${H}" fill="${mid}" opacity="0.25"/>
${propSvg}
${waterLayer}
${cfg.lanterns ? lanterns(rand, cfg.lanterns) : ''}
${cfg.smoke ? smoke(rand) : ''}
${cfg.snow ? weather('snow', rand) : ''}
<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.6"/>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg>`;

  fs.writeFileSync(path.join(OUT, `${key}.svg`), svg, 'utf8');
  count++;
}

console.log(`生成完成：${count} 个具象场景 → ${OUT}`);
