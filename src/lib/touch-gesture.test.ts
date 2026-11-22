import { describe, expect, it } from 'vitest';
import {
  BRIGHTNESS_DEFAULT,
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  GESTURE_DECIDE_PX,
  classifyGesture,
  clamp,
  gestureValue,
} from './touch-gesture';

const W = 1000; // 播放器宽度
const H = 500; // 播放器高度

describe('观影手势分类', () => {
  it('左半屏上滑 → 亮度', () => {
    expect(classifyGesture(0, -50, 200, W)).toBe('brightness');
  });

  it('左半屏下滑 → 亮度', () => {
    expect(classifyGesture(0, 50, 499, W)).toBe('brightness');
  });

  it('右半屏上滑 → 音量', () => {
    expect(classifyGesture(0, -50, 800, W)).toBe('volume');
  });

  it('右半屏下滑 → 音量', () => {
    expect(classifyGesture(0, 50, 500, W)).toBe('volume');
  });

  it('纵向位移不足阈值 → 不触发', () => {
    expect(classifyGesture(0, GESTURE_DECIDE_PX - 1, 200, W)).toBeNull();
    expect(classifyGesture(0, -(GESTURE_DECIDE_PX - 1), 800, W)).toBeNull();
  });

  it('横向位移为主 → 不触发（留给进度/系统手势）', () => {
    expect(classifyGesture(60, -50, 200, W)).toBeNull();
    expect(classifyGesture(-100, 30, 800, W)).toBeNull();
  });

  it('斜向但纵向占优 → 仍触发', () => {
    expect(classifyGesture(30, -50, 200, W)).toBe('brightness');
  });
});

describe('手势取值换算', () => {
  it('上滑增大、下滑减小', () => {
    const up = gestureValue(BRIGHTNESS_DEFAULT, -H / 2, H, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    expect(up).toBeGreaterThan(BRIGHTNESS_DEFAULT);
    const down = gestureValue(BRIGHTNESS_DEFAULT, H / 2, H, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    expect(down).toBeLessThan(BRIGHTNESS_DEFAULT);
  });

  it('满屏滑动覆盖整个值域', () => {
    expect(gestureValue(0, -H, H, 0, 1)).toBe(1);
    expect(gestureValue(1, H, H, 0, 1)).toBe(0);
  });

  it('越界钳制到 [min, max]', () => {
    expect(gestureValue(1.4, -H, H, BRIGHTNESS_MIN, BRIGHTNESS_MAX)).toBe(BRIGHTNESS_MAX);
    expect(gestureValue(0.1, H, H, 0, 1)).toBe(0);
  });

  it('高度为 0 时不除零、保持原值', () => {
    expect(gestureValue(0.8, -100, 0, 0, 1)).toBe(0.8);
  });
});

describe('clamp', () => {
  it('边界内原样返回，越界钳制', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
  });
});
