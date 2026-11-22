'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 开心消消乐：8×8 彩色方块，交换相邻 → 三连消除 → 重力下落 → 新方块从顶部生成。
 * 限时 90 秒，分数累加，连锁 combo 加成。
 */

const COLS = 8;
const ROWS = 8;
const TYPES = 6; // 6 种颜色
const TIME_LIMIT = 90;

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
const EMOJIS = ['🍎', '🍋', '🍀', '💎', '🔮', '🌸'];

type Cell = { type: number; cleared?: boolean };

function createBoard(): Cell[][] {
  const b: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      let t: number;
      do { t = Math.floor(Math.random() * TYPES); } while (
        (c >= 2 && row[c - 1].type === t && row[c - 2].type === t) ||
        (r >= 2 && b[r - 1][c].type === t && b[r - 2][c].type === t)
      );
      row.push({ type: t });
    }
    b.push(row);
  }
  return b;
}

/** 找所有三连及以上，返回要消除的坐标集合 */
function findMatches(board: Cell[][]): Set<string> {
  const toClear = new Set<string>();
  // 横向
  for (let r = 0; r < ROWS; r++) {
    let runStart = 0;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && board[r][c].type === board[r][runStart].type) continue;
      const len = c - runStart;
      if (len >= 3) {
        for (let k = runStart; k < c; k++) toClear.add(`${r},${k}`);
      }
      runStart = c;
    }
  }
  // 纵向
  for (let c = 0; c < COLS; c++) {
    let runStart = 0;
    for (let r = 1; r <= ROWS; r++) {
      if (r < ROWS && board[r][c].type === board[runStart][c].type) continue;
      const len = r - runStart;
      if (len >= 3) {
        for (let k = runStart; k < r; k++) toClear.add(`${k},${c}`);
      }
      runStart = r;
    }
  }
  return toClear;
}

function cloneBoard(b: Cell[][]): Cell[][] {
  return b.map((row) => row.map((c) => ({ ...c })));
}

function swap(b: Cell[][], r1: number, c1: number, r2: number, c2: number) {
  const t = b[r1][c1]; b[r1][c1] = b[r2][c2]; b[r2][c2] = t;
}

/** 消除 → 重力下落 → 顶部生成新方块，递归直到稳定，返回总消除数 */
function resolveCascade(board: Cell[][]): { totalCleared: number; chain: number } {
  let chain = 0;
  let totalCleared = 0;
  while (true) {
    const toClear = findMatches(board);
    if (toClear.size === 0) break;
    chain++;
    totalCleared += toClear.size;
    // 标记清除
    for (const key of toClear) {
      const [r, c] = key.split(',').map(Number);
      board[r][c].cleared = true;
    }
    // 重力下落（从下往上遍历）
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (!board[r][c].cleared) {
          if (write !== r) board[write][c] = board[r][c];
          write--;
        }
      }
      // 顶部填新
      for (let r = write; r >= 0; r--) {
        board[r][c] = { type: Math.floor(Math.random() * TYPES) };
      }
    }
  }
  return { totalCleared, chain };
}

export function Match3Game() {
  const [board, setBoard] = useState<Cell[][]>(() => createBoard());
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    try { return Number(localStorage.getItem('libretv:match3-best') || '0'); } catch { return 0; }
  });
  const [time, setTime] = useState(TIME_LIMIT);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  const reset = () => {
    setBoard(createBoard());
    setScore(0);
    setTime(TIME_LIMIT);
    setSelected(null);
    setMessage('');
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          setRunning(false);
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  useEffect(() => {
    if (!running && score > best) {
      setBest(score);
      try { localStorage.setItem('libretv:match3-best', String(score)); } catch {}
    }
  }, [running, score, best]);

  const onCellClick = (r: number, c: number) => {
    if (!running || busyRef.current) return;
    if (!selected) {
      setSelected({ r, c });
      return;
    }
    // 相邻判断
    const dr = Math.abs(selected.r - r), dc = Math.abs(selected.c - c);
    if (dr + dc !== 1) {
      setSelected({ r, c }); // 重新选
      return;
    }
    // 尝试交换
    busyRef.current = true;
    const nb = cloneBoard(board);
    swap(nb, selected.r, selected.c, r, c);
    const matches = findMatches(nb);
    if (matches.size === 0) {
      // 无效交换，换回去
      swap(nb, selected.r, selected.c, r, c);
      setMessage('❌ 无效交换');
      setTimeout(() => setMessage(''), 800);
      setSelected(null);
      busyRef.current = false;
      return;
    }
    // 有效：消除连锁
    setBoard(nb);
    setSelected(null);
    setTimeout(() => {
      const resolveBoard = cloneBoard(nb);
      const { totalCleared, chain } = resolveCascade(resolveBoard);
      const gained = totalCleared * 10 * Math.max(1, chain);
      setBoard(resolveBoard);
      setScore((s) => s + gained);
      if (chain > 1) {
        setMessage(`🔥 ${chain} 连锁！+${gained}`);
        setTimeout(() => setMessage(''), 1000);
      } else {
        setMessage(`+${gained}`);
        setTimeout(() => setMessage(''), 600);
      }
      busyRef.current = false;
    }, 180);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[400px] mx-auto">
      {/* 顶部状态栏 */}
      <div className="flex items-center gap-2 w-full bg-surface-raised border border-line rounded-lg px-3 py-2 text-xs">
        <span className="font-semibold text-content">⏱ {String(time).padStart(2, '0')}s</span>
        <span className="mx-auto text-success font-semibold">分数：{score}</span>
        <span className="text-faint">最高：{best}</span>
        {!running && (
          <button
            onClick={reset}
            className="ml-2 px-2.5 py-1 rounded-md bg-accent text-on-accent text-xs font-semibold"
          >
            {time === 0 ? '再来一局' : '开始'}
          </button>
        )}
      </div>

      {/* 棋盘 */}
      <div className="relative">
        <div
          className="grid gap-1 p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-line"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isSelected = selected && selected.r === r && selected.c === c;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => onCellClick(r, c)}
                  disabled={!running}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xl sm:text-2xl transition-all ${
                    isSelected
                      ? 'ring-4 ring-warning scale-110 shadow-lg'
                      : 'hover:scale-105'
                  } ${cell.cleared ? 'animate-ping' : ''}`}
                  style={{
                    background: COLORS[cell.type],
                    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.15)',
                  }}
                >
                  <span className="drop-shadow-sm">{EMOJIS[cell.type]}</span>
                </button>
              );
            })
          )}
        </div>

        {/* 消息 / 结算 */}
        {message && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold text-white drop-shadow-lg animate-bounce pointer-events-none">
            {message}
          </div>
        )}

        {!running && time === 0 && (
          <div className="absolute inset-0 bg-black/70 rounded-xl flex flex-col items-center justify-center gap-3">
            <div className="text-2xl font-bold text-white">⏱ 时间到！</div>
            <div className="text-3xl font-bold text-warning">{score} 分</div>
            {score >= best && score > 0 && <div className="text-success font-semibold">🏆 新纪录！</div>}
            <button onClick={reset} className="px-4 py-2 rounded-lg bg-accent text-on-accent font-semibold text-sm">
              再来一局
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-faint text-center leading-relaxed">
        点击相邻方块交换，凑成 3 个及以上同色消除 · 连锁有额外加成
      </p>
    </div>
  );
}
