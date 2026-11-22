/**
 * 输入缓冲：动作游戏手感的一半来自这里。
 *
 * 按下攻击/跳跃/闪避时记录时间戳，逻辑帧里在窗口内消费，
 * 这样玩家在落地前一瞬间按下也能接上，不会“吞键”。
 */

export type Action = 'left' | 'right' | 'jump' | 'attack' | 'dodge' | 'shield';
/** 瞬时动作：按下瞬间触发一次，走缓冲队列 */
export type PunchAction = 'jump' | 'attack' | 'dodge' | 'switchWeapon' | 'item1' | 'item2';

export class InputState {
  /** 由世界循环每帧写入的当前时间（秒） */
  now = 0;

  private held = new Set<Action>();
  private virtualHeld = new Set<Action>();
  private pressedAt = new Map<PunchAction, number>();

  /** 键盘 / 触屏按住 */
  setHeld(action: Action, down: boolean) {
    if (down) this.held.add(action);
    else this.held.delete(action);
  }

  /** 触屏按钮按住（与键盘状态互不覆盖） */
  setVirtual(action: Action, down: boolean) {
    if (down) this.virtualHeld.add(action);
    else this.virtualHeld.delete(action);
  }

  /** 按下瞬间：进入缓冲队列 */
  press(action: PunchAction) {
    this.pressedAt.set(action, this.now);
  }

  isDown(action: Action): boolean {
    return this.held.has(action) || this.virtualHeld.has(action);
  }

  /** 在 window 内消费一次按键；消费后清除，避免一次按键触发两次 */
  consume(action: PunchAction, window: number): boolean {
    const stamp = this.pressedAt.get(action);
    if (stamp === undefined) return false;
    if (this.now - stamp > window) {
      this.pressedAt.delete(action);
      return false;
    }
    this.pressedAt.delete(action);
    return true;
  }

  clear() {
    this.held.clear();
    this.virtualHeld.clear();
    this.pressedAt.clear();
  }
}
