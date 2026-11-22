'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * 扫雷：纯 DOM 网格实现，三种难度，第一击安全，自动展开空白。
 * 桌面左右键；移动端点按 = 揭示 / 长按 = 插旗。
 */

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

type Level = { key: 'easy' | 'mid' | 'hard'; name: string; rows: number; cols: number; mines: number };
const LEVELS: Level[] = [
  { key: 'easy', name: '简单 9×9', rows: 9, cols: 9, mines: 10 },
  { key: 'mid',  name: '中等 16×16', rows: 16, cols: 16, mines: 40 },
  { key: 'hard', name: '困难 16×30', rows: 16, cols: 30, mines: 99 },
];

function createEmpty(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
}

function placeMines(grid: Cell[][], mines: number, safeR: number, safeC: number): Cell[][] {
  const rows = grid.length, cols = grid[0].length;
  // 避开点击位置 + 周围一圈
  const safeSet = new Set<string>();
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const r = safeR + dr, c = safeC + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) safeSet.add(`${r},${c}`);
    }
  const candidates: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    if (!safeSet.has(`${r},${c}`)) candidates.push([r, c]);
  // Fisher-Yates 抽 mines 个
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (let i = 0; i < Math.min(mines, candidates.length); i++) {
    const [r, c] = candidates[i];
    grid[r][c].mine = true;
  }
  // 计算邻雷数
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (grid[r][c].mine) continue;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].mine) n++;
    }
    grid[r][c].adjacent = n;
  }
  return grid;
}

function floodReveal(grid: Cell[][], r: number, c: number): Cell[][] {
  const rows = grid.length, cols = grid[0].length;
  const stack: [number, number][] = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const cell = grid[cr][cc];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !grid[nr][nc].revealed)
          stack.push([nr, nc]);
      }
    }
  }
  return grid;
}

const NUM_COLORS = ['', '#1565C0', '#2E7D32', '#C62828', '#6A1B9A', '#8D6E63', '#00796B', '#263238', '#616161'];

export function MinesweeperGame() {
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [grid, setGrid] = useState<Cell[][]>(() => createEmpty(level.rows, level.cols));
  const [firstClick, setFirstClick] = useState(true);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [flags, setFlags] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 长按已经插旗：抬手后紧跟的那次 click 要吞掉，否则会顺带把格子翻开 */
  const suppressClickRef = useRef(false);

  const mineCount = level.mines;

  const reset = useCallback((lvl: Level = level) => {
    setGrid(createEmpty(lvl.rows, lvl.cols));
    setFirstClick(true);
    setStatus('playing');
    setFlags(0);
    setElapsed(0);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, [level]);

  useEffect(() => { reset(level); }, [level, reset]);

  useEffect(() => {
    if (status !== 'playing') return;
    timerRef.current = setInterval(() => setElapsed((e) => Math.min(e + 1, 999)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const checkWin = (g: Cell[][]) => {
    for (const row of g) for (const cell of row)
      if (!cell.mine && !cell.revealed) return false;
    return true;
  };

  const revealAt = (r: number, c: number) => {
    if (status !== 'playing') return;
    setGrid((prev) => {
      const g = prev.map((row) => row.map((cell) => ({ ...cell })));
      if (g[r][c].flagged || g[r][c].revealed) return prev;
      if (firstClick) {
        placeMines(g, mineCount, r, c);
        setFirstClick(false);
      }
      if (g[r][c].mine) {
        // 踩雷：翻开所有雷
        for (const row of g) for (const cell of row) if (cell.mine) cell.revealed = true;
        setStatus('lost');
        return g;
      }
      floodReveal(g, r, c);
      if (checkWin(g)) setStatus('won');
      return g;
    });
  };

  const toggleFlag = (r: number, c: number) => {
    if (status !== 'playing') return;
    setGrid((prev) => {
      const g = prev.map((row) => row.map((cell) => ({ ...cell })));
      const cell = g[r][c];
      if (cell.revealed) return prev;
      cell.flagged = !cell.flagged;
      setFlags((f) => f + (cell.flagged ? 1 : -1));
      return g;
    });
  };

  // 长按 300ms 即插旗：原来的 500ms 手感偏慢，很多人还没到点就抬手了
  const LONG_PRESS_MS = 300;

  const longPress = (r: number, c: number) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      suppressClickRef.current = true;
      toggleFlag(r, c);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };

  const handleCellClick = (r: number, c: number) => {
    cancelLongPress();
    // 长按插旗后抬手会再触发一次 click，这里直接吞掉
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    revealAt(r, c);
  };

  const cells = useMemo(() => {
    const out: { r: number; c: number; cell: Cell }[] = [];
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[0].length; c++)
        out.push({ r, c, cell: grid[r][c] });
    return out;
  }, [grid]);

  return (
    <div className="flex flex-col gap-3">
      {/* 顶部控制 */}
      <div className="flex flex-wrap items-center gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLevel(l)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              level.key === l.key ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:text-content'
            }`}
          >
            {l.name}
          </button>
        ))}
        <button
          onClick={() => reset()}
          className="ml-auto text-xs px-2.5 py-1 rounded-md border border-line text-muted hover:text-accent hover:border-accent/50 transition-colors"
        >
          {status === 'won' ? '🎉 再来一局' : status === 'lost' ? '💥 重新来' : '🔄 重置'}
        </button>
      </div>

      {/* 状态栏 */}
      <div className="flex items-center justify-between bg-surface-raised border border-line rounded-lg px-3 py-2 text-xs">
        <span className="font-mono text-danger">💣 {String(mineCount - flags).padStart(3, '0')}</span>
        <span className={`font-semibold ${status === 'won' ? 'text-success' : status === 'lost' ? 'text-danger' : 'text-content'}`}>
          {status === 'won' ? '🎉 胜利！' : status === 'lost' ? '💥 踩雷了' : '扫雷中…'}
        </span>
        <span className="font-mono text-muted">⏱ {String(elapsed).padStart(3, '0')}</span>
      </div>

      {/* 棋盘 */}
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-[1px] bg-line p-[1px] rounded-md mx-auto select-none touch-none"
          style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0,1fr))` }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {cells.map(({ r, c, cell }) => {
            const content = cell.revealed
              ? cell.mine
                ? '💣'
                : cell.adjacent > 0
                  ? String(cell.adjacent)
                  : ''
              : cell.flagged
                ? '🚩'
                : '';
            const isLostMine = cell.revealed && cell.mine;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); cancelLongPress(); toggleFlag(r, c); }}
                onTouchStart={() => longPress(r, c)}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onTouchMove={cancelLongPress}
                className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-sm font-bold rounded-[2px] transition-colors ${
                  cell.revealed
                    ? isLostMine
                      ? 'bg-danger/30'
                      : 'bg-surface-raised'
                    : 'bg-card hover:bg-hover active:bg-accent/20 border border-line'
                }`}
                style={{ color: cell.revealed && cell.adjacent > 0 ? NUM_COLORS[cell.adjacent] : undefined }}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-faint text-center leading-relaxed">
        点击 = 揭示 / 右键(或手机长按 0.3 秒) = 插旗 / 数字周围一圈雷的数量
      </p>
    </div>
  );
}
