'use client';

import type { ReactNode } from 'react';

/**
 * 游戏封面插画：全部手绘 SVG（矢量、无外部图片、无 AI 生成痕迹）。
 * 统一构图语言：深色底 + accent 光晕 + 扁平几何剪影，保证一屏里风格一致。
 */

export type CoverKind =
  | 'sanguosha'
  | 'match3'
  | 'minesweeper'
  | 'gomoku'
  | 'beanprincess'
  | 'chess'
  | 'xiangqi'
  | 'runner'
  | 'subway'
  | 'carrot'
  | 'autochess'
  | 'jianghu'
  | 'naiwa';

function Frame({ id, accent, children }: { id: string; accent: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 320 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0e16" />
          <stop offset="1" stopColor="#151c2a" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.72" cy="0.16" r="0.78">
          <stop offset="0" stopColor={accent} stopOpacity="0.48" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#bg-${id})`} />
      <rect width="320" height="180" fill={`url(#glow-${id})`} />
      {children}
    </svg>
  );
}

/** 山峦剪影，供多张图复用 */
function Hills({ y, color, points }: { y: number; color: string; points: string }) {
  return <path d={`M0 ${y} L${points} L320 ${y} Z`} fill={color} />;
}

const SCENES: Record<CoverKind, (accent: string) => ReactNode> = {
  // —— 三国杀：烽烟战场 + 战旗 + 双将对峙 ——
  sanguosha: (accent) => (
    <>
      <rect y="122" width="320" height="58" fill="#120b0e" />
      <Hills y={124} color="#1c1015" points="40 92 80 118 120 86 166 120 206 98 252 120 286 100" />
      {[64, 150, 236].map((x, i) => (
        <g key={x} opacity={i === 1 ? 1 : 0.7}>
          <rect x={x} y="40" width="2.5" height="86" rx="1" fill="#5b3b25" />
          <path d={`M${x + 2.5} 40 L${x + 33} 51 L${x + 2.5} 63 Z`} fill={accent} />
          <path d={`M${x + 2.5} 63 L${x + 20} 68 L${x + 2.5} 71 Z`} fill={accent} opacity="0.55" />
        </g>
      ))}
      <path d="M198 26 L238 100" stroke="#f6e8c8" strokeWidth="2.2" strokeOpacity="0.65" strokeLinecap="round" />
      <path d="M198 26 L206 30" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9" />
      {/* 左将 */}
      <g fill="#07090f">
        <circle cx="104" cy="92" r="9" />
        <path d="M92 122 Q92 104 104 104 Q116 104 116 122 Z" />
        <path d="M104 88 L100 78 L104 82 L108 78 Z" fill={accent} />
      </g>
      {/* 右将 */}
      <g fill="#07090f">
        <circle cx="228" cy="96" r="9" />
        <path d="M216 124 Q216 108 228 108 Q240 108 240 124 Z" />
        <path d="M228 92 L224 82 L228 86 L232 82 Z" fill={accent} opacity="0.85" />
      </g>
      <ellipse cx="160" cy="176" rx="150" ry="26" fill="#000" opacity="0.35" />
    </>
  ),

  // —— 消消乐：棋盘 + 三颗宝石 + 闪光 ——
  match3: (accent) => (
    <>
      <rect y="8" width="320" height="184" fill="#100c1c" opacity="0.55" />
      {Array.from({ length: 21 }).map((_, i) => {
        const cx = 52 + (i % 7) * 36;
        const cy = 34 + Math.floor(i / 7) * 34;
        return <rect key={i} x={cx} y={cy} width="26" height="26" rx="7" fill="#ffffff" opacity={0.05} />;
      })}
      <g>
        <rect x="128" y="52" width="44" height="44" rx="10" fill={accent} transform="rotate(-12 150 74)" />
        <rect x="138" y="60" width="12" height="12" rx="3" fill="#fff" opacity="0.55" transform="rotate(-12 150 74)" />
      </g>
      <g>
        <circle cx="196" cy="84" r="21" fill="#ffd166" />
        <circle cx="188" cy="76" r="7" fill="#fff" opacity="0.6" />
      </g>
      <g>
        <rect x="84" y="88" width="38" height="38" rx="9" fill="#4ade80" transform="rotate(9 103 107)" />
        <rect x="92" y="95" width="10" height="10" rx="3" fill="#fff" opacity="0.5" transform="rotate(9 103 107)" />
      </g>
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.9">
        <path d="M236 34 v12 M230 40 h12" />
        <path d="M64 42 v8 M60 46 h8" />
        <path d="M250 118 v8 M246 122 h8" />
      </g>
    </>
  ),

  // —— 扫雷：方格阵 + 插旗 + 炸弹 ——
  minesweeper: (accent) => (
    <>
      {Array.from({ length: 40 }).map((_, i) => {
        const cx = 44 + (i % 8) * 29;
        const cy = 26 + Math.floor(i / 8) * 29;
        return (
          <rect key={i} x={cx} y={cy} width="25" height="25" rx="4" fill="#c8d0dc" opacity={i % 3 === 0 ? 0.22 : 0.1} />
        );
      })}
      <rect x="131" y="55" width="25" height="25" rx="4" fill={accent} opacity="0.9" />
      <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
        <path d="M143.5 77 V61" />
      </g>
      <path d="M143.5 61 L155 65 L143.5 69 Z" fill="#fff" />
      <circle cx="222" cy="102" r="19" fill="#111827" stroke="#4b5563" strokeWidth="1.6" />
      <circle cx="216" cy="95" r="4.5" fill="#fff" opacity="0.35" />
      <path d="M222 83 Q228 74 236 76" stroke="#f59e0b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M236 76 l4 -5 l-2 6 l6 -1" stroke="#fbbf24" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </>
  ),

  // —— 五子棋：木盘 + 五连 ——
  gomoku: () => (
    <>
      <rect x="30" y="14" width="260" height="152" rx="8" fill="#3a2a1a" />
      <rect x="30" y="14" width="260" height="152" rx="8" fill="#000" opacity="0.18" />
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`h${i}`} x1="52" y1={30 + i * 14} x2="268" y2={30 + i * 14} stroke="#c9a878" strokeWidth="1" opacity="0.45" />
      ))}
      {Array.from({ length: 13 }).map((_, i) => (
        <line key={`v${i}`} x1={52 + i * 18} y1="30" x2={52 + i * 18} y2="156" stroke="#c9a878" strokeWidth="1" opacity="0.45" />
      ))}
      {[[124, 72], [142, 86], [160, 100], [178, 114], [196, 128]].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="6.4" fill="#111" />
          <circle cx={x - 1.6} cy={y - 1.8} r="2" fill="#fff" opacity="0.28" />
        </g>
      ))}
      {[[124, 114], [142, 100], [160, 86], [178, 72]].map(([x, y]) => (
        <g key={`w${x}-${y}`}>
          <circle cx={x} cy={y} r="6.4" fill="#f5f5f0" />
          <circle cx={x + 1.8} cy={y + 1.8} r="1.8" fill="#000" opacity="0.18" />
        </g>
      ))}
    </>
  ),

  // —— 豆公主：粉色城堡 + 小公主 ——
  beanprincess: (accent) => (
    <>
      <Hills y={126} color="#2a1230" points="60 92 100 116 140 84 180 112 220 88 260 114" />
      <g fill="#3d1b45">
        <rect x="96" y="86" width="18" height="42" />
        <path d="M96 86 L105 70 L114 86 Z" />
        <rect x="120" y="70" width="26" height="58" />
        <path d="M120 70 L133 50 L146 70 Z" />
        <rect x="152" y="86" width="18" height="42" />
        <path d="M152 86 L161 70 L170 86 Z" />
      </g>
      <g fill="#ffd166" opacity="0.85">
        <circle cx="133" cy="92" r="3" />
        <circle cx="105" cy="98" r="2.2" />
        <circle cx="161" cy="98" r="2.2" />
      </g>
      <g>
        <circle cx="238" cy="72" r="15" fill="#ffd9e6" />
        <path d="M223 72 Q238 52 253 72 Q238 62 223 72 Z" fill="#7c3aed" opacity="0.85" />
        <path d="M230 44 L238 36 L246 44 L244 50 L232 50 Z" fill={accent} />
        <circle cx="233" cy="74" r="1.8" fill="#5b3a4a" />
        <circle cx="243" cy="74" r="1.8" fill="#5b3a4a" />
        <path d="M234 79 Q238 83 242 79" stroke="#5b3a4a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M226 90 Q238 82 250 90 L252 108 Q238 114 224 108 Z" fill="#ff8fb8" />
      </g>
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.75">
        <path d="M74 40 v9 M69.5 44.5 h9" />
        <path d="M282 96 v9 M277.5 100.5 h9" />
      </g>
      <ellipse cx="160" cy="176" rx="150" ry="24" fill="#000" opacity="0.35" />
    </>
  ),

  // —— 国际象棋：透视棋盘 + 王后对峙 ——
  chess: (accent) => (
    <>
      <path d="M20 178 L118 96 L202 96 L300 178 Z" fill="#241a12" />
      {Array.from({ length: 8 }).map((_, i) => (
        <path key={i} d={`M${20 + i * 12.2} 178 L${118 + i * 10.5} 96 L${129 + i * 10.5} 96 L${32.2 + i * 12.2} 178 Z`} fill="#f0e6d6" opacity="0.85" />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <path key={`r${i}`} d={`M${20 + i * 3} ${178 - i * 20} L${300 - i * 3} ${178 - i * 20} L${300 - (i + 1) * 3} ${178 - (i + 1) * 20} L${20 + (i + 1) * 3} ${178 - (i + 1) * 20} Z`} fill="#000" opacity="0.22" />
      ))}
      <g fill="#f4f1ea">
        <path d="M136 96 L136 66 Q144 54 152 66 L152 96 Z" />
        <circle cx="144" cy="52" r="7" />
        <path d="M136 50 L140 42 L144 48 L148 42 L152 50 Z" />
        <rect x="130" y="96" width="28" height="6" rx="2" />
      </g>
      <g fill="#151a22">
        <path d="M188 96 L188 62 Q196 50 204 62 L204 96 Z" />
        <circle cx="196" cy="46" r="7.5" fill={accent} opacity="0.9" />
        <path d="M188 44 Q196 34 204 44 L202 50 Q196 44 190 50 Z" fill={accent} />
        <rect x="182" y="96" width="28" height="6" rx="2" />
      </g>
      <ellipse cx="160" cy="176" rx="140" ry="20" fill="#000" opacity="0.3" />
    </>
  ),

  // —— 中国象棋：棋盘 + 楚河汉界 + 红黑棋子 ——
  xiangqi: (accent) => (
    <>
      <rect x="26" y="12" width="268" height="156" rx="6" fill="#3b2c1c" />
      <rect x="26" y="12" width="268" height="156" rx="6" fill="#000" opacity="0.15" />
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`h${i}`} x1="48" y1={26 + i * 14.2} x2="272" y2={26 + i * 14.2} stroke="#d8b98c" strokeWidth="1" opacity="0.4" />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`v${i}`} x1={48 + i * 28} y1="26" x2={48 + i * 28} y2="153.8" stroke="#d8b98c" strokeWidth="1" opacity="0.4" />
      ))}
      <rect x="48" y="97" width="224" height="14" fill="#1c1408" opacity="0.7" />
      <text x="160" y="108" textAnchor="middle" fontSize="11" fill="#d8b98c" opacity="0.7" letterSpacing="6" fontFamily="serif">
        楚 河 汉 界
      </text>
      <circle cx="160" cy="62" r="11" fill="#f2e6cc" stroke={accent} strokeWidth="2" />
      <text x="160" y="66" textAnchor="middle" fontSize="11" fill={accent} fontFamily="serif">帥</text>
      <circle cx="216" cy="132" r="11" fill="#1a1a1a" stroke="#d8b98c" strokeWidth="1.6" />
      <text x="216" y="136" textAnchor="middle" fontSize="11" fill="#e8dcc0" fontFamily="serif">車</text>
    </>
  ),

  // —— 奶龙快跑：沙漠仙人掌 + 小龙 + 速度线 ——
  runner: () => (
    <>
      <circle cx="250" cy="52" r="26" fill="#ffb347" opacity="0.55" />
      <rect y="132" width="320" height="48" fill="#2a1c14" />
      <rect y="131" width="320" height="1.4" fill="#c2833f" opacity="0.7" />
      <g fill="#1c3a26">
        <rect x="228" y="92" width="9" height="40" rx="4" />
        <rect x="218" y="104" width="8" height="16" rx="4" />
        <rect x="241" y="98" width="8" height="18" rx="4" />
        <rect x="286" y="110" width="8" height="22" rx="4" />
      </g>
      <g>
        <path d="M96 132 L96 100 Q96 82 116 82 Q136 82 136 100 L136 132 Z" fill="#4ade80" />
        <circle cx="140" cy="94" r="12" fill="#4ade80" />
        <path d="M148 88 l4 -8 l-1 9 Z" fill="#4ade80" />
        <circle cx="146" cy="91" r="2.2" fill="#0a0e16" />
        <path d="M100 118 l-8 14 M116 118 l-8 14 M118 118 l8 14" stroke="#4ade80" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g stroke="#f8f4e8" strokeWidth="2" strokeLinecap="round" opacity="0.5">
        <path d="M56 96 h26 M40 112 h32 M58 128 h22" />
      </g>
      <ellipse cx="118" cy="140" rx="30" ry="5" fill="#000" opacity="0.35" />
    </>
  ),

  // —— 地铁跑酷：隧道透视 + 车头 + 霓虹 ——
  subway: () => (
    <>
      <path d="M0 0 L320 0 L320 180 L0 180 Z" fill="#0a1020" opacity="0.4" />
      {Array.from({ length: 7 }).map((_, i) => (
        <g key={i}>
          <line x1={-40 + i * 68} y1="0" x2="132" y2="96" stroke="#2b3a55" strokeWidth="1.4" opacity="0.8" />
          <line x1={360 - i * 68} y1="0" x2="188" y2="96" stroke="#2b3a55" strokeWidth="1.4" opacity="0.8" />
        </g>
      ))}
      <rect x="132" y="68" width="56" height="60" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="1.4" />
      <rect x="140" y="76" width="40" height="18" rx="3" fill="#38bdf8" opacity="0.8" />
      <circle cx="144" cy="130" r="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.4" />
      <circle cx="176" cy="130" r="4" fill="#0f172a" stroke="#64748b" strokeWidth="1.4" />
      <rect y="140" width="320" height="40" fill="#0b1220" />
      <rect y="139" width="320" height="2" fill="#38bdf8" opacity="0.6" />
      <rect y="152" width="320" height="2" fill="#ec4899" opacity="0.45" />
      <path d="M60 148 L120 148 M200 148 L260 148" stroke="#64748b" strokeWidth="3" strokeDasharray="8 10" strokeLinecap="round" />
    </>
  ),

  // —— 保卫萝卜：草地 + 胡萝卜 + 炮塔 + 小怪 ——
  carrot: (accent) => (
    <>
      <rect y="118" width="320" height="62" fill="#16281c" />
      <ellipse cx="160" cy="124" rx="170" ry="22" fill="#1d3a28" />
      <g>
        <path d="M138 96 Q160 84 182 96 Q186 128 160 142 Q134 128 138 96 Z" fill={accent} />
        <path d="M150 92 Q160 68 172 92" stroke="#4ade80" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M158 92 Q156 74 148 66" stroke="#22c55e" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M164 92 Q170 74 180 68" stroke="#22c55e" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M146 112 h6 M154 118 h7 M152 130 h6" stroke="#000" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g>
        <rect x="216" y="86" width="20" height="36" rx="4" fill="#475569" />
        <rect x="210" y="78" width="32" height="12" rx="4" fill="#64748b" />
        <rect x="224" y="66" width="6" height="14" rx="2" fill={accent} />
      </g>
      <g>
        <circle cx="72" cy="112" r="11" fill="#a855f7" />
        <circle cx="68" cy="108" r="2.4" fill="#fff" opacity="0.9" />
        <path d="M64 122 l-3 6 M72 124 l0 7 M80 122 l3 6" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
      </g>
      <ellipse cx="160" cy="164" rx="120" ry="8" fill="#000" opacity="0.25" />
    </>
  ),

  // —— 自走棋：六角棋盘 + 棋子 + 光环 ——
  autochess: (accent) => (
    <>
      <rect y="106" width="320" height="74" fill="#130f22" />
      {Array.from({ length: 15 }).map((_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const cx = 88 + col * 36 + (row % 2 ? 18 : 0);
        const cy = 118 + row * 12;
        return <path key={i} d={`M${cx} ${cy - 8} L${cx + 9} ${cy} L${cx} ${cy + 8} L${cx - 9} ${cy} Z`} fill="#ffffff" opacity="0.07" />;
      })}
      {[
        { x: 110, y: 92, c: '#f472b6' },
        { x: 160, y: 82, c: accent },
        { x: 210, y: 92, c: '#38bdf8' },
      ].map((p) => (
        <g key={p.x}>
          <ellipse cx={p.x} cy="116" rx="15" ry="4" fill={p.c} opacity="0.35" />
          <circle cx={p.x} cy={p.y - 14} r="8.5" fill={p.c} />
          <path d={`M${p.x - 12} ${p.y + 16} Q${p.x} ${p.y - 2} ${p.x + 12} ${p.y + 16} Z`} fill={p.c} opacity="0.75" />
          <circle cx={p.x} cy={p.y - 14} r="13" fill="none" stroke={p.c} strokeWidth="1.2" opacity="0.6" />
        </g>
      ))}
      <path d="M160 44 L160 60" stroke={accent} strokeWidth="2" strokeOpacity="0.5" />
      <circle cx="160" cy="40" r="4" fill={accent} opacity="0.8" />
    </>
  ),

  // —— 江湖风云录：水墨山水 + 圆月 + 仗剑侠客 ——
  jianghu: (accent) => (
    <>
      <circle cx="238" cy="46" r="22" fill="#f4ecd8" opacity="0.9" />
      <circle cx="238" cy="46" r="34" fill="#f4ecd8" opacity="0.08" />
      <Hills y={128} color="#1b2230" points="34 96 78 122 124 92 172 124 220 100 268 126 300 110" />
      <Hills y={142} color="#0f151f" points="0 132 52 116 108 140 168 118 226 144 286 122 320 138" />
      <rect y="150" width="320" height="30" fill="#0b0f17" />
      <g fill="#070a10">
        <circle cx="96" cy="76" r="7.5" />
        <path d="M84 150 Q84 96 96 96 Q108 96 108 150 Z" />
        <path d="M96 96 Q104 108 118 116" stroke="#070a10" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      <path d="M112 118 L176 44" stroke="#e8eef7" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      <path d="M176 44 L182 38" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
      <rect y="118" width="320" height="3" fill="#fff" opacity="0.06" />
    </>
  ),

  // —— 奶娃闯关：奶白团子 + 紫色捣蛋娃 + 挥击弧光 ——
  naiwa: (accent) => (
    <>
      <rect y="146" width="320" height="34" fill="#1b1522" />
      <rect y="145" width="320" height="2" fill="#3a2c44" />
      {/* 挥击弧光 */}
      <path d="M118 84 Q152 46 198 78" stroke={accent} strokeWidth="7" strokeOpacity="0.5" fill="none" strokeLinecap="round" />
      <path d="M124 92 Q152 62 190 84" stroke="#fff" strokeWidth="2" strokeOpacity="0.45" fill="none" strokeLinecap="round" />
      {/* 奶娃 */}
      <g>
        <ellipse cx="104" cy="150" rx="30" ry="5" fill="#000" opacity="0.4" />
        <circle cx="86" cy="84" r="6" fill="#fff9ec" />
        <circle cx="122" cy="84" r="6" fill="#fff9ec" />
        <ellipse cx="104" cy="112" rx="26" ry="28" fill="#fff9ec" />
        <circle cx="96" cy="108" r="3" fill="#4b4453" />
        <circle cx="112" cy="108" r="3" fill="#4b4453" />
        <ellipse cx="92" cy="118" rx="5" ry="3" fill="#ffa9c4" opacity="0.5" />
        <ellipse cx="116" cy="118" rx="5" ry="3" fill="#ffa9c4" opacity="0.5" />
        <circle cx="104" cy="124" r="5.5" fill="#ffa9c4" />
      </g>
      {/* 捣蛋娃 */}
      <g>
        <path d="M236 90 l5 -12 l5 12 Z" fill="#b9a7e8" />
        <path d="M258 90 l5 -12 l5 12 Z" fill="#b9a7e8" />
        <ellipse cx="252" cy="112" rx="24" ry="23" fill="#b9a7e8" />
        <ellipse cx="256" cy="106" rx="8" ry="9" fill="#fff" />
        <circle cx="258" cy="107" r="3.4" fill="#2b2436" />
        <path d="M244 124 Q252 130 260 124" stroke="#2b2436" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <ellipse cx="252" cy="150" rx="26" ry="4" fill="#000" opacity="0.35" />
      </g>
      {/* 判定框 */}
      <rect
        x="128"
        y="88"
        width="46"
        height="40"
        rx="4"
        fill={accent}
        fillOpacity="0.12"
        stroke={accent}
        strokeOpacity="0.6"
        strokeDasharray="4 4"
      />
    </>
  ),
};

export function GameCover({ kind, accent }: { kind: CoverKind; accent: string }) {
  return (
    <Frame id={kind} accent={accent}>
      {SCENES[kind](accent)}
    </Frame>
  );
}
