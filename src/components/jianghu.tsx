'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 江湖风云录：三章文字冒险 + 回合制战斗。
 *
 * 核心设定（按需求实现）：
 * - 三种武器流派，各有特点：
 *   · 拳法：伤害低，但出手沉实，很难被闪避、很难被招架
 *   · 剑法：伤害中规中矩，剑走轻灵很难被闪避，但剑招端正容易被招架
 *   · 刀法：伤害高，但大开大合，容易被闪避、也容易被招架
 *   该特性对敌我双方一视同仁：敌人用什么流派，你闪避/招架它的难易也按此计算。
 * - 场景配图（实物）+ 人物头像（人头）全部内嵌展示。
 *
 * 剧情数据集中在 NODES / EVENTS，applyEffects 为纯函数。
 */

// ──────────────────────────── 基础类型 ────────────────────────────

type Chapter = 1 | 2 | 3;
type EndingKey = 'lord' | 'hermit' | 'demon' | 'death';
type LogTone = 'info' | 'win' | 'lose' | 'event';
type SchoolKey = 'quan' | 'jian' | 'dao';

type Effects = {
  hp?: number;
  qi?: number;
  wit?: number;
  chivalry?: number;
  silver?: number;
  items?: string[];
  removeItems?: string[];
};

type Combat = {
  enemy: string;
  difficulty: number;
  win: string;
  lose: string;
  loseHp?: number;
  /** 城镇挑战战：胜利后按城镇等级发放武学，不推进剧情 */
  town?: string;
};
type Choice = { label: string; effects?: Effects; combat?: Combat; next: string };

type StoryNode = {
  id: string;
  chapter: Chapter;
  title: string;
  text: string;
  choices: Choice[];
  ending?: EndingKey | 'judge';
};

type EventChoice = { label: string; effects?: Effects; combat?: Combat };
type RandomEvent = { id: string; title: string; text: string; choices: EventChoice[] };

/** 装备槽：兵器 / 护甲 / 饰品，每槽只能装一件 */
type GearSlot = 'weapon' | 'armor' | 'accessory';
type Equipped = Record<GearSlot, string | null>;

type Hero = {
  origin: string;
  school: SchoolKey;
  hp: number;
  maxHp: number;
  qi: number;
  wit: number;
  chivalry: number;
  silver: number;
  items: string[];
  /** 已装备：战力与减伤只认这里的物品 */
  equipped: Equipped;
  /** 境界等级：打赢硬仗才涨，升级加气血上限与内力 */
  level: number;
  /** 当前等级内已积累的经验 */
  exp: number;
  /** 已学秘籍 / 内功 */
  manualId: string | null;
  innerId: string | null;
};

type LogEntry = { id: number; text: string; tone: LogTone };

type Origin = {
  key: string;
  name: string;
  emoji: string;
  desc: string;
  node: string;
  hp: number;
  maxHp: number;
  qi: number;
  wit: number;
  chivalry: number;
  silver: number;
  items: string[];
};

// ──────────────────────────── 图片资源（场景实物 + 人物人头） ────────────────────────────

const img = (prompt: string, size: 'square' | 'landscape_16_9') =>
  `https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;

/** 场景图：水墨武侠风横版场景（实物背景） */
const SCENES: Record<string, { url: string; label: string }> = {
  'luoyang-snow': {
    label: '洛阳雪夜',
    url: img('中国水墨武侠风场景插画，洛阳古城雪夜，残雪覆盖城墙与旗杆，一盏灯笼，冷色调，横向构图，无人像', 'landscape_16_9'),
  },
  village: {
    label: '青牛村',
    url: img('中国水墨武侠风场景插画，雪压茅屋的山村清晨，篱笆与柴火堆，远山，横向构图，无人', 'landscape_16_9'),
  },
  temple: {
    label: '破庙',
    url: img('中国水墨武侠风场景插画，雨夜破庙内部，将熄的火堆，斑驳佛像，漏雨的屋檐，横向构图', 'landscape_16_9'),
  },
  ferry: {
    label: '洛水渡口',
    url: img('中国水墨武侠风场景插画，湍急河流渡口，木船系在桩上，风急浪高，灰暗天空，横向构图', 'landscape_16_9'),
  },
  lantern: {
    label: '上元灯市',
    url: img('中国水墨武侠风场景插画，古代上元灯市长街，成百盏花灯，人群剪影，暖光，横向构图', 'landscape_16_9'),
  },
  inn: {
    label: '悦来客栈',
    url: img('中国水墨武侠风场景插画，古代客栈大堂，八仙桌长条凳，酒旗灯笼，人声鼎沸的氛围，横向构图', 'landscape_16_9'),
  },
  stronghold: {
    label: '黑风寨',
    url: img('中国水墨武侠风场景插画，山崖上的贼寨，木门哨塔，风铃成串，夜色火把，横向构图', 'landscape_16_9'),
  },
  jiangnan: {
    label: '江南水乡',
    url: img('中国水墨武侠风场景插画，江南水乡三月，石桥乌篷船，燕子坞，细雨，青绿山水，横向构图', 'landscape_16_9'),
  },
  valley: {
    label: '药王谷',
    url: img('中国水墨武侠风场景插画，云雾缭绕的山谷，药田与晒药架，茅屋，仙鹤，横向构图', 'landscape_16_9'),
  },
  mist: {
    label: '雾林',
    url: img('中国水墨武侠风场景插画，浓雾弥漫的山林小径，树影幢幢，暗藏杀机的氛围，横向构图', 'landscape_16_9'),
  },
  dungeon: {
    label: '血手堂石室',
    url: img('中国水墨武侠风场景插画，地下石室，墙上挂满锈刀，火盆照明，阴冷压抑，横向构图', 'landscape_16_9'),
  },
  'sword-mound': {
    label: '剑冢',
    url: img('中国水墨武侠风场景插画，荒草剑冢，数百柄断剑插在地上，正中一柄完好古剑，夕阳残照，横向构图', 'landscape_16_9'),
  },
  peak: {
    label: '雁荡绝顶',
    url: img('中国水墨武侠风场景插画，高山绝顶云海翻涌，石阶通向天边，决战氛围，冷峻色调，横向构图', 'landscape_16_9'),
  },
  huashan: {
    label: '华山之巅',
    url: img('中国水墨武侠风场景插画，华山之巅日出，云海金光，各派旗帜林立，恢弘大气，横向构图', 'landscape_16_9'),
  },
};

/** 节点 → 场景图 */
const NODE_SCENE: Record<string, string> = {
  'o-noble': 'luoyang-snow', 'o-orphan': 'village', 'o-escort': 'stronghold',
  a01: 'temple', a02: 'ferry', a03: 'stronghold', a04: 'lantern', a05: 'mist',
  a06: 'inn', a07: 'stronghold', a08: 'mist', a09: 'luoyang-snow',
  b01: 'jiangnan', b02: 'jiangnan', b02b: 'inn', b03: 'valley', b04: 'mist',
  b04b: 'valley', b05: 'dungeon', b06: 'jiangnan', b07: 'jiangnan',
  b08: 'sword-mound', b09: 'inn',
  c01: 'peak', c02: 'peak', c03: 'dungeon', c04: 'dungeon', c05: 'peak',
  c06: 'peak', c07: 'peak', c08: 'huashan',
  'end-judge': 'huashan', 'end-lord': 'huashan', 'end-hermit': 'jiangnan',
  'end-demon': 'dungeon', 'end-death': 'mist',
};

/** 人物头像（人头）：玩家按流派，敌人按身份 */
const PORTRAITS: Record<string, string> = {
  quan: img('中国水墨武侠风人物头像特写，布衣拳师，双拳缠着布条，眼神沉稳，方形构图', 'square'),
  jian: img('中国水墨武侠风人物头像特写，青衫剑客，长剑负于身后，眉目清俊，方形构图', 'square'),
  dao: img('中国水墨武侠风人物头像特写，劲装刀客，横刀在膝，面容刚毅，方形构图', 'square'),
  黑塔: img('中国水墨武侠风反派人物头像特写，铁塔般的黑脸壮汉寨主，络腮胡，凶悍，方形构图', 'square'),
  铁拳门主: img('中国水墨武侠风反派人物头像特写，铁拳门主，虬髯壮汉，双拳硕大，傲慢神情，方形构图', 'square'),
  血手堂杀手: img('中国水墨武侠风反派人物头像特写，蒙面黑衣杀手，只露双眼，袖口血色手掌纹样，阴冷，方形构图', 'square'),
  殷无咎: img('中国水墨武侠风反派人物头像特写，魔教教主，面色苍白俊美，黑袍金纹，笑里藏刀，方形构图', 'square'),
  苏挽: img('中国水墨武侠风女性人物头像特写，白衣女子，眉目坚毅，肩头带伤，方形构图', 'square'),
  山贼头目: img('中国水墨武侠风反派人物头像特写，山贼头目，乱发包头巾，腮边短须，缺牙狞笑，方形构图', 'square'),
  独眼掌柜: img('中国水墨武侠风反派人物头像特写，独眼客栈掌柜，单眼戴黑眼罩，肩搭抹布，满脸横肉，方形构图', 'square'),
  青城弟子: img('中国水墨武侠风人物头像特写，青城派年轻弟子，青色道袍，手持长剑，眉宇傲气，方形构图', 'square'),
  魔教护法: img('中国水墨武侠风反派人物头像特写，魔教护法，黑红长袍，半面刺青，眼神阴鸷，方形构图', 'square'),
};

// ──────────────────────────── 流派（拳 / 剑 / 刀） ────────────────────────────

type School = {
  key: SchoolKey;
  name: string;
  emoji: string;
  weapon: string;
  /** 出手伤害区间（未加成） */
  dmgMin: number;
  dmgMax: number;
  /** 对手闪避我方攻击的修正（百分点，负数=更难躲） */
  dodgeVs: number;
  /** 对手招架我方攻击的修正（百分点，负数=更难架） */
  parryVs: number;
  desc: string;
};

const SCHOOLS: Record<SchoolKey, School> = {
  quan: {
    key: 'quan', name: '拳法', emoji: '👊', weapon: '缠手布',
    dmgMin: 8, dmgMax: 14, dodgeVs: -10, parryVs: -10,
    desc: '拳拳到肉，伤害不高；但出手短促沉实，对手极难闪避，也极难招架。',
  },
  jian: {
    key: 'jian', name: '剑法', emoji: '🗡️', weapon: '长剑',
    dmgMin: 14, dmgMax: 21, dodgeVs: -6, parryVs: 18,
    desc: '伤害中规中矩；剑走轻灵，对手难以闪避，但剑路端正，容易被招架。',
  },
  dao: {
    key: 'dao', name: '刀法', emoji: '⚔️', weapon: '单刀',
    dmgMin: 22, dmgMax: 34, dodgeVs: 16, parryVs: 16,
    desc: '一刀既出，势大力沉，伤害最高；但大开大合，容易被闪避，也容易被招架。',
  },
};

/** 敌人配置：各自也用拳/剑/刀，闪避招架规则与玩家相同 */
type EnemyDef = {
  name: string;
  school: SchoolKey;
  qi: number;
  wit: number;
  power: number; // 伤害倍率
  hpBase: number; // 血量 = hpBase + difficulty*hpPerDiff
  hpPerDiff: number;
  intro: string;
};

const ENEMIES: Record<string, EnemyDef> = {
  黑塔: {
    name: '黑塔', school: 'dao', qi: 30, wit: 20, power: 0.9, hpBase: 55, hpPerDiff: 1.7,
    intro: '黑风寨主，一柄厚背鬼头刀，杀人如切菜。',
  },
  铁拳门主: {
    name: '铁拳门主', school: 'quan', qi: 45, wit: 26, power: 0.85, hpBase: 70, hpPerDiff: 1.8,
    intro: '双拳开碑裂石，连赢七场未逢敌手。',
  },
  血手堂杀手: {
    name: '血手堂杀手', school: 'jian', qi: 42, wit: 44, power: 1.0, hpBase: 60, hpPerDiff: 1.9,
    intro: '袖绣血手，剑走偏锋，出手不见血不收。',
  },
  殷无咎: {
    name: '殷无咎', school: 'dao', qi: 62, wit: 58, power: 1.25, hpBase: 90, hpPerDiff: 1.9,
    intro: '魔教教主，刀薄如蝉翼，出手时几乎听不见风声。',
  },
  山贼头目: {
    name: '山贼头目', school: 'dao', qi: 22, wit: 24, power: 0.75, hpBase: 45, hpPerDiff: 1.5,
    intro: '黑风寨小头目，一柄缺口砍刀，欺软怕硬，下手却黑。',
  },
  独眼掌柜: {
    name: '独眼掌柜', school: 'quan', qi: 38, wit: 30, power: 0.9, hpBase: 65, hpPerDiff: 1.7,
    intro: '独眼客栈掌柜，一双铁拳打过南北货运，最见不得人赊账。',
  },
  青城弟子: {
    name: '青城弟子', school: 'jian', qi: 40, wit: 38, power: 0.95, hpBase: 60, hpPerDiff: 1.8,
    intro: '青城山外门弟子，剑法端正，最爱与人争一时长短。',
  },
  魔教护法: {
    name: '魔教护法', school: 'dao', qi: 58, wit: 50, power: 1.15, hpBase: 85, hpPerDiff: 1.9,
    intro: '魔教左护法，刀快心狠，专挑硬手试刀。',
  },
};

/** 会心率：悟性越高越容易打中要害，封顶 25% */
function critChance(wit: number): number {
  return clamp(Math.round(8 + wit * 0.15), 8, 25);
}

/** 基础闪避/招架：悟性影响闪避，内力影响招架，再叠加攻击方流派修正 */
function dodgeChance(defWit: number, atkSchool: SchoolKey): number {
  return clamp(Math.round(10 + defWit * 0.12 + SCHOOLS[atkSchool].dodgeVs), 2, 55);
}
function parryChance(defQi: number, atkSchool: SchoolKey): number {
  return clamp(Math.round(10 + defQi * 0.12 + SCHOOLS[atkSchool].parryVs), 2, 60);
}

/**
 * 装备：只有装进槽位才生效，提供战力与护甲减伤。
 * 另有三条锻造词条（原作的「暴击 / 吸血 / 速度」）：
 * - crit：额外会心率（百分点）
 * - lifesteal：命中后按伤害比例吸血（百分点）
 * - speed：出手速度
 */
type GearDef = { slot: GearSlot; power: number; crit?: number; lifesteal?: number; speed?: number; desc: string };

const GEAR: Record<string, GearDef> = {
  柴刀: { slot: 'weapon', power: 2, desc: '农家柴刀，刃口卷了，聊胜于无。' },
  青铜剑: { slot: 'weapon', power: 6, crit: 2, speed: 1, desc: '镖局制式青铜剑，沉手耐用。' },
  柳叶刀: { slot: 'weapon', power: 9, crit: 3, lifesteal: 6, speed: 2, desc: '刀身如柳叶，轻快锋利；刃薄能饮血。' },
  镇远剑: { slot: 'weapon', power: 20, crit: 5, lifesteal: 12, speed: 1, desc: '沈家祖传，剑脊刻「镇远」二字，剑气回身。' },
  软甲: { slot: 'armor', power: 10, speed: -2, desc: '贴身软甲，可卸去两成刀伤，只是略碍身法。' },
  青玉哨: { slot: 'accessory', power: 2, crit: 3, speed: 4, desc: '青玉小哨，吹响时能定神提气。' },
  盟主令: { slot: 'accessory', power: 6, crit: 5, speed: 6, desc: '号令群雄的信物，佩之则气势自生。' },
};

/** 词条文字：暴击 / 吸血 / 速度 */
function gearAffix(gear: GearDef): string {
  const parts: string[] = [];
  if (gear.crit) parts.push(`暴击 +${gear.crit}%`);
  if (gear.lifesteal) parts.push(`吸血 ${gear.lifesteal}%`);
  if (gear.speed) parts.push(`速度 ${gear.speed > 0 ? '+' : ''}${gear.speed}`);
  return parts.join(' · ');
}

/** 已装备物品的词条合计 */
function gearStats(hero: Hero): { power: number; crit: number; lifesteal: number; speed: number } {  const total = { power: 0, crit: 0, lifesteal: 0, speed: 0 };
  for (const { slot } of SLOT_LABELS) {
    const name = hero.equipped[slot];
    const gear = name ? GEAR[name] : null;
    if (!gear) continue;
    total.power += gear.power;
    total.crit += gear.crit ?? 0;
    total.lifesteal += gear.lifesteal ?? 0;
    total.speed += gear.speed ?? 0;
  }
  return total;
}

/** 玩家出手速度：悟性 + 境界 + 装备 */
function heroSpeed(hero: Hero): number {
  return Math.round(10 + hero.wit * 0.16 + hero.level * 0.4 + gearStats(hero).speed);
}

/** 敌人出手速度：悟性与内力共同决定（敌人无装备） */
function enemySpeed(def: EnemyDef): number {
  return Math.round(10 + def.wit * 0.16 + def.qi * 0.06);
}

/**
 * 先手判定：速度差超过 10，快者必先手；
 * 相差 10 以内则随机，但更快的一方几率略高（原作的「速度相近看脸」）。
 */
function rollFirst(playerSpeed: number, foeSpeed: number): boolean {
  const diff = playerSpeed - foeSpeed;
  if (Math.abs(diff) > 10) return diff > 0;
  return Math.random() < clamp(0.5 + diff / 40, 0.25, 0.75);
}

const SLOT_LABELS: { slot: GearSlot; label: string }[] = [
  { slot: 'weapon', label: '兵器' },
  { slot: 'armor', label: '护甲' },
  { slot: 'accessory', label: '饰品' },
];

/** 可服用药品：战斗中按数量消耗 */
const MEDS: Record<string, { heal: number; desc: string }> = {
  金创药: { heal: 30, desc: '寻常伤药，回复 30 点气血。' },
  还魂草: { heal: 55, desc: '药王谷至宝，回复 55 点气血。' },
};
const MED_ORDER = ['金创药', '还魂草'];
/** 可叠放的消耗品；其余物品（装备、信物）只保留一件 */
const STACKABLE = new Set(['金创药', '还魂草']);

/** 集市：明码标价，装备限购一件 */
const SHOP: { name: string; price: number; note: string }[] = [
  { name: '金创药', price: 15, note: '回复 30 气血 · 可叠放' },
  { name: '还魂草', price: 45, note: '回复 55 气血 · 可叠放' },
  { name: '软甲', price: 120, note: '护甲 · 减伤两成 · 速度 -2' },
  { name: '青玉哨', price: 60, note: '饰品 · 战力 +2 · 暴击 +3% · 速度 +4' },
  { name: '柳叶刀', price: 80, note: '兵器 · 战力 +9 · 暴击 +3% · 吸血 6%' },
  { name: '镇远剑', price: 260, note: '兵器 · 战力 +20 · 暴击 +5% · 吸血 12%' },
];

/** 本地存档：只存主线状态，战斗与奇遇的临时局面不入档 */
const SAVE_KEY = 'jianghu.save.v1';
type SaveData = {
  v: 1;
  playerName: string;
  avatarKey: string;
  originKey: string;
  hero: Hero;
  nodeId: string;
  cleared: string[];
  /** 上次存档时间戳：用于结算离线挂机收益 */
  lastIdle?: number;
};

// ──────────────────────────── 剧情数据 ────────────────────────────

const NODES: Record<string, StoryNode> = {
  // ───────────────── 第一章 · 初入江湖 ─────────────────
  'o-noble': {
    id: 'o-noble', chapter: 1, title: '洛阳残雪',
    text: '洛阳三月，残雪未消。你姓沈，是「镇远刀」沈家的独苗，如今门楣蒙尘，只剩半座旧宅。父亲临终只留一句：「刀可断，脊梁不可弯。」门外忽起马蹄声，来人自称父亲旧部顾长风，请你随他去黑风岭走一趟。',
    choices: [
      { label: '提刀随行，不问缘由', effects: { chivalry: 5, qi: 3 }, next: 'a01' },
      { label: '先祭父亲，再问江湖', effects: { wit: 4, hp: 4 }, next: 'a01' },
      { label: '闭门谢客，守着祖宅', effects: { chivalry: -4, silver: 15 }, next: 'a04' },
    ],
  },
  'o-orphan': {
    id: 'o-orphan', chapter: 1, title: '青牛村雪',
    text: '青牛村的雪压塌了半间茅屋。你被老猎户张伯从狼口中捡回来，十八年只学会砍柴、下套、辨兽迹。昨夜张伯咳血，攥着你的手腕说：「去洛阳，找姓顾的。」天未亮，你已揣着半块冷馍站在村口。',
    choices: [
      { label: '先背张伯去镇上求医，再赶路', effects: { chivalry: 7, silver: -5, hp: -4 }, next: 'a01' },
      { label: '留三日，替他劈满一院柴', effects: { hp: 6, wit: 3 }, next: 'a01' },
      { label: '连夜上路，不做停留', effects: { qi: 5, hp: -3 }, next: 'a02' },
    ],
  },
  'o-escort': {
    id: 'o-escort', chapter: 1, title: '威远镖旗',
    text: '你在威远镖局走了七年镖，肩上的疤比年岁还多。这趟押的是一只黑木匣，镖头只交代四个字：「人在匣在。」行至黑风岭，绊马索骤起，林间箭如飞蝗。镖头把匣子塞进你怀里，自己提刀迎了上去。',
    choices: [
      { label: '护匣先走，不回头', effects: { silver: 20, chivalry: -2 }, next: 'a03' },
      { label: '回身救镖头', effects: { hp: -12, chivalry: 9 }, next: 'a03' },
      { label: '弃匣而逃，保住性命', effects: { chivalry: -9, silver: -15 }, next: 'a02' },
    ],
  },
  a01: {
    id: 'a01', chapter: 1, title: '破庙夜雨',
    text: '雨点砸在破庙的瓦上，檐下火堆将熄。庙里还坐着个灰衣老者，膝前横着一柄无鞘旧剑。他打量你半晌：「娃娃，江湖第一步，先学会看人。」火光一晃，他袖口露出半枚暗纹，像某座大派的记认。',
    choices: [
      { label: '拱手请教江湖规矩', effects: { wit: 5, qi: 2 }, next: 'a04' },
      { label: '递上干粮，同坐一夜', effects: { chivalry: 5, silver: -3 }, next: 'a04' },
      { label: '按刀不语，退到门边', effects: { wit: 2, hp: 2 }, next: 'a06' },
    ],
  },
  a02: {
    id: 'a02', chapter: 1, title: '渡口风波',
    text: '洛水渡口风急，船家不肯开船。岸边几个泼皮围住一对母子，要抢那只旧包袱。围观的人不少，却都低着头，只听水声哗哗，像在替谁遮掩。',
    choices: [
      { label: '拔刀喝止，护那母子下船', effects: { chivalry: 7, hp: -6, silver: 10 }, next: 'a05' },
      { label: '掏钱替母子赎身', effects: { silver: -25, chivalry: 5 }, next: 'a05' },
      { label: '低头登船，只当未见', effects: { wit: 3, chivalry: -5 }, next: 'a04' },
    ],
  },
  a03: {
    id: 'a03', chapter: 1, title: '黑风寨探路',
    text: '黑风寨踞在断魂崖，寨前风铃成串，风一过便如鬼哭。你扮作樵夫绕到后山，寨门虚掩，两个山贼正赌钱，刀就搁在手边。寨中堂屋灯火通明，隐约有人说「匣子今夜就送走」。',
    choices: [
      { label: '摸进去，先寻黑木匣', effects: { wit: 4, qi: 3 }, next: 'a07' },
      { label: '趁夜放火，引蛇出洞', effects: { hp: -8, chivalry: 3 }, next: 'a07' },
      { label: '退回山下，从长计议', effects: { wit: 5, silver: -5 }, next: 'a06' },
    ],
  },
  a04: {
    id: 'a04', chapter: 1, title: '灯市听棋',
    text: '洛阳上元，灯如白昼。街角棋摊围满了人，摊主是个瞎眼老翁，一手盲棋下得满堂彩。你挤进去时，正听他捻须道：「棋到中盘，莫急着吃子；人到中年，莫急着成名。」',
    choices: [
      { label: '坐下与老翁对弈一局', effects: { wit: 7, silver: -5 }, next: 'a06' },
      { label: '买串糖葫芦，听旁人闲话', effects: { hp: 3, wit: 2, silver: -3 }, next: 'a05' },
      { label: '不屑一顾，径直去客栈', effects: { chivalry: -2 }, next: 'a06' },
    ],
  },
  a05: {
    id: 'a05', chapter: 1, title: '白衣求救',
    text: '巷尾传来一声闷哼。白衣女子扶着墙，左肩钉着三枚透骨钉，血把衣襟染成暗红。她见你，先问的不是救命：「你可是洛阳沈家的人？」她袖口那道暗纹，你今夜才在破庙里见过。',
    choices: [
      { label: '替她拔钉裹伤', effects: { hp: -4, chivalry: 6, wit: 2, items: ['青玉哨'] }, next: 'a06' },
      { label: '追问来历，再决定救不救', effects: { wit: 4, chivalry: -2 }, next: 'a06' },
      { label: '装作未见，绕道而行', effects: { chivalry: -6 }, next: 'a06' },
    ],
  },
  a06: {
    id: 'a06', chapter: 1, title: '悦来客栈',
    text: '悦来客栈人声鼎沸，跑堂唱菜名像唱曲。靠窗的独臂汉子桌上摆着七枚铜钱，排成北斗。他见你进门，抬手把最后一枚弹向你的桌角。铜钱未落，楼下已有人悄悄扣住了刀柄。',
    choices: [
      { label: '接住铜钱，坐到他那桌', effects: { qi: 4, wit: 3 }, next: 'a07' },
      { label: '只当没看见，上楼歇息', effects: { hp: 8, silver: -2 }, next: 'a07' },
      { label: '反手弹回，试探深浅', effects: { hp: -3, chivalry: 3 }, next: 'a07' },
    ],
  },
  a07: {
    id: 'a07', chapter: 1, title: '夜袭黑风寨',
    text: '三更鼓响，寨中灯笼一盏盏灭下去。寨主「黑塔」正坐在堂中分赃，脚边就是那只黑木匣。院里二十七名山贼，刀口全朝着大门。风铃忽然齐响，像有人替你先喊了一声杀。',
    choices: [
      { label: '破门而入，直取黑塔', combat: { enemy: '黑塔', difficulty: 40, win: 'a09', lose: 'a08', loseHp: 28 }, next: 'a09' },
      { label: '从后窗潜入，夺匣便走', effects: { wit: 4, qi: -4 }, next: 'a09' },
      { label: '在寨外放火，趁乱摸入', effects: { hp: -6, chivalry: 2 }, next: 'a09' },
      { label: '退去，改日再来', effects: { chivalry: -2 }, next: 'a06' },
    ],
  },
  a08: {
    id: 'a08', chapter: 1, title: '败走断魂崖',
    text: '你在崖下乱石堆里醒来，胸口像压了一块磨盘。刀断成两截，黑木匣还在寨里。崖上火光冲天，有人扯着嗓子喊：「别让那小子跑了！」',
    choices: [
      { label: '咬牙再上山，趁乱取匣', effects: { hp: -8, chivalry: 4 }, next: 'a09' },
      { label: '回洛阳养伤，从长计议', effects: { hp: 10, silver: -10 }, next: 'a09' },
      { label: '就此离开洛阳', effects: { chivalry: -5 }, next: 'b01' },
    ],
  },
  a09: {
    id: 'a09', chapter: 1, title: '一鸣洛阳',
    text: '黑风寨一夜倾覆，洛阳茶楼连说三日。有人说你是沈家遗孤，有人说你是山里蹦出来的煞星。无论如何，「沈」字重新挂回城门下的旗杆。顾长风拍你的肩：「下一步，去江南。」',
    choices: [
      { label: '随顾长风南下', effects: { silver: 50 }, next: 'b01' },
      { label: '先开馆授徒，再赴江南', effects: { silver: 60, chivalry: 3, wit: 3 }, next: 'b02' },
      { label: '独自先行，不等旁人', effects: { qi: 5 }, next: 'b02' },
    ],
  },

  // ───────────────── 第二章 · 名动一方 ─────────────────
  b01: {
    id: 'b01', chapter: 2, title: '群雄帖',
    text: '江南三月，燕子坞前贴出英雄帖：魔教血手堂重出江湖，各派须在半月内赴姑苏会盟。帖子送到你手里时，纸角还带着血。送帖人只说一句：「不去，便当作魔教同党。」',
    choices: [
      { label: '即刻赴会', effects: { wit: 3 }, next: 'b02' },
      { label: '先往药王谷求伤药', effects: { silver: -20, hp: 15 }, next: 'b03' },
      { label: '闭门谢客，静观其变', effects: { wit: 5, chivalry: -3 }, next: 'b04' },
    ],
  },
  b02: {
    id: 'b02', chapter: 2, title: '姑苏擂台',
    text: '姑苏城外设下擂台，各路豪杰以武会友。台上铁塔般的汉子连赢七场，自称铁拳门门主，口出狂言：「江南无人。」台下鸦雀无声，只有你那柄刀在鞘里轻轻响。',
    choices: [
      { label: '上台一战', combat: { enemy: '铁拳门主', difficulty: 45, win: 'b04', lose: 'b02b', loseHp: 22 }, next: 'b04' },
      { label: '台下静观，记其破绽', effects: { wit: 6 }, next: 'b04' },
      { label: '转身离去，不愿争名', effects: { chivalry: 3 }, next: 'b05' },
    ],
  },
  b02b: {
    id: 'b02b', chapter: 2, title: '伤卧客栈',
    text: '你在客栈里躺了三日，肋骨断了两根。铁拳门主的名号传遍姑苏，也把你「沈家后人不过如此」的话一并传了出去。窗外雨声不休，苏挽托人送来一包药，没留字。',
    choices: [
      { label: '服药养伤，再赴会盟', effects: { hp: 20, silver: -10 }, next: 'b04' },
      { label: '带伤起身，去寻血手堂', effects: { hp: -6, chivalry: 3 }, next: 'b05' },
      { label: '就此隐姓埋名，不问江湖', effects: { chivalry: -6 }, next: 'b04' },
    ],
  },
  b03: {
    id: 'b03', chapter: 2, title: '药王谷',
    text: '药王谷藏在雾里，满谷药香。谷主是个白发婆婆，正晒一株通体血红的还魂草。她头也不抬：「求药者，先答我一句：救人一命，与杀一人，哪个更重？」',
    choices: [
      { label: '答「救人更重」', effects: { chivalry: 6, hp: 18 }, next: 'b04' },
      { label: '答「看该不该救」', effects: { wit: 6, hp: 8, items: ['还魂草'] }, next: 'b04' },
      { label: '不答，放下银子便走', effects: { silver: -20, hp: 10, chivalry: -2 }, next: 'b04' },
    ],
  },
  b04: {
    id: 'b04', chapter: 2, title: '雾中伏杀',
    text: '出谷未远，雾里忽然响起铃声。三名黑衣人自树上落下，袖口绣着血色手掌。为首者笑得阴冷：「沈家的种，果然还活着。」话音未落，刀已及喉。',
    choices: [
      { label: '拔刀迎战', combat: { enemy: '血手堂杀手', difficulty: 48, win: 'b06', lose: 'b04b', loseHp: 25 }, next: 'b06' },
      { label: '退入药林，借雾周旋', effects: { wit: 4, hp: -8 }, next: 'b06' },
      { label: '亮出顾长风的名号', effects: { chivalry: -2 }, next: 'b05' },
    ],
  },
  b04b: {
    id: 'b04b', chapter: 2, title: '昏迷三日',
    text: '你醒来时，伤口已被草草包扎。救你的是个采药少年，他说在雾里捡到你时，血把半边衣服都浸透了。血手堂的铃声还在山那边响，一声比一声近。',
    choices: [
      { label: '谢过少年，连夜赶路', effects: { hp: 12, silver: -8 }, next: 'b06' },
      { label: '留下替他采药三日', effects: { chivalry: 5, hp: 20 }, next: 'b06' },
      { label: '独自追进雾里', effects: { qi: 4, hp: -5 }, next: 'b05' },
    ],
  },
  b05: {
    id: 'b05', chapter: 2, title: '血手堂',
    text: '你被押进一座地下石室，墙上挂满锈刀。血手堂堂主面色苍白，递来一杯酒：「沈家当年灭我满门，你如今若肯入教，旧账一笔勾销。」酒香里有一丝铁锈味。',
    choices: [
      { label: '摔杯，怒骂', effects: { hp: -12, chivalry: 8 }, next: 'b07' },
      { label: '假意应承，伺机脱身', effects: { wit: 6, chivalry: -5 }, next: 'b07' },
      { label: '饮下此酒，先活下来', effects: { chivalry: -15, qi: 10 }, next: 'b08' },
    ],
  },
  b06: {
    id: 'b06', chapter: 2, title: '故人重逢',
    text: '会盟前夜，你在河边遇见一个卖伞的女子。她抬头，正是那夜白衣染血的人。她自称苏挽，是沈家旧仆之女，也是黑木匣真正该送到的人。她只问：「匣子，还在你手里么？」',
    choices: [
      { label: '若在便交还，如实相告', effects: { chivalry: 7, wit: 3 }, next: 'b07' },
      { label: '追问匣中究竟何物', effects: { wit: 5 }, next: 'b07' },
      { label: '含糊其辞，留匣在手', effects: { chivalry: -6 }, next: 'b07' },
    ],
  },
  b07: {
    id: 'b07', chapter: 2, title: '长街血战',
    text: '会盟当日，血手堂伏兵四起，长街刀光如雪。苏挽替你挡下一枚暗器，肩上再度见血。街尾一顶黑轿缓缓停下，轿中人只说了两个字：「让开。」',
    choices: [
      { label: '护住苏挽，死战不退', effects: { hp: -12, chivalry: 8, qi: 4 }, next: 'b08' },
      { label: '抱起苏挽，突围而去', effects: { hp: -6, chivalry: 5 }, next: 'b08' },
      { label: '挡在轿前，请群雄先走', effects: { hp: -10, chivalry: 9 }, next: 'b08' },
    ],
  },
  b08: {
    id: 'b08', chapter: 2, title: '剑冢',
    text: '会盟散后，顾长风带你到城外剑冢。荒草间插着数百柄断剑，正中最里那柄却完好如新，剑脊刻着「镇远」二字。他说：「你爹的剑。拔得出来，你便接过沈家的担子。」',
    choices: [
      { label: '运起内力，拔剑出冢', effects: { qi: 8, chivalry: 4, items: ['镇远剑'] }, next: 'b09' },
      { label: '先向剑冢三拜，再伸手', effects: { chivalry: 6, wit: 4, items: ['镇远剑'] }, next: 'b09' },
      { label: '不拔，转身就走', effects: { wit: 2, qi: 2 }, next: 'b09' },
    ],
  },
  b09: {
    id: 'b09', chapter: 2, title: '掌门遗托',
    text: '青城掌门清虚真人重伤不起，临终把盟主令塞进你手里：「魔教总坛在雁荡绝顶。沈家小子，这一趟，江湖要看你的了。」窗外雷声滚过，江南的雨落了整夜。',
    choices: [
      { label: '接令，召集群雄', effects: { chivalry: 5, silver: 60, items: ['盟主令'] }, next: 'c01' },
      { label: '推辞不受，只愿独行', effects: { wit: 5, qi: 5 }, next: 'c01' },
      { label: '把令牌交给苏挽保管', effects: { chivalry: 3 }, next: 'c01' },
    ],
  },

  // ───────────────── 第三章 · 风云际会 ─────────────────
  c01: {
    id: 'c01', chapter: 3, title: '雁荡会盟',
    text: '雁荡山下，三十六派旗号连成一片。有人敬你，有人冷眼，也有人躲在暗处数你身上的伤。魔教总坛的灯火就在绝顶，像一只睁着的眼睛，一夜未眨。',
    choices: [
      { label: '率众攻山', effects: { chivalry: 4, silver: -30 }, next: 'c02' },
      { label: '只带苏挽，轻装上山', effects: { wit: 5 }, next: 'c02' },
      { label: '先派探子，摸清虚实', effects: { silver: -20, wit: 6 }, next: 'c02' },
    ],
  },
  c02: {
    id: 'c02', chapter: 3, title: '总坛之下',
    text: '总坛石阶共九百九十九级，每一级都刻着一个死人的名字。阶顶坐着魔教教主殷无咎，脚边伏着一头通体乌黑的大犬。他看见你，笑了：「沈家的刀，终于磨利了。」',
    choices: [
      { label: '拔刀，不问废话', effects: { qi: 4 }, next: 'c03' },
      { label: '问他与沈家的旧怨', effects: { wit: 6 }, next: 'c03' },
      { label: '环顾四周，先寻退路', effects: { wit: 4, hp: 6 }, next: 'c03' },
    ],
  },
  c03: {
    id: 'c03', chapter: 3, title: '教主之邀',
    text: '殷无咎不怒，反手斟了两杯酒：「这江湖早已烂透。正道伪善，魔道真恶，都不如你我联手，重定规矩。」杯中酒色如血，映着你的脸，也映着殿外的刀光。',
    choices: [
      { label: '摔碎酒杯，拔刀相向', effects: { chivalry: 8 }, next: 'c05' },
      { label: '假意举杯，伺机一击', effects: { wit: 6, chivalry: -3 }, next: 'c04' },
      { label: '饮尽此酒，与他共谋', effects: { chivalry: -20, qi: 12, silver: 100 }, next: 'end-demon' },
    ],
  },
  c04: {
    id: 'c04', chapter: 3, title: '酒中之局',
    text: '你举杯未饮，苏挽自梁上跃下，一剑挑飞酒杯。酒液落地，青石滋滋作响。殷无咎抚掌大笑：「好一对痴男怨女。」殿外刀手已围了上来，退路只剩身后那扇窗。',
    choices: [
      { label: '与苏挽并肩杀出', effects: { hp: -10, chivalry: 6 }, next: 'c05' },
      { label: '让苏挽先走，独自断后', effects: { hp: -16, chivalry: 9 }, next: 'c05' },
      { label: '趁乱劫持殷无咎', effects: { wit: 6 }, next: 'c05' },
    ],
  },
  c05: {
    id: 'c05', chapter: 3, title: '绝顶决战',
    text: '绝顶风急，云在脚下翻涌。殷无咎的刀薄如蝉翼，出手时几乎听不见风声。苏挽在你身后，群雄在山腰。这一刀，你避不开，也不想避。',
    choices: [
      { label: '以命换命，硬撼三招', combat: { enemy: '殷无咎', difficulty: 72, win: 'c06', lose: 'c07', loseHp: 40 }, next: 'c06' },
      { label: '示弱诱敌，寻其破绽', combat: { enemy: '殷无咎', difficulty: 62, win: 'c06', lose: 'c07', loseHp: 30 }, next: 'c06' },
      { label: '掷刀认输，留得青山', effects: { chivalry: -6, hp: -10 }, next: 'c07' },
    ],
  },
  c06: {
    id: 'c06', chapter: 3, title: '云开见日',
    text: '殷无咎仰面倒在石阶上，血顺着九百九十九级台阶往下淌。群雄的呼声从山腰涌上来，苏挽扶着你的手臂，轻声问：「这一战之后，你要做什么？」',
    choices: [
      { label: '执盟主令，重整江湖', effects: { chivalry: 6 }, next: 'c08' },
      { label: '把令交回群雄，归隐山林', next: 'end-hermit' },
      { label: '坐上魔教之位，收编其众', effects: { chivalry: -10 }, next: 'end-demon' },
    ],
  },
  c07: {
    id: 'c07', chapter: 3, title: '败局',
    text: '你从绝顶滚落，被半山松枝挂住。殷无咎立在崖上，居高临下：「沈家的刀，不过如此。」你吐出一口血，握刀的手还在抖，山风把血腥味吹得很远。',
    choices: [
      { label: '燃尽内力，最后一搏', effects: { hp: -15, qi: -10 }, combat: { enemy: '殷无咎', difficulty: 68, win: 'c06', lose: 'end-death', loseHp: 40 }, next: 'c06' },
      { label: '接受他的招揽，入魔教', effects: { chivalry: -25 }, next: 'end-demon' },
      { label: '弃刀下山，从此隐姓埋名', effects: { hp: -20 }, next: 'end-hermit' },
    ],
  },
  c08: {
    id: 'c08', chapter: 3, title: '华山论剑',
    text: '三月后，华山之巅，三十六派重立盟约。按江湖规矩，盟主之位需过三问：一问侠义，二问悟性，三问手中刀。风把你的衣角吹得猎猎作响，所有人都在等你开口。',
    choices: [
      { label: '「江湖不是一个人的江湖。」', effects: { chivalry: 8 }, next: 'end-judge' },
      { label: '「刀在人在，规矩由我来定。」', effects: { chivalry: -4, qi: 4 }, next: 'end-judge' },
      { label: '「我志不在盟主。」', next: 'end-hermit' },
    ],
  },

  // ───────────────── 结局 ─────────────────
  'end-judge': {
    id: 'end-judge', chapter: 3, title: '华山之巅', ending: 'judge',
    text: '风停了。三十六派的旗帜在你身后一字排开，江湖等你给出最后一个答案。你握刀的手很稳，心里却浮起洛阳的雪、江南的雨，以及一路走来所有没有回头的地方。',
    choices: [],
  },
  'end-lord': {
    id: 'end-lord', chapter: 3, title: '武林盟主', ending: 'lord',
    text: '三十六派齐声唤你一声「盟主」。你把镇远刀插在华山石上，立下三条规矩：不欺弱，不助恶，不滥杀。江湖未必从此太平，但至少今夜，山巅的风是暖的。',
    choices: [],
  },
  'end-hermit': {
    id: 'end-hermit', chapter: 3, title: '归隐山林', ending: 'hermit',
    text: '你把盟主令放回清虚真人的灵前，转身下山。后来有人在江南见过一个撑伞的女子，和一个在渡口劈柴的汉子。说书人讲到这一节，总要添一句：不知他姓沈，还是姓什么。',
    choices: [],
  },
  'end-demon': {
    id: 'end-demon', chapter: 3, title: '堕入魔道', ending: 'demon',
    text: '你坐上总坛那张白骨椅，血手堂跪了一地。曾经的正道群雄成了刀下鬼，曾经的誓言成了酒后的笑话。江湖换了规矩，也换了主人；只是每逢雨夜，你仍会梦见洛阳那半座旧宅。',
    choices: [],
  },
  'end-death': {
    id: 'end-death', chapter: 3, title: '身死道消', ending: 'death',
    text: '刀落在石阶上，声音很轻。你想起青牛村的雪、洛阳的灯、江南的雨，想起那些本可以说出口却没说的话。江湖照旧热闹，只是从此再无人记得你的名字。',
    choices: [],
  },
};

const ORIGINS: Origin[] = [
  {
    key: 'noble', name: '名门之后', emoji: '🏮', node: 'o-noble',
    desc: '「镇远刀」沈家唯一的香火。祖宅半塌，旧部尚在，你比旁人多一分见识，也多一分不能低头的傲气。',
    hp: 88, maxHp: 90, qi: 38, wit: 52, chivalry: 34, silver: 120, items: ['柳叶刀'],
  },
  {
    key: 'orphan', name: '山野孤儿', emoji: '🌲', node: 'o-orphan',
    desc: '青牛村猎户养大的野孩子。不懂礼数，却懂山中规矩；一身筋骨是石头里磨出来的。',
    hp: 78, maxHp: 85, qi: 26, wit: 42, chivalry: 52, silver: 8, items: ['柴刀'],
  },
  {
    key: 'escort', name: '镖局趟子手', emoji: '🐎', node: 'o-escort',
    desc: '威远镖局走了七年镖，刀口上讨生活。皮糙肉厚，见过世面，也见过镖旗倒下时没人替你收尸。',
    hp: 102, maxHp: 110, qi: 30, wit: 34, chivalry: 40, silver: 60, items: ['青铜剑'],
  },
];

/** 开局可选头像（人头），沿用人物立绘 */
const AVATARS: { key: string; label: string }[] = [
  { key: 'quan', label: '拳师' },
  { key: 'jian', label: '剑客' },
  { key: 'dao', label: '刀客' },
  { key: '苏挽', label: '侠女' },
];

/** 骰子随机名 */
const NAME_POOL = ['沈听澜', '顾见山', '洛惊鸿', '皮冷雁', '燕回', '石敢当', '阿蛮', '温良玉'];

// ──────────────────────────── 武学：秘籍（剑拳刀）+ 内功（D~S） ────────────────────────────

type Grade = 'D' | 'C' | 'B' | 'A' | 'S';

const GRADE_INDEX: Record<Grade, number> = { D: 0, C: 1, B: 2, A: 3, S: 4 };
const GRADE_PRICE: Record<Grade, number> = { D: 60, C: 130, B: 240, A: 400, S: 650 };
const GRADE_STYLE: Record<Grade, string> = {
  D: 'border-line text-muted',
  C: 'border-success/50 text-success',
  B: 'border-accent/50 text-accent',
  A: 'border-warning/50 text-warning',
  S: 'border-danger/60 text-danger',
};

/** 秘籍：只对同流派生效，提升伤害 */
type Manual = { id: string; name: string; school: SchoolKey; grade: Grade; atk: number; desc: string };

const MANUALS: Manual[] = [
  { id: 'mq-d', name: '太祖长拳', school: 'quan', grade: 'D', atk: 0.06, desc: '入门拳架，朴实无华，拳路却极正，一招一式都落在空处之外。' },
  { id: 'mq-c', name: '罗汉伏虎拳', school: 'quan', grade: 'C', atk: 0.12, desc: '少林外家拳，拳出如锤，寸劲入骨。' },
  { id: 'mq-b', name: '般若金刚掌', school: 'quan', grade: 'B', atk: 0.19, desc: '掌缘如刀，五指并拢劈下，隔着一层皮肉震碎内里。' },
  { id: 'mq-a', name: '大摔碑手', school: 'quan', grade: 'A', atk: 0.26, desc: '挟风雷之势，抓、摔、砸三变，最难闪避。' },
  { id: 'mq-s', name: '降龙十八掌', school: 'quan', grade: 'S', atk: 0.35, desc: '至刚至阳，一掌落下，如龙吟出渊。' },
  { id: 'mj-d', name: '青萍剑法', school: 'jian', grade: 'D', atk: 0.06, desc: '剑走轻灵，平平一刺，快得看不清。' },
  { id: 'mj-c', name: '回风拂柳剑', school: 'jian', grade: 'C', atk: 0.12, desc: '剑随身转，回风拂柳，攻守相隔一线。' },
  { id: 'mj-b', name: '两仪剑法', school: 'jian', grade: 'B', atk: 0.19, desc: '阴阳两仪，一剑化二，剑尖总在你料不到的方向。' },
  { id: 'mj-a', name: '夺命十三剑', school: 'jian', grade: 'A', atk: 0.26, desc: '十三剑连出，只留一剑见血。' },
  { id: 'mj-s', name: '独孤九剑', school: 'jian', grade: 'S', atk: 0.35, desc: '无招胜有招，破尽天下兵刃。' },
  { id: 'md-d', name: '五虎断门刀', school: 'dao', grade: 'D', atk: 0.06, desc: '刀走直线，五刀连环，招式粗莽，力沉如闸。' },
  { id: 'md-c', name: '血战八方', school: 'dao', grade: 'C', atk: 0.12, desc: '刀锋外翻，一路劈砍，越战越狠。' },
  { id: 'md-b', name: '狂风快刀', school: 'dao', grade: 'B', atk: 0.19, desc: '快得只剩刀光，风声未落，刀已收。' },
  { id: 'md-a', name: '修罗刀法', school: 'dao', grade: 'A', atk: 0.26, desc: '一刀断人退路，中者九死一生。' },
  { id: 'md-s', name: '天地一刀斩', school: 'dao', grade: 'S', atk: 0.35, desc: '只此一刀，天地为之一静。' },
];

/** 内功：加攻击力 + 每次调息回复气血 */
type Inner = { id: string; name: string; grade: Grade; atk: number; regen: number; desc: string };

const INNERS: Inner[] = [
  { id: 'in-d', name: '吐纳法', grade: 'D', atk: 0.0, regen: 2, desc: '最粗浅的呼吸法门，运功片刻即可缓过一口气。' },
  { id: 'in-c', name: '小无相功', grade: 'C', atk: 0.04, regen: 3, desc: '以柔化刚，行气如流水，拳脚自轻三分。' },
  { id: 'in-b', name: '龟息功', grade: 'B', atk: 0.07, regen: 5, desc: '气沉丹田，息若游丝，久战不疲。' },
  { id: 'in-a', name: '易筋经', grade: 'A', atk: 0.10, regen: 8, desc: '洗髓换骨，筋骨一新，伤处自愈。' },
  { id: 'in-s', name: '九阳神功', grade: 'S', atk: 0.15, regen: 12, desc: '至阳真气自涌动，气息不绝，百战不竭。' },
];

const manualOf = (hero: Hero) => MANUALS.find((m) => m.id === hero.manualId) ?? null;
const innerOf = (hero: Hero) => INNERS.find((i) => i.id === hero.innerId) ?? null;

// ──────────────────────────── 江湖行程：洛阳 → 襄阳 → 西安 → 燕京 → 华山 ────────────────────────────

type Town = { key: string; name: string; grade: Grade; enemy: string; diff: number; desc: string; reward: string };

const TOWNS: Town[] = [
  { key: 'luoyang', name: '洛阳', grade: 'D', enemy: '黑塔', diff: 4, desc: '九朝古都，街市喧闹，城西乱葬岗常有悍匪出没。', reward: 'D 级武学' },
  { key: 'xiangyang', name: '襄阳', grade: 'C', enemy: '铁拳门主', diff: 10, desc: '南北要冲，城墙高厚，校场上终日有人比拳。', reward: 'C 级武学' },
  { key: 'xian', name: '西安', grade: 'B', enemy: '血手堂杀手', diff: 16, desc: '旧都长安，坊市深巷，夜里有人卖命也有人买命。', reward: 'B 级武学' },
  { key: 'yanjing', name: '燕京', grade: 'A', enemy: '血手堂杀手', diff: 23, desc: '天子脚下，王侯门前，刀客比官府更管用。', reward: 'A 级武学' },
  { key: 'huashan', name: '华山', grade: 'S', enemy: '殷无咎', diff: 30, desc: '西岳险绝，论剑台上旧痕未消，胜者留名。', reward: 'S 级武学' },
];

const EVENTS: RandomEvent[] = [
  {
    id: 'beggar', title: '破衣乞丐',
    text: '巷口的乞丐拦住你，捧着只豁口破碗，指节冻得发青。他不说可怜，只说：「赏口饭，也赏个体面。」',
    choices: [
      { label: '给一锭银子', effects: { silver: -15, chivalry: 5 } },
      { label: '买两个热包子', effects: { silver: -3, chivalry: 2, hp: 3 } },
      { label: '侧身走过', effects: { chivalry: -2 } },
    ],
  },
  {
    id: 'bandit', title: '黑风劫匪',
    text: '山道拐弯处跳出三条汉子，蒙面布都洗得发白。领头者把刀往地上一插：「此路是我开。识相的，留下买路钱。」',
    choices: [
      { label: '拔刀，教他们做人', effects: { hp: -8, chivalry: 4, silver: 25 } },
      { label: '丢下碎银，破财免灾', effects: { silver: -20 } },
      { label: '亮出名号，喝退他们', effects: { wit: 3, chivalry: 2 } },
    ],
  },
  {
    id: 'oldman', title: '神秘老人',
    text: '桥头坐着个蓑衣老人，脚边一篓活鱼，手里却拿着本无字书。他翻了一页，忽然问你：「娃娃，你说江湖是水，还是刀？」',
    choices: [
      { label: '答「江湖是水」', effects: { wit: 5, qi: 3 } },
      { label: '答「江湖是刀」', effects: { qi: 4, chivalry: -1 } },
      { label: '不答，替他提鱼篓', effects: { chivalry: 4, hp: 4 } },
    ],
  },
  {
    id: 'storyteller', title: '客栈听书',
    text: '客栈里说书人惊醒木一拍，正说到当年沈家血案。满堂客人听得入神，没人留意你的脸色。说到「沈家满门，只逃出一个孩子」时，他忽然朝你这边看了一眼。',
    choices: [
      { label: '点一壶茶，安静听完', effects: { silver: -6, wit: 4 } },
      { label: '拍桌追问下文', effects: { chivalry: 2, wit: 3 } },
      { label: '起身离席', effects: { chivalry: -2 } },
    ],
  },
  {
    id: 'herbgirl', title: '采药姑娘',
    text: '山路上有个采药姑娘崴了脚，竹篓里的草药撒了满地。她急得快哭：「这是给娘治病的药。」',
    choices: [
      { label: '背她下山，再帮她采齐', effects: { hp: -4, chivalry: 7, items: ['金创药'] } },
      { label: '替她捡药，指条近路', effects: { chivalry: 3, items: ['金创药'] } },
      { label: '递些碎银，不做停留', effects: { silver: -10, chivalry: 1 } },
    ],
  },
  {
    id: 'shop', title: '山间野店',
    text: '山间野店只挂一盏纸灯，掌柜是个独眼汉子，柜台后摆着几瓶伤药。他见你一身风尘，咧嘴笑：「客官，命比银子贵。」',
    choices: [
      { label: '买一瓶金创药', effects: { silver: -15, hp: 20, items: ['金创药'] } },
      { label: '买一壶烧酒，暖暖身子', effects: { silver: -6, hp: 8 } },
      { label: '摆手谢过，继续赶路', effects: { chivalry: 1 } },
    ],
  },
  {
    id: 'drunk', title: '醉汉挑衅',
    text: '酒楼门口，一个醉汉撞了你满怀，反手揪住你的衣领：「走路不长眼？给爷磕个头，爷便饶你。」他身后几个同伴已经围拢。',
    choices: [
      { label: '拱手赔礼，退开一步', effects: { chivalry: 4 } },
      { label: '一拳撂倒，扬长而去', effects: { hp: -5, chivalry: -4, silver: 20 } },
      { label: '任他骂两句，转身进店', effects: { wit: 2, hp: -2 } },
    ],
  },
  {
    id: 'guqin', title: '夜半琴声',
    text: '夜宿荒祠，忽闻隔墙有琴。曲子清冷，像雪落在刀背上。你循声过去，只看见一张琴、一炉香，弹琴的人已不见踪影。',
    choices: [
      { label: '静坐听完，学其指法', effects: { wit: 6, qi: 4 } },
      { label: '取走琴边那本琴谱', effects: { silver: 20, chivalry: -3, items: ['无名琴谱'] } },
      { label: '添一炷香，回房歇息', effects: { hp: 8, chivalry: 2 } },
    ],
  },
  {
    id: 'gamble', title: '镇口赌坊',
    text: '镇口赌坊灯火通明，庄家摇着骰盅唱：「买定离手，生死不论。」你囊中有些碎银，也有几分不服气。',
    choices: [
      { label: '小赌一把，见好就收', effects: { silver: 25, chivalry: -2 } },
      { label: '替输光的少年赎回玉佩', effects: { silver: -20, chivalry: 6 } },
      { label: '掀了赌桌', effects: { hp: -6, chivalry: 3, silver: 10 } },
    ],
  },
  {
    id: 'veteran', title: '老兵赠刀',
    text: '驿道边坐着个断臂老兵，面前摆着三柄旧刀。他说要去北边投亲，刀带不走，谁肯替他给阵亡弟兄烧炷香，刀便归谁。',
    choices: [
      { label: '应下这事，焚香三炷', effects: { silver: -5, chivalry: 4, items: ['柳叶刀'] } },
      { label: '用银子买刀', effects: { silver: -30, items: ['柳叶刀'] } },
      { label: '婉言谢绝', effects: { wit: 1 } },
    ],
  },
  {
    id: 'roadblock', title: '拦路悍匪',
    text: '一柄缺口砍刀横在你面前，山贼头目吐掉嘴里的草根：「想从这过？先问问我这刀答不答应。」身后十几条人影已经慢慢围上来。',
    choices: [
      { label: '拔刀接下这一战', combat: { enemy: '山贼头目', difficulty: 6, win: '', lose: '' } },
      { label: '丢下银两，绕道而行', effects: { silver: -18, chivalry: -1 } },
      { label: '报出狠话，赌他不敢动', effects: { wit: 2, chivalry: 3, hp: -3 } },
    ],
  },
  {
    id: 'qingcheng', title: '青城试剑',
    text: '青城山脚下，一名年轻弟子横剑拦路：「听闻这一路刀客不少，可敢与我试三招？」他剑未出鞘，脚下已站稳了门户。',
    choices: [
      { label: '接下试剑，点到为止', combat: { enemy: '青城弟子', difficulty: 10, win: '', lose: '' } },
      { label: '拱手称不如，绕路走开', effects: { chivalry: -1, wit: 1 } },
      { label: '与他论剑，不动刀兵', effects: { wit: 5, qi: 2 } },
    ],
  },
  {
    id: 'oneeye', title: '独眼看店',
    text: '客栈里，独眼掌柜把抹布往肩上一搭，冷眼看你：「住店先交钱。瞧你身上那点银子，不够买我这一拳。」他把拳头捏得咯咯响。',
    choices: [
      { label: '拍案而起，教他认人', combat: { enemy: '独眼掌柜', difficulty: 12, win: '', lose: '' } },
      { label: '老老实实付账', effects: { silver: -12, hp: 6 } },
      { label: '帮他劈柴抵账', effects: { hp: -3, chivalry: 3, items: ['金创药'] } },
    ],
  },
];

const CHAPTER_LABELS: Record<Chapter, string> = {
  1: '第一章 · 初入江湖',
  2: '第二章 · 名动一方',
  3: '第三章 · 风云际会',
};

const ENDINGS: Record<EndingKey, { title: string; text: string; tone: string }> = {
  lord: {
    title: '武林盟主',
    text: '你受群雄拥戴，执盟主令号令三十六派。登位那日，你没有穿锦袍，只把那柄镇远刀横在膝上，让所有人在刀前立誓：不欺弱，不助恶，不滥杀。江湖从此有了规矩，而规矩的第一笔，写的是你的名字。',
    tone: 'text-success border-success/40 bg-success/10',
  },
  hermit: {
    title: '归隐山林',
    text: '你终究没有坐上那张盟主椅。江南的雨、山中的柴、渡口的船，都比盟主令更合你的性子。多年后有人问起当年雁荡绝顶那一战，你只笑笑，把新酿的酒添满来客的碗。',
    tone: 'text-accent border-accent/40 bg-accent/10',
  },
  demon: {
    title: '堕入魔道',
    text: '你成了江湖新的噩梦。正道骂你，魔道怕你，说书人提到你的名字要先压低嗓子。你得到了整个江湖，却再没有一个可以安心喝酒的夜晚。',
    tone: 'text-danger border-danger/40 bg-danger/10',
  },
  death: {
    title: '身死道消',
    text: '血落在青石上，很快被雨冲淡。你的刀被人捡走，你的名字被人说了一遍，然后忘了。江湖仍然热闹，只是从此少了一个本该走到最后的人。',
    tone: 'text-warning border-warning/40 bg-warning/10',
  },
};

// ──────────────────────────── 纯函数 ────────────────────────────

/** 按物品自动填入空装备槽（开局与读档时用） */
function autoEquipGear(items: string[]): Equipped {
  const equipped: Equipped = { weapon: null, armor: null, accessory: null };
  for (const item of items) {
    const gear = GEAR[item];
    if (gear && !equipped[gear.slot]) equipped[gear.slot] = item;
  }
  return equipped;
}

function makeHero(origin: Origin, school: SchoolKey): Hero {
  return {
    origin: origin.name,
    school,
    hp: origin.hp,
    maxHp: origin.maxHp,
    qi: origin.qi,
    wit: origin.wit,
    chivalry: origin.chivalry,
    silver: origin.silver,
    items: [...origin.items],
    equipped: autoEquipGear(origin.items),
    level: 1,
    exp: 0,
    manualId: null,
    innerId: null,
  };
}

/** 升到下一级所需经验 */
function expNeed(level: number): number {
  return 60 + (level - 1) * 45;
}

/**
 * 离线挂机：按真实经过时间折算经验与银两，最多累计 12 小时。
 * 速率刻意压低——挂一夜约等于手动二十来分钟的收益（原作设定）。
 */
const IDLE_CAP_MIN = 720;
function idleGain(minutes: number): { exp: number; silver: number } {
  const m = clamp(minutes, 0, IDLE_CAP_MIN);
  return { exp: Math.floor(m * 0.15), silver: Math.floor(m * 0.22) };
}

/** 当前战力倍率：等级 + 装备 + 同流派秘籍 + 内功 */
function heroPower(hero: Hero): number {
  const manual = MANUALS.find((m) => m.id === hero.manualId);
  const inner = INNERS.find((i) => i.id === hero.innerId);
  let mul = 1 + (hero.level - 1) * 0.05 + gearBonus(hero) / 40;
  if (manual && manual.school === hero.school) mul += manual.atk;
  if (inner) mul += inner.atk;
  return mul;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** 纯函数：所有属性增减、物品得失都经由这里，不直接改原对象 */
function applyEffects(hero: Hero, effects?: Effects): Hero {
  if (!effects) return hero;
  const items = [...hero.items];
  for (const item of effects.items ?? []) {
    // 药品按数量叠放；装备与信物只留一件
    if (STACKABLE.has(item) || !items.includes(item)) items.push(item);
  }
  for (const item of effects.removeItems ?? []) {
    const index = items.indexOf(item);
    if (index >= 0) items.splice(index, 1);
  }
  return {
    ...hero,
    hp: clamp(hero.hp + (effects.hp ?? 0), 0, hero.maxHp),
    qi: clamp(hero.qi + (effects.qi ?? 0), 0, 100),
    wit: clamp(hero.wit + (effects.wit ?? 0), 0, 100),
    chivalry: clamp(hero.chivalry + (effects.chivalry ?? 0), 0, 100),
    silver: Math.max(0, hero.silver + (effects.silver ?? 0)),
    items,
  };
}

function decideEnding(hero: Hero): EndingKey {
  if (hero.hp <= 0) return 'death';
  if (hero.chivalry < 28) return 'demon';
  if (hero.chivalry >= 60 && hero.wit >= 52 && hero.hp >= 40) return 'lord';
  return 'hermit';
}

function effectHints(effects?: Effects): { text: string; tone: string }[] {
  if (!effects) return [];
  const hints: { text: string; tone: string }[] = [];
  const pushStat = (label: string, value?: number) => {
    if (typeof value === 'number' && value !== 0) {
      hints.push({ text: `${label} ${value > 0 ? '+' : ''}${value}`, tone: value > 0 ? 'text-success' : 'text-danger' });
    }
  };
  pushStat('气血', effects.hp);
  pushStat('内力', effects.qi);
  pushStat('悟性', effects.wit);
  pushStat('侠义', effects.chivalry);
  pushStat('银两', effects.silver);
  for (const item of effects.items ?? []) hints.push({ text: `得「${item}」`, tone: 'text-accent' });
  for (const item of effects.removeItems ?? []) hints.push({ text: `失「${item}」`, tone: 'text-danger' });
  return hints;
}

const LOG_TONE: Record<LogTone, string> = {
  info: 'text-muted',
  win: 'text-success',
  lose: 'text-danger',
  event: 'text-warning',
};

// ──────────────────────────── 战斗 ────────────────────────────

type StrikeResult = { dmg: number; kind: 'hit' | 'dodge' | 'parry'; crit?: boolean };

/** 一次出手：先判闪避（看防守方悟性+攻击方流派），再判招架（看防守方内力+攻击方流派），最后算伤害；打实了还可能出会心 */
function strike(
  atkSchool: SchoolKey,
  atkQi: number,
  atkWit: number,
  powerMul: number,
  defWit: number,
  defQi: number,
  critBonus = 0,
): StrikeResult {
  const s = SCHOOLS[atkSchool];
  const roll = Math.random() * 100;
  if (roll < dodgeChance(defWit, atkSchool)) return { dmg: 0, kind: 'dodge' };
  const base = randInt(s.dmgMin, s.dmgMax) * powerMul * (1 + atkQi / 120);
  if (roll < dodgeChance(defWit, atkSchool) + parryChance(defQi, atkSchool)) {
    return { dmg: Math.max(1, Math.round(base * 0.35)), kind: 'parry' };
  }
  const crit = Math.random() * 100 < clamp(critChance(atkWit) + critBonus, 8, 60);
  return { dmg: Math.max(1, Math.round(base * (crit ? 1.6 : 1))), kind: 'hit', crit };
}

/** 流血：剩余回合与每回合掉血 */
type Bleed = { rounds: number; dmg: number };

/** 刀法命中后有几率撕裂皮肉：两回合流血，普通 3 点、会心 5 点 */
function bleedFrom(school: SchoolKey, result: StrikeResult): Bleed | null {
  if (school !== 'dao' || result.kind !== 'hit') return null;
  if (Math.random() * 100 >= 30) return null;
  return { rounds: 2, dmg: result.crit ? 5 : 3 };
}

type BattleState = {
  combat: Combat;
  enemyDef: EnemyDef;
  enemyHp: number;
  enemyMaxHp: number;
  playerHp: number;
  round: number;
  over: null | 'win' | 'lose';
  enemyBleed: Bleed | null;
  playerBleed: Bleed | null;
  /** 眩晕剩余出手次数：大于 0 时该方本回合只能挨打 */
  playerStun: number;
  enemyStun: number;
  lines: LogEntry[];
};

/** 战斗飘字/命中特效：side 表示特效落在哪一方 */
type FxEvent = {
  id: number;
  side: 'player' | 'enemy';
  text: string;
  tone: 'dmg' | 'crit' | 'heal' | 'dodge' | 'parry';
};

/** 已装备物品提供的战力（未装备的行囊物品不加成） */
function gearBonus(hero: Hero): number {
  return SLOT_LABELS.reduce((sum, { slot }) => {
    const name = hero.equipped[slot];
    return sum + (name ? GEAR[name]?.power ?? 0 : 0);
  }, 0);
}

/** 某物品在行囊中的数量 */
function itemCount(hero: Hero, name: string): number {
  return hero.items.filter((item) => item === name).length;
}

/** 行囊按名称聚合：消耗品显示数量，装备与杂项各一件 */
function groupItems(items: string[]): { name: string; count: number }[] {
  const groups: { name: string; count: number }[] = [];
  for (const item of items) {
    const hit = groups.find((g) => g.name === item);
    if (hit) hit.count += 1;
    else groups.push({ name: item, count: 1 });
  }
  return groups;
}

function strikeText(
  who: 'player' | 'enemy',
  name: string,
  school: SchoolKey,
  result: StrikeResult,
): { text: string; tone: LogTone } {
  const s = SCHOOLS[school];
  if (result.kind === 'dodge') {
    return {
      text: who === 'player'
        ? `你递出一招${s.name}，${name}侧身闪开了`
        : `${name}一招${s.name}袭来，你侧身闪开`,
      tone: who === 'player' ? 'lose' : 'win',
    };
  }
  if (result.kind === 'parry') {
    return {
      text: who === 'player'
        ? `你的${s.name}被${name}架住，只震伤他 ${result.dmg} 点`
        : `你抬手架住${name}的${s.name}，仍被震伤 ${result.dmg} 点`,
      tone: 'event',
    };
  }
  if (result.crit) {
    return {
      text: who === 'player'
        ? `你的${s.name}直取${name}要害，会心一击！造成 ${result.dmg} 点伤害`
        : `${name}的${s.name}直取你要害，会心一击！你受 ${result.dmg} 点伤`,
      tone: who === 'player' ? 'win' : 'lose',
    };
  }
  return {
    text: who === 'player'
      ? `你的${s.name}正中${name}，造成 ${result.dmg} 点伤害`
      : `${name}的${s.name}击中你，受 ${result.dmg} 点伤`,
    tone: who === 'player' ? 'win' : 'lose',
  };
}

// ──────────────────────────── 头像组件（人头，带 emoji 兜底） ────────────────────────────

function Portrait({ name, size, ring }: { name: string; size: number; ring?: string }) {
  const [failed, setFailed] = useState(false);
  const url = PORTRAITS[name];
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border-2 bg-surface-raised ${ring ?? 'border-line'}`}
      style={{ width: size, height: size }}
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center" style={{ fontSize: size * 0.5 }}>
          {name in SCHOOLS ? SCHOOLS[name as SchoolKey].emoji : '🗡️'}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── 主组件 ────────────────────────────

export function JianghuGame() {
  const [phase, setPhase] = useState<'origin' | 'school' | 'play' | 'end'>('origin');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [avatarKey, setAvatarKey] = useState('quan');
  const [playerName, setPlayerName] = useState(NAME_POOL[0]);
  const [originKey, setOriginKey] = useState<string | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [nodeId, setNodeId] = useState('o-noble');
  const [event, setEvent] = useState<{ ev: RandomEvent; next: string } | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [endingKey, setEndingKey] = useState<EndingKey | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [panel, setPanel] = useState<null | 'martial' | 'town' | 'bag'>(null);
  const [cleared, setCleared] = useState<string[]>([]);
  const [saveData, setSaveData] = useState<SaveData | null>(null);
  /** 读档时算出的离线挂机收益，供开局界面展示 */
  const [idlePreview, setIdlePreview] = useState<{ minutes: number; exp: number; silver: number } | null>(null);
  const logSeq = useRef(0);
  const travelCount = useRef(0);
  const battleSeq = useRef(0);
  const fxSeq = useRef(0);
  const prevChapterRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const battleLogRef = useRef<HTMLDivElement>(null);
  const [battleFx, setBattleFx] = useState<FxEvent[]>([]);
  const [chapterIntro, setChapterIntro] = useState<{ chapter: Chapter; key: number } | null>(null);

  /** 战斗飘字：加入后 0.78s 自动清除 */
  const addFx = (events: Omit<FxEvent, 'id'>[]) => {
    if (events.length === 0) return;
    const withId = events.map((e) => ({ ...e, id: (fxSeq.current += 1) }));
    setBattleFx((prev) => [...prev, ...withId]);
    const ids = new Set(withId.map((e) => e.id));
    setTimeout(() => {
      setBattleFx((prev) => prev.filter((e) => !ids.has(e.id)));
    }, 780);
  };

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, showLog]);

  useEffect(() => {
    const el = battleLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [battle?.lines]);

  // 章节切换时播放电影感过场卡
  useEffect(() => {
    if (phase !== 'play' && phase !== 'end') return;
    const current = NODES[nodeId];
    if (!current || current.chapter === prevChapterRef.current) return;
    prevChapterRef.current = current.chapter;
    setChapterIntro({ chapter: current.chapter, key: Date.now() });
    const timer = setTimeout(() => setChapterIntro(null), 1900);
    return () => clearTimeout(timer);
  }, [nodeId, phase]);

  // 进入页面时读档，供开局界面显示「继续上次」
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as SaveData;
      if (data && data.v === 1 && data.hero && NODES[data.nodeId]) {
        setSaveData(data);
        // 离线挂机：按存档时间到现在折算，读档时发放
        const minutes = data.lastIdle ? (Date.now() - data.lastIdle) / 60000 : 0;
        const gain = idleGain(minutes);
        if (minutes >= 1 && (gain.exp > 0 || gain.silver > 0)) {
          setIdlePreview({ minutes: Math.floor(minutes), ...gain });
        }
      }
    } catch {
      // 存档损坏或不可读时当作没有存档
    }
  }, []);

  // 主界面自动存档：战斗与奇遇的临时局面不入档
  useEffect(() => {
    if (phase !== 'play' || !hero || battle) return;
    const data: SaveData = {
      v: 1,
      playerName,
      avatarKey,
      originKey: originKey ?? '',
      hero,
      nodeId,
      cleared,
      lastIdle: Date.now(),
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // 存储不可用时静默跳过
    }
  }, [phase, hero, nodeId, cleared, battle, playerName, avatarKey, originKey]);

  // 走到结局即清档，避免读档回到结局前一幕
  useEffect(() => {
    if (phase !== 'end') return;
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // 忽略存储异常
    }
    setSaveData(null);
  }, [phase]);

  const pushLog = (text: string, tone: LogTone = 'info') => {
    logSeq.current += 1;
    const entry: LogEntry = { id: logSeq.current, text, tone };
    setLogs((prev) => [...prev, entry].slice(-80));
  };

  // ——— 开局 ———

  const cycleAvatar = (dir: 1 | -1) => {
    const i = AVATARS.findIndex((a) => a.key === avatarKey);
    setAvatarKey(AVATARS[(i + dir + AVATARS.length) % AVATARS.length].key);
  };

  const rollName = () => {
    setPlayerName(NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]);
  };

  const pickOrigin = (o: Origin) => {
    setOrigin(o);
    setPhase('school');
  };

  const pickSchool = (school: SchoolKey) => {
    if (!origin) return;
    const h = makeHero(origin, school);
    setHero(h);
    setNodeId(origin.node);
    setPhase('play');
    setEvent(null);
    setBattle(null);
    setEndingKey(null);
    setPanel(null);
    setCleared([]);
    travelCount.current = 0;
    logSeq.current = 2;
    setLogs([
      { id: 1, text: `「${playerName}」以「${origin.name}」的身份踏入江湖，主修${SCHOOLS[school].name}。`, tone: 'event' },
      { id: 2, text: `${CHAPTER_LABELS[NODES[origin.node].chapter]} · ${NODES[origin.node].title}`, tone: 'info' },
    ]);
  };

  const clearSave = () => {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // 忽略存储异常
    }
    setSaveData(null);
  };

  /** 读档回到主界面：战斗与奇遇不恢复，节点重新抉择 */
  const continueSave = () => {
    if (!saveData) return;
    const saved = saveData.hero;
    const restored: Hero = {
      ...saved,
      items: Array.isArray(saved.items) ? saved.items : [],
      equipped: {
        weapon: saved.equipped?.weapon ?? null,
        armor: saved.equipped?.armor ?? null,
        accessory: saved.equipped?.accessory ?? null,
      },
    };
    // 离线挂机结算：先补经验与银两，再进入江湖
    const gain = idlePreview;
    let resumed = restored;
    if (gain && (gain.exp > 0 || gain.silver > 0)) {
      resumed = grantExp({ ...restored, silver: restored.silver + gain.silver }, gain.exp);
    }
    setPlayerName(saveData.playerName);
    setAvatarKey(saveData.avatarKey);
    setOriginKey(saveData.originKey || null);
    setHero(resumed);
    setNodeId(saveData.nodeId);
    setCleared(saveData.cleared ?? []);
    setPhase('play');
    setEvent(null);
    setBattle(null);
    setEndingKey(null);
    setPanel(null);
    travelCount.current = 0;
    logSeq.current = 1;
    setLogs([{ id: 1, text: `续接江湖录 · ${NODES[saveData.nodeId].title}`, tone: 'info' }]);
    if (gain && (gain.exp > 0 || gain.silver > 0)) {
      pushLog(
        `【挂机】离开的 ${gain.minutes} 分钟里你未曾停歇：得经验 ${gain.exp}、银两 ${gain.silver}${
          resumed.level > restored.level ? `，境界提升至 ${resumed.level} 级` : ''
        }`,
        'event',
      );
    }
    setIdlePreview(null);
    setSaveData(null);
  };

  const restart = () => {
    clearSave();
    setPhase('origin');
    setOrigin(null);
    setOriginKey(null);
    setHero(null);
    setNodeId('o-noble');
    setEvent(null);
    setBattle(null);
    setEndingKey(null);
    setPanel(null);
    setCleared([]);
    setLogs([]);
    travelCount.current = 0;
    logSeq.current = 0;
    prevChapterRef.current = 0;
    setBattleFx([]);
    setChapterIntro(null);
  };

  // ——— 剧情推进 ———

  const enter = (id: string, nextHero: Hero) => {
    setHero(nextHero);
    if (nextHero.hp <= 0) {
      setPhase('end');
      setEndingKey('death');
      setEvent(null);
      setBattle(null);
      pushLog('气血耗尽，眼前一黑，江湖到此为止。', 'lose');
      return;
    }
    const node = NODES[id];
    if (!node) return;
    setNodeId(id);
    pushLog(`— ${node.title} —`, 'info');
    if (node.ending === 'judge') {
      setPhase('end');
      setEndingKey(decideEnding(nextHero));
      return;
    }
    if (node.ending) {
      setPhase('end');
      setEndingKey(node.ending);
    }
  };

  const choose = (choice: Choice) => {
    if (!hero) return;
    if (choice.combat) {
      startBattle(choice.combat);
      return;
    }
    const hinted = effectHints(choice.effects).map((h) => h.text).join('，');
    pushLog(`▸ ${choice.label}${hinted ? `（${hinted}）` : ''}`, 'event');
    const next = applyEffects(hero, choice.effects);
    // 25% 概率触发江湖奇遇（结局节点除外）
    const target = NODES[choice.next];
    travelCount.current += 1;
    if (target && !target.ending && Math.random() < 0.25 && travelCount.current > 1) {
      const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      setEvent({ ev, next: choice.next });
      return;
    }
    enter(choice.next, next);
  };

  const chooseEvent = (choice: EventChoice) => {
    if (!hero || !event) return;
    const hinted = effectHints(choice.effects).map((h) => h.text).join('，');
    pushLog(`【奇遇·${event.ev.title}】${choice.label}${hinted ? `（${hinted}）` : ''}`, 'event');
    if (choice.combat) {
      // 奇遇动武：胜败都回到原剧情节点，胜负只影响气血与经验
      setEvent(null);
      startBattle({ ...choice.combat, win: event.next, lose: event.next });
      return;
    }
    const next = applyEffects(hero, choice.effects);
    setEvent(null);
    enter(event.next, next);
  };

  // ——— 战斗 ———

  /** 发经验：够数就连升，升级加气血上限与内力，并回满气血 */
  const grantExp = (h: Hero, amount: number): Hero => {
    let level = h.level;
    let exp = h.exp + amount;
    let maxHp = h.maxHp;
    let qi = h.qi;
    let ups = 0;
    while (exp >= expNeed(level)) {
      exp -= expNeed(level);
      level += 1;
      maxHp += 10;
      qi = Math.min(100, qi + 3);
      ups += 1;
    }
    if (ups > 0) {
      pushLog(`【升级】境界提升至 ${level} 级：气血上限 ${maxHp}，内力 ${qi}`, 'win');
    } else {
      pushLog(`【历练】得 ${amount} 点经验（${exp}/${expNeed(level)}）`, 'info');
    }
    return { ...h, level, exp, maxHp, qi, hp: ups > 0 ? maxHp : h.hp };
  };

  /** 城镇挑战：打赢按城镇等级发秘籍 + 内功，不推进剧情 */
  const startTownBattle = (t: Town) => {
    setPanel(null);
    startBattle({ enemy: t.enemy, difficulty: t.diff, win: nodeId, lose: nodeId, town: t.key });
  };

  const learnManual = (m: Manual) => {
    if (!hero) return;
    const cur = manualOf(hero);
    if (cur && GRADE_INDEX[cur.grade] >= GRADE_INDEX[m.grade]) {
      pushLog(`已习得同级或更高的${SCHOOLS[hero.school].name}秘籍，无需再学《${m.name}》`, 'lose');
      return;
    }
    if (hero.silver < GRADE_PRICE[m.grade]) {
      pushLog(`银两不足（需 ${GRADE_PRICE[m.grade]}，现有 ${hero.silver}）`, 'lose');
      return;
    }
    setHero({ ...hero, silver: hero.silver - GRADE_PRICE[m.grade], manualId: m.id });
    pushLog(`【秘籍】研习《${m.name}》（${m.grade} 级），伤害 +${Math.round(m.atk * 100)}%`, 'win');
  };

  const learnInner = (i: Inner) => {
    if (!hero) return;
    const cur = innerOf(hero);
    if (cur && GRADE_INDEX[cur.grade] >= GRADE_INDEX[i.grade]) {
      pushLog(`已修成同级或更高的内功，无需再练《${i.name}》`, 'lose');
      return;
    }
    if (hero.silver < GRADE_PRICE[i.grade]) {
      pushLog(`银两不足（需 ${GRADE_PRICE[i.grade]}，现有 ${hero.silver}）`, 'lose');
      return;
    }
    setHero({ ...hero, silver: hero.silver - GRADE_PRICE[i.grade], innerId: i.id });
    pushLog(`【内功】修习《${i.name}》（${i.grade} 级），伤害 +${Math.round(i.atk * 100)}%，每回合回气 ${i.regen}`, 'win');
  };

  /** 装备：同槽位自动替换 */
  const equipItem = (name: string) => {
    if (!hero) return;
    const gear = GEAR[name];
    if (!gear) return;
    const prev = hero.equipped[gear.slot];
    setHero({ ...hero, equipped: { ...hero.equipped, [gear.slot]: name } });
    pushLog(`【装备】${prev ? `${prev} 换下，` : ''}装备${name}，战力 +${gear.power}`, 'win');
  };

  const unequipItem = (slot: GearSlot) => {
    if (!hero) return;
    const name = hero.equipped[slot];
    if (!name) return;
    setHero({ ...hero, equipped: { ...hero.equipped, [slot]: null } });
    pushLog(`【卸下】${name} 收回行囊`, 'info');
  };

  /** 集市购买：装备限购一件，药品可叠放 */
  const buyItem = (name: string) => {
    if (!hero) return;
    const entry = SHOP.find((s) => s.name === name);
    if (!entry) return;
    if (GEAR[name] && hero.items.includes(name)) {
      pushLog(`【集市】${name} 已有一件，无需再买`, 'lose');
      return;
    }
    if (hero.silver < entry.price) {
      pushLog(`【集市】银两不足：${name} 需 ${entry.price} 两，现有 ${hero.silver} 两`, 'lose');
      return;
    }
    setHero({ ...hero, silver: hero.silver - entry.price, items: [...hero.items, name] });
    pushLog(`【集市】购得${name}（-${entry.price} 两）`, 'win');
  };

  const startBattle = (combat: Combat) => {
    if (!hero) return;
    const enemyDef = ENEMIES[combat.enemy] ?? ENEMIES['血手堂杀手'];
    const enemyMaxHp = Math.round(enemyDef.hpBase + combat.difficulty * enemyDef.hpPerDiff);
    battleSeq.current = 0;
    setBattle({
      combat,
      enemyDef,
      enemyHp: enemyMaxHp,
      enemyMaxHp,
      playerHp: hero.hp,
      round: 1,
      over: null,
      enemyBleed: null,
      playerBleed: null,
      playerStun: 0,
      enemyStun: 0,
      lines: [{ id: 0, text: `${enemyDef.name}拦住去路：${enemyDef.intro}`, tone: 'info' }],
    });
  };

  const pushBattleLine = (text: string, tone: LogTone) => {
    setBattle((prev) => {
      if (!prev) return prev;
      battleSeq.current += 1;
      return { ...prev, lines: [...prev.lines, { id: battleSeq.current, text, tone }].slice(-60) };
    });
  };

  /**
   * 一回合：按速度判定先后手（相差 10 内随机、快者略占优），
   * 眩晕方跳过出手；拳法命中可震晕对手；装备词条接入会心/吸血/速度。
   */
  const actRound = (action: 'attack' | 'heal', medName?: string) => {
    if (!hero || !battle || battle.over) return;
    const { enemyDef } = battle;
    let playerHp = battle.playerHp;
    let enemyHp = battle.enemyHp;
    let enemyBleed = battle.enemyBleed;
    let playerBleed = battle.playerBleed;
    let playerStun = battle.playerStun;
    let enemyStun = battle.enemyStun;
    let nextHero = hero;
    let done = false;

    const fxFrom = (side: 'player' | 'enemy', r: StrikeResult): Omit<FxEvent, 'id'> =>
      r.kind === 'dodge'
        ? { side, text: '闪避', tone: 'dodge' }
        : r.kind === 'parry'
          ? { side, text: `-${r.dmg}`, tone: 'parry' }
          : { side, text: `-${r.dmg}`, tone: r.crit ? 'crit' : 'dmg' };

    const finish = (over: 'win' | 'lose') => {
      done = true;
      setBattle((prev) => (prev ? { ...prev, enemyHp, playerHp, over } : prev));
    };

    /** 玩家出手（被震晕时只能挨打） */
    const playerTurn = () => {
      if (playerStun > 0) {
        playerStun -= 1;
        pushBattleLine(`你气血翻涌，被震得动弹不得（眩晕剩 ${playerStun} 回合）。`, 'lose');
        return;
      }
      if (action === 'attack') {
        // 玩家出手：等级 + 装备 + 秘籍 + 内功 加成；装备会心词条另计
        const gear = gearStats(hero);
        const power = heroPower(hero);
        const result = strike(hero.school, hero.qi, hero.wit, power, enemyDef.wit, enemyDef.qi, gear.crit);
        const line = strikeText('player', enemyDef.name, hero.school, result);
        pushBattleLine(line.text, line.tone);
        addFx([fxFrom('enemy', result)]);
        enemyHp = Math.max(0, enemyHp - result.dmg);
        if (enemyHp <= 0) {
          pushBattleLine(`【胜】${enemyDef.name}倒下了。`, 'win');
          finish('win');
          return;
        }
        // 吸血词条：按造成伤害的比例回血
        if (result.dmg > 0 && gear.lifesteal > 0) {
          const steal = Math.max(1, Math.round((result.dmg * gear.lifesteal) / 100));
          const healed = Math.min(hero.maxHp, playerHp + steal) - playerHp;
          if (healed > 0) {
            playerHp += healed;
            addFx([{ side: 'player', text: `+${healed}`, tone: 'heal' }]);
            pushBattleLine(`兵刃饮血，你回复 ${healed} 点气血。`, 'win');
          }
        }
        // 拳法沉实，命中可震晕对手；会心时震得更久
        if (hero.school === 'quan' && result.kind === 'hit' && Math.random() * 100 < (result.crit ? 35 : 18)) {
          enemyStun = Math.max(enemyStun, result.crit ? 2 : 1);
          pushBattleLine(`${enemyDef.name}被一拳震得气血翻涌，眩晕 ${enemyStun} 回合！`, 'win');
        }
        // 刀法命中割开皮肉：对方开始流血
        const fresh = bleedFrom(hero.school, result);
        if (fresh) {
          enemyBleed = fresh;
          pushBattleLine(`${enemyDef.name}皮肉翻卷，血流不止（剩 ${fresh.rounds} 回合，每回合 ${fresh.dmg} 点）。`, 'win');
        }
      } else {
        // 服药：按指定药品消耗一瓶，回复气血，让出这一回合
        const med = medName && hero.items.includes(medName) ? medName : null;
        if (!med) return;
        const amount = MEDS[med]?.heal ?? 0;
        nextHero = applyEffects(hero, { removeItems: [med] });
        playerHp = Math.min(hero.maxHp, playerHp + amount);
        setHero(nextHero);
        addFx([{ side: 'player', text: `+${amount}`, tone: 'heal' }]);
        pushBattleLine(`你服下${med}，气血回复 ${amount} 点（余 ${itemCount(nextHero, med)} 瓶）。`, 'win');
      }
    };

    /** 敌方出手（被震晕时跳过一次） */
    const enemyTurn = () => {
      if (enemyStun > 0) {
        enemyStun -= 1;
        pushBattleLine(`${enemyDef.name}头晕目眩，这一招落在空处（眩晕剩 ${enemyStun} 回合）。`, 'win');
        return;
      }
      // 敌方反击：伤害 = 敌流派基础 × 敌人 power；已装备护甲减伤
      const armor = hero.equipped.armor ? 0.82 : 1;
      const back = strike(enemyDef.school, enemyDef.qi, enemyDef.wit, enemyDef.power * armor, hero.wit, hero.qi);
      const backLine = strikeText('enemy', enemyDef.name, enemyDef.school, back);
      pushBattleLine(backLine.text, backLine.tone);
      addFx([fxFrom('player', back)]);
      playerHp = Math.max(0, playerHp - back.dmg);
      if (playerHp <= 0) {
        pushBattleLine('【败】你眼前一黑，倒了下去。', 'lose');
        finish('lose');
        return;
      }
      // 敌方拳法同样能把你震晕
      if (enemyDef.school === 'quan' && back.kind === 'hit' && Math.random() * 100 < (back.crit ? 30 : 15)) {
        playerStun = Math.max(playerStun, back.crit ? 2 : 1);
        pushBattleLine(`你被${enemyDef.name}一拳震得眼前发黑，眩晕 ${playerStun} 回合！`, 'lose');
      }
      // 敌方刀法也可能让你流血
      const freshOnPlayer = bleedFrom(enemyDef.school, back);
      if (freshOnPlayer) {
        playerBleed = freshOnPlayer;
        pushBattleLine(`你的手臂被划开一道口子，血流不止（剩 ${freshOnPlayer.rounds} 回合，每回合 ${freshOnPlayer.dmg} 点）。`, 'lose');
      }
    };

    // ——— 先手判定 ———
    const pSpeed = heroSpeed(hero);
    const eSpeed = enemySpeed(enemyDef);
    const playerFirst = rollFirst(pSpeed, eSpeed);
    pushBattleLine(
      `第${battle.round}回合 · ${playerFirst ? '你' : enemyDef.name}抢得先机（速度 ${pSpeed} : ${eSpeed}）。`,
      'info',
    );
    if (playerFirst) {
      playerTurn();
      if (!done) enemyTurn();
    } else {
      enemyTurn();
      if (!done) playerTurn();
    }
    if (done) return;

    // 回合末结算双方流血
    if (enemyBleed) {
      const tick = enemyBleed;
      enemyHp = Math.max(0, enemyHp - tick.dmg);
      addFx([{ side: 'enemy', text: `🩸-${tick.dmg}`, tone: 'dmg' }]);
      enemyBleed = tick.rounds > 1 ? { ...tick, rounds: tick.rounds - 1 } : null;
      pushBattleLine(`${enemyDef.name}血流不止，再失 ${tick.dmg} 点气血${enemyBleed ? `（剩 ${enemyBleed.rounds} 回合）` : '（血流渐止）'}。`, 'win');
      if (enemyHp <= 0) {
        pushBattleLine(`【胜】${enemyDef.name}血尽倒地。`, 'win');
        finish('win');
        return;
      }
    }
    if (playerBleed) {
      const tick = playerBleed;
      playerHp = Math.max(0, playerHp - tick.dmg);
      addFx([{ side: 'player', text: `🩸-${tick.dmg}`, tone: 'dmg' }]);
      playerBleed = tick.rounds > 1 ? { ...tick, rounds: tick.rounds - 1 } : null;
      pushBattleLine(`你的伤口仍在流血，又失 ${tick.dmg} 点气血${playerBleed ? `（剩 ${playerBleed.rounds} 回合）` : '（血已止住）'}。`, 'lose');
      if (playerHp <= 0) {
        pushBattleLine('【败】失血过多，你眼前一黑。', 'lose');
        finish('lose');
        return;
      }
    }

    // 内功调息：每回合自行回气
    const regen = innerOf(hero)?.regen ?? 0;
    if (regen > 0) {
      const healed = Math.min(hero.maxHp, playerHp + regen) - playerHp;
      if (healed > 0) {
        playerHp += healed;
        addFx([{ side: 'player', text: `+${healed}`, tone: 'heal' }]);
        pushBattleLine(`你内息流转，缓过 ${healed} 点气血。`, 'win');
      }
    }
    setBattle((prev) =>
      prev ? { ...prev, enemyHp, playerHp, enemyBleed, playerBleed, playerStun, enemyStun, round: prev.round + 1 } : prev,
    );
  };

  /** 战斗结算：胜利回满气血 + 得经验（城镇战另发秘籍与内功）；失败按 loseHp 惩罚进 lose 节点 */
  const settleBattle = () => {
    if (!hero || !battle || !battle.over) return;
    const { combat } = battle;
    if (battle.over === 'win') {
      const gain = Math.round(8 + combat.difficulty * 2.2);
      let next = grantExp({ ...hero, hp: hero.maxHp }, gain);
      pushLog(`【战斗胜利】击败了${combat.enemy}，战后调息，气血已复原。`, 'win');

      const town = combat.town ? TOWNS.find((t) => t.key === combat.town) : null;
      if (town) {
        const gained: string[] = [];
        const manual = MANUALS.find((m) => m.school === hero.school && m.grade === town.grade);
        const inner = INNERS.find((i) => i.grade === town.grade);
        const curM = manualOf(hero);
        const curI = innerOf(hero);
        if (manual && (!curM || GRADE_INDEX[curM.grade] < GRADE_INDEX[manual.grade])) {
          next = { ...next, manualId: manual.id };
          gained.push(`秘籍《${manual.name}》`);
        }
        if (inner && (!curI || GRADE_INDEX[curI.grade] < GRADE_INDEX[inner.grade])) {
          next = { ...next, innerId: inner.id };
          gained.push(`内功《${inner.name}》`);
        }
        if (gained.length > 0) {
          pushLog(`【${town.name}战利】${gained.join('、')}`, 'win');
        } else {
          next = { ...next, silver: next.silver + 150 };
          pushLog(`【${town.name}战利】武学已臻此境，得银两 150`, 'win');
        }
        if (!cleared.includes(town.key)) setCleared((prev) => [...prev, town.key]);
        setBattle(null);
        setHero(next);
        return;
      }

      setBattle(null);
      enter(combat.win, next);
    } else {
      const survived = { ...hero, hp: Math.max(1, Math.round(hero.maxHp * 0.15)) };
      pushLog(`【战斗失利】败给${combat.enemy}，侥幸捡回一条命。`, 'lose');
      setBattle(null);
      if (combat.town) {
        // 城镇挑战失败：退守客栈养伤，剧情不推进
        setHero(survived);
        return;
      }
      if (combat.lose === 'end-death') {
        enter(combat.lose, { ...survived, hp: 0 });
      } else {
        enter(combat.lose, survived);
      }
    }
  };

  /** 认输：按失败处理（不进 end-death 的场合） */
  const surrender = () => {
    if (!battle || battle.over) return;
    pushBattleLine('你收势认输，留得青山在。', 'lose');
    setBattle((prev) => (prev ? { ...prev, over: 'lose' } : prev));
  };

  // ——— 渲染 ———

  const node = NODES[nodeId];
  const selectedOrigin = originKey ? ORIGINS.find((o) => o.key === originKey) ?? null : null;
  const sceneKey = NODE_SCENE[nodeId] ?? (node?.chapter === 1 ? 'luoyang-snow' : node?.chapter === 2 ? 'jiangnan' : 'peak');
  const scene = SCENES[sceneKey];
  const playerFx = battleFx.filter((f) => f.side === 'player');
  const enemyFx = battleFx.filter((f) => f.side === 'enemy');
  const lastPlayerFx = playerFx[playerFx.length - 1];
  const lastEnemyFx = enemyFx[enemyFx.length - 1];
  const FX_COLOR: Record<FxEvent['tone'], string> = {
    dmg: 'text-danger',
    crit: 'text-warning',
    heal: 'text-success',
    dodge: 'text-faint',
    parry: 'text-warning',
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <style>{`
        @keyframes jh-fx-rise {
          0% { opacity: 0; transform: translateY(8px) scale(0.7); }
          20% { opacity: 1; transform: translateY(-2px) scale(1.08); }
          100% { opacity: 0; transform: translateY(-32px) scale(1); }
        }
        .jh-fx { animation: jh-fx-rise 0.78s ease-out forwards; }
        @keyframes jh-flash { 0% { opacity: 0; } 12% { opacity: 0.85; } 100% { opacity: 0; } }
        .jh-flash { animation: jh-flash 0.5s ease-out forwards; }
        @keyframes jh-chapter-in {
          0% { opacity: 0; transform: scale(1.08); }
          18% { opacity: 1; transform: scale(1); }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        .jh-chapter { animation: jh-chapter-in 1.9s ease forwards; }
        @keyframes jh-fade-up {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .jh-fade { animation: jh-fade-up 0.32s ease-out; }
      `}</style>

      {/* 章节过场卡 */}
      {chapterIntro && (
        <div
          key={chapterIntro.key}
          className="jh-chapter fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm"
        >
          <div className="text-center">
            <div className="text-[11px] tracking-[0.7em] text-white/45">第 · {chapterIntro.chapter} · 章</div>
            <div className="mt-3 text-3xl font-bold tracking-[0.3em] text-[#efe6d2]">
              {CHAPTER_LABELS[chapterIntro.chapter].split('·')[1]?.trim()}
            </div>
            <div className="mx-auto mt-4 h-px w-24 bg-white/30" />
          </div>
        </div>
      )}

      {/* ════ 出身选择：卷轴式开局面板（仿「捕快招募」） ════ */}
      {phase === 'origin' && (
        <div className="mx-auto max-w-md">
          <div className="relative rounded-md border-[3px] border-[#2f2b26] bg-[#d8d4cb] px-5 pb-6 pt-9 text-[#2b2925] shadow-2xl">
            {/* 牌匾标题 */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2">
              <div className="whitespace-nowrap border-2 border-[#c9bfa8] bg-[#201d19] px-8 py-1.5 text-center text-lg font-bold tracking-[0.35em] text-[#e8dfc8] shadow-lg">
                踏入江湖
              </div>
            </div>

            {/* 上次的存档：可续接，也可弃档 */}
            {saveData && (
              <div className="mb-4 rounded-sm border-2 border-[#8a8175] bg-[#efeae0] p-2.5">
                <div className="text-[11px] font-bold tracking-[0.2em]">江湖有未了事</div>
                <div className="mt-1 text-[11px] text-[#6b655a]">
                  {saveData.playerName} · {saveData.hero.origin} · Lv.{saveData.hero.level} · {NODES[saveData.nodeId]?.title ?? '江湖'}
                </div>
                {idlePreview && (
                  <div className="mt-1 text-[11px] text-[#7a5a1e]">
                    🕯 离线挂机 {idlePreview.minutes} 分钟：经验 +{idlePreview.exp}、银两 +{idlePreview.silver}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={continueSave}
                    className="flex-1 border border-[#c9bfa8] bg-[#201d19] py-1 text-[11px] font-bold tracking-[0.2em] text-[#e8dfc8]"
                  >
                    继续上次
                  </button>
                  <button
                    type="button"
                    onClick={clearSave}
                    className="border border-[#8a8175] px-3 py-1 text-[11px] text-[#3a352d] hover:bg-black/5"
                  >
                    弃档
                  </button>
                </div>
              </div>
            )}

            {/* 头像选择：左右箭头切换 */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm font-semibold">头像：</span>
              <button
                type="button"
                aria-label="上一个头像"
                onClick={() => cycleAvatar(-1)}
                className="px-1 text-2xl leading-none text-[#3a352d] transition-transform hover:scale-110"
              >
                ◀
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PORTRAITS[avatarKey]}
                alt={AVATARS.find((a) => a.key === avatarKey)?.label ?? '头像'}
                className="h-24 w-24 border-2 border-[#8a8175] bg-[#c4beb2] object-cover"
              />
              <button
                type="button"
                aria-label="下一个头像"
                onClick={() => cycleAvatar(1)}
                className="px-1 text-2xl leading-none text-[#3a352d] transition-transform hover:scale-110"
              >
                ▶
              </button>
            </div>

            {/* 姓名 + 骰子 */}
            <div className="mt-5 flex items-center justify-center gap-3">
              <span className="text-sm font-semibold">姓名：</span>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={6}
                className="w-32 border-b-2 border-[#3a352d] bg-transparent pb-0.5 text-center text-base tracking-[0.3em] outline-none"
              />
              <button type="button" title="随机起名" onClick={rollName} className="text-xl transition-transform hover:rotate-12">
                🎲
              </button>
            </div>

            {/* 出身 */}
            <div className="mt-6">
              <div className="mb-2 text-center text-sm font-bold tracking-[0.3em]">— 你的出身是 —</div>
              <div className="space-y-1">
                {ORIGINS.map((o, i) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setOriginKey(o.key)}
                    className={`block w-full rounded-sm px-3 py-2 text-left text-[13px] transition-colors ${
                      originKey === o.key ? 'bg-[#2f2b26] font-bold text-[#e8dfc8]' : 'hover:bg-black/5'
                    }`}
                  >
                    {'一二三'[i]}．{o.name}
                    <span className={`ml-2 text-[11px] font-normal ${originKey === o.key ? 'text-[#c9bfa8]' : 'text-[#6b655a]'}`}>
                      气血{o.maxHp} · 内力{o.qi} · 悟性{o.wit} · 银两{o.silver}
                    </span>
                  </button>
                ))}
              </div>
              {selectedOrigin && (
                <p className="mt-2 px-3 text-[11px] leading-relaxed text-[#6b655a]">{selectedOrigin.desc}</p>
              )}
            </div>

            {/* 确定（牌匾按钮） */}
            <div className="mt-6 text-center">
              <button
                type="button"
                disabled={!originKey || !playerName.trim()}
                onClick={() => {
                  const o = ORIGINS.find((x) => x.key === originKey);
                  if (o) pickOrigin(o);
                }}
                className="border-2 border-[#c9bfa8] bg-[#201d19] px-12 py-2 text-base font-bold tracking-[0.4em] text-[#e8dfc8] shadow-md transition-opacity disabled:opacity-40"
              >
                确 定
              </button>
            </div>

            <p className="mt-4 text-center text-[10px] text-[#8a8175]">※点击文字选择出身，兵刃流派在下一步选择※</p>
          </div>
        </div>
      )}

      {/* ════ 流派选择 ════ */}
      {phase === 'school' && origin && (
        <div>
          <div className="mb-3 text-sm font-semibold text-content">
            第二步 · 选择兵刃流派
            <span className="ml-2 text-[11px] font-normal text-faint">出身：{origin.emoji} {origin.name}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(SCHOOLS) as SchoolKey[]).map((key) => {
              const s = SCHOOLS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickSchool(key)}
                  className="card overflow-hidden p-0 text-left transition-colors hover:border-accent/50"
                >
                  <div className="relative h-36 w-full bg-surface-raised">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={PORTRAITS[key]} alt={s.name} loading="lazy" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-2 left-3 text-white">
                      <span className="text-lg font-bold">{s.emoji} {s.name}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] leading-relaxed text-faint">{s.desc}</p>
                    <div className="mt-2 space-y-1 text-[10px]">
                      <div className="flex justify-between"><span className="text-muted">伤害</span><Meter value={key === 'dao' ? 90 : key === 'jian' ? 55 : 30} color="bg-danger" /></div>
                      <div className="flex justify-between"><span className="text-muted">被闪避</span><Meter value={key === 'dao' ? 80 : key === 'jian' ? 20 : 5} color="bg-accent" /></div>
                      <div className="flex justify-between"><span className="text-muted">被招架</span><Meter value={key === 'dao' ? 80 : key === 'jian' ? 70 : 5} color="bg-warning" /></div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setPhase('origin')} className="mt-3 text-xs text-faint hover:text-content">
            ← 重选出身
          </button>
        </div>
      )}

      {/* ════ 游戏主界面 ════ */}
      {(phase === 'play' || phase === 'end') && hero && node && (
        <div>
          {/* 人物状态条：人头 + 属性（手游式顶部状态栏） */}
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-card p-3">
            <Portrait name={avatarKey} size={52} ring="border-accent/50" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-content">
                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">Lv.{hero.level}</span>
                <span>{playerName} · {hero.origin} · {SCHOOLS[hero.school].name}</span>
                <span className="text-[10px] font-normal text-faint">{SCHOOLS[hero.school].weapon}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted sm:grid-cols-3">
                <span>❤️ 气血 {hero.hp}/{hero.maxHp}</span>
                <span>🔷 内力 {hero.qi}</span>
                <span>📖 悟性 {hero.wit}</span>
                <span>⚖️ 侠义 {hero.chivalry}</span>
                <span>💰 银两 {hero.silver}</span>
                <span>💨 速度 {heroSpeed(hero)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                <div className="h-full rounded-full bg-danger transition-all" style={{ width: `${(hero.hp / hero.maxHp) * 100}%` }} />
              </div>
              {/* 经验条 */}
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(hero.exp / expNeed(hero.level)) * 100}%` }} />
                </div>
                <span className="shrink-0 text-[9px] text-faint">经验 {hero.exp}/{expNeed(hero.level)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-faint">
                <span>📜 {manualOf(hero) ? `${manualOf(hero)?.grade}《${manualOf(hero)?.name}》` : '秘籍 · 未学'}</span>
                <span>☯ {innerOf(hero) ? `${innerOf(hero)?.grade}《${innerOf(hero)?.name}》` : '内功 · 未修'}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button type="button" onClick={() => setShowLog((v) => !v)} className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-content">
                {showLog ? '收起记录' : '江湖行录'}
              </button>
              <button type="button" onClick={() => setPanel('martial')} className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-content">
                武学
              </button>
              <button type="button" onClick={() => setPanel('town')} className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-content">
                行程
              </button>
              <button type="button" onClick={() => setPanel('bag')} className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-content">
                行囊
              </button>
            </div>
          </div>

          {/* 场景图（实物） */}
          <div className="relative mb-3 overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={scene.url} src={scene.url} alt={scene.label} loading="lazy" className="h-40 w-full object-cover sm:h-56" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
            <div className="absolute left-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[10px] text-white/85">
              {CHAPTER_LABELS[node.chapter]}
            </div>
            <div className="absolute bottom-3 left-4">
              <div className="text-lg font-bold text-white">{node.title}</div>
              <div className="text-[10px] text-white/60">{scene.label}</div>
            </div>
            {/* 剧情人物人头：苏挽出场的节点显示 NPC 头像 */}
            {['a05', 'b06', 'b07', 'c04', 'c06'].includes(node.id) && (
              <div className="absolute bottom-3 right-4 flex flex-col items-center gap-1">
                <Portrait name="苏挽" size={44} ring="border-white/40" />
                <span className="rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-white/85">苏挽</span>
              </div>
            )}
          </div>

          {/* 江湖行录（可折叠） */}
          {showLog && (
            <div ref={logRef} className="mb-3 max-h-40 overflow-y-auto rounded-xl border border-line bg-card p-3 text-[11px] leading-relaxed">
              {logs.map((l) => (
                <div key={l.id} className={LOG_TONE[l.tone]}>{l.text}</div>
              ))}
            </div>
          )}

          {/* 结局面板 */}
          {phase === 'end' && endingKey ? (
            <div className={`rounded-xl border p-5 ${ENDINGS[endingKey].tone}`}>
              <div className="mb-2 text-lg font-bold">结局 · {ENDINGS[endingKey].title}</div>
              <p className="text-[13px] leading-relaxed opacity-90">{ENDINGS[endingKey].text}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="chip bg-black/10">气血 {hero.hp}</span>
                <span className="chip bg-black/10">内力 {hero.qi}</span>
                <span className="chip bg-black/10">悟性 {hero.wit}</span>
                <span className="chip bg-black/10">侠义 {hero.chivalry}</span>
                <span className="chip bg-black/10">银两 {hero.silver}</span>
                <span className="chip bg-black/10">{SCHOOLS[hero.school].emoji} {SCHOOLS[hero.school].name}</span>
              </div>
              <button type="button" onClick={restart} className="btn-primary mt-4">再入江湖</button>
            </div>
          ) : event ? (
            /* 奇遇事件 */
            <div key={event.ev.id} className="jh-fade rounded-xl border border-warning/40 bg-warning/5 p-4">
              <div className="mb-1 text-sm font-semibold text-warning">江湖奇遇 · {event.ev.title}</div>
              <p className="mb-3 text-[13px] leading-relaxed text-content">{event.ev.text}</p>
              <div className="space-y-2">
                {event.ev.choices.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => chooseEvent(c)}
                    className="flex w-full items-center justify-between rounded-lg border border-line bg-card px-3 py-2.5 text-left text-[13px] text-content transition-all hover:translate-x-0.5 hover:border-warning/50"
                  >
                    <span>{c.label}</span>
                    <span className="ml-3 flex shrink-0 gap-1.5 text-[10px]">
                      {c.combat && <span className="text-danger">⚔️ 动武</span>}
                      {effectHints(c.effects).map((h, j) => (
                        <span key={j} className={h.tone}>{h.text}</span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* 剧情正文 + 抉择 */
            <div key={nodeId} className="jh-fade rounded-xl border border-line bg-card p-4">
              <p className="mb-4 text-[13px] leading-loose text-content">{node.text}</p>
              <div className="space-y-2">
                {node.choices.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => choose(c)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] transition-all hover:translate-x-0.5 ${
                      c.combat
                        ? 'border-danger/40 bg-danger/5 text-content hover:border-danger/70'
                        : 'border-line bg-surface text-content hover:border-accent/50'
                    }`}
                  >
                    <span>
                      {c.combat && <span className="mr-1.5">⚔️</span>}
                      {c.label}
                    </span>
                    <span className="ml-3 flex shrink-0 gap-1.5 text-[10px]">
                      {c.combat ? (
                        <span className="text-danger">战 · {c.combat.enemy}（{SCHOOLS[ENEMIES[c.combat.enemy]?.school ?? 'dao'].name}）</span>
                      ) : (
                        effectHints(c.effects).map((h, j) => (
                          <span key={j} className={h.tone}>{h.text}</span>
                        ))
                      )}
                    </span>
                  </button>
                ))}
              </div>
              {hero.items.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3 text-[10px] text-muted">
                  <span className="text-faint">行囊：</span>
                  {groupItems(hero.items).map((it) => (
                    <span key={it.name} className="chip bg-accent/10 text-accent">
                      {it.name}{it.count > 1 ? ` ×${it.count}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={restart} className="mt-3 text-xs text-faint hover:text-content">
            ↻ 重开一局
          </button>
        </div>
      )}

      {/* ════ 武学面板：秘籍 + 内功（D/C/B/A/S） ════ */}
      {panel === 'martial' && hero && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={() => setPanel(null)}>
          <div
            className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-content">武学 · 秘籍与内功</div>
              <button type="button" onClick={() => setPanel(null)} className="text-xs text-faint hover:text-content">关闭</button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="chip border border-accent/40 text-accent">
                战力 ×{heroPower(hero).toFixed(2)}
              </span>
              <span className="chip border border-line text-muted">
                秘籍：{manualOf(hero) ? `${manualOf(hero)?.grade}《${manualOf(hero)?.name}》` : '未学'}
              </span>
              <span className="chip border border-line text-muted">
                内功：{innerOf(hero) ? `${innerOf(hero)?.grade}《${innerOf(hero)?.name}》` : '未修'}
              </span>
              <span className="chip border border-line text-muted">银两 {hero.silver}</span>
            </div>

            <div className="mt-3 text-[11px] font-semibold text-content">
              本门秘笈 · {SCHOOLS[hero.school].name}（只对同流派生效）
            </div>
            <div className="mt-1.5 space-y-1.5">
              {MANUALS.filter((m) => m.school === hero.school).map((m) => {
                const owned = hero.manualId === m.id;
                const lower = manualOf(hero) ? GRADE_INDEX[manualOf(hero)!.grade] >= GRADE_INDEX[m.grade] : false;
                return (
                  <div key={m.id} className="flex items-start gap-2 rounded-lg border border-line p-2">
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-bold ${GRADE_STYLE[m.grade]}`}>{m.grade}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-content">
                        《{m.name}》<span className="ml-1 text-[10px] font-normal text-accent">伤害 +{Math.round(m.atk * 100)}%</span>
                      </div>
                      <p className="text-[10px] leading-snug text-faint">{m.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={owned || lower}
                      onClick={() => learnManual(m)}
                      className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content disabled:opacity-40"
                    >
                      {owned ? '已学' : lower ? '不如现有' : `${GRADE_PRICE[m.grade]} 两`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-[11px] font-semibold text-content">内功 · 加攻击 + 每回合回气</div>
            <div className="mt-1.5 space-y-1.5">
              {INNERS.map((i) => {
                const owned = hero.innerId === i.id;
                const lower = innerOf(hero) ? GRADE_INDEX[innerOf(hero)!.grade] >= GRADE_INDEX[i.grade] : false;
                return (
                  <div key={i.id} className="flex items-start gap-2 rounded-lg border border-line p-2">
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-bold ${GRADE_STYLE[i.grade]}`}>{i.grade}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-content">
                        《{i.name}》
                        <span className="ml-1 text-[10px] font-normal text-accent">
                          +{Math.round(i.atk * 100)}% 伤害 · 每回合 +{i.regen} 气血
                        </span>
                      </div>
                      <p className="text-[10px] leading-snug text-faint">{i.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={owned || lower}
                      onClick={() => learnInner(i)}
                      className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content disabled:opacity-40"
                    >
                      {owned ? '已修' : lower ? '不如现有' : `${GRADE_PRICE[i.grade]} 两`}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              提示：打赢「行程」里的城镇守卫，可直接得到该城镇等级的秘籍与内功，不必花银两。
            </p>
          </div>
        </div>
      )}

      {/* ════ 行程面板：洛阳 → 襄阳 → 西安 → 燕京 → 华山 ════ */}
      {panel === 'town' && hero && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={() => setPanel(null)}>
          <div
            className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-content">江湖行程</div>
              <button type="button" onClick={() => setPanel(null)} className="text-xs text-faint hover:text-content">关闭</button>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-faint">
              一路向东：洛阳 → 襄阳 → 西安 → 燕京 → 华山。每座城的守卫都比上一座强，打赢可得该城等级的秘籍与内功。
            </p>

            <div className="mt-3 space-y-2">
              {TOWNS.map((t, idx) => {
                const done = cleared.includes(t.key);
                const unlocked = idx === 0 || cleared.includes(TOWNS[idx - 1].key);
                return (
                  <div
                    key={t.key}
                    className={`rounded-lg border p-2.5 ${done ? 'border-success/40 bg-success/5' : unlocked ? 'border-line' : 'border-line/50 opacity-55'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-bold ${GRADE_STYLE[t.grade]}`}>{t.grade}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-content">
                          {t.name}
                          {done && <span className="ml-1 text-[10px] font-normal text-success">已平定</span>}
                        </div>
                        <div className="text-[10px] text-faint">
                          守卫 {t.enemy} · 难度 {t.diff} · 可得 {t.reward}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => startTownBattle(t)}
                        className="shrink-0 rounded border border-line px-2.5 py-1 text-[10px] text-muted hover:text-content disabled:opacity-40"
                      >
                        {done ? '再战' : unlocked ? '挑战' : '未解锁'}
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-faint">{t.desc}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] text-faint">※ 战后气血自动复原，可反复挑战刷经验 ※</p>
          </div>
        </div>
      )}

      {/* ════ 行囊面板：装备槽 + 物品 + 集市 ════ */}
      {panel === 'bag' && hero && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={() => setPanel(null)}>
          <div
            className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-content">行囊 · 装备与药品</div>
              <button type="button" onClick={() => setPanel(null)} className="text-xs text-faint hover:text-content">关闭</button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="chip border border-accent/40 text-accent">战力 ×{heroPower(hero).toFixed(2)}</span>
              <span className="chip border border-line text-muted">装备加成 +{gearBonus(hero)}</span>
              <span className="chip border border-line text-muted">暴击 +{gearStats(hero).crit}%</span>
              <span className="chip border border-line text-muted">吸血 {gearStats(hero).lifesteal}%</span>
              <span className="chip border border-line text-muted">速度 {heroSpeed(hero)}</span>
              <span className="chip border border-line text-muted">银两 {hero.silver}</span>
            </div>

            <div className="mt-3 text-[11px] font-semibold text-content">已装备</div>
            <div className="mt-1.5 space-y-1.5">
              {SLOT_LABELS.map(({ slot, label }) => {
                const name = hero.equipped[slot];
                const gear = name ? GEAR[name] : null;
                return (
                  <div key={slot} className="flex items-center gap-2 rounded-lg border border-line p-2">
                    <span className="shrink-0 text-[11px] text-faint">{label}</span>
                    <div className="min-w-0 flex-1 text-[12px] text-content">
                      {name ?? <span className="text-faint">空</span>}
                      {gear && <span className="ml-1 text-[10px] text-accent">战力 +{gear.power}</span>}
                      {gear && <span className="ml-1 text-[10px] text-faint">{gearAffix(gear)}</span>}
                    </div>
                    {name && (
                      <button
                        type="button"
                        onClick={() => unequipItem(slot)}
                        className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content"
                      >
                        卸下
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-[11px] font-semibold text-content">行囊物品</div>
            <div className="mt-1.5 space-y-1.5">
              {hero.items.length === 0 && <div className="text-[10px] text-faint">空空如也。</div>}
              {groupItems(hero.items).map(({ name, count }) => {
                const gear = GEAR[name];
                const equipped = gear ? hero.equipped[gear.slot] === name : false;
                const med = MEDS[name];
                return (
                  <div key={name} className="flex items-start gap-2 rounded-lg border border-line p-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-content">
                        {name}
                        {count > 1 && <span className="ml-1 text-[10px] text-faint">×{count}</span>}
                        {equipped && <span className="ml-1 text-[10px] font-normal text-success">已装备</span>}
                      </div>
                      <p className="text-[10px] leading-snug text-faint">
                        {gear ? `${gear.desc}${gearAffix(gear) ? `（${gearAffix(gear)}）` : ''}` : med?.desc ?? '随身之物，未派上用场。'}
                      </p>
                    </div>
                    {gear && !equipped && (
                      <button
                        type="button"
                        onClick={() => equipItem(name)}
                        className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content"
                      >
                        装备
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-content">
              <span>集市 · 明码标价</span>
              <span className="text-[10px] font-normal text-faint">银两 {hero.silver}</span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {SHOP.map((s) => {
                const owned = GEAR[s.name] ? hero.items.includes(s.name) : false;
                const canBuy = !owned && hero.silver >= s.price;
                return (
                  <div key={s.name} className="flex items-center gap-2 rounded-lg border border-line p-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] text-content">{s.name}</div>
                      <p className="text-[10px] leading-snug text-faint">{s.note}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!canBuy}
                      onClick={() => buyItem(s.name)}
                      className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content disabled:opacity-40"
                    >
                      {owned ? '已有' : `${s.price} 两`}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              ※ 装备只按槽位生效：兵器加战力、护甲减伤；词条为暴击 / 吸血 / 速度；药品在战斗中按瓶消耗 ※
            </p>
          </div>
        </div>
      )}

      {/* ════ 战斗界面（弹层）：双方人头 + 血条 + 回合战报 ════ */}
      {battle && hero && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            {/* 战斗场景横幅 */}
            <div className="relative h-28 sm:h-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={scene.url} alt={scene.label} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="absolute bottom-2 left-3 text-[11px] font-semibold text-white">
                ⚔️ 激战 · {scene.label}
              </div>
              <div className="absolute right-3 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                第 {battle.round} 回合
              </div>
            </div>

            {/* 对阵双方：人头 + 血条 */}
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Portrait name={avatarKey} size={56} ring="border-accent/60" />
                    {lastPlayerFx && lastPlayerFx.tone !== 'heal' && (
                      <span key={`pf-${lastPlayerFx.id}`} className="jh-flash pointer-events-none absolute inset-0 rounded-full bg-white" />
                    )}
                    {playerFx.map((f) => (
                      <span
                        key={f.id}
                        className={`jh-fx pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-black drop-shadow ${FX_COLOR[f.tone]}`}
                      >
                        {f.text}
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-content">你 · {SCHOOLS[hero.school].name}</div>
                    <div className="text-[10px] text-faint">
                      速度 {heroSpeed(hero)} · 会心 {clamp(critChance(hero.wit) + gearStats(hero).crit, 8, 60)}% · 敌闪避 {dodgeChance(battle.enemyDef.wit, hero.school)}% · 敌招架 {parryChance(battle.enemyDef.qi, hero.school)}%
                    </div>
                  </div>
                </div>
                <HpBar hp={battle.playerHp} maxHp={hero.maxHp} color="bg-success" />
                {battle.playerStun > 0 && (
                  <div className="mt-1 text-[10px] text-warning">
                    🌀 眩晕 · 剩 {battle.playerStun} 回合无法出手
                  </div>
                )}
                {battle.playerBleed && (
                  <div className="mt-1 text-[10px] text-danger">
                    🩸 流血 · 剩 {battle.playerBleed.rounds} 回合（每回合 {battle.playerBleed.dmg}）
                  </div>
                )}
              </div>
              <div className="pt-4 text-lg font-black text-danger">VS</div>
              <div className="flex-1">
                <div className="flex items-center justify-end gap-2 text-right">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-content">{battle.enemyDef.name} · {SCHOOLS[battle.enemyDef.school].name}</div>
                    <div className="text-[10px] text-faint">
                      速度 {enemySpeed(battle.enemyDef)} · 你闪避 {dodgeChance(hero.wit, battle.enemyDef.school)}% · 你招架 {parryChance(hero.qi, battle.enemyDef.school)}%
                    </div>
                  </div>
                  <div className="relative">
                    <Portrait name={battle.enemyDef.name} size={56} ring="border-danger/60" />
                    {lastEnemyFx && lastEnemyFx.tone !== 'heal' && (
                      <span key={`ef-${lastEnemyFx.id}`} className="jh-flash pointer-events-none absolute inset-0 rounded-full bg-white" />
                    )}
                    {enemyFx.map((f) => (
                      <span
                        key={f.id}
                        className={`jh-fx pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-black drop-shadow ${FX_COLOR[f.tone]}`}
                      >
                        {f.text}
                      </span>
                    ))}
                  </div>
                </div>
                <HpBar hp={battle.enemyHp} maxHp={battle.enemyMaxHp} color="bg-danger" right />
                {battle.enemyStun > 0 && (
                  <div className="mt-1 text-right text-[10px] text-warning">
                    🌀 眩晕 · 剩 {battle.enemyStun} 回合无法出手
                  </div>
                )}
                {battle.enemyBleed && (
                  <div className="mt-1 text-right text-[10px] text-danger">
                    🩸 流血 · 剩 {battle.enemyBleed.rounds} 回合（每回合 {battle.enemyBleed.dmg}）
                  </div>
                )}
              </div>
            </div>

            {/* 战报 */}
            <div ref={battleLogRef} className="mx-4 h-36 overflow-y-auto rounded-lg border border-line bg-card p-2.5 text-[11px] leading-relaxed">
              {battle.lines.map((l) => (
                <div key={l.id} className={LOG_TONE[l.tone]}>{l.text}</div>
              ))}
            </div>

            {/* 操作 */}
            <div className="flex flex-wrap gap-2 p-4">
              {!battle.over ? (
                <>
                  <button type="button" onClick={() => actRound('attack')} className="btn-primary min-w-[140px] flex-1">
                    {SCHOOLS[hero.school].emoji} 出手（{SCHOOLS[hero.school].name}）
                  </button>
                  {MED_ORDER.filter((med) => itemCount(hero, med) > 0).map((med) => (
                    <button
                      key={med}
                      type="button"
                      onClick={() => actRound('heal', med)}
                      className="rounded-lg border border-success/50 bg-success/10 px-3 py-2 text-xs text-success hover:bg-success/20"
                    >
                      服{med} ×{itemCount(hero, med)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={surrender}
                    className="rounded-lg border border-line px-3 text-xs text-muted hover:text-content"
                  >
                    认输
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={settleBattle}
                  className={`btn-primary flex-1 ${battle.over === 'lose' ? '!bg-danger' : ''}`}
                >
                  {battle.over === 'win'
                    ? battle.combat.town ? '✓ 取胜，收兵回城' : '✓ 取胜，继续剧情'
                    : '✕ 败北，接受后果'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 小血条 */
function HpBar({ hp, maxHp, color, right }: { hp: number; maxHp: number; color: string; right?: boolean }) {
  return (
    <div className="mt-2">
      <div className={`h-2 overflow-hidden rounded-full bg-surface-raised ${right ? 'rotate-180' : ''}`}>
        <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${clamp((hp / maxHp) * 100, 0, 100)}%` }} />
      </div>
      <div className={`mt-0.5 text-[10px] text-faint ${right ? 'text-right' : ''}`}>
        {hp}/{maxHp}
      </div>
    </div>
  );
}

/** 流派属性条（选流派界面用） */
function Meter({ value, color }: { value: number; color: string }) {
  return (
    <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-surface-raised align-middle">
      <span className={`block h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </span>
  );
}
