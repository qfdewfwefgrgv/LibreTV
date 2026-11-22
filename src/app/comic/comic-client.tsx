'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';

/**
 * 漫画中心。
 *
 * 数据源为「腾讯动漫（ac.qq.com）」：站内搜索对很多老作品是失效的，
 * 所以不用「作品名 → 搜索 URL」，而是给每部作品绑定**已验证的 comicInfo id**，
 * 点卡片直接在新标签页打开作品页（自带章节列表），「第1话」直达阅读页。
 * 封面图来自 acimg.cn，带防盗链（仅允许空 Referer），故 <img referrerPolicy="no-referrer">。
 */

type GroupKey = 'zymk' | 'guoman' | 'jp';

interface ComicWork {
  id: string;
  title: string;
  group: GroupKey;
  cover: string;
  /** 搜索用的别名（如「海贼王」→航海王） */
  alias?: string;
}

const GROUPS: { key: GroupKey; name: string; emoji: string; desc: string; keywords: string }[] = [
  { key: 'zymk', name: '知音漫客经典', emoji: '📕', desc: '知音漫客系连载', keywords: '知音漫客 漫客 杂志 偷星 九月天 斗破 神精榜' },
  { key: 'guoman', name: '热血国漫', emoji: '🔥', desc: '口碑国漫', keywords: '国漫 国产 腾讯动漫 热血' },
  { key: 'jp', name: '经典日漫', emoji: '⛩️', desc: '正版日漫', keywords: '日漫 日本 经典 热血' },
];

const WORKS: ComicWork[] = [
  // ── 知音漫客 ──
  { id: '531031', title: '偷星九月天', group: 'zymk', cover: 'https://manhua.acimg.cn/vertical/0/31_14_01_bdbf7d0ec5ad54a56b9f1a19669a2063_1496210499297.jpg/420' },
  { id: '531040', title: '斗破苍穹', group: 'zymk', cover: 'https://manhua.acimg.cn/vertical/0/14_17_07_371cb06b7af8862a858d18f376ddf51f_1536916069031.jpg/420' },
  { id: '531087', title: '神精榜', group: 'zymk', cover: 'https://manhua.acimg.cn/vertical/0/10_17_02_eb97af5885f6b1518fb0c2932cf67580_1597050157252.png/420' },
  { id: '529810', title: '星海镖师', group: 'zymk', cover: 'https://manhua.acimg.cn/vertical/0/17_17_05_a3078a3690d91946767153b5896332ad.jpg/420' },
  { id: '531088', title: '天行轶事', group: 'zymk', cover: 'https://manhua.acimg.cn/vertical/0/03_13_31_227c7a3e70900cca689ade6e8602d1fb_1593754269223.jpg/420' },
  { id: '531077', title: '龙族Ⅰ', group: 'zymk', cover: 'https://manhua.acimg.cn/vertical/0/17_17_06_84f934f0703171ebba48f39441d96cb4.jpg/420' },
  { id: '531079', title: '龙族II', group: 'zymk', cover: 'https://manhua.acimg.cn/vertical/0/17_17_06_75332c7b66e546a9727716b1cc86d56e.jpg/420' },

  // ── 国漫 ──
  { id: '531490', title: '一人之下', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/18_17_39_ea5671977fc690a42459210737b4c67a_1592473175770.jpg/420' },
  { id: '518333', title: '狐妖小红娘', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/17_16_12_cd4e6fe51036f100d5f2c1eb1289788e.jpg/420' },
  { id: '656019', title: '全职高手', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/29_16_07_431c4983ca370155cd4334673b8dc2c1_1730189269417.jpg/420' },
  { id: '649820', title: '完美世界', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/07_17_40_0aeade9916c115974438fff4c84e6510_1610012430551.jpg/420' },
  { id: '628970', title: '元尊', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/09_16_51_02aae3d232412cd482b86e1e8dc693a2_1639039876539.jpg/420' },
  { id: '621635', title: '雪鹰领主', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/10_12_02_dcb36fff0df5084c8f61195011b37303_1533873768034.jpg/420' },
  { id: '529693', title: '吞噬星空', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/17_17_05_7bf4d83511f44b05b10cdde708656b2f.jpg/420' },
  { id: '533395', title: '妖神记', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/21_14_19_152a687976add4668a09152838acc690_1532153983992.jpg/420' },
  { id: '657187', title: '大理寺日志', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/06_16_19_10aaeee6d684ac0044db722a01fecad5_1762417176043.png/420' },
  { id: '540487', title: '镖人', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/19_10_30_c7642d19f31d44b94966b371046b76f0_1537324246626.jpg/420' },
  { id: '545320', title: '非人哉', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/16_18_18_b54c3fbce195e59e72ec396e4f3ba81e_1526465929669.jpg/420' },
  { id: '459294', title: '罗小黑', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/17_16_41_87703a2fb1a499e8a7b61aa2ca9fb6d8.jpg/420' },
  { id: '530969', title: '我的天劫女友', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/16_13_10_b7fb5155b13475e52cab389d348ff08d_1592284221839.png/420' },
  { id: '650233', title: '灵笼·月魁传', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/15_14_32_840ff7c7da28a36766d81a5b1067cd20_1700029934538.jpg/420' },
  { id: '649513', title: '斗罗大陆II绝世唐门', group: 'guoman', cover: 'https://manhua.acimg.cn/vertical/0/24_12_56_1e375ad5cbcfd766a2a524e5c17ee6dc_1608785814089.jpg/420', alias: '斗罗大陆 绝世唐门' },

  // ── 日漫 ──
  { id: '505430', title: '航海王', group: 'jp', cover: 'https://manhua.acimg.cn/vertical/0/17_16_48_0e28c8aabf48e91d395689b5f6a7689f.jpg/420', alias: '海贼王 one piece' },
  { id: '505432', title: '火影忍者', group: 'jp', cover: 'https://manhua.acimg.cn/vertical/0/21_15_30_e74fc730f5b060f35c6eb0eeb082478f_1498030250417.jpg/420', alias: 'naruto' },
  { id: '505436', title: '龙珠', group: 'jp', cover: 'https://manhua.acimg.cn/vertical/0/21_15_34_5ae448b6d3283f80f563ec5358024ad4_1498030489229.jpg/420', alias: '七龙珠 龙珠z' },
  { id: '531617', title: '死神', group: 'jp', cover: 'https://manhua.acimg.cn/vertical/0/21_15_33_bb362c807858aeb83d0406dae321cf12_1498030439364.jpg/420', alias: '境·界 bleach' },
  { id: '512054', title: '银魂', group: 'jp', cover: 'https://manhua.acimg.cn/vertical/0/17_16_53_5fb54f34b105afa41ac1df7bf8561a90.jpg/420' },
  { id: '530985', title: '排球少年', group: 'jp', cover: 'https://manhua.acimg.cn/vertical/0/17_17_06_69712f879c7dd8820552602b95496fa9.jpg/420' },
  { id: '656609', title: '名侦探柯南·未来篇', group: 'jp', cover: 'https://manhua.acimg.cn/vertical/0/23_22_32_abff12269a47561374bd829220e67cf0_1776954739178.png/420', alias: '名侦探柯南 柯南' },
];

const workUrl = (id: string) => `https://ac.qq.com/Comic/comicInfo/id/${id}`;
const firstChapterUrl = (id: string) => `https://ac.qq.com/ComicView/index/id/${id}/cid/1`;
const searchUrl = (q: string) => `https://ac.qq.com/Comic/searchList?search=${encodeURIComponent(q)}`;

export default function ComicClient() {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return WORKS.filter((w) => {
      const groupWord = GROUPS.find((g) => g.key === w.group)?.keywords ?? '';
      return (
        w.title.toLowerCase().includes(q) ||
        (w.alias ?? '').toLowerCase().includes(q) ||
        groupWord.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const groups = useMemo(
    () =>
      GROUPS.map((g) => {
        const all = WORKS.filter((w) => w.group === g.key);
        return { ...g, items: matches ? matches.filter((w) => w.group === g.key) : all, total: all.length };
      }),
    [matches],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearch />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-content">📚 漫画中心</h1>
          <p className="mt-1 text-xs text-faint">
            收录知音漫客经典、热门国漫与经典日漫，全部直达腾讯动漫正版作品页；点封面在新标签页打开，点「第1话」直接开读。
          </p>
        </div>

        {/* 搜索：本站内已收录作品过滤 + 腾讯原站搜索兜底 */}
        <div className="flex gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const q = query.trim();
              if (q && (matches?.length ?? 0) === 0) window.open(searchUrl(q), '_blank', 'noopener');
            }}
            placeholder="在本站已收录的漫画里搜，如：偷星九月天 / 斗破 / 海贼王"
            className="input flex-1"
          />
          {query.trim() ? (
            <button type="button" onClick={() => setQuery('')} className="btn-primary shrink-0 px-4">
              清空
            </button>
          ) : null}
        </div>
        {matches && matches.length === 0 && (
          <p className="mb-4 text-xs text-faint">
            本站还没收录「{query.trim()}」。
            <a
              href={searchUrl(query.trim())}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-accent hover:underline"
            >
              去腾讯动漫搜索 ↗
            </a>
          </p>
        )}

        {/* 分组卡片 */}
        {groups.map((group) => {
          if (!group.items.length) return null;
          return (
            <section key={group.key} className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-content">
                <span>{group.emoji}</span>
                {group.name}
                <span className="text-[11px] font-normal text-faint">{group.desc} · {group.total} 部</span>
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {group.items.map((w) => {
                  return (
                    <div
                      key={w.id}
                      className="group relative overflow-hidden rounded-lg border border-line transition-colors hover:border-accent/50"
                    >
                      <a
                        href={workUrl(w.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-left"
                        title={`打开《${w.title}》作品页（新标签页）`}
                      >
                        <div className="relative aspect-[3/4] bg-surface overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={w.cover}
                            alt={w.title}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                          />
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6">
                            <span className="block truncate text-[12px] font-medium text-white">{w.title}</span>
                          </span>
                        </div>
                      </a>
                      <a
                        href={firstChapterUrl(w.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur hover:bg-accent hover:text-white"
                        title="新标签页直接读第 1 话"
                      >
                        第1话
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <p className="text-[11px] leading-relaxed text-faint">
          说明：这些作品均在腾讯动漫有正版连载，卡片绑定的是作品页直达地址（不依赖站内搜索，所以不会再出现「搜出来全是空的」）。
          部分作品在腾讯动漫有多个版本（如龙族分 Ⅰ/II、斗罗大陆有绝世唐门/龙王传说等），这里只收录了已核对可打开的版本。
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
