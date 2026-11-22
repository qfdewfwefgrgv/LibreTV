'use client';

import { useCallback, useRef, useState } from 'react';
import { Header } from '@/components/header';
import { cn } from '@/lib/utils';

/** 观测宇宙：嵌入 three.js 天文模拟（MIT 许可），静态资源在 public/space 下 */
const CHAPTERS = [
  { id: 'beyond', label: '第二部 · 星际边界', src: '/space/beyond.html' },
  { id: 'earth', label: '第一部 · 启程', src: '/space/index.html' },
] as const;

type ChapterId = (typeof CHAPTERS)[number]['id'];

export default function SpacePage() {
  const [chapterId, setChapterId] = useState<ChapterId>('beyond');
  const stageRef = useRef<HTMLDivElement>(null);
  const chapter = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0];

  const enterFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void el.requestFullscreen?.();
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-black">
      <Header />

      <div className="flex items-center gap-2 px-4 h-11 border-b shrink-0 bg-surface">
        <span className="text-sm font-medium text-content shrink-0">观测宇宙</span>

        <div className="flex items-center gap-1 ml-1">
          {CHAPTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChapterId(c.id)}
              className={cn(
                'px-2.5 py-1 rounded-md text-sm transition-colors',
                c.id === chapterId ? 'text-content bg-hover' : 'text-muted hover:text-content'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <span className="hidden lg:block text-xs text-muted truncate">
          素材：NASA（公有领域）、Solar System Scope（CC BY 4.0）、three.js（MIT）
        </span>

        <div className="ml-auto flex items-center gap-1">
          <a
            href={chapter.src}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-md text-sm text-muted hover:text-content transition-colors"
          >
            新标签页打开
          </a>
          <button
            type="button"
            onClick={enterFullscreen}
            className="px-2.5 py-1 rounded-md text-sm text-muted hover:text-content transition-colors"
          >
            全屏
          </button>
        </div>
      </div>

      <div ref={stageRef} className="flex-1 min-h-0 bg-black">
        <iframe
          key={chapter.id}
          src={chapter.src}
          title={chapter.label}
          className="w-full h-full border-0 block"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
