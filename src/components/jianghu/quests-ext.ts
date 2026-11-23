/**
 * 多步任务链与主线挂钩支线
 */

export type QuestKind = '除害' | '寻物' | '护送' | '链式';

export type QuestStep = {
  id: string;
  hint: string;
  /** 完成该步需要的动作标记 */
  action: 'fight' | 'explore' | 'deliver' | 'craft' | 'talk';
};

export type QuestDef = {
  id: string;
  title: string;
  kind: QuestKind;
  scene: string;
  desc: string;
  minLevel: number;
  enemy?: string;
  difficulty?: number;
  reward: { exp: number; silver: number; contribution?: number; items?: string[] };
  /** 多步链：有则按 progress 推进 */
  steps?: QuestStep[];
  /** 完成后解锁的下一任务 */
  nextQuestId?: string;
  /** 主线标记：余烬等 */
  tag?: string;
};

export const QUEST_CHAINS: QuestDef[] = [
  {
    id: 'q-fuzhou-chain',
    title: '榕城三残图',
    kind: '链式',
    scene: 'fuzhou',
    minLevel: 3,
    tag: '寻宝',
    desc: '集齐三片藏宝图碎片 → 榕下挖宝 → 将一件紫装交还坊间老人。',
    steps: [
      { id: 'collect', hint: '在行程中探索或接悬赏，集齐 3 片藏宝图碎片', action: 'explore' },
      { id: 'dig', hint: '在福州使用「挖宝」掘出紫装', action: 'explore' },
      { id: 'return', hint: '再次接取本任务，将任意一件紫装「交还」（消耗一件紫装换厚礼）', action: 'deliver' },
    ],
    reward: { exp: 120, silver: 80, contribution: 15, items: ['金创药', '金创药', '草药'] },
  },
  {
    id: 'q-ember-scout',
    title: '余烬探旗',
    kind: '链式',
    scene: 'peak',
    minLevel: 8,
    tag: '余烬',
    enemy: '魔教护法',
    difficulty: 40,
    desc: '探明雁荡黑旗虚实：先探路，再除护法哨卫，最后回报华山。',
    steps: [
      { id: 'scout', hint: '在雁荡/华山一带探索一次', action: 'explore' },
      { id: 'fight', hint: '击败魔教护法哨卫', action: 'fight' },
      { id: 'report', hint: '再次接取以回报华山（发奖）', action: 'talk' },
    ],
    reward: { exp: 180, silver: 120, contribution: 25, items: ['还魂草'] },
    nextQuestId: 'q-ember-letter',
  },
  {
    id: 'q-ember-letter',
    title: '血书真伪',
    kind: '链式',
    scene: 'huashan',
    minLevel: 9,
    tag: '余烬',
    desc: '核对殷无咎血书：寻物证 → 破庙问老者 → 交出物证。',
    steps: [
      { id: 'find', hint: '探索获得「无名琴谱」或「藏宝图碎片」任一作为物证', action: 'explore' },
      { id: 'ask', hint: '在破庙场景探索一次（触发问老者）', action: 'talk' },
      { id: 'submit', hint: '再次接取提交物证', action: 'deliver' },
    ],
    reward: { exp: 200, silver: 100, contribution: 20, items: ['灵芝散'] },
  },
  {
    id: 'q-temple-elder',
    title: '破庙老人',
    kind: '护送',
    scene: 'temple',
    minLevel: 2,
    tag: '主线支线',
    enemy: '山贼头目',
    difficulty: 10,
    desc: '灰衣老者要去洛阳城南上香，路上有山贼。护送他抵达。',
    reward: { exp: 55, silver: 30, contribution: 8, items: ['金创药'] },
  },
  {
    id: 'q-valley-herb',
    title: '药王谷急采',
    kind: '寻物',
    scene: 'valley',
    minLevel: 4,
    tag: '主线支线',
    desc: '药王谷缺草药炼忘忧散的引子，采满 5 株草药交还。',
    steps: [
      { id: 'gather', hint: '通过探索/采药凑齐 5 株草药', action: 'explore' },
      { id: 'deliver', hint: '再次接取交付草药', action: 'deliver' },
    ],
    reward: { exp: 70, silver: 40, contribution: 10, items: ['还魂草', '草药'] },
  },
  {
    id: 'q-ally-token',
    title: '盟主令影',
    kind: '除害',
    scene: 'huashan',
    minLevel: 10,
    tag: '主线支线',
    enemy: '血手堂杀手',
    difficulty: 35,
    desc: '有人假传盟主令在华山脚下勒索商队，去揭穿并除害。',
    reward: { exp: 160, silver: 90, contribution: 18, items: ['青玉哨'] },
  },
];

/** 任务进度存档结构 */
export type QuestProgress = Record<string, { step: number; done?: boolean }>;

export function questStepHint(q: QuestDef, progress: QuestProgress): string {
  const steps = q.steps;
  if (!steps?.length) return q.desc;
  const st = progress[q.id];
  if (st?.done) return '已完成';
  const idx = st?.step ?? 0;
  if (idx >= steps.length) return '可再次接取以领取奖励';
  return `第 ${idx + 1}/${steps.length} 步：${steps[idx].hint}`;
}

export function advanceQuestStep(
  progress: QuestProgress,
  questId: string,
  action: QuestStep['action'],
  quests: QuestDef[],
): { progress: QuestProgress; completedId?: string; message?: string } {
  const q = quests.find((x) => x.id === questId);
  if (!q?.steps?.length) return { progress };
  const cur = progress[questId] ?? { step: 0 };
  if (cur.done) return { progress };
  const step = q.steps[cur.step];
  if (!step || step.action !== action) return { progress };
  const nextStep = cur.step + 1;
  if (nextStep >= q.steps.length) {
    return {
      progress: { ...progress, [questId]: { step: nextStep, done: false } },
      message: `【任务】「${q.title}」步骤已齐，请再次接取以领奖。`,
    };
  }
  return {
    progress: { ...progress, [questId]: { step: nextStep } },
    message: `【任务】「${q.title}」进度 ${nextStep}/${q.steps.length}`,
  };
}
