'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MERIDIANS,
  RECIPES_EXT,
  FORGE_COST,
  LIFE_SKILL_LABEL,
  canOpenMeridian,
  craftSuccessChance,
  defaultForge,
  defaultLifeSkills,
  gainLifeSkill,
  idleMultiplier,
  meridianBonuses,
  type ForgeBoost,
  type LifeSkills,
  type MeridianKey,
} from '@/components/jianghu/cultivation';
import {
  BOSS_NAMES,
  COMBO_MAX,
  bossPhase,
  bossPhaseLabel,
  phasePowerMul,
  pickEnemyAction,
  schoolSkills,
  type BossPhase,
  type SkillId,
} from '@/components/jianghu/combat-ext';
import { CHAPTER4_LABEL, CHAPTER4_NODES, CHAPTER4_SCENES } from '@/components/jianghu/story-ch4';
import { CHAPTER5_LABEL, CHAPTER5_NODES, CHAPTER5_SCENES } from '@/components/jianghu/story-ch5';
import { WORLD_NPC_QUESTS, WorldScene } from '@/components/jianghu/world';
import { STORY_QUESTS } from '@/components/jianghu/quests-story';
import {
  QUEST_CHAINS,
  advanceQuestStep,
  questStepHint,
  type QuestProgress,
} from '@/components/jianghu/quests-ext';

/** 全量任务链：原有 17 条 + 剧情联动 5 条 */
const ALL_CHAINS = [...QUEST_CHAINS, ...STORY_QUESTS];

/**
 * 江湖风云录：四章文字冒险 + 回合制战斗。
 * 养成 / 战斗扩展模块见 src/components/jianghu/*
 */

// ──────────────────────────── 基础类型 ────────────────────────────

type Chapter = 1 | 2 | 3 | 4 | 5;
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
  /** 悬赏任务战：胜利后发放悬赏奖励，不推进剧情 */
  quest?: string;
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
  /** 已拜入门派（六派之一，可无） */
  sectKey?: string | null;
  /** 门派贡献：捐银与悬赏积累，可在门派换取 S 级武学 */
  contribution?: number;
  /** 酒意：在江湖中行走、饮酒时积攒，满 10 点化为一点酒量 */
  wine?: number;
  /** 酒量：每点提升 3 点气血上限（原作「酒意化酒量」只在游戏内转化） */
  capacity?: number;
  /** 剑意：胜场累积，每 50 点会心 +2%，至多 +12% */
  swordIntent?: number;
  /** 已点亮经脉穴位 */
  meridians?: MeridianKey[];
  /** 生活技能 */
  lifeSkills?: LifeSkills;
  /** 锻造词条加成（全局，叠在装备上） */
  forge?: ForgeBoost;
  /** 秘籍等级（残页升级） */
  manualLevel?: number;
  /** 下场战斗临时攻击加成（虎骨膏） */
  atkBuff?: number;
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

/** 场景背景：优先真实美术 public/game/scenes/<key>.webp，缺图时回落到同名 SVG 意境图。
 *  线上没有 Trae 鉴权，远端文生图接口必然 401，故完全不再依赖它。 */
const sceneArt = (key: string) => `/game/scenes/${key}.webp`;
const sceneArtFallback = (key: string) => `/game/scenes/${key}.svg`;
const onSceneArtError = (key: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const el = e.currentTarget;
  if (el.dataset.fallback === '1') return;
  el.dataset.fallback = '1';
  el.src = sceneArtFallback(key);
};

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
  fuzhou: {
    label: '福州榕城',
    url: img('中国水墨武侠风场景插画，福州古城坊巷，巨大榕树垂须，青石板路，湿热薄雾，横向构图', 'landscape_16_9'),
  },
  hanyang: {
    label: '汉阳药市',
    url: img('中国水墨武侠风场景插画，汉阳江边药市，药铺幌子与煎药炉，蒸汽袅袅，百姓往来，横向构图', 'landscape_16_9'),
  },
  taishan: {
    label: '泰山十八盘',
    url: img('中国水墨武侠风场景插画，泰山十八盘石阶直上云端，日出金光，苍松怪石，横向构图', 'landscape_16_9'),
  },
  songshan: {
    label: '嵩山山门',
    url: img('中国水墨武侠风场景插画，嵩山古寺山门，千年古柏夹道，石狮斑驳，晨钟薄雾，横向构图', 'landscape_16_9'),
  },
  shaolin: {
    label: '少林藏经阁',
    url: img('中国水墨武侠风场景插画，少林藏经阁内部，满架经卷，烛火摇曳，木梯幽深，横向构图', 'landscape_16_9'),
  },
  wudang: {
    label: '武当金顶',
    url: img('中国水墨武侠风场景插画，武当金顶道观，云海翻涌，铜鹤香炉，青瓦飞檐，横向构图', 'landscape_16_9'),
  },
  emei: {
    label: '峨眉金顶',
    url: img('中国水墨武侠风场景插画，峨眉金顶云海佛光，金殿与经幡，雪松，横向构图', 'landscape_16_9'),
  },
  taiyi: {
    label: '太乙三生塔',
    url: img('中国水墨武侠风场景插画，太乙山三生塔，古塔三层立于山脊，野草石阶，暮色苍茫，横向构图', 'landscape_16_9'),
  },
};

/** 过场影像：按节点挂载本地 mp4，仅在点击时加载（preload=none），不拖慢首屏 */
const NODE_VIDEO: Record<string, { src: string; title: string }> = {
  'o-noble': { src: '/game/videos/trailer-1-luoyang.mp4', title: '洛阳残雪' },
  'o-orphan': { src: '/game/videos/trailer-1-luoyang.mp4', title: '青牛村雪' },
  'o-escort': { src: '/game/videos/trailer-1-luoyang.mp4', title: '威远镖旗' },
  a04: { src: '/game/videos/trailer-2-lantern.mp4', title: '上元灯市' },
  a07: { src: '/game/videos/trailer-6-peak.mp4', title: '夜袭黑风寨' },
  b01: { src: '/game/videos/trailer-3-jiangnan.mp4', title: '群雄帖' },
  c05: { src: '/game/videos/trailer-5-huashan.mp4', title: '绝顶决战' },
  c08: { src: '/game/videos/trailer-5-huashan.mp4', title: '华山论剑' },
  d07: { src: '/game/videos/trailer-6-peak.mp4', title: '地宫终局' },
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
  ...CHAPTER4_SCENES,
  ...CHAPTER5_SCENES,
  'end-judge': 'huashan', 'end-lord': 'huashan', 'end-hermit': 'jiangnan',
  'end-demon': 'dungeon', 'end-death': 'mist',
};

/** 人物头像（人头）：玩家按流派，敌人按身份。全部使用本地图片，避免线上接口不可用时空白 */
const PORTRAITS: Record<string, string> = {
  quan: '/game/portraits/quan.webp',
  jian: '/game/portraits/jian.webp',
  dao: '/game/portraits/dao.webp',
  黑塔: '/game/portraits/heita.webp',
  铁拳门主: '/game/portraits/tiequan.webp',
  血手堂杀手: '/game/portraits/xueshou.webp',
  殷无咎: '/game/portraits/yinwujiu.webp',
  苏挽: '/game/portraits/suwan.webp',
  山贼头目: '/game/portraits/shanzei.webp',
  独眼掌柜: '/game/portraits/duyan.webp',
  青城弟子: '/game/portraits/qingcheng.webp',
  魔教护法: '/game/portraits/mofu.webp',
  鞑靼千夫长: '/game/portraits/tatarchief.webp',
  黑心粮官: '/game/portraits/liangguan.webp',
  镇北侯: '/game/portraits/zhenbei.webp',
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
  鞑靼千夫长: {
    name: '鞑靼千夫长', school: 'dao', qi: 40, wit: 26, power: 0.95, hpBase: 70, hpPerDiff: 1.9,
    intro: '北地悍将，甲胄结冰，一柄弯刀专砍马腿与人颈。',
  },
  黑心粮官: {
    name: '黑心粮官', school: 'quan', qi: 34, wit: 38, power: 0.7, hpBase: 55, hpPerDiff: 1.6,
    intro: '文官出身却养了二十名弓手，最擅在粮册上做手脚。',
  },
  镇北侯: {
    name: '镇北侯', school: 'jian', qi: 60, wit: 46, power: 1.0, hpBase: 90, hpPerDiff: 2.0,
    intro: '边军主帅，剑走轻灵，帐下刀斧手如林。他信的从来不是公道，是银子。',
  },
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
  // ── 福州藏宝与各地奇珍（原作紫装）：三词条优先 暴击 / 吸血 / 速度 ──
  青冥剑: { slot: 'weapon', power: 34, crit: 8, lifesteal: 12, speed: 3, desc: '剑身幽青如夜，出鞘时似有鬼泣；紫装中少见的吸血剑。' },
  支离: { slot: 'weapon', power: 30, crit: 4, lifesteal: 10, speed: 2, desc: '断而复续的残剑，剑意支离，反能饮血自补。' },
  摘音剑: { slot: 'weapon', power: 26, crit: 6, lifesteal: 6, speed: 5, desc: '剑薄如叶，挥动时摘得清风一缕，快得只剩音。' },
  金刀: { slot: 'weapon', power: 32, crit: 6, speed: 1, desc: '刀身鎏金，重而不滞，一刀落下如闸门落水。' },
  非攻: { slot: 'weapon', power: 28, crit: 4, speed: 4, desc: '刀名「非攻」，不轻出鞘；出则只求止杀，不求多伤。' },
  修罗刀: { slot: 'weapon', power: 28, crit: 6, lifesteal: 4, desc: '刀背刻修罗像，杀气凝而不散。' },
  真武剑: { slot: 'weapon', power: 24, crit: 5, lifesteal: 6, desc: '武当制式长剑，剑脊刻玄武，沉稳绵长。' },
  乌缕衣: { slot: 'armor', power: 18, speed: 1, desc: '乌金细缕织成，轻若无物，却能卸去大半刀劲。' },
  紫金护手: { slot: 'accessory', power: 8, crit: 4, desc: '紫金护手，护住腕脉，出拳更稳更狠。' },
  青云戒: { slot: 'accessory', power: 6, crit: 5, speed: 3, desc: '青云石磨成的戒指，据说戴着它的人从不在雨里滑倒。' },
  冰蚕手套: { slot: 'accessory', power: 5, speed: 6, desc: '冰蚕丝织就，触手生凉，出手快得没有声息。' },
};

/** 词条文字：暴击 / 吸血 / 速度 */
function gearAffix(gear: GearDef): string {
  const parts: string[] = [];
  if (gear.crit) parts.push(`暴击 +${gear.crit}%`);
  if (gear.lifesteal) parts.push(`吸血 ${gear.lifesteal}%`);
  if (gear.speed) parts.push(`速度 ${gear.speed > 0 ? '+' : ''}${gear.speed}`);
  return parts.join(' · ');
}

/** 已装备物品的词条合计（含锻造与经脉会心） */
function gearStats(hero: Hero): { power: number; crit: number; lifesteal: number; speed: number } {
  const total = { power: 0, crit: 0, lifesteal: 0, speed: 0 };
  for (const { slot } of SLOT_LABELS) {
    const name = hero.equipped[slot];
    const gear = name ? GEAR[name] : null;
    if (!gear) continue;
    total.power += gear.power;
    total.crit += gear.crit ?? 0;
    total.lifesteal += gear.lifesteal ?? 0;
    total.speed += gear.speed ?? 0;
  }
  const forge = hero.forge ?? defaultForge();
  total.power += forge.power;
  total.crit += forge.crit;
  total.lifesteal += forge.lifesteal;
  total.speed += forge.speed;
  total.crit += meridianBonuses(hero.meridians ?? []).crit;
  return total;
}

/** 玩家出手速度：悟性 + 境界 + 装备 + 门派轻功 */
function heroSpeed(hero: Hero): number {
  return Math.round(10 + hero.wit * 0.16 + hero.level * 0.4 + gearStats(hero).speed + (sectOf(hero)?.speed ?? 0));
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
  灵芝散: { heal: 80, desc: '汉阳老药师所制，灵芝入药，回复 80 点气血。' },
  清心丹: { heal: 10, desc: '解毒清心，驱散流血并微回气血。' },
};
const MED_ORDER = ['金创药', '还魂草', '灵芝散', '清心丹'];
/** 可叠放的消耗品；其余物品（装备、信物）只保留一件 */
const STACKABLE = new Set(['金创药', '还魂草', '灵芝散', '草药', '矿石', '藏宝图碎片', '烧刀子', '虎骨膏', '清心丹', '剑意丸', '残页']);

/** 材料与杂物说明（行囊展示用） */
const ITEM_DESC: Record<string, string> = {
  草药: '山野采来的草药，可用于炼丹。',
  矿石: '含铁的粗矿石，锻造兵器时会用到。',
  藏宝图碎片: '残缺的藏宝图，集齐三片可在福州挖宝。',
  烧刀子: '关外烈酒，饮之酒意 +3。江湖上最好用的酒。',
  无名琴谱: '荒祠拾得的琴谱，曲调清冷，闲时可按谱弹奏。',
  残页: '武学残页，可用于提升已学秘籍等级。',
  虎骨膏: '下场战斗攻击临时 +8%。',
  清心丹: '战斗中驱散流血并微回气血。',
  剑意丸: '吞服后剑意 +15。',
};

/** 集市：明码标价，装备限购一件 */
const SHOP: { name: string; price: number; note: string }[] = [
  { name: '金创药', price: 15, note: '回复 30 气血 · 可叠放' },
  { name: '还魂草', price: 45, note: '回复 55 气血 · 可叠放' },
  { name: '烧刀子', price: 8, note: '酒意 +3 · 江上烈酒 · 可叠放' },
  { name: '草药', price: 6, note: '炼丹材料 · 可叠放' },
  { name: '软甲', price: 120, note: '护甲 · 减伤两成 · 速度 -2' },
  { name: '青玉哨', price: 60, note: '饰品 · 战力 +2 · 暴击 +3% · 速度 +4' },
  { name: '柳叶刀', price: 80, note: '兵器 · 战力 +9 · 暴击 +3% · 吸血 6%' },
  { name: '镇远剑', price: 260, note: '兵器 · 战力 +20 · 暴击 +5% · 吸血 12%' },
];

/** 本地存档：只存主线状态，战斗与奇遇的临时局面不入档 */
const SAVE_KEY = 'jianghu.save.v1';
/** 大厅礼包：claimedIds + pendingRewards，进游发放一次 */
const GIFTS_KEY = 'jianghu.gifts.v1';
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
  /** 多步任务进度 */
  questProgress?: QuestProgress;
  /** 当前接取中的链式任务 id */
  activeQuestId?: string | null;
};

type PendingGiftReward = {
  giftId: string;
  giftName: string;
  items: string[];
  silver?: number;
  contribution?: number;
};

/** 读取并清空 pendingRewards，返回待发放列表（claimedIds 保留防重领） */
function takePendingGifts(): PendingGiftReward[] {
  try {
    const raw = window.localStorage.getItem(GIFTS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { claimedIds?: string[]; pendingRewards?: PendingGiftReward[] };
    const pending = Array.isArray(data.pendingRewards) ? data.pendingRewards : [];
    if (pending.length === 0) return [];
    window.localStorage.setItem(
      GIFTS_KEY,
      JSON.stringify({ claimedIds: Array.isArray(data.claimedIds) ? data.claimedIds : [], pendingRewards: [] }),
    );
    return pending;
  } catch {
    return [];
  }
}

function grantPendingGifts(hero: Hero, pending: PendingGiftReward[]): { hero: Hero; lines: string[] } {
  if (pending.length === 0) return { hero, lines: [] };
  let next = hero;
  const lines: string[] = [];
  for (const gift of pending) {
    next = applyEffects(next, { items: gift.items, silver: gift.silver });
    if (gift.contribution) {
      next = { ...next, contribution: (next.contribution ?? 0) + gift.contribution };
    }
    const bits = [
      gift.items?.length ? gift.items.join('、') : '',
      gift.silver ? `银两 ×${gift.silver}` : '',
      gift.contribution ? `贡献 ×${gift.contribution}` : '',
    ].filter(Boolean);
    lines.push(`【礼包】领取「${gift.giftName}」：${bits.join(' · ') || '空'}`);
  }
  return { hero: next, lines };
}

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
      { label: '回洛阳养伤，再寻夺匣时机', effects: { hp: 10, silver: -10 }, next: 'a06' },
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
    text: '三月后，华山之巅，三十六派重立盟约。按江湖规矩，盟主之位需过三问：一问侠义，二问悟性，三问手中刀。风把你的衣角吹得猎猎作响，所有人都在等你开口——却不知山脚下，余烬已在复燃。',
    choices: [
      { label: '「江湖不是一个人的江湖。」', effects: { chivalry: 8 }, next: 'd01' },
      { label: '「刀在人在，规矩由我来定。」', effects: { chivalry: -4, qi: 4 }, next: 'd01' },
      { label: '「我志不在盟主。」', next: 'end-hermit' },
    ],
  },

  // ───────────────── 第四章 · 余烬 ─────────────────
  ...CHAPTER4_NODES,
  ...CHAPTER5_NODES,

  // ───────────────── 结局 ─────────────────
  'end-judge': {
    id: 'end-judge', chapter: 4, title: '华山之巅', ending: 'judge',
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
/** 学艺只认门派贡献，不认银两 */
const GRADE_CONTRIB: Record<Grade, number> = { D: 10, C: 25, B: 45, A: 70, S: 100 };
/** 秘籍归属门派：不传之秘，非本门弟子不得修习 */
const MANUAL_SECT: Record<string, string> = {
  'mq-d': 'shaolin', 'mq-c': 'shaolin', 'mq-b': 'shaolin', 'mq-a': 'shaolin', 'mq-s': 'shaolin',
  'mj-d': 'huashan', 'mj-c': 'huashan', 'mj-b': 'huashan', 'mj-a': 'wudang', 'mj-s': 'wudang',
  'md-d': 'songshan', 'md-c': 'songshan', 'md-b': 'songshan', 'md-a': 'songshan', 'md-s': 'songshan',
};
/** 内功归属门派 */
const INNER_SECT: Record<string, string> = {
  'in-d': 'emei', 'in-c': 'emei', 'in-b': 'taiyi', 'in-a': 'taiyi', 'in-s': 'shaolin',
};
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

/** 已拜门派（没有则返回 null） */
function sectOf(hero: Hero): Sect | null {
  return hero.sectKey ? SECTS.find((s) => s.key === hero.sectKey) ?? null : null;
}

/** 剑意会心加成：每 50 点 +2%，至多 +12% */
function swordIntentBonus(hero: Hero): number {
  return Math.min(12, Math.floor((hero.swordIntent ?? 0) / 50) * 2);
}

/** 内功反震：A 级 8%、S 级 15%（先免伤，后反伤） */
function innerReflect(hero: Hero): number {
  const grade = innerOf(hero)?.grade;
  if (grade === 'S') return 0.15;
  if (grade === 'A') return 0.08;
  return 0;
}

/** 多段攻击几率：剑法天生二连，A/S 级秘籍再加一些 */
function multiHitChance(hero: Hero): number {
  const base = hero.school === 'jian' ? 22 : hero.school === 'dao' ? 10 : 0;
  const grade = manualOf(hero)?.grade;
  return base + (grade === 'S' ? 12 : grade === 'A' ? 8 : 0);
}

/**
 * 酒意 → 酒量：只有身在江湖（游戏内）才会转化。
 * 每满 10 点酒意化 1 点酒量，每点酒量加 3 点气血上限。
 */
function gainWine(hero: Hero, amount: number): Hero {
  let wine = (hero.wine ?? 0) + amount;
  let capacity = hero.capacity ?? 0;
  let maxHp = hero.maxHp;
  let hp = hero.hp;
  while (wine >= 10) {
    wine -= 10;
    capacity += 1;
    maxHp += 3;
    hp = Math.min(maxHp, hp + 3);
  }
  return { ...hero, wine, capacity, maxHp, hp };
}

// ──────────────────────────── 江湖行程：洛阳 → 襄阳 → 西安 → 燕京 → 华山 ────────────────────────────

type Town = { key: string; name: string; grade: Grade; enemy: string; diff: number; desc: string; reward: string };

const TOWNS: Town[] = [
  { key: 'luoyang', name: '洛阳', grade: 'D', enemy: '黑塔', diff: 4, desc: '九朝古都，街市喧闹，城西乱葬岗常有悍匪出没。', reward: 'D 级武学' },
  { key: 'xiangyang', name: '襄阳', grade: 'C', enemy: '铁拳门主', diff: 10, desc: '南北要冲，城墙高厚，校场上终日有人比拳。', reward: 'C 级武学' },
  { key: 'xian', name: '西安', grade: 'B', enemy: '血手堂杀手', diff: 16, desc: '旧都长安，坊市深巷，夜里有人卖命也有人买命。', reward: 'B 级武学' },
  { key: 'yanjing', name: '燕京', grade: 'A', enemy: '血手堂杀手', diff: 23, desc: '天子脚下，王侯门前，刀客比官府更管用。', reward: 'A 级武学' },
  { key: 'huashan', name: '华山', grade: 'S', enemy: '殷无咎', diff: 30, desc: '西岳险绝，论剑台上旧痕未消，胜者留名。', reward: 'S 级武学' },
];

// ──────────────────────────── 门派：六派与门派贡献 ────────────────────────────

type Sect = {
  key: string;
  name: string;
  scene: string;
  /** 门派被动说明 */
  passive: string;
  /** 伤害加成（叠加到战力倍率） */
  atk?: number;
  /** 会心加成（百分点） */
  crit?: number;
  /** 速度加成 */
  speed?: number;
  /** 每回合额外回血 */
  regen?: number;
  /** 受到伤害的倍率（越小越抗打） */
  armor?: number;
  motto: string;
};

const SECTS: Sect[] = [
  {
    key: 'huashan', name: '华山派', scene: 'huashan', motto: '剑走轻灵，气贯长虹。',
    passive: '会心 +4%（剑意更盛）', crit: 4,
  },
  {
    key: 'shaolin', name: '少林派', scene: 'shaolin', motto: '禅武合一，金刚不坏。',
    passive: '伤害 +5%（拳出如锤）', atk: 0.05,
  },
  {
    key: 'emei', name: '峨眉派', scene: 'emei', motto: '云海佛光，剑心通明。',
    passive: '每回合回血 +2', regen: 2,
  },
  {
    key: 'wudang', name: '武当派', scene: 'wudang', motto: '动静相生，以柔克刚。',
    passive: '受到伤害 -6%（太极卸力）', armor: 0.94,
  },
  {
    key: 'taiyi', name: '太乙教', scene: 'taiyi', motto: '三生塔下，道法自然。',
    passive: '速度 +3（踏罡步斗）', speed: 3,
  },
  {
    key: 'songshan', name: '嵩山派', scene: 'songshan', motto: '嵩阳铁剑，势压群峰。',
    passive: '伤害 +4%、速度 +2', atk: 0.04, speed: 2,
  },
];

/** 门派堂口：原版每派分堂，各堂师父教授不同武学 */
const SECT_HALLS: Record<string, { hall: string; master: string; teaches: string }[]> = {
  shaolin: [
    { hall: '达摩院', master: '玄悲', teaches: '拳法 · 指法 · 内功' },
    { hall: '罗汉堂', master: '玄寂', teaches: '罗汉拳 · 金刚拳' },
    { hall: '般若堂', master: '玄难', teaches: '掌法 · 降龙伏虎' },
    { hall: '戒律院', master: '玄痛', teaches: '擒拿 · 心经' },
  ],
  wudang: [
    { hall: '紫霄宫', master: '张真人', teaches: '太极 · 剑法 S 级' },
    { hall: '真武堂', master: '宋远桥', teaches: '剑法 · 玄功' },
    { hall: '老君坛', master: '俞莲舟', teaches: '虎爪 · 内功' },
  ],
  emei: [
    { hall: '金顶禅院', master: '静玄', teaches: '吐纳 · 小无相' },
    { hall: '伏虎堂', master: '静照', teaches: '峨眉剑法' },
  ],
  huashan: [
    { hall: '玉女峰', master: '岳清玄', teaches: '青萍 · 回风剑法' },
    { hall: '思过崖', master: '封不平', teaches: '两仪 · 夺命十三剑' },
  ],
  songshan: [
    { hall: '嵩阳楼', master: '左冷禅', teaches: '刀法 · 铁剑' },
    { hall: '铁剑堂', master: '汤英鹗', teaches: '快刀 · 修罗刀' },
  ],
  taiyi: [
    { hall: '三生塔', master: '云阳子', teaches: '龟息 · 易筋经' },
    { hall: '丹房', master: '玄阳', teaches: '炼丹 · 内功' },
  ],
};

const SECT_CONTRIB_PRICE = 50; // 捐银 50 两 = 5 点贡献
const SECT_MANUAL_COST = 60; // 60 贡献换本门 S 级秘籍
const SECT_INNER_COST = 120; // 120 贡献换 S 级内功

// ──────────────────────────── 悬赏任务：除害 / 寻物 / 护送 ────────────────────────────

type QuestKind = '除害' | '寻物' | '护送' | '链式';

type Quest = {
  id: string;
  title: string;
  kind: QuestKind;
  scene: string;
  desc: string;
  minLevel: number;
  enemy?: string;
  difficulty?: number;
  reward: { exp: number; silver: number; contribution?: number; items?: string[] };
  steps?: { id: string; hint: string; action: string }[];
  nextQuestId?: string;
  tag?: string;
};

const QUESTS: Quest[] = [
  {
    id: 'q-luoyang', title: '黑风余孽', kind: '除害', scene: 'stronghold', minLevel: 1,
    enemy: '黑塔', difficulty: 8,
    desc: '黑风寨覆灭后仍有残党在断魂崖劫道，县衙悬赏十两，只求首级。',
    reward: { exp: 40, silver: 35, contribution: 5 },
  },
  {
    id: 'q-hanyang', title: '汉阳煎药', kind: '寻物', scene: 'hanyang', minLevel: 2,
    desc: '汉阳药铺的老药师缺一味引子，替他跑一趟江边药市，煎满十五副药。',
    reward: { exp: 45, silver: 22, contribution: 8, items: ['金创药', '草药'] },
  },
  {
    id: 'q-fuzhou', title: '榕城残图', kind: '寻物', scene: 'fuzhou', minLevel: 3,
    desc: '福州坊巷里流传一张藏宝图，据说集齐三片残图，能在榕树根下挖出紫装。',
    reward: { exp: 60, silver: 30, items: ['藏宝图碎片'] },
  },
  {
    id: 'q-taishan', title: '泰山轩辕剑阁', kind: '除害', scene: 'taishan', minLevel: 4,
    enemy: '青城弟子', difficulty: 20,
    desc: '轩辕剑阁七波守阁人，一波强过一波；并无硬闯必要，但剑意可在此磨砺。',
    reward: { exp: 90, silver: 55, contribution: 10, items: ['真武剑'] },
  },
  {
    id: 'q-songshan', title: '嵩山山门试炼', kind: '除害', scene: 'songshan', minLevel: 5,
    enemy: '铁拳门主', difficulty: 22,
    desc: '嵩山山门前的试炼石桩，守门人只认拳脚，不认名号。',
    reward: { exp: 110, silver: 60, contribution: 12 },
  },
  {
    id: 'q-shaolin', title: '藏经阁夜贼', kind: '除害', scene: 'shaolin', minLevel: 6,
    enemy: '血手堂杀手', difficulty: 24,
    desc: '有人夜入少林藏经阁，只偷一部旧经。知客僧请你守一夜。',
    reward: { exp: 130, silver: 70, contribution: 15, items: ['还魂草'] },
  },
  {
    id: 'q-wudang', title: '武当金顶问道', kind: '护送', scene: 'wudang', minLevel: 7,
    enemy: '魔教护法', difficulty: 26,
    desc: '一位老道长要上金顶还愿，魔教的人却已在山道上候着。',
    reward: { exp: 150, silver: 85, contribution: 18, items: ['乌缕衣'] },
  },
  {
    id: 'q-emei', title: '峨眉金顶佛光', kind: '寻物', scene: 'emei', minLevel: 7,
    desc: '峨眉师太要一株雪线以上的还魂草，云海佛光只在该出现时出现。',
    reward: { exp: 140, silver: 60, contribution: 12, items: ['还魂草', '紫金护手'] },
  },
  {
    id: 'q-taiyi', title: '太乙三生塔', kind: '除害', scene: 'taiyi', minLevel: 8,
    enemy: '独眼掌柜', difficulty: 23,
    desc: '三生塔下有人假扮道人收香火钱，太乙教请你清理门户。',
    reward: { exp: 160, silver: 95, contribution: 14, items: ['青云戒'] },
  },
  {
    id: 'q-jiangnan', title: '燕子坞护镖', kind: '护送', scene: 'jiangnan', minLevel: 10,
    enemy: '魔教护法', difficulty: 30,
    desc: '燕子坞的一船药材要送往襄阳，水路上不太平。',
    reward: { exp: 220, silver: 140, contribution: 20, items: ['冰蚕手套'] },
  },
  // 多步链与主线支线
  ...(ALL_CHAINS as unknown as Quest[]),
];

/** 福州挖宝奖池：原作中能锻造吸血的多为紫装 */
const TREASURE_POOL = ['青冥剑', '支离', '摘音剑', '金刀', '非攻', '修罗刀', '乌缕衣', '紫金护手', '青云戒', '冰蚕手套'];

/** 炼丹配方：草药 → 成药（含扩展） */
const RECIPES = RECIPES_EXT;

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
  4: CHAPTER4_LABEL,
  5: CHAPTER5_LABEL,
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
    sectKey: null,
    contribution: 0,
    wine: 0,
    capacity: 0,
    swordIntent: 0,
    meridians: [],
    lifeSkills: defaultLifeSkills(),
    forge: defaultForge(),
    manualLevel: 1,
    atkBuff: 0,
  };
}

/** 读档兼容：补齐养成字段 */
function normalizeHero(h: Hero): Hero {
  const meridians = h.meridians ?? [];
  const mb = meridianBonuses(meridians);
  const baseMax = Math.max(h.maxHp, originishMaxHp(h));
  const maxHp = baseMax + mb.maxHp + (h.capacity ?? 0) * 3;
  return {
    ...h,
    items: Array.isArray(h.items) ? h.items : [],
    equipped: {
      weapon: h.equipped?.weapon ?? null,
      armor: h.equipped?.armor ?? null,
      accessory: h.equipped?.accessory ?? null,
    },
    meridians,
    lifeSkills: h.lifeSkills ?? defaultLifeSkills(),
    forge: h.forge ?? defaultForge(),
    manualLevel: h.manualLevel ?? 1,
    atkBuff: h.atkBuff ?? 0,
    qi: h.qi + (h.meridians ? 0 : 0) + (meridians.length && !h.meridians ? mb.qi : 0),
    maxHp,
    hp: Math.min(h.hp, maxHp),
  };
}

function originishMaxHp(h: Hero): number {
  return Math.max(80, h.maxHp - meridianBonuses(h.meridians ?? []).maxHp);
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
function idleGain(
  minutes: number,
  hero?: Pick<Hero, 'meridians' | 'lifeSkills'> | null,
): { exp: number; silver: number } {
  const m = clamp(minutes, 0, IDLE_CAP_MIN);
  const mul = hero
    ? idleMultiplier(hero.meridians ?? [], hero.lifeSkills ?? defaultLifeSkills())
    : 1;
  return { exp: Math.floor(m * 0.15 * mul), silver: Math.floor(m * 0.22 * mul) };
}

/** 当前战力倍率：等级 + 装备 + 同流派秘籍 + 内功 + 秘籍等级 + 临时虎骨膏 */
function heroPower(hero: Hero): number {
  const manual = MANUALS.find((m) => m.id === hero.manualId);
  const inner = INNERS.find((i) => i.id === hero.innerId);
  const manualLv = hero.manualLevel ?? 1;
  let mul = 1 + (hero.level - 1) * 0.05 + gearBonus(hero) / 40;
  if (manual && manual.school === hero.school) mul += manual.atk + (manualLv - 1) * 0.03;
  if (inner) mul += inner.atk;
  mul += sectOf(hero)?.atk ?? 0;
  mul += hero.atkBuff ?? 0;
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

/** 刀法命中后有几率撕裂皮肉：两回合流血，普通 3 点、会心 5 点；多段攻击更易触发 */
function bleedFrom(school: SchoolKey, result: StrikeResult, chanceMul = 1): Bleed | null {
  if (school !== 'dao' || result.kind !== 'hit') return null;
  if (Math.random() * 100 >= 30 * chanceMul) return null;
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
  /** 连招点 0–COMBO_MAX */
  combo: number;
  /** 战斗内息资源 */
  breath: number;
  /** 技能冷却剩余回合 */
  skillCd: Partial<Record<SkillId, number>>;
  /** Boss 当前阶段 */
  phase: BossPhase;
  /** 敌人蓄力中 */
  enemyCharged: boolean;
  /** 震屏标记 */
  shake?: boolean;
};

/** 战斗飘字/命中特效：side 表示特效落在哪一方 */
type FxEvent = {
  id: number;
  side: 'player' | 'enemy';
  text: string;
  tone: 'dmg' | 'crit' | 'heal' | 'dodge' | 'parry' | 'combo' | 'phase';
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

/** 战斗舞台立绘：方框裁切 + 受光渐变，替代原来的圆形小头像 */
function StageArt({ name, side }: { name: string; side: 'left' | 'right' }) {
  const [failed, setFailed] = useState(false);
  const url = PORTRAITS[name];
  const isSchool = name in SCHOOLS;
  const emoji = isSchool ? SCHOOLS[name as SchoolKey].emoji : '🗡️';
  return (
    <div
      className={
        'relative h-32 w-24 overflow-hidden rounded-xl border-2 bg-black/40 shadow-[0_10px_28px_rgba(0,0,0,0.65)] sm:h-44 sm:w-32 ' +
        (side === 'left' ? 'border-accent/60' : 'border-danger/60')
      }
    >
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          onError={() => setFailed(true)}
          className={'h-full w-full object-cover ' + (side === 'right' ? 'scale-x-[-1]' : '')}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl">{emoji}</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
    </div>
  );
}

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
  const [videoOpen, setVideoOpen] = useState<{ src: string; title: string } | null>(null);
  // 对白逐字显示：模拟游戏对话框
  const [worldOpen, setWorldOpen] = useState(false);
  const worldAutoOpened = useRef(false);

  const [typedLen, setTypedLen] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [panel, setPanel] = useState<null | 'martial' | 'town' | 'bag' | 'quest' | 'sect' | 'meridian'>(null);
  const [cleared, setCleared] = useState<string[]>([]);
  const [questProgress, setQuestProgress] = useState<QuestProgress>({});
  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
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
        const gain = idleGain(minutes, data.hero);
        if (minutes >= 1 && (gain.exp > 0 || gain.silver > 0)) {
          setIdlePreview({ minutes: Math.floor(minutes), ...gain });
        }
        if (data.questProgress) setQuestProgress(data.questProgress);
        if (data.activeQuestId) setActiveQuestId(data.activeQuestId);
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
      questProgress,
      activeQuestId,
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // 存储不可用时静默跳过
    }
  }, [phase, hero, nodeId, cleared, battle, playerName, avatarKey, originKey, questProgress, activeQuestId]);

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
    let h = makeHero(origin, school);
    const pending = takePendingGifts();
    const gifted = grantPendingGifts(h, pending);
    h = gifted.hero;
    setHero(h);
    setNodeId(origin.node);
    setPhase('play');
    setEvent(null);
    setBattle(null);
    setEndingKey(null);
    setPanel(null);
    setCleared([]);
    setQuestProgress({});
    setActiveQuestId(null);
    travelCount.current = 0;
    logSeq.current = 2 + gifted.lines.length;
    setLogs([
      { id: 1, text: `「${playerName}」以「${origin.name}」的身份踏入江湖，主修${SCHOOLS[school].name}。`, tone: 'event' },
      { id: 2, text: `${CHAPTER_LABELS[NODES[origin.node].chapter]} · ${NODES[origin.node].title}`, tone: 'info' },
      ...gifted.lines.map((text, i) => ({ id: 3 + i, text, tone: 'win' as LogTone })),
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
    const restored = normalizeHero(saveData.hero);
    // 离线挂机结算：先补经验与银两，再进入江湖
    const gain = idlePreview;
    let resumed = restored;
    if (gain && (gain.exp > 0 || gain.silver > 0)) {
      resumed = grantExp({ ...restored, silver: restored.silver + gain.silver }, gain.exp);
    }
    const pending = takePendingGifts();
    const gifted = grantPendingGifts(resumed, pending);
    resumed = gifted.hero;
    setPlayerName(saveData.playerName);
    setAvatarKey(saveData.avatarKey);
    setOriginKey(saveData.originKey || null);
    setHero(resumed);
    setNodeId(saveData.nodeId);
    setCleared(saveData.cleared ?? []);
    setQuestProgress(saveData.questProgress ?? {});
    setActiveQuestId(saveData.activeQuestId ?? null);
    setPhase('play');
    setEvent(null);
    setBattle(null);
    setEndingKey(null);
    setPanel(null);
    travelCount.current = 0;
    logSeq.current = 1;
    setLogs([{ id: 1, text: `续接江湖录 · ${NODES[saveData.nodeId].title}`, tone: 'info' }]);
    for (const line of gifted.lines) pushLog(line, 'win');
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

  // 选完出身 / 重开后，自动落地世界，避免一上来就是文字页
  useEffect(() => {
    if (worldAutoOpened.current) return;
    if (phase !== 'play' || !hero || !originKey) return;
    worldAutoOpened.current = true;
    setWorldOpen(true);
  }, [phase, hero, originKey]);

  // 逐字显示当前节点正文；切换节点时重置
  useEffect(() => {
    const text = NODES[nodeId]?.text ?? "";
    setTypedLen(0);
    setTypingDone(text.length === 0);
    if (!text.length) return;
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setTypedLen(i);
      if (i >= text.length) {
        window.clearInterval(timer);
        setTypingDone(true);
      }
    }, 22);
    return () => window.clearInterval(timer);
  }, [nodeId]);

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
    // 行走江湖也会积下酒意：酒意满 10 点化为酒量（只在游戏内转化）
    const next = gainWine(applyEffects(hero, choice.effects), 1);
    // 25% 概率触发江湖奇遇（结局节点除外）；先落定本次抉择的属性变化，再进奇遇
    const target = NODES[choice.next];
    travelCount.current += 1;
    if (target && !target.ending && Math.random() < 0.25 && travelCount.current > 1) {
      const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      setHero(next);
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
    const next = gainWine(applyEffects(hero, choice.effects), 1);
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
    const sectKey = MANUAL_SECT[m.id];
    const sect = SECTS.find((x) => x.key === sectKey);
    const sectName = sect?.name ?? "门派";
    if (hero.sectKey !== sectKey) {
      pushLog(`《${m.name}》是${sectName}不传之秘，须先拜入${sectName}方能修习。`, 'lose');
      return;
    }
    const need = GRADE_CONTRIB[m.grade];
    const have = hero.contribution ?? 0;
    if (have < need) {
      pushLog(`【${sectName}】贡献不足（需 ${need}，现有 ${have}）。可捐银或接悬赏积累。`, 'lose');
      return;
    }
    setHero({ ...hero, contribution: have - need, manualId: m.id });
    pushLog(`【秘籍】以 ${need} 点${sectName}贡献研习《${m.name}》（${m.grade} 级），伤害 +${Math.round(m.atk * 100)}%`, 'win');
  };

  const learnInner = (i: Inner) => {
    if (!hero) return;
    const cur = innerOf(hero);
    if (cur && GRADE_INDEX[cur.grade] >= GRADE_INDEX[i.grade]) {
      pushLog(`已修成同级或更高的内功，无需再练《${i.name}》`, 'lose');
      return;
    }
    const sectKey = INNER_SECT[i.id];
    const sect = SECTS.find((x) => x.key === sectKey);
    const sectName = sect?.name ?? "门派";
    if (hero.sectKey !== sectKey) {
      pushLog(`《${i.name}》为${sectName}心法，须先拜入${sectName}方能修习。`, 'lose');
      return;
    }
    const need = GRADE_CONTRIB[i.grade];
    const have = hero.contribution ?? 0;
    if (have < need) {
      pushLog(`【${sectName}】贡献不足（需 ${need}，现有 ${have}）。`, 'lose');
      return;
    }
    setHero({ ...hero, contribution: have - need, innerId: i.id });
    pushLog(`【内功】以 ${need} 点${sectName}贡献修习《${i.name}》，每回合回气 ${i.regen}`, 'win');
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
    const isBoss = BOSS_NAMES.has(enemyDef.name);
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
      combo: 0,
      breath: 5 + Math.floor((hero.qi + meridianBonuses(hero.meridians ?? []).qi) / 20),
      skillCd: {},
      phase: 1,
      enemyCharged: false,
      lines: [
        {
          id: 0,
          text: `${isBoss ? '【Boss】' : ''}${enemyDef.name}拦住去路：${enemyDef.intro}`,
          tone: 'info',
        },
      ],
    });
    // 开战消耗虎骨膏临时加成（保留到本场结束由 settle 清）
  };

  const pushBattleLine = (text: string, tone: LogTone) => {
    setBattle((prev) => {
      if (!prev) return prev;
      battleSeq.current += 1;
      return { ...prev, lines: [...prev.lines, { id: battleSeq.current, text, tone }].slice(-60) };
    });
  };

  // ——— 门派：拜师 / 捐银 / 贡献换 S 级武学 ———

  const joinSect = (s: Sect) => {
    if (!hero) return;
    const cur = sectOf(hero);
    if (cur) {
      pushLog(cur.key === s.key ? `你已是${s.name}门人。` : `你已身在${cur.name}，江湖规矩不许脚踏两条船。`, cur.key === s.key ? 'info' : 'lose');
      return;
    }
    setHero({ ...hero, sectKey: s.key, contribution: hero.contribution ?? 0 });
    pushLog(`【门派】你拜入${s.name}门下：${s.passive}`, 'win');
  };

  /** 退出师门：贡献保留，可另投他派（对齐原版「攒贡献退门转派」） */
  const leaveSect = () => {
    if (!hero) return;
    const s = sectOf(hero);
    if (!s) return;
    const keep = hero.contribution ?? 0;
    setHero({ ...hero, sectKey: null });
    pushLog(`【门派】你退出${s.name}，${keep} 点贡献保留在身，随时可另投他派。`, 'event');
  };

  const donateSect = () => {
    if (!hero) return;
    const s = sectOf(hero);
    if (!s) return;
    if (hero.silver < SECT_CONTRIB_PRICE) {
      pushLog(`【${s.name}】捐银需 ${SECT_CONTRIB_PRICE} 两，现有 ${hero.silver} 两。`, 'lose');
      return;
    }
    const contribution = (hero.contribution ?? 0) + 5;
    setHero({ ...hero, silver: hero.silver - SECT_CONTRIB_PRICE, contribution });
    pushLog(`【${s.name}】捐银 ${SECT_CONTRIB_PRICE} 两，门派贡献 +5（现 ${contribution}）。`, 'win');
  };

  const claimSectManual = () => {
    if (!hero) return;
    const s = sectOf(hero);
    if (!s) return;
    const target = MANUALS.find((m) => m.school === hero.school && m.grade === 'S');
    const cur = manualOf(hero);
    if (!target) return;
    if (cur && GRADE_INDEX[cur.grade] >= GRADE_INDEX.S) {
      pushLog(`【${s.name}】你已习得 S 级秘籍。`, 'lose');
      return;
    }
    const contribution = hero.contribution ?? 0;
    if (contribution < SECT_MANUAL_COST) {
      pushLog(`【${s.name}】贡献不足（需 ${SECT_MANUAL_COST}，现有 ${contribution}）。`, 'lose');
      return;
    }
    setHero({ ...hero, contribution: contribution - SECT_MANUAL_COST, manualId: target.id });
    pushLog(`【${s.name}】以 ${SECT_MANUAL_COST} 贡献换来《${target.name}》，S 级秘籍入手。`, 'win');
  };

  const claimSectInner = () => {
    if (!hero) return;
    const s = sectOf(hero);
    if (!s) return;
    const target = INNERS.find((i) => i.grade === 'S');
    const cur = innerOf(hero);
    if (!target) return;
    if (cur && GRADE_INDEX[cur.grade] >= GRADE_INDEX.S) {
      pushLog(`【${s.name}】你已修成 S 级内功。`, 'lose');
      return;
    }
    const contribution = hero.contribution ?? 0;
    if (contribution < SECT_INNER_COST) {
      pushLog(`【${s.name}】贡献不足（需 ${SECT_INNER_COST}，现有 ${contribution}）。`, 'lose');
      return;
    }
    setHero({ ...hero, contribution: contribution - SECT_INNER_COST, innerId: target.id });
    pushLog(`【${s.name}】以 ${SECT_INNER_COST} 贡献换来《${target.name}》，内功大成。`, 'win');
  };

  // ——— 悬赏任务：除害 / 护送打一场，寻物直接跑腿；链式按步骤推进 ———

  const grantQuestReward = (q: Quest, base: Hero) => {
    let next = grantExp({ ...base, silver: base.silver + q.reward.silver }, q.reward.exp);
    if (q.reward.contribution) next = { ...next, contribution: (next.contribution ?? 0) + q.reward.contribution };
    if (q.reward.items?.length) next = applyEffects(next, { items: q.reward.items });
    pushLog(
      `【悬赏·${q.title}】办妥了：银两 +${q.reward.silver}${
        q.reward.contribution ? `、贡献 +${q.reward.contribution}` : ''
      }${q.reward.items?.length ? `、得「${q.reward.items.join('、')}」` : ''}`,
      'win',
    );
    if (!cleared.includes(q.id)) setCleared((prev) => [...prev, q.id]);
    setQuestProgress((prev) => ({ ...prev, [q.id]: { step: q.steps?.length ?? 0, done: true } }));
    setActiveQuestId(q.nextQuestId ?? null);
    return gainWine(next, 2);
  };

  const acceptQuest = (q: Quest) => {
    if (!hero) return;
    if (hero.level < q.minLevel) {
      pushLog(`【悬赏·${q.title}】需 ${q.minLevel} 级才接得下。`, 'lose');
      return;
    }
    if (cleared.includes(q.id) && !q.steps) {
      pushLog(`【悬赏·${q.title}】此悬赏已了结。`, 'info');
      return;
    }

    // 链式任务
    if (q.steps?.length) {
      const st = questProgress[q.id] ?? { step: 0 };
      if (st.done) {
        pushLog(`【悬赏·${q.title}】此链已完成。`, 'info');
        return;
      }
      // 步骤已齐 → 领奖
      if (st.step >= q.steps.length) {
        // 交付类：消耗对应物品
        if (q.id === 'q-fuzhou-chain') {
          const purple = TREASURE_POOL.find((n) => hero.items.includes(n));
          if (!purple) {
            pushLog('【榕城三残图】交还需消耗一件紫装，行囊中暂无。', 'lose');
            return;
          }
          setHero(grantQuestReward(q, applyEffects(hero, { removeItems: [purple] })));
          return;
        }
        if (q.id === 'q-valley-herb') {
          if (itemCount(hero, '草药') < 5) {
            pushLog('【药王谷急采】草药不足 5 株。', 'lose');
            return;
          }
          const rem = Array.from({ length: 5 }, () => '草药');
          setHero(grantQuestReward(q, applyEffects(hero, { removeItems: rem })));
          return;
        }
        setHero(grantQuestReward(q, hero));
        return;
      }
      const step = q.steps[st.step];
      setActiveQuestId(q.id);
      if (step.action === 'fight' && q.enemy) {
        setPanel(null);
        startBattle({ enemy: q.enemy, difficulty: q.difficulty ?? 10, win: nodeId, lose: nodeId, quest: q.id });
        return;
      }
      pushLog(`【悬赏·${q.title}】已接取。${questStepHint(q as never, questProgress)}`, 'event');
      return;
    }

    if (q.kind === '寻物') {
      if (Math.random() < 0.8) {
        setHero(grantQuestReward(q, hero));
      } else {
        setHero(grantExp({ ...hero, silver: hero.silver + 8 }, 6));
        pushLog(`【悬赏·${q.title}】白跑一趟，只讨回几两脚力钱。`, 'lose');
      }
      return;
    }
    if (!q.enemy) return;
    setPanel(null);
    startBattle({ enemy: q.enemy, difficulty: q.difficulty ?? 10, win: nodeId, lose: nodeId, quest: q.id });
  };

  const bumpQuest = (action: 'explore' | 'fight' | 'deliver' | 'craft' | 'talk') => {
    const id = activeQuestId;
    if (!id) return;
    const q = QUESTS.find((x) => x.id === id);
    if (!q?.steps) return;
    const result = advanceQuestStep(questProgress, id, action, ALL_CHAINS);
    setQuestProgress(result.progress);
    if (result.message) pushLog(result.message, 'event');
  };

  // ——— 场景探索 / 福州挖宝 / 炼丹 / 饮酒弹琴 ———

  const exploreHerbs = () => {
    if (!hero) return;
    if (hero.silver < 5) {
      pushLog('【探索】采药也要雇脚夫，银两只剩这么点。', 'lose');
      return;
    }
    const skills = hero.lifeSkills ?? defaultLifeSkills();
    const lv = skills.herb.level;
    const herbs = 2 + Math.floor(lv / 3);
    let next = applyEffects({ ...hero, silver: hero.silver - 5 }, { items: Array.from({ length: herbs }, () => '草药') });
    next = { ...next, lifeSkills: gainLifeSkill(skills, 'herb', 8 + lv) };
    const lucky = Math.random() < 0.2 + lv * 0.03;
    if (lucky) next = applyEffects(next, { items: ['金创药'] });
    pushLog(`【探索·采药 Lv.${lv}】采得草药 ${herbs} 株${lucky ? '，还顺手挖到一瓶金创药' : ''}。`, 'win');
    setHero(gainWine(next, 1));
    bumpQuest('explore');
  };

  const exploreTreasure = () => {
    if (!hero) return;
    if (hero.silver < 10) {
      pushLog('【探索】打探消息也要花钱。', 'lose');
      return;
    }
    const skills = hero.lifeSkills ?? defaultLifeSkills();
    let next: Hero = {
      ...hero,
      silver: hero.silver - 10,
      lifeSkills: gainLifeSkill(skills, 'mine', 6),
    };
    const roll = Math.random();
    const mineLv = skills.mine.level;
    if (roll < 0.4 + mineLv * 0.02) {
      next = applyEffects(next, { items: ['藏宝图碎片'] });
      pushLog('【探索·打探】酒肆里有人说漏了嘴，你拾得一片藏宝残图。', 'win');
    } else if (roll < 0.75) {
      const ores = 1 + (mineLv >= 5 ? 1 : 0);
      next = applyEffects(next, { items: Array.from({ length: ores }, () => '矿石') });
      pushLog(`【探索·挖矿 Lv.${mineLv}】收得矿石 ×${ores}。`, 'info');
    } else {
      next = grantExp({ ...next, silver: next.silver + 25 }, 8);
      pushLog('【探索·打探】没打听到宝藏，倒接了个跑腿活，挣得 25 两。', 'info');
    }
    // 破庙场景探索推进「血书真伪」问老者
    if (NODE_SCENE[nodeId] === 'temple') bumpQuest('talk');
    setHero(gainWine(next, 1));
    bumpQuest('explore');
  };

  const digTreasure = () => {
    if (!hero) return;
    if (itemCount(hero, '藏宝图碎片') < 3) {
      pushLog('【福州·挖宝】残图不足三片，还拼不出完整藏宝图。', 'lose');
      return;
    }
    if (hero.silver < 20) {
      pushLog('【福州·挖宝】雇人挖土需 20 两。', 'lose');
      return;
    }
    const prize = TREASURE_POOL[Math.floor(Math.random() * TREASURE_POOL.length)];
    const owned = hero.items.includes(prize);
    let next = applyEffects(hero, {
      removeItems: ['藏宝图碎片', '藏宝图碎片', '藏宝图碎片'],
      items: owned ? [] : [prize],
    });
    next = { ...next, silver: next.silver - 20 + (owned ? 120 : 0) };
    pushLog(
      owned
        ? `【福州·挖宝】榕树根下掘得「${prize}」，你已有一件，转手卖了 120 两。`
        : `【福州·挖宝】三片残图合一，榕树根下掘得「${prize}」！`,
      'win',
    );
    setHero(gainWine(next, 1));
    bumpQuest('explore');
  };

  const craftMed = (name: string) => {
    if (!hero) return;
    const recipe = RECIPES.find((r) => r.name === name);
    if (!recipe) return;
    if (itemCount(hero, '草药') < recipe.herbs) {
      pushLog(`【炼丹】草药不足：炼${name}需 ${recipe.herbs} 株。`, 'lose');
      return;
    }
    const skills = hero.lifeSkills ?? defaultLifeSkills();
    const chance = craftSuccessChance(skills.alchemy.level, recipe.failBase ?? 0.1);
    const consumed = Array.from({ length: recipe.herbs }, () => '草药');
    let next = applyEffects(hero, { removeItems: consumed });
    next = { ...next, lifeSkills: gainLifeSkill(skills, 'alchemy', 10) };
    if (Math.random() > chance) {
      pushLog(`【炼丹】丹炉炸烟，${recipe.herbs} 株草药化作一缕青烟（成功率 ${Math.round(chance * 100)}%）。`, 'lose');
      setHero(next);
      bumpQuest('craft');
      return;
    }
    if (name === '剑意丸') {
      next = { ...next, swordIntent: (next.swordIntent ?? 0) + 15 };
      pushLog('【炼丹】剑意丸入腹，剑意 +15。', 'win');
    } else if (name === '虎骨膏') {
      next = applyEffects(next, { items: ['虎骨膏'] });
      pushLog('【炼丹】炼成虎骨膏：下场战斗攻击 +8%。', 'win');
    } else {
      next = applyEffects(next, { items: [name] });
      pushLog(`【炼丹】${recipe.herbs} 株草药炼成一剂${name}。`, 'win');
    }
    setHero(next);
    bumpQuest('craft');
  };

  /** 锻造：消耗矿石+银两，强化全局词条 */
  const forgeWeapon = () => {
    if (!hero) return;
    if (itemCount(hero, '矿石') < FORGE_COST.ore) {
      pushLog(`【锻造】矿石不足（需 ${FORGE_COST.ore}）。`, 'lose');
      return;
    }
    if (hero.silver < FORGE_COST.silver) {
      pushLog(`【锻造】银两不足（需 ${FORGE_COST.silver}）。`, 'lose');
      return;
    }
    const rem = Array.from({ length: FORGE_COST.ore }, () => '矿石');
    const forge = { ...(hero.forge ?? defaultForge()) };
    const roll = Math.random();
    let tip = '';
    if (roll < 0.35) {
      forge.crit += 1;
      tip = '暴击 +1%';
    } else if (roll < 0.6) {
      forge.lifesteal += 1;
      tip = '吸血 +1%';
    } else if (roll < 0.85) {
      forge.speed += 1;
      tip = '速度 +1';
    } else {
      forge.power += 2;
      tip = '战力 +2';
    }
    const next = applyEffects(
      { ...hero, silver: hero.silver - FORGE_COST.silver, forge },
      { removeItems: rem },
    );
    pushLog(`【锻造】锤声落定：${tip}（累计 暴${forge.crit}/吸${forge.lifesteal}/速${forge.speed}/力${forge.power}）。`, 'win');
    setHero(next);
  };

  /** 点亮经脉穴位 */
  const openMeridian = (key: MeridianKey) => {
    if (!hero) return;
    const opened = hero.meridians ?? [];
    const def = MERIDIANS.find((m) => m.key === key);
    if (!def) return;
    if (!canOpenMeridian(opened, key)) {
      pushLog(`【经脉】「${def.name}」条件未足或已点亮。`, 'lose');
      return;
    }
    if (hero.exp < def.costExp) {
      pushLog(`【经脉】经验不足（需 ${def.costExp}，现有 ${hero.exp}）。`, 'lose');
      return;
    }
    const nextOpened = [...opened, key];
    const mb = meridianBonuses(nextOpened);
    const prevMb = meridianBonuses(opened);
    const maxHp = hero.maxHp + (mb.maxHp - prevMb.maxHp);
    const qi = clamp(hero.qi + (mb.qi - prevMb.qi), 0, 100);
    setHero({
      ...hero,
      exp: hero.exp - def.costExp,
      meridians: nextOpened,
      maxHp,
      hp: Math.min(hero.hp + (mb.maxHp - prevMb.maxHp), maxHp),
      qi,
    });
    pushLog(`【经脉】点亮「${def.name}」：${def.desc}`, 'win');
  };

  /** 残页升级秘籍 */
  const upgradeManual = () => {
    if (!hero?.manualId) {
      pushLog('【武学】尚未学会秘籍。', 'lose');
      return;
    }
    if (itemCount(hero, '残页') < 1) {
      pushLog('【武学】缺少残页。', 'lose');
      return;
    }
    const lv = hero.manualLevel ?? 1;
    if (lv >= 5) {
      pushLog('【武学】秘籍已至圆满。', 'info');
      return;
    }
    const next = applyEffects({ ...hero, manualLevel: lv + 1 }, { removeItems: ['残页'] });
    pushLog(`【武学】研读残页，秘籍升至 Lv.${lv + 1}（攻击倍率提升）。`, 'win');
    setHero(next);
  };

  /** 战前吞虎骨膏 */
  const useAtkPaste = () => {
    if (!hero) return;
    if (itemCount(hero, '虎骨膏') < 1) {
      pushLog('【虎骨膏】行囊中没有。', 'lose');
      return;
    }
    if ((hero.atkBuff ?? 0) > 0) {
      pushLog('【虎骨膏】药效尚在，无需再服。', 'info');
      return;
    }
    setHero(applyEffects({ ...hero, atkBuff: 0.08 }, { removeItems: ['虎骨膏'] }));
    pushLog('【虎骨膏】下场战斗攻击 +8%。', 'win');
  };

  const drinkWine = () => {
    if (!hero) return;
    if (itemCount(hero, '烧刀子') < 1) {
      pushLog('【饮酒】酒囊空了，去集市买壶烧刀子吧。', 'lose');
      return;
    }
    const skills = hero.lifeSkills ?? defaultLifeSkills();
    const next = gainWine(
      {
        ...applyEffects(hero, { removeItems: ['烧刀子'], hp: 2 }),
        lifeSkills: gainLifeSkill(skills, 'qinwine', 5),
      },
      3,
    );
    pushLog(`【饮酒】一口烧刀子下肚，酒意 +3（现 ${next.wine ?? 0}/10，酒量 ${next.capacity ?? 0}）。`, 'info');
    setHero(next);
  };

  const playQin = () => {
    if (!hero) return;
    if (!hero.items.includes('无名琴谱')) {
      pushLog('【弹琴】手上没有琴谱，弹不出调子。', 'lose');
      return;
    }
    if (hero.silver < 3) {
      pushLog('【弹琴】香烛钱也不够。', 'lose');
      return;
    }
    const skills = hero.lifeSkills ?? defaultLifeSkills();
    let next: Hero = {
      ...hero,
      silver: hero.silver - 3,
      lifeSkills: gainLifeSkill(skills, 'qinwine', 8),
    };
    const chance = 0.25 + skills.qinwine.level * 0.04;
    if (Math.random() < chance) {
      next = applyEffects(next, { wit: 1 });
      pushLog(`【弹琴 Lv.${skills.qinwine.level}】一曲既罢，心神通透：悟性 +1。`, 'win');
    } else {
      pushLog('【弹琴】烟波吟散入夜色，并无实际效用。', 'info');
    }
    setHero(gainWine(next, 1));
  };

  /**
   * 一回合：技能 / 连招 / 敌人 AI / Boss 阶段。
   * action: attack=普攻, skill=流派招, finisher=终结, inner=内息护体, heal=吃药
   */
  const actRound = (
    action: 'attack' | 'heal' | 'skill' | 'finisher' | 'inner',
    medName?: string,
  ) => {
    if (!hero || !battle || battle.over) return;
    const { enemyDef } = battle;
    const skills = schoolSkills(hero.school);
    let playerHp = battle.playerHp;
    let enemyHp = battle.enemyHp;
    let enemyBleed = battle.enemyBleed;
    let playerBleed = battle.playerBleed;
    let playerStun = battle.playerStun;
    let enemyStun = battle.enemyStun;
    let combo = battle.combo ?? 0;
    let breath = battle.breath ?? 5;
    const skillCd = { ...(battle.skillCd ?? {}) };
    let phase = battle.phase ?? 1;
    let enemyCharged = battle.enemyCharged ?? false;
    let shake = false;
    let nextHero = hero;
    let done = false;

    // 冷却 tick
    for (const k of Object.keys(skillCd) as SkillId[]) {
      if ((skillCd[k] ?? 0) > 0) skillCd[k] = (skillCd[k] ?? 0) - 1;
    }

    const fxFrom = (side: 'player' | 'enemy', r: StrikeResult): Omit<FxEvent, 'id'> =>
      r.kind === 'dodge'
        ? { side, text: '闪避', tone: 'dodge' }
        : r.kind === 'parry'
          ? { side, text: `-${r.dmg}`, tone: 'parry' }
          : { side, text: `-${r.dmg}`, tone: r.crit ? 'crit' : 'dmg' };

    const finish = (over: 'win' | 'lose') => {
      done = true;
      setBattle((prev) => (prev ? { ...prev, enemyHp, playerHp, over, combo, breath, skillCd, phase, enemyCharged, shake } : prev));
    };

    const applyHitEffects = (result: StrikeResult, statusMul: number, skillKind: SkillId) => {
      const gear = gearStats(hero);
      enemyHp = Math.max(0, enemyHp - result.dmg);
      if (result.dmg > 0 && gear.lifesteal > 0) {
        const steal = Math.max(1, Math.round((result.dmg * gear.lifesteal) / 100));
        const healed = Math.min(hero.maxHp, playerHp + steal) - playerHp;
        if (healed > 0) {
          playerHp += healed;
          addFx([{ side: 'player', text: `+${healed}`, tone: 'heal' }]);
        }
      }
      const stunChance =
        hero.school === 'quan' || skillKind === 'school'
          ? (result.crit ? 35 : 18) * statusMul * (hero.school === 'quan' ? 1 : 0.5)
          : 0;
      if (result.kind === 'hit' && Math.random() * 100 < stunChance) {
        enemyStun = Math.max(enemyStun, result.crit ? 2 : 1);
        pushBattleLine(`${enemyDef.name}被震得气血翻涌，眩晕 ${enemyStun} 回合！`, 'win');
      }
      const bleedMul = skillKind === 'school' && hero.school === 'dao' ? 1.8 : statusMul;
      const fresh = bleedFrom(hero.school, result, bleedMul);
      if (fresh) {
        enemyBleed = fresh;
        pushBattleLine(`${enemyDef.name}血流不止（${fresh.rounds} 回合 ×${fresh.dmg}）。`, 'win');
      }
    };

    const playerTurn = () => {
      if (playerStun > 0) {
        playerStun -= 1;
        pushBattleLine(`你气血翻涌，被震得动弹不得（眩晕剩 ${playerStun} 回合）。`, 'lose');
        return;
      }
      if (action === 'heal') {
        const med = medName && hero.items.includes(medName) ? medName : null;
        if (!med) return;
        const amount = MEDS[med]?.heal ?? 0;
        nextHero = applyEffects(hero, { removeItems: [med] });
        playerHp = Math.min(hero.maxHp, playerHp + amount);
        if (med === '清心丹') playerBleed = null;
        setHero(nextHero);
        addFx([{ side: 'player', text: `+${amount}`, tone: 'heal' }]);
        pushBattleLine(`你服下${med}，气血回复 ${amount} 点${med === '清心丹' ? '，血流渐止' : ''}。`, 'win');
        return;
      }
      if (action === 'inner') {
        const sk = skills.inner;
        if (breath < sk.cost || (skillCd.inner ?? 0) > 0) {
          pushBattleLine('内息不足或护体尚在冷却。', 'lose');
          return;
        }
        breath -= sk.cost;
        skillCd.inner = sk.cd;
        const heal = 18 + Math.round(hero.qi * 0.2);
        playerHp = Math.min(hero.maxHp, playerHp + heal);
        addFx([{ side: 'player', text: `+${heal}`, tone: 'heal' }]);
        pushBattleLine(`【内息护体】你闭气收势，回复 ${heal} 点气血。`, 'win');
        return;
      }

      let skillId: SkillId = 'basic';
      let powerMul = 1;
      if (action === 'skill') {
        const sk = skills.school;
        if (breath < sk.cost || (skillCd.school ?? 0) > 0) {
          pushBattleLine(`${sk.name}内息不足或冷却中。`, 'lose');
          return;
        }
        breath -= sk.cost;
        skillCd.school = sk.cd;
        skillId = 'school';
        powerMul = sk.powerMul;
        pushBattleLine(`你使出【${sk.name}】！`, 'event');
      } else if (action === 'finisher') {
        if (combo < COMBO_MAX) {
          pushBattleLine(`连招未满（${combo}/${COMBO_MAX}），无法释放终结技。`, 'lose');
          return;
        }
        skillId = 'finisher';
        powerMul = skills.finisher.powerMul;
        combo = 0;
        shake = true;
        addFx([{ side: 'enemy', text: '终结!', tone: 'combo' }]);
        pushBattleLine(`【连招终结】${skills.finisher.name}！`, 'win');
      }

      const gear = gearStats(hero);
      const mb = meridianBonuses(hero.meridians ?? []);
      const power = heroPower(hero) * powerMul;
      const critBonus = gear.crit + (sectOf(hero)?.crit ?? 0) + swordIntentBonus(hero) + mb.crit;
      const hits =
        skillId === 'school' && hero.school === 'jian'
          ? 2
          : 1 + (action === 'attack' && Math.random() * 100 < multiHitChance(hero) ? 1 : 0);
      const statusMul = hits > 1 ? 1.5 : 1;
      let landed = false;
      for (let h = 0; h < hits; h += 1) {
        if (h > 0) pushBattleLine('招式连环，第二击又至！', 'info');
        const result = strike(
          hero.school,
          hero.qi + mb.qi,
          hero.wit,
          power * (h > 0 ? 0.55 : 1),
          enemyDef.wit,
          enemyDef.qi,
          critBonus,
        );
        // 经脉闪避/招架修正体现于防守方时在敌方回合；攻击方此处只打伤害
        const line = strikeText('player', enemyDef.name, hero.school, result);
        pushBattleLine(line.text, line.tone);
        addFx([fxFrom('enemy', result)]);
        if (result.dmg > 0) landed = true;
        applyHitEffects(result, statusMul, skillId);
        if (enemyHp <= 0) {
          pushBattleLine(`【胜】${enemyDef.name}倒下了。`, 'win');
          finish('win');
          return;
        }
      }
      if (landed) {
        const gain = skillId === 'school' ? 2 : skillId === 'finisher' ? 0 : 1;
        combo = Math.min(COMBO_MAX, combo + gain);
        if (combo >= COMBO_MAX) addFx([{ side: 'player', text: '连招满', tone: 'combo' }]);
      }
      // Boss 阶段检测
      const ratio = enemyHp / battle.enemyMaxHp;
      const nextPhase = bossPhase(ratio);
      if (nextPhase > phase) {
        phase = nextPhase;
        shake = true;
        const label = bossPhaseLabel(enemyDef.name, phase);
        if (label) {
          pushBattleLine(label, 'event');
          addFx([{ side: 'enemy', text: `阶段${phase}`, tone: 'phase' }]);
        }
      }
    };

    const enemyTurn = () => {
      if (enemyStun > 0) {
        enemyStun -= 1;
        pushBattleLine(`${enemyDef.name}头晕目眩，这一招落在空处（眩晕剩 ${enemyStun} 回合）。`, 'win');
        return;
      }
      const isBoss = BOSS_NAMES.has(enemyDef.name);
      const hpRatio = enemyHp / battle.enemyMaxHp;
      const ai = pickEnemyAction(hpRatio, isBoss, enemyCharged);
      const armor = (hero.equipped.armor ? 0.82 : 1) * (sectOf(hero)?.armor ?? 1);
      const phaseMul = phasePowerMul(phase);

      if (ai === 'heal') {
        const heal = Math.round(battle.enemyMaxHp * (isBoss ? 0.12 : 0.08));
        enemyHp = Math.min(battle.enemyMaxHp, enemyHp + heal);
        addFx([{ side: 'enemy', text: `+${heal}`, tone: 'heal' }]);
        pushBattleLine(`${enemyDef.name}运功疗伤，回复 ${heal} 点气血。`, 'lose');
        enemyCharged = false;
        return;
      }
      if (ai === 'charge') {
        enemyCharged = true;
        pushBattleLine(`${enemyDef.name}沉肩蓄势，下一招必是杀招！`, 'event');
        return;
      }

      const rageMul = ai === 'rage' ? 1.6 : 1;
      if (ai === 'rage') {
        pushBattleLine(`${enemyDef.name}蓄力尽出！`, 'lose');
        shake = true;
        enemyCharged = false;
      }
      const mb = meridianBonuses(hero.meridians ?? []);
      const back = strike(
        enemyDef.school,
        enemyDef.qi,
        enemyDef.wit,
        enemyDef.power * armor * phaseMul * rageMul,
        hero.wit + mb.dodge,
        hero.qi + mb.parry,
      );
      const backLine = strikeText('enemy', enemyDef.name, enemyDef.school, back);
      pushBattleLine(backLine.text, backLine.tone);
      addFx([fxFrom('player', back)]);
      playerHp = Math.max(0, playerHp - back.dmg);
      if (playerHp <= 0) {
        pushBattleLine('【败】你眼前一黑，倒了下去。', 'lose');
        finish('lose');
        return;
      }
      const reflect = innerReflect(hero);
      if (back.dmg > 0 && reflect > 0) {
        const rebound = Math.max(1, Math.round(back.dmg * reflect));
        enemyHp = Math.max(0, enemyHp - rebound);
        pushBattleLine(`你内息反震，${enemyDef.name}反受 ${rebound} 点伤。`, 'win');
        if (enemyHp <= 0) {
          pushBattleLine(`【胜】${enemyDef.name}被自己的力道震倒。`, 'win');
          finish('win');
          return;
        }
      }
      if (enemyDef.school === 'quan' && back.kind === 'hit' && Math.random() * 100 < (back.crit ? 30 : 15)) {
        playerStun = Math.max(playerStun, back.crit ? 2 : 1);
        pushBattleLine(`你被${enemyDef.name}一拳震得眼前发黑，眩晕 ${playerStun} 回合！`, 'lose');
      }
      const freshOnPlayer = bleedFrom(enemyDef.school, back);
      if (freshOnPlayer) {
        playerBleed = freshOnPlayer;
        pushBattleLine(`你血流不止（${freshOnPlayer.rounds} 回合 ×${freshOnPlayer.dmg}）。`, 'lose');
      }
    };

    const pSpeed = heroSpeed(hero) + meridianBonuses(hero.meridians ?? []).dodge;
    const eSpeed = enemySpeed(enemyDef) + (phase - 1) * 2;
    const playerFirst = rollFirst(pSpeed, eSpeed);
    pushBattleLine(
      `第${battle.round}回合 · ${playerFirst ? '你' : enemyDef.name}抢得先机（速度 ${pSpeed} : ${eSpeed}）· 连招 ${combo}/${COMBO_MAX} · 内息 ${breath}`,
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

    if (enemyBleed) {
      const tick = enemyBleed;
      enemyHp = Math.max(0, enemyHp - tick.dmg);
      addFx([{ side: 'enemy', text: `🩸-${tick.dmg}`, tone: 'dmg' }]);
      enemyBleed = tick.rounds > 1 ? { ...tick, rounds: tick.rounds - 1 } : null;
      pushBattleLine(`${enemyDef.name}再失 ${tick.dmg} 点气血。`, 'win');
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
      pushBattleLine(`你再失 ${tick.dmg} 点气血。`, 'lose');
      if (playerHp <= 0) {
        pushBattleLine('【败】失血过多，你眼前一黑。', 'lose');
        finish('lose');
        return;
      }
    }

    const regen = (innerOf(hero)?.regen ?? 0) + (sectOf(hero)?.regen ?? 0);
    if (regen > 0) {
      const healed = Math.min(hero.maxHp, playerHp + regen) - playerHp;
      if (healed > 0) {
        playerHp += healed;
        addFx([{ side: 'player', text: `+${healed}`, tone: 'heal' }]);
      }
    }
    // 每回合回复 1 点内息
    breath = Math.min(12, breath + 1);

    setBattle((prev) =>
      prev
        ? {
            ...prev,
            enemyHp,
            playerHp,
            enemyBleed,
            playerBleed,
            playerStun,
            enemyStun,
            combo,
            breath,
            skillCd,
            phase,
            enemyCharged,
            shake,
            round: prev.round + 1,
          }
        : prev,
    );
    if (shake) setTimeout(() => setBattle((p) => (p ? { ...p, shake: false } : p)), 320);
  };

  /** 战斗结算：胜利回满气血 + 得经验（城镇战另发秘籍与内功）；失败按 loseHp 惩罚进 lose 节点 */
  const settleBattle = () => {
    if (!hero || !battle || !battle.over) return;
    const { combat } = battle;
    if (battle.over === 'win') {
      const gain = Math.round(8 + combat.difficulty * 2.2);
      let next = grantExp({ ...hero, hp: hero.maxHp }, gain);
      pushLog(`【战斗胜利】击败了${combat.enemy}，战后调息，气血已复原。`, 'win');

      // 剑意：胜场累积，对手越强给得越多
      const intentBefore = swordIntentBonus(hero);
      next = { ...next, swordIntent: (next.swordIntent ?? 0) + Math.round(4 + combat.difficulty / 3) };
      if (swordIntentBonus(next) > intentBefore) {
        pushLog(`【剑意】剑意凝实，会心 +${swordIntentBonus(next)}%。`, 'win');
      }

      // 胜后清临时虎骨膏，偶得残页
      next = { ...next, atkBuff: 0 };
      if (Math.random() < 0.22) {
        next = applyEffects(next, { items: ['残页'] });
        pushLog('【战利】捡到一页武学残页。', 'event');
      }

      // 悬赏任务战：链式先推进步骤；普通悬赏发奖
      const quest = combat.quest ? QUESTS.find((q) => q.id === combat.quest) ?? null : null;
      if (quest) {
        if (quest.steps?.length) {
          bumpQuest('fight');
          setBattle(null);
          setHero(gainWine(next, 2));
          pushLog(`【悬赏·${quest.title}】战斗环节已过。`, 'win');
          return;
        }
        if (quest.reward.exp > 0) next = grantExp(next, quest.reward.exp);
        next = { ...next, silver: next.silver + quest.reward.silver };
        if (quest.reward.contribution) {
          next = { ...next, contribution: (next.contribution ?? 0) + quest.reward.contribution };
        }
        if (quest.reward.items && quest.reward.items.length > 0) {
          next = applyEffects(next, { items: quest.reward.items });
        }
        const extra = [
          `银两 ${quest.reward.silver}`,
          quest.reward.contribution ? `门派贡献 ${quest.reward.contribution}` : '',
          quest.reward.items?.length ? `得「${quest.reward.items.join('、')}」` : '',
        ].filter(Boolean).join('、');
        pushLog(`【悬赏·${quest.title}】事成：${extra}`, 'win');
        if (!cleared.includes(quest.id)) setCleared((prev) => [...prev, quest.id]);
        setBattle(null);
        setHero(gainWine(next, 2));
        return;
      }

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
      const survived = { ...hero, hp: Math.max(1, Math.round(hero.maxHp * 0.15)), atkBuff: 0 };
      pushLog(`【战斗失利】败给${combat.enemy}，侥幸捡回一条命。`, 'lose');
      setBattle(null);
      if (combat.town || combat.quest) {
        // 城镇挑战 / 悬赏任务失败：退守客栈养伤，剧情不推进
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
  const sceneKey =
    NODE_SCENE[nodeId] ??
    (node?.chapter === 1 ? 'luoyang-snow' : node?.chapter === 2 ? 'jiangnan' : node?.chapter === 4 ? 'huashan' : 'peak');
  const scene = SCENES[sceneKey];

  // 世界视图：任务进度 -> 城中 NPC 标记 + 常驻 HUD（一个 NPC 只挂一条任务）
  const worldNpcQuests = (() => {
    const map: Record<string, { title: string; done: boolean; active: boolean }> = {};
    for (const [npcId, questId] of Object.entries(WORLD_NPC_QUESTS)) {
      const q = ALL_CHAINS.find((x) => x.id === questId);
      if (!q) continue;
      const prog = questProgress[q.id];
      map[npcId] = { title: q.title, done: Boolean(prog?.done), active: activeQuestId === q.id };
    }
    return map;
  })();

  const worldHud = (() => {
    const main = ALL_CHAINS.filter((q) => q.kind === '链式');
    const side = ALL_CHAINS.filter((q) => q.kind !== '链式');
    const doneCount = (arr: typeof ALL_CHAINS) => arr.filter((q) => questProgress[q.id]?.done).length;
    const active = ALL_CHAINS.find((q) => q.id === activeQuestId);
    return {
      activeTitle: active?.title,
      mainDone: doneCount(main),
      mainTotal: main.length,
      sideDone: doneCount(side),
      sideTotal: side.length,
      reputation: hero?.chivalry ?? 0,
    };
  })();
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
    combo: 'text-accent',
    phase: 'text-warning',
  };
  const battleSkills = hero ? schoolSkills(hero.school) : null;

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
        @keyframes jh-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        .jh-shake { animation: jh-shake 0.32s ease-out; }
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
              <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-faint">
                <span>
                  🏯 {sectOf(hero)?.name ?? '未入门派'}
                  {sectOf(hero) ? ` · 贡献 ${hero.contribution ?? 0}` : ''}
                </span>
                <span>🗡️ 剑意 {hero.swordIntent ?? 0}（会心 +{swordIntentBonus(hero)}%）</span>
                <span>🍶 酒量 {hero.capacity ?? 0} · 酒意 {hero.wine ?? 0}/10</span>
                <span>🗺️ 残图 {itemCount(hero, '藏宝图碎片')}/3</span>
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
              <button type="button" onClick={() => setPanel('meridian')} className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-content">
                经脉
              </button>
              <button type="button" onClick={() => setPanel('quest')} className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-content">
                悬赏
              </button>
              <button type="button" onClick={() => setPanel('sect')} className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-content">
                门派
              </button>
              <button type="button" onClick={() => setWorldOpen(true)} className="rounded-md border border-accent/50 bg-accent/10 px-2 py-1 text-[10px] text-accent hover:bg-accent/20">
                世界
              </button>
            </div>
          </div>

          {/* 场景图（实物） */}
          <div className="relative mb-3 overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={sceneKey} src={sceneArt(sceneKey)} onError={onSceneArtError(sceneKey)} alt={scene.label} loading="lazy" className="h-64 w-full object-cover transition-transform duration-700 sm:h-96" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/35" />
            {/* 主角立绘：站在场景右侧 */}
            <div className="pointer-events-none absolute bottom-0 right-2 h-40 w-28 sm:right-6 sm:h-64 sm:w-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PORTRAITS[avatarKey]}
                alt="主角"
                className="h-full w-full object-cover object-top [mask-image:linear-gradient(to_bottom,black_62%,transparent)] drop-shadow-[0_6px_18px_rgba(0,0,0,0.75)]"
              />
            </div>
            <div className="absolute left-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[10px] text-white/85">
              {CHAPTER_LABELS[node.chapter]}
            </div>
            {NODE_VIDEO[node.id] && (
              <button
                type="button"
                onClick={() => setVideoOpen(NODE_VIDEO[node.id])}
                className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white/90 backdrop-blur-sm transition hover:bg-black/80"
              >
                ▶ 过场影像
              </button>
            )}
            <div className="absolute bottom-3 left-4">
              <div className="text-lg font-bold text-white drop-shadow-lg sm:text-2xl">{node.title}</div>
              <div className="text-[10px] text-white/70">{scene.label}</div>
            </div>
            {/* 剧情人物人头：苏挽出场的节点显示 NPC 头像 */}
            {['a05', 'b06', 'b07', 'c04', 'c06'].includes(node.id) && (
              <div className="absolute bottom-3 right-4 flex flex-col items-center gap-1">
                <Portrait name="苏挽" size={64} ring="border-white/50" />
                <span className="rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-white/85">苏挽</span>
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
            /* 剧情对话框：场景 + 逐字对白 + 行动选项 */
            <div key={nodeId} className="jh-fade">
              <div className="overflow-hidden rounded-xl border border-white/12 bg-black/72 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                {/* 标题条 */}
                <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-accent">{node.title}</span>
                  <span className="text-[10px] text-white/40">{scene.label}</span>
                </div>

                {/* 正文：点击跳过打字机 */}
                <button
                  type="button"
                  onClick={() => { if (!typingDone) setTypedLen(node.text.length); setTypingDone(true); }}
                  className="block w-full px-3.5 py-3 text-left"
                >
                  <p className="text-[14px] leading-[1.85] text-white/92 sm:text-[15px]">
                    {node.text.slice(0, typedLen)}
                    {!typingDone && <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-accent align-middle" />}
                  </p>
                </button>

                {/* 行动选项：打完字才可点 */}
                <div className={"space-y-1.5 px-3 pb-3 transition-opacity duration-300 " + (typingDone ? "opacity-100" : "pointer-events-none opacity-0")}>
                  {node.choices.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => choose(c)}
                      className={"group flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] transition-all hover:translate-x-0.5 " + (c.combat ? "border-danger/45 bg-danger/12 text-white/95 hover:border-danger/75" : "border-white/15 bg-white/5 text-white/92 hover:border-accent/60 hover:bg-white/10")}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-[10px] text-white/35 group-hover:text-accent">{i + 1}</span>
                        {c.combat && <span>⚔️</span>}
                        <span>{c.label}</span>
                      </span>
                      <span className="ml-3 flex shrink-0 gap-1.5 text-[10px]">
                        {c.combat ? (
                          <span className="text-danger">战 · {c.combat.enemy}</span>
                        ) : (
                          effectHints(c.effects).map((h, j) => (
                            <span key={j} className={h.tone}>{h.text}</span>
                          ))
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 行囊 */}
              {hero.items.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 px-1 text-[10px] text-white/55">
                  <span className="text-white/35">行囊：</span>
                  {groupItems(hero.items).map((it) => (
                    <span key={it.name} className="rounded bg-white/8 px-1.5 py-0.5 text-white/75">
                      {it.name}{it.count > 1 ? " ×" + it.count : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setWorldOpen(true)}
              className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20"
            >
              🗺️ 回到城中
            </button>
            <button type="button" onClick={restart} className="text-xs text-faint hover:text-content">
              ↻ 重开一局
            </button>
          </div>
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
                      {owned ? '已学' : lower ? '不如现有' : hero.sectKey !== MANUAL_SECT[m.id] ? `${SECTS.find((x) => x.key === MANUAL_SECT[m.id])?.name ?? '他派'}不传` : `${GRADE_CONTRIB[m.grade]} 贡献`}
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
                      {owned ? '已修' : lower ? '不如现有' : hero.sectKey !== INNER_SECT[i.id] ? `${SECTS.find((x) => x.key === INNER_SECT[i.id])?.name ?? '他派'}心法` : `${GRADE_CONTRIB[i.grade]} 贡献`}
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

      {/* ════ 悬赏面板：除害 / 寻物 / 护送 + 场景探索 ════ */}
      {panel === 'meridian' && hero && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-3 sm:items-center" onClick={() => setPanel(null)}>
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold text-content">经脉 · 穴位</div>
              <button type="button" onClick={() => setPanel(null)} className="text-[11px] text-muted">
                关闭
              </button>
            </div>
            <p className="mb-3 text-[10px] leading-relaxed text-faint">
              耗经验点亮穴位。已点 {(hero.meridians ?? []).length}/{MERIDIANS.length} · 经验 {hero.exp}
            </p>
            <div className="space-y-2">
              {MERIDIANS.map((m) => {
                const opened = (hero.meridians ?? []).includes(m.key);
                const ok = canOpenMeridian(hero.meridians ?? [], m.key);
                return (
                  <div key={m.key} className="flex items-start gap-2 rounded-lg border border-line p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-content">
                        {opened ? '✓ ' : ''}
                        {m.name}
                      </div>
                      <p className="text-[10px] text-faint">{m.desc}</p>
                      <p className="mt-0.5 text-[10px] text-muted">耗经验 {m.costExp}</p>
                    </div>
                    <button
                      type="button"
                      disabled={opened || !ok || hero.exp < m.costExp}
                      onClick={() => openMeridian(m.key)}
                      className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content disabled:opacity-40"
                    >
                      {opened ? '已通' : ok ? '点亮' : '未解锁'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-[11px] font-semibold text-content">生活技能</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(Object.keys(LIFE_SKILL_LABEL) as (keyof typeof LIFE_SKILL_LABEL)[]).map((k) => {
                const s = (hero.lifeSkills ?? defaultLifeSkills())[k];
                return (
                  <div key={k} className="rounded-lg border border-line px-2 py-1.5 text-[10px]">
                    <div className="font-semibold text-content">
                      {LIFE_SKILL_LABEL[k]} Lv.{s.level}
                    </div>
                    <div className="text-faint">
                      熟练 {s.exp}/{20 + (s.level - 1) * 15}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {panel === 'quest' && hero && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={() => setPanel(null)}>
          <div
            className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-content">悬赏 · 江湖任务</div>
              <button type="button" onClick={() => setPanel(null)} className="text-xs text-faint hover:text-content">关闭</button>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-faint">
              除害 / 护送动刀兵；寻物跑腿；链式任务多步推进。带「余烬」标签的与第四章挂钩。
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="chip border border-line text-muted">Lv.{hero.level}</span>
              <span className="chip border border-line text-muted">贡献 {hero.contribution ?? 0}</span>
              <span className="chip border border-line text-muted">残图 {itemCount(hero, '藏宝图碎片')}/3</span>
              <span className="chip border border-line text-muted">草药 {itemCount(hero, '草药')}</span>
              {activeQuestId && (
                <span className="chip border border-accent/40 text-accent">进行中 · {activeQuestId}</span>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {QUESTS.map((q) => {
                const locked = hero.level < q.minLevel;
                const done = cleared.includes(q.id) || questProgress[q.id]?.done;
                const info = SCENES[q.scene] ?? SCENES.huashan;
                const hint = q.steps ? questStepHint(q as never, questProgress) : q.desc;
                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border p-2.5 ${
                      locked ? 'border-line/50 opacity-55' : done ? 'border-success/40 bg-success/5' : 'border-line'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sceneArt(q.scene)}
                        onError={onSceneArtError(q.scene)}
                        alt={info.label}
                        loading="lazy"
                        className="h-12 w-16 shrink-0 rounded border border-line object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-content">
                          {q.title}
                          <span className="rounded border border-accent/40 px-1 text-[9px] font-normal text-accent">{q.kind}</span>
                          {q.tag && (
                            <span className="rounded border border-warning/40 px-1 text-[9px] font-normal text-warning">{q.tag}</span>
                          )}
                          {done && <span className="text-[9px] font-normal text-success">已完成</span>}
                        </div>
                        <div className="text-[10px] text-faint">{info.label} · 需 Lv.{q.minLevel}</div>
                      </div>
                      <button
                        type="button"
                        disabled={locked || !!done}
                        onClick={() => acceptQuest(q)}
                        className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content disabled:opacity-40"
                      >
                        {locked ? '等级不足' : done ? '已了结' : q.kind === '寻物' ? '跑一趟' : q.kind === '链式' ? '推进' : '接取'}
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-faint">{hint}</p>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px]">
                      <span className="text-accent">经验 +{q.reward.exp}</span>
                      <span className="text-success">银两 +{q.reward.silver}</span>
                      {q.reward.contribution ? <span className="text-warning">贡献 +{q.reward.contribution}</span> : null}
                      {q.reward.items?.map((it) => <span key={it} className="text-muted">「{it}」</span>)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-[11px] font-semibold text-content">场景探索 · 福州挖宝</div>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <button type="button" onClick={exploreHerbs} className="rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content">
                <div className="text-[11px] font-semibold text-content">采药</div>
                <div className="text-faint">5 两 · 得草药</div>
              </button>
              <button type="button" onClick={exploreTreasure} className="rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content">
                <div className="text-[11px] font-semibold text-content">打探</div>
                <div className="text-faint">10 两 · 找残图</div>
              </button>
              <button type="button" onClick={digTreasure} className="rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content">
                <div className="text-[11px] font-semibold text-content">挖宝</div>
                <div className="text-faint">3 残图 · 出紫装</div>
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              ※ 藏宝图碎片集齐三片，可在福州榕树根下挖出紫装；原作中支离、青冥剑、摘音剑等吸血兵刃皆在此列 ※
            </p>
          </div>
        </div>
      )}

      {/* ════ 门派面板：六派拜师 / 捐银 / 贡献换 S 级武学 ════ */}
      {panel === 'sect' && hero && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={() => setPanel(null)}>
          <div
            className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-content">门派 · 六派</div>
              <button type="button" onClick={() => setPanel(null)} className="text-xs text-faint hover:text-content">关闭</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              <span className="chip border border-line text-muted">本门 {sectOf(hero)?.name ?? '无'}</span>
              <span className="chip border border-line text-muted">贡献 {hero.contribution ?? 0}</span>
              <span className="chip border border-line text-muted">银两 {hero.silver}</span>
            </div>

            {sectOf(hero) && (
              <div className="mt-2 rounded-lg border border-accent/40 bg-accent/5 p-2.5">
                <div className="text-[12px] font-semibold text-content">{sectOf(hero)?.name} · 门人</div>
                <p className="text-[10px] text-accent">{sectOf(hero)?.passive}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={donateSect}
                    className="rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content"
                  >
                    捐银 {SECT_CONTRIB_PRICE} 两（贡献 +5）
                  </button>
                  <button
                    type="button"
                    disabled={(hero.contribution ?? 0) < SECT_MANUAL_COST}
                    onClick={claimSectManual}
                    className="rounded border border-accent/50 px-2 py-1 text-[10px] text-accent hover:bg-accent/10 disabled:opacity-40"
                  >
                    换 S 秘籍（{SECT_MANUAL_COST} 贡献）
                  </button>
                  <button
                    type="button"
                    disabled={(hero.contribution ?? 0) < SECT_INNER_COST}
                    onClick={claimSectInner}
                    className="rounded border border-accent/50 px-2 py-1 text-[10px] text-accent hover:bg-accent/10 disabled:opacity-40"
                  >
                    换 S 内功（{SECT_INNER_COST} 贡献）
                  </button>
                </div>
              </div>
            )}

            {/* 堂口结构：对齐原版分堂拜师 */}
            {sectOf(hero) && SECT_HALLS[sectOf(hero)!.key] && (
              <div className="mt-3">
                <div className="text-[11px] font-semibold text-content">本门堂口</div>
                <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {SECT_HALLS[sectOf(hero)!.key].map((h) => (
                    <div key={h.hall} className="rounded-lg border border-line px-2 py-1.5">
                      <div className="text-[11px] font-semibold text-content">{h.hall}</div>
                      <div className="text-[10px] text-faint">{h.master} · {h.teaches}</div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={leaveSect}
                  className="mt-2 w-full rounded-lg border border-danger/40 bg-danger/5 px-2 py-1.5 text-[11px] text-danger hover:bg-danger/10"
                >
                  离开师门（贡献保留）
                </button>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {SECTS.map((s) => {
                const joined = hero.sectKey === s.key;
                const info = SCENES[s.scene];
                return (
                  <div key={s.key} className={`rounded-lg border p-2.5 ${joined ? 'border-success/40 bg-success/5' : 'border-line'}`}>
                    <div className="flex items-start gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sceneArt(s.scene)}
                        onError={onSceneArtError(s.scene)}
                        alt={info.label}
                        loading="lazy"
                        className="h-12 w-16 shrink-0 rounded border border-line object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-content">
                          {s.name}
                          {joined && <span className="ml-1 text-[9px] font-normal text-success">本门</span>}
                        </div>
                        <div className="text-[10px] text-accent">{s.passive}</div>
                        <p className="text-[10px] text-faint">{s.motto}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!!hero.sectKey}
                        onClick={() => joinSect(s)}
                        className="shrink-0 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-content disabled:opacity-40"
                      >
                        {joined ? '已入' : hero.sectKey ? '另有门派' : '拜入'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              ※ 门派被动常驻生效；贡献靠捐银与悬赏积累，可换本门 S 级秘籍与内功。华山重会心，少林重伤害，武当卸力，太乙轻功，峨眉回血，嵩山刚猛 ※
            </p>
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
                        {gear ? `${gear.desc}${gearAffix(gear) ? `（${gearAffix(gear)}）` : ''}` : med?.desc ?? ITEM_DESC[name] ?? '随身之物，未派上用场。'}
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

            <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-content">
              <span>炼丹 · 草药 {itemCount(hero, '草药')} 株</span>
              <span className="text-[10px] font-normal text-faint">
                丹道 Lv.{(hero.lifeSkills ?? defaultLifeSkills()).alchemy.level}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {RECIPES.map((r) => {
                const can = itemCount(hero, '草药') >= r.herbs;
                return (
                  <button
                    key={r.name}
                    type="button"
                    disabled={!can}
                    onClick={() => craftMed(r.name)}
                    className="rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content disabled:opacity-40"
                  >
                    <div className="text-[11px] font-semibold text-content">{r.name}</div>
                    <div className="text-faint">草药 ×{r.herbs}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-[11px] font-semibold text-content">锻造 · 矿石 {itemCount(hero, '矿石')}</div>
            <button
              type="button"
              onClick={forgeWeapon}
              className="mt-1.5 w-full rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content"
            >
              <div className="text-[11px] font-semibold text-content">
                锤炼兵器（矿石 ×{FORGE_COST.ore} · 银两 {FORGE_COST.silver}）
              </div>
              <div className="text-faint">
                累计 暴{(hero.forge ?? defaultForge()).crit}/吸{(hero.forge ?? defaultForge()).lifesteal}/速
                {(hero.forge ?? defaultForge()).speed}/力{(hero.forge ?? defaultForge()).power}
              </div>
            </button>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={upgradeManual}
                className="flex-1 rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content"
              >
                <div className="text-[11px] font-semibold text-content">研读残页 ×{itemCount(hero, '残页')}</div>
                <div className="text-faint">秘籍 Lv.{hero.manualLevel ?? 1}/5</div>
              </button>
              <button
                type="button"
                onClick={useAtkPaste}
                className="flex-1 rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content"
              >
                <div className="text-[11px] font-semibold text-content">虎骨膏 ×{itemCount(hero, '虎骨膏')}</div>
                <div className="text-faint">{(hero.atkBuff ?? 0) > 0 ? '药效生效中' : '下场攻击 +8%'}</div>
              </button>
            </div>

            <div className="mt-4 text-[11px] font-semibold text-content">闲情 · 酒与琴</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={itemCount(hero, '烧刀子') < 1}
                onClick={drinkWine}
                className="rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content disabled:opacity-40"
              >
                <div className="text-[11px] font-semibold text-content">饮烧刀子 ×{itemCount(hero, '烧刀子')}</div>
                <div className="text-faint">酒意 +3 · 酒意满十化酒量</div>
              </button>
              <button
                type="button"
                onClick={playQin}
                className="rounded-lg border border-line p-2 text-left text-[10px] text-muted hover:text-content"
              >
                <div className="text-[11px] font-semibold text-content">弹琴</div>
                <div className="text-faint">烟波吟 · 有无效用看缘分</div>
              </button>
            </div>

            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              ※ 装备只按槽位生效：兵器加战力、护甲减伤；词条为暴击 / 吸血 / 速度；药品在战斗中按瓶消耗。草药可在上方炼丹，烧刀子只在游戏内转化为酒量 ※
            </p>
          </div>
        </div>
      )}

      {/* ════ 过场影像（本地 mp4，按需加载） ════ */}
      {videoOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 p-3 backdrop-blur-sm"
          onClick={() => setVideoOpen(null)}
        >
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold text-white">过场 · {videoOpen.title}</div>
              <button
                type="button"
                onClick={() => setVideoOpen(null)}
                className="shrink-0 rounded-lg border border-white/25 px-3 py-1 text-xs text-white/85 hover:bg-white/10"
              >
                关闭
              </button>
            </div>
            <video
              key={videoOpen.src}
              src={videoOpen.src}
              controls
              autoPlay
              playsInline
              preload="none"
              poster={sceneArt(sceneKey)}
              className="w-full rounded-xl border border-white/15 shadow-2xl"
            />
            <div className="mt-2 text-center text-[10px] text-white/45">
              影像为本地文件，首次播放需要加载；关闭后可继续剧情
            </div>
          </div>
        </div>
      )}

      {/* ════ 可自由行走的世界层 ════ */}
      {worldOpen && (
        <WorldScene
          onClose={() => setWorldOpen(false)}
          school={hero?.school ?? "dao"}
          npcQuests={worldNpcQuests}
          hud={worldHud}
          onEnterNode={(id) => {
            setWorldOpen(false);
            if (hero && NODES[id]) enter(id, hero);
          }}
        />
      )}

      {/* ════ 战斗界面（弹层）：双方人头 + 血条 + 回合战报 ════ */}
      {battle && hero && battleSkills && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-3">
          <div
            className={`jh-fade flex max-h-[96dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl ${
              battle.shake ? 'jh-shake' : ''
            }`}
          >
            {/* ── 战斗舞台：场景背景 + 双方立绘对峙 ── */}
            <div className="relative h-64 shrink-0 overflow-hidden sm:h-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sceneArt(sceneKey)}
                onError={onSceneArtError(sceneKey)}
                alt={scene.label}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/92" />

              {/* 顶部信息条 */}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
                <span className="rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
                  ⚔️ {scene.label}
                  {BOSS_NAMES.has(battle.enemyDef.name) ? ' · Boss 阶段 ' + (battle.phase ?? 1) : ''}
                </span>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded bg-black/55 px-2 py-0.5 text-[10px] text-white/85 backdrop-blur-sm">
                    第 {battle.round} 回合
                  </span>
                  <span className="rounded bg-accent/85 px-2 py-0.5 text-[10px] font-semibold text-white">
                    连招 {battle.combo ?? 0}/{COMBO_MAX} · 内息 {battle.breath ?? 0}
                  </span>
                </div>
              </div>

              {/* 双方立绘 */}
              <div className="absolute inset-x-0 bottom-10 flex items-end justify-between px-4 pb-1">
                <div className="relative">
                  <StageArt name={avatarKey} side="left" />
                  {lastPlayerFx && lastPlayerFx.tone !== 'heal' && (
                    <span
                      key={'pf-' + lastPlayerFx.id}
                      className="jh-flash pointer-events-none absolute inset-0 rounded-xl bg-white/85"
                    />
                  )}
                  {playerFx.slice(-3).map((f) => (
                    <span
                      key={f.id}
                      className={
                        'jh-fx pointer-events-none absolute inset-0 flex items-center justify-center text-base font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ' +
                        FX_COLOR[f.tone]
                      }
                    >
                      {f.text}
                    </span>
                  ))}
                  {battle.playerStun > 0 && (
                    <span className="absolute -left-1 -top-1 rounded bg-warning/90 px-1 py-0.5 text-[9px] font-bold text-black">
                      🌀{battle.playerStun}
                    </span>
                  )}
                  {battle.playerBleed && (
                    <span className="absolute -right-1 -top-1 rounded bg-danger/90 px-1 py-0.5 text-[9px] font-bold text-white">
                      🩸{battle.playerBleed.rounds}
                    </span>
                  )}
                </div>

                <div className="mb-8 select-none text-2xl font-black text-danger drop-shadow-[0_0_10px_rgba(0,0,0,0.95)]">
                  VS
                </div>

                <div className="relative">
                  <StageArt name={battle.enemyDef.name} side="right" />
                  {lastEnemyFx && lastEnemyFx.tone !== 'heal' && (
                    <span
                      key={'ef-' + lastEnemyFx.id}
                      className="jh-flash pointer-events-none absolute inset-0 rounded-xl bg-white/85"
                    />
                  )}
                  {enemyFx.slice(-3).map((f) => (
                    <span
                      key={f.id}
                      className={
                        'jh-fx pointer-events-none absolute inset-0 flex items-center justify-center text-base font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ' +
                        FX_COLOR[f.tone]
                      }
                    >
                      {f.text}
                    </span>
                  ))}
                  {battle.enemyStun > 0 && (
                    <span className="absolute -left-1 -top-1 rounded bg-warning/90 px-1 py-0.5 text-[9px] font-bold text-black">
                      🌀{battle.enemyStun}
                    </span>
                  )}
                  {battle.enemyBleed && (
                    <span className="absolute -right-1 -top-1 rounded bg-danger/90 px-1 py-0.5 text-[9px] font-bold text-white">
                      🩸{battle.enemyBleed.rounds}
                    </span>
                  )}
                </div>
              </div>

              {/* 悬浮血条 */}
              <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-4 bg-gradient-to-t from-black/92 via-black/70 to-transparent px-3 pb-2 pt-6">
                <div>
                  <div className="mb-0.5 flex items-baseline justify-between text-[10px]">
                    <span className="truncate font-semibold text-white/95">你 · {SCHOOLS[hero.school].name}</span>
                    <span className="ml-1 shrink-0 text-white/70">
                      {Math.max(0, battle.playerHp)}/{hero.maxHp}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-success to-success/70 transition-all duration-500 ease-out"
                      style={{ width: clamp((battle.playerHp / hero.maxHp) * 100, 0, 100) + '%' }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-0.5 flex items-baseline justify-between text-[10px]">
                    <span className="shrink-0 text-white/70">
                      {Math.max(0, battle.enemyHp)}/{battle.enemyMaxHp}
                    </span>
                    <span className="ml-1 truncate text-right font-semibold text-white/95">
                      {battle.enemyDef.name} · {SCHOOLS[battle.enemyDef.school].name}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/60">
                    <div
                      className={
                        'ml-auto h-full rounded-full transition-all duration-500 ease-out ' +
                        ((battle.phase ?? 1) >= 3
                          ? 'bg-gradient-to-l from-danger to-danger/70'
                          : (battle.phase ?? 1) >= 2
                            ? 'bg-gradient-to-l from-warning to-warning/70'
                            : 'bg-gradient-to-l from-danger/90 to-danger/60')
                      }
                      style={{ width: clamp((battle.enemyHp / battle.enemyMaxHp) * 100, 0, 100) + '%' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 属性速览（一行，不抢画面） */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-line px-4 py-1.5 text-[10px] text-faint">
              <span>我方 速度 {heroSpeed(hero)} · 会心 {clamp(critChance(hero.wit) + gearStats(hero).crit + (sectOf(hero)?.crit ?? 0) + swordIntentBonus(hero), 8, 60)}%</span>
              <span>敌 速度 {enemySpeed(battle.enemyDef)}</span>
              <span>敌闪避 {dodgeChance(battle.enemyDef.wit, hero.school)}% · 敌招架 {parryChance(battle.enemyDef.qi, hero.school)}%</span>
              <span>你闪避 {dodgeChance(hero.wit, battle.enemyDef.school)}% · 你招架 {parryChance(hero.qi, battle.enemyDef.school)}%</span>
            </div>
            {/* 战报 */}
            <div ref={battleLogRef} className="mx-4 h-36 overflow-y-auto rounded-lg border border-line bg-card p-2.5 text-[11px] leading-relaxed">
              {battle.lines.map((l) => (
                <div key={l.id} className={LOG_TONE[l.tone]}>{l.text}</div>
              ))}
            </div>

            {/* 操作：拇指可达底栏 */}
            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {!battle.over ? (
                <>
                  <button type="button" onClick={() => actRound('attack')} className="btn-primary min-w-[100px] flex-1 text-xs sm:text-sm">
                    {SCHOOLS[hero.school].emoji} 普攻
                  </button>
                  <button
                    type="button"
                    onClick={() => actRound('skill')}
                    disabled={(battle.breath ?? 0) < battleSkills.school.cost || (battle.skillCd?.school ?? 0) > 0}
                    className="min-w-[100px] flex-1 rounded-lg border border-accent/50 bg-accent/10 px-2 py-2 text-xs text-accent disabled:opacity-40"
                  >
                    {battleSkills.school.name}
                    {(battle.skillCd?.school ?? 0) > 0 ? ` CD${battle.skillCd?.school}` : ` ·${battleSkills.school.cost}息`}
                  </button>
                  <button
                    type="button"
                    onClick={() => actRound('finisher')}
                    disabled={(battle.combo ?? 0) < COMBO_MAX}
                    className="min-w-[100px] flex-1 rounded-lg border border-warning/50 bg-warning/10 px-2 py-2 text-xs text-warning disabled:opacity-40"
                  >
                    {battleSkills.finisher.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => actRound('inner')}
                    disabled={(battle.breath ?? 0) < battleSkills.inner.cost || (battle.skillCd?.inner ?? 0) > 0}
                    className="rounded-lg border border-line px-2 py-2 text-xs text-muted disabled:opacity-40"
                  >
                    护体
                  </button>
                  {MED_ORDER.filter((med) => itemCount(hero, med) > 0).map((med) => (
                    <button
                      key={med}
                      type="button"
                      onClick={() => actRound('heal', med)}
                      className="rounded-lg border border-success/50 bg-success/10 px-2 py-2 text-[11px] text-success hover:bg-success/20"
                    >
                      {med}×{itemCount(hero, med)}
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
