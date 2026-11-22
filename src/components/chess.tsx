'use client';

import { useCallback, useState } from 'react';

/**
 * 国际象棋（单机版，对 AI）
 * - 规则：各子走法 + 将军检测 + 将死/逼和判定，兵到底线升后；
 * - 简化：不含王车易位、吃过路兵（休闲玩法足够）；
 * - AI：2 层 Alpha-Beta 剪枝 + 子力评估，思考不会卡界面。
 * 棋子用 Unicode 字形渲染，零图片依赖。
 */

type Color = 'w' | 'b';
type PT = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
interface Sq { t: PT; c: Color }
type Board = (Sq | null)[];

const GLYPH: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};
const VALUE: Record<PT, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

/** 索引：0 为 a8（左上，黑方底线），63 为 h1 */
const rc = (i: number) => [Math.floor(i / 8), i % 8] as const;
const idx = (r: number, c: number) => r * 8 + c;
const inBoard = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function initBoard(): Board {
  const b: Board = Array(64).fill(null);
  const back: PT[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    b[idx(0, c)] = { t: back[c], c: 'b' };
    b[idx(1, c)] = { t: 'p', c: 'b' };
    b[idx(6, c)] = { t: 'p', c: 'w' };
    b[idx(7, c)] = { t: back[c], c: 'w' };
  }
  return b;
}

const ROOK_DIR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIR = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const KING_DIR = [...ROOK_DIR, ...BISHOP_DIR];
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

/** 生成伪合法走法（不校验将军） */
function pseudoMoves(b: Board, from: number): number[] {
  const p = b[from];
  if (!p) return [];
  const [r, c] = rc(from);
  const out: number[] = [];

  const slide = (dirs: number[][]) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inBoard(rr, cc)) {
        const t = b[idx(rr, cc)];
        if (!t) { out.push(idx(rr, cc)); }
        else { if (t.c !== p.c) out.push(idx(rr, cc)); break; }
        rr += dr; cc += dc;
      }
    }
  };

  switch (p.t) {
    case 'r': slide(ROOK_DIR); break;
    case 'b': slide(BISHOP_DIR); break;
    case 'q': slide(KING_DIR); break;
    case 'k':
      for (const [dr, dc] of KING_DIR) {
        const rr = r + dr, cc = c + dc;
        if (!inBoard(rr, cc)) continue;
        const t = b[idx(rr, cc)];
        if (!t || t.c !== p.c) out.push(idx(rr, cc));
      }
      break;
    case 'n':
      for (const [dr, dc] of KNIGHT) {
        const rr = r + dr, cc = c + dc;
        if (!inBoard(rr, cc)) continue;
        const t = b[idx(rr, cc)];
        if (!t || t.c !== p.c) out.push(idx(rr, cc));
      }
      break;
    case 'p': {
      const dir = p.c === 'w' ? -1 : 1;
      const one = idx(r + dir, c);
      if (inBoard(r + dir, c) && !b[one]) {
        out.push(one);
        // 起始位可走两格
        const startRow = p.c === 'w' ? 6 : 1;
        const two = idx(r + dir * 2, c);
        if (r === startRow && !b[two]) out.push(two);
      }
      for (const dc of [-1, 1]) {
        const rr = r + dir, cc = c + dc;
        if (!inBoard(rr, cc)) continue;
        const t = b[idx(rr, cc)];
        if (t && t.c !== p.c) out.push(idx(rr, cc));
      }
      break;
    }
  }
  return out;
}

function findKing(b: Board, color: Color): number {
  for (let i = 0; i < 64; i++) {
    const s = b[i];
    if (s && s.t === 'k' && s.c === color) return i;
  }
  return -1;
}

/** 该方是否被将军：看对方所有伪走法能否落到王所在格 */
function inCheck(b: Board, color: Color): boolean {
  const k = findKing(b, color);
  if (k < 0) return false;
  for (let i = 0; i < 64; i++) {
    const s = b[i];
    if (!s || s.c === color) continue;
    if (pseudoMoves(b, i).includes(k)) return true;
  }
  return false;
}

function applyMove(b: Board, from: number, to: number): Board {
  const nb = b.slice();
  const p = nb[from]!;
  nb[to] = p;
  nb[from] = null;
  // 兵升后
  const [tr] = rc(to);
  if (p.t === 'p' && ((p.c === 'w' && tr === 0) || (p.c === 'b' && tr === 7))) {
    nb[to] = { t: 'q', c: p.c };
  }
  return nb;
}

/** 合法走法：伪走法里过滤掉「走后自己被将军」 */
function legalMoves(b: Board, from: number): number[] {
  const p = b[from];
  if (!p) return [];
  return pseudoMoves(b, from).filter((to) => {
    const nb = applyMove(b, from, to);
    return !inCheck(nb, p.c);
  });
}

function allLegal(b: Board, color: Color): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (let i = 0; i < 64; i++) {
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

/** 简易评估：子力差 + 中心控制微调 */
function evaluate(b: Board, color: Color): number {
  return material(b, color) - material(b, color === 'w' ? 'b' : 'w');
}

const MATE = 100000;

function search(b: Board, color: Color, depth: number, alpha: number, beta: number): number {
  const moves = allLegal(b, color);
  if (moves.length === 0) return inCheck(b, color) ? -MATE - depth : 0; // 将死 / 逼和
  if (depth === 0) return evaluate(b, color);

  const maximizing = true; // 用「当前走子方」视角做极大值
  let best = -Infinity;
  // 先按吃子价值排序，剪枝更有效
  moves.sort((x, y) => {
    const a = b[y.to] ? VALUE[b[y.to]!.t] : 0;
    const c = b[x.to] ? VALUE[b[x.to]!.t] : 0;
    return a - c;
  });
  for (const m of moves) {
    const nb = applyMove(b, m.from, m.to);
    const v = -search(nb, color === 'w' ? 'b' : 'w', depth - 1, -beta, -alpha);
    if (maximizing && v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

function bestMove(b: Board, color: Color, depth = 2): { from: number; to: number } | null {
  const moves = allLegal(b, color);
  if (moves.length === 0) return null;
  moves.sort((x, y) => {
    const a = b[y.to] ? VALUE[b[y.to]!.t] : 0;
    const c = b[x.to] ? VALUE[b[x.to]!.t] : 0;
    return a - c;
  });
  let best: { from: number; to: number } | null = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    const nb = applyMove(b, m.from, m.to);
    const sc = -search(nb, color === 'w' ? 'b' : 'w', depth - 1, -Infinity, Infinity);
    if (sc > bestScore) { bestScore = sc; best = m; }
  }
  return best;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
function sqName(i: number) {
  const [r, c] = rc(i);
  return `${FILES[c]}${8 - r}`;
}

interface HistoryEntry { board: Board; turn: Color; note: string }

export function ChessGame() {
  const [board, setBoard] = useState<Board>(initBoard);
  const [turn, setTurn] = useState<Color>('w');
  const [sel, setSel] = useState<number | null>(null);
  const [hist, setHist] = useState<HistoryEntry[]>([]);
  const [note, setNote] = useState('白方先行，点击棋子选中，再点目标格落子');
  const [thinking, setThinking] = useState(false);
  const [over, setOver] = useState<'' | 'win' | 'lose' | 'draw'>('');

  const finishCheck = useCallback((b: Board, next: Color): boolean => {
    const moves = allLegal(b, next);
    if (moves.length === 0) {
      if (inCheck(b, next)) {
        setOver(next === 'w' ? 'lose' : 'win');
        setNote(next === 'w' ? '白方被将死，你输了' : '黑方被将死，你赢了！');
      } else {
        setOver('draw');
        setNote('逼和 — 和棋');
      }
      return true;
    }
    if (inCheck(b, next)) {
      setNote(next === 'w' ? '你被将军了！' : '将军！黑方要应将');
    } else {
      setNote(next === 'w' ? '轮到你走棋（白）' : 'AI 思考中…');
    }
    return false;
  }, []);

  const aiReply = useCallback((b: Board) => {
    setThinking(true);
    setTimeout(() => {
      const m = bestMove(b, 'b', 2);
      if (!m) {
        setThinking(false);
        finishCheck(b, 'b');
        return;
      }
      const nb = applyMove(b, m.from, m.to);
      setHist((h) => [...h, { board: b, turn: 'b', note: `AI: ${sqName(m.from)} → ${sqName(m.to)}` }]);
      setBoard(nb);
      setTurn('w');
      setThinking(false);
      finishCheck(nb, 'w');
    }, 280);
  }, [finishCheck]);

  const click = (i: number) => {
    if (over || thinking || turn !== 'w') return;
    const piece = board[i];

    if (sel === null) {
      if (piece && piece.c === 'w') { setSel(i); setNote(`已选中 ${sqName(i)}，绿色格为可走位置`); }
      return;
    }
    if (i === sel) { setSel(null); setNote('已取消选中'); return; }

    const legal = legalMoves(board, sel);
    if (!legal.includes(i)) {
      if (piece && piece.c === 'w') { setSel(i); setNote(`已选中 ${sqName(i)}`); }
      else { setNote('那个位置走不过去'); }
      return;
    }

    const mover = board[sel]!;
    const cap = board[i];
    const nb = applyMove(board, sel, i);
    setHist((h) => [...h, { board, turn: 'w', note: `你: ${sqName(sel)} → ${sqName(i)}` }]);
    setBoard(nb);
    setSel(null);
    setTurn('b');
    setNote(cap ? `吃掉 ${GLYPH[cap.c + cap.t]}，AI 思考中…` : 'AI 思考中…');
    // 升变提示
    if (mover.t === 'p' && rc(i)[0] === 0) setNote('兵升变为皇后！AI 思考中…');

    if (!finishCheck(nb, 'b')) aiReply(nb);
  };

  const undo = () => {
    const h = hist.slice();
    // 回退两步（自己 + AI）
    for (let k = 0; k < 2 && h.length; k++) {
      const last = h.pop()!;
      setBoard(last.board);
      setTurn(last.turn);
      if (last.turn === 'w') break;
    }
    setHist(h);
    setSel(null);
    setOver('');
    setNote('已悔棋');
  };

  const reset = () => {
    setBoard(initBoard());
    setTurn('w');
    setSel(null);
    setHist([]);
    setOver('');
    setNote('白方先行，点击棋子选中，再点目标格落子');
  };

  const legalNow = sel !== null ? legalMoves(board, sel) : [];

  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="text-muted">♔ 你（白方） vs ♚ AI（黑方）</span>
        {thinking && <span className="text-accent animate-pulse">AI 思考中…</span>}
      </div>

      <div className="grid grid-cols-8 rounded-lg overflow-hidden border-2 border-[#7A5C3E] shadow-inner">
        {board.map((sq, i) => {
          const [r, c] = rc(i);
          const dark = (r + c) % 2 === 1;
          const isSel = sel === i;
          const isTarget = legalNow.includes(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => click(i)}
              className={`relative aspect-square flex items-center justify-center text-[clamp(18px,5.2vw,32px)] leading-none transition-colors ${
                dark ? 'bg-[#B58863]' : 'bg-[#F0D9B5]'
              } ${isSel ? 'ring-2 ring-inset ring-accent' : ''} ${isTarget ? 'after:absolute after:w-2.5 after:h-2.5 after:rounded-full after:bg-[#3B8C3B]/80' : ''}`}
            >
              <span className={sq ? (sq.c === 'w' ? 'text-[#2C2C2C]' : 'text-[#1A1A1A]') : ''}>
                {sq ? GLYPH[sq.c + sq.t] : ''}
              </span>
            </button>
          );
        })}
      </div>

      {over && (
        <div className={`mt-2 rounded-lg px-3 py-2 text-sm text-center font-medium ${
          over === 'win' ? 'bg-green-500/15 text-green-600' : over === 'lose' ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-600'
        }`}>
          {over === 'win' ? '🎉 你赢了！' : over === 'lose' ? '💥 你输了' : '🤝 和棋'}
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
