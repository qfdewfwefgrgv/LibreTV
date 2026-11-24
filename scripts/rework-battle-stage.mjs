// 把战斗界面换成「场景背景 + 双方立绘对峙 + 悬浮血条」
// 读同目录两个纯文本片段，按行号拼接，避免模板字面量转义问题
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const P = 'src/components/jianghu.tsx';
const PART1 = fs.readFileSync(path.join(here, 'battle-stage-part1-stageart.txt'), 'utf8').trimEnd();
const PART2 = fs.readFileSync(path.join(here, 'battle-stage-part2-block.txt'), 'utf8').trimEnd();

let src = fs.readFileSync(P, 'utf8');

// 1) 插入 StageArt 组件（Portrait 之前）
if (!src.includes('function StageArt')) {
  const anchor = 'function Portrait({ name, size, ring }';
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('找不到 Portrait 锚点');
  src = src.slice(0, i) + PART1 + '\n\n' + src.slice(i);
  console.log('已插入 StageArt');
} else {
  console.log('StageArt 已存在，跳过');
}

// 2) 行号替换战斗头部
const lines = src.split('\n');
const start = lines.findIndex((l) => l.includes('{/* 战斗场景横幅 */}'));
const end = lines.findIndex((l, i) => i > start && l.includes('{/* 战报 */}'));
if (start < 0 || end < 0) throw new Error('找不到战斗区块边界 start=' + start + ' end=' + end);

const out = [...lines.slice(0, start), PART2, ...lines.slice(end)].join('\n');
fs.writeFileSync(P, out, 'utf8');
console.log(`替换战斗区块：原 ${lines.length} 行 -> ${out.split('\n').length} 行（移除 ${end - start} 行，写入 ${PART2.split('\n').length} 行）`);
