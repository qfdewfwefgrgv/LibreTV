/**
 * 壁纸偏好：存在本机 localStorage，切换即时生效（写 html 上的 data-* 与 CSS 变量）。
 * 用模块级单例 + 订阅，保证头部下拉、背景层、其它组件看到的是同一份状态。
 */
export type WallpaperKind = 'none' | 'animated' | 'image' | 'color' | 'custom';

export interface WallpaperPreset {
  id: string;
  label: string;
  group: '动态' | '美女' | '风景' | '漫画' | '现实景观' | '纯色' | '自定义';
  kind: WallpaperKind;
  /** image/custom: 图片地址（custom 可存 dataURL）；color: CSS 颜色；animated: 动画名 */
  value: string;
}

const STORAGE_KEY = 'libretv:wallpaper';

export const WALLPAPERS: WallpaperPreset[] = [
  { id: 'none', label: '不设壁纸', group: '动态', kind: 'none', value: '' },
  { id: 'aurora', label: '极光流转', group: '动态', kind: 'animated', value: 'aurora' },
  { id: 'stars', label: '星河漂移', group: '动态', kind: 'animated', value: 'stars' },
  { id: 'breath', label: '呼吸渐变', group: '动态', kind: 'animated', value: 'breath' },

  { id: 'img-meinv-1', label: '微光侧影', group: '美女', kind: 'image', value: '/wallpapers/meinv-1.jpg' },
  { id: 'img-meinv-2', label: '午后窗边', group: '美女', kind: 'image', value: '/wallpapers/meinv-2.jpg' },

  { id: 'img-fengjing-1', label: '日照金山', group: '风景', kind: 'image', value: '/wallpapers/fengjing-1.jpg' },
  { id: 'img-fengjing-2', label: '雾中灯塔', group: '风景', kind: 'image', value: '/wallpapers/fengjing-2.jpg' },
  { id: 'img-fengjing-3', label: '樱花小径', group: '风景', kind: 'image', value: '/wallpapers/fengjing-3.jpg' },

  { id: 'img-riman-1', label: '夏日海岸 · 日漫', group: '漫画', kind: 'image', value: '/wallpapers/riman-1.jpg' },
  { id: 'img-manwei-1', label: '夜色英雄 · 漫威', group: '漫画', kind: 'image', value: '/wallpapers/manwei-1.jpg' },

  { id: 'img-xianshi-1', label: '千本鸟居', group: '现实景观', kind: 'image', value: '/wallpapers/xianshi-1.jpg' },
  { id: 'img-xianshi-2', label: '山间晨雾', group: '现实景观', kind: 'image', value: '/wallpapers/xianshi-2.jpg' },

  { id: 'color-ink', label: '墨黑', group: '纯色', kind: 'color', value: '#0f1216' },
  { id: 'color-navy', label: '深海蓝', group: '纯色', kind: 'color', value: '#122238' },
  { id: 'color-slate', label: '雾灰', group: '纯色', kind: 'color', value: '#2b3138' },
  { id: 'color-forest', label: '松林绿', group: '纯色', kind: 'color', value: '#15251d' },
  { id: 'color-wine', label: '酒红', group: '纯色', kind: 'color', value: '#2a1416' },
  { id: 'color-sand', label: '暖沙', group: '纯色', kind: 'color', value: '#c9b79c' },
  { id: 'color-cream', label: '奶白', group: '纯色', kind: 'color', value: '#e8e4dc' },
  { id: 'color-sky', label: '天青', group: '纯色', kind: 'color', value: '#8fb3c9' },
  { id: 'color-pink', label: '藕粉', group: '纯色', kind: 'color', value: '#d8a7b1' },
  { id: 'color-grape', label: '葡萄紫', group: '纯色', kind: 'color', value: '#2b2236' },
];

export const WALLPAPER_GROUPS: WallpaperPreset['group'][] = ['动态', '美女', '风景', '漫画', '现实景观', '纯色'];

export const NO_WALLPAPER = WALLPAPERS[0];

const listeners = new Set<() => void>();
let current: WallpaperPreset = NO_WALLPAPER;
let hydrated = false;

function isPresetShape(value: unknown): value is WallpaperPreset {
  if (!value || typeof value !== 'object') return false;
  const preset = value as Partial<WallpaperPreset>;
  return (
    typeof preset.id === 'string' &&
    typeof preset.label === 'string' &&
    typeof preset.group === 'string' &&
    (preset.kind === 'none' ||
      preset.kind === 'animated' ||
      preset.kind === 'image' ||
      preset.kind === 'color' ||
      preset.kind === 'custom') &&
    typeof preset.value === 'string'
  );
}

export function loadWallpaper(): WallpaperPreset {
  if (hydrated) return current;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isPresetShape(parsed)) current = parsed;
    }
  } catch {
    // 隐私模式或存储被禁用时保持默认
  }
  return current;
}

/** 把偏好写到 html 上：背景层与纯色/动画样式都读这几个属性 */
export function applyWallpaper(preset: WallpaperPreset) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.dataset.wp = preset.kind === 'none' ? 'off' : 'on';
  html.dataset.wpKind = preset.kind;
  html.dataset.wpAnim = preset.kind === 'animated' ? preset.value : '';
  html.style.setProperty('--wp-image', preset.kind === 'image' || preset.kind === 'custom' ? `url("${preset.value}")` : 'none');
  html.style.setProperty('--wp-color', preset.kind === 'color' ? preset.value : 'transparent');
}

export function setWallpaper(preset: WallpaperPreset) {
  current = preset;
  hydrated = true;
  applyWallpaper(preset);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
  } catch {
    // 自定义大图可能超配额：本次会话仍生效
  }
  listeners.forEach((fn) => fn());
}

export function getWallpaper(): WallpaperPreset {
  return loadWallpaper();
}

export function subscribeWallpaper(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 自定义上传：压缩到 1080 宽、JPEG 0.82，避免 localStorage 超限 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = Math.min(1080, img.naturalWidth || 1080);
      const height = Math.round((img.naturalHeight / img.naturalWidth) * width) || 1920;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('浏览器不支持图片处理'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}
