'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 跑酷小游戏：类似 Chrome Dino，主角自动右跑，空格/点击跳跃。
 * - Canvas 渲染，地面 + 天空云 + 障碍物 + 分数；
 * - 速度随分数递增；
 * - 碰撞检测 → Game Over；
 * - 移动端触摸 = 跳跃。
 */

const GAME_W = 720;
const GAME_H = 260;
const GROUND_Y = 210;
const GRAVITY = 0.6;
const JUMP_V = -11.5;

type Obstacle = { x: number; w: number; h: number; kind: 'cactus' | 'bird'; y: number };

export function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    try { return Number(localStorage.getItem('libretv:runner-best') || '0'); } catch { return 0; }
  });

  // 游戏状态（ref 持有，不触发重渲染）
  const stateRef = useRef({
    runner: { x: 70, y: GROUND_Y - 36, vy: 0, w: 36, h: 36, onGround: true, frame: 0 },
    obstacles: [] as Obstacle[],
    clouds: [] as { x: number; y: number; w: number }[],
    speed: 6,
    distance: 0,
    spawnCooldown: 60,
    frame: 0,
    status: 'idle' as 'idle' | 'running' | 'over',
  });

  const rafRef = useRef<number | null>(null);

  const reset = () => {
    const s = stateRef.current;
    s.runner = { x: 70, y: GROUND_Y - 36, vy: 0, w: 36, h: 36, onGround: true, frame: 0 };
    s.obstacles = [];
    s.clouds = Array.from({ length: 3 }, () => ({
      x: Math.random() * GAME_W, y: 30 + Math.random() * 60, w: 40 + Math.random() * 30,
    }));
    s.speed = 6;
    s.distance = 0;
    s.spawnCooldown = 60;
    s.frame = 0;
    s.status = 'running';
    setScore(0);
    setStatus('running');
  };

  const jump = () => {
    const s = stateRef.current;
    if (s.status === 'over') { reset(); return; }
    if (s.status === 'idle') { reset(); return; }
    if (s.runner.onGround) {
      s.runner.vy = JUMP_V;
      s.runner.onGround = false;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_W * dpr;
    canvas.height = GAME_H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = `${GAME_W}px`;
    canvas.style.height = 'auto';
    ctx.scale(dpr, dpr);

    const draw = () => {
      const s = stateRef.current;
      // 天空
      ctx.fillStyle = '#F0F4FF';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      // 云
      ctx.fillStyle = '#D0D8E8';
      for (const c of s.clouds) {
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w * 0.55, c.w * 0.3, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x + c.w * 0.3, c.y + 2, c.w * 0.4, c.w * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 地面
      ctx.fillStyle = '#C8D0DC';
      ctx.fillRect(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y);
      // 地面纹理线
      ctx.strokeStyle = '#9CA8BA';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y); ctx.lineTo(GAME_W, GROUND_Y);
      ctx.stroke();
      // 地面上的小石子（移动产生滚动感）
      ctx.fillStyle = '#9CA8BA';
      for (let i = 0; i < 8; i++) {
        const px = ((i * 120 + s.distance * 2) % (GAME_W + 60)) - 30;
        ctx.fillRect(px, GROUND_Y + 8, 4, 2);
        ctx.fillRect(px + 40, GROUND_Y + 16, 6, 2);
      }

      // 障碍物
      for (const o of s.obstacles) {
        if (o.kind === 'cactus') {
          // 仙人掌
          ctx.fillStyle = '#2E7D32';
          ctx.fillRect(o.x, GROUND_Y - o.h, o.w, o.h);
          ctx.fillRect(o.x - o.w * 0.5, GROUND_Y - o.h * 0.55, o.w * 0.5, o.h * 0.25);
          ctx.fillRect(o.x + o.w, GROUND_Y - o.h * 0.65, o.w * 0.5, o.h * 0.25);
          ctx.strokeStyle = '#1B5E20'; ctx.lineWidth = 1;
          ctx.strokeRect(o.x, GROUND_Y - o.h, o.w, o.h);
        } else {
          // 飞鸟
          ctx.fillStyle = '#37474F';
          ctx.beginPath();
          ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // 翅膀（随帧扇动）
          const wingY = Math.sin(s.frame * 0.2) * 4;
          ctx.beginPath();
          ctx.moveTo(o.x + o.w * 0.2, o.y + o.h * 0.4);
          ctx.lineTo(o.x - 6, o.y + o.h * 0.1 + wingY);
          ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.5);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(o.x + o.w * 0.8, o.y + o.h * 0.4);
          ctx.lineTo(o.x + o.w + 6, o.y + o.h * 0.1 - wingY);
          ctx.lineTo(o.x + o.w * 0.5, o.y + o.h * 0.5);
          ctx.closePath(); ctx.fill();
          // 嘴
          ctx.fillStyle = '#FFB300';
          ctx.fillRect(o.x + o.w - 2, o.y + o.h * 0.45, 5, 2);
        }
      }

      // 主角（卡通小龙：圆身体 + 翅膀 + 眼睛）
      const r = s.runner;
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, GROUND_Y + 2, r.w * 0.45, 3, 0, 0, Math.PI * 2); ctx.fill();
      // 身体
      const bodyGrad = ctx.createRadialGradient(r.x + r.w * 0.3, r.y + r.h * 0.3, 2, r.x + r.w / 2, r.y + r.h / 2, r.w / 2);
      bodyGrad.addColorStop(0, '#A5D6A7'); bodyGrad.addColorStop(1, '#4CAF50');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2E7D32'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2.2, 0, 0, Math.PI * 2); ctx.stroke();
      // 翅膀
      const wingFlap = s.status === 'running' ? Math.sin(s.frame * 0.3) * 3 : 0;
      ctx.fillStyle = '#81C784';
      ctx.beginPath();
      ctx.moveTo(r.x + r.w * 0.25, r.y + r.h * 0.35);
      ctx.quadraticCurveTo(r.x - 6, r.y - 4 + wingFlap, r.x + 2, r.y + r.h * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r.x + r.w * 0.75, r.y + r.h * 0.35);
      ctx.quadraticCurveTo(r.x + r.w + 6, r.y - 4 - wingFlap, r.x + r.w - 2, r.y + r.h * 0.6);
      ctx.closePath(); ctx.fill();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(r.x + r.w * 0.65, r.y + r.h * 0.35, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(r.x + r.w * 0.68, r.y + r.h * 0.35, 2.5, 0, Math.PI * 2); ctx.fill();
      // 嘴
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(r.x + r.w * 0.8, r.y + r.h * 0.55, 3, 0, Math.PI);
      ctx.stroke();

      // 分数
      ctx.fillStyle = '#455A64';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`HI ${String(Math.max(best, Math.floor(s.distance / 2))).padStart(5, '0')}  ${String(Math.floor(s.distance / 2)).padStart(5, '0')}`, GAME_W - 12, 24);

      // 覆盖层
      if (s.status === 'idle') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.fillStyle = '#263238';
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('🐲 奶龙快跑', GAME_W / 2, GAME_H / 2 - 20);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#546E7A';
        ctx.fillText('按 空格 / 点击 / 触屏 开始', GAME_W / 2, GAME_H / 2 + 10);
      } else if (s.status === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('💥 Game Over', GAME_W / 2, GAME_H / 2 - 10);
        ctx.font = '14px sans-serif';
        ctx.fillText(`得分 ${Math.floor(s.distance / 2)}  ·  空格重开`, GAME_W / 2, GAME_H / 2 + 20);
      }
    };

    const tick = () => {
      const s = stateRef.current;
      s.frame++;
      if (s.status === 'running') {
        s.distance += s.speed;
        s.speed = Math.min(14, 6 + s.distance / 3000);
        // 主角物理
        if (!s.runner.onGround) {
          s.runner.vy += GRAVITY;
          s.runner.y += s.runner.vy;
          if (s.runner.y + s.runner.h >= GROUND_Y) {
            s.runner.y = GROUND_Y - s.runner.h;
            s.runner.vy = 0;
            s.runner.onGround = true;
          }
        }
        // 云移动
        for (const c of s.clouds) {
          c.x -= s.speed * 0.3;
          if (c.x + c.w < 0) { c.x = GAME_W + c.w; c.y = 20 + Math.random() * 60; }
        }
        // 障碍物移动
        for (const o of s.obstacles) o.x -= s.speed;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);
        // 生成
        s.spawnCooldown--;
        if (s.spawnCooldown <= 0) {
          const isBird = Math.random() < 0.25 && s.distance > 1500;
          if (isBird) {
            const yChoices = [GROUND_Y - 80, GROUND_Y - 55, GROUND_Y - 30];
            const y = yChoices[Math.floor(Math.random() * yChoices.length)];
            s.obstacles.push({ x: GAME_W + 20, w: 38, h: 22, kind: 'bird', y });
          } else {
            const w = 12 + Math.floor(Math.random() * 10);
            const h = 30 + Math.floor(Math.random() * 20);
            s.obstacles.push({ x: GAME_W + 20, w, h, kind: 'cactus', y: GROUND_Y - h });
          }
          s.spawnCooldown = 55 + Math.random() * 45 + Math.max(0, 40 - s.speed * 2);
        }
        // 碰撞
        const r = s.runner;
        for (const o of s.obstacles) {
          // 缩小碰撞框让手感宽松些
          const rx = r.x + 4, ry = r.y + 4, rw = r.w - 8, rh = r.h - 8;
          const ox = o.x + 2, oy = o.y + 2, ow = o.w - 4, oh = o.h - 4;
          if (rx < ox + ow && rx + rw > ox && ry < oy + oh && ry + rh > oy) {
            s.status = 'over';
            setStatus('over');
            const finalScore = Math.floor(s.distance / 2);
            setScore(finalScore);
            if (finalScore > best) {
              setBest(finalScore);
              try { localStorage.setItem('libretv:runner-best', String(finalScore)); } catch {}
            }
            break;
          }
        }
      }
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted">最高：<span className="font-mono text-warning">{best}</span></span>
        {status === 'over' && <span className="text-xs text-danger">得分：<span className="font-mono">{score}</span></span>}
        {status === 'running' && <span className="text-xs text-success">跳跃中…（空格/点击）</span>}
      </div>
      <canvas
        ref={canvasRef}
        onClick={jump}
        onTouchStart={(e) => { e.preventDefault(); jump(); }}
        className="rounded-lg shadow-lg border border-line cursor-pointer bg-white"
      />
      <p className="text-[11px] text-faint text-center">空格 / ↑ / 点击 / 触屏 = 跳跃  ·  躲开仙人掌和飞鸟</p>
    </div>
  );
}
