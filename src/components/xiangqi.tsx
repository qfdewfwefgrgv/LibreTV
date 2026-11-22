'use client';

import { useCallback, useState } from 'react';

/**
 * 中国象棋（单机版，对 AI）
 * - 完整走法：将/帅九宫、士/仕斜走、象/相飞田不过河、马/傌蹩腿、
 *   车/俥直行、炮隔子吃、兵/卒过河可横走，并含「将帅不照面」判负；
 * - AI：2 层 Alpha-Beta + 子力评估；
 * - 纯 Unicode 棋子字形，零图片依赖。
 */

type Color = 'r' | 'b'; // r = 红（下方），b = 黑（上方）
type PT = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p';
interface Sq { t: PT; c: Color }
type Board = (Sq | null)[];

const COLS = 9;
const ROWS = 10;
const GLYPH: Record<string, string> = {
  rk: '帥', ra: '仕', re: '相', rh: '傌', rr: '俥', rc: '炮', rp: '兵',
  bk: '將', ba: '士', be: '象', bh: '馬', br: '車', bc: '砲', bp: '卒',
};
const VALUE: Record<PT, number> = { p: 100, a: 200, e: 200, h: 400, c: 450, r: 900, k: 10000 };

const idx = (r: number, c: number) => r * COLS + c;
const rcOf = (i: number) => [Math.floor(i / COLS), i % COLS] as const;
const onBoard = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const inPalace = (color: Color, r: number, c: number) =>
  c >= 3 && c <= 5 && (color === 'r' ? r >= 7 && r <= 9 : r >= 0 && r <= 2);

function initBoard(): Board {
  const b: Board = Array(ROWS * COLS).fill(null);
  const back: PT[] = ['r', 'h', 'e', 'a', 'k', 'a', 'e', 'h', 'r'];
  for (let c = 0; c < COLS; c++) {
    b[idx(0, c)] = { t: back[c], c: 'b' };
    b[idx(9, c)] = { t: back[c], c: 'r' };
  }
  b[idx(2, 1)] = { t: 'c', c: 'b' };
  b[idx(2, 7)] = { t: 'c', c: 'b' };
  b[idx(7, 1)] = { t: 'c', c: 'r' };
  b[idx(7, 7)] = { t: 'c', c: 'r' };
  for (const c of [0, 2, 4, 6, 8]) {
    b[idx(3, c)] = { t: 'p', c: 'b' };
    b[idx(6, c)] = { t: 'p', c: 'r' };
  }
  return b;
}

const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const HORSE: [number, number, number, number][] = [
  // [dr, dc, 蹩腿dr, 蹩腿dc]
  [-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0],
  [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1],
];

function pseudoMoves(b: Board, from: number): number[] {
  const p = b[from];
  if (!p) return [];
  const [r, c] = rcOf(from);
  const out: number[] = [];
  const enemy = (t: Sq | null) => !!t && t.c !== p.c;
  const empty = (t: Sq | null) => !t;

  const slide = (dirs: number[][]) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (onBoard(rr, cc)) {
        const t = b[idx(rr, cc)];
        if (!t) out.push(idx(rr, cc));
        else { if (enemy(t)) out.push(idx(rr, cc)); break; }
        rr += dr; cc += dc;
      }
    }
  };

  switch (p.t) {
    case 'r':
      slide(ORTHO);
      break;
    case 'c': {
      // 炮：不吃子时同车；吃子必须隔且仅隔一个棋子
      for (const [dr, dc] of ORTHO) {
        let rr = r + dr, cc = c + dc;
        let screen = false;
        while (onBoard(rr, cc)) {
          const t = b[idx(rr, cc)];
          if (!screen) {
            if (!t) out.push(idx(rr, cc));
            else screen = true; // 遇到第一个子当作炮架
          } else if (t) {
            if (enemy(t)) out.push(idx(rr, cc)); // 隔一子吃
            break;
          }
          rr += dr; cc += dc;
        }
      }
      break;
    }
    case 'k':
      for (const [dr, dc] of ORTHO) {
        const rr = r + dr, cc = c + dc;
        if (!onBoard(rr, cc) || !inPalace(p.c, rr, cc)) continue;
        const t = b[idx(rr, cc)];
        if (!t || enemy(t)) out.push(idx(rr, cc));
      }
      break;
    case 'a':
      for (const [dr, dc] of DIAG) {
        const rr = r + dr, cc = c + dc;
        if (!onBoard(rr, cc) || !inPalace(p.c, rr, cc)) continue;
        const t = b[idx(rr, cc)];
        if (!t || enemy(t)) out.push(idx(rr, cc));
      }
      break;
    case 'e': {
      for (const [dr, dc] of DIAG) {
        const rr = r + dr * 2, cc = c + dc * 2;
        if (!onBoard(rr, cc)) continue;
        // 象不过河
        if (p.c === 'r' && rr < 5) continue;
        if (p.c === 'b' && rr > 4) continue;
        // 塞象眼
        if (b[idx(r + dr, c + dc)]) continue;
        const t = b[idx(rr, cc)];
        if (!t || enemy(t)) out.push(idx(rr, cc));
      }
      break;
    }
    case 'h':
      for (const [dr, dc, lr, lc] of HORSE) {
        const rr = r + dr, cc = c + dc;
        if (!onBoard(rr, cc)) continue;
        if (b[idx(r + lr, c + lc)]) continue; // 蹩马腿
        const t = b[idx(rr, cc)];
        if (!t || enemy(t)) out.push(idx(rr, cc));
      }
      break;
    case 'p': {
      const fwd = p.c === 'r' ? -1 : 1;
      const rr = r + fwd;
      if (onBoard(rr, c)) {
        const t = b[idx(rr, c)];
        if (!t || enemy(t)) out.push(idx(rr, c));
      }
      // 过河后可横走
      const crossed = p.c === 'r' ? r <= 4 : r >= 5;
      if (crossed) {
        for (const dc of [-1, 1]) {
          const cc = c + dc;
          if (!onBoard(r, cc)) continue;
          const t = b[idx(r, cc)];
          if (!t || enemy(t)) out.push(idx(r, cc));
        }
      }
      break;
    }
  }
  return out;
}

function findGeneral(b: Board, color: Color): number {
  for (let i = 0; i < b.length; i++) {
    const s = b[i];
    if (s && s.t === 'k' && s.c === color) return i;
  }
  return -1;
}

/** 将帅照面（同列且中间无子）视为非法局面 */
function generalsFacing(b: Board): boolean {
  const gr = findGeneral(b, 'r');
  const gb = findGeneral(b, 'b');
  if (gr < 0 || gb < 0) return false;
  const [rr, rc] = rcOf(gr);
  const [br, bc] = rcOf(gb);
  if (rc !== bc) return false;
  const lo = Math.min(rr, br), hi = Math.max(rr, br);
  for (let r = lo + 1; r < hi; r++) if (b[idx(r, rc)]) return false;
  return true;
}

function applyMove(b: Board, from: number, to: number): Board {
  const nb = b.slice();
  nb[to] = nb[from];
  nb[from] = null;
  return nb;
}

function legalMoves(b: Board, from: number): number[] {
  const p = b[from];
  if (!p) return [];
  return pseudoMoves(b, from).filter((to) => {
    const nb = applyMove(b, from, to);
    return !generalsFacing(nb);
  });
}

function allLegal(b: Board, color: Color): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (let i = 0; i < b.length; i++) {
    const s = b[i];
    if (!s || s.c !== color) continue;
    for (const to of legalMoves(b, i)) out.push({ from: i, to });
  }
  return out;
}

function material(b: Board, color: Color): number {
  let s = 0;
  for (const q of b) if (q && q.c === color) s += VALUE[q.t];
  return s;
}

function evaluate(b: Board, color: Color): number {
  return material(b, color) - material(b, color === 'r' ? 'b' : 'r');
}

const MATE = 100000;

function search(b: Board, color: Color, depth: number, alpha: number, beta: number): number {
  const gen = findGeneral(b, color);
  if (gen < 0) return -MATE - depth; // 己方将没了
  const moves = allLegal(b, color);
  if (moves.length === 0) return -MATE - depth; // 困毙
  if (depth === 0) return evaluate(b, color);

  moves.sort((x, y) => {
    const a = b[y.to] ? VALUE[b[y.to]!.t] : 0;
    const c = b[x.to] ? VALUE[b[x.to]!.t] : 0;
    return a - c;
  });

  let best = -Infinity;
  for (const m of moves) {
    const nb = applyMove(b, m.from, m.to);
    const v = -search(nb, color === 'r' ? 'b' : 'r', depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

function bestMove(b: Board, color: Color, depth = 2) {
  const moves = allLegal(b, color);
  if (moves.length === 0) return null;
  moves.sort((x, y) => {
    const a = b[y.to] ? VALUE[b[y.to]!.t] : 0;
    const c = b[x.to] ? VALUE[b[x.to]!.t] : 0;
    return a - c;
  });
  let best: { from: number; to: number } | null = null;
  let bs = -Infinity;
  for (const m of moves) {
    const nb = applyMove(b, m.from, m.to);
    const sc = -search(nb, color === 'r' ? 'b' : 'r', depth - 1, -Infinity, Infinity);
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}

const FILE_LABEL = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
function sqName(i: number) {
  const [r, c] = rcOf(i);
  return `${FILE_LABEL[c]}路 ${10 - r} 线`;
}

interface HistoryEntry { board: Board; turn: Color; note: string }

export function XiangqiGame() {
  const [board, setBoard] = useState<Board>(initBoard);
  const [turn, setTurn] = useState<Color>('r');
  const [sel, setSel] = useState<number | null>(null);
  const [hist, setHist] = useState<HistoryEntry[]>([]);
  const [note, setNote] = useState('红方先行（你在下方），点击棋子选中后点目标位落子');
  const [thinking, setThinking] = useState(false);
  const [over, setOver] = useState<'' | 'win' | 'lose'>('');

  const settle = useCallback((b: Board, next: Color) => {
    if (findGeneral(b, 'b') < 0) { setOver('win'); setNote('黑方将帅被吃，你赢了！'); return true; }
    if (findGeneral(b, 'r') < 0) { setOver('lose'); setNote('红方帅被吃，你输了'); return true; }
    if (allLegal(b, next).length === 0) {
      if (next === 'r') { setOver('lose'); setNote('红方无子可动（困毙），你输了'); }
      else { setOver('win'); setNote('黑方无子可动（困毙），你赢了！'); }
      return true;
    }
    setNote(next === 'r' ? '轮到你走棋（红方）' : 'AI 思考中…');
    return false;
  }, []);

  const aiReply = useCallback((b: Board) => {
    setThinking(true);
    setTimeout(() => {
      const m = bestMove(b, 'b', 2);
      setThinking(false);
      if (!m) { settle(b, 'b'); return; }
      const nb = applyMove(b, m.from, m.to);
      setHist((h) => [...h, { board: b, turn: 'b', note: `AI: ${sqName(m.from)} → ${sqName(m.to)}` }]);
      setBoard(nb);
      setTurn('r');
      settle(nb, 'r');
    }, 280);
  }, [settle]);

  const click = (i: number) => {
    if (over || thinking || turn !== 'r') return;
    const piece = board[i];
    if (sel === null) {
      if (piece && piece.c === 'r') { setSel(i); setNote(`已选中 ${sqName(i)}`); }
      return;
    }
    if (i === sel) { setSel(null); setNote('已取消选中'); return; }

    const legal = legalMoves(board, sel);
    if (!legal.includes(i)) {
      if (piece && piece.c === 'r') { setSel(i); setNote(`已选中 ${sqName(i)}`); }
      else setNote('这个位置走不过去');
      return;
    }
    const cap = board[i];
    const nb = applyMove(board, sel, i);
    setHist((h) => [...h, { board, turn: 'r', note: `你: ${sqName(sel)} → ${sqName(i)}` }]);
    setBoard(nb);
    setSel(null);
    setTurn('b');
    setNote(cap ? `吃掉 ${GLYPH[cap.c + cap.t]}，AI 思考中…` : 'AI 思考中…');
    if (!settle(nb, 'b')) aiReply(nb);
  };

  const undo = () => {
    const h = hist.slice();
    for (let k = 0; k < 2 && h.length; k++) {
      const last = h.pop()!;
      setBoard(last.board);
      setTurn(last.turn);
      if (last.turn === 'r') break;
    }
    setHist(h);
    setSel(null);
    setOver('');
    setNote('已悔棋');
  };

  const reset = () => {
    setBoard(initBoard());
    setTurn('r');
    setSel(null);
    setHist([]);
    setOver('');
    setNote('红方先行（你在下方），点击棋子选中后点目标位落子');
  };

  const legalNow = sel !== null ? legalMoves(board, sel) : [];

  return (
    <div className="w-full max-w-[380px] mx-auto">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="text-muted">帥 你（红方，下方） vs 將 AI（黑方）</span>
        {thinking && <span className="text-accent animate-pulse">AI 思考中…</span>}
      </div>

      <div className="relative rounded-lg overflow-hidden border-2 border-[#8B6A47] bg-[#EFD9B4]">
        {/* 楚河汉界 */}
        <div className="absolute left-0 right-0 top-[40%] h-[10%] flex items-center justify-between px-6 pointer-events-none">
          <span className="text-[11px] tracking-[0.3em] text-[#9A7B52]/70">楚 河</span>
          <span className="text-[11px] tracking-[0.3em] text-[#9A7B52]/70">汉 界</span>
        </div>

        <div className="grid grid-cols-9">
          {board.map((sq, i) => {
            const isSel = sel === i;
            const isTarget = legalNow.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => click(i)}
                className={`relative aspect-square flex items-center justify-center border border-[#C4A57B]/50 ${
                  isSel ? 'bg-[#FFE7A3]' : isTarget ? 'bg-[#D9E9C3]' : ''
                }`}
              >
                {isTarget && <span className="absolute w-1.5 h-1.5 rounded-full bg-[#3B8C3B]/70" />}
                {sq ? (
                  <span
                    className={`relative flex items-center justify-center w-[86%] h-[86%] rounded-full text-[clamp(13px,3.6vw,22px)] leading-none font-semibold select-none ${
                      sq.c === 'r'
                        ? 'text-[#B3261E] bg-[#FFFBEF] border border-[#D8B98C]'
                        : 'text-[#1F2933] bg-[#F7F2E7] border border-[#D8B98C]'
                    }`}
                  >
                    {GLYPH[sq.c + sq.t]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {over && (
        <div className={`mt-2 rounded-lg px-3 py-2 text-sm text-center font-medium ${
          over === 'win' ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
        }`}>
          {over === 'win' ? '🎉 你赢了！' : '💥 你输了'}
        </div>
      )}

      <div className="mt-2 text-center text-xs text-faint min-h-[18px]">{note}</div>

      <div className="mt-2 flex gap-2 justify-center">
        <button type="button" onClick={undo} disabled={!hist.length || thinking} className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-content hover:border-accent/50 disabled:opacity-40">
          ↩ 悔棋
        </button>
        <button type="button" onClick={reset} className="px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-content hover:border-accent/50">
          ⟳ 重新开始
        </button>
      </div>
    </div>
  );
}
