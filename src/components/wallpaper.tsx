'use client';

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './icon';
import {
  NO_WALLPAPER,
  WALLPAPERS,
  WALLPAPER_GROUPS,
  compressImage,
  getWallpaper,
  setWallpaper,
  type WallpaperPreset,
} from '@/lib/wallpaper';

/** 动态壁纸的预览渐变（与 globals.css 里的 .wp-layer 动画配色保持一致） */
const ANIM_PREVIEW: Record<string, string> = {
  aurora: 'linear-gradient(135deg,#0b1f3a,#1c6b6b 45%,#7b3fa0)',
  stars: 'radial-gradient(circle at 30% 22%,#fff 0 1px,transparent 2px),radial-gradient(circle at 68% 64%,#fff 0 1px,transparent 2px),linear-gradient(160deg,#0a0f24,#1b2a4a)',
  breath: 'linear-gradient(135deg,#3b1d4a,#6b2c4a 50%,#8a5a2b)',
};

/** 背景层：始终挂在 DOM 上，由 html[data-wp*] 与 CSS 变量决定是否显示 */
export function WallpaperLayer() {
  useEffect(() => {
    // 首屏同步脚本已设过一次，这里兜底（隐私模式下 localStorage 不可用时也无副作用）
    setWallpaper(getWallpaper());
  }, []);
  return <div className="wp-layer" aria-hidden />;
}

export function WallpaperMenu() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WallpaperPreset['group'] | '自定义'>('动态');
  const [current, setCurrent] = useState<WallpaperPreset>(NO_WALLPAPER);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(getWallpaper());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (preset: WallpaperPreset) => {
    setWallpaper(preset);
    setCurrent(preset);
  };

  const list = WALLPAPERS.filter((p) => p.group === tab);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'p-2 rounded-md transition-colors',
          open ? 'text-accent bg-hover' : 'text-muted hover:text-content hover:bg-hover'
        )}
        aria-label="切换壁纸"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="切换壁纸"
      >
        <Icon name="image" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="壁纸切换"
          className="absolute left-0 top-full mt-1.5 w-[20.5rem] max-w-[calc(100vw-3.5rem)] rounded-xl border border-line bg-surface shadow-xl p-2.5 z-50 animate-fade-in"
        >
          <div className="flex items-center justify-between px-0.5 pb-2">
            <span className="text-xs font-medium text-content">切换壁纸</span>
            <span className="text-[11px] text-faint truncate max-w-[10rem]">当前：{current.label}</span>
          </div>

          {/* 分组：横向可滑动，避免窄屏挤成两行 */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2">
            {[...WALLPAPER_GROUPS, '自定义' as const].map((group) => (
              <button
                key={group}
                onClick={() => setTab(group)}
                className={cn(
                  'chip shrink-0 px-2.5 py-1',
                  tab === group
                    ? 'chip-active'
                    : 'bg-chip text-muted hover:bg-hover hover:text-content'
                )}
              >
                {group}
              </button>
            ))}
          </div>

          {tab === '自定义' ? (
            <CustomPanel current={current} onPick={choose} />
          ) : tab === '纯色' ? (
            <div className="grid grid-cols-5 gap-2 p-1">
              {list.map((preset) => {
                const active = current.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => choose(preset)}
                    title={preset.label}
                    aria-label={preset.label}
                    aria-pressed={active}
                    className={cn(
                      'relative aspect-square rounded-full border transition-transform hover:scale-105 wp-thumb-color',
                      active ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'border-line'
                    )}
                    style={
                      {
                        backgroundColor: preset.value,
                        '--wp-thumb-color': preset.value,
                      } as CSSProperties
                    }
                  >
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center text-white">
                        <Icon name="check" className="w-4 h-4 drop-shadow" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-1">
              {list.map((preset) => {
                const active = current.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => choose(preset)}
                    aria-pressed={active}
                    className="group text-left"
                  >
                    <span
                      className={cn(
                        'relative block aspect-[3/4] w-full overflow-hidden rounded-lg border bg-chip',
                        active ? 'border-accent ring-2 ring-accent/40' : 'border-line'
                      )}
                    >
                      {preset.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preset.value}
                          alt={preset.label}
                          loading="lazy"
                          className="h-full w-full object-cover wp-thumb-drift"
                        />
                      ) : preset.kind === 'animated' ? (
                        <span
                          className="block h-full w-full wp-thumb-flow"
                          style={{ backgroundImage: ANIM_PREVIEW[preset.value] }}
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-faint">
                          <Icon name="image" className="w-5 h-5" />
                        </span>
                      )}
                      {active && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-on-accent">
                          <Icon name="check" className="w-3 h-3" />
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-muted">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 自定义壁纸：本地上传（压缩后存 dataURL）或直接填图片地址 */
function CustomPanel({
  current,
  onPick,
}: {
  current: WallpaperPreset;
  onPick: (preset: WallpaperPreset) => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyValue = (value: string) => {
    if (!value) return;
    onPick({ id: 'custom', label: '自定义壁纸', group: '自定义', kind: 'custom', value });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    setBusy(true);
    setError('');
    try {
      applyValue(await compressImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片处理失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 p-1">
      {current.kind === 'custom' && (
        <div className="flex items-center gap-2 rounded-lg border border-line p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.value} alt="当前自定义壁纸" className="h-12 w-9 rounded object-cover" />
          <span className="text-[11px] text-muted">当前使用自定义壁纸</span>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Icon name="plus" className="w-4 h-4" />
        {busy ? '处理中…' : '上传本地图片'}
      </button>

      <div className="flex gap-1.5">
        <input
          className="input h-9 flex-1 min-w-0"
          placeholder="或粘贴图片地址 https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (/^(https?:)?\/\//.test(url.trim())) applyValue(url.trim());
              else setError('请输入以 http(s):// 开头的图片地址');
            }
          }}
        />
        <button
          className="btn-primary btn-sm shrink-0"
          onClick={() => {
            const value = url.trim();
            if (/^(https?:)?\/\//.test(value)) applyValue(value);
            else setError('请输入以 http(s):// 开头的图片地址');
          }}
        >
          应用
        </button>
      </div>

      {error && <p className="text-[11px] text-danger" role="alert">{error}</p>}
      <p className="text-[11px] text-faint">上传的图片会压缩后保存在本机浏览器，不会上传到服务器。</p>
    </div>
  );
}
