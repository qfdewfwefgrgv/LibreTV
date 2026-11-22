import type { Hero, Card, CardSuit } from './types';

/**
 * 武将 22 位：蜀 7 / 魏 7 / 吴 5 / 群 3。
 * 所有技能均已在 engine.ts 的 SKILLS 中实装，desc 为人物形象介绍（选将界面展示）。
 */
export const HEROES: Hero[] = [
  // —— 蜀 ——
  {
    id: 'liubei', name: '刘备', kingdom: 'shu', gender: 'M', hp: 4, title: '乱世枭雄', emoji: '🧔',
    skill: '仁德', skillIds: ['rende'],
    desc: '汉室宗亲，织席贩履起家，却以仁义收拢人心。关羽、张飞、诸葛亮皆为其折服，一生颠沛而志不改。',
  },
  {
    id: 'guanyu', name: '关羽', kingdom: 'shu', gender: 'M', hp: 4, title: '武圣', emoji: '🐉',
    skill: '武圣', skillIds: ['wusheng'],
    desc: '身长九尺，面如重枣，丹凤眼、卧蚕眉，手持青龙偃月刀，过五关斩六将，义薄云天。',
  },
  {
    id: 'zhangfei', name: '张飞', kingdom: 'shu', gender: 'M', hp: 4, title: '万夫不当', emoji: '🐯',
    skill: '咆哮', skillIds: ['paoxiao'],
    desc: '豹头环眼、燕颔虎须，声若巨雷。长坂桥上一声断喝，曹军无人敢近，丈八蛇矛所指皆溃。',
  },
  {
    id: 'zhuge', name: '诸葛亮', kingdom: 'shu', gender: 'M', hp: 3, title: '卧龙', emoji: '🪶',
    skill: '观星 · 空城', skillIds: ['guanxing', 'kongcheng'],
    desc: '羽扇纶巾，躬耕南阳而知天下三分。出师一表真名世，千载谁堪伯仲间。',
  },
  {
    id: 'zhaoyun', name: '赵云', kingdom: 'shu', gender: 'M', hp: 4, title: '常山赵子龙', emoji: '⚔️',
    skill: '龙胆', skillIds: ['longdan'],
    desc: '白袍银甲，长坂坡七进七出，怀抱阿斗杀透重围，一生未尝败绩，胆气过人。',
  },
  {
    id: 'machao', name: '马超', kingdom: 'shu', gender: 'M', hp: 4, title: '锦马超', emoji: '🐎',
    skill: '铁骑 · 马术', skillIds: ['tieqi', 'mashu'],
    desc: '西凉锦马超，面如冠玉、眼若流星，锦袍银铠。起兵潼关杀得曹操割须弃袍，骑术冠绝天下。',
  },
  {
    id: 'huangyueying', name: '黄月英', kingdom: 'shu', gender: 'F', hp: 3, title: '归心之巧', emoji: '🌾',
    skill: '集智', skillIds: ['jizhi'],
    desc: '诸葛亮之妻，黄头发、黑皮肤，却才智过人。木牛流马、连弩机关，多出其手。',
  },
  // —— 魏 ——
  {
    id: 'caocao', name: '曹操', kingdom: 'wei', gender: 'M', hp: 4, title: '乱世奸雄', emoji: '👑',
    skill: '奸雄', skillIds: ['jianxiong'],
    desc: '治世之能臣，乱世之奸雄。挟天子以令诸侯，横槊赋诗，用人不疑，多疑亦不疑。',
  },
  {
    id: 'simayi', name: '司马懿', kingdom: 'wei', gender: 'M', hp: 3, title: '狼顾之鬼', emoji: '🦉',
    skill: '反馈', skillIds: ['fankui'],
    desc: '鹰视狼顾，隐忍数十年。诸葛北伐，皆为此人挡于渭水；三国终归司马，笑到最后者从不先笑。',
  },
  {
    id: 'zhenji', name: '甄姬', kingdom: 'wei', gender: 'F', hp: 3, title: '洛神', emoji: '🌸',
    skill: '洛神 · 倾国', skillIds: ['luoshen', 'qingguo'],
    desc: '翩若惊鸿，婉若游龙。甄氏之女，通诗书、善鼓琴，一阕《洛神赋》写尽其绝世风华。',
  },
  {
    id: 'xuchu', name: '许褚', kingdom: 'wei', gender: 'M', hp: 4, title: '虎痴', emoji: '🐗',
    skill: '裸衣', skillIds: ['luoyi'],
    desc: '腰大十围，勇力绝人，赤膊上阵护主。渭水之役单手举鞍挡箭，人称「虎痴」。',
  },
  {
    id: 'xiahoudun', name: '夏侯惇', kingdom: 'wei', gender: 'M', hp: 4, title: '独眼将军', emoji: '🩹',
    skill: '刚烈', skillIds: ['ganglie'],
    desc: '拔矢啖睛，血流满面仍挺枪杀敌。性刚烈，军中敬服，曹操倚为屏障。',
  },
  {
    id: 'zhangliao', name: '张辽', kingdom: 'wei', gender: 'M', hp: 4, title: '威震逍遥津', emoji: '🐺',
    skill: '突袭', skillIds: ['tuxi'],
    desc: '本为吕布部将，后归曹操。逍遥津八百破十万，江东小儿闻其名不敢夜啼。',
  },
  {
    id: 'guojia', name: '郭嘉', kingdom: 'wei', gender: 'M', hp: 3, title: '鬼才', emoji: '🧠',
    skill: '遗计', skillIds: ['yiji'],
    desc: '清瘦俊逸，算无遗策。十胜十败之论定官渡，可惜天不假年，三十八岁早逝，曹操哭之恸。',
  },
  // —— 吴 ——
  {
    id: 'sunquan', name: '孙权', kingdom: 'wu', gender: 'M', hp: 4, title: '江东之主', emoji: '🔱',
    skill: '制衡', skillIds: ['zhiheng'],
    desc: '碧眼紫髯，坐断东南。善用人、能忍辱，赤壁一把火，烧出三分天下。',
  },
  {
    id: 'zhouyu', name: '周瑜', kingdom: 'wu', gender: 'M', hp: 3, title: '美周郎', emoji: '🎐',
    skill: '英姿 · 反间', skillIds: ['yingzi', 'fanjian'],
    desc: '姿貌俊美，精通音律，曲有误周郎顾。赤壁火起时，羽扇纶巾，谈笑间樯橹灰飞烟灭。',
  },
  {
    id: 'sunshangxiang', name: '孙尚香', kingdom: 'wu', gender: 'F', hp: 3, title: '弓腰姬', emoji: '🏹',
    skill: '枭姬', skillIds: ['xiaoji'],
    desc: '孙权之妹，性如烈火，侍婢百余人皆执刀侍立。善骑射，嫁刘备而终归江东。',
  },
  {
    id: 'huanggai', name: '黄盖', kingdom: 'wu', gender: 'M', hp: 4, title: '轻身为国', emoji: '🕯️',
    skill: '苦肉', skillIds: ['kurou'],
    desc: '历仕三代的江东老将。赤壁之战自愿受杖，诈降火船冲阵，一炬定乾坤。',
  },
  {
    id: 'ganning', name: '甘宁', kingdom: 'wu', gender: 'M', hp: 4, title: '锦帆贼', emoji: '🔔',
    skill: '奇袭', skillIds: ['qixi'],
    desc: '腰悬铜铃，锦帆百骑劫魏营。少年为盗，后投孙权，百骑夜袭曹营全身而退。',
  },
  // —— 群 ——
  {
    id: 'lvbu', name: '吕布', kingdom: 'qun', gender: 'M', hp: 5, title: '飞将', emoji: '💀',
    skill: '无双', skillIds: ['wushuang'],
    desc: '人中吕布，马中赤兔。方天画戟、兽面吞头铠，虎牢关独战三英而不落下风。',
  },
  {
    id: 'diaochan', name: '貂蝉', kingdom: 'qun', gender: 'F', hp: 3, title: '闭月', emoji: '💃',
    skill: '闭月', skillIds: ['biyue'],
    desc: '色伎俱佳，一舞倾城。王允连环计中，她周旋于董卓、吕布之间，一笑倾覆天下。',
  },
  {
    id: 'huatuo', name: '华佗', kingdom: 'qun', gender: 'M', hp: 3, title: '神医', emoji: '🌿',
    skill: '青囊', skillIds: ['qingnang'],
    desc: '麻沸散、五禽戏，刮骨疗毒谈笑自若。一生行医不问贵贱，曹操召之而不肯为侍医。',
  },
];

const SUITS: CardSuit[] = ['spade', 'heart', 'club', 'diamond'];
let _seq = 0;

/** 生成 n 张同名牌，花色与点数按序列轮转，保证牌的多样性 */
function mk(name: string, n: number, extra: Omit<Partial<Card>, 'id' | 'name'>): Omit<Card, 'id'>[] {
  return Array.from({ length: n }, () => {
    const suit = SUITS[_seq % 4];
    const point = (_seq % 13) + 1;
    _seq++;
    return { name, suit, point, type: 'basic', ...extra } as Omit<Card, 'id'>;
  });
}

const basic = (
  name: string,
  n: number,
  extra: Omit<Partial<Card>, 'id' | 'name'> = {}
) => mk(name, n, { type: 'basic', ...extra });

const trick = (name: string, n: number, extra: Omit<Partial<Card>, 'id' | 'name'> = {}) =>
  mk(name, n, { type: 'trick', ...extra });

const equip = (name: string, n: number, extra: Omit<Partial<Card>, 'id' | 'name'>) =>
  mk(name, n, { type: 'equip', ...extra });

/** 所有卡牌模板（复制入 drawPile 时附唯一 id） */
export const CARD_TEMPLATES: Omit<Card, 'id'>[] = [
  // —— 基本牌 ——
  ...basic('杀', 30, { needTarget: true, targetKind: 'enemy', element: 'normal' }),
  ...basic('火杀', 5, { needTarget: true, targetKind: 'enemy', element: 'fire' }),
  ...basic('雷杀', 5, { needTarget: true, targetKind: 'enemy', element: 'thunder' }),
  ...basic('闪', 24),
  ...basic('桃', 12, { needTarget: true, targetKind: 'any' }),
  ...basic('酒', 5),

  // —— 锦囊牌 ——
  ...trick('无中生有', 4),
  ...trick('过河拆桥', 6, { needTarget: true, targetKind: 'enemy' }),
  ...trick('顺手牵羊', 5, { needTarget: true, targetKind: 'enemy' }),
  ...trick('决斗', 4, { needTarget: true, targetKind: 'enemy' }),
  ...trick('万箭齐发', 2),
  ...trick('南蛮入侵', 3),
  ...trick('桃园结义', 2),
  ...trick('火攻', 3, { needTarget: true, targetKind: 'any' }),
  ...trick('乐不思蜀', 3, { needTarget: true, targetKind: 'enemy', delayed: true }),
  ...trick('兵粮寸断', 2, { needTarget: true, targetKind: 'enemy', delayed: true }),
  ...trick('闪电', 2, { needTarget: false, delayed: true }),
  ...trick('无懈可击', 3, { needTarget: true, targetKind: 'any' }),
  ...trick('铁索连环', 4),

  // —— 武器装备 ——
  ...equip('诸葛连弩', 2, { equipKind: 'weapon', range: 1, effect: 'lianu' }),
  ...equip('寒冰剑', 1, { equipKind: 'weapon', range: 2, effect: 'ice' }),
  ...equip('雌雄双股剑', 1, { equipKind: 'weapon', range: 2 }),
  ...equip('青釭剑', 1, { equipKind: 'weapon', range: 2, effect: 'qinggang' }),
  ...equip('古锭刀', 1, { equipKind: 'weapon', range: 2, effect: 'guding' }),
  ...equip('青龙偃月刀', 1, { equipKind: 'weapon', range: 3 }),
  ...equip('丈八蛇矛', 1, { equipKind: 'weapon', range: 3 }),
  ...equip('贯石斧', 1, { equipKind: 'weapon', range: 3 }),
  ...equip('方天画戟', 1, { equipKind: 'weapon', range: 4 }),
  ...equip('麒麟弓', 1, { equipKind: 'weapon', range: 5, effect: 'qilin' }),

  // —— 防具 ——
  ...equip('八卦阵', 2, { equipKind: 'armor', effect: 'bagua' }),
  ...equip('仁王盾', 2, { equipKind: 'armor', effect: 'renwang' }),
  ...equip('藤甲', 2, { equipKind: 'armor', effect: 'tengjia' }),
  ...equip('白银狮子', 2, { equipKind: 'armor', effect: 'shizi' }),

  // —— 坐骑 ——
  ...equip('的卢', 1, { equipKind: 'horse', range: 1 }),
  ...equip('绝影', 1, { equipKind: 'horse', range: 1 }),
  ...equip('爪黄飞电', 1, { equipKind: 'horse', range: 1 }),
  ...equip('赤兔', 1, { equipKind: 'horse', range: -1 }),
  ...equip('大宛', 1, { equipKind: 'horse', range: -1 }),
  ...equip('紫骍', 1, { equipKind: 'horse', range: -1 }),
];

let _cardId = 0;
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const tpl of CARD_TEMPLATES) {
    deck.push({ ...tpl, id: `c${_cardId++}` });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 随机抽取 n 名不重复武将（选将界面用） */
export function rollHeroChoices(n = 6): Hero[] {
  const pool = HEROES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
