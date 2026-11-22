'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { GameCover, type CoverKind } from './game-cover';

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
const Jianghu     = dynamic(() => import('@/components/jianghu').then((m) => m.JianghuGame),      { ssr: false, loading: () => <div className="text-center text-faint text-sm py-8">加载江湖风云录…</div> });
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

/** 游戏封面插画为手绘 SVG，见 game-cover.tsx */
type GameComp = ComponentType;
type GameStatus = 'live' | 'coming';

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
}

type CategoryId = 'card' | 'casual' | 'parkour' | 'tower' | 'auto' | 'story' | 'action';

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
  { id: 'sanguosha', name: '三国杀（简化版）', emoji: '⚔️', desc: '身份局 5 人，主公 + 忠臣 + 内奸 + 反贼 × 2，其余 4 人机', accent: '#C62828', category: 'card', status: 'live', Renderer: Sanguosha },

  // —— 休闲益智 ——
  { id: 'match3',    name: '开心消消乐', emoji: '🍎', desc: '8×8 棋盘，限时 90 秒，连锁消除加成', accent: '#8B5CF6', category: 'casual', status: 'live', Renderer: Match3 },
  { id: 'minesweeper', name: '扫雷',     emoji: '💣', desc: '经典三档难度，第一击安全', accent: '#DC2626', category: 'casual', status: 'live', Renderer: Minesweeper },
  { id: 'gomoku',     name: '五子棋',    emoji: '⚫', desc: '双人同屏 / 单人 vs AI', accent: '#D4A574', category: 'casual', status: 'live', Renderer: Gomoku },
  { id: 'beanprincess', name: '豆公主', emoji: '👸', desc: '外链 H5 小游戏，内嵌即玩，可全屏', accent: '#EC4899', category: 'casual', status: 'live', Renderer: () => <ExternalGame src="https://h5.metaapp.cn/online/h5/BUsvkkbBiAq2pF2Ttx4j/1.0.2/6/index.html" title="豆公主" /> },
  { id: 'chess',      name: '国际象棋',  emoji: '♟️', desc: '完整走法 + 将军将死判定，2 层 Alpha-Beta AI', accent: '#B45309', category: 'casual', status: 'live', Renderer: Chess },
  { id: 'xiangqi',    name: '中国象棋',  emoji: '🀄', desc: '车马炮象士将卒全规则，含蹩马腿 / 塞象眼 / 将帅照面', accent: '#B3261E', category: 'casual', status: 'live', Renderer: Xiangqi },

  // —— 跑酷 ——
  { id: 'runner',     name: '奶龙快跑', emoji: '🐲', desc: '类 Chrome Dino，空格跳跃，速度递增', accent: '#4ADE80', category: 'parkour', status: 'live', Renderer: Runner },
  { id: 'subway',     name: '地铁跑酷', emoji: '🚇', desc: '三轨道切换，跳跃 / 滑行', accent: '#38BDF8', category: 'parkour', status: 'coming', comingSoon: '下一轮迭代，计划加轨道切换和护盾道具' },

  // —— 塔防 ——
  { id: 'carrot',     name: '保卫萝卜', emoji: '🥕', desc: '放塔守卫，升级塔，波次推进', accent: '#EA580C', category: 'tower', status: 'live', Renderer: Carrot },

  // —— 自走棋 ——
  { id: 'autochess',  name: 'Libre 自走棋', emoji: '♟️', desc: '6×6 棋盘摆棋子，回合制自动战斗', accent: '#8B5CF6', category: 'auto', status: 'live', Renderer: AutoChess },

  // —— 剧情 RPG ——
  { id: 'jianghu',    name: '江湖风云录', emoji: '🗡️', desc: '文字冒险，多分支剧情，武侠世界', accent: '#B91C1C', category: 'story', status: 'live', Renderer: Jianghu },

  // —— 横版动作 ——
  { id: 'naiwa',      name: '奶娃闯关', emoji: '🍼', desc: '横版动作灰盒原型：两段攻击、闪避无敌帧、敌人状态机', accent: '#F472B6', category: 'action', status: 'live', Renderer: Naiwa },
];

export default function GameClient() {
  type CatFilter = CategoryId | '__all';
  const [activeCat, setActiveCat] = useState<CatFilter>('card');
  const [openId, setOpenId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const filtered = activeCat === '__all' ? GAMES : GAMES.filter((g) => g.category === activeCat);
  const showAll = activeCat === '__all';
  const openGame = openId ? GAMES.find((g) => g.id === openId) : undefined;

  // 进入游戏时锁页面滚动，Esc 关闭
  useEffect(() => {
    if (!openGame) return;
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
  }, [openGame]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearch />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-content">🎮 游戏中心</h1>
          <p className="mt-1 text-xs text-faint">网页小游戏合集，即开即玩，无需下载。</p>
        </div>

        {/* 分类标签 */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setActiveCat('__all' as CategoryId)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showAll ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:text-content'
            }`}
          >
            全部
          </button>
          {CATEGORIES.map((c) => {
            const count = GAMES.filter((g) => g.category === c.id).length;
            const live = GAMES.filter((g) => g.category === c.id && g.status === 'live').length;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activeCat === c.id ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:text-content'
                }`}
              >
                {c.emoji} {c.name} <span className="text-faint/70">{live}/{count}</span>
              </button>
            );
          })}
        </div>

        {/* 游戏卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {filtered.map((g) => (
            <button
              type="button"
              key={g.id}
              onClick={() => {
                if (g.status === 'live') {
                  setOpenId(g.id);
                  setZoomed(false);
                }
              }}
              disabled={g.status !== 'live'}
              className={`group card relative aspect-[16/9] w-full overflow-hidden !p-0 text-left transition-colors ${
                g.status === 'live' ? 'cursor-pointer hover:border-accent/50' : 'cursor-default opacity-60'
              }`}
            >
              {/* 封面插画铺满整卡（卡片本身即 16:9） */}
              <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
                <GameCover kind={g.id} accent={g.accent} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <span
                className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-base shadow"
                style={{ background: `${g.accent}CC` }}
              >
                {g.emoji}
              </span>
              {g.status === 'coming' && (
                <span className="chip absolute right-2 top-2 bg-warning/90 text-black text-[9px] !px-1.5 !py-0.5">敬请期待</span>
              )}
              {g.status === 'live' && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-black shadow-lg">
                    ▶ 开始游玩
                  </span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-3">
                <h2 className="text-sm font-semibold text-white drop-shadow truncate">{g.name}</h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/75 line-clamp-2">{g.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* 即将推出 */}
        {filtered.some((g) => g.status === 'coming') && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-content mb-3">🔮 即将推出</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered
                .filter((g) => g.status === 'coming')
                .map((g) => (
                  <div key={g.id} className="card overflow-hidden !p-0 opacity-70" style={{ borderColor: `${g.accent}33` }}>
                    <div className="relative h-24 w-full overflow-hidden bg-surface-raised">
                      <GameCover kind={g.id} accent={g.accent} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span className="absolute bottom-1.5 left-2 text-xs font-semibold text-white drop-shadow">{g.emoji} {g.name}</span>
                    </div>
                    <p className="p-3 text-[11px] text-faint leading-relaxed line-clamp-2">{g.comingSoon || g.desc}</p>
                  </div>
                ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-[11px] text-faint text-center leading-relaxed">
          点卡片即可在站内开局 · Esc 键随时返回大厅
        </p>
      </main>
      <SiteFooter />

      {/* 游戏播放弹层：点卡片后在这里开局，不再把所有游戏堆在页面里 */}
      {openGame && openGame.Renderer && (
        <div
          className={zoomed ? 'fixed inset-0 z-[80] bg-black' : 'fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6'}
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
              <span className="h-8 w-14 shrink-0 overflow-hidden rounded-md border border-line">
                <GameCover kind={openGame.id} accent={openGame.accent} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-content">{openGame.name}</h3>
                <p className="hidden truncate text-[11px] text-faint sm:block">{openGame.desc}</p>
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
                <openGame.Renderer />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
