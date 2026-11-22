import type { Metadata } from 'next';
import Link from 'next/link';
import { NaiwaGame } from '@/games/naiwa';

export const metadata: Metadata = {
  title: '奶娃闯关 · LibreTV',
  description: '奶娃横版动作原型：移动、跳跃、三段攻击时序、闪避无敌与敌人状态机',
};

export default function NaiwaPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-content">奶娃闯关 · 灰盒原型</h1>
          <p className="mt-0.5 text-[11px] text-muted">
            阶段 1：移动 / 跳跃 / 两段攻击 / 闪避无敌帧 / 敌人有限状态机
          </p>
        </div>
        <Link
          href="/game"
          className="shrink-0 rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-content hover:border-accent/50"
        >
          ← 返回游戏中心
        </Link>
      </div>
      <NaiwaGame />
      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        这是动作化的第一个可玩切片：没有任何美术资源，角色由基础图形拼出。
        重点在验证手感——前摇是否可读、后摇接招是否顺、闪避能否躲开敌人的挥爪。
        按 F1 可以同时看到受击框、判定框和招式时间轴。
      </p>
    </main>
  );
}
