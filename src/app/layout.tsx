import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { MobileNav } from '@/components/mobile-nav';
import { WallpaperLayer } from '@/components/wallpaper';
import { PetBar } from '@/components/pet-bar';

export const metadata: Metadata = {
  title: {
    default: 'LibreTV - 免费在线视频搜索与观看平台',
    template: '%s - LibreTV',
  },
  description:
    'LibreTV 是一个免费的在线视频搜索平台，无广告、安全，提供来自多个视频源的内容搜索与观看服务，无需注册即可使用。',
  manifest: '/manifest.webmanifest',
  // 图标与门户站（LibreTV-portal）同一套：同一张 artwork 导出的多尺寸 + 根目录 favicon.ico 兜底。
  // 只声明单张 512 时，抓取端只能拿大图缩放，小尺寸下易糊、看起来「没填满」。
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#f6f7f9',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 首屏前同步主题，避免亮暗闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('libretv-theme-v2')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()",
          }}
        />
        {/* 首屏前同步壁纸：避免背景先白一下再换成用户选的壁纸 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var r=localStorage.getItem('libretv:wallpaper');if(!r)return;var p=JSON.parse(r);if(!p||!p.kind||p.kind==='none')return;var h=document.documentElement;h.dataset.wp='on';h.dataset.wpKind=p.kind;h.dataset.wpAnim=p.kind==='animated'?p.value:'';if(p.kind==='image'||p.kind==='custom'){h.style.setProperty('--wp-image',\"url('\"+p.value+\"')\")}if(p.kind==='color'){h.style.setProperty('--wp-color',p.value)}}catch(e){}})()",
          }}
        />
      </head>
      <body>
        {/* 全局极光背景层：fixed + 负 z-index，垫在页面底色之上、所有内容之下（见 globals.css） */}
        <div className="aurora-layer" aria-hidden />
        {/* 用户壁纸层：显示与否由 html[data-wp] 决定，切换即时生效 */}
        <WallpaperLayer />
        <Providers>
          {children}
          {/* 桌宠（左/右壁贴，可关闭） */}
          <PetBar />
          {/* 手机底部 5 键导航（md 以上自动隐藏） */}
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
