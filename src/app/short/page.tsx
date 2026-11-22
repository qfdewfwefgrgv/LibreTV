import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { OverseasLinks } from '@/components/overseas-links';
import { ShortSections } from '@/components/short-embed';

export const metadata: Metadata = {
  title: '短视频 · LibreTV',
  description: '抖音、快手、B站、小红书等短视频平台快捷入口',
};

/** 短视频平台入口：点击后在新窗口打开官方网页版（平台会拦截站内嵌框） */
type Platform = {
  name: string;
  badge: string;
  desc: string;
  href: string;
  brand: string;
  tint: string;
};

const PLATFORMS: Platform[] = [
  {
    name: '抖音',
    badge: 'DOUYIN',
    desc: '全站热门短视频 · 直播 · 同城',
    href: 'https://www.douyin.com/',
    brand: '#FE2C55',
    tint: 'rgba(254,44,85,0.16)',
  },
  {
    name: '快手',
    badge: 'KUAISHOU',
    desc: '老铁短视频 · 直播 · 小剧场',
    href: 'https://www.kuaishou.com/',
    brand: '#FF5000',
    tint: 'rgba(255,80,0,0.16)',
  },
  {
    name: '哔哩哔哩',
    badge: 'BILIBILI',
    desc: '竖屏短视频 · 弹幕 · 番剧',
    href: 'https://www.bilibili.com/',
    brand: '#00A1D6',
    tint: 'rgba(0,161,214,0.16)',
  },
  {
    name: '小红书',
    badge: 'RED',
    desc: '生活分享 · 视频笔记',
    href: 'https://www.xiaohongshu.com/explore',
    brand: '#FF2442',
    tint: 'rgba(255,36,66,0.16)',
  },
  {
    name: '微信视频号',
    badge: 'CHANNELS',
    desc: '视频号助手 · 直播与短视频',
    href: 'https://channels.weixin.qq.com/',
    brand: '#07C160',
    tint: 'rgba(7,193,96,0.16)',
  },
  {
    name: '西瓜视频',
    badge: 'IXIGUA',
    desc: '中长视频 · 影视解说',
    href: 'https://www.ixigua.com/',
    brand: '#FF6A00',
    tint: 'rgba(255,106,0,0.16)',
  },
];


/** 短剧专区（用户需求里的「AI 短剧」）：红果短剧为主入口 */
const DRAMA_SITES = [
  {
    name: '红果短剧',
    desc: 'AI 短剧 · 免费微短剧连播',
    href: 'https://www.hongguoduanju.com/',
  },
];

export default function ShortVideoPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header showSearch />

      <main className="flex-1 w-full max-w-6xl lg:max-w-7xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-content">短视频</h1>
          <p className="mt-1 text-xs text-faint">
            抖音 / 快手 / B站等平台会拦截站内嵌入，点击卡片直接在新窗口打开官方网页版。
          </p>
        </div>

        <ShortSections platforms={PLATFORMS} />

        {/* 国外平台（需外网） */}
        <section className="mt-6 rounded-xl border border-line bg-surface-raised overflow-hidden">
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                国外
              </span>
              <h2 className="text-sm font-semibold text-content">国外平台</h2>
            </div>
            <p className="mt-1 text-xs text-warning">请连接外网再访问；未连接外网时会提示无法访问。</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <OverseasLinks />
          </div>
        </section>

        {/* AI 短剧专区：锚点 /short#duanju */}
        <section id="duanju" className="mt-6 scroll-mt-20 rounded-xl border border-line bg-surface-raised overflow-hidden">
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">
                AI 短剧
              </span>
              <h2 className="text-sm font-semibold text-content">短剧专区</h2>
            </div>
            <p className="mt-1 text-xs text-faint">AI 生成的竖屏短剧与免费微短剧，整部连播。</p>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DRAMA_SITES.map((d) => (
              <a
                key={d.name}
                href={d.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-lg border border-line bg-card px-4 py-3 hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-[rgba(255,90,60,0.16)] text-[#FF5A3C] flex items-center justify-center text-sm font-semibold shrink-0">
                    红
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-content truncate">{d.name}</p>
                    <p className="text-[11px] text-faint truncate">{d.desc}</p>
                  </div>
                </div>
                <span className="text-xs text-muted group-hover:text-accent shrink-0">打开 →</span>
              </a>
            ))}
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
