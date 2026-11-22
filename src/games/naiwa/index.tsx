'use client';

import { useEffect, useRef, useState } from 'react';
import { VIEW_H, VIEW_W } from './config';
import type { Action } from './input';
import { FixedLoop } from './loop';
import { NaiwaWorld } from './world';

/**
 * 奶娃闯关：React 外壳。
 *
 * 只负责挂载 Canvas、接键盘与触屏按键、启停循环；
 * 所有战斗逻辑都在 world.ts 里，方便以后整体搬去独立引擎。
 */

function PadButton({
  label,
  onPress,
  onRelease,
  accent = false,
}: {
  label: string;
  onPress: () => void;
  onRelease?: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        'touch-none select-none rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm active:translate-y-px',
        accent
          ? 'border-accent bg-accent text-on-accent'
          : 'border-line bg-card text-content hover:border-accent/50',
      ].join(' ')}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      onPointerUp={onRelease ? () => onRelease() : undefined}
      onPointerLeave={onRelease ? () => onRelease() : undefined}
      onPointerCancel={onRelease ? () => onRelease() : undefined}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

export function NaiwaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<NaiwaWorld | null>(null);
  const loopRef = useRef<FixedLoop | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [debug, setDebug] = useState(false);
  const [weaponLabel, setWeaponLabel] = useState<'⚔ 近战' | '🏹 弓箭'>('⚔ 近战');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 固定逻辑分辨率，按 DPR 放大位图，保证高清屏不糊
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const world = new NaiwaWorld();
    worldRef.current = world;

    const loop = new FixedLoop({
      update: (dt) => world.update(dt),
      render: () => world.render(ctx),
    });
    loopRef.current = loop;
    loop.start();

    // 轻量同步：每 250ms 读一次当前武器，更新按钮文字
    const syncWeapon = setInterval(() => {
      const w = worldRef.current?.player.weapon;
      setWeaponLabel(w === 'bow' ? '🏹 弓箭' : '⚔ 近战');
    }, 250);

    const keyMap: Record<string, Action> = {
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
      Space: 'jump',
      KeyW: 'jump',
      ArrowUp: 'jump',
      KeyJ: 'attack',
      KeyK: 'dodge',
      KeyL: 'shield',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F1' || e.code === 'Backquote') {
        e.preventDefault();
        world.debug = !world.debug;
        setDebug(world.debug);
        return;
      }
      if (e.code === 'KeyR') {
        e.preventDefault();
        world.reset();
        return;
      }
      // 切换武器（瞬时）
      if (e.code === 'KeyQ' || e.code === 'KeyE') {
        if (!e.repeat) {
          e.preventDefault();
          world.input.press('switchWeapon');
        }
        return;
      }
      // 道具 1 / 2
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        if (!e.repeat) {
          e.preventDefault();
          world.input.press('item1');
        }
        return;
      }
      if (e.code === 'Digit2' || e.code === 'Numpad2') {
        if (!e.repeat) {
          e.preventDefault();
          world.input.press('item2');
        }
        return;
      }
      const action = keyMap[e.code];
      if (!action) return;
      e.preventDefault();
      world.input.setHeld(action, true);
      if (e.repeat) return;
      if (action === 'jump' || action === 'attack' || action === 'dodge') {
        world.input.press(action);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const action = keyMap[e.code];
      if (action) world.input.setHeld(action, false);
    };

    const onBlur = () => world.input.clear();

    const onVisibility = () => {
      if (document.hidden) loop.stop();
      else if (!pausedRef.current) loop.start();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      loop.stop();
      clearInterval(syncWeapon);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      world.input.clear();
      worldRef.current = null;
      loopRef.current = null;
    };
  }, []);

  const hold = (action: Action, down: boolean) => {
    worldRef.current?.input.setVirtual(action, down);
  };

  const tap = (action: 'jump' | 'attack' | 'dodge' | 'switchWeapon' | 'item1' | 'item2') => {
    worldRef.current?.input.press(action);
  };

  const togglePause = () => {
    const loop = loopRef.current;
    if (!loop) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      worldRef.current?.input.clear();
      loop.stop();
    } else {
      loop.start();
    }
  };

  const toggleDebug = () => {
    const world = worldRef.current;
    if (!world) return;
    world.debug = !world.debug;
    setDebug(world.debug);
  };

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-xl border border-line bg-[#F8F2E7] shadow-sm">
        <canvas ref={canvasRef} className="block h-auto w-full touch-none" />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted">
          A/D 移动 · 空格 跳 · J 攻击 · K 闪避 · L 举盾 · Q 切武器 · 1/2 道具
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={togglePause}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-content hover:border-accent/50"
          >
            {paused ? '继续' : '暂停'}
          </button>
          <button
            type="button"
            onClick={toggleDebug}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-content hover:border-accent/50"
          >
            {debug ? '隐藏判定框' : '显示判定框'}
          </button>
          <button
            type="button"
            onClick={() => worldRef.current?.reset()}
            className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-content hover:border-accent/50"
          >
            重开
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex gap-2">
          <PadButton label="← 左" onPress={() => hold('left', true)} onRelease={() => hold('left', false)} />
          <PadButton label="右 →" onPress={() => hold('right', true)} onRelease={() => hold('right', false)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <PadButton label="跳" onPress={() => tap('jump')} />
          <PadButton label={weaponLabel} accent onPress={() => tap('attack')} />
          <PadButton label="闪避" onPress={() => tap('dodge')} />
          <PadButton
            label="🛡 盾"
            onPress={() => hold('shield', true)}
            onRelease={() => hold('shield', false)}
          />
          <PadButton label="切武器" onPress={() => tap('switchWeapon')} />
          <PadButton label="🍼 1" onPress={() => tap('item1')} />
          <PadButton label="💣 2" onPress={() => tap('item2')} />
        </div>
      </div>
    </div>
  );
}
