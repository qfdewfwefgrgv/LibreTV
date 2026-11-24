/**
 * 第五章 · 九州风雷
 * 华山论剑之后的江湖：朝廷招安、边关烽火、粮道暗账、军中内鬼。
 * 承接 d08「余烬落定」的「执令回华山」分支，最终汇入既有结局。
 * 全部为原创剧情，未取自任何既有作品。
 */

export type Chapter = 1 | 2 | 3 | 4 | 5;
export type EndingKey = 'lord' | 'hermit' | 'demon' | 'death';

export type Effects = {
  hp?: number;
  qi?: number;
  wit?: number;
  chivalry?: number;
  silver?: number;
  items?: string[];
  removeItems?: string[];
};

export type Combat = {
  enemy: string;
  difficulty: number;
  win: string;
  lose: string;
  loseHp?: number;
  town?: string;
  quest?: string;
};

export type Choice = { label: string; effects?: Effects; combat?: Combat; next: string };

export type StoryNode = {
  id: string;
  chapter: Chapter;
  title: string;
  text: string;
  choices: Choice[];
  ending?: EndingKey | 'judge';
};

export const CHAPTER5_LABEL = '第五章 · 九州风雷';

export const CHAPTER5_NODES: Record<string, StoryNode> = {
  e01: {
    id: 'e01',
    chapter: 5,
    title: '紫禁来使',
    text:
      '华山事了不到一月，山门前停了八匹枣红马。钦差捧着明黄卷轴，说朝廷愿授你「护国」二字，条件是江湖盟约即日解散，各路掌门入京待诏。随行的内侍低声补了一句：「雁门外的狼，比江湖上的刀快。」',
    choices: [
      { label: '接旨，换江湖一个太平', effects: { chivalry: -3, silver: 40 }, next: 'e02' },
      { label: '当众斥退，江湖不奉诏', effects: { chivalry: 5, wit: 2 }, next: 'e02' },
      { label: '虚与委蛇，先看清楚', effects: { wit: 6, chivalry: -2 }, next: 'e02' },
    ],
  },
  e02: {
    id: 'e02',
    chapter: 5,
    title: '北地狼烟',
    text:
      '三日之内，雁门三封急报送到案上：北骑破关，边军缺粮，守将闭门不出。送信的驿卒跪在雪里，手上还缠着渗血的布。屋里没人说话，只有炭火噼啪。',
    choices: [
      { label: '点齐盟众，即刻北上', effects: { chivalry: 6, hp: -6 }, next: 'e03' },
      { label: '先遣斥候，摸清虚实', effects: { wit: 4, silver: -15 }, next: 'e03' },
      { label: '按下不发，先查朝中动静', effects: { chivalry: -6, wit: 3 }, next: 'e04' },
    ],
  },
  e03: {
    id: 'e03',
    chapter: 5,
    title: '雁门初战',
    text:
      '雁门关外的风像刀子。北骑千夫长策马立于坡上，甲胄上结着冰，他抬刀指向你：「南人也会用刀？让我看看。」身后的关墙塌了半截，守军只剩百余人。',
    choices: [
      {
        label: '出关迎战，护住关门',
        combat: { enemy: '鞑靼千夫长', difficulty: 62, win: 'e05', lose: 'e03b', loseHp: 32 },
        next: 'e05',
      },
      { label: '据关死守，以逸待劳', effects: { wit: 4, hp: -10 }, next: 'e05' },
      { label: '夜袭马厩，断其马力', effects: { wit: 6, hp: -8 }, next: 'e05' },
    ],
  },
  e03b: {
    id: 'e03b',
    chapter: 5,
    title: '残夜溃退',
    text:
      '你被亲随拖回关内，肩上插着半截断箭。关墙的火还在烧，北骑在关下叫骂。有人把最后一坛酒递过来：「盟主，撑不住了。」',
    choices: [
      {
        label: '收拢残兵，再战一场',
        effects: { hp: -12 },
        combat: { enemy: '鞑靼千夫长', difficulty: 66, win: 'e05', lose: 'end-death', loseHp: 45 },
        next: 'e05',
      },
      { label: '退回关内，先稳军心', effects: { hp: 12, chivalry: -3 }, next: 'e04' },
      { label: '孤身夜袭，赌一线生机', effects: { wit: 4, hp: -14 }, next: 'e05' },
    ],
  },
  e04: {
    id: 'e04',
    chapter: 5,
    title: '粮道暗账',
    text:
      '你翻边军的粮册，发现三个月的军粮只到了四成。守仓的老吏跪着不敢抬头，账页边角却有新墨——有人在粮车出关前，把它们折进了黑市，换成了银子与地契。',
    choices: [
      { label: '暗查账册，顺藤摸瓜', effects: { wit: 6 }, next: 'e05' },
      { label: '当众揭发，立威军中', effects: { chivalry: 5, hp: -8 }, next: 'e05' },
      { label: '私下要挟，换一半粮银', effects: { chivalry: -8, silver: 120 }, next: 'e05' },
    ],
  },
  e05: {
    id: 'e05',
    chapter: 5,
    title: '军中内鬼',
    text:
      '黑心粮官带人堵住仓门，身后是二十名弓箭手。他笑得发颤：「盟主，边关要的是粮，不是道理。你查下去，这百人谁来喂？」箭已上弦。',
    choices: [
      {
        label: '拔刀拿下他',
        combat: { enemy: '黑心粮官', difficulty: 55, win: 'e06', lose: 'e05b', loseHp: 26 },
        next: 'e06',
      },
      { label: '喊话散其众，只究首恶', effects: { chivalry: 5, wit: 3 }, next: 'e06' },
      { label: '退一步，先保粮车', effects: { hp: -4, silver: -30, wit: 1 }, next: 'e06' },
    ],
  },
  e05b: {
    id: 'e05b',
    chapter: 5,
    title: '刀下留人',
    text:
      '粮官跪在雪里，膝盖陷下去一寸。他抬头看你：「粮是被上面调的，我不过签个字。你杀我，账还在。」',
    choices: [
      { label: '放他走，换一份口供', effects: { wit: 5, chivalry: -2 }, next: 'e06' },
      { label: '就地正法，以正军心', effects: { chivalry: -4, qi: 4 }, next: 'e06' },
      { label: '押送军法，按律处置', effects: { chivalry: 3 }, next: 'e06' },
    ],
  },
  e06: {
    id: 'e06',
    chapter: 5,
    title: '镇北侯',
    text:
      '中军大帐里，镇北侯把一枚玉印放在案上：「粮是我调的。北廷退兵，靠的不是刀，是银子。」他抬眼看你，「你要公道，还是要雁门的十万百姓？」帐外风雪大作，刀斧手已列成两排。',
    choices: [
      {
        label: '当面对质，不走退路',
        combat: { enemy: '镇北侯', difficulty: 74, win: 'e07', lose: 'e06b', loseHp: 40 },
        next: 'e07',
      },
      { label: '以账册换退兵之约', effects: { wit: 8 }, next: 'e07' },
      { label: '请钦差出面裁断', effects: { silver: -80, chivalry: 4 }, next: 'e07' },
    ],
  },
  e06b: {
    id: 'e06b',
    chapter: 5,
    title: '帐前受缚',
    text:
      '绳索勒进手腕，帐里的炭火映着镇北侯的半张脸：「江湖人讲义气，可义气救不了边关。你若肯低头，这些人我都可以放。」',
    choices: [
      {
        label: '挣脱再战，宁折不弯',
        effects: { hp: -15 },
        combat: { enemy: '镇北侯', difficulty: 78, win: 'e07', lose: 'end-death', loseHp: 50 },
        next: 'e07',
      },
      { label: '认下罪名，换部众活命', effects: { chivalry: 2, hp: -10 }, next: 'e07' },
      { label: '应下北廷招揽', effects: { chivalry: -25 }, next: 'end-demon' },
    ],
  },
  e07: {
    id: 'e07',
    chapter: 5,
    title: '黄河解冻',
    text:
      '春汛来时，北骑退了。雁门关的雪化成泥，军粮的账终于补平。朝廷的诏书又来一封：这一次，写的是「护国真人，兼领江湖」。钦差笑意温和：「接了吧，都是你的。」',
    choices: [
      { label: '受封领职，以庙堂护江湖', effects: { chivalry: 4, silver: 80 }, next: 'e08' },
      { label: '辞爵归山，把令交还群雄', effects: { chivalry: 6, wit: 2 }, next: 'end-hermit' },
      { label: '拥兵自重，另立规矩', effects: { chivalry: -14, qi: 6 }, next: 'end-demon' },
    ],
  },
  e08: {
    id: 'e08',
    chapter: 5,
    title: '江湖夜雨',
    text:
      '你回到华山。石阶上还留着去年论剑时的刻痕，松风照旧。三十六派的旗子在雨里垂着，等你给出最后一个字：是坐在庙堂上管江湖，还是把刀插回土里，做一个寻常人。',
    choices: [
      { label: '「江湖自有江湖的规矩。」', effects: { chivalry: 8 }, next: 'end-judge' },
      { label: '「我守过一回，够了。」', effects: { wit: 3 }, next: 'end-hermit' },
      { label: '「规矩由我来定。」', effects: { chivalry: -4, qi: 4 }, next: 'end-lord' },
    ],
  },
};

/** 节点 → 场景 */
export const CHAPTER5_SCENES: Record<string, string> = {
  e01: 'huashan',
  e02: 'peak',
  e03: 'mist',
  e03b: 'mist',
  e04: 'hanyang',
  e05: 'dungeon',
  e05b: 'inn',
  e06: 'dungeon',
  e06b: 'dungeon',
  e07: 'ferry',
  e08: 'huashan',
};
