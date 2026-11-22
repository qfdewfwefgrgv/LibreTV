'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 五子棋：15×15 棋盘，Canvas 渲染。
 * - 双人同屏（hot-seat）模式：黑白轮流；
 * - 单人 vs AI：AI 用启发式评分（自己连成 + 阻挡对手）；
 * - 支持悔棋、重开、切换模式。
 */

const SIZE = 15;
const PADDING = 24;
const CELL = 28;
const BOARD_PX = PADDING * 2 + CELL * (SIZE - 1);

type Stone = 0 | 1 | 2; // 0 empty, 1 black, 2 white

type Mode = 'pvp' | 'pve';

function createBoard(): Stone[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0 as Stone));
}

/** 检测 (r,c) 落子后是否五连 */
function checkWin(board: Stone[][], r: number, c: number, stone: Stone): [number, number][] | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line: [number, number][] = [[r, c]];
    // 正方向
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || board[nr][nc] !== stone) break;
      line.push([nr, nc]);
    }
    // 反方向
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || board[nr][nc] !== stone) break;
      line.unshift([nr, nc]);
    }
    if (line.length >= 5) return line.slice(0, 5);
  }
  return null;
}

/** AI 评分：对每个空位，计算"自己落子的价值 + 阻挡对手的价值" */
function scoreMove(board: Stone[][], r: number, c: number, myStone: Stone): number {
  const opp: Stone = myStone === 1 ? 2 : 1;
  let score = 0;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];

  // 自己落子后的评分
  for (const [dr, dc] of dirs) {
    score += evalLine(board, r, c, dr, dc, myStone) * 1.1; // 略偏向进攻
  }
  // 对手落子的威胁评分
  for (const [dr, dc] of dirs) {
    score += evalLine(board, r, c, dr, dc, opp);
  }
  // 靠近中心权重加分
  const centerBonus = 8 - Math.max(Math.abs(r - 7), Math.abs(c - 7));
  score += centerBonus * 0.5;
  return score;
}

/** 对某方向上 (r,c) 位置落 stone 的潜力评分 */
function evalLine(board: Stone[][], r: number, c: number, dr: number, dc: number, stone: Stone): number {
  let count = 1;
  let blockEnds = 0;
  let emptyEnds = 0;

  // 正方向
  let i = 1;
  while (true) {
    const nr = r + dr * i, nc = c + dc * i;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) { blockEnds++; break; }
    if (board[nr][nc] === stone) count++;
    else if (board[nr][nc] === 0) { emptyEnds++; break; }
    else { blockEnds++; break; }
    i++;
  }
  // 反方向
  i = 1;
  while (true) {
    const nr = r - dr * i, nc = c - dc * i;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) { blockEnds++; break; }
    if (board[nr][nc] === stone) count++;
    else if (board[nr][nc] === 0) { emptyEnds++; break; }
    else { blockEnds++; break; }
    i++;
  }

  // 评分表：五连必胜 > 活四 > 冲四 > 活三 > 眠三 > 活二...
  if (count >= 5) return 100000;
  if (count === 4) {
    if (emptyEnds === 2) return 10000; // 活四
    if (emptyEnds === 1) return 1000;  // 冲四
  }
  if (count === 3) {
    if (emptyEnds === 2) return 1000;  // 活三
    if (emptyEnds === 1) return 100;   // 眠三
  }
  if (count === 2) {
    if (emptyEnds === 2) return 100;   // 活二
    if (emptyEnds === 1) return 10;
  }
  return count;
}

function aiMove(board: Stone[][], myStone: Stone): [number, number] {
  let bestScore = -Infinity;
  let bestMoves: [number, number][] = [];
  // 只考虑有邻居的空位（优化）
  const candidates: [number, number][] = [];
  const seen = new Set<string>();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (board[r][c] !== 0) {
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === 0 && !seen.has(key)) {
          seen.add(key);
          candidates.push([nr, nc]);
        }
      }
    }
  }
  if (candidates.length === 0) return [7, 7]; // 空棋盘落天元
  for (const [r, c] of candidates) {
    const s = scoreMove(board, r, c, myStone);
    if (s > bestScore) { bestScore = s; bestMoves = [[r, c]]; }
    else if (s === bestScore) bestMoves.push([r, c]);
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

export function GomokuGame() {
  const [mode, setMode] = useState<Mode>('pve');
  const [board, setBoard] = useState<Stone[][]>(() => createBoard());
  const [turn, setTurn] = useState<Stone>(1); // 黑先
  const [history, setHistory] = useState<[number, number][]>([]);
  const [winner, setWinner] = useState<Stone | null>(null);
  const [winLine, setWinLine] = useState<[number, number][] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiThinking = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = BOARD_PX * dpr;
    canvas.height = BOARD_PX * dpr;
    // 显示尺寸交给 CSS（w-full + max-w + aspect-square）控制，保证始终等比缩放，
    // 点击坐标才能用统一的缩放比换算。
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = '#F5E6C8';
    ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);
    // 网格
    ctx.strokeStyle = '#8B6F47';
    ctx.lineWidth = 1;
    for (let i = 0; i < SIZE; i++) {
      const p = PADDING + CELL * i;
      ctx.beginPath(); ctx.moveTo(PADDING, p); ctx.lineTo(BOARD_PX - PADDING, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, PADDING); ctx.lineTo(p, BOARD_PX - PADDING); ctx.stroke();
    }
    // 星位
    const stars = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
    ctx.fillStyle = '#8B6F47';
    for (const [r, c] of stars) {
      ctx.beginPath();
      ctx.arc(PADDING + CELL * c, PADDING + CELL * r, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 棋子
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) continue;
      const cx = PADDING + CELL * c, cy = PADDING + CELL * r;
      const radius = CELL * 0.42;
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(cx + 1.5, cy + 2, radius, 0, Math.PI * 2); ctx.fill();
      // 渐变
      const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      if (board[r][c] === 1) { grad.addColorStop(0, '#555'); grad.addColorStop(1, '#000'); }
      else { grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#ccc'); }
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    }
    // 获胜连线高亮
    if (winLine) {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const first = winLine[0], last = winLine[winLine.length - 1];
      ctx.moveTo(PADDING + CELL * first[1], PADDING + CELL * first[0]);
      ctx.lineTo(PADDING + CELL * last[1], PADDING + CELL * last[0]);
      ctx.stroke();
    }
    // 最后一手标记
    if (history.length > 0) {
      const [lr, lc] = history[history.length - 1];
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(PADDING + CELL * lc, PADDING + CELL * lr, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [board, winLine, history]);

  useEffect(() => { draw(); }, [draw]);

  // 单人模式 AI 自动落子
  useEffect(() => {
    if (mode !== 'pve' || winner || turn === 1) return; // 黑是玩家
    aiThinking.current = true;
    const t = setTimeout(() => {
      const [r, c] = aiMove(board, 2);
      const next = board.map((row) => row.slice()) as Stone[][];
      next[r][c] = 2;
      const win = checkWin(next, r, c, 2);
      setBoard(next);
      setHistory((h) => [...h, [r, c]]);
      if (win) { setWinner(2); setWinLine(win); }
      else setTurn(1);
      aiThinking.current = false;
    }, 200);
    return () => clearTimeout(t);
  }, [mode, turn, board, winner]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (winner || aiThinking.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    // canvas 会被 CSS（max-w-full）等比缩放，点击坐标必须按“显示尺寸 → 逻辑尺寸”换算，
    // 否则窄屏上会整体偏移好几个交叉点（此前点哪里都偏左 2 格就是这个原因）。
    const scaleX = BOARD_PX / (rect.width || BOARD_PX);
    const scaleY = BOARD_PX / (rect.height || BOARD_PX);
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    // 先找最近的交叉点，再限制误差范围（超过 0.5 格视为点在棋盘外）
    const c = Math.round((x - PADDING) / CELL);
    const r = Math.round((y - PADDING) / CELL);
    const nearX = PADDING + CELL * c;
    const nearY = PADDING + CELL * r;
    if (Math.abs(x - nearX) > CELL * 0.55 || Math.abs(y - nearY) > CELL * 0.55) return;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    if (board[r][c] !== 0) return;
    // 单人模式：玩家只能下黑子
    if (mode === 'pve' && turn !== 1) return;
    const next = board.map((row) => row.slice()) as Stone[][];
    next[r][c] = turn;
    const win = checkWin(next, r, c, turn);
    setBoard(next);
    setHistory((h) => [...h, [r, c]]);
    if (win) { setWinner(turn); setWinLine(win); }
    else setTurn(turn === 1 ? 2 : 1);
  };

  const reset = () => {
    setBoard(createBoard());
    setTurn(1);
    setHistory([]);
    setWinner(null);
    setWinLine(null);
    aiThinking.current = false;
  };

  const undo = () => {
    if (winner) return;
    // pve 模式要撤掉玩家+AI 两手
    const steps = mode === 'pve' && history.length >= 2 ? 2 : 1;
    if (history.length < steps) return;
    const newBoard = board.map((row) => row.slice()) as Stone[][];
    const newHistory = history.slice(0, -steps);
    for (let i = 0; i < steps; i++) {
      const [r, c] = history[history.length - 1 - i];
      newBoard[r][c] = 0;
    }
    setBoard(newBoard);
    setHistory(newHistory);
    setTurn(mode === 'pve' ? 1 : (steps === 2 ? 1 : turn === 1 ? 2 : 1));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setMode('pvp'); reset(); }}
          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
            mode === 'pvp' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:text-content'
          }`}
        >
          双人同屏
        </button>
        <button
          onClick={() => { setMode('pve'); reset(); }}
          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
            mode === 'pve' ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:text-content'
          }`}
        >
          单人 vs AI
        </button>
        <button onClick={undo} className="text-xs px-2.5 py-1 rounded-md border border-line text-muted hover:text-accent">
          ↶ 悔棋
        </button>
        <button onClick={reset} className="text-xs px-2.5 py-1 rounded-md border border-line text-muted hover:text-accent">
          🔄 重开
        </button>
      </div>

      <div className="text-xs text-muted">
        {winner
          ? <span className="text-success font-semibold">{winner === 1 ? '⚫ 黑棋' : '⚪ 白棋'} 获胜！🎉</span>
          : <span>当前：{turn === 1 ? '⚫ 黑棋' : '⚪ 白棋'} 落子 {mode === 'pve' && turn === 2 ? '(AI 思考中…)': ''}</span>}
      </div>

      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="rounded-lg shadow-lg cursor-pointer w-full max-w-[440px] aspect-square"
        style={{ touchAction: 'manipulation' }}
      />
    </div>
  );
}
