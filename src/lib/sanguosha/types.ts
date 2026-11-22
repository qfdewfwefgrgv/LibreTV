/**
 * 三国杀简化版 类型定义
 * 身份局 5 人：主公 + 忠臣 + 反贼×2 + 内奸
 * 武将 22 位（蜀/魏/吴/群），卡牌约 150 张（基本牌 / 锦囊 / 装备）
 */

export type Identity = 'zhu' | 'zhong' | 'fan' | 'jian'; // 主/忠/反/内
export type CardType = 'basic' | 'trick' | 'equip';
export type CardSuit = 'spade' | 'heart' | 'club' | 'diamond';
export type Phase = 'prepare' | 'play' | 'discard' | 'gameover';
export type PlayerRole = 'human' | 'ai';
export type Kingdom = 'shu' | 'wei' | 'wu' | 'qun';
export type Element = 'normal' | 'fire' | 'thunder';

export interface Hero {
  id: string;
  name: string;
  kingdom: Kingdom;
  gender: 'M' | 'F';
  hp: number;
  /** 称号，如「乱世奸雄」 */
  title?: string;
  /** 头像 emoji */
  emoji?: string;
  /** 技能名（展示用） */
  skill?: string;
  /** 已实装的技能 ID，见 engine.ts 的 SKILLS */
  skillIds?: string[];
  /** 人物形象介绍 */
  desc?: string;
}

export interface Card {
  id: string;
  name: string;
  type: CardType;
  suit: CardSuit;
  point: number;
  /** 是否需要目标 */
  needTarget?: boolean;
  /** 目标类型：敌方 / 任意人（含自己）/ 自己 / 无需目标 */
  targetKind?: 'enemy' | 'any' | 'self' | 'none';
  /** 装备类型 */
  equipKind?: 'weapon' | 'armor' | 'horse';
  /** 攻击范围（武器）或距离修正（±1 马） */
  range?: number;
  /** 属性（普通 / 火 / 雷） */
  element?: Element;
  /** 装备特效标识 */
  effect?: 'lianu' | 'qinggang' | 'ice' | 'guding' | 'qilin' | 'bagua' | 'renwang' | 'tengjia' | 'shizi';
  /** 延时锦囊 */
  delayed?: boolean;
}

/** 一次需要响应的伤害事件（杀 / 万箭 / 南蛮 / 决斗） */
export interface Ask {
  kind: 'sha' | 'wanjian' | 'nanman' | 'juedou' | 'wuxie';
  fromSeat: number;
  toSeat: number;
  /** 需要打出的牌 */
  need: '闪' | '杀' | '无懈';
  damage: number;
  title: string;
  /** 造成伤害的牌名，用于防具判定 */
  cardName: string;
  element: Element;
  /** 铁骑 / 青釭：无视闪与防具 */
  autoHit?: boolean;
  /** 需要连续打出几张（无双：2 张闪 / 2 张杀） */
  needCount?: number;
  /** 已经打出的张数（无双需要连续打出） */
  usedCount?: number;
  /** 造成伤害的牌（奸雄获得此牌） */
  card?: Card;
  /** 无懈可击：被抵消的那次响应事件 */
  inner?: Ask;
  /** 无懈可击链上指向的原始锦囊事件（链上每一层都相同，供 UI/AI 展示判断） */
  event?: Ask;
}

/** 个人战功统计（局末评分用） */
export interface PlayerStats {
  /** 击杀人数 */
  kills: number;
  /** 造成的伤害点数 */
  damageDealt: number;
  /** 受到的伤害点数 */
  damageTaken: number;
  /** 使用/打出的牌数 */
  cardsUsed: number;
  /** 救援濒死队友次数 */
  saves: number;
}

/** 阵亡公告：公开身份 + 奖惩结算 */
export interface DeathNotice {
  seat: number;
  name: string;
  identity: Identity;
  killerSeat?: number;
  killerName?: string;
  /** 击杀反贼：摸 3 张 */
  reward?: string;
  /** 主公误杀忠臣：弃置所有牌 */
  punish?: string;
}

export interface Player {
  seat: number; // 0-4 座位
  role: PlayerRole;
  identity: Identity;
  hero: Hero;
  hp: number;
  maxHp: number;
  hand: Card[];
  /** 判定区（乐不思蜀 / 兵粮寸断 / 闪电） */
  judgeZone: Card[];
  /** 已装备牌（武器 / 防具 / ±1 马） */
  equipZone: Card[];
  /** 主公身份对所有人公开 */
  revealedIdentity?: Identity;
  /** 被谁打过（记录 seat）：AI 用这个推断身份 */
  attackedBy: Set<number>;
  /** 已经出过的牌（当前回合） */
  playedThisTurn: string[];
  /** 能否出杀（每回合一张） */
  canPlaySha: boolean;
  /** 是否横置（铁索连环简化版占位） */
  chained: boolean;
  /** 战功统计 */
  stats: PlayerStats;
}

export interface GameState {
  players: Player[];
  activeSeat: number;
  phase: Phase;
  drawPile: Card[];
  discardPile: Card[];
  turnCount: number;
  log: string[];
  winner: Identity | null;
  zhuSeat: number;
  usedSkill: string[];
  shaBonus: number;
  /** 本回合仁德累计给出的牌数（第 2 张回复 1 点体力） */
  rendeGiven: number;
  /** 待结算的响应队列 */
  asks: Ask[];
  /** 当前等待人类玩家响应的那一条 */
  ask: Ask | null;
  /** 每次状态变化自增：UI 用它触发 AI 续跑 */
  seq: number;
  /** 结束后公布所有身份 */
  revealAll: boolean;
  /** 最近一次阵亡公告（UI 弹层展示，点「知道了」清空） */
  deathNotice: DeathNotice | null;
  /** 弃牌阶段待办：轮到人类玩家按手牌上限弃牌 */
  discardTask: { seat: number; count: number } | null;
}
