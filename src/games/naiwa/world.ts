/**
 * 奶娃闯关：灰盒世界。
 *
 * 阶段 1 的目标：
 * - 移动 / 跳跃 / 土狼时间 / 输入缓冲
 * - 两段普攻，严格按「前摇 → 判定 → 后摇」推进
 * - 闪避带无敌帧
 * - 敌人有限状态机，前摇明显可读
 * - 命中顿帧 / 震屏 / 击退 / 闪白
 *
 * 画面全部用 Canvas 基础图形绘制，占位但可读；
 * 后续换成骨骼动画时，只需替换 drawPlayer / drawEnemy。
 */

import {
  BOW,
  BOW_ATTACK,
  COLORS,
  DODGE,
  ENEMY_ATTACK,
  ENEMY_START,
  ITEMS,
  PHYSICS,
  PLATFORMS,
  PLAYER_ATTACKS,
  PLAYER_START,
  SHIELD,
  STARTING_COUNTS,
  STARTING_ITEMS,
  VIEW_H,
  VIEW_W,
} from './config';
import { InputState } from './input';
import type {
  AttackPhase,
  AttackSpec,
  Enemy,
  Fighter,
  Floater,
  ItemSlot,
  Player,
  Projectile,
  Rect,
  Spark,
  WeaponType,
} from './types';

const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sign = (v: number) => (v >= 0 ? 1 : -1);

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectOf(f: Fighter): Rect {
  return { x: f.pos.x, y: f.pos.y, w: f.w, h: f.h };
}

/** 当前招式走到哪一段 */
function attackPhase(elapsed: number, a: AttackSpec): AttackPhase {
  if (elapsed < a.windup) return 'windup';
  if (elapsed < a.windup + a.active) return 'active';
  return 'recovery';
}

/** 判定框：面向右时从角色右缘伸出，面向左时镜像 */
function attackHitbox(f: Fighter, a: AttackSpec): Rect {
  const y = f.pos.y + (f.h - a.hitbox.h) / 2 + a.hitbox.offsetY;
  const x =
    f.facing === 1
      ? f.pos.x + f.w + a.hitbox.offsetX
      : f.pos.x - a.hitbox.w - a.hitbox.offsetX;
  return { x, y, w: a.hitbox.w, h: a.hitbox.h };
}

function makeItemSlots(): [ItemSlot, ItemSlot] {
  return [
    { type: STARTING_ITEMS[0], count: STARTING_COUNTS[0] },
    { type: STARTING_ITEMS[1], count: STARTING_COUNTS[1] },
  ];
}

function makePlayer(): Player {
  return {
    pos: { x: PLAYER_START.x, y: PLAYER_START.y },
    vel: { x: 0, y: 0 },
    w: 54,
    h: 58,
    facing: 1,
    onGround: true,
    hp: PLAYER_START.hp,
    maxHp: PLAYER_START.hp,
    flash: 0,
    status: 'idle',
    attack: null,
    attackElapsed: 0,
    attackIndex: 0,
    hitLanded: false,
    dodgeElapsed: 0,
    invuln: 0,
    hitStun: 0,
    coyote: PHYSICS.coyoteTime,
    // 武器
    weapon: 'melee',
    bowCooldown: 0,
    // 盾
    shielding: false,
    shieldTimer: 0,
    parryCooldown: 0,
    // 道具栏
    itemSlots: makeItemSlots(),
  };
}

function makeEnemy(): Enemy {
  return {
    pos: { x: ENEMY_START.x, y: ENEMY_START.y },
    vel: { x: 0, y: 0 },
    w: 58,
    h: 54,
    facing: -1,
    onGround: true,
    hp: ENEMY_START.hp,
    maxHp: ENEMY_START.hp,
    flash: 0,
    status: 'idle',
    stateTime: 0,
    attack: null,
    hitLanded: false,
  };
}

export class NaiwaWorld {
  readonly input = new InputState();

  player: Player = makePlayer();
  enemy: Enemy = makeEnemy();

  time = 0;
  /** 屏幕震动强度（像素） */
  shake = 0;
  /** 命中顿帧剩余时间：冻结逻辑，保留反馈 */
  hitStop = 0;
  outcome: 'win' | 'lose' | null = null;
  debug = false;

  /** 结算界面延迟出现，先让死亡/倒地动作演完 */
  private resultAt = 0;
  private floaters: Floater[] = [];
  private sparks: Spark[] = [];
  /** 飞行中的箭矢 */
  private projectiles: Projectile[] = [];
  private nextProjId = 1;
  /** 已扔出但未爆炸的炸弹：{pos, fuse} */
  private bombs: { x: number; y: number; fuse: number }[] = [];
  private fps = 60;
  private fpsTime = 0;
  private fpsFrames = 0;

  reset() {
    this.player = makePlayer();
    this.enemy = makeEnemy();
    this.time = 0;
    this.shake = 0;
    this.hitStop = 0;
    this.outcome = null;
    this.resultAt = 0;
    this.floaters = [];
    this.sparks = [];
    this.projectiles = [];
    this.bombs = [];
    this.input.clear();
  }

  update(dt: number) {
    this.time += dt;
    this.input.now = this.time;
    this.trackFps(dt);
    this.updateEffects(dt);

    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      return;
    }
    if (this.outcome) return;

    this.updatePlayer(dt);
    this.updateEnemy(dt);
    this.updateProjectiles(dt);
    this.updateBombs(dt);
    this.resolveHits();
    this.checkOutcome();
  }

  // ──────────────────────────── 逻辑 ────────────────────────────

  private trackFps(dt: number) {
    this.fpsFrames += 1;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsTime = 0;
      this.fpsFrames = 0;
    }
  }

  private updateEffects(dt: number) {
    this.shake = Math.max(0, this.shake - 55 * dt);
    this.floaters = this.floaters.filter((f) => (f.life -= dt) > 0);
    for (const f of this.floaters) f.y -= 42 * dt;
    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 260 * dt;
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const input = this.input;

    if (p.flash > 0) p.flash = Math.max(0, p.flash - dt);
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.bowCooldown > 0) p.bowCooldown = Math.max(0, p.bowCooldown - dt);
    if (p.parryCooldown > 0) p.parryCooldown = Math.max(0, p.parryCooldown - dt);

    if (p.status === 'dead') {
      p.vel.x = 0;
      p.shielding = false;
      return;
    }

    // 武器切换：任何非死亡状态都可切（攻击中切换会打断当前招式，符合直觉）
    if (input.consume('switchWeapon', PHYSICS.bufferWindow)) {
      p.weapon = p.weapon === 'melee' ? 'bow' : 'melee';
      // 切武器时中断当前攻击，避免状态机混乱
      if (p.status === 'attack') this.endAttack();
      this.floaters.push({
        x: p.pos.x + p.w / 2,
        y: p.pos.y - 14,
        text: p.weapon === 'melee' ? '近战' : '弓箭',
        life: 0.8,
        color: p.weapon === 'melee' ? COLORS.accent : '#6FA8DC',
      });
    }

    // 道具使用：只在自由状态（非攻击/闪避/硬直）下可用
    const canUseItem =
      p.status !== 'attack' && p.status !== 'dodge' && p.hitStun <= 0;
    if (canUseItem) {
      if (input.consume('item1', PHYSICS.bufferWindow)) this.useItem(0);
      else if (input.consume('item2', PHYSICS.bufferWindow)) this.useItem(1);
    }

    if (p.hitStun > 0) {
      // 受击硬直：不吃输入，被击退，盾被打断
      p.hitStun = Math.max(0, p.hitStun - dt);
      p.status = p.hitStun > 0 ? 'hit' : p.onGround ? 'idle' : 'fall';
      p.vel.x *= Math.max(0, 1 - dt * 10);
      p.shielding = false;
    } else if (p.status === 'attack' && p.attack) {
      const a = p.attack;
      p.attackElapsed += dt;
      p.vel.x = 0;
      const total = a.windup + a.active + a.recovery;

      // 弓：在判定帧发射一支箭
      if (a.id === 'bow-shot' && !p.hitLanded && attackPhase(p.attackElapsed, a) === 'active') {
        p.hitLanded = true;
        this.shootArrow();
      }

      if (p.attackElapsed >= total) {
        this.endAttack();
      } else if (
        a.id !== 'bow-shot' &&
        p.attackElapsed >= a.windup + a.active + a.recovery * a.cancelAt
      ) {
        // 近战连段取消窗口（弓不接段）
        if (input.consume('attack', PHYSICS.bufferWindow)) {
          const next: 0 | 1 = p.attackIndex === 0 ? 1 : 0;
          this.startAttack(next);
        }
      }
    } else if (p.status === 'dodge') {
      p.dodgeElapsed += dt;
      p.vel.x = p.facing * DODGE.speed;
      if (p.dodgeElapsed >= DODGE.duration) {
        p.status = p.onGround ? 'idle' : 'fall';
        p.vel.x = 0;
      }
    } else {
      // ── 自由状态：移动 / 跳 / 闪避 / 攻击 / 举盾 ──
      const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
      const control = p.onGround ? 1 : PHYSICS.airControl;

      // 举盾：按住防御键，且不在攻击中
      const wantShield = input.isDown('shield');
      p.shielding = wantShield;
      if (p.shielding) {
        if (p.shieldTimer <= 0) p.shieldTimer = SHIELD.parryWindow;
        // 举盾减速
        p.vel.x = dir * PHYSICS.moveSpeed * control * SHIELD.moveSlow;
      } else {
        p.shieldTimer = 0;
        p.vel.x = dir * PHYSICS.moveSpeed * control;
      }
      if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

      if (input.consume('jump', PHYSICS.bufferWindow) && (p.onGround || p.coyote > 0)) {
        p.vel.y = -PHYSICS.jumpSpeed;
        p.onGround = false;
        p.coyote = 0;
      }

      if (input.consume('dodge', PHYSICS.bufferWindow)) {
        p.status = 'dodge';
        p.dodgeElapsed = 0;
        p.invuln = Math.max(p.invuln, DODGE.invuln);
        p.vel.x = p.facing * DODGE.speed;
        p.shielding = false;
      } else if (input.consume('attack', PHYSICS.bufferWindow)) {
        // 攻击：按当前武器走不同分支
        if (p.weapon === 'bow') {
          if (p.bowCooldown <= 0) {
            this.startBowAttack();
          }
        } else {
          this.startAttack(0);
        }
      } else if (p.onGround) {
        p.status = dir !== 0 ? 'run' : 'idle';
      } else {
        p.status = p.vel.y < 0 ? 'jump' : 'fall';
      }
    }

    // 盾计时器递减（在举盾期间持续，用于判定完美格挡窗口）
    if (p.shielding && p.shieldTimer > 0) {
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    }

    this.applyPhysics(p, dt);
  }

  /** 弓：进入拉弓状态机 */
  private startBowAttack() {
    const p = this.player;
    const e = this.enemy;
    p.status = 'attack';
    p.attack = BOW_ATTACK;
    p.attackIndex = 0;
    p.attackElapsed = 0;
    p.hitLanded = false;
    p.vel.x = 0;

    // 自动面向敌人
    const dx = e.pos.x + e.w / 2 - (p.pos.x + p.w / 2);
    if (e.status !== 'dead' && Math.abs(dx) < 400) {
      p.facing = dx > 0 ? 1 : -1;
    }
  }

  /** 发射一支箭矢 */
  private shootArrow() {
    const p = this.player;
    p.bowCooldown = BOW.cooldown;
    const cx = p.pos.x + p.w / 2 + p.facing * 20;
    const cy = p.pos.y + p.h / 2 - 4;
    this.projectiles.push({
      id: this.nextProjId++,
      pos: { x: cx, y: cy },
      vel: { x: p.facing * BOW.arrowSpeed, y: 0 },
      w: BOW.arrow.w,
      h: BOW.arrow.h,
      damage: BOW.damage,
      knockback: BOW.knockback,
      life: BOW.life,
      fromPlayer: true,
    });
  }

  /** 使用道具栏的某一格 */
  private useItem(slot: 0 | 1) {
    const p = this.player;
    const s = p.itemSlots[slot];
    if (s.count <= 0) {
      this.floaters.push({
        x: p.pos.x + p.w / 2,
        y: p.pos.y - 14,
        text: '空了',
        life: 0.6,
        color: 'rgba(75,68,83,0.6)',
      });
      return;
    }
    s.count -= 1;

    if (s.type === 'heal') {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + ITEMS.heal.amount);
      const healed = p.hp - before;
      this.floaters.push({
        x: p.pos.x + p.w / 2,
        y: p.pos.y - 14,
        text: `+${healed}`,
        life: 0.9,
        color: '#5BBF7A',
      });
      this.burst(p.pos.x + p.w / 2, p.pos.y + p.h / 2, '#5BBF7A', 8);
    } else if (s.type === 'bomb') {
      // 往面向方向扔出一颗炸弹，落地后爆炸
      const bx = p.pos.x + p.w / 2 + p.facing * 30;
      const by = p.pos.y + p.h / 2;
      this.bombs.push({ x: bx, y: by, fuse: ITEMS.bomb.fuse });
      this.floaters.push({
        x: p.pos.x + p.w / 2,
        y: p.pos.y - 14,
        text: '扔出炸弹！',
        life: 0.7,
        color: COLORS.danger,
      });
    }
  }

  /** 切换武器（供外部按钮调用） */
  switchWeapon() {
    const p = this.player;
    p.weapon = p.weapon === 'melee' ? 'bow' : 'melee';
    if (p.status === 'attack') this.endAttack();
  }

  private startAttack(index: 0 | 1) {
    const p = this.player;
    const e = this.enemy;
    const spec = PLAYER_ATTACKS[index];
    p.status = 'attack';
    p.attack = spec;
    p.attackIndex = index;
    p.attackElapsed = 0;
    p.hitLanded = false;
    p.vel.x = 0;

    // 轻度自动索敌：出手瞬间若敌人在附近，自动面向它，避免触屏玩家空砍
    const dx = e.pos.x + e.w / 2 - (p.pos.x + p.w / 2);
    if (e.status !== 'dead' && Math.abs(dx) < 180) {
      p.facing = dx > 0 ? 1 : -1;
    }
  }

  private endAttack() {
    const p = this.player;
    p.status = p.onGround ? 'idle' : 'fall';
    p.attack = null;
    p.attackElapsed = 0;
    p.attackIndex = 0;
    p.hitLanded = false;
  }

  private applyPhysics(p: Player, dt: number) {
    p.vel.y += PHYSICS.gravity * dt;

    const nx = clamp(p.pos.x + p.vel.x * dt, 0, VIEW_W - p.w);
    if (nx !== p.pos.x + p.vel.x * dt) p.vel.x = 0;
    p.pos.x = nx;

    const prevBottom = p.pos.y + p.h;
    p.pos.y += p.vel.y * dt;
    p.onGround = false;

    if (p.vel.y >= 0) {
      const bottom = p.pos.y + p.h;
      for (const pl of PLATFORMS) {
        const overlapX = p.pos.x + p.w > pl.x + 6 && p.pos.x < pl.x + pl.w - 6;
        if (overlapX && prevBottom <= pl.y + 2 && bottom >= pl.y) {
          p.pos.y = pl.y - p.h;
          p.vel.y = 0;
          p.onGround = true;
          break;
        }
      }
    }

    if (p.onGround) p.coyote = PHYSICS.coyoteTime;
    else p.coyote = Math.max(0, p.coyote - dt);

    if (p.pos.y > VIEW_H) {
      p.pos.y = VIEW_H;
      p.vel.y = 0;
    }
  }

  /** 箭矢飞行 + 命中检测 + 超界清除 */
  private updateProjectiles(dt: number) {
    const e = this.enemy;
    const alive: Projectile[] = [];
    for (const pr of this.projectiles) {
      pr.pos.x += pr.vel.x * dt;
      pr.pos.y += pr.vel.y * dt;
      pr.life -= dt;

      // 命中敌人
      if (pr.fromPlayer && e.status !== 'dead') {
        const hb: Rect = { x: pr.pos.x, y: pr.pos.y, w: pr.w, h: pr.h };
        if (rectsOverlap(hb, rectOf(e))) {
          this.hitEnemyByProjectile(pr);
          continue; // 箭矢命中后消失
        }
      }

      // 出界或超时
      if (pr.life <= 0 || pr.pos.x < -60 || pr.pos.x > VIEW_W + 60) continue;
      alive.push(pr);
    }
    this.projectiles = alive;
  }

  /** 炸弹引信倒计时，到点爆炸 */
  private updateBombs(dt: number) {
    const remaining: { x: number; y: number; fuse: number }[] = [];
    for (const b of this.bombs) {
      b.fuse -= dt;
      if (b.fuse <= 0) {
        this.explodeBomb(b.x, b.y);
      } else {
        remaining.push(b);
      }
    }
    this.bombs = remaining;
  }

  /** 炸弹爆炸：范围伤害 + 击退 + 特效 */
  private explodeBomb(x: number, y: number) {
    const e = this.enemy;
    const p = this.player;
    const r = ITEMS.bomb.radius;

    // 炸敌人
    if (e.status !== 'dead') {
      const ecx = e.pos.x + e.w / 2;
      const ecy = e.pos.y + e.h / 2;
      const d = Math.hypot(ecx - x, ecy - y);
      if (d <= r) {
        const falloff = 1 - d / r;
        const dmg = Math.round(ITEMS.bomb.damage * (0.5 + falloff * 0.5));
        const dir = sign(ecx - x) || 1;
        e.hp = Math.max(0, e.hp - dmg);
        e.flash = 0.16;
        e.status = e.hp > 0 ? 'hit' : 'dead';
        e.stateTime = 0;
        e.vel.x = dir * ITEMS.bomb.knockback * falloff;
        this.floaters.push({ x: ecx, y: ecy - 20, text: `-${dmg}`, life: 0.8, color: COLORS.danger });
      }
    }

    // 炸玩家自己（友军伤害一半，避免自杀太狠）
    if (p.status !== 'dead' && p.invuln <= 0) {
      const pcx = p.pos.x + p.w / 2;
      const pcy = p.pos.y + p.h / 2;
      const d = Math.hypot(pcx - x, pcy - y);
      if (d <= r) {
        const falloff = 1 - d / r;
        const dmg = Math.round(ITEMS.bomb.damage * 0.4 * falloff);
        if (dmg > 0) {
          const dir = sign(pcx - x) || -1;
          p.hp = Math.max(0, p.hp - dmg);
          p.flash = 0.12;
          p.hitStun = 0.18;
          p.invuln = 0.3;
          p.vel.x = dir * ITEMS.bomb.knockback * 0.6 * falloff;
          p.vel.y = -160;
          p.onGround = false;
          this.floaters.push({ x: pcx, y: pcy - 20, text: `-${dmg}`, life: 0.8, color: COLORS.danger });
        }
      }
    }

    this.hitStop = 0.08;
    this.shake = Math.max(this.shake, 12);
    this.burst(x, y, COLORS.danger, 18);
    this.burst(x, y, '#FFD166', 10);
  }

  private updateEnemy(dt: number) {
    const e = this.enemy;
    const p = this.player;

    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
    if (e.status === 'dead') {
      e.vel.x = 0;
      return;
    }

    e.stateTime += dt;
    const dx = p.pos.x + p.w / 2 - (e.pos.x + e.w / 2);
    const dist = Math.abs(dx);
    if ((e.status === 'idle' || e.status === 'chase') && dist > 6) {
      e.facing = dx > 0 ? 1 : -1;
    }

    switch (e.status) {
      case 'idle':
        if (e.stateTime >= 0.45) {
          e.status = 'chase';
          e.stateTime = 0;
        }
        break;
      case 'chase':
        if (dist < 108) {
          e.status = 'windup';
          e.stateTime = 0;
          e.attack = ENEMY_ATTACK;
          e.hitLanded = false;
          e.vel.x = 0;
        } else {
          e.vel.x = sign(dx) * 95;
        }
        break;
      case 'windup':
        e.vel.x = 0;
        if (e.stateTime >= ENEMY_ATTACK.windup) {
          e.status = 'active';
          e.stateTime = 0;
        }
        break;
      case 'active':
        e.vel.x = 0;
        if (e.stateTime >= ENEMY_ATTACK.active) {
          e.status = 'recover';
          e.stateTime = 0;
        }
        break;
      case 'recover':
        e.vel.x = 0;
        if (e.stateTime >= ENEMY_ATTACK.recovery) {
          e.status = 'chase';
          e.stateTime = 0;
        }
        break;
      case 'hit':
        e.vel.x *= Math.max(0, 1 - dt * 10);
        if (e.stateTime >= 0.18) {
          e.status = 'chase';
          e.stateTime = 0;
        }
        break;
      default:
        break;
    }

    e.pos.x = clamp(e.pos.x + e.vel.x * dt, 0, VIEW_W - e.w);
    e.pos.y = PLATFORMS[0].y - e.h;
    e.onGround = true;
  }

  private resolveHits() {
    const p = this.player;
    const e = this.enemy;

    // 我方：只在判定帧结算一次
    if (p.status === 'attack' && p.attack && !p.hitLanded && e.status !== 'dead') {
      const a = p.attack;
      if (attackPhase(p.attackElapsed, a) === 'active') {
        const hb = attackHitbox(p, a);
        if (rectsOverlap(hb, rectOf(e))) {
          p.hitLanded = true;
          this.hitEnemy(a);
        }
      }
    }

    // 敌方：同理，只在 active 段，且玩家不在无敌帧
    if (e.status === 'active' && e.attack && !e.hitLanded && p.status !== 'dead') {
      const a = e.attack;
      if (e.stateTime <= a.active) {
        const hb = attackHitbox(e, a);
        if (rectsOverlap(hb, rectOf(p)) && p.invuln <= 0) {
          e.hitLanded = true;
          this.hitPlayer(a);
        }
      }
    }
  }

  private hitEnemy(a: AttackSpec) {
    const e = this.enemy;
    const p = this.player;
    const dir = sign(e.pos.x - p.pos.x) || p.facing;

    e.hp = Math.max(0, e.hp - a.damage);
    e.flash = 0.12;
    e.status = e.hp > 0 ? 'hit' : 'dead';
    e.stateTime = 0;
    e.vel.x = dir * a.knockback;

    this.hitStop = 0.06;
    this.shake = Math.max(this.shake, 7);

    const cx = e.pos.x + e.w / 2;
    const cy = e.pos.y + e.h / 2;
    this.floaters.push({ x: cx, y: cy - 20, text: `-${a.damage}`, life: 0.75, color: COLORS.accent });
    this.burst(cx + dir * 10, cy, COLORS.accent, 7);
  }

  /** 箭矢命中敌人 */
  private hitEnemyByProjectile(pr: Projectile) {
    const e = this.enemy;
    const dir = sign(pr.vel.x) || 1;

    e.hp = Math.max(0, e.hp - pr.damage);
    e.flash = 0.1;
    e.status = e.hp > 0 ? 'hit' : 'dead';
    e.stateTime = 0;
    e.vel.x = dir * pr.knockback;

    this.hitStop = 0.04;
    this.shake = Math.max(this.shake, 4);

    const cx = e.pos.x + e.w / 2;
    const cy = e.pos.y + e.h / 2;
    this.floaters.push({ x: cx, y: cy - 20, text: `-${pr.damage}`, life: 0.7, color: '#6FA8DC' });
    this.burst(pr.pos.x, pr.pos.y, '#6FA8DC', 5);
  }

  private hitPlayer(a: AttackSpec) {
    const p = this.player;
    const e = this.enemy;
    const dir = sign(p.pos.x - e.pos.x) || -e.facing;

    // ── 盾格挡判定：敌人攻击来自玩家面向方向才算格挡 ──
    // 敌人在玩家的「前方」（与玩家朝向同侧）才能被盾挡住
    const attackFromFront = sign(e.pos.x - p.pos.x) === p.facing;
    const blocking = p.shielding && attackFromFront && p.status !== 'dodge';

    if (blocking) {
      // 完美格挡：举盾后在 parryWindow 内，且敌人正处于 active 判定帧
      const isParry = p.shieldTimer > 0 && p.parryCooldown <= 0 && e.status === 'active';
      if (isParry) {
        // 完美格挡：免疫伤害 + 反击敌人
        p.parryCooldown = SHIELD.parryCooldown;
        this.parryCounter();
        this.floaters.push({
          x: p.pos.x + p.w / 2,
          y: p.pos.y - 16,
          text: '完美格挡！',
          life: 0.9,
          color: '#FFD166',
        });
        return;
      }
      // 普通格挡：减伤
      const reduced = Math.round(a.damage * (1 - SHIELD.blockReduction));
      p.hp = Math.max(0, p.hp - reduced);
      p.flash = 0.1;
      p.invuln = 0.15;
      // 格挡有小幅击退但不硬直
      p.vel.x = dir * a.knockback * 0.4;
      this.shake = Math.max(this.shake, 4);
      const cx = p.pos.x + p.w / 2;
      const cy = p.pos.y + p.h / 2;
      this.floaters.push({ x: cx, y: cy - 24, text: `格挡 -${reduced}`, life: 0.7, color: '#9FC5E8' });
      this.burst(cx + dir * 12, cy, '#9FC5E8', 5);
      return;
    }

    // 正常受击
    p.hp = Math.max(0, p.hp - a.damage);
    p.flash = 0.12;
    p.hitStun = 0.2;
    p.invuln = 0.35;
    p.vel.x = dir * a.knockback;
    p.vel.y = -110;
    p.onGround = false;

    this.hitStop = 0.05;
    this.shake = Math.max(this.shake, 9);

    const cx = p.pos.x + p.w / 2;
    const cy = p.pos.y + p.h / 2;
    this.floaters.push({ x: cx, y: cy - 24, text: `-${a.damage}`, life: 0.75, color: COLORS.danger });
    this.burst(cx + dir * 8, cy, COLORS.danger, 6);
  }

  /** 完美格挡反击：对敌人造成伤害 + 大击退 + 长硬直 */
  private parryCounter() {
    const p = this.player;
    const e = this.enemy;
    const dir = sign(e.pos.x - p.pos.x) || p.facing;

    e.hp = Math.max(0, e.hp - SHIELD.parryDamage);
    e.flash = 0.16;
    e.status = e.hp > 0 ? 'hit' : 'dead';
    e.stateTime = -SHIELD.parryStun; // 负值：延长 hit 状态持续时间
    e.vel.x = dir * SHIELD.parryKnockback;

    this.hitStop = 0.1;
    this.shake = Math.max(this.shake, 11);

    const cx = e.pos.x + e.w / 2;
    const cy = e.pos.y + e.h / 2;
    this.floaters.push({ x: cx, y: cy - 22, text: `反击 -${SHIELD.parryDamage}`, life: 0.9, color: '#FFD166' });
    this.burst(cx, cy, '#FFD166', 12);
    this.burst(cx, cy, '#FFFFFF', 6);
  }

  private burst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 130;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 40,
        life: 0.24 + Math.random() * 0.16,
        color,
      });
    }
  }

  private checkOutcome() {
    if (this.outcome) return;
    if (this.player.hp <= 0) {
      this.player.status = 'dead';
      this.player.hitStun = 0;
      this.outcome = 'lose';
      this.resultAt = this.time + 0.7;
    } else if (this.enemy.hp <= 0) {
      this.enemy.status = 'dead';
      this.outcome = 'win';
      this.resultAt = this.time + 0.5;
      this.floaters.push({
        x: this.enemy.pos.x + this.enemy.w / 2,
        y: this.enemy.pos.y - 10,
        text: '击败！',
        life: 1.2,
        color: COLORS.hpEnemy,
      });
    }
  }

  // ──────────────────────────── 渲染 ────────────────────────────

  render(ctx: CanvasRenderingContext2D) {
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;

    ctx.save();
    ctx.translate(sx, sy);
    this.drawBackground(ctx);
    this.drawPlatforms(ctx);
    this.drawEnemy(ctx);
    this.drawPlayer(ctx);
    this.drawProjectiles(ctx);
    this.drawBombs(ctx);
    this.drawEffects(ctx);
    ctx.restore();

    this.drawHud(ctx);
    if (this.debug) this.drawDebug(ctx);
    if (this.outcome && this.time >= this.resultAt) this.drawOutcome(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 远景：两面软绵绵的山丘
    ctx.fillStyle = COLORS.bgDeep;
    ctx.beginPath();
    ctx.arc(190, 470, 210, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(780, 470, 260, Math.PI, 0);
    ctx.fill();

    // 云朵
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const clouds = [
      { x: 120 + ((this.time * 8) % (VIEW_W + 200)), y: 110, r: 26 },
      { x: 520 + ((this.time * 5) % (VIEW_W + 300)), y: 76, r: 18 },
    ];
    for (const c of clouds) {
      const x = c.x > VIEW_W + 60 ? c.x - VIEW_W - 120 : c.x;
      ctx.beginPath();
      ctx.arc(x, c.y, c.r, 0, Math.PI * 2);
      ctx.arc(x + c.r * 1.2, c.y + 4, c.r * 0.8, 0, Math.PI * 2);
      ctx.arc(x - c.r * 1.1, c.y + 6, c.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPlatforms(ctx: CanvasRenderingContext2D) {
    for (const pl of PLATFORMS) {
      const isGround = pl.h > 40;
      ctx.fillStyle = isGround ? COLORS.ground : COLORS.platform;
      this.roundRect(ctx, pl.x, pl.y, pl.w, pl.h, isGround ? 0 : 8);
      ctx.fill();

      ctx.fillStyle = COLORS.groundEdge;
      if (isGround) {
        ctx.fillRect(pl.x, pl.y, pl.w, 5);
      } else {
        this.roundRect(ctx, pl.x, pl.y, pl.w, 5, 4);
        ctx.fill();
      }
    }

    // 地面上的小碎点，避免大色块太闷
    ctx.fillStyle = 'rgba(120, 96, 74, 0.16)';
    for (let i = 0; i < 20; i += 1) {
      const x = 30 + ((i * 157) % (VIEW_W - 60));
      const y = 500 + ((i * 37) % 22);
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const cx = p.pos.x + p.w / 2;
    const cy = p.pos.y + p.h / 2;

    let scaleX = 1;
    let scaleY = 1;
    let tilt = 0;

    if (p.status === 'run') {
      const bob = Math.sin(this.time * 16);
      scaleY = 1 + bob * 0.05;
      scaleX = 1 - bob * 0.03;
    } else if (p.status === 'jump') {
      scaleX = 0.9;
      scaleY = 1.14;
    } else if (p.status === 'fall') {
      scaleX = 1.05;
      scaleY = 0.94;
    } else if (p.status === 'hit') {
      scaleX = 1.14;
      scaleY = 0.84;
      tilt = 0.2 * p.facing;
    } else if (p.status === 'dodge') {
      scaleX = 1.28;
      scaleY = 0.76;
      tilt = -0.4 * p.facing;
    } else if (p.status === 'attack' && p.attack) {
      const phase = attackPhase(p.attackElapsed, p.attack);
      if (phase === 'windup') {
        scaleX = 1.14;
        scaleY = 0.84;
        tilt = -0.18 * p.facing;
      } else if (phase === 'active') {
        scaleX = 1.32;
        scaleY = 0.74;
        tilt = 0.12 * p.facing;
      } else {
        scaleX = 0.96;
        scaleY = 1.02;
      }
    } else if (p.status === 'dead') {
      scaleX = 1.32;
      scaleY = 0.5;
      tilt = 1.1;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(p.facing * scaleX, scaleY);

    const ink = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink;
    ctx.lineJoin = 'round';

    // 尾巴
    ctx.fillStyle = COLORS.creamShade;
    ctx.beginPath();
    ctx.ellipse(-24, 15, 10, 7, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 脚
    ctx.fillStyle = COLORS.creamShade;
    for (const fx of [-10, 10]) {
      ctx.beginPath();
      ctx.ellipse(fx, 26, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 耳朵
    ctx.fillStyle = COLORS.cream;
    for (const ex of [-14, 14]) {
      ctx.beginPath();
      ctx.arc(ex, -25, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 身体
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.ellipse(0, 2, 24, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 腮红
    ctx.fillStyle = COLORS.blush;
    ctx.globalAlpha = 0.55;
    for (const bx of [-15, 15]) {
      ctx.beginPath();
      ctx.ellipse(bx, 5, 5, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 眼睛
    ctx.fillStyle = ink;
    for (const ex of [-8, 8]) {
      ctx.beginPath();
      ctx.ellipse(ex, -4, 3.1, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    for (const ex of [-7, 9]) {
      ctx.beginPath();
      ctx.arc(ex, -6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 奶嘴
    ctx.fillStyle = COLORS.blush;
    ctx.beginPath();
    ctx.arc(0, 12, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2, 10, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 受击闪白：叠一层白色
    if (p.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.7, p.flash / 0.12 * 0.7);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 26 * scaleX, 28 * scaleY, tilt, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 无敌帧提示圈
    if (p.invuln > 0 && p.status !== 'dead') {
      ctx.save();
      ctx.strokeStyle = 'rgba(120, 180, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 判定帧的挥击弧光
    if (p.status === 'attack' && p.attack && attackPhase(p.attackElapsed, p.attack) === 'active') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(p.facing, 1);
      ctx.strokeStyle = 'rgba(255, 127, 168, 0.85)';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(12, 0, 40, -0.95, 0.95);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(14, 0, 44, -0.8, 0.8);
      ctx.stroke();
      ctx.restore();
    }

    // ── 盾：举盾时在前方画一面小盾 ──
    if (p.shielding) {
      ctx.save();
      const parryReady = p.shieldTimer > 0 && p.parryCooldown <= 0;
      const sx = cx + p.facing * 28;
      const sy = cy + 2;
      // 盾的光晕：完美格挡窗口内闪金光
      if (parryReady) {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
        ctx.beginPath();
        ctx.arc(sx, sy, 22, 0, Math.PI * 2);
        ctx.fill();
      }
      // 盾体
      ctx.fillStyle = parryReady ? '#FFD166' : '#9FC5E8';
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 14);
      ctx.lineTo(sx + p.facing * 10, sy - 8);
      ctx.lineTo(sx + p.facing * 10, sy + 8);
      ctx.lineTo(sx, sy + 14);
      ctx.lineTo(sx - p.facing * 10, sy + 8);
      ctx.lineTo(sx - p.facing * 10, sy - 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 盾心
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D) {
    const e = this.enemy;
    const cx = e.pos.x + e.w / 2;
    const cy = e.pos.y + e.h / 2;

    let scaleX = 1;
    let scaleY = 1;
    let tilt = 0;

    if (e.status === 'chase') {
      const bob = Math.sin(this.time * 12);
      scaleY = 1 + bob * 0.05;
    } else if (e.status === 'windup') {
      const t = Math.min(1, e.stateTime / ENEMY_ATTACK.windup);
      scaleX = 1 + t * 0.18;
      scaleY = 1 - t * 0.16;
      tilt = 0.22 * -e.facing;
    } else if (e.status === 'active') {
      scaleX = 1.28;
      scaleY = 0.8;
      tilt = 0.16 * e.facing;
    } else if (e.status === 'hit') {
      scaleX = 1.2;
      scaleY = 0.86;
      tilt = 0.18 * e.facing;
    } else if (e.status === 'dead') {
      scaleX = 1.35;
      scaleY = 0.42;
      tilt = 0.9;
    }

    // 前摇警示圈：越接近出招越红、越小
    if (e.status === 'windup') {
      const t = Math.min(1, e.stateTime / ENEMY_ATTACK.windup);
      ctx.save();
      ctx.strokeStyle = `rgba(228, 87, 46, ${0.35 + t * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 48 - t * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(e.facing * scaleX, scaleY);

    const ink = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink;
    ctx.lineJoin = 'round';

    // 脚
    ctx.fillStyle = COLORS.enemyDeep;
    for (const fx of [-12, 12]) {
      ctx.beginPath();
      ctx.ellipse(fx, 24, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 角
    ctx.fillStyle = COLORS.enemy;
    for (const hx of [-15, 15]) {
      ctx.beginPath();
      ctx.moveTo(hx - 5, -22);
      ctx.lineTo(hx, -34);
      ctx.lineTo(hx + 5, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 身体
    ctx.fillStyle = COLORS.enemy;
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 独眼
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(4, -3, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(6, -2, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // 嘴
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-4, 10, 8, 0.25, Math.PI - 0.25);
    ctx.stroke();

    ctx.restore();

    if (e.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.7, e.flash / 0.12 * 0.7);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 28 * scaleX, 26 * scaleY, tilt, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawEffects(ctx: CanvasRenderingContext2D) {
    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / 0.3));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.font = `bold 16px ${FONT}`;
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.5));
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /** 画飞行中的箭矢 */
  private drawProjectiles(ctx: CanvasRenderingContext2D) {
    for (const pr of this.projectiles) {
      ctx.save();
      ctx.translate(pr.pos.x + pr.w / 2, pr.pos.y + pr.h / 2);
      const angle = Math.atan2(pr.vel.y, pr.vel.x);
      ctx.rotate(angle);
      // 箭杆
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(-pr.w / 2, -pr.h / 2, pr.w, pr.h);
      // 箭头
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.moveTo(pr.w / 2, 0);
      ctx.lineTo(pr.w / 2 - 8, -pr.h / 2 - 2);
      ctx.lineTo(pr.w / 2 - 8, pr.h / 2 + 2);
      ctx.closePath();
      ctx.fill();
      // 箭羽
      ctx.fillStyle = '#6FA8DC';
      ctx.beginPath();
      ctx.moveTo(-pr.w / 2, 0);
      ctx.lineTo(-pr.w / 2 + 6, -pr.h / 2 - 2);
      ctx.lineTo(-pr.w / 2 + 6, pr.h / 2 + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** 画炸弹（引信闪烁） */
  private drawBombs(ctx: CanvasRenderingContext2D) {
    for (const b of this.bombs) {
      const blink = Math.sin(this.time * 30) > 0;
      ctx.save();
      ctx.translate(b.x, b.y);
      // 炸弹本体
      ctx.fillStyle = '#3A3A3A';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 引信
      ctx.strokeStyle = '#8B5E3C';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.quadraticCurveTo(6, -16, 4, -20);
      ctx.stroke();
      // 火花
      if (blink) {
        ctx.fillStyle = '#FFD166';
        ctx.beginPath();
        ctx.arc(4, -20, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    this.drawBar(ctx, 24, 24, 260, 18, this.player.hp / this.player.maxHp, COLORS.hpPlayer, '奶娃');
    this.drawBar(ctx, VIEW_W - 284, 24, 260, 18, this.enemy.hp / this.enemy.maxHp, COLORS.hpEnemy, '捣蛋娃', true);

    ctx.fillStyle = 'rgba(75, 68, 83, 0.66)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(
      'A/D 移动 · 空格 跳 · J 攻击 · K 闪避 · L 举盾 · Q 切武器 · 1/2 道具 · R 重开 · F1 判定框',
      24,
      VIEW_H - 18,
    );

    // ── 武器 + 盾状态徽章（左上，血条下方） ──
    const p = this.player;
    const badgeY = 60;
    // 武器
    ctx.fillStyle = p.weapon === 'melee' ? COLORS.accent : '#6FA8DC';
    this.roundRect(ctx, 24, badgeY, 64, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.weapon === 'melee' ? '⚔ 近战' : '🏹 弓箭', 24 + 32, badgeY + 16);

    // 盾状态
    const shieldX = 96;
    if (p.shielding) {
      const parryReady = p.shieldTimer > 0 && p.parryCooldown <= 0;
      ctx.fillStyle = parryReady ? '#FFD166' : '#9FC5E8';
      this.roundRect(ctx, shieldX, badgeY, 72, 24, 6);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(parryReady ? '🛡 防反!' : '🛡 举盾', shieldX + 36, badgeY + 16);
    } else {
      ctx.fillStyle = 'rgba(75, 68, 83, 0.18)';
      this.roundRect(ctx, shieldX, badgeY, 72, 24, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(75, 68, 83, 0.5)';
      ctx.fillText('🛡 盾', shieldX + 36, badgeY + 16);
    }

    // ── 道具栏（右上，敌人血条下方） ──
    const slotY = 60;
    const slotW = 86;
    const slotGap = 10;
    for (let i = 0; i < 2; i += 1) {
      const s = p.itemSlots[i];
      const x = VIEW_W - 284 + i * (slotW + slotGap);
      const color = s.type === 'heal' ? '#5BBF7A' : COLORS.danger;
      const icon = s.type === 'heal' ? '🍼' : '💣';
      const name = s.type === 'heal' ? ITEMS.heal.name : ITEMS.bomb.name;
      // 槽位背景
      ctx.fillStyle = s.count > 0 ? color : 'rgba(75, 68, 83, 0.18)';
      this.roundRect(ctx, x, slotY, slotW, 24, 6);
      ctx.fill();
      // 图标 + 名称
      ctx.fillStyle = s.count > 0 ? '#FFFFFF' : 'rgba(75, 68, 83, 0.5)';
      ctx.font = `12px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${icon} ${name}`, x + 6, slotY + 16);
      // 数量
      ctx.textAlign = 'right';
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillText(`×${s.count}`, x + slotW - 6, slotY + 16);
      // 快捷键标号
      ctx.textAlign = 'left';
      ctx.font = `10px ${FONT}`;
      ctx.fillStyle = s.count > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(75, 68, 83, 0.4)';
      ctx.fillText(`${i + 1}`, x + 4, slotY + 10);
    }

    // 连段提示
    if (this.player.status === 'attack' && this.player.attack) {
      const phase = attackPhase(this.player.attackElapsed, this.player.attack);
      const label = phase === 'windup' ? '前摇' : phase === 'active' ? '判定' : '后摇';
      ctx.textAlign = 'center';
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillStyle = phase === 'active' ? COLORS.accent : 'rgba(75, 68, 83, 0.7)';
      ctx.fillText(`${this.player.attack.name} · ${label}`, this.player.pos.x + this.player.w / 2, this.player.pos.y - 16);
    }
  }

  private drawBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    color: string,
    label: string,
    right = false,
  ) {
    ctx.fillStyle = 'rgba(75, 68, 83, 0.16)';
    this.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();

    const fillW = Math.max(0, Math.min(1, ratio)) * w;
    ctx.fillStyle = color;
    this.roundRect(ctx, right ? x + w - fillW : x, y, fillW, h, h / 2);
    ctx.fill();

    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = right ? 'right' : 'left';
    ctx.fillText(`${label} ${Math.ceil(Math.max(0, ratio) * 100)}%`, right ? x + w : x, y + h + 16);
  }

  private drawDebug(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const e = this.enemy;

    // 受击框
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(70, 140, 255, 0.9)';
    ctx.strokeRect(p.pos.x, p.pos.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(150, 110, 220, 0.9)';
    ctx.strokeRect(e.pos.x, e.pos.y, e.w, e.h);

    // 判定框
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.95)';
    ctx.fillStyle = 'rgba(255, 60, 60, 0.16)';
    if (p.status === 'attack' && p.attack && attackPhase(p.attackElapsed, p.attack) === 'active') {
      const hb = attackHitbox(p, p.attack);
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    }
    if (e.status === 'active' && e.attack) {
      const hb = attackHitbox(e, e.attack);
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    }

    // 状态与帧率
    ctx.fillStyle = 'rgba(30, 26, 34, 0.82)';
    this.roundRect(ctx, VIEW_W - 246, 62, 222, 112, 8);
    ctx.fill();
    ctx.fillStyle = '#F4F1EA';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`玩家：${p.status}  武器 ${p.weapon}`, VIEW_W - 234, 82);
    ctx.fillText(`敌人：${e.status}  距离 ${Math.round(Math.abs(e.pos.x - p.pos.x))}`, VIEW_W - 234, 102);
    ctx.fillText(`fps ${this.fps.toFixed(0)}  顿帧 ${this.hitStop.toFixed(2)}s`, VIEW_W - 234, 122);
    ctx.fillText(`无敌 ${p.invuln.toFixed(2)}s  震动 ${this.shake.toFixed(1)}`, VIEW_W - 234, 142);
    ctx.fillText(
      `盾 ${p.shielding ? '举' : '收'} 防反窗 ${p.shieldTimer.toFixed(2)}  弓CD ${p.bowCooldown.toFixed(2)}`,
      VIEW_W - 234,
      162,
    );

    // 攻击时间轴
    this.drawTimeline(ctx);
  }

  private drawTimeline(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const a = p.attack;
    if (!a || p.status !== 'attack') return;

    const total = a.windup + a.active + a.recovery;
    const x0 = p.pos.x - 30;
    const y0 = p.pos.y - 58;
    const width = 140;
    const wWindup = (a.windup / total) * width;
    const wActive = (a.active / total) * width;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    this.roundRect(ctx, x0, y0, width, 7, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 180, 190, 0.85)';
    this.roundRect(ctx, x0, y0, wWindup, 7, 3);
    ctx.fill();
    ctx.fillStyle = COLORS.accent;
    this.roundRect(ctx, x0 + wWindup, y0, wActive, 7, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 110, 130, 0.6)';
    this.roundRect(ctx, x0 + wWindup + wActive, y0, width - wWindup - wActive, 7, 3);
    ctx.fill();

    const t = Math.min(1, p.attackElapsed / total);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x0 + width * t - 1, y0 - 4, 2, 15);
  }

  private drawOutcome(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(36, 32, 44, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';

    ctx.fillStyle = this.outcome === 'win' ? '#FFE9A8' : '#FFC9D6';
    ctx.font = `bold 56px ${FONT}`;
    ctx.fillText(this.outcome === 'win' ? '胜利' : '倒下了', VIEW_W / 2, VIEW_H / 2 - 6);

    ctx.fillStyle = '#F1EDE6';
    ctx.font = `16px ${FONT}`;
    ctx.fillText('按 R 重新开始', VIEW_W / 2, VIEW_H / 2 + 46);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
