'use client';

import type { ComponentType, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { GameCover, type CoverKind } from './game-cover';

/** 江湖风云录 dynamic 加载骨架：拳剑刀氛围 + 进度提示 */
function JianghuLoading() {
  return (
    <div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#B91C1C]/35 bg-gradient-to-b from-[#1a0a0a] to-[#0c0808] p-5 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-[#B91C1C]/40 bg-[#2a1010]">
          <span className="text-2xl">🗡️</span>
          <span className="absolute inset-0 animate-pulse bg-[#B91C1C]/10" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#f5e6d3]">江湖风云录</p>
          <p className="mt-0.5 text-[11px] text-[#c4a484]">第四章 · 余烬 · 拳剑刀入局中…</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-pulse rounded-full" style={{ background: 'linear-gradient(90deg, #B91C1C, #FF7A18)' }} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['经脉', '锻造', '连招'].map((label) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center">
              <p className="text-[10px] text-[#c4a484]/80">{label}</p>
              <div className="mx-auto mt-1.5 h-1.5 w-10 animate-pulse rounded-full bg-white/15" />
            </div>
          ))}
        </div>
        <p className="pt-1 text-center text-[11px] text-[#c4a484]/70">正在载入武侠世界与本地存档…</p>
      </div>
    </div>
  );
}

// 已实现的游戏
const Minesweeper = dynamic(() => import('@/components/minesweeper').then((m) => m.MinesweeperGame), { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载扫雷…</div> });
const Gomoku      = dynamic(() => import('@/components/gomoku').then((m) => m.GomokuGame),        { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载五子棋…</div> });
const Runner      = dynamic(() => import('@/components/runner').then((m) => m.RunnerGame),        { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载跑酷…</div> });
const Sanguosha   = dynamic(() => import('@/components/sanguosha').then((m) => m.SanguoshaGame),   { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载三国杀…</div> });
const Match3      = dynamic(() => import('@/components/match3').then((m) => m.Match3Game),         { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载消消乐…</div> });
const Chess       = dynamic(() => import('@/components/chess').then((m) => m.ChessGame),          { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载国际象棋…</div> });
const Xiangqi     = dynamic(() => import('@/components/xiangqi').then((m) => m.XiangqiGame),      { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载中国象棋…</div> });
const Carrot      = dynamic(() => import('@/components/carrot').then((m) => m.CarrotGame),        { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载保卫萝卜…</div> });
const AutoChess   = dynamic(() => import('@/components/autochess').then((m) => m.AutoChessGame),  { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载自走棋…</div> });
const Jianghu     = dynamic(() => import('@/components/jianghu').then((m) => m.JianghuGame),      { ssr: false, loading: () => <JianghuLoading /> });
const Naiwa       = dynamic(() => import('@/games/naiwa').then((m) => m.NaiwaGame),              { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载奶娃闯关…</div> });

/** 外链 H5 小游戏：内嵌 iframe 播放，可原地全屏或跳到原站 */
function ExternalGame({ src, title }: { src: string; title: string }) {
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <div className="w-full">
      <div
        className={
          fullscreen
            ? 'fixed inset-0 z-[80] bg-black flex flex-col'
            : 'relative w-full max-w-[820px] mx-auto rounded-lg overflow-hidden border border-line bg-black'
        }
      >
        <iframe
          src={src}
          title={title}
          className={fullscreen ? 'flex-1 w-full' : 'w-full aspect-[16/10] max-h-[72vh]'}
          allow="autoplay; fullscreen; accelerometer; gyroscope; microphone"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-orientation-lock"
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
        />
        {fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="absolute right-3 top-3 z-10 px-3 py-1.5 rounded-full bg-white/90 text-black text-xs font-medium shadow"
          >
            ✕ 退出全屏
          </button>
        )}
      </div>
      {!fullscreen && (
        <div className="mt-2 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-content hover:border-accent/50"
          >
            ⛶ 全屏游玩
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-content hover:border-accent/50"
          >
            ↗ 原站打开
          </a>
        </div>
      )}
    </div>
  );
}

/** 4399 页游风格主色：暖橙 → 品牌红 */
const BRAND_GRADIENT = 'linear-gradient(90deg, #FF7A18 0%, #E6352B 100%)';

/** 游戏封面插画为手绘 SVG，见 game-cover.tsx */
type GameComp = ComponentType;
type GameStatus = 'live' | 'coming';
type CategoryId = 'card' | 'casual' | 'parkour' | 'tower' | 'auto' | 'story' | 'action';

interface GameDef {
  id: CoverKind;
  name: string;
  emoji: string;
  desc: string;
  accent: string;
  category: CategoryId;
  status: GameStatus;
  Renderer?: GameComp;
  /** 未来游戏占位用的提示 */
  comingSoon?: string;
  tags: string[];
  /** 10 分制 */
  rating: number;
  /** 人气指数，用于排行与展示 */
  heat: number;
}

interface Category {
  id: CategoryId;
  name: string;
  emoji: string;
  desc: string;
}

const CATEGORIES: Category[] = [
  { id: 'card',    name: '牌类',       emoji: '🃏', desc: '策略卡牌 · 身份推理 · AI 对战' },
  { id: 'casual',  name: '休闲益智',   emoji: '🧩', desc: '三消、扫雷、五子棋 · 即开即玩' },
  { id: 'parkour', name: '跑酷',       emoji: '🏃', desc: '无尽跑酷 · 速度递增 · 挑战极限' },
  { id: 'tower',   name: '塔防',       emoji: '🏰', desc: '保卫萝卜 · 放塔升级 · 波次守卫' },
  { id: 'auto',    name: '自走棋',     emoji: '♟️', desc: '摆阵对战 · 自动战斗 · 吃鸡' },
  { id: 'story',   name: '剧情 RPG',   emoji: '📖', desc: '江湖风云录 · 文字冒险 · 分支选择' },
  { id: 'action',  name: '横版动作',   emoji: '🍼', desc: '奶娃闯关 · 攻击时序 · 闪避无敌' },
];

const GAMES: GameDef[] = [
  // —— 牌类 ——
  { id: 'sanguosha', name: '三国杀（简化版）', emoji: '⚔️', desc: '身份局 5 人，主公 + 忠臣 + 内奸 + 反贼 × 2，其余 4 人机', accent: '#C62828', category: 'card', status: 'live', Renderer: Sanguosha, tags: ['卡牌', '身份局', '单机'], rating: 8.9, heat: 186000 },

  // —— 休闲益智 ——
  { id: 'match3',    name: '开心消消乐', emoji: '🍎', desc: '8×8 棋盘，限时 90 秒，连锁消除加成', accent: '#8B5CF6', category: 'casual', status: 'live', Renderer: Match3, tags: ['三消', '限时', '休闲'], rating: 8.2, heat: 96000 },
  { id: 'minesweeper', name: '扫雷',     emoji: '💣', desc: '经典三档难度，第一击安全', accent: '#DC2626', category: 'casual', status: 'live', Renderer: Minesweeper, tags: ['扫雷', '经典', '益智'], rating: 8.0, heat: 73000 },
  { id: 'gomoku',     name: '五子棋',    emoji: '⚫', desc: '双人同屏 / 单人 vs AI', accent: '#D4A574', category: 'casual', status: 'live', Renderer: Gomoku, tags: ['棋类', '双人', 'AI'], rating: 8.5, heat: 88000 },
  { id: 'beanprincess', name: '豆公主', emoji: '👸', desc: '外链 H5 小游戏，内嵌即玩，可全屏', accent: '#EC4899', category: 'casual', status: 'live', Renderer: () => <ExternalGame src="https://h5.metaapp.cn/online/h5/BUsvkkbBiAq2pF2Ttx4j/1.0.2/6/index.html" title="豆公主" />, tags: ['换装', '童话', 'H5'], rating: 7.8, heat: 64000 },
  { id: 'chess',      name: '国际象棋',  emoji: '♟️', desc: '完整走法 + 将军将死判定，2 层 Alpha-Beta AI', accent: '#B45309', category: 'casual', status: 'live', Renderer: Chess, tags: ['国际象棋', 'AI', '策略'], rating: 8.3, heat: 71000 },
  { id: 'xiangqi',    name: '中国象棋',  emoji: '🀄', desc: '车马炮象士将卒全规则，含蹩马腿 / 塞象眼 / 将帅照面', accent: '#B3261E', category: 'casual', status: 'live', Renderer: Xiangqi, tags: ['中国象棋', '残局', 'AI'], rating: 8.6, heat: 102000 },

  // —— 跑酷 ——
  { id: 'runner',     name: '奶龙快跑', emoji: '🐲', desc: '类 Chrome Dino，空格跳跃，速度递增', accent: '#4ADE80', category: 'parkour', status: 'live', Renderer: Runner, tags: ['跑酷', '无尽', '跳跃'], rating: 8.4, heat: 118000 },
  { id: 'subway',     name: '地铁跑酷', emoji: '🚇', desc: '三轨道切换，跳跃 / 滑行', accent: '#38BDF8', category: 'parkour', status: 'coming', comingSoon: '下一轮迭代，计划加轨道切换和护盾道具', tags: ['跑酷', '三轨道', '即将上线'], rating: 8.1, heat: 54000 },

  // —— 塔防 ——
  { id: 'carrot',     name: '保卫萝卜', emoji: '🥕', desc: '放塔守卫，升级塔，波次推进', accent: '#EA580C', category: 'tower', status: 'live', Renderer: Carrot, tags: ['塔防', '守卫', '升级'], rating: 8.7, heat: 134000 },

  // —— 自走棋 ——
  { id: 'autochess',  name: 'Libre 自走棋', emoji: '♟️', desc: '6×6 棋盘摆棋子，回合制自动战斗', accent: '#8B5CF6', category: 'auto', status: 'live', Renderer: AutoChess, tags: ['自走棋', '策略', '摆阵'], rating: 8.5, heat: 121000 },

  // —— 剧情 RPG ——
  { id: 'jianghu',    name: '江湖风云录', emoji: '🗡️', desc: '第四章·余烬 · 经脉锻造 · 连招 Boss · 拳剑刀入世', accent: '#B91C1C', category: 'story', status: 'live', Renderer: Jianghu, tags: ['武侠', '剧情', '回合制', 'RPG', '养成'], rating: 9.2, heat: 356000 },

  // —— 横版动作 ——
  { id: 'naiwa',      name: '奶娃闯关', emoji: '🍼', desc: '横版动作灰盒原型：两段攻击、闪避无敌帧、敌人状态机', accent: '#F472B6', category: 'action', status: 'live', Renderer: Naiwa, tags: ['横版', '动作', '闯关'], rating: 8.8, heat: 143000 },
];

/* —— 专区内容 —— */

interface GuideItem {
  title: string;
  date: string;
  views: string;
  tag: string;
  /** 站内可展开正文，避免空链接 */
  body: string;
}

/** 礼包进游发放：映射到江湖真实物品 / 银两 / 贡献 */
interface GiftRewardPayload {
  items?: string[];
  silver?: number;
  contribution?: number;
}

interface GiftPack {
  id: string;
  name: string;
  items: string;
  remain: string;
  /** 江湖礼包领取后写入 pendingRewards */
  rewards?: GiftRewardPayload;
}

interface ZoneContent {
  slogan: string;
  publisher: string;
  platform: string;
  features: string[];
  controls: string[];
  guides: GuideItem[];
  gifts: GiftPack[];
}

const JIANGHU_SAVE_KEY = 'jianghu.save.v1';
const JIANGHU_GIFTS_KEY = 'jianghu.gifts.v1';

type JianghuPendingReward = {
  giftId: string;
  giftName: string;
  items: string[];
  silver?: number;
  contribution?: number;
};

type JianghuGiftStore = {
  claimedIds: string[];
  pendingRewards: JianghuPendingReward[];
};

type JianghuSaveSummary = {
  playerName: string;
  level: number;
  nodeId: string;
  nodeTitle: string;
  chapterLabel: string;
  idleHint: string;
  raw: unknown;
};

/** 节点标题（大厅摘要用，与 jianghu NODES 对齐的精简表） */
const JIANGHU_NODE_TITLES: Record<string, string> = {
  'o-noble': '洛阳残雪', 'o-orphan': '青牛村雪', 'o-escort': '威远镖旗',
  a01: '破庙夜雨', a02: '渡口风波', a03: '黑风寨探路', a04: '灯市听棋', a05: '白衣求救',
  a06: '悦来客栈', a07: '夜袭黑风寨', a08: '败走断魂崖', a09: '一鸣洛阳',
  b01: '群雄帖', b02: '姑苏擂台', b02b: '伤卧客栈', b03: '药王谷', b04: '雾中伏杀',
  b04b: '昏迷三日', b05: '血手堂', b06: '故人重逢', b07: '长街血战', b08: '剑冢', b09: '掌门遗托',
  c01: '雁荡会盟', c02: '总坛之下', c03: '教主之邀', c04: '酒中之局', c05: '绝顶决战',
  c06: '云开见日', c07: '败局', c08: '华山论剑',
  'end-judge': '华山之巅', 'end-lord': '武林盟主', 'end-hermit': '归隐山林',
  'end-demon': '堕入魔道', 'end-death': '身死道消',
};

function jianghuChapterLabel(nodeId: string): string {
  if (nodeId.startsWith('d') || nodeId.startsWith('e-') || nodeId.includes('ash') || nodeId.includes('ember')) {
    return '第四章 · 余烬';
  }
  if (nodeId.startsWith('o-') || /^a\d/.test(nodeId)) return '第一章 · 初入江湖';
  if (/^b\d/.test(nodeId)) return '第二章 · 名动一方';
  if (/^c\d/.test(nodeId) || nodeId.startsWith('end-')) return '第三章 · 风云际会';
  return '江湖途中';
}

function readJianghuGiftStore(): JianghuGiftStore {
  try {
    const raw = window.localStorage.getItem(JIANGHU_GIFTS_KEY);
    if (!raw) return { claimedIds: [], pendingRewards: [] };
    const data = JSON.parse(raw) as Partial<JianghuGiftStore>;
    return {
      claimedIds: Array.isArray(data.claimedIds) ? data.claimedIds : [],
      pendingRewards: Array.isArray(data.pendingRewards) ? data.pendingRewards : [],
    };
  } catch {
    return { claimedIds: [], pendingRewards: [] };
  }
}

function writeJianghuGiftStore(store: JianghuGiftStore) {
  try {
    window.localStorage.setItem(JIANGHU_GIFTS_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用时静默跳过
  }
}

function expandItems(items: string[] | undefined): string[] {
  return items ? [...items] : [];
}

function readJianghuSaveSummary(): JianghuSaveSummary | null {
  try {
    const raw = window.localStorage.getItem(JIANGHU_SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      v?: number;
      playerName?: string;
      hero?: { level?: number };
      nodeId?: string;
      lastIdle?: number;
    };
    if (!data || data.v !== 1 || !data.hero || !data.nodeId) return null;
    const nodeId = data.nodeId;
    const minutes = data.lastIdle ? (Date.now() - data.lastIdle) / 60000 : 0;
    const idleHint =
      minutes >= 1
        ? `离线约 ${Math.floor(minutes)} 分钟，进游可结算挂机收益`
        : '暂无离线挂机收益，进游后开始计时';
    return {
      playerName: data.playerName || '无名侠客',
      level: data.hero.level ?? 1,
      nodeId,
      nodeTitle: JIANGHU_NODE_TITLES[nodeId] || nodeId,
      chapterLabel: jianghuChapterLabel(nodeId),
      idleHint,
      raw: data,
    };
  } catch {
    return null;
  }
}

function defaultZone(g: GameDef): ZoneContent {
  return {
    slogan: g.desc,
    publisher: 'Libre 游戏盒',
    platform: '网页 / 移动端',
    features: [g.desc, '免安装即开即玩，无需下载客户端', '支持一键全屏，随时按 Esc 返回游戏大厅'],
    controls: ['点击「开始游戏」在站内直接开局', '游戏内可点「全屏」放大画面', '按 Esc 键随时关闭并返回游戏大厅'],
    guides: [
      {
        title: `${g.name}新手入门：三分钟上手`,
        date: '2026-11-20',
        views: '1.6万',
        tag: '新手指南',
        body: `打开专区点「开始游戏」即可开局。熟悉基本操作后，再尝试全屏与收藏。本页攻略可点击展开，无需跳转外链。`,
      },
      {
        title: `${g.name}高分技巧与实战思路`,
        date: '2026-11-15',
        views: '9800',
        tag: '高手进阶',
        body: `先稳住节奏，再追求极限分。观察反馈、控制失误，比盲目加速更有效。站内即可对照练习。`,
      },
    ],
    gifts: [
      { id: `${g.id}-gift-0`, name: `${g.name}新手礼包`, items: '金币 ×500 · 体力 ×2 · 复活币 ×1', remain: '剩余 92%' },
    ],
  };
}

const ZONE_CONTENT: Partial<Record<CoverKind, ZoneContent>> = {
  // —— 江湖风云录：门户主推专区，攻略与礼包按 4399 专区结构编排 ——
  jianghu: {
    slogan: '水墨江湖，拳剑刀并立。四章主线（含第四章·余烬）、经脉与锻造、生活技能与连招 Boss，一个存档走遍江湖。',
    publisher: 'Libre 武侠工作室',
    platform: '网页 / 手机浏览器',
    features: [
      '四章主线：初入江湖 → 名动一方 → 风云际会 → 第四章·余烬，多分支结局',
      '拳 / 剑 / 刀三系开局，经脉打通与锻造词条养成战力',
      '生活技能：炼丹、酿酒、挖宝；悬赏任务与江湖奇遇',
      '回合制战斗：连招释放、Boss 阶段转换，眩晕 / 反伤 / 免伤完整判定',
    ],
    controls: [
      '在「行程」中移动场景，点击「探索」触发剧情与奇遇',
      '在「武学 / 经脉」面板培养内功与穴位，战斗中选择连招',
      '在「行囊 / 锻造」中管理丹药与兵器词条，福州可挖宝',
      '酒意随在线时间化为酒量；离线挂机收益进游结算',
    ],
    guides: [
      {
        title: '新手入门：开局门派与拳剑刀选择',
        date: '2026-11-22',
        views: '5.6万',
        tag: '新手指南',
        body: '出身决定初始属性与开局节点；门派与拳/剑/刀三系决定武学成长。建议先跟主线到第二章，再回头补悬赏与生活技能。',
      },
      {
        title: '第四章·余烬：主线推进与支线优先级',
        date: '2026-11-22',
        views: '5.1万',
        tag: '剧情攻略',
        body: '进入余烬篇后，优先完成带「余烬」标记的任务链，再刷经脉材料。Boss 战前务必检查锻造词条与丹药存量，避免硬刚阶段转换。',
      },
      {
        title: '经脉打通：穴位顺序与战力收益',
        date: '2026-11-21',
        views: '4.8万',
        tag: '养成攻略',
        body: '经脉提升气血上限与内力回复。建议先通主脉再点侧穴；材料不够时用炼丹与挂机补足，勿盲目重置。',
      },
      {
        title: '锻造与装备：非攻、青冥、支离怎么选',
        date: '2026-11-20',
        views: '4.1万',
        tag: '装备打造',
        body: '锻造消耗矿石与银两，词条优先暴击 / 吸血 / 速度。青冥偏吸血爆发，非攻偏稳控，支离适合续航；按你的连招流派选一把主武即可。',
      },
      {
        title: '生活技能：炼丹、酿酒、挖宝收益',
        date: '2026-11-19',
        views: '3.7万',
        tag: '生活玩法',
        body: '炼丹产出金创药 / 灵芝散等实战药品；酿酒抬酒量抬气血；福州挖宝看藏宝图碎片。生活技能等级会加成离线挂机。',
      },
      {
        title: '连招与 Boss：阶段转换与破招时机',
        date: '2026-11-18',
        views: '3.3万',
        tag: '战斗攻略',
        body: '普通怪用短连招清场；Boss 注意血线阶段，禁疗 / 护盾阶段优先控场与保命丹药。速度高时可抢先手连招。',
      },
      {
        title: '门派选择：华山 / 少林 / 峨眉 / 太乙 / 武当',
        date: '2026-11-17',
        views: '2.9万',
        tag: '门派攻略',
        body: '门派贡献可换高级秘籍与内功。捐银与悬赏都能攒贡献；选定一派深耕，比六派浅尝更划算。',
      },
      {
        title: '常见问题：存档、礼包与挂机',
        date: '2026-11-16',
        views: '2.4万',
        tag: '答疑',
        body: '存档键 jianghu.save.v1，大厅可导出 / 导入 JSON。礼包领取写入 jianghu.gifts.v1，进游后发放 pendingRewards。结局会清档，导出请提前。',
      },
    ],
    gifts: [
      {
        id: 'jianghu-gift-0',
        name: '新手元宝礼包',
        items: '金创药 ×3 · 银两 ×2100 · 烧刀子 ×1（小还丹→金创药）',
        remain: '剩余 86%',
        rewards: { items: ['金创药', '金创药', '金创药', '烧刀子'], silver: 2100 },
      },
      {
        id: 'jianghu-gift-1',
        name: '武侠成长礼包',
        items: '灵芝散 ×1 · 烧刀子 ×2 · 藏宝图碎片 ×3（残页→碎片）',
        remain: '剩余 64%',
        rewards: { items: ['灵芝散', '烧刀子', '烧刀子', '藏宝图碎片', '藏宝图碎片', '藏宝图碎片'] },
      },
      {
        id: 'jianghu-gift-2',
        name: '暑期尊享礼包',
        items: '青云戒 ×1 · 紫金护手 ×1 · 银两 ×288（赤血戒→青云戒）',
        remain: '剩余 31%',
        rewards: { items: ['青云戒', '紫金护手'], silver: 288 },
      },
      {
        id: 'jianghu-gift-3',
        name: '门派助力礼包',
        items: '门派贡献 ×500 · 还魂草 ×2（修炼丹→还魂草）',
        remain: '剩余 45%',
        rewards: { items: ['还魂草', '还魂草'], contribution: 500 },
      },
    ],
  },

  // —— 三国杀：卡牌专区 ——
  sanguosha: {
    slogan: '5 人身份局，主公、忠臣、内奸、反贼各怀鬼胎，4 名 AI 对手随时开局。',
    publisher: 'Libre 卡牌社',
    platform: '网页 / 移动端',
    features: ['5 人身份局：主公 + 忠臣 + 内奸 + 反贼 × 2', '4 名 AI 对手，身份推理与出牌博弈', '单机对战，无需联网与注册'],
    controls: ['点击手牌选中，再点目标角色出牌', '回合内可出杀、闪、桃与各类锦囊', '身份隐藏，观察 AI 出牌推断阵营'],
    guides: [
      {
        title: '身份局入门：各身份获胜条件',
        date: '2026-11-20',
        views: '2.2万',
        tag: '新手指南',
        body: '主公存活即胜；忠臣护主；反贼灭主；内奸需最后独活。开局先观察座位与首轮出牌，再定身份猜测。',
      },
      {
        title: '主公首轮怎么打：盲狙与保忠',
        date: '2026-11-18',
        views: '1.7万',
        tag: '高手进阶',
        body: '主公首轮不宜过度消耗手牌。优先装备与制衡，试探下家；忠臣应主动承伤，反贼则找缺口集火。',
      },
      {
        title: '内奸控场思路：如何活到最后',
        date: '2026-11-16',
        views: '1.3万',
        tag: '身份攻略',
        body: '内奸前期装忠，中期平衡双方血线，后期再翻盘。切忌过早暴露，也勿让反贼团灭过快。',
      },
    ],
    gifts: [
      { id: 'sanguosha-gift-0', name: '三国杀新手礼包', items: '武将体验卡 ×3 · 银两 ×1000', remain: '剩余 78%' },
      { id: 'sanguosha-gift-1', name: '身份局助力礼包', items: '手气卡 ×2 · 换将卡 ×1', remain: '剩余 52%' },
    ],
  },

  // —— 奶娃闯关：动作专区 ——
  naiwa: {
    slogan: '横版动作闯关：两段攻击、闪避无敌帧、敌人状态机，手感清脆的灰盒原型。',
    publisher: 'Libre 动作组',
    platform: '网页 / 桌面浏览器',
    features: ['两段连击与闪避无敌帧', '敌人巡逻、追击、攻击三态切换', '横版关卡推进，血量与能量管理'],
    controls: ['A / D 或方向键左右移动', 'J 攻击，K 闪避（有无敌帧）', '空格跳跃，Esc 返回大厅'],
    guides: [
      {
        title: '奶娃闯关操作入门与连招',
        date: '2026-11-19',
        views: '1.9万',
        tag: '新手指南',
        body: 'J 轻击可二段连招，K 闪避有无敌帧。先学会取消后摇再追击，比硬刚更稳。',
      },
      {
        title: '闪避无敌帧的判定与用法',
        date: '2026-11-14',
        views: '1.1万',
        tag: '高手进阶',
        body: '敌人抬手瞬间闪避可穿过攻击。连续闪避有冷却，留一次应对终结技。',
      },
    ],
    gifts: [
      { id: 'naiwa-gift-0', name: '奶娃新手礼包', items: '生命药水 ×3 · 能量饮料 ×2', remain: '剩余 88%' },
    ],
  },
};

function zoneOf(g: GameDef): ZoneContent {
  return ZONE_CONTENT[g.id] ?? defaultZone(g);
}

/* —— 通用小组件 —— */

function fmtCount(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`;
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value / 2);
  return (
    <span className="tracking-tight text-[#FFC53D]" aria-label={`评分 ${value.toFixed(1)}`}>
      {'★'.repeat(full)}
      <span className="text-white/30">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-content">
        <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
        {children}
      </h2>
      {action}
    </div>
  );
}

function rankBadge(i: number) {
  if (i === 0) return 'bg-[#FFC53D] text-black';
  if (i === 1) return 'bg-[#C7D2DC] text-black';
  if (i === 2) return 'bg-[#D9945B] text-black';
  return 'bg-line text-muted';
}

/** 游戏实景封面：AI 生成的 WebP 图，加载失败时回退到内置 SVG 插画 */
function GameArt({ game, eager }: { game: GameDef; eager?: boolean }) {
  return (
    <>
      <GameCover kind={game.id} accent={game.accent} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/game/covers/${game.id}.webp`}
        alt={game.name}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </>
  );
}

/** 专区截图位：封面 / 实机画面 */
function ZoneShot({ src, alt, label }: { src: string; alt: string; label: string }) {
  return (
    <figure className="relative aspect-video overflow-hidden rounded-lg border border-line bg-surface-raised">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      <figcaption className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/85">
        {label}
      </figcaption>
    </figure>
  );
}

function GameCard({ game, onOpen }: { game: GameDef; onOpen: () => void }) {
  const live = game.status === 'live';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group card relative aspect-[16/9] w-full overflow-hidden !p-0 text-left transition-all ${
        live ? 'hover:-translate-y-0.5 hover:border-[#FF5A00]/60' : 'opacity-70'
      }`}
    >
      <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
        <GameArt game={game} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
      <span
        className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-md text-sm shadow"
        style={{ background: `${game.accent}CC` }}
      >
        {game.emoji}
      </span>
      {live ? (
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-[#FFC53D]">★ {game.rating.toFixed(1)}</span>
      ) : (
        <span className="chip absolute right-2 top-2 !bg-warning/90 !px-1.5 !py-0.5 text-[9px] !text-black">敬请期待</span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <h3 className="truncate text-xs font-semibold text-white drop-shadow sm:text-sm">{game.name}</h3>
        <p className="mt-0.5 hidden truncate text-[10px] text-white/70 sm:block">{game.desc}</p>
      </div>
      <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-black shadow-lg">
          {live ? '▶ 进入专区' : '查看详情'}
        </span>
      </div>
    </button>
  );
}

/** 官方宣传片（本地 mp4，点击才加载） */
const TRAILERS = [
  { key: 'luoyang', title: '洛阳残雪', src: '/game/videos/trailer-1-luoyang.mp4', poster: '/game/scenes/luoyang-snow.webp' },
  { key: 'lantern', title: '上元灯市', src: '/game/videos/trailer-2-lantern.mp4', poster: '/game/scenes/lantern.webp' },
  { key: 'jiangnan', title: '江南水乡', src: '/game/videos/trailer-3-jiangnan.mp4', poster: '/game/scenes/jiangnan.webp' },
  { key: 'huashan', title: '华山论剑', src: '/game/videos/trailer-5-huashan.mp4', poster: '/game/scenes/huashan.webp' },
  { key: 'peak', title: '断魂崖', src: '/game/videos/trailer-6-peak.mp4', poster: '/game/scenes/peak.webp' },
];

const PORTAL_LINKS: { label: string; section?: string }[] = [
  { label: '门户首页' },
  { label: '游戏库', section: 'game-library' },
  { label: '宣传片', section: 'trailers' },
  { label: '排行榜', section: 'rank' },
  { label: '攻略', section: 'guides' },
  { label: '礼包', section: 'gifts' },
];

const ZONE_TABS = [
  { id: 'home', label: '专区首页' },
  { id: 'info', label: '游戏资料' },
  { id: 'guide', label: '攻略' },
  { id: 'gift', label: '礼包' },
] as const;

type ZoneTab = (typeof ZONE_TABS)[number]['id'];

function GuideRow({ item, index }: { item: GuideItem; index?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={open}
      >
        {typeof index === 'number' ? (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#FF5A00]/10 text-[10px] font-bold text-[#FF5A00]">
            {index + 1}
          </span>
        ) : (
          <span className="mt-0.5 shrink-0 rounded bg-[#FF5A00]/10 px-1.5 py-0.5 text-[10px] text-[#FF5A00]">{item.tag}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {typeof index === 'number' && (
              <span className="rounded bg-[#FF5A00]/10 px-1.5 py-0.5 text-[10px] text-[#FF5A00]">{item.tag}</span>
            )}
            <p className="text-xs text-content">{item.title}</p>
            <span className="ml-auto shrink-0 text-[10px] text-faint">{open ? '收起 ▴' : '展开 ▾'}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-faint">{item.date} · 阅读 {item.views}</p>
          {open && (
            <p className="mt-2 rounded-lg border border-line/70 bg-surface-raised/50 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
              {item.body}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

export default function GameClient() {
  type CatFilter = CategoryId | '__all';
  const [view, setView] = useState<'portal' | 'zone'>('portal');
  const [activeCat, setActiveCat] = useState<CatFilter>('__all');
  const [zoneId, setZoneId] = useState<CoverKind | null>(null);
  const [zoneTab, setZoneTab] = useState<ZoneTab>('home');
  const [openId, setOpenId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [query, setQuery] = useState('');
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [jhSave, setJhSave] = useState<JianghuSaveSummary | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchTerm = query.trim().toLowerCase();
  const searched = searchTerm
    ? GAMES.filter((g) => `${g.name} ${g.desc} ${g.tags.join(' ')}`.toLowerCase().includes(searchTerm))
    : [];
  const filtered = activeCat === '__all' ? GAMES : GAMES.filter((g) => g.category === activeCat);
  const hotGames = GAMES.filter((g) => g.status === 'live' && g.id !== 'jianghu')
    .slice()
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 6);
  const ranking = GAMES.filter((g) => g.status === 'live')
    .slice()
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 6);

  const latestGuides = GAMES.filter((g) => g.status === 'live')
    .flatMap((g) => zoneOf(g).guides.slice(0, 1).map((item) => ({ item, game: g })))
    .sort((a, b) => b.item.date.localeCompare(a.item.date))
    .slice(0, 5);

  const giftSpotlight = ['jianghu', 'sanguosha', 'naiwa', 'carrot']
    .map((id) => GAMES.find((g) => g.id === id))
    .filter((g): g is GameDef => Boolean(g))
    .flatMap((g) => zoneOf(g).gifts.slice(0, 1).map((gift) => ({ gift, game: g })))
    .slice(0, 4);

  const heroGame = GAMES.find((g) => g.id === 'jianghu');
  const sideFeatured = ['sanguosha', 'naiwa']
    .map((id) => GAMES.find((g) => g.id === id))
    .filter((g): g is GameDef => Boolean(g));

  const playingGame = openId ? GAMES.find((g) => g.id === openId) : undefined;
  const zoneGame = zoneId ? GAMES.find((g) => g.id === zoneId) : undefined;
  const zone = zoneGame ? zoneOf(zoneGame) : undefined;

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  const startGame = (g: GameDef) => {
    if (g.status !== 'live') return;
    setOpenId(g.id);
    setZoomed(false);
  };

  const claim = (gift: GiftPack) => {
    if (claimed[gift.id]) return;

    if (gift.id.startsWith('jianghu-') && gift.rewards) {
      const store = readJianghuGiftStore();
      if (store.claimedIds.includes(gift.id)) {
        setClaimed((prev) => ({ ...prev, [gift.id]: true }));
        showToast('该礼包已领取过');
        return;
      }
      const pending: JianghuPendingReward = {
        giftId: gift.id,
        giftName: gift.name,
        items: expandItems(gift.rewards.items),
        silver: gift.rewards.silver,
        contribution: gift.rewards.contribution,
      };
      writeJianghuGiftStore({
        claimedIds: [...store.claimedIds, gift.id],
        pendingRewards: [...store.pendingRewards, pending],
      });
      setClaimed((prev) => ({ ...prev, [gift.id]: true }));
      const bits = [
        pending.items.length ? pending.items.join('、') : '',
        pending.silver ? `银两 ×${pending.silver}` : '',
        pending.contribution ? `贡献 ×${pending.contribution}` : '',
      ].filter(Boolean);
      showToast(`已领取「${gift.name}」：${bits.join(' · ') || gift.items}（进游发放）`);
      return;
    }

    setClaimed((prev) => ({ ...prev, [gift.id]: true }));
    showToast(`已领取「${gift.name}」`);
  };

  const toggleFavorite = (id: string) => setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));

  const refreshJhSave = () => setJhSave(readJianghuSaveSummary());

  const exportJhSave = () => {
    const summary = readJianghuSaveSummary();
    if (!summary) {
      showToast('暂无江湖存档可导出');
      return;
    }
    const blob = new Blob([JSON.stringify(summary.raw, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jianghu-save-${summary.playerName || '侠客'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('存档已导出为 JSON');
  };

  const importJhSave = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const data = JSON.parse(text) as { v?: number; hero?: unknown; nodeId?: string };
        if (!data || data.v !== 1 || !data.hero || !data.nodeId) {
          showToast('存档格式无效（需要 v:1）');
          return;
        }
        window.localStorage.setItem(JIANGHU_SAVE_KEY, JSON.stringify(data));
        refreshJhSave();
        showToast('存档已导入，可点「开始游戏」继续');
      } catch {
        showToast('导入失败：JSON 无法解析');
      }
    };
    reader.readAsText(file);
  };

  const openZone = (id: CoverKind, tab: ZoneTab = 'home') => {
    setZoneId(id);
    setZoneTab(tab);
    setView('zone');
    window.scrollTo(0, 0);
    if (id === 'jianghu') refreshJhSave();
  };

  const [trailerIdx, setTrailerIdx] = useState<number | null>(null);
  const [trailerSlide, setTrailerSlide] = useState(0);
  const [trailerPaused, setTrailerPaused] = useState(false);

  // 宣传片自动轮播：悬停暂停、打开播放器时暂停、尊重「减少动态效果」
  useEffect(() => {
    if (trailerPaused || trailerIdx !== null) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setTrailerSlide((i) => (i + 1) % TRAILERS.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [trailerPaused, trailerIdx]);

  const goPortal = (section?: string) => {
    setView('portal');
    if (!section) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const selectCat = (cat: CatFilter) => {
    setActiveCat(cat);
    setQuery('');
    document.getElementById('game-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const catClass = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
      active ? 'bg-[#FF5A00]/10 font-medium text-[#FF5A00]' : 'text-muted hover:bg-hover hover:text-content'
    }`;

  const chipClass = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
      active ? 'border-[#FF5A00]/50 bg-[#FF5A00]/10 text-[#FF5A00]' : 'border-line text-muted hover:text-content'
    }`;

  // 恢复江湖礼包领取状态；进入江湖专区时刷新存档摘要
  useEffect(() => {
    const store = readJianghuGiftStore();
    if (store.claimedIds.length) {
      setClaimed((prev) => {
        const next = { ...prev };
        for (const id of store.claimedIds) next[id] = true;
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (view === 'zone' && zoneId === 'jianghu') refreshJhSave();
  }, [view, zoneId]);

  // 进入游戏时锁页面滚动，Esc 关闭
  useEffect(() => {
    if (!playingGame) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenId(null);
        setZoomed(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [playingGame]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const renderZoneGiftRow = (gift: GiftPack) => {
    const done = Boolean(claimed[gift.id]);
    return (
      <li key={gift.id} className="rounded-lg border border-line/70 bg-surface-raised/40 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-content">{gift.name}</p>
          <button
            type="button"
            onClick={() => claim(gift)}
            disabled={done}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              done ? 'cursor-default bg-line text-faint' : 'text-white'
            }`}
            style={done ? undefined : { background: BRAND_GRADIENT }}
          >
            {done ? '已领取' : '领取'}
          </button>
        </div>
        <p className="mt-1 line-clamp-1 text-[10px] text-faint">{gift.items}</p>
      </li>
    );
  };

  const renderPortal = () => (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      {/* 焦点横幅 */}
      {heroGame && !searchTerm && (
        <section className="grid gap-3 lg:grid-cols-[1.65fr_1fr]">
          <div
            onClick={() => openZone(heroGame.id)}
            className="group relative flex min-h-[260px] cursor-pointer flex-col justify-end overflow-hidden rounded-2xl border border-line sm:min-h-[330px]"
          >
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
              <GameArt game={heroGame} eager />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/5" />
            <div className="relative p-5 sm:p-7">
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white shadow" style={{ background: BRAND_GRADIENT }}>
                🔥 本周主打
              </span>
              <h1 className="mt-2.5 text-2xl font-bold text-white sm:text-4xl">{heroGame.name}</h1>
              <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-white/80 sm:text-sm">{heroGame.desc}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/75">
                <span className="flex items-center gap-1"><Stars value={heroGame.rating} /> {heroGame.rating.toFixed(1)}</span>
                <span>人气 {fmtCount(heroGame.heat)}</span>
                <span>{(CATEGORIES.find((c) => c.id === heroGame.category) || CATEGORIES[0]).name}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startGame(heroGame);
                  }}
                  className="rounded-full px-5 py-2 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105"
                  style={{ background: BRAND_GRADIENT }}
                >
                  ▶ 开始游戏
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openZone(heroGame.id);
                  }}
                  className="rounded-full border border-white/40 px-5 py-2 text-xs text-white transition-colors hover:bg-white/15"
                >
                  进入专区
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
            {sideFeatured.map((g) => (
              <div
                key={g.id}
                onClick={() => openZone(g.id)}
                className="group relative flex min-h-[150px] cursor-pointer flex-col justify-end overflow-hidden rounded-2xl border border-line"
              >
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
                  <GameArt game={g} />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="relative p-3.5">
                  <h3 className="text-sm font-semibold text-white">{g.name}</h3>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70">{g.desc}</p>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-black">
                    进入专区 ›
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 官方宣传片 */}
      <section id="trailers" className="mt-5 scroll-mt-32">
        <SectionTitle>🎬 官方宣传片</SectionTitle>
        <div
          className="relative overflow-hidden rounded-2xl border border-line bg-black"
          onMouseEnter={() => setTrailerPaused(true)}
          onMouseLeave={() => setTrailerPaused(false)}
          role="region"
          aria-label="官方宣传片轮播"
        >
          {/* 主画面 */}
          <button
            type="button"
            onClick={() => setTrailerIdx(trailerSlide)}
            className="group relative block aspect-[16/10] w-full sm:aspect-[21/9]"
          >
            <img
              key={TRAILERS[trailerSlide].key}
              src={TRAILERS[trailerSlide].poster}
              alt={TRAILERS[trailerSlide].title}
              className="h-full w-full object-cover transition-transform duration-[6000ms] ease-linear group-hover:scale-[1.03]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 sm:p-6">
              <div className="min-w-0 text-left">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/55">
                  官方宣传片 · {trailerSlide + 1}/{TRAILERS.length}
                </div>
                <div className="mt-1 truncate text-xl font-bold text-white drop-shadow sm:text-3xl">
                  {TRAILERS[trailerSlide].title}
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-black shadow-lg transition-transform group-hover:scale-105 sm:px-4 sm:text-xs">
                ▶ 播放
              </span>
            </div>
          </button>

          {/* 左右箭头 */}
          <button
            type="button"
            aria-label="上一张"
            onClick={(e) => {
              e.stopPropagation();
              setTrailerSlide((i) => (i - 1 + TRAILERS.length) % TRAILERS.length);
            }}
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 px-2.5 py-2 text-sm text-white/85 backdrop-blur-sm transition hover:bg-black/75 sm:block"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="下一张"
            onClick={(e) => {
              e.stopPropagation();
              setTrailerSlide((i) => (i + 1) % TRAILERS.length);
            }}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 px-2.5 py-2 text-sm text-white/85 backdrop-blur-sm transition hover:bg-black/75 sm:block"
          >
            ›
          </button>

          {/* 指示点 */}
          <div className="absolute right-3 top-3 flex gap-1.5">
            {TRAILERS.map((t, idx) => (
              <button
                key={t.key}
                type="button"
                aria-label={`第 ${idx + 1} 张：${t.title}`}
                onClick={() => setTrailerSlide(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === trailerSlide ? "w-5 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70"
                }`}
              />
            ))}
          </div>

          {/* 缩略图条 */}
          <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-black/70 p-2">
            {TRAILERS.map((t, idx) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTrailerSlide(idx)}
                className={`relative aspect-video w-24 shrink-0 overflow-hidden rounded-md border transition sm:w-32 ${
                  idx === trailerSlide ? "border-[#FF5A00] opacity-100" : "border-white/15 opacity-60 hover:opacity-90"
                }`}
              >
                <img src={t.poster} alt={t.title} loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white/90">
                  {t.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 宣传片播放弹层 */}
      {trailerIdx !== null && TRAILERS[trailerIdx] && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/92 p-3 backdrop-blur-sm"
          onClick={() => setTrailerIdx(null)}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold text-white">宣传片 · {TRAILERS[trailerIdx].title}</div>
              <button
                type="button"
                onClick={() => setTrailerIdx(null)}
                className="shrink-0 rounded-lg border border-white/25 px-3 py-1 text-xs text-white/85 hover:bg-white/10"
              >
                关闭
              </button>
            </div>
            <video
              key={TRAILERS[trailerIdx].src}
              src={TRAILERS[trailerIdx].src}
              poster={TRAILERS[trailerIdx].poster}
              controls
              autoPlay
              playsInline
              preload="none"
              className="w-full rounded-xl border border-white/15 shadow-2xl"
            />
          </div>
        </div>
      )}

      <section className="mt-5 grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-[180px_minmax(0,1fr)_288px]">
        {/* 左：分类 */}
        <aside className="hidden lg:block">
          <div className="card p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-content">
              <span className="h-3.5 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
              游戏分类
            </h2>
            <div className="space-y-1">
              <button type="button" onClick={() => selectCat('__all')} className={catClass(activeCat === '__all')}>
                <span className="flex items-center gap-1.5">🎮 全部游戏</span>
                <span className="text-[10px] opacity-70">{GAMES.length}</span>
              </button>
              {CATEGORIES.map((c) => {
                const count = GAMES.filter((g) => g.category === c.id).length;
                return (
                  <button key={c.id} type="button" onClick={() => selectCat(c.id)} className={catClass(activeCat === c.id)}>
                    <span className="flex items-center gap-1.5">{c.emoji} {c.name}</span>
                    <span className="text-[10px] opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card mt-3 p-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-content">
              <span className="h-3.5 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
              本周热门
            </h2>
            <ol className="space-y-2">
              {ranking.slice(0, 4).map((g, i) => (
                <li key={g.id}>
                  <button type="button" onClick={() => openZone(g.id)} className="flex w-full items-center gap-2 text-left">
                    <span className={`w-4 shrink-0 text-center text-[11px] font-bold ${i < 3 ? 'text-[#FF5A00]' : 'text-faint'}`}>{i + 1}</span>
                    <span className="truncate text-xs text-muted hover:text-content">{g.name}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* 中：内容 */}
        <div className="min-w-0">
          {searchTerm ? (
            <section id="game-library" className="scroll-mt-32">
              <SectionTitle>🔍 搜索「{query.trim()}」的结果</SectionTitle>
              {searched.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {searched.map((g) => <GameCard key={g.id} game={g} onOpen={() => openZone(g.id)} />)}
                </div>
              ) : (
                <div className="card p-8 text-center text-xs text-faint">没有找到相关游戏，换个关键词试试～</div>
              )}
            </section>
          ) : (
            <>
              <section>
                <SectionTitle
                  action={
                    <button type="button" onClick={() => selectCat('__all')} className="text-[11px] text-muted hover:text-[#FF5A00]">
                      查看全部 ›
                    </button>
                  }
                >
                  🔥 热门推荐
                </SectionTitle>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {hotGames.map((g) => <GameCard key={g.id} game={g} onOpen={() => openZone(g.id)} />)}
                </div>
              </section>

              <section id="game-library" className="mt-5 scroll-mt-32">
                <SectionTitle action={<span className="text-[11px] text-faint">共 {GAMES.length} 款</span>}>🎮 全部游戏</SectionTitle>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setActiveCat('__all')} className={chipClass(activeCat === '__all')}>全部</button>
                  {CATEGORIES.map((c) => (
                    <button key={c.id} type="button" onClick={() => setActiveCat(c.id)} className={chipClass(activeCat === c.id)}>
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {filtered.map((g) => <GameCard key={g.id} game={g} onOpen={() => openZone(g.id)} />)}
                </div>
              </section>
            </>
          )}
        </div>

        {/* 右：排行榜 / 攻略 / 礼包 */}
        <aside className="lg:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-start-1">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            <section id="rank" className="card scroll-mt-32 p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-content">
                <span className="h-3.5 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                🏆 人气排行榜
              </h2>
              <ol className="space-y-2">
                {ranking.map((g, i) => (
                  <li key={g.id}>
                    <button type="button" onClick={() => openZone(g.id)} className="flex w-full items-center gap-2 text-left">
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] font-bold ${rankBadge(i)}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-content">{g.name}</span>
                      <span className="shrink-0 text-[10px] text-faint">{fmtCount(g.heat)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>

            <section id="guides" className="card scroll-mt-32 p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-content">
                <span className="h-3.5 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                📰 最新攻略
              </h2>
              <ul className="space-y-2">
                {latestGuides.map(({ item, game }) => (
                  <li key={`${game.id}-${item.title}`}>
                    <button type="button" onClick={() => openZone(game.id, 'guide')} className="group block w-full text-left">
                      <p className="line-clamp-1 text-xs text-content group-hover:text-[#FF5A00]">{item.title}</p>
                      <p className="mt-0.5 text-[10px] text-faint">{game.name} · {item.date}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section id="gifts" className="card scroll-mt-32 p-3">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-content">
                <span className="h-3.5 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                🎁 礼包中心
              </h2>
              <ul className="space-y-2">
                {giftSpotlight.map(({ gift, game }) => {
                  const done = Boolean(claimed[gift.id]);
                  return (
                    <li key={gift.id} className="rounded-lg border border-line/70 bg-surface-raised/50 p-2">
                      <p className="truncate text-xs font-medium text-content">{gift.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-[10px] text-faint">{gift.items}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-faint">{game.name}</span>
                        <button
                          type="button"
                          onClick={() => claim(gift)}
                          disabled={done}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                            done ? 'cursor-default bg-line text-faint' : 'text-white'
                          }`}
                          style={done ? undefined : { background: BRAND_GRADIENT }}
                        >
                          {done ? '已领取' : '领取'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </aside>
      </section>

      <p className="mt-6 text-center text-[11px] text-faint">
        点击游戏卡片进入专区 · 站内即开即玩 · Esc 返回大厅
      </p>
    </div>
  );

  const renderZone = (g: GameDef, z: ZoneContent) => (
    <div className={`mx-auto w-full max-w-7xl px-4 py-5 ${g.status === 'live' ? 'pb-24 md:pb-5' : ''}`}>
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
        <button type="button" onClick={() => goPortal()} className="hover:text-[#FF5A00]">游戏盒</button>
        <span>›</span>
        <button type="button" onClick={() => goPortal('game-library')} className="hover:text-[#FF5A00]">游戏库</button>
        <span>›</span>
        <span className="text-muted">{g.name}</span>
      </nav>

      {/* 专区长头图 */}
      <section className="relative overflow-hidden rounded-2xl border border-line">
        <div className="absolute inset-0">
          <GameArt game={g} eager />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/10" />
        <div className="relative flex min-h-[240px] flex-col justify-end gap-3 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white shadow" style={{ background: BRAND_GRADIENT }}>
              {g.status === 'live' ? '页游专区' : '即将上线'}
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white/85">
              {(CATEGORIES.find((c) => c.id === g.category) || CATEGORIES[0]).name}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{g.emoji} {g.name}</h1>
          <p className="max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">{z.slogan}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.tags.map((t) => (
              <span key={t} className="rounded border border-white/25 bg-white/10 px-1.5 py-0.5 text-[10px] text-white/80">{t}</span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/75">
            <span className="flex items-center gap-1"><Stars value={g.rating} /> <span className="text-white/85">{g.rating.toFixed(1)}</span></span>
            <span>人气 {fmtCount(g.heat)}</span>
            <span>{z.platform}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startGame(g)}
              disabled={g.status !== 'live'}
              className="rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: BRAND_GRADIENT }}
            >
              ▶ 开始游戏
            </button>
            <button
              type="button"
              onClick={() => toggleFavorite(g.id)}
              className="rounded-full border border-white/40 px-4 py-2.5 text-xs text-white transition-colors hover:bg-white/15"
            >
              {favorites[g.id] ? '★ 已收藏' : '☆ 收藏'}
            </button>
          </div>
        </div>
      </section>

      {/* 专区导航 */}
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
        {ZONE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setZoneTab(tab.id)}
            className={`shrink-0 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
              zoneTab === tab.id ? 'border-[#FF5A00] text-[#FF5A00]' : 'border-transparent text-muted hover:text-content'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 专区首页 */}
      {zoneTab === 'home' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            {g.id === 'jianghu' && (
              <section className="card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-content">
                    <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                    📜 本地存档
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={exportJhSave}
                      className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted hover:border-[#FF5A00]/50 hover:text-[#FF5A00]"
                    >
                      导出 JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => importRef.current?.click()}
                      className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted hover:border-[#FF5A00]/50 hover:text-[#FF5A00]"
                    >
                      导入 JSON
                    </button>
                    <input
                      ref={importRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) importJhSave(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>
                {jhSave ? (
                  <div className="rounded-lg border border-line/70 bg-surface-raised/40 p-3">
                    <p className="text-xs font-medium text-content">
                      {jhSave.playerName} · Lv.{jhSave.level}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {jhSave.chapterLabel} · {jhSave.nodeTitle}
                    </p>
                    <p className="mt-1.5 text-[10px] text-faint">{jhSave.idleHint}</p>
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-faint">
                    暂无本地存档。开始一局后会自动写入；也可导入先前导出的 JSON。
                  </p>
                )}
              </section>
            )}

            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                🎯 游戏简介
              </h2>
              <p className="text-xs leading-relaxed text-muted">{z.slogan}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {z.features.map((f) => (
                  <div key={f} className="rounded-lg border border-line/70 bg-surface-raised/40 p-2.5 text-[11px] leading-relaxed text-muted">
                    <span className="mr-1 text-[#FF5A00]">◆</span>
                    {f}
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                🎬 游戏截图
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <ZoneShot src={`/game/covers/${g.id}.webp`} alt={`${g.name} 封面`} label="游戏封面" />
                <ZoneShot src={`/game/shots/${g.id}.webp`} alt={`${g.name} 实机画面`} label="实机画面" />
                {g.id === 'jianghu' && (
                  <>
                    <ZoneShot src="/game/promo/schools.jpg" alt="拳法剑法刀法" label="拳 · 剑 · 刀" />
                    <ZoneShot src="/game/promo/jianghu-more.jpg" alt="江湖不只有一种玩法" label="专区宣传" />
                  </>
                )}
              </div>
              {g.id === 'jianghu' && (
                <p className="mt-2 text-[10px] text-faint">拳 · 剑 · 刀三系并存；封面与实机画面体现水墨武侠氛围。</p>
              )}
            </section>

            <section className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-content">
                  <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                  📖 攻略精选
                </h2>
                <button type="button" onClick={() => setZoneTab('guide')} className="text-[11px] text-muted hover:text-[#FF5A00]">
                  全部攻略 ›
                </button>
              </div>
              <ul className="divide-y divide-line">
                {z.guides.slice(0, 3).map((item) => (
                  <GuideRow key={item.title} item={item} />
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-content">
                  <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                  🎁 礼包速递
                </h2>
                <button type="button" onClick={() => setZoneTab('gift')} className="text-[11px] text-muted hover:text-[#FF5A00]">
                  更多 ›
                </button>
              </div>
              <ul className="space-y-2">
                {z.gifts.slice(0, 2).map((gift) => renderZoneGiftRow(gift))}
              </ul>
            </section>

            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                ℹ️ 游戏信息
              </h2>
              <dl className="space-y-2 text-[11px]">
                {[
                  ['游戏类型', (CATEGORIES.find((c) => c.id === g.category) || CATEGORIES[0]).name],
                  ['游戏标签', g.tags.join(' / ')],
                  ['游戏评分', `${g.rating.toFixed(1)} 分`],
                  ['人气指数', fmtCount(g.heat)],
                  ['运营平台', z.platform],
                  ['开发团队', z.publisher],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-faint">{k}</dt>
                    <dd className="text-right text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => startGame(g)}
                disabled={g.status !== 'live'}
                className="mt-3 w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-50"
                style={{ background: BRAND_GRADIENT }}
              >
                ▶ 立即开始
              </button>
            </section>
          </aside>
        </div>
      )}

      {/* 游戏资料 */}
      {zoneTab === 'info' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                📋 基本信息
              </h2>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                {[
                  ['游戏名称', g.name],
                  ['游戏类型', (CATEGORIES.find((c) => c.id === g.category) || CATEGORIES[0]).name],
                  ['游戏标签', g.tags.join(' / ')],
                  ['游戏评分', `${g.rating.toFixed(1)} 分`],
                  ['人气指数', fmtCount(g.heat)],
                  ['运营平台', z.platform],
                  ['开发团队', z.publisher],
                  ['当前状态', g.status === 'live' ? '已上线' : '即将上线'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 rounded-lg border border-line/70 bg-surface-raised/40 px-2.5 py-2">
                    <dt className="shrink-0 text-faint">{k}</dt>
                    <dd className="text-right text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                🎮 操作说明
              </h2>
              <ol className="space-y-1.5">
                {z.controls.map((c, i) => (
                  <li key={c} className="flex gap-2 text-xs text-muted">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#FF5A00]/10 text-[10px] text-[#FF5A00]">{i + 1}</span>
                    <span className="leading-relaxed">{c}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                ✨ 玩法特色
              </h2>
              <ul className="space-y-1.5">
                {z.features.map((f) => (
                  <li key={f} className="flex gap-2 text-xs text-muted">
                    <span className="text-[#FF5A00]">◆</span>
                    <span className="leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                🚀 立即开玩
              </h2>
              <p className="text-[11px] leading-relaxed text-faint">无需下载安装，点击下方按钮即可在站内直接开局，支持全屏游玩。</p>
              <button
                type="button"
                onClick={() => startGame(g)}
                disabled={g.status !== 'live'}
                className="mt-3 w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-50"
                style={{ background: BRAND_GRADIENT }}
              >
                ▶ 开始游戏
              </button>
            </section>

            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-content">
                <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
                🎁 礼包速递
              </h2>
              <ul className="space-y-2">
                {z.gifts.slice(0, 2).map((gift) => renderZoneGiftRow(gift))}
              </ul>
            </section>
          </aside>
        </div>
      )}

      {/* 攻略 */}
      {zoneTab === 'guide' && (
        <section className="card mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-content">
              <span className="h-4 w-1 rounded-full" style={{ background: BRAND_GRADIENT }} />
              📚 {g.name}攻略大全
            </h2>
            <span className="text-[11px] text-faint">共 {z.guides.length} 篇 · 点击展开</span>
          </div>
          <ul className="divide-y divide-line">
            {z.guides.map((item, i) => (
              <GuideRow key={item.title} item={item} index={i} />
            ))}
          </ul>
        </section>
      )}

      {/* 礼包 */}
      {zoneTab === 'gift' && (
        <section className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {z.gifts.map((gift) => {
              const done = Boolean(claimed[gift.id]);
              return (
                <div key={gift.id} className="card flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-content">🎁 {gift.name}</h3>
                    <span className="shrink-0 text-[10px] text-[#FF5A00]">{gift.remain}</span>
                  </div>
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">{gift.items}</p>
                  <button
                    type="button"
                    onClick={() => claim(gift)}
                    disabled={done}
                    className={`mt-3 w-full rounded-lg py-2 text-xs font-bold transition-colors ${
                      done ? 'cursor-default bg-line text-faint' : 'text-white'
                    }`}
                    style={done ? undefined : { background: BRAND_GRADIENT }}
                  >
                    {done ? '已领取 · 进游发放' : '立即领取'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-faint">
            {g.id === 'jianghu'
              ? '江湖礼包写入本机 jianghu.gifts.v1（claimedIds + pendingRewards），进游后发放真实物品；防重复领取。'
              : '礼包为演示数据，领取状态仅保存在当前页面。'}
          </p>
        </section>
      )}

      {/* 移动端底部粘性开玩 */}
      {g.status === 'live' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => startGame(g)}
            className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg"
            style={{ background: BRAND_GRADIENT }}
          >
            ▶ 开始游戏
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearch />

      {/* 4399 风格门户导航 */}
      <div className="sticky top-14 z-30 border-b border-black/10 text-white shadow-md" style={{ background: BRAND_GRADIENT }}>
        <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-2 px-4">
          <button type="button" onClick={() => goPortal()} className="flex shrink-0 items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm shadow">🎮</span>
            <span className="text-sm font-bold tracking-wide">游戏盒</span>
          </button>
          <nav className="hidden items-center md:flex">
            {PORTAL_LINKS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => goPortal(item.section)}
                className="rounded-md px-2.5 py-1.5 text-xs text-white/90 transition-colors hover:bg-white/15 hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <form
            className="ml-auto w-32 sm:w-56"
            onSubmit={(e) => {
              e.preventDefault();
              goPortal('game-library');
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索游戏..."
              aria-label="搜索游戏"
              maxLength={40}
              className="h-8 w-full rounded-full border border-white/30 bg-white/15 px-3 text-xs text-white outline-none transition-colors placeholder:text-white/60 focus:border-white/60 focus:bg-white/25"
            />
          </form>
        </div>
      </div>

      <main className="w-full flex-1">
        {view === 'zone' && zoneGame && zone ? renderZone(zoneGame, zone) : renderPortal()}
      </main>

      <SiteFooter />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex justify-center px-4 md:bottom-8">
          <div className="pointer-events-auto max-w-md rounded-full border border-line bg-surface px-4 py-2 text-center text-xs text-content shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* 游戏播放弹层：点卡片后在这里开局，不再把所有游戏堆在页面里 */}
      {playingGame && playingGame.Renderer && (
        <div
          className={zoomed ? 'fixed inset-0 z-[80] bg-black' : 'fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-6'}
          onClick={() => {
            setOpenId(null);
            setZoomed(false);
          }}
        >
          <div
            className={
              zoomed
                ? 'flex h-full w-full flex-col bg-surface'
                : 'flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl'
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
              <span className="relative h-8 w-14 shrink-0 overflow-hidden rounded-md border border-line">
                <GameArt game={playingGame} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-content">{playingGame.name}</h3>
                <p className="hidden truncate text-[11px] text-faint sm:block">{playingGame.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomed((v) => !v)}
                className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-content"
              >
                {zoomed ? '⛶ 退出全屏' : '⛶ 全屏'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenId(null);
                  setZoomed(false);
                }}
                aria-label="关闭"
                className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-content"
              >
                ✕ 关闭
              </button>
            </div>
            <div className={`flex-1 overflow-auto bg-surface-raised ${zoomed ? 'p-2' : 'p-3 sm:p-5'}`}>
              <div className="flex justify-center">
                <playingGame.Renderer />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
