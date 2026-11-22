/**
 * 固定步长循环：逻辑固定 60Hz，渲染跟随显示器刷新。
 *
 * 所有伤害、位移、时序都按固定 dt 推进，
 * 这样 120Hz 屏幕和 30fps 掉帧时的战斗节奏一致。
 */

export type LoopHooks = {
  update: (dt: number) => void;
  render: () => void;
};

const STEP = 1 / 60;
/** 单帧最多补 4 个逻辑步，防止切回标签页时“快进” */
const MAX_FRAME = 0.25;

export class FixedLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(private hooks: LoopHooks) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (ts: number) => {
    if (!this.running) return;
    if (this.last === 0) this.last = ts;
    const dt = Math.min((ts - this.last) / 1000, MAX_FRAME);
    this.last = ts;
    this.acc += dt;
    let guard = 0;
    while (this.acc >= STEP && guard < 4) {
      this.hooks.update(STEP);
      this.acc -= STEP;
      guard += 1;
    }
    if (guard >= 4) this.acc = 0;
    this.hooks.render();
    this.raf = requestAnimationFrame(this.frame);
  };
}
