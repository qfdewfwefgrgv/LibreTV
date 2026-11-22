/**
 * 移动端 / 平板全屏时强制横屏。
 *
 * 两套环境两套手段：
 * - 支持 Screen Orientation API 的浏览器（Android Chrome 等）：全屏后 lock(landscape)；
 * - iOS Safari 等不支持 lock 的环境：给全屏元素加旋转类，用 CSS 把画面转 90 度，
 *   并按视口尺寸换算宽高（--fl-w / --fl-h），退出全屏或转成横向后自动还原。
 *
 * 桌面端（非粗指针、无移动 UA）一律不处理。
 */

export type DeviceKind = 'desktop' | 'phone' | 'tablet';

const ROTATE_CLASS = 'force-landscape-rotate';

/** 当前设备类型：优先看 UA，再用输入设备与屏幕短边兜底 */
export function deviceKind(): DeviceKind {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  const screenMin = Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight
  );
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet';
  if (/iPhone|iPod/i.test(ua)) return 'phone';
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'phone' : 'tablet';
  if (!coarse) return 'desktop';
  return screenMin >= 600 ? 'tablet' : 'phone';
}

type OrientationLike = { lock?: (o: string) => Promise<void>; unlock?: () => void };

function screenOrientation(): OrientationLike | null {
  if (typeof screen === 'undefined') return null;
  return (screen as unknown as { orientation?: OrientationLike }).orientation || null;
}

/** 旋转兜底：竖屏时把全屏元素转 90 度，宽高取视口长边/短边 */
function applyRotate(el: HTMLElement) {
  const portrait = window.innerHeight > window.innerWidth;
  el.classList.toggle(ROTATE_CLASS, portrait);
  if (!portrait) return;
  el.style.setProperty('--fl-w', `${window.innerHeight}px`);
  el.style.setProperty('--fl-h', `${window.innerWidth}px`);
}

function releaseRotate(el: HTMLElement) {
  el.classList.remove(ROTATE_CLASS);
  el.style.removeProperty('--fl-w');
  el.style.removeProperty('--fl-h');
}

/** 全屏期间维持横屏，返回清理函数 */
export function forceLandscape(el: HTMLElement): () => void {
  const so = screenOrientation();
  let useRotate = false;
  const onResize = () => {
    if (useRotate) applyRotate(el);
  };
  if (so && so.lock) {
    so.lock('landscape').catch(() => {
      useRotate = true;
      applyRotate(el);
    });
  } else {
    useRotate = true;
    applyRotate(el);
  }
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize);
  return () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    if (useRotate) releaseRotate(el);
    try {
      if (so && so.unlock) so.unlock();
    } catch {
      /* 忽略 */
    }
  };
}

/**
 * 全屏守卫：同时监听原生全屏（fullscreenchange）与 ArtPlayer 网页全屏（class 变化），
 * 全屏时对手机/平板调用 forceLandscape，退出时还原；桌面端直接空实现。
 */
export function createLandscapeGuard(getPlayer: () => HTMLElement | null): () => void {
  if (deviceKind() === 'desktop') return () => {};

  let active: HTMLElement | null = null;
  let release: (() => void) | null = null;

  const resolveTarget = (): HTMLElement | null => {
    const fs = document.fullscreenElement as HTMLElement | null;
    if (fs) return fs;
    const player = getPlayer();
    return player && player.classList.contains('art-fullscreen-web') ? player : null;
  };

  const sync = () => {
    const el = resolveTarget();
    if (el === active) return;
    if (release) release();
    release = null;
    active = el;
    if (el) release = forceLandscape(el);
  };

  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync as EventListener);

  const player = getPlayer();
  const observer = player && typeof MutationObserver !== 'undefined'
    ? new MutationObserver(sync)
    : null;
  if (observer && player) observer.observe(player, { attributes: true, attributeFilter: ['class'] });

  sync();

  return () => {
    document.removeEventListener('fullscreenchange', sync);
    document.removeEventListener('webkitfullscreenchange', sync as EventListener);
    if (observer) observer.disconnect();
    if (release) release();
    release = null;
    active = null;
  };
}
