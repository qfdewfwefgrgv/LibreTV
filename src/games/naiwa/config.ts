/**
 * 奶娃闯关：全部手感参数集中在这里。
 *
 * 调手感时只改这个文件，不必翻逻辑代码。
 * 时间单位统一为「秒」，坐标单位逻辑像素（画布 960×540）。
 */

import type { AttackSpec, ItemType, Rect } from './types';

export const VIEW_W = 960;
export const VIEW_H = 540;

export const PHYSICS = {
  /** 重力加速度 px/s² */
  gravity: 960,
  /** 地面移动速度 px/s */
  moveSpeed: 200,
  /** 起跳初速度 px/s */
  jumpSpeed: 440,
  /** 空中横向控制系数 */
  airControl: 0.72,
  /** 输入缓冲窗口：提前按下的键会被记住这么久 */
  bufferWindow: 0.12,
  /** 土狼时间：离开平台后仍可起跳 */
  coyoteTime: 0.1,
};

/** 奶娃的两段普攻，后摇的 cancelAt 之后可以接下一段 */
export const PLAYER_ATTACKS: AttackSpec[] = [
  {
    id: 'swipe-1',
    name: '甩尾·一段',
    windup: 0.15,
    active: 0.08,
    recovery: 0.22,
    damage: 12,
    knockback: 130,
    hitbox: { w: 88, h: 64, offsetX: 4, offsetY: 0 },
    cancelAt: 0.7,
  },
  {
    id: 'swipe-2',
    name: '甩尾·二段',
    windup: 0.12,
    active: 0.1,
    recovery: 0.28,
    damage: 18,
    knockback: 210,
    hitbox: { w: 98, h: 70, offsetX: 6, offsetY: -2 },
    cancelAt: 0.75,
  },
];

/** 闪避：短促前冲 + 短暂无敌 */
export const DODGE = {
  duration: 0.34,
  invuln: 0.2,
  speed: 360,
};

/** 弓：拉弓前摇 + 箭矢飞行 + 冷却 */
export const BOW = {
  /** 拉弓前摇：按住攻击键到松手发射之间的蓄力时间（简化为固定前摇） */
  windup: 0.18,
  /** 箭矢飞行速度 px/s */
  arrowSpeed: 620,
  /** 箭矢伤害 */
  damage: 14,
  /** 箭矢击退 */
  knockback: 90,
  /** 两箭之间的冷却（秒） */
  cooldown: 0.32,
  /** 箭矢尺寸 */
  arrow: { w: 30, h: 6 },
  /** 箭矢最大存活时间（秒），超时自动消失 */
  life: 1.6,
};

/** 弓的攻击时序（复用攻击状态机：前摇拉弓 → 判定帧放箭 → 后摇收弓） */
export const BOW_ATTACK: AttackSpec = {
  id: 'bow-shot',
  name: '射箭',
  windup: BOW.windup,
  active: 0.05,
  recovery: 0.12,
  damage: BOW.damage,
  knockback: BOW.knockback,
  // 弓没有近战判定框，给个空的占位
  hitbox: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
  cancelAt: 1,
};

/** 盾：举盾减伤 + 完美格挡反击 */
export const SHIELD = {
  /** 普通格挡的伤害减免比例（0~1，1=完全免疫） */
  blockReduction: 0.7,
  /** 举盾后这段时间内格挡算「完美格挡」 */
  parryWindow: 0.18,
  /** 完美格挡造成的反击伤害 */
  parryDamage: 22,
  /** 完美格挡的击退 */
  parryKnockback: 280,
  /** 完美格挡后敌人硬直时间 */
  parryStun: 0.5,
  /** 举盾时的移动速度系数（减速） */
  moveSlow: 0.45,
  /** 完美格挡后的自身冷却，防止连点无限反击 */
  parryCooldown: 0.6,
};

/** 道具配置 */
export const ITEMS = {
  heal: {
    name: '奶瓶',
    /** 回复血量 */
    amount: 40,
  },
  bomb: {
    name: '炸弹',
    /** 爆炸范围伤害 */
    damage: 35,
    /** 爆炸半径（px） */
    radius: 110,
    /** 击退 */
    knockback: 320,
    /** 爆炸前的引信时间（秒） */
    fuse: 0.6,
  },
};

/** 初始道具栏：1 号奶瓶 ×2，2 号炸弹 ×1 */
export const STARTING_ITEMS: [ItemType, ItemType] = ['heal', 'bomb'];
export const STARTING_COUNTS: [number, number] = [2, 1];

/** 捣蛋怪的挥爪：前摇刻意拉长，保证玩家看得见 */
export const ENEMY_ATTACK: AttackSpec = {
  id: 'claw',
  name: '捣蛋挥爪',
  windup: 0.42,
  active: 0.1,
  recovery: 0.38,
  damage: 10,
  knockback: 160,
  hitbox: { w: 78, h: 62, offsetX: 4, offsetY: 0 },
  cancelAt: 1,
};

export const PLAYER_START = { x: 210, y: 412, hp: 100 };
export const ENEMY_START = { x: 690, y: 416, hp: 120 };

/** 平台：地面 + 两块浮台（单向平台，从下方可穿过） */
export const PLATFORMS: Rect[] = [
  { x: 0, y: 470, w: VIEW_W, h: 70 },
  { x: 330, y: 356, w: 190, h: 16 },
  { x: 620, y: 300, w: 170, h: 16 },
];

export const COLORS = {
  bg: '#F8F2E7',
  bgDeep: '#EFE4D2',
  ground: '#E2D2B9',
  groundEdge: '#C9B394',
  platform: '#D9C3A3',
  ink: '#4B4453',
  cream: '#FFF9EC',
  creamShade: '#F6E7CC',
  blush: '#FFA9C4',
  accent: '#FF7FA8',
  enemy: '#B9A7E8',
  enemyDeep: '#8E79CC',
  danger: '#E4572E',
  hpPlayer: '#FF8FB1',
  hpEnemy: '#9F86E0',
};
