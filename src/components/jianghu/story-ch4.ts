/**
 * 第四章 · 余烬：华山论剑后的余波
 * 节点 id: d01–d10，汇入既有结局
 */

export type Chapter = 1 | 2 | 3 | 4;
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

/** 第四章节点：从 c08 切入 */
export const CHAPTER4_NODES: Record<string, StoryNode> = {
  d01: {
    id: 'd01',
    chapter: 4,
    title: '余烬初燃',
    text:
      '华山论剑的鼓声还在耳边回响，山脚下却传来急报：魔教残党在雁荡旧址竖起半截黑旗，扬言「教主未死，规矩未定」。苏挽递来一封血书——落款竟是殷无咎的刀印。',
    choices: [
      { label: '率轻骑再探雁荡', effects: { chivalry: 3, silver: -20 }, next: 'd02' },
      { label: '先安抚三十六派，稳住人心', effects: { wit: 4, chivalry: 2 }, next: 'd02' },
      { label: '独自夜行，查清血书真伪', effects: { wit: 6, hp: -4 }, next: 'd02' },
    ],
  },
  d02: {
    id: 'd02',
    chapter: 4,
    title: '黑旗再起',
    text:
      '残坛废墟里，半截黑旗在风里啪啪作响。魔教左护法带着十余名死士守在断桥，他看见你，冷笑：「盟主？不过是华山上的戏文。教主的刀，还在等你。」',
    choices: [
      {
        label: '拔刀过桥，正面对决',
        combat: { enemy: '魔教护法', difficulty: 48, win: 'd03', lose: 'd02b', loseHp: 28 },
        next: 'd03',
      },
      { label: '绕道谷底，偷袭旗杆', effects: { wit: 5, hp: -8 }, next: 'd03' },
      { label: '喊话劝降，许以生路', effects: { chivalry: 5, qi: 2 }, next: 'd03' },
    ],
  },
  d02b: {
    id: 'd02b',
    chapter: 4,
    title: '断桥血战',
    text:
      '你被护法拉下断桥，半身浸在冰水里。苏挽的剑光从上方劈开水面，将你拖上岸。护法并未追击——他只是把黑旗插得更深：「有本事，来总坛见教主。」',
    choices: [
      { label: '疗伤后继续上山', effects: { hp: 15, silver: -10 }, next: 'd03' },
      {
        label: '咬牙再战护法',
        combat: { enemy: '魔教护法', difficulty: 52, win: 'd03', lose: 'end-death', loseHp: 35 },
        next: 'd03',
      },
    ],
  },
  d03: {
    id: 'd03',
    chapter: 4,
    title: '门派裂隙',
    text:
      '回程路上，少林与武当的使者拦路：有人说你偏袒魔教降众，有人说你心怀魔教旧怨。华山石上的盟约墨迹未干，裂隙却已从人心里长出来。',
    choices: [
      { label: '公开责难，重申三规', effects: { chivalry: 6, wit: 2 }, next: 'd04' },
      { label: '私下调和，各退一步', effects: { wit: 7, silver: -30 }, next: 'd04' },
      { label: '冷眼旁观，先办残党', effects: { chivalry: -3, qi: 4 }, next: 'd04' },
    ],
  },
  d04: {
    id: 'd04',
    chapter: 4,
    title: '破庙重逢',
    text:
      '洛阳郊外那座破庙，檐下又坐着灰衣老者。他膝前仍是那柄无鞘旧剑：「娃娃，华山的风吹过了，可沈家的债，还没算完。」火光一晃，他袖口那半枚暗纹——竟与血手堂同源。',
    choices: [
      { label: '追问暗纹来历', effects: { wit: 6 }, next: 'd05' },
      { label: '拱手致谢，不问旧事', effects: { chivalry: 4 }, next: 'd05' },
      { label: '拔刀试他深浅', effects: { qi: 3, chivalry: -2 }, next: 'd05' },
    ],
  },
  d05: {
    id: 'd05',
    chapter: 4,
    title: '药谷密信',
    text:
      '药王谷传来密信：谷中有人炼出「忘忧散」，可抹去恩怨记忆。苏挽看着信纸，声音很轻：「若能忘了雁荡那一夜……你想不想试？」窗外药香与雨味缠在一起。',
    choices: [
      { label: '拒绝忘忧，记住一切', effects: { chivalry: 5, wit: 3 }, next: 'd06' },
      { label: '收下一剂，以备不时', effects: { items: ['还魂草'], silver: -15 }, next: 'd06' },
      { label: '去药谷查清炼药之人', effects: { wit: 4, hp: -5 }, next: 'd06' },
    ],
  },
  d06: {
    id: 'd06',
    chapter: 4,
    title: '残影殷无咎',
    text:
      '绝顶旧址，石阶上的血痕早已被雨洗淡。一个穿着教主旧袍的人背对你站着——身形极像殷无咎，出手却虚了一分。他低声说：「我是替身。真身……在更深的地方等你。」',
    choices: [
      {
        label: '拆穿替身，逼问真身所在',
        combat: { enemy: '殷无咎', difficulty: 58, win: 'd07', lose: 'd06b', loseHp: 30 },
        next: 'd07',
      },
      { label: '放他走，换一句实话', effects: { wit: 5, chivalry: 2 }, next: 'd07' },
      { label: '一刀两断，不留后患', effects: { chivalry: -4, qi: 4 }, next: 'd07' },
    ],
  },
  d06b: {
    id: 'd06b',
    chapter: 4,
    title: '替身之局',
    text:
      '替身的刀虽虚，却足以让你吐血。他临走丢下一枚令牌：「地宫在华山北麓。去或不去，随你。」苏挽扶住你：「若真是他……这一趟，不能一个人去。」',
    choices: [
      { label: '与苏挽同往地宫', effects: { chivalry: 4, hp: 10 }, next: 'd07' },
      { label: '独自赴约', effects: { wit: 3, qi: 5 }, next: 'd07' },
      { label: '毁掉令牌，不入圈套', effects: { chivalry: 2 }, next: 'd08' },
    ],
  },
  d07: {
    id: 'd07',
    chapter: 4,
    title: '地宫终局',
    text:
      '华山北麓地宫烛火摇曳。真·殷无咎坐在白骨椅上，刀横膝上：「沈家小子，华山那一战我认了。可这江湖——你真能守得住？」他起身，刀光终于不再虚。',
    choices: [
      {
        label: '以盟主之名，再战一刀',
        combat: { enemy: '殷无咎', difficulty: 78, win: 'd08', lose: 'd07b', loseHp: 45 },
        next: 'd08',
      },
      {
        label: '示弱诱敌，寻其旧伤',
        combat: { enemy: '殷无咎', difficulty: 68, win: 'd08', lose: 'd07b', loseHp: 35 },
        next: 'd08',
      },
      { label: '提出共立规矩，刀下留人', effects: { chivalry: 6, wit: 4 }, next: 'd08' },
    ],
  },
  d07b: {
    id: 'd07b',
    chapter: 4,
    title: '地宫败局',
    text:
      '你跪在地宫青石上，耳鸣如潮。殷无咎收刀：「你若死在这里，华山的规矩只是笑话。」他留给你半盏灯：「爬出去，或者留下——当我最后一个弟子。」',
    choices: [
      {
        label: '燃尽余力，最后一搏',
        effects: { hp: -12, qi: -8 },
        combat: { enemy: '殷无咎', difficulty: 72, win: 'd08', lose: 'end-death', loseHp: 50 },
        next: 'd08',
      },
      { label: '接受魔教收编', effects: { chivalry: -22 }, next: 'end-demon' },
      { label: '弃刀爬出，从此不问', effects: { hp: -18 }, next: 'end-hermit' },
    ],
  },
  d08: {
    id: 'd08',
    chapter: 4,
    title: '余烬落定',
    text:
      '地宫的灯灭了。殷无咎或倒或退，黑旗终于倒下。山外传来三十六派的鼓声——他们在等你给出余烬之后的答案：继续执令，归隐，还是另立山头。',
    choices: [
      { label: '执令回华山，先看朝廷怎么说', effects: { chivalry: 8 }, next: 'e01' },
      { label: '把令交还群雄，抽身而去', next: 'end-hermit' },
      { label: '收编残党，另立门户', effects: { chivalry: -12, qi: 6 }, next: 'end-demon' },
    ],
  },
};

export const CHAPTER4_LABEL = '第四章 · 余烬';

export const CHAPTER4_SCENES: Record<string, string> = {
  d01: 'huashan',
  d02: 'peak',
  d02b: 'ferry',
  d03: 'jiangnan',
  d04: 'temple',
  d05: 'valley',
  d06: 'peak',
  d06b: 'mist',
  d07: 'dungeon',
  d07b: 'dungeon',
  d08: 'huashan',
};
