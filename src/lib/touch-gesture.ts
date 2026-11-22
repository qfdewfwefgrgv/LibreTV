/**
 * 观影手势：左半屏上下滑调亮度，右半屏上下滑调音量。
 *
 * 纯函数判定，与 DOM/播放器解耦，方便单测。
 * 注意：网页无法调节系统屏幕亮度，只能对 <video> 应用 CSS filter: brightness()，
 * 效果是「画面变暗/变亮」，与系统亮度不同但对观影场景够用。
 */

export type GestureKind = 'brightness' | 'volume';

/** 纵向位移超过该阈值才判定为手势（避免点按/轻微抖动误触） */
export const GESTURE_DECIDE_PX = 12;

/** 亮度范围：1 为原始亮度；下限 0.4 防止误滑到全黑，上限 1.5 防止过曝失真 */
export const BRIGHTNESS_MIN = 0.4;
export const BRIGHTNESS_MAX = 1.5;
export const BRIGHTNESS_DEFAULT = 1;

export const VOLUME_MIN = 0;
export const VOLUME_MAX = 1;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 手势分类：垂直位移为主（|dy| > |dx| * 1.2）且超过阈值才算滑动手势；
 * 起点在左半屏 → 亮度，右半屏 → 音量。其余（横向为主/位移过小）返回 null。
 */
export function classifyGesture(
  dx: number,
  dy: number,
  startX: number,
  width: number,
): GestureKind | null {
  if (Math.abs(dy) < GESTURE_DECIDE_PX) return null;
  if (Math.abs(dy) <= Math.abs(dx) * 1.2) return null;
  return startX < width / 2 ? 'brightness' : 'volume';
}

/**
 * 由滑动位移换算目标值：上滑（dy 为负）增大，下滑减小。
 * 满屏高度一次滑动覆盖整个值域（min..max）。
 */
export function gestureValue(
  start: number,
  dy: number,
  height: number,
  min: number,
  max: number,
): number {
  if (height <= 0) return clamp(start, min, max);
  const ratio = -dy / height;
  return clamp(start + ratio * (max - min), min, max);
}
