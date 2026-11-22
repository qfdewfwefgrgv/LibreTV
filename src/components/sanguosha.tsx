'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createGame,
  playCard,
  endTurn,
  aiTakeTurn,
  identityLabel,
  activateSkill,
  canTarget,
  respondAsk,
  responseCount,
  discardCard,
  dismissDeathNotice,
  suitLabel,
  SKILLS,
  type ActiveSkillId,
  type GameState,
  type Card,
  type Identity,
  type Hero,
  type Player,
  type Ask,
} from '@/lib/sanguosha/engine';
import { rollHeroChoices } from '@/lib/sanguosha/cards';

/**
 * 三国杀简化版 UI：
 * - 身份抽取 → 60 秒选将（6 选 1）→ 5 人身份局
 * - Canvas 圆桌：武将头像 / 血量 / 装备 / 判定区，点击选目标
 * - 受伤时弹出【闪】响应；出牌阶段可发动主动技
 * - 结束后公布所有人身份
 */

const CANVAS_SIZE = 440;
const SEAT_RADIUS = 152;
const AVATAR_R = 34;

type Stage = 'identity' | 'select' | 'playing';

export function SanguoshaGame() {
  const [stage, setStage] = useState<Stage>('identity');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [heroChoices, setHeroChoices] = useState<Hero[]>(() => rollHeroChoices(6));
  const [pickedHero, setPickedHero] = useState<Hero | null>(null);
  const [countdown, setCountdown] = useState(60);

  const [state, setState] = useState<GameState | null>(null);
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  const [targeting, setTargeting] = useState(false);
  const [pendingSkill, setPendingSkill] = useState<ActiveSkillId | null>(null);
  /** 武圣模式：把任意红色牌当【杀】使用 */
  const [wushengMode, setWushengMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 抽取身份 */
  const drawIdentity = () => {
    if (drawing) return;
    setDrawing(true);
    setIdentity(null);
    const pool: Identity[] = ['zhu', 'zhong', 'fan', 'jian'];
    setTimeout(() => {
      setIdentity(pool[Math.floor(Math.random() * pool.length)]);
      setDrawing(false);
    }, 700);
  };

  const startSelect = () => {
    setHeroChoices(rollHeroChoices(6));
    setPickedHero(null);
    setCountdown(60);
    setStage('select');
  };

  const startGame = (hero: Hero) => {
    setState(createGame({ identity: identity ?? 'zhu', hero }));
    setSelectedHandIdx(null);
    setTargeting(false);
    setPendingSkill(null);
    setWushengMode(false);
    setStage('playing');
  };

  const backToStart = () => {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    setState(null);
    setIdentity(null);
    setPickedHero(null);
    setSelectedHandIdx(null);
    setTargeting(false);
    setPendingSkill(null);
    setWushengMode(false);
    setStage('identity');
  };

  // 选将倒计时：超时自动选第一名
  useEffect(() => {
    if (stage !== 'select') return;
    if (countdown <= 0) {
      startGame(pickedHero ?? heroChoices[0]);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, countdown]);

  // AI 自动行动（每次 state 变化都续跑；有等待人类响应的 ask 时停下）
  useEffect(() => {
    if (!state || state.winner || state.ask) return;
    const active = state.players[state.activeSeat];
    if (active.role !== 'ai' || state.phase !== 'play') return;
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => {
      const next = cloneState(state);
      aiTakeTurn(next, active.seat);
      setState(next);
    }, 800);
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [state]);

  // Canvas 绘制
  useEffect(() => {
    if (!state) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#16202e';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 圆桌
    const cx0 = CANVAS_SIZE / 2;
    const cy0 = CANVAS_SIZE / 2;
    ctx.fillStyle = '#25402f';
    ctx.beginPath();
    ctx.arc(cx0, cy0, SEAT_RADIUS - 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f6b4e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 桌面中央信息
    ctx.fillStyle = '#d9e6d9';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`回合 ${state.turnCount}`, cx0, cy0 - 12);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#a8c0a8';
    const active = state.players[state.activeSeat];
    ctx.fillText(state.winner ? '对局结束 · 身份已公开' : `${active.hero.name} 行动中`, cx0, cy0 + 10);
    ctx.fillStyle = '#7c9483';
    ctx.font = '9px sans-serif';
    ctx.fillText(`牌堆 ${state.drawPile.length} · 弃牌 ${state.discardPile.length}`, cx0, cy0 + 28);

    const card = selectedHandIdx !== null && state.players[0] ? state.players[0].hand[selectedHandIdx] : undefined;

    for (let i = 0; i < 5; i++) {
      // seat 0 在正下方，其余顺时针排布
      const angle = Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const cx = cx0 + Math.cos(angle) * SEAT_RADIUS;
      const cy = cy0 + Math.sin(angle) * SEAT_RADIUS;
      const p = state.players[i];
      const alive = p.hp > 0;
      const isActive = !state.winner && state.activeSeat === i;
      const isValidTarget = !!card && targeting && canTarget(state, card, 0, i);

      // 头像底
      ctx.fillStyle = !alive
        ? '#26303c'
        : isValidTarget
          ? '#7f1d1d'
          : isActive
            ? '#3b3222'
            : '#1f2a38';
      ctx.beginPath();
      ctx.arc(cx, cy, AVATAR_R, 0, Math.PI * 2);
      ctx.fill();
      // 外圈
      ctx.lineWidth = isValidTarget ? 3 : isActive ? 3 : 1.5;
      ctx.strokeStyle = !alive
        ? '#3f4a58'
        : isValidTarget
          ? '#f87171'
          : isActive
            ? '#fbbf24'
            : '#4a6a90';
      ctx.stroke();

      // 头像 emoji
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(alive ? p.hero.emoji || kingdomEmoji(p.hero.kingdom) : '💀', cx, cy - 4);

      // 名字
      ctx.fillStyle = alive ? '#e8eef5' : '#66707c';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(p.hero.name, cx, cy + 17);

      // 血量
      const hpTxt = alive ? `♥ ${p.hp}/${p.maxHp}` : '阵亡';
      ctx.fillStyle = alive ? (p.hp <= p.maxHp / 2 ? '#f87171' : '#4ade80') : '#6b7280';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(hpTxt, cx, cy + 30);

      // 身份：主公公开；阵亡者的身份也已公开；结束后全公开
      const shown = state.revealAll || !!p.revealedIdentity;
      ctx.fillStyle = shown ? (p.identity === 'zhu' ? '#fbbf24' : '#9ca3af') : '#5b6673';
      ctx.font = '9px sans-serif';
      ctx.fillText(shown ? identityLabel(p.identity) : '身份?', cx, cy + 42);

      // 装备：三种槽位各一行，名字截断
      const weapon = p.equipZone.find((c) => c.equipKind === 'weapon');
      const armor = p.equipZone.find((c) => c.equipKind === 'armor');
      const horse = p.equipZone.find((c) => c.equipKind === 'horse');
      const rows: string[] = [];
      if (weapon) rows.push(`🗡${weapon.name.slice(0, 4)}`);
      if (armor) rows.push(`🛡${armor.name.slice(0, 4)}`);
      if (horse) rows.push(`🐎${horse.name.slice(0, 4)}`);
      ctx.textAlign = 'left';
      ctx.font = '8px sans-serif';
      rows.forEach((r, k) => {
        ctx.fillStyle = '#c7d4e2';
        ctx.fillText(r, cx - 30, cy + 54 + k * 9);
      });
      ctx.textAlign = 'center';

      // 判定区
      if (p.judgeZone.length > 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`⏳${p.judgeZone.map((c) => c.name[0]).join('')}`, cx, cy - 42);
      }
    }
  }, [state, targeting, selectedHandIdx]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!state || !targeting) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const scale = CANVAS_SIZE / (rect.width || CANVAS_SIZE);
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;

    for (let i = 0; i < 5; i++) {
      const angle = Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const cx = CANVAS_SIZE / 2 + Math.cos(angle) * SEAT_RADIUS;
      const cy = CANVAS_SIZE / 2 + Math.sin(angle) * SEAT_RADIUS;
      if (Math.hypot(x - cx, y - cy) > AVATAR_R + 6) continue;

      // 主动技等待选目标
      if (pendingSkill) {
        if (pendingSkill === 'qixi') {
          if (selectedHandIdx === null) { alert('请先选一张黑色手牌'); return; }
        }
        const next = cloneState(state);
        const res = activateSkill(next, 0, pendingSkill, {
          cardIdx: selectedHandIdx ?? undefined,
          targetSeat: i,
        });
        if (!res.ok) { alert(res.reason ?? '技能发动失败'); return; }
        setState(next);
        setPendingSkill(null);
        setSelectedHandIdx(null);
        setTargeting(false);
        return;
      }

      if (selectedHandIdx === null) return;
      const card = state.players[0].hand[selectedHandIdx];
      if (!card) return;
      if (card.needTarget && !canTarget(state, card, 0, i)) {
        alert(card.name === '杀' || card.name === '火杀' || card.name === '雷杀' ? '攻击距离不够！' : '该目标不合法');
        return;
      }
      const next = cloneState(state);
      const res = playCard(next, 0, selectedHandIdx, i, { asSha: wushengMode });
      if (!res.ok) { alert(res.reason ?? '出不了这张牌'); return; }
      setState(next);
      setSelectedHandIdx(null);
      setTargeting(false);
      setWushengMode(false);
    }
  };

  const handleHandCardClick = (idx: number) => {
    if (!state || state.activeSeat !== 0 || state.winner || state.ask) return;
    // 弃牌阶段：点击手牌直接弃置
    if (state.phase === 'discard' && state.discardTask?.seat === 0) {
      const n = cloneState(state);
      discardCard(n, 0, idx);
      setState(n);
      setSelectedHandIdx(null);
      return;
    }
    const card = state.players[0].hand[idx];
    if (!card) return;
    const hasWusheng = (state.players[0].hero.skillIds ?? []).includes('wusheng');
    if (card.name === '闪' && !hasWusheng) return; // 闪只能在响应时打出
    const isRedCard = card.suit === 'heart' || card.suit === 'diamond';
    // 武圣模式：任意红色牌当【杀】
    const asShaMode = wushengMode && hasWusheng && isRedCard && !['杀', '火杀', '雷杀'].includes(card.name);

    setSelectedHandIdx(idx);
    if (pendingSkill) return;
    if (asShaMode) { setTargeting(true); return; }

    const targetKind = card.targetKind;
    const needPickTarget =
      (card.needTarget && targetKind !== 'self') || (card.name === '闪' && hasWusheng);

    if (needPickTarget) {
      // 桃：自己不满血时直接给自己吃，省一次点击
      if (card.name === '桃' && state.players[0].hp < state.players[0].maxHp) {
        const next = cloneState(state);
        const res = playCard(next, 0, idx, 0);
        if (!res.ok) { alert(res.reason ?? '出不了'); return; }
        setState(next);
        setSelectedHandIdx(null);
        setTargeting(false);
        return;
      }
      setTargeting(true);
      return;
    }

    const next = cloneState(state);
    const res = playCard(next, 0, idx);
    if (!res.ok) { alert(res.reason ?? '出不了'); return; }
    setState(next);
    setSelectedHandIdx(null);
    setTargeting(false);
  };

  const handleEndTurn = () => {
    if (!state || state.activeSeat !== 0 || state.winner || state.ask || state.phase !== 'play') return;
    const next = cloneState(state);
    endTurn(next);
    setState(next);
    setSelectedHandIdx(null);
    setTargeting(false);
    setPendingSkill(null);
    setWushengMode(false);
  };

  const handleUseSkill = (skillId: ActiveSkillId) => {
    if (!state || state.activeSeat !== 0 || state.winner) return;
    if (skillId !== 'kurou' && skillId !== 'rende' && state.usedSkill.includes(skillId)) { alert('本回合已发动过该技能'); return; }

    if (skillId === 'zhiheng' || skillId === 'kurou') {
      const next = cloneState(state);
      const res = activateSkill(next, 0, skillId);
      if (!res.ok) { alert(res.reason ?? '发动失败'); return; }
      setState(next);
      return;
    }
    // 仁德 / 反间 / 青囊 / 奇袭：需要再选目标
    if (skillId === 'qingnang' && state.players[0].hp >= state.players[0].maxHp && selectedHandIdx === null) {
      alert('请先选中一张手牌，再点目标头像');
      setPendingSkill(skillId);
      setTargeting(true);
      return;
    }
    if (selectedHandIdx === null) { alert('请先选中一张手牌，再发动技能'); return; }
    setPendingSkill(skillId);
    setTargeting(true);
  };

  // —— 身份抽取 ——
  if (stage === 'identity') {
    return (
      <div className="w-full flex flex-col items-center gap-4 py-6">
        <div className="text-center">
          <div className="text-lg font-bold text-content">三国杀 · 身份局</div>
          <div className="text-xs text-faint mt-1">5 人局：主公 / 忠臣 / 反贼×2 / 内奸，你与 4 名 AI 对战</div>
        </div>

        <button
          type="button"
          onClick={drawIdentity}
          disabled={drawing}
          className={`relative w-32 h-44 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-500 ${
            drawing
              ? 'animate-pulse border-line bg-card'
              : identity
                ? 'border-accent/60 bg-accent/10 scale-105'
                : 'border-line bg-card hover:border-accent/50'
          }`}
        >
          {drawing ? (
            <span className="text-3xl">🎴</span>
          ) : identity ? (
            <>
              <span className="text-4xl">{identityEmoji(identity)}</span>
              <span className="mt-2 text-base font-bold text-content">{identityLabel(identity)}</span>
              <span className="mt-1 text-[10px] text-faint px-2 text-center leading-tight">{identityHint(identity)}</span>
            </>
          ) : (
            <>
              <span className="text-4xl">🎴</span>
              <span className="mt-2 text-xs text-muted">点击抽取身份</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={identity ? drawIdentity : undefined}
            disabled={drawing}
            className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-content hover:border-accent/50 disabled:opacity-40"
          >
            {identity ? '重抽' : '抽身份'}
          </button>
          <button
            type="button"
            disabled={!identity || drawing}
            onClick={startSelect}
            className="px-5 py-1.5 rounded-lg bg-accent text-on-accent text-sm font-semibold disabled:opacity-40"
          >
            选将 ▶
          </button>
        </div>

        <div className="max-w-sm text-[10px] text-faint text-center leading-relaxed">
          22 名武将 · 150 张牌堆 · 实装 25 个技能。抽到的身份决定胜利条件，其余 4 个身份由 AI 随机持有且不公开。
        </div>
      </div>
    );
  }

  // —— 选将（60 秒 6 选 1） ——
  if (stage === 'select') {
    return (
      <div className="w-full flex flex-col items-center gap-3 py-4">
        <div className="text-center">
          <div className="text-base font-bold text-content">
            {identity === 'zhu' ? '主公先选将' : '主公已先行选将'} · 从 6 名武将中选择 1 名
          </div>
          <div className="text-xs text-faint mt-1">
            <span className={countdown <= 10 ? 'text-danger font-semibold' : 'text-warning'}>⏱ {countdown}s</span>
            <span className="ml-2">超时将自动随机选择；每局武将随机刷新</span>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-3xl">
          {heroChoices.map((h) => {
            const picked = pickedHero?.id === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => setPickedHero(h)}
                className={`rounded-lg border-2 p-1.5 flex flex-col items-center text-center transition-all ${
                  picked ? 'border-accent bg-accent/15' : 'border-line bg-card hover:border-accent/50 hover:-translate-y-0.5'
                }`}
              >
                <div className="text-2xl leading-none">{h.emoji}</div>
                <div className="mt-1 text-xs font-bold text-content">{h.name}</div>
                <div className="text-[10px] text-faint">
                  {kingdomName(h.kingdom)} · ♥{h.hp}
                </div>
              </button>
            );
          })}
        </div>

        {/* 选中武将的详细介绍 */}
        <div className="w-full max-w-3xl min-h-[64px] rounded-lg border border-line bg-surface-raised p-2.5">
          {pickedHero ? (
            <>
              <div className="text-xs font-semibold text-content">
                {pickedHero.emoji} {pickedHero.name}
                <span className="ml-2 text-[10px] text-accent">{pickedHero.title}</span>
                <span className="ml-2 text-[10px] text-faint">{kingdomName(pickedHero.kingdom)} · ♥{pickedHero.hp}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted leading-relaxed">{pickedHero.desc}</div>
              <div className="mt-1 space-y-0.5">
                {(pickedHero.skillIds ?? []).map((sid) => (
                  <div key={sid} className="text-[10px] leading-snug">
                    <span className="text-accent font-semibold">【{SKILLS[sid]?.name}】</span>
                    <span className="text-faint">{SKILLS[sid]?.desc}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-faint">点击上方头像查看武将介绍，确认后开始对局。</div>
          )}
        </div>

        <button
          type="button"
          disabled={!pickedHero}
          onClick={() => pickedHero && startGame(pickedHero)}
          className="px-6 py-2 rounded-lg bg-accent text-on-accent text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pickedHero ? `以 ${pickedHero.name} 出战 ▶` : '请选择武将'}
        </button>
      </div>
    );
  }

  if (!state) return null;

  const me = state.players[0];
  const isMyTurn = state.activeSeat === 0 && state.phase === 'play' && !state.ask;
  const activeP = state.players[state.activeSeat];
  const selectedCard = selectedHandIdx !== null ? me.hand[selectedHandIdx] : undefined;
  const ask = state.ask;
  const askNeed = ask ? ask.needCount ?? 1 : 1;
  const askUsed = ask ? ask.usedCount ?? 0 : 0;
  const askPayable = ask ? responseCount(me, ask.need) >= askNeed - askUsed : false;
  const wuxieAsk = ask && ask.kind === 'wuxie' ? ask : null;
  const wuxieInner = wuxieAsk ? wuxieAsk.event ?? wuxieAsk.inner : undefined;
  const notice = state.deathNotice;
  const discardTask = state.discardTask && state.discardTask.seat === 0 ? state.discardTask : null;
  const canAct = isMyTurn && !discardTask && state.winner == null;
  const winCamp: 'gov' | 'fan' | 'jian' = state.winner === 'zhu' ? 'gov' : state.winner === 'fan' ? 'fan' : 'jian';

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* 阵亡公告：公开身份 + 奖惩 */}
      {notice && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border-2 border-danger/60 bg-surface p-5 text-center shadow-2xl">
            <div className="text-4xl">☠️</div>
            <div className="mt-1 text-[11px] tracking-widest text-faint">— 阵 亡 —</div>
            <div className="mt-1 text-xl font-bold text-danger">{notice.name}</div>
            {notice.killerName && <div className="mt-1 text-xs text-muted">击杀者：{notice.killerName}</div>}
            <div className="mt-4 rounded-lg border border-line bg-surface-raised py-2">
              <div className="text-[10px] text-faint">身份公开</div>
              <div className="mt-0.5 text-lg font-bold text-content">
                {identityEmoji(notice.identity)} {identityLabel(notice.identity)}
              </div>
            </div>
            {notice.reward && (
              <div className="mt-2 rounded-md bg-success/15 px-2 py-1 text-[11px] font-semibold text-success">{notice.reward}</div>
            )}
            {notice.punish && (
              <div className="mt-2 rounded-md bg-danger/15 px-2 py-1 text-[11px] font-semibold text-danger">{notice.punish}</div>
            )}
            <button
              type="button"
              onClick={() => { const n = cloneState(state); dismissDeathNotice(n); setState(n); }}
              className="mt-4 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-on-accent"
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* 左侧：游戏画面 */}
      <div className="flex-1 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 bg-surface-raised border border-line rounded-lg px-3 py-2 text-xs w-full justify-between">
          <span className="font-semibold text-content">回合 {state.turnCount}</span>
          <span className="text-muted">
            当前行动：
            <span className={activeP.role === 'human' ? 'text-accent' : 'text-warning'}>{activeP.hero.name}</span>
            {activeP.role === 'ai' ? ' (AI 思考中…)' : ''}
          </span>
          <button onClick={backToStart} className="text-xs px-2 py-1 rounded border border-line text-faint hover:text-accent">重新开始</button>
        </div>

        {/* 回合阶段条 */}
        <div className="flex items-center w-full max-w-[440px] gap-1">
          {[
            { key: 'judge', label: '判定' },
            { key: 'draw', label: '摸牌' },
            { key: 'play', label: '出牌' },
            { key: 'discard', label: '弃牌' },
          ].map((st, i) => {
            const active =
              (st.key === 'play' && state.phase === 'play') ||
              (st.key === 'discard' && state.phase === 'discard') ||
              (st.key === 'judge' && false) ||
              (st.key === 'draw' && false);
            return (
              <div
                key={st.key}
                className={`flex-1 rounded-md border py-1 text-center text-[10px] font-semibold transition-colors ${
                  active
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-line bg-card text-faint'
                }`}
              >
                {i + 1}.{st.label}
              </div>
            );
          })}
        </div>

        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="rounded-xl border border-line bg-[#16202e] w-full max-w-[440px] aspect-square"
          style={{ cursor: targeting ? 'crosshair' : 'default' }}
        />

        {/* 受伤响应 / 无懈可击响应 */}
        {ask && (
          <div
            className={`w-full max-w-[440px] rounded-lg border-2 p-3 ${
              wuxieAsk ? 'border-accent/60 bg-accent/10' : 'border-danger/60 bg-danger/10'
            }`}
          >
            {wuxieAsk ? (
              <>
                <div className="text-xs font-semibold text-accent">【无懈可击】是否抵消这次锦囊？</div>
                <div className="mt-1 text-[11px] text-content">
                  {wuxieInner
                    ? `${state.players[wuxieInner.fromSeat].hero.name} 的${wuxieInner.title} 指向 ${state.players[wuxieInner.toSeat].hero.name}`
                    : '未知的锦囊事件'}
                  {wuxieInner && wuxieInner.damage > 0 ? (
                    <span className="text-danger font-semibold">（将受到 {wuxieInner.damage} 点伤害）</span>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { const n = cloneState(state); respondAsk(n, true); setState(n); }}
                    disabled={!askPayable}
                    className="px-4 py-1.5 rounded-lg bg-accent text-on-accent text-xs font-semibold disabled:opacity-40"
                  >
                    打出【无懈可击】
                  </button>
                  <button
                    type="button"
                    onClick={() => { const n = cloneState(state); respondAsk(n, false); setState(n); }}
                    className="px-4 py-1.5 rounded-lg border border-line bg-card text-xs text-muted hover:text-accent"
                  >
                    不出，让锦囊生效
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-semibold text-danger">
                  {state.players[ask.fromSeat].hero.name} 的{ask.title}指向你
                </div>
                <div className="mt-1 text-[11px] text-content">
                  需要打出【{ask.need}】
                  {askNeed > 1 && (
                    <span className="ml-1 text-warning font-semibold">
                      · 无双：需连续 {askNeed} 张（已出 {askUsed} 张）
                    </span>
                  )}
                  ，否则受到 <span className="text-danger font-bold">{ask.damage}</span> 点伤害
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { const n = cloneState(state); respondAsk(n, true); setState(n); }}
                    disabled={!askPayable && !(ask.need === '闪' && askNeed === 1 && me.equipZone.some((c) => c.effect === 'bagua'))}
                    className="px-4 py-1.5 rounded-lg bg-accent text-on-accent text-xs font-semibold disabled:opacity-40"
                  >
                    打出【{ask.need}】{askNeed > 1 ? `(${askUsed + 1}/${askNeed})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => { const n = cloneState(state); respondAsk(n, false); setState(n); }}
                    className="px-4 py-1.5 rounded-lg border border-line bg-card text-xs text-muted hover:text-danger"
                  >
                    不出，承受伤害
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 我的判定区 / 装备区 */}
        <div className="w-full max-w-[440px] flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="text-faint">判定：</span>
          {me.judgeZone.length === 0 ? (
            <span className="text-faint/60">空</span>
          ) : (
            me.judgeZone.map((c) => <span key={c.id} className="chip bg-warning/15 text-warning">{c.name}</span>)
          )}
          <span className="ml-2 text-faint">装备：</span>
          {me.equipZone.length === 0 ? (
            <span className="text-faint/60">空</span>
          ) : (
            me.equipZone.map((c) => (
              <span key={c.id} className="chip bg-accent/15 text-accent">{equipIcon(c)}{c.name}</span>
            ))
          )}
        </div>

        {/* 手牌区 */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted">
              手牌（{me.hand.length}/{Math.max(me.hp, 0)}）· ♥ 体力 {me.hp}/{me.maxHp}
            </span>
            {!me.canPlaySha && !hasPaoxiao(me) && <span className="chip bg-danger/15 text-danger text-[10px]">本回合已出过杀</span>}
            {hasWusheng(me) && (
              <button
                type="button"
                title="把任意红色牌当作【杀】使用"
                disabled={!canAct}
                onClick={() => { setWushengMode((v) => !v); setSelectedHandIdx(null); setTargeting(false); }}
                className={`chip text-[10px] border ${wushengMode ? 'bg-warning/20 text-warning border-warning/50' : 'bg-card text-muted border-line hover:text-accent'}`}
              >
                武圣：红牌当杀{wushengMode ? ' · 已开' : ''}
              </button>
            )}
            <span className="ml-auto">
              {targeting ? (
                <span className="text-warning text-xs">
                  👉 点击目标头像{selectedCard ? `（${selectedCard.name}）` : ''}
                </span>
              ) : null}
            </span>
          </div>
          {discardTask && (
            <div className="mb-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-[11px] text-warning">
              【弃牌阶段】手牌超过体力上限，还需弃置 <b>{discardTask.count}</b> 张 —— 点击手牌即可弃置
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {me.hand.length === 0 && <span className="text-faint text-xs py-2">手牌已用完</span>}
            {me.hand.map((card, idx) => {
              const selected = selectedHandIdx === idx;
              const isShan = card.name === '闪';
              // 弃牌阶段所有手牌都可点
              const disabled = !discardTask && (!isMyTurn || state.winner != null || (isShan && !hasWusheng(me)));
              return (
                <button
                  key={card.id}
                  onClick={() => handleHandCardClick(idx)}
                  disabled={disabled}
                  className={`shrink-0 w-[62px] h-[86px] rounded-lg border-2 p-1 flex flex-col items-center justify-center text-center text-[11px] font-semibold transition-all ${
                    selected
                      ? 'border-accent bg-accent/20 -translate-y-2 shadow-lg'
                      : 'border-line bg-card hover:border-accent/40 hover:-translate-y-1'
                  } ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ color: cardNameColor(card.name) }}
                  title={cardTooltip(card)}
                >
                  <span className="text-[10px] text-faint leading-none">{suitLabel(card.suit)}{card.point}</span>
                  <span className="text-base mt-1">{cardEmoji(card.name)}</span>
                  <span className="mt-0.5 leading-tight">{card.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            disabled={!canAct}
            onClick={handleEndTurn}
            title={discardTask ? '请先完成弃牌' : undefined}
            className="px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            结束回合 ▶
          </button>

          {(me.hero.skillIds ?? []).map((sid) => {
            const sk = SKILLS[sid];
            if (!sk?.active) return null;
            const used = sid !== 'kurou' && sid !== 'rende' && state.usedSkill.includes(sid);
            return (
              <button
                key={sid}
                disabled={!canAct || used}
                onClick={() => handleUseSkill(sid as ActiveSkillId)}
                title={sk.desc}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  pendingSkill === sid
                    ? 'border-warning bg-warning/15 text-warning'
                    : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                }`}
              >
                【{sk.name}】{used ? '已用' : ''}
              </button>
            );
          })}

          {(selectedHandIdx !== null || pendingSkill || targeting) && (
            <button
              onClick={() => { setSelectedHandIdx(null); setTargeting(false); setPendingSkill(null); }}
              className="px-3 py-2 rounded-lg border border-line text-muted text-sm hover:text-danger"
            >
              取消
            </button>
          )}
        </div>

        {pendingSkill && (
          <div className="text-xs text-warning">👉 【{SKILLS[pendingSkill]?.name}】请点击目标头像</div>
        )}

        {/* 胜负 + 战功评分 */}
        {state.winner && (
          <div className="w-full max-w-[440px] bg-success/15 border border-success/40 rounded-lg p-3">
            <div className="text-center text-lg font-bold text-success">
              🎉 {winCamp === 'gov' ? '主公阵营（主公 / 忠臣）' : identityLabel(state.winner)} 获胜！
            </div>
            <div className="mt-1 text-center text-[10px] text-faint">
              评分 = 存活 40 + 击杀 ×15 + 造成伤害 ×2 + 救援 ×10 + 获胜 50
            </div>
            <div className="mt-2 space-y-1.5">
              {state.players.map((p) => {
                const grade = gradeScore(p, winCamp);
                const alive = p.hp > 0;
                return (
                  <div key={p.seat} className="rounded-md border border-line/70 bg-card/60 px-2 py-1.5">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="w-5 text-center">{p.hero.emoji}</span>
                      <span className={`font-semibold ${alive ? 'text-content' : 'text-faint'}`}>{p.hero.name}</span>
                      <span className="text-faint">
                        {identityEmoji(p.identity)} {identityLabel(p.identity)}
                      </span>
                      <span className={`font-bold ${alive ? 'text-success' : 'text-danger'}`}>
                        {alive ? `♥${p.hp}/${p.maxHp}` : '阵亡'}
                      </span>
                      <span className={`ml-auto font-bold ${grade.color}`}>
                        {grade.score} 分 {grade.label}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-faint">
                      击杀 {p.stats.kills} · 造成伤害 {p.stats.damageDealt} · 承受伤害 {p.stats.damageTaken} · 出牌 {p.stats.cardsUsed}
                      {p.stats.saves > 0 ? ` · 救援 ${p.stats.saves}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-center">
              <button onClick={backToStart} className="px-3 py-1.5 rounded-md bg-accent text-on-accent text-xs font-semibold">
                再来一局
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：武将信息 + 全场状态 + 日志 */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
        <div className="bg-surface-raised border border-line rounded-lg p-3">
          <div className="text-xs text-muted mb-2">你的武将 / 身份</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl">{me.hero.emoji}</div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-content">
                {me.hero.name}
                <span className="ml-1 text-[10px] text-faint">{kingdomName(me.hero.kingdom)}</span>
              </div>
              <div className="text-[11px] text-warning">{me.identity === 'zhu' ? '👑 ' : ''}{identityLabel(me.identity)}</div>
              <div className="text-[10px] text-faint">{me.hero.title}</div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-line space-y-1">
            {(me.hero.skillIds ?? []).map((sid) => (
              <div key={sid} className="text-[10px] leading-snug">
                <span className="text-accent font-semibold">【{SKILLS[sid]?.name}】</span>
                <span className="text-faint">{SKILLS[sid]?.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-faint leading-relaxed">{me.hero.desc}</div>
          <div className="mt-2 pt-2 border-t border-line text-[10px] text-faint leading-relaxed">
            胜利条件：主公+忠臣存活则同胜；反贼击杀主公即胜；内奸需最后单独存活。
          </div>
        </div>

        {/* 全场状态（含所有人的装备） */}
        <div className="bg-surface-raised border border-line rounded-lg p-2 space-y-1.5">
          <div className="text-xs text-muted px-1">全场状态</div>
          {state.players.map((p) => (
            <div key={p.seat} className={`p-1.5 rounded border ${state.activeSeat === p.seat ? 'border-accent/40 bg-accent/5' : 'border-transparent'} ${p.hp <= 0 ? 'opacity-45' : ''}`}>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span>{p.hero.emoji}</span>
                <span className="font-semibold text-content">{p.hero.name}</span>
                <span className="text-faint text-[10px]">
                  {state.revealAll || p.revealedIdentity ? identityLabel(p.identity) : '身份?'}
                </span>
                <span
                  className={`ml-auto font-bold ${
                    p.hp <= 0 ? 'text-danger' : p.hp <= p.maxHp / 2 ? 'text-danger' : 'text-success'
                  }`}
                >
                  {p.hp > 0 ? `♥${p.hp}/${p.maxHp}` : '阵亡'}
                </span>
                <span className="text-faint text-[10px]">手{p.hand.length}</span>
              </div>
              {(p.equipZone.length > 0 || p.judgeZone.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.equipZone.map((c) => (
                    <span key={c.id} className="chip bg-accent/15 text-accent text-[9px] !px-1 !py-0">
                      {equipIcon(c)}{c.name}
                    </span>
                  ))}
                  {p.judgeZone.map((c) => (
                    <span key={c.id} className="chip bg-warning/15 text-warning text-[9px] !px-1 !py-0">{c.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 日志 */}
        <div className="bg-surface-raised border border-line rounded-lg p-2 flex-1 min-h-[160px] max-h-[300px] overflow-y-auto">
          <div className="text-xs text-muted mb-1">动作日志</div>
          <div className="space-y-1 text-[11px] text-muted leading-relaxed">
            {state.log.slice(-50).map((l, i) => (
              <div
                key={i}
                className={`${l.startsWith('===') ? 'text-accent font-semibold mt-1' : ''} ${l.includes('阵亡') ? 'text-danger' : ''} ${l.includes('游戏结束') ? 'text-success font-bold' : ''}`}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// —— 工具 ——

function cloneAsk(a: Ask): Ask {
  return {
    ...a,
    inner: a.inner ? cloneAsk(a.inner) : undefined,
    event: a.event ? { ...a.event } : undefined,
  };
}

function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      judgeZone: [...p.judgeZone],
      equipZone: [...p.equipZone],
      attackedBy: new Set(p.attackedBy),
      playedThisTurn: [...p.playedThisTurn],
      stats: { ...p.stats },
    })),
    drawPile: [...s.drawPile],
    discardPile: [...s.discardPile],
    log: [...s.log],
    usedSkill: [...s.usedSkill],
    asks: s.asks.map(cloneAsk),
    ask: s.ask ? cloneAsk(s.ask) : null,
    deathNotice: s.deathNotice ? { ...s.deathNotice } : null,
    discardTask: s.discardTask ? { ...s.discardTask } : null,
  };
}

/** 局末战功评分：存活 / 击杀 / 伤害 / 救援 / 胜负阵营 */
function gradeScore(p: Player, winCamp: 'gov' | 'fan' | 'jian'): { score: number; label: string; color: string } {
  const st = p.stats;
  const win =
    winCamp === 'jian'
      ? p.identity === 'jian'
      : winCamp === 'gov'
        ? p.identity === 'zhu' || p.identity === 'zhong'
        : p.identity === 'fan';
  const score = (p.hp > 0 ? 40 : 0) + st.kills * 15 + st.damageDealt * 2 + st.saves * 10 + (win ? 50 : 0);
  const label = score >= 120 ? 'S' : score >= 95 ? 'A' : score >= 70 ? 'B' : 'C';
  const color =
    label === 'S' ? 'text-warning' : label === 'A' ? 'text-success' : label === 'B' ? 'text-accent' : 'text-faint';
  return { score, label, color };
}

function hasWusheng(p: { hero: Hero }): boolean {
  return (p.hero.skillIds ?? []).includes('wusheng');
}
function hasPaoxiao(p: { hero: Hero }): boolean {
  return (p.hero.skillIds ?? []).includes('paoxiao');
}

function kingdomName(k: string): string {
  switch (k) {
    case 'shu': return '蜀';
    case 'wei': return '魏';
    case 'wu': return '吴';
    case 'qun': return '群';
    default: return '';
  }
}
function kingdomEmoji(k: string): string {
  switch (k) { case 'shu': return '🐲'; case 'wei': return '🐺'; case 'wu': return '🦅'; case 'qun': return '⚔️'; default: return '⚔️'; }
}
function equipIcon(c: Card): string {
  if (c.equipKind === 'weapon') return '🗡';
  if (c.equipKind === 'armor') return '🛡';
  if (c.equipKind === 'horse') return '🐎';
  return '';
}
function identityEmoji(id: Identity): string {
  switch (id) {
    case 'zhu': return '👑';
    case 'zhong': return '🛡️';
    case 'fan': return '🗡️';
    case 'jian': return '🕵️';
  }
}
function identityHint(id: Identity): string {
  switch (id) {
    case 'zhu': return '你是主公，忠臣助你，反贼与内奸取你性命';
    case 'zhong': return '你是忠臣，需保护主公、清除反贼与内奸';
    case 'fan': return '你是反贼，击杀主公即胜';
    case 'jian': return '你是内奸，需先助主公清场，最后与主公单挑';
  }
}
function cardEmoji(n: string): string {
  if (n === '杀' || n === '火杀' || n === '雷杀') return '⚔️';
  if (n === '闪') return '🛡️';
  if (n === '桃') return '🍑';
  if (n === '酒') return '🍶';
  if (n === '无中生有') return '✦';
  if (n === '过河拆桥') return '🔨';
  if (n === '顺手牵羊') return '🫴';
  if (n === '决斗') return '⚡';
  if (n === '万箭齐发') return '🏹';
  if (n === '南蛮入侵') return '🐂';
  if (n === '桃园结义') return '🌸';
  if (n === '火攻') return '🔥';
  if (n === '乐不思蜀') return '🔗';
  if (n === '兵粮寸断') return '🌾';
  if (n === '闪电') return '🌩️';
  if (n === '无懈可击') return '✓';
  if (n === '铁索连环') return '⛓️';
  return '🗡️';
}
function cardNameColor(n: string): string {
  if (['杀', '火杀', '雷杀', '决斗', '万箭齐发', '南蛮入侵', '火攻', '闪电'].includes(n)) return '#DC2626';
  if (['桃', '酒', '乐不思蜀', '兵粮寸断', '桃园结义'].includes(n)) return '#D97706';
  if (['无中生有', '过河拆桥', '顺手牵羊', '无懈可击', '铁索连环'].includes(n)) return '#2563EB';
  return '#374151';
}
function cardTooltip(c: Card): string {
  switch (c.name) {
    case '杀': case '火杀': case '雷杀': return '对攻击范围内的一名角色造成 1 点伤害，目标可出【闪】';
    case '闪': return '【被动】被杀/万箭时打出可免伤；武圣可当【杀】';
    case '桃': return '回复自己或他人 1 点体力';
    case '酒': return '本回合下一张【杀】伤害 +1';
    case '无中生有': return '摸两张牌';
    case '过河拆桥': return '弃置目标一张手牌 / 装备 / 判定牌';
    case '顺手牵羊': return '获得距离 1 以内目标的一张牌';
    case '决斗': return '与目标轮流出【杀】，先不出者受伤';
    case '万箭齐发': return '对除自己外所有人造成 1 伤害（出闪可免）';
    case '南蛮入侵': return '对除自己外所有人造成 1 伤害（出杀可免）';
    case '桃园结义': return '所有存活角色回复 1 点体力';
    case '火攻': return '目标展示一张手牌，你弃同花色牌则造成 1 点火焰伤害（可打自己）';
    case '乐不思蜀': return '下回合判定：非红桃则跳过出牌阶段';
    case '兵粮寸断': return '下回合判定：非梅花则跳过摸牌阶段';
    case '闪电': return '判定区：判定为黑桃 2~9 时受到 3 点雷电伤害，否则传给下家';
    case '无懈可击': return '可抵消一张锦囊（决斗/万箭/南蛮等）；主动使用可拆判定区延时锦囊';
    case '铁索连环': return '重铸：弃置此牌并摸 1 张';
    default:
      return c.type === 'equip' ? `${equipIcon(c)}装备牌${c.range ? ` · 范围/距离 ${c.range}` : ''}` : c.name;
  }
}
