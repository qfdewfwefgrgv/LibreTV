/**
 * 剧情联动的五条任务链（第七阶段核心）
 * 设计原则：每一环都必须调用现有生活技能动作，不新增孤立菜单。
 *   explore  → 采药 / 采矿 / 探索（复用 exploreHerbs / digTreasure）
 *   craft    → 炼丹 / 锻造（复用 craftMed / forgeWeapon）
 *   fight    → 战斗（复用 startBattle）
 *   deliver  → 交任务（复用交还逻辑）
 *   talk     → 对话（复用 enter 节点）
 */
import type { QuestDef } from './quests-ext';

export const STORY_QUESTS: QuestDef[] = [
  {
    id: 'q-shandao',
    title: '山道救孤',
    kind: '链式',
    scene: 'stronghold',
    minLevel: 2,
    tag: '同伴招募',
    desc:
      '洛阳城外的山道上，一名青衣人被困在乱石间，身上插着两支断箭还撑着不肯倒。围攻她的山贼说，这人不该管闲事。',
    steps: [
      { id: 'fight', hint: '出手击退围攻的山贼（触发战斗）', action: 'fight' },
      { id: 'escort', hint: '把伤者护送回洛阳（触发交付）', action: 'deliver' },
    ],
    reward: { exp: 90, silver: 40, contribution: 5, items: ['金创药'] },
  },
  {
    id: 'q-sevenleaf',
    title: '救命的七叶草',
    kind: '链式',
    scene: 'valley',
    minLevel: 3,
    tag: '采药 · 炼丹',
    desc:
      '洛阳城西的老者得了奇症，寻常汤药压不住。城外山林深处有一味七叶草，据说生在毒蛇盘踞的湿石旁。采回来还不够——得按老药师的法子炼成解毒丹。',
    steps: [
      { id: 'gather', hint: '去城外山林采药，寻得七叶草（触发采药）', action: 'explore' },
      { id: 'brew', hint: '在百草堂按老药师的方子炼出解毒丹（触发炼丹）', action: 'craft' },
      { id: 'deliver', hint: '把解毒丹送回药铺，交给老者', action: 'deliver' },
    ],
    reward: { exp: 120, silver: 60, contribution: 10, items: ['金创药', '草药'] },
  },
  {
    id: 'q-smithwish',
    title: '铁匠的遗愿',
    kind: '链式',
    scene: 'hanyang',
    minLevel: 4,
    tag: '采矿 · 锻造',
    desc:
      '洛阳铁匠铺的老师傅手抖了，炉子已经三个月没开。他说年轻时答应过一个人，要替他打一把剑——矿石得自己去山里挖。',
    steps: [
      { id: 'mine', hint: '去矿洞采矿石（触发采矿）', action: 'explore' },
      { id: 'forge', hint: '在铁匠铺熔炼锻造，打出剑胚（触发锻造）', action: 'craft' },
      { id: 'give', hint: '把打好的剑交给老师傅', action: 'deliver' },
    ],
    reward: { exp: 150, silver: 80, contribution: 10, items: ['精铁剑'] },
  },
  {
    id: 'q-lostinner',
    title: '失传的内功',
    kind: '链式',
    scene: 'wudang',
    minLevel: 8,
    tag: '探索 · 解谜',
    desc:
      '武当后山有一处塌了半边的石洞，洞口的苔痕是新的。老道人说，二十年前有人带着半卷心法进去，再没出来。',
    steps: [
      { id: 'seek', hint: '在后山洞穴摸索，寻找残卷线索（触发探索）', action: 'explore' },
      { id: 'guard', hint: '击退守在洞底的旧人（触发战斗）', action: 'fight' },
      { id: 'report', hint: '带着残卷回武当复命', action: 'deliver' },
    ],
    reward: { exp: 200, silver: 40, contribution: 30 },
  },
  {
    id: 'q-herbvalley',
    title: '药王谷秘闻',
    kind: '链式',
    scene: 'valley',
    minLevel: 5,
    tag: '采集 · 调查',
    desc:
      '药王谷的篱笆外多了几道车辙，药圃却少了两垄。谷中老仆不肯说，只让你自己去后山看看那些被踩倒的草。',
    steps: [
      { id: 'trace', hint: '查看后山被踩倒的药草，循迹调查（触发探索）', action: 'explore' },
      { id: 'brew', hint: '按残留药渣炼一炉丹，验出被偷的是什么（触发炼丹）', action: 'craft' },
      { id: 'ask', hint: '拿丹去找谷中老仆问话', action: 'talk' },
    ],
    reward: { exp: 160, silver: 50, items: ['草药', '草药', '金创药'] },
  },
  {
    id: 'q-coldiron',
    title: '寒铁矿脉',
    kind: '链式',
    scene: 'taishan',
    minLevel: 6,
    tag: '探索 · Boss',
    desc:
      '泰山北麓的雪线以上，岩缝里泛着青白的光。当地猎户说那不是冰，是寒铁——只是守在那儿的家伙，不是人。',
    steps: [
      { id: 'climb', hint: '沿雪线上山，找到矿脉入口（触发探索）', action: 'explore' },
      { id: 'beast', hint: '击退盘踞矿脉的守卫（触发战斗）', action: 'fight' },
      { id: 'smelt', hint: '把寒铁带回铁匠铺熔炼（触发锻造）', action: 'craft' },
    ],
    reward: { exp: 180, silver: 70, contribution: 15, items: ['矿石', '矿石'] },
  },
];
