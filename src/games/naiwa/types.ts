/**
 * 奶娃闯关：基础类型。
 *
 * 这里刻意把所有“可调参数”放进 config.ts，本文件只描述形状，
 * 方便后续把灰盒替换成正式美术与内容。
 */

export type Vec2 = { x: number; y: number };
export type Facing = 1 | -1;
export type Rect = { x: number; y: number; w: number; h: number };

/** 攻击三段时序：前摇 / 判定 / 后摇 */
export type AttackPhase = 'windup' | 'active' | 'recovery';

export type AttackSpec = {
  id: string;
  name: string;
  /** 前摇：抬手蓄力，无判定，给玩家反应时间 */
  windup: number;
  /** 判定帧：hitbox 打开，这一小段才结算伤害 */
  active: number;
  /** 后摇：收招硬直，不能移动 */
  recovery: number;
  damage: number;
  knockback: number;
  /** 判定框尺寸与相对角色朝向的偏移 */
  hitbox: { w: number; h: number; offsetX: number; offsetY: number };
  /** 后摇进行到这个比例后可接下一招（0~1） */
  cancelAt: number;
};

export type PlayerStatus = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'dodge' | 'hit' | 'dead';
export type EnemyStatus = 'idle' | 'chase' | 'windup' | 'active' | 'recover' | 'hit' | 'dead';

/** 武器类型：近战甩尾 / 弓箭 */
export type WeaponType = 'melee' | 'bow';

/** 箭矢：从玩家射向敌人的飞行物 */
export type Projectile = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  w: number;
  h: number;
  damage: number;
  knockback: number;
  life: number;
  fromPlayer: boolean;
};

/** 道具类型 */
export type ItemType = 'heal' | 'bomb';

/** 道具栏：一个槽位放一种道具，记录数量 */
export type ItemSlot = { type: ItemType; count: number };

/** 双方共用的基础属性 */
export type Fighter = {
  pos: Vec2;
  vel: Vec2;
  w: number;
  h: number;
  facing: Facing;
  onGround: boolean;
  hp: number;
  maxHp: number;
  /** 受击闪白剩余时间 */
  flash: number;
};

export type Player = Fighter & {
  status: PlayerStatus;
  attack: AttackSpec | null;
  attackElapsed: number;
  /** 连段序号：0=第一段，1=第二段（近战专用） */
  attackIndex: 0 | 1;
  /** 本次招式是否已经打中过，避免同一招重复结算 */
  hitLanded: boolean;
  dodgeElapsed: number;
  /** 无敌剩余时间（闪避 / 受击后短暂无敌） */
  invuln: number;
  hitStun: number;
  /** 土狼时间：离开平台后仍可起跳的余量 */
  coyote: number;

  // ── 武器 ──
  weapon: WeaponType;
  /** 弓的冷却剩余时间 */
  bowCooldown: number;

  // ── 盾 ──
  /** 是否正在举盾（按住防御键） */
  shielding: boolean;
  /** 举盾时长：进入后的短暂窗口内可触发完美格挡 */
  shieldTimer: number;
  /** 完美格挡成功后的反击冷却，防止连触发 */
  parryCooldown: number;

  // ── 道具栏：两个槽位 ──
  itemSlots: [ItemSlot, ItemSlot];
};

export type Enemy = Fighter & {
  status: EnemyStatus;
  stateTime: number;
  attack: AttackSpec | null;
  hitLanded: boolean;
};

export type Floater = { x: number; y: number; text: string; life: number; color: string };
export type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
