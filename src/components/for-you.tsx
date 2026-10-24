'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { DoubanCard } from './video-card';
import { topCategory, type CategoryTarget } from '@/lib/watch-cats';

/**
 * 猜你喜欢：根据本地记录的观看分类（电影/剧集/动漫/综艺/纪录片），
 * 取票数最高的那一类，从豆瓣拉同类热门内容推送。
 * 没有任何观看记录时不显示，避免凭空猜。
 */
export function ForYouRow({ onPick }: { onPick: (title: string) => void }) {
  const [target, setTarget] = useState<CategoryTarget | null>(null);

  useEffect(() => {
    const sync = () => setTarget(topCategory());
    sync();
    window.addEventListener('libretv:watch-category', sync);
    return () => window.removeEventListener('libretv:watch-category', sync);
  }, []);

  const query = useQuery({
    queryKey: ['for-you', target?.key],
    queryFn: ({ signal }) => api.douban(target!.type, target!.tag, 0, 12, signal),
    enabled: Boolean(target),
    staleTime: 600_000,
  });

  if (!target) return null;
  const items = (query.data?.items ?? []).slice(0, 12);
  if (items.length === 0) return null;

  return (
    <section aria-label="猜你喜欢" className="mb-8 scroll-mt-20">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-heading text-content">猜你喜欢 · {target.label}</h2>
        <span className="chip bg-chip text-muted">根据你的观看记录</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
        {items.map((it, i) => (
          <div key={it.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 16) * 35}ms` }}>
            <DoubanCard
              item={{
                title: it.title,
                cover: it.cover,
                rating: it.rating,
                kind: it.isTv ? '剧集' : '电影',
              }}
              onClick={() => onPick(it.title)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
