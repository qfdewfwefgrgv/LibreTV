/* eslint-disable react-hooks/rules-of-hooks */
import type { GameState, Player, Card, Identity, Hero, Ask, CardSuit, DeathNotice } from './types';
export type { GameState, Player, Card, Identity, Hero, Ask, DeathNotice };
import { HEROES, buildDeck } from './cards';

/** 已实装的武将技能说明（UI 展示 + 主动技按钮都读这里），文案对齐官方标准包 */
export const SKILLS: Record<string, { name: string; desc: string; active?: boolean }> = {
  rende:     { name: '仁德', desc: '出牌阶段，你可以将任意张手牌交给其他角色（不限次数）；本阶段累计给出第 2 张牌时，你回复 1 点体力', active: true },
  wusheng:   { name: '武圣', desc: '你可以将一张红色牌当【杀】使用或打出' },
  paoxiao:   { name: '咆哮', desc: '锁定技，你使用【杀】无次数限制' },
  guanxing:  { name: '观星', desc: '回合开始时，观看牌堆顶 5 张牌，将其中任意张置于牌堆底（此处自动保留关键牌）' },
  kongcheng: { name: '空城', desc: '锁定技，若你没有手牌，你不能成为【杀】或【决斗】的目标' },
  jianxiong: { name: '奸雄', desc: '当你受到伤害后，你可以获得造成伤害的牌' },
  fankui:    { name: '反馈', desc: '当你受到伤害后，你可以获得伤害来源的一张牌' },
  luoshen:   { name: '洛神', desc: '回合开始时，你可以进行判定：若为黑色，你获得此牌，然后可以重复此流程' },
  qingguo:   { name: '倾国', desc: '你可以将一张黑色手牌当【闪】使用或打出' },
  luoyi:     { name: '裸衣', desc: '摸牌阶段，你可以少摸一张牌，本回合你使用【杀】或【决斗】造成的伤害 +1' },
  zhiheng:   { name: '制衡', desc: '出牌阶段限一次，你可以弃置任意张牌，然后摸等量的牌', active: true },
  yingzi:    { name: '英姿', desc: '摸牌阶段，你可以额外摸一张牌' },
  fanjian:   { name: '反间', desc: '出牌阶段限一次，你可以令一名其他角色选择一种花色，然后获得你的一张手牌并展示：若花色不同，该角色受到 1 点伤害', active: true },
  wushuang:  { name: '无双', desc: '锁定技，你使用的【杀】需连续两张【闪】才能抵消；【决斗】中对手需连续两张【杀】' },
  xiaoji:    { name: '枭姬', desc: '当你失去一张装备牌后，你可以摸两张牌' },
  longdan:   { name: '龙胆', desc: '你可以将【杀】当【闪】、【闪】当【杀】使用或打出' },
  tieqi:     { name: '铁骑', desc: '当你使用【杀】指定目标后，你可以判定：若结果为红色，该角色不能使用【闪】' },
  mashu:     { name: '马术', desc: '锁定技，你计算与其他角色的距离 -1' },
  ganglie:   { name: '刚烈', desc: '当你受到伤害后，你可以判定：若结果不为红桃，伤害来源受到你造成的 1 点伤害' },
  tuxi:      { name: '突袭', desc: '摸牌阶段，你可以放弃摸牌，改为获得至多两名其他角色各一张手牌' },
  yiji:      { name: '遗计', desc: '当你受到伤害后，你可以摸两张牌' },
  kurou:     { name: '苦肉', desc: '出牌阶段，你可以失去 1 点体力，然后摸两张牌（不限次数）', active: true },
  jizhi:     { name: '集智', desc: '当你使用普通锦囊牌时，你可以摸一张牌' },
  biyue:     { name: '闭月', desc: '结束阶段，你可以摸一张牌' },
  qingnang:  { name: '青囊', desc: '出牌阶段限一次，你可以弃置一张手牌，令一名已受伤角色回复 1 点体力', active: true },
  qixi:      { name: '奇袭', desc: '你可以将一张黑色牌当【过河拆桥】使用' },
};

const ASK_SHA = ['杀', '火杀', '雷杀'];

function hasSkill(p: Player, id: string): boolean {
  return (p.hero.skillIds ?? []).includes(id);
}

function isBlack(suit: CardSuit): boolean {
  return suit === 'spade' || suit === 'club';
}

function isRed(suit: CardSuit): boolean {
  return suit === 'heart' || suit === 'diamond';
}

/** 判定牌：从牌堆顶翻一张（不做任何处理，调用方决定获得或弃置） */
function drawTop(s: GameState): Card | undefined {
  if (s.drawPile.length === 0) {
    if (s.discardPile.length === 0) return undefined;
    s.drawPile = s.discardPile;
    s.discardPile = [];
    shuffle(s.drawPile);
  }
  return s.drawPile.pop();
}

/** 判定并记录日志 */
function doJudge(s: GameState, seat: number, label: string): Card | undefined {
  const c = drawTop(s);
  if (!c) {
    s.log.push(`↳【${label}】牌堆已空，判定失败`);
    return undefined;
  }
  s.log.push(`【判定】${s.players[seat].hero.name} 的【${label}】翻出 ${cardLabel(c)}`);
  return c;
}

/** 八卦阵判定：红色视为打出【闪】 */
function baguaSuccess(s: GameState, seat: number): boolean {
  const c = doJudge(s, seat, '八卦阵');
  if (!c) return false;
  s.discardPile.push(c);
  return isRed(c.suit);
}

/** 计算手里能打出几张响应牌（闪 / 杀 / 无懈可击），供 UI 与 AI 判断 */
export function responseCount(p: Player, need: '闪' | '杀' | '无懈'): number {
  if (need === '无懈') return p.hand.filter((c) => c.name === '无懈可击').length;
  if (need === '闪') {
    let n = p.hand.filter((c) => c.name === '闪').length;
    if (hasSkill(p, 'qingguo')) n += p.hand.filter((c) => isBlack(c.suit) && c.name !== '闪').length;
    if (hasSkill(p, 'longdan')) n += p.hand.filter((c) => ASK_SHA.includes(c.name)).length;
    return n;
  }
  let n = p.hand.filter((c) => ASK_SHA.includes(c.name)).length;
  if (hasSkill(p, 'wusheng')) n += p.hand.filter((c) => isRed(c.suit) && !ASK_SHA.includes(c.name) && c.name !== '闪').length;
  if (hasSkill(p, 'longdan')) n += p.hand.filter((c) => c.name === '闪').length;
  return n;
}

export function suitLabel(suit: CardSuit): string {
  return { spade: '♠', heart: '♥', club: '♣', diamond: '♦' }[suit];
}

export function cardLabel(c: Card): string {
  return `${suitLabel(c.suit)}${c.name}`;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function equipOf(p: Player, effect: string): Card | undefined {
  return p.equipZone.find((c) => c.effect === effect);
}

// ——— 建局 ———

/**
 * 创建 5 人身份局：seat 0 = 玩家，1-4 = 人机。
 * 传入 identity 即玩家抽到的身份，其余身份自动补齐；传 hero 即选将结果。
 */
export function createGame(opts: { identity?: Identity; hero?: Hero } = {}): GameState {
  const allIds: Identity[] = ['zhu', 'zhong', 'fan', 'fan', 'jian'];
  const myIdentity: Identity = opts.identity ?? 'zhu';
  const rest = allIds.slice();
  rest.splice(rest.indexOf(myIdentity), 1);
  shuffle(rest);
  const finalIds: Identity[] = [myIdentity, ...rest];
  const zhuSeat = finalIds.indexOf('zhu');

  const myHero = opts.hero ?? HEROES[Math.floor(Math.random() * HEROES.length)];
  const pool = HEROES.filter((h) => h.id !== myHero.id).slice();
  shuffle(pool);
  const aiHeroes = pool.slice(0, 4);

  const players: Player[] = [];
  for (let i = 0; i < 5; i++) {
    const hero = i === 0 ? myHero : aiHeroes[i - 1];
    // 官方规则：主公体力上限 +1
    const bonusHp = finalIds[i] === 'zhu' ? 1 : 0;
    players.push({
      seat: i,
      role: i === 0 ? 'human' : 'ai',
      identity: finalIds[i],
      hero,
      hp: hero.hp + bonusHp,
      maxHp: hero.hp + bonusHp,
      hand: [],
      judgeZone: [],
      equipZone: [],
      revealedIdentity: finalIds[i] === 'zhu' ? 'zhu' : undefined,
      attackedBy: new Set<number>(),
      playedThisTurn: [],
      canPlaySha: true,
      chained: false,
      stats: { kills: 0, damageDealt: 0, damageTaken: 0, cardsUsed: 0, saves: 0 },
    });
  }

  const state: GameState = {
    players,
    activeSeat: zhuSeat,
    phase: 'play',
    drawPile: buildDeck(),
    discardPile: [],
    turnCount: 1,
    log: ['游戏开始！主公身份公开，其余身份隐藏。'],
    winner: null,
    zhuSeat,
    usedSkill: [],
    shaBonus: 0,
    rendeGiven: 0,
    asks: [],
    ask: null,
    seq: 1,
    revealAll: false,
    deathNotice: null,
    discardTask: null,
  };

  for (const p of players) drawCards(state, p.seat, 4);
  startTurn(state, zhuSeat);
  return state;
}

// ——— 查询工具 ———

export function alivePlayers(s: GameState): Player[] {
  return s.players.filter((p) => p.hp > 0);
}

export function player(s: GameState, seat: number): Player | undefined {
  return s.players.find((p) => p.seat === seat);
}

export function nextAliveSeat(s: GameState, fromSeat: number): number {
  for (let i = 1; i <= 5; i++) {
    const seat = (fromSeat + i) % 5;
    if (s.players[seat].hp > 0) return seat;
  }
  return fromSeat;
}

export function distance(s: GameState, fromSeat: number, toSeat: number): number {
  // 官方规则：阵亡角色移出座次，距离只按存活角色的环形位置计算
  const aliveSeats = s.players.filter((p) => p.hp > 0).map((p) => p.seat);
  const fi = aliveSeats.indexOf(fromSeat);
  const ti = aliveSeats.indexOf(toSeat);
  let d: number;
  if (fi < 0 || ti < 0 || aliveSeats.length <= 1) {
    d = 1;
  } else {
    const n = aliveSeats.length;
    d = Math.min((ti - fi + n) % n, (fi - ti + n) % n);
  }
  const from = s.players[fromSeat];
  const to = s.players[toSeat];
  for (const c of from.equipZone) if (c.equipKind === 'horse' && (c.range ?? 0) < 0) d -= Math.abs(c.range!);
  for (const c of to.equipZone) if (c.equipKind === 'horse' && (c.range ?? 0) > 0) d += c.range!;
  if (hasSkill(from, 'mashu')) d -= 1;
  return Math.max(1, d);
}

export function attackRange(s: GameState, seat: number): number {
  const p = s.players[seat];
  let r = 1;
  for (const c of p.equipZone) if (c.equipKind === 'weapon') r = Math.max(r, c.range ?? 1);
  return r;
}

/** UI 用：这张牌能否指定某个座位（含射程 / 空城等限制） */
export function canTarget(s: GameState, card: Card, fromSeat: number, toSeat: number): boolean {
  const to = s.players[toSeat];
  if (!to || to.hp <= 0) return false;
  if (!card.needTarget) return false;
  const name = card.name;
  if (name === '杀' || name === '火杀' || name === '雷杀') {
    if (toSeat === fromSeat) return false;
    if (hasSkill(to, 'kongcheng') && to.hand.length === 0) return false;
    return distance(s, fromSeat, toSeat) <= attackRange(s, fromSeat);
  }
  if (name === '顺手牵羊') return toSeat !== fromSeat && distance(s, fromSeat, toSeat) <= 1;
  if (name === '过河拆桥' || name === '乐不思蜀' || name === '兵粮寸断') return toSeat !== fromSeat;
  // 桃 / 火攻 / 无懈可击：可以选自己
  return true;
}

// ——— 摸牌 / 伤害 ———

export function drawCards(s: GameState, seat: number, n: number) {
  const p = s.players[seat];
  for (let i = 0; i < n; i++) {
    const card = drawTop(s);
    if (!card) break;
    p.hand.push(card);
  }
}

/** 失去装备时的结算：白银狮子回血、枭姬摸两张 */
function onUnequip(s: GameState, p: Player, card: Card) {
  if (card.effect === 'shizi') heal(s, p.seat, 1);
  if (hasSkill(p, 'xiaoji') && p.hp > 0) {
    drawCards(s, p.seat, 2);
    s.log.push(`↳【枭姬】${p.hero.name} 失去【${card.name}】，摸 2 张牌`);
  }
}

function trySaveByPeach(s: GameState, p: Player) {
  while (p.hp <= 0) {
    const idx = p.hand.findIndex((c) => c.name === '桃');
    if (idx < 0) break;
    const c = p.hand.splice(idx, 1)[0];
    s.discardPile.push(c);
    p.stats.cardsUsed += 1;
    p.hp = 1;
    s.log.push(`↳ ${p.hero.name} 打出【桃】自救，回复到 1 点体力`);
  }
}

/** 濒死救援：同阵营的存活角色依次出【桃】，直到脱离濒死（内奸只自救） */
function sameCamp(s: GameState, aSeat: number, bSeat: number): boolean {
  const a = s.players[aSeat].identity;
  const b = s.players[bSeat].identity;
  if (a === 'jian' || b === 'jian') return false;
  const camp = (id: Identity) => (id === 'zhu' || id === 'zhong' ? 'gov' : 'fan');
  return camp(a) === camp(b);
}

function tryRescue(s: GameState, dyingSeat: number) {
  const p = s.players[dyingSeat];
  for (let k = 1; k <= 4 && p.hp <= 0; k++) {
    const a = s.players[(dyingSeat + k) % 5];
    if (a.hp <= 0 || !sameCamp(s, dyingSeat, a.seat)) continue;
    while (p.hp <= 0) {
      const idx = a.hand.findIndex((c) => c.name === '桃');
      if (idx < 0) break;
      const c = a.hand.splice(idx, 1)[0];
      s.discardPile.push(c);
      p.hp += 1;
      a.stats.cardsUsed += 1;
      a.stats.saves += 1;
      s.log.push(`↳【救援】${a.hero.name} 打出【桃】，${p.hero.name} 回复 1 点体力`);
    }
  }
}

/** 角色阵亡：公开身份、弃置所有牌、结算奖惩、写入阵亡公告 */
function killPlayer(s: GameState, seat: number, fromSeat?: number) {
  const p = s.players[seat];
  p.revealedIdentity = p.identity;
  s.log.push(`【阵亡】${p.hero.name} 阵亡！身份公布：${identityLabel(p.identity)}`);
  for (const c of [...p.hand, ...p.equipZone, ...p.judgeZone]) s.discardPile.push(c);
  p.hand = [];
  p.equipZone = [];
  p.judgeZone = [];

  const killer = fromSeat !== undefined && fromSeat !== seat ? s.players[fromSeat] : undefined;
  if (killer) killer.stats.kills += 1;
  let reward: string | undefined;
  let punish: string | undefined;

  checkGameOver(s);

  if (!s.winner && killer && killer.hp > 0) {
    // 官方奖惩：击杀反贼摸三张；主公误杀忠臣弃置所有手牌与装备
    if (p.identity === 'fan') {
      drawCards(s, killer.seat, 3);
      reward = `${killer.hero.name} 击杀反贼，摸 3 张牌`;
      s.log.push(`↳【奖惩】${reward}`);
    } else if (p.identity === 'zhong' && killer.seat === s.zhuSeat) {
      const n = killer.hand.length + killer.equipZone.length;
      for (const c of killer.hand) s.discardPile.push(c);
      for (const c of killer.equipZone) s.discardPile.push(c);
      killer.hand = [];
      killer.equipZone = [];
      punish = `主公 ${killer.hero.name} 误杀忠臣，弃置 ${n} 张手牌与装备`;
      s.log.push(`↳【奖惩】${punish}`);
    }
  }

  s.deathNotice = {
    seat,
    name: p.hero.name,
    identity: p.identity,
    killerSeat: killer?.seat,
    killerName: killer?.hero.name,
    reward,
    punish,
  };
}

/** UI 关闭阵亡公告 */
export function dismissDeathNotice(s: GameState) {
  s.deathNotice = null;
  s.seq++;
}

export function dealDamage(
  s: GameState,
  toSeat: number,
  amount: number,
  fromSeat?: number,
  opts: { element?: 'normal' | 'fire' | 'thunder'; cardName?: string; card?: Card } = {},
) {
  const p = s.players[toSeat];
  if (p.hp <= 0 || s.winner) return;

  let dmg = amount;
  // 藤甲：火伤 +1，普通杀/万箭/南蛮无效
  if (equipOf(p, 'tengjia')) {
    if (opts.element === 'fire') dmg += 1;
    if (opts.element === 'normal' && /杀|万箭齐发|南蛮入侵/.test(opts.cardName ?? '')) dmg = 0;
  }
  // 白银狮子：超过 1 点的伤害只受 1 点
  if (equipOf(p, 'shizi') && dmg > 1) dmg = 1;

  if (dmg <= 0) {
    s.log.push(`↳ ${p.hero.name} 的防具抵消了这次伤害`);
    return;
  }

  p.hp = Math.max(0, p.hp - dmg);
  p.stats.damageTaken += dmg;
  if (fromSeat !== undefined && fromSeat !== toSeat) {
    p.attackedBy.add(fromSeat);
    s.players[fromSeat].stats.damageDealt += dmg;
  }
  s.log.push(`【伤害】${p.hero.name} 受到 ${dmg} 点${opts.element === 'fire' ? '火焰' : opts.element === 'thunder' ? '雷电' : ''}伤害`);

  if (p.hp <= 0) {
    // 濒死流程：先自己吃桃 → 再同阵营队友救援 → 仍为 0 则阵亡
    trySaveByPeach(s, p);
    if (p.hp <= 0) tryRescue(s, toSeat);
    if (p.hp <= 0) {
      killPlayer(s, toSeat, fromSeat);
      return;
    }
  }

  // —— 受伤触发技 ——
  // 奸雄：获得造成伤害的那张牌
  if (hasSkill(p, 'jianxiong') && opts.card) {
    const ci = s.discardPile.findIndex((c) => c.id === opts.card!.id);
    const got = ci >= 0 ? s.discardPile.splice(ci, 1)[0] : opts.card;
    p.hand.push(got);
    s.log.push(`↳【奸雄】${p.hero.name} 获得【${got.name}】`);
  }
  if (hasSkill(p, 'yiji')) {
    drawCards(s, p.seat, 2);
    s.log.push(`↳【遗计】${p.hero.name} 摸 2 张牌`);
  }
  if (hasSkill(p, 'fankui') && fromSeat !== undefined && fromSeat !== toSeat) {
    const src = s.players[fromSeat];
    let got: Card | undefined;
    if (src.hand.length > 0) got = src.hand.splice(Math.floor(Math.random() * src.hand.length), 1)[0];
    else if (src.equipZone.length > 0) got = src.equipZone.splice(Math.floor(Math.random() * src.equipZone.length), 1)[0];
    if (got) {
      p.hand.push(got);
      s.log.push(`↳【反馈】${p.hero.name} 获得 ${src.hero.name} 的【${got.name}】`);
    }
  }
  if (hasSkill(p, 'ganglie') && fromSeat !== undefined && fromSeat !== toSeat) {
    const j = doJudge(s, p.seat, '刚烈');
    if (j) {
      s.discardPile.push(j);
      if (j.suit !== 'heart') {
        s.log.push(`↳【刚烈】判定非红桃，${s.players[fromSeat].hero.name} 受到 1 点伤害`);
        dealDamage(s, fromSeat, 1, p.seat, { element: 'normal', cardName: '刚烈' });
      } else {
        s.log.push('↳【刚烈】判定为红桃，技能失效');
      }
    }
  }
}

/** 【杀】的实际伤害：基础 1 + 裸衣 + 本回合加成（无双不再加伤，改为需要两张闪） */
export function shaDamage(s: GameState, fromSeat: number): number {
  const p = s.players[fromSeat];
  let dmg = 1;
  if (hasSkill(p, 'luoyi') && s.usedSkill.includes('luoyi')) dmg += 1;
  dmg += s.shaBonus;
  return dmg;
}

export function heal(s: GameState, toSeat: number, amount: number) {
  const p = s.players[toSeat];
  if (p.hp <= 0) return;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  if (p.hp > before) s.log.push(`【回复】${p.hero.name} 回复 ${p.hp - before} 点体力`);
}

export function identityLabel(id: Identity): string {
  switch (id) {
    case 'zhu': return '主公';
    case 'zhong': return '忠臣';
    case 'fan': return '反贼';
    case 'jian': return '内奸';
  }
}

export function checkGameOver(s: GameState) {
  const zhu = s.players[s.zhuSeat];
  const fansAlive = s.players.filter((p) => p.hp > 0 && p.identity === 'fan').length;
  const zhongAlive = s.players.filter((p) => p.hp > 0 && p.identity === 'zhong').length;
  const jianAlive = s.players.filter((p) => p.hp > 0 && p.identity === 'jian').length;

  if (zhu.hp <= 0) {
    s.winner = jianAlive > 0 && fansAlive === 0 && zhongAlive === 0 ? 'jian' : 'fan';
  } else if (fansAlive === 0 && jianAlive === 0) {
    s.winner = 'zhu';
  }

  if (s.winner && s.phase !== 'gameover') {
    s.phase = 'gameover';
    s.revealAll = true;
    // 结算结束：公开所有人身份，并清空未结算的响应队列 / 弃牌待办，
    // 避免游戏结束后残余锦囊继续结算，造成最终血量与身份显示不一致。
    for (const p of s.players) p.revealedIdentity = p.identity;
    s.asks = [];
    s.ask = null;
    s.discardTask = null;
    s.log.push(`🎉 游戏结束！${s.winner === 'zhu' ? '主公阵营（主公 / 忠臣）' : identityLabel(s.winner)} 获胜！`);
    s.log.push(`身份公开：${s.players.map((p) => `${p.hero.name}（${identityLabel(p.identity)}）`).join('、')}`);
  }
}

// ——— 响应队列 ———

function findResponseIndex(p: Player, need: '闪' | '杀' | '无懈'): number {
  if (need === '无懈') return p.hand.findIndex((c) => c.name === '无懈可击');
  if (need === '闪') {
    const i = p.hand.findIndex((c) => c.name === '闪');
    if (i >= 0) return i;
    // 倾国：黑色牌当【闪】打出
    if (hasSkill(p, 'qingguo')) {
      const bi = p.hand.findIndex((c) => isBlack(c.suit) && c.name !== '闪');
      if (bi >= 0) return bi;
    }
    if (hasSkill(p, 'longdan')) return p.hand.findIndex((c) => ASK_SHA.includes(c.name));
    return -1;
  }
  const i = p.hand.findIndex((c) => ASK_SHA.includes(c.name));
  if (i >= 0) return i;
  // 武圣：红色牌当【杀】打出
  if (hasSkill(p, 'wusheng')) {
    return p.hand.findIndex((c) => isRed(c.suit) && !ASK_SHA.includes(c.name) && c.name !== '闪');
  }
  if (hasSkill(p, 'longdan')) return p.hand.findIndex((c) => c.name === '闪');
  return -1;
}

function canRespondHuman(s: GameState, a: Ask): boolean {
  const p = s.players[a.toSeat];
  const need = a.needCount ?? 1;
  if (responseCount(p, a.need) >= need) return true;
  // 八卦阵：需要一张闪时可以判定
  return a.need === '闪' && need === 1 && !!equipOf(p, 'bagua');
}

/**
 * 无懈可击链：把一次锦囊结算事件包成「谁愿意打无懈」的响应链。
 * 链上每一位持牌者都会被依次询问；任何一方打出无懈即抵消 inner，无人响应则 inner 继续结算。
 */
function wuxieChain(s: GameState, event: Ask): Ask {
  let cur = event;
  const responders: number[] = [];
  for (let k = 1; k <= 5; k++) {
    const seat = (event.fromSeat + k) % 5;
    const p = s.players[seat];
    if (p.hp > 0 && p.hand.some((c) => c.name === '无懈可击')) responders.push(seat);
  }
  for (let i = responders.length - 1; i >= 0; i--) {
    cur = {
      kind: 'wuxie',
      fromSeat: event.fromSeat,
      toSeat: responders[i],
      need: '无懈',
      damage: 0,
      title: event.title,
      cardName: event.cardName,
      element: 'normal',
      inner: cur,
      event,
    };
  }
  return cur;
}

function pushAsk(s: GameState, ask: Ask) {
  const t = s.players[ask.toSeat];
  if (!t || t.hp <= 0) return;
  const tengjia = equipOf(t, 'tengjia');
  if (tengjia && ask.kind !== 'juedou') {
    if (ask.element === 'normal') {
      s.log.push(`↳ ${t.hero.name} 的【藤甲】免疫了${ask.cardName}`);
      return;
    }
    if (ask.element === 'fire') ask.damage += 1;
  }
  // 伤害型锦囊可被无懈可击响应
  const canWuxie = ask.kind === 'wanjian' || ask.kind === 'nanman' || ask.kind === 'juedou';
  s.asks.push(canWuxie ? wuxieChain(s, ask) : ask);
}

/** 依次结算响应队列：AI 自动出牌，人类需要手动确认 */
export function pump(s: GameState) {
  while (!s.ask && !s.winner) {
    const a = s.asks.shift();
    if (!a) break;
    const t = s.players[a.toSeat];
    if (!t || t.hp <= 0) continue;

    if (a.toSeat === 0) {
      if (canRespondHuman(s, a)) { s.ask = a; break; }
      applyMiss(s, a);
      continue;
    }

    if (aiRespond(s, a)) continue;
    applyMiss(s, a);
  }
  s.seq++;
}

/** AI 是否愿意为这次事件打出【无懈可击】：保自己，或保同阵营承受大伤害的队友 */
function aiWantsWuxie(s: GameState, a: Ask): boolean {
  const event = a.event ?? a.inner;
  if (!event || event.damage < 1) return false;
  if (event.toSeat === a.toSeat) return true;
  return sameCamp(s, a.toSeat, event.toSeat) && event.damage >= 2;
}

function aiRespond(s: GameState, a: Ask): boolean {
  const t = s.players[a.toSeat];
  if (a.autoHit) return false;
  if (a.kind === 'wuxie' && !aiWantsWuxie(s, a)) return false;
  const need = a.needCount ?? 1;
  if (responseCount(t, a.need) >= need) {
    const played: string[] = [];
    for (let k = 0; k < need; k++) {
      const idx = findResponseIndex(t, a.need);
      if (idx < 0) break;
      const c = t.hand.splice(idx, 1)[0];
      s.discardPile.push(c);
      t.stats.cardsUsed += 1;
      played.push(c.name);
    }
    if (a.kind === 'wuxie' && (a.event ?? a.inner)) {
      const ev = (a.event ?? a.inner)!;
      s.log.push(`↳【无懈可击】${t.hero.name} 抵消了针对 ${s.players[ev.toSeat].hero.name} 的${ev.title}`);
    } else {
      s.log.push(`↳ ${t.hero.name} 打出【${played.join('、')}】化解`);
    }
    afterResponse(s, a);
    return true;
  }
  if (a.need === '闪' && need === 1 && equipOf(t, 'bagua') && baguaSuccess(s, a.toSeat)) {
    s.log.push(`↳ ${t.hero.name} 的【八卦阵】判定成功，视为打出【闪】`);
    afterResponse(s, a);
    return true;
  }
  return false;
}

/** 决斗：一方出杀后，另一方也要继续出杀（无双需连续两张） */
function afterResponse(s: GameState, a: Ask) {
  // 无懈可击抵消成功：inner 事件不再结算
  if (a.kind === 'wuxie') return;
  if (a.kind === 'juedou') {
    const newSource = s.players[a.toSeat];
    const bonus = hasSkill(newSource, 'luoyi') && s.usedSkill.includes('luoyi') ? 1 : 0;
    s.asks.unshift({
      ...a,
      fromSeat: a.toSeat,
      toSeat: a.fromSeat,
      need: '杀',
      damage: 1 + bonus,
      needCount: hasSkill(s.players[a.fromSeat], 'wushuang') ? 2 : 1,
      usedCount: 0,
    });
  }
}

function applyMiss(s: GameState, a: Ask) {
  // 无人打出无懈：被抵消的事件重新放回队列继续结算
  if (a.kind === 'wuxie') {
    if (a.inner) s.asks.unshift(a.inner);
    return;
  }
  const t = s.players[a.toSeat];
  if (t.hp <= 0) return;
  s.log.push(`${t.hero.name} 无法化解${a.title}，受到 ${a.damage} 点伤害`);
  dealDamage(s, a.toSeat, a.damage, a.fromSeat, { element: a.element, cardName: a.cardName, card: a.card });
  // 麒麟弓：杀造成伤害时弃置目标一匹坐骑
  if (a.kind === 'sha') {
    const src = s.players[a.fromSeat];
    if (equipOf(src, 'qilin')) {
      const hi = t.equipZone.findIndex((c) => c.equipKind === 'horse');
      if (hi >= 0) {
        const horse = t.equipZone.splice(hi, 1)[0];
        s.discardPile.push(horse);
        s.log.push(`↳【麒麟弓】弃置了 ${t.hero.name} 的【${horse.name}】`);
      }
    }
  }
}

/** 人类玩家对当前 ask 的答复：useCard = 打出一张闪/杀（无双需连续打出两张） */
export function respondAsk(s: GameState, useCard: boolean) {
  const a = s.ask;
  if (!a) return;
  if (useCard) {
    const t = s.players[a.toSeat];
    const need = a.needCount ?? 1;
    const used = a.usedCount ?? 0;
    const idx = findResponseIndex(t, a.need);
    if (idx >= 0) {
      const c = t.hand.splice(idx, 1)[0];
      s.discardPile.push(c);
      t.stats.cardsUsed += 1;
      s.log.push(`↳ ${t.hero.name} 打出【${c.name}】${need > 1 ? `（${used + 1}/${need}）` : ''}`);
      if (a.kind === 'wuxie' && (a.event ?? a.inner)) {
        const ev = (a.event ?? a.inner)!;
        s.log.push(`↳【无懈可击】抵消了针对 ${s.players[ev.toSeat].hero.name} 的${ev.title}`);
      }
      a.usedCount = used + 1;
      if (a.usedCount < need) {
        // 还需继续打出，保持在同一个 ask 上
        s.ask = a;
        s.seq++;
        return;
      }
      s.ask = null;
      afterResponse(s, a);
    } else if (a.need === '闪' && need === 1 && equipOf(t, 'bagua') && baguaSuccess(s, a.toSeat)) {
      s.ask = null;
      s.log.push(`↳ ${t.hero.name} 的【八卦阵】判定成功，视为打出【闪】`);
      afterResponse(s, a);
    } else {
      s.ask = null;
      applyMiss(s, a);
    }
  } else {
    s.ask = null;
    applyMiss(s, a);
  }
  pump(s);
}

// —— 使用一张牌（玩家 / AI 都走这条路径） ——
export function playCard(
  s: GameState,
  fromSeat: number,
  cardIdx: number,
  targetSeat?: number,
  opts: { asSha?: boolean } = {},
): { ok: boolean; reason?: string } {
  const p = s.players[fromSeat];
  if (s.phase !== 'play') return { ok: false, reason: '不是出牌阶段' };
  if (s.winner) return { ok: false, reason: '游戏已结束' };
  if (s.ask) return { ok: false, reason: '请先处理伤害响应' };
  const card = p.hand[cardIdx];
  if (!card) return { ok: false, reason: '没有这张牌' };

  // 武圣：任意红色牌当【杀】使用（闪主动当杀也走这里）
  const wushengSha = hasSkill(p, 'wusheng') && isRed(card.suit) && (card.name === '闪' || !!opts.asSha);
  const asSha = wushengSha && !ASK_SHA.includes(card.name);
  const isSha = ASK_SHA.includes(card.name) || asSha;
  // 【闪】只能作为响应或武圣当杀使用，不能主动打出
  if (card.name === '闪' && !asSha) return { ok: false, reason: '闪是被动牌，只能在被杀时打出' };

  if (isSha) {
    if (!p.canPlaySha && !hasSkill(p, 'paoxiao') && !equipOf(p, 'lianu')) {
      return { ok: false, reason: '每回合只能出一张杀' };
    }
    if (targetSeat === undefined) return { ok: false, reason: '杀需要目标' };
    if (distance(s, fromSeat, targetSeat) > attackRange(s, fromSeat)) {
      return { ok: false, reason: '攻击距离不够' };
    }
    const t = s.players[targetSeat];
    if (!t || t.hp <= 0) return { ok: false, reason: '目标无效' };
    if (hasSkill(t, 'kongcheng') && t.hand.length === 0 && t.seat !== fromSeat) {
      return { ok: false, reason: `${t.hero.name} 处于空城状态，无法成为杀的目标` };
    }
  } else if (card.needTarget && card.targetKind !== 'self' && targetSeat === undefined) {
    // 桃 / 火攻 / 无懈如果没点目标就默认指向自己
    if (card.name === '过河拆桥' || card.name === '顺手牵羊' || card.name === '乐不思蜀' || card.name === '兵粮寸断' || card.name === '决斗') {
      return { ok: false, reason: '需要选择目标' };
    }
  }
  if (targetSeat !== undefined && card.needTarget) {
    if (!canTarget(s, card, fromSeat, targetSeat)) return { ok: false, reason: '该目标不合法' };
  }

  p.hand.splice(cardIdx, 1);
  p.stats.cardsUsed += 1;
  p.playedThisTurn.push(asSha ? '杀' : card.name);
  const toDiscard = card.type !== 'equip' && !card.delayed;
  if (toDiscard) s.discardPile.push(card);

  s.log.push(
    `${p.hero.name} 使用了【${asSha ? `${cardLabel(card)}（武圣当杀）` : cardLabel(card)}】${targetSeat !== undefined ? ` → ${s.players[targetSeat].hero.name}` : ''}`,
  );

  // 集智：使用锦囊摸 1
  if (card.type === 'trick' && hasSkill(p, 'jizhi')) {
    drawCards(s, fromSeat, 1);
    s.log.push(`↳【集智】${p.hero.name} 摸 1 张牌`);
  }

  switch (asSha ? '杀' : card.name) {
    case '杀':
    case '火杀':
    case '雷杀': {
      // 铁骑：判定为红色则目标不能出闪
      let tieqi = false;
      if (hasSkill(p, 'tieqi')) {
        const j = doJudge(s, fromSeat, '铁骑');
        if (j) {
          tieqi = isRed(j.suit);
          s.discardPile.push(j);
          s.log.push(tieqi ? '↳【铁骑】判定为红色，此【杀】不可闪避' : '↳【铁骑】判定为黑色，技能失效');
        }
      }
      const qinggang = !!equipOf(p, 'qinggang');
      const t = s.players[targetSeat!];
      // 仁王盾：黑色普通杀无效（青釭剑无视防具）
      if (!qinggang && equipOf(t, 'renwang') && (card.element ?? 'normal') === 'normal' && isBlack(card.suit)) {
        s.log.push(`↳ ${t.hero.name} 的【仁王盾】令黑色【杀】无效`);
        break;
      }
      let dmg = shaDamage(s, fromSeat);
      if (equipOf(p, 'guding') && t.hand.length === 0) dmg += 1;
      // 寒冰剑：改为弃置目标两张牌
      if (equipOf(p, 'ice')) {
        let n = 0;
        while (n < 2) {
          if (t.equipZone.length > 0) {
            const c = t.equipZone.shift()!;
            s.discardPile.push(c);
            onUnequip(s, t, c);
          } else if (t.hand.length > 0) {
            s.discardPile.push(t.hand.splice(Math.floor(Math.random() * t.hand.length), 1)[0]);
          } else break;
          n++;
        }
        s.log.push(`↳【寒冰剑】弃置了 ${t.hero.name} ${n} 张牌，防止伤害`);
        break;
      }
      pushAsk(s, {
        kind: 'sha',
        fromSeat,
        toSeat: targetSeat!,
        need: '闪',
        damage: dmg,
        title: `【${card.name}】`,
        cardName: card.name,
        element: card.element ?? 'normal',
        autoHit: tieqi,
        // 无双：需连续两张【闪】才能抵消
        needCount: hasSkill(p, 'wushuang') ? 2 : 1,
        card,
      });
      if (!hasSkill(p, 'paoxiao') && !equipOf(p, 'lianu')) p.canPlaySha = false;
      pump(s);
      break;
    }
    case '闪':
      // 走不到这里（已在上面校验）
      break;
    case '桃': {
      const to = targetSeat ?? fromSeat;
      heal(s, to, 1);
      break;
    }
    case '酒':
      s.shaBonus += 1;
      s.log.push(`↳ ${p.hero.name} 饮下【酒】，本回合【杀】伤害 +1`);
      break;
    case '无中生有':
      drawCards(s, fromSeat, 2);
      break;
    case '过河拆桥':
    case '顺手牵羊': {
      if (targetSeat === undefined) break;
      const t = s.players[targetSeat];
      if (t.judgeZone.length === 0 && t.equipZone.length === 0 && t.hand.length === 0) {
        s.log.push(`↳ ${t.hero.name} 没有可作用的牌`);
        break;
      }
      let picked: Card | undefined;
      if (t.judgeZone.length > 0) picked = t.judgeZone.shift();
      else if (t.equipZone.length > 0) {
        const idx = Math.floor(Math.random() * t.equipZone.length);
        picked = t.equipZone.splice(idx, 1)[0];
        onUnequip(s, t, picked);
      } else if (t.hand.length > 0) {
        picked = t.hand.splice(Math.floor(Math.random() * t.hand.length), 1)[0];
      }
      if (!picked) break;
      if (card.name === '过河拆桥') {
        s.discardPile.push(picked);
        s.log.push(`↳ 弃置了 ${t.hero.name} 的【${picked.name}】`);
      } else {
        p.hand.push(picked);
        s.log.push(`↳ 获得了 ${t.hero.name} 的【${picked.name}】`);
      }
      break;
    }
    case '决斗': {
      if (targetSeat !== undefined) {
        const t = s.players[targetSeat];
        if (hasSkill(t, 'kongcheng') && t.hand.length === 0) {
          s.log.push(`↳ ${t.hero.name} 处于空城，【决斗】无效`);
          break;
        }
        pushAsk(s, {
          kind: 'juedou',
          fromSeat,
          toSeat: targetSeat,
          need: '杀',
          // 裸衣：本回合【决斗】伤害 +1
          damage: hasSkill(p, 'luoyi') && s.usedSkill.includes('luoyi') ? 2 : 1,
          title: '【决斗】',
          cardName: '决斗',
          element: 'normal',
          needCount: hasSkill(t, 'wushuang') ? 2 : 1,
          card,
        });
        pump(s);
      }
      break;
    }
    case '万箭齐发':
      for (const t of s.players) {
        if (t.seat === fromSeat || t.hp <= 0) continue;
        pushAsk(s, {
          kind: 'wanjian',
          fromSeat,
          toSeat: t.seat,
          need: '闪',
          damage: 1,
          title: '【万箭齐发】',
          cardName: '万箭齐发',
          element: 'normal',
          card,
        });
      }
      pump(s);
      break;
    case '南蛮入侵':
      for (const t of s.players) {
        if (t.seat === fromSeat || t.hp <= 0) continue;
        pushAsk(s, {
          kind: 'nanman',
          fromSeat,
          toSeat: t.seat,
          need: '杀',
          damage: 1,
          title: '【南蛮入侵】',
          cardName: '南蛮入侵',
          element: 'normal',
          card,
        });
      }
      pump(s);
      break;
    case '桃园结义':
      for (const t of s.players) if (t.hp > 0 && t.hp < t.maxHp) heal(s, t.seat, 1);
      break;
    case '火攻': {
      const to = targetSeat ?? fromSeat;
      const t = s.players[to];
      if (t.hand.length === 0) {
        s.log.push(`↳ ${t.hero.name} 没有手牌，【火攻】无效`);
        break;
      }
      const shown = t.hand[Math.floor(Math.random() * t.hand.length)];
      s.log.push(`↳ ${t.hero.name} 展示了【${cardLabel(shown)}】`);
      const idx = p.hand.findIndex((c) => c.suit === shown.suit);
      if (idx >= 0) {
        const d = p.hand.splice(idx, 1)[0];
        s.discardPile.push(d);
        s.log.push(`↳ ${p.hero.name} 弃置同花色【${d.name}】，火攻命中！`);
        dealDamage(s, to, 1, fromSeat, { element: 'fire', cardName: '火攻', card });
      } else {
        s.log.push(`↳ 没有 ${suitLabel(shown.suit)} 花色的牌，火攻未命中`);
      }
      break;
    }
    case '乐不思蜀':
    case '兵粮寸断':
      if (targetSeat !== undefined) {
        s.players[targetSeat].judgeZone.push(card);
        s.log.push(`↳ ${s.players[targetSeat].hero.name} 的判定区多了一张【${card.name}】`);
      }
      break;
    case '闪电':
      p.judgeZone.push(card);
      s.log.push(`↳ 【闪电】进入 ${p.hero.name} 的判定区`);
      break;
    case '无懈可击': {
      const to = targetSeat ?? fromSeat;
      const t = s.players[to];
      if (t.judgeZone.length > 0) {
        const removed = t.judgeZone.shift()!;
        s.discardPile.push(removed);
        s.log.push(`↳ 【无懈可击】抵消了 ${t.hero.name} 判定区的【${removed.name}】`);
      } else {
        s.log.push(`↳ ${t.hero.name} 的判定区没有延时锦囊，【无懈可击】无效果`);
      }
      break;
    }
    case '铁索连环':
      // 简化：重铸 —— 弃置后摸 1 张
      drawCards(s, fromSeat, 1);
      s.log.push(`↳ 重铸【铁索连环】，摸 1 张牌`);
      break;
    default:
      if (card.type === 'equip') {
        const prevIdx = p.equipZone.findIndex((c) => c.equipKind === card.equipKind);
        if (prevIdx >= 0) {
          const prev = p.equipZone.splice(prevIdx, 1)[0];
          s.discardPile.push(prev);
          onUnequip(s, p, prev);
          s.log.push(`替换装备：卸下【${prev.name}】`);
        }
        p.equipZone.push(card);
        s.log.push(`${p.hero.name} 装备了【${card.name}】`);
      }
  }
  s.seq++;
  return { ok: true };
}

// —— 主动技（每回合各限一次） ——
// 注意：函数名不能以 use 开头，否则会被 ESLint 的 react-hooks 规则当成 Hook。
export type ActiveSkillId = 'rende' | 'zhiheng' | 'fanjian' | 'kurou' | 'qingnang' | 'qixi';

export function activateSkill(
  s: GameState,
  seat: number,
  skillId: ActiveSkillId,
  opts: { cardIdx?: number; targetSeat?: number } = {},
): { ok: boolean; reason?: string } {
  const p = s.players[seat];
  if (s.phase !== 'play' || s.winner) return { ok: false, reason: '当前不能发动技能' };
  if (s.activeSeat !== seat) return { ok: false, reason: '只能在自己回合发动' };
  if (!hasSkill(p, skillId)) return { ok: false, reason: '没有这个技能' };
  // 苦肉、仁德按官方规则不限次数，其余主动技每回合限一次
  if (skillId !== 'kurou' && skillId !== 'rende' && s.usedSkill.includes(skillId)) {
    return { ok: false, reason: '本回合已发动过' };
  }

  const consumeCard = (idx: number) => {
    const c = p.hand[idx];
    p.hand.splice(idx, 1);
    s.discardPile.push(c);
    return c;
  };

  switch (skillId) {
    case 'rende': {
      if (opts.cardIdx === undefined) return { ok: false, reason: '请选择要给的手牌' };
      if (opts.targetSeat === undefined) return { ok: false, reason: '请选择要交给的角色' };
      if (opts.targetSeat === seat) return { ok: false, reason: '不能把牌交给自己' };
      const c = p.hand.splice(opts.cardIdx, 1)[0];
      if (!c) return { ok: false, reason: '没有这张牌' };
      const t = s.players[opts.targetSeat];
      t.hand.push(c);
      s.rendeGiven += 1;
      s.log.push(`【仁德】${p.hero.name} 将【${c.name}】交给 ${t.hero.name}`);
      if (s.rendeGiven === 2) {
        heal(s, seat, 1);
        s.log.push(`↳【仁德】本阶段累计给出 2 张牌，${p.hero.name} 回复 1 点体力`);
      }
      break;
    }
    case 'zhiheng': {
      if (p.hand.length === 0) return { ok: false, reason: '没有手牌可制衡' };
      const n = p.hand.length;
      while (p.hand.length > 0) s.discardPile.push(p.hand.pop()!);
      drawCards(s, seat, n);
      s.log.push(`【制衡】${p.hero.name} 弃置 ${n} 张牌并重新摸 ${n} 张`);
      break;
    }
    case 'fanjian': {
      if (opts.targetSeat === undefined) return { ok: false, reason: '请选择反间目标' };
      if (opts.targetSeat === seat) return { ok: false, reason: '不能对自己发动反间' };
      if (opts.cardIdx === undefined) return { ok: false, reason: '请选择要交出的手牌' };
      const c = p.hand.splice(opts.cardIdx, 1)[0];
      if (!c) return { ok: false, reason: '没有这张牌' };
      const t = s.players[opts.targetSeat];
      const suits: CardSuit[] = ['spade', 'heart', 'club', 'diamond'];
      const chosen = suits[Math.floor(Math.random() * suits.length)];
      s.log.push(`【反间】${p.hero.name} 令 ${t.hero.name} 选择一种花色`);
      s.log.push(`↳ ${t.hero.name} 选择了 ${suitLabel(chosen)}，获得并展示【${cardLabel(c)}】`);
      t.hand.push(c);
      if (c.suit !== chosen) {
        s.log.push('↳ 花色不同，受到 1 点伤害');
        dealDamage(s, opts.targetSeat, 1, seat, { element: 'normal', cardName: '反间' });
      } else {
        s.log.push('↳ 花色相同，反间未造成伤害');
      }
      break;
    }
    case 'kurou': {
      if (p.hp <= 1) return { ok: false, reason: '体力不足，不能苦肉' };
      p.hp -= 1;
      s.log.push(`【苦肉】${p.hero.name} 失去 1 点体力，摸 2 张牌`);
      drawCards(s, seat, 2);
      break;
    }
    case 'qingnang': {
      if (opts.cardIdx === undefined) return { ok: false, reason: '请选择要弃置的手牌' };
      const to = opts.targetSeat ?? seat;
      if (s.players[to].hp >= s.players[to].maxHp) return { ok: false, reason: '目标体力已满' };
      const c = consumeCard(opts.cardIdx);
      heal(s, to, 1);
      s.log.push(`【青囊】${p.hero.name} 弃置【${c.name}】，令 ${s.players[to].hero.name} 回复 1 点体力`);
      break;
    }
    case 'qixi': {
      if (opts.cardIdx === undefined) return { ok: false, reason: '请选择一张黑色手牌' };
      if (opts.targetSeat === undefined) return { ok: false, reason: '请选择要拆牌的目标' };
      const c = p.hand[opts.cardIdx];
      if (!c || !isBlack(c.suit)) return { ok: false, reason: '只能使用黑色手牌' };
      const t = s.players[opts.targetSeat];
      if (t.judgeZone.length === 0 && t.equipZone.length === 0 && t.hand.length === 0) {
        return { ok: false, reason: '目标没有可拆的牌' };
      }
      consumeCard(opts.cardIdx);
      let picked: Card | undefined;
      if (t.judgeZone.length > 0) picked = t.judgeZone.shift();
      else if (t.equipZone.length > 0) {
        const idx = Math.floor(Math.random() * t.equipZone.length);
        picked = t.equipZone.splice(idx, 1)[0];
        onUnequip(s, t, picked);
      } else {
        picked = t.hand.splice(Math.floor(Math.random() * t.hand.length), 1)[0];
      }
      if (picked) s.discardPile.push(picked);
      s.log.push(`【奇袭】${p.hero.name} 弃置【${c.name}】拆掉 ${t.hero.name} 的【${picked?.name ?? '一张牌'}】`);
      break;
    }
  }
  if (skillId !== 'kurou' && skillId !== 'rende') s.usedSkill.push(skillId);
  s.seq++;
  return { ok: true };
}

// —— 回合推进 ——
/** 手牌保留价值：AI 弃牌时丢分低的，尽量保桃、闪 */
function cardKeepScore(c: Card): number {
  if (c.name === '桃') return 100;
  if (c.name === '闪') return 95;
  if (ASK_SHA.includes(c.name)) return 85;
  if (c.name === '无懈可击') return 78;
  if (c.name === '无中生有') return 80;
  if (c.type === 'equip') return 55;
  if (c.type === 'trick') return 50;
  return 20;
}

function aiDiscard(s: GameState, seat: number, count: number) {
  const p = s.players[seat];
  const discarded: string[] = [];
  for (let i = 0; i < count && p.hand.length > 0; i++) {
    let worst = 0;
    for (let k = 1; k < p.hand.length; k++) {
      if (cardKeepScore(p.hand[k]) < cardKeepScore(p.hand[worst])) worst = k;
    }
    const c = p.hand.splice(worst, 1)[0];
    s.discardPile.push(c);
    discarded.push(c.name);
  }
  if (discarded.length > 0) s.log.push(`↳【弃牌】${p.hero.name} 弃置 ${discarded.length} 张手牌`);
}

/** 人类玩家在弃牌阶段点击手牌弃置 */
export function discardCard(s: GameState, seat: number, idx: number) {
  const t = s.discardTask;
  if (!t || t.seat !== seat || s.winner) return;
  const p = s.players[seat];
  const c = p.hand.splice(idx, 1)[0];
  if (!c) return;
  s.discardPile.push(c);
  s.log.push(`${p.hero.name} 弃置【${cardLabel(c)}】`);
  t.count -= 1;
  if (t.count <= 0) {
    s.discardTask = null;
    s.phase = 'play';
    advanceTurn(s);
  }
  s.seq++;
}

/** 结束当前回合，把控制权交给下家 */
function advanceTurn(s: GameState) {
  const cur = s.players[s.activeSeat];
  cur.canPlaySha = true;
  cur.playedThisTurn = [];
  s.usedSkill = [];
  s.shaBonus = 0;
  s.rendeGiven = 0;
  s.discardTask = null;

  const nextSeat = nextAliveSeat(s, s.activeSeat);
  s.activeSeat = nextSeat;
  if (nextSeat === s.zhuSeat) s.turnCount++;
  s.seq++;
  startTurn(s, nextSeat);
}

export function endTurn(s: GameState) {
  if (s.winner) return;
  const cur = s.players[s.activeSeat];

  // 闭月：结束阶段摸 1 张
  if (hasSkill(cur, 'biyue')) {
    drawCards(s, cur.seat, 1);
    s.log.push(`↳【闭月】${cur.hero.name} 摸 1 张牌`);
  }

  // 弃牌阶段：手牌上限 = 当前体力值
  const limit = Math.max(cur.hp, 0);
  const over = Math.max(0, cur.hand.length - limit);
  if (over > 0) {
    if (cur.role === 'human') {
      // 人类玩家手动弃牌，避免系统随机丢牌
      s.discardTask = { seat: cur.seat, count: over };
      s.phase = 'discard';
      s.log.push(`【弃牌阶段】${cur.hero.name} 手牌 ${cur.hand.length} 张 / 上限 ${limit}，需弃置 ${over} 张`);
      s.seq++;
      return;
    }
    aiDiscard(s, cur.seat, over);
  }
  advanceTurn(s);
}

function startTurn(s: GameState, seat: number) {
  const p = s.players[seat];
  if (p.hp <= 0 || s.winner) return;
  s.phase = 'play';
  s.log.push(`=== 回合 ${s.turnCount} · ${p.hero.name} 行动 ===`);

  // —— 判定阶段（从牌堆真实翻判定牌） ——
  let skipPlay = false;
  let skipDraw = false;
  while (p.judgeZone.length > 0) {
    const j = p.judgeZone.shift()!;
    const judged = doJudge(s, seat, `判定区·${j.name}`);
    if (j.name === '乐不思蜀') {
      s.discardPile.push(j);
      if (judged) s.discardPile.push(judged);
      // 官方：判定为红桃则通过，否则跳过出牌阶段
      if (judged && judged.suit === 'heart') {
        s.log.push(`↳ ${p.hero.name} 判定为红桃，【乐不思蜀】失效`);
      } else {
        skipPlay = true;
        s.log.push(`↳ ${p.hero.name} 未判到红桃，跳过本回合出牌阶段`);
      }
    } else if (j.name === '兵粮寸断') {
      s.discardPile.push(j);
      if (judged) s.discardPile.push(judged);
      // 官方：判定为梅花则通过，否则跳过摸牌阶段
      if (judged && judged.suit === 'club') {
        s.log.push(`↳ ${p.hero.name} 判定为梅花，【兵粮寸断】失效`);
      } else {
        skipDraw = true;
        s.log.push(`↳ ${p.hero.name} 未判到梅花，跳过本回合摸牌阶段`);
      }
    } else if (j.name === '闪电') {
      if (judged) s.discardPile.push(judged);
      // 官方：判定为黑桃 2~9 时命中，造成 3 点雷电伤害，否则传给下家
      if (judged && judged.suit === 'spade' && judged.point >= 2 && judged.point <= 9) {
        s.discardPile.push(j);
        s.log.push(`⚡【闪电】命中 ${p.hero.name}，受到 3 点雷电伤害`);
        dealDamage(s, seat, 3, undefined, { element: 'thunder', cardName: '闪电' });
        if (p.hp <= 0) return;
      } else {
        const next = nextAliveSeat(s, seat);
        s.players[next].judgeZone.push(j);
        s.log.push(`【闪电】未命中，转移给 ${s.players[next].hero.name}`);
      }
    } else {
      s.discardPile.push(j);
    }
  }

  if (skipPlay) {
    s.log.push(`${p.hero.name} 跳过出牌阶段`);
    endTurn(s);
    return;
  }

  // —— 回合开始时：观星 / 洛神 ——
  if (hasSkill(p, 'guanxing')) {
    const peekN = Math.min(5, Math.max(1, alivePlayers(s).length));
    while (s.drawPile.length < peekN && s.discardPile.length > 0) {
      s.drawPile.unshift(s.discardPile.pop()!);
    }
    const peek = s.drawPile.slice(Math.max(0, s.drawPile.length - peekN));
    if (peek.length > 0) {
      const usefulNames = ['杀', '火杀', '雷杀', '闪', '桃', '无中生有', '决斗', '过河拆桥', '顺手牵羊', '万箭齐发', '南蛮入侵'];
      const useful = peek.filter((c) => usefulNames.includes(c.name));
      const rest = peek.filter((c) => !usefulNames.includes(c.name));
      s.drawPile.splice(s.drawPile.length - peek.length, peek.length);
      s.drawPile.unshift(...rest); // 牌堆底
      s.drawPile.push(...useful); // 牌堆顶
      s.log.push(`【观星】${p.hero.name} 观看牌堆顶 ${peek.length} 张：${peek.map(cardLabel).join('、')}`);
      if (rest.length > 0) s.log.push(`↳ 将 ${rest.length} 张置于牌堆底，${useful.length} 张留在牌堆顶`);
    }
  }

  if (hasSkill(p, 'luoshen')) {
    let got = 0;
    for (let guard = 0; guard < 30; guard++) {
      const c = doJudge(s, seat, '洛神');
      if (!c) break;
      if (isBlack(c.suit)) {
        p.hand.push(c);
        got++;
        s.log.push(`↳【洛神】获得【${cardLabel(c)}】，可以继续`);
      } else {
        s.discardPile.push(c);
        s.log.push('↳【洛神】判定为红色，结束');
        break;
      }
    }
    if (got > 0) s.log.push(`↳【洛神】共获得 ${got} 张牌`);
  }

  // —— 摸牌阶段 ——
  if (!skipDraw) {
    if (hasSkill(p, 'tuxi')) {
      // 突袭：放弃摸牌，改为获得至多两名其他角色各一张手牌
      const targets = alivePlayers(s)
        .filter((t) => t.seat !== seat && t.hand.length > 0 && isEnemyFor(s, seat, t.seat))
        .slice(0, 2);
      if (targets.length > 0) {
        for (const t of targets) {
          const c = t.hand.splice(Math.floor(Math.random() * t.hand.length), 1)[0];
          p.hand.push(c);
          s.log.push(`↳【突袭】${p.hero.name} 获得 ${t.hero.name} 的一张手牌`);
        }
      } else {
        drawCards(s, seat, 2);
      }
    } else {
      let drawN = 2;
      if (hasSkill(p, 'yingzi')) drawN++;
      if (hasSkill(p, 'luoyi')) {
        drawN = Math.max(1, drawN - 1);
        s.usedSkill.push('luoyi');
        s.log.push(`↳【裸衣】${p.hero.name} 少摸一张牌，本回合【杀】与【决斗】伤害 +1`);
      }
      drawCards(s, seat, drawN);
      if (hasSkill(p, 'yingzi')) s.log.push(`↳【英姿】${p.hero.name} 额外摸 1 张牌`);
    }
  }
  s.seq++;
}

// —— AI 决策 ——

/** AI 视角判断某人是否为敌人（不偷看隐藏身份，靠 主公公开 + 被打过 推断） */
function isEnemyFor(s: GameState, aiSeat: number, targetSeat: number): boolean {
  const ai = s.players[aiSeat];
  const t = s.players[targetSeat];
  if (!t || t.hp <= 0 || targetSeat === aiSeat) return false;
  const zhu = s.players[s.zhuSeat];
  switch (ai.identity) {
    case 'fan':
      return t.identity === 'zhu' || ai.attackedBy.has(targetSeat);
    case 'zhong':
      return zhu.attackedBy.has(targetSeat) || ai.attackedBy.has(targetSeat);
    case 'jian':
      // 内奸搅局：主公血少就杀反贼，否则杀忠臣/血少的
      if (t.identity === 'zhu') return zhu.hp <= 2 && alivePlayers(s).length <= 2;
      return t.hp <= 3;
    case 'zhu':
    default:
      return ai.attackedBy.has(targetSeat) || (!t.revealedIdentity && Math.random() < 0.3);
  }
}

function aiSkills(s: GameState, seat: number) {
  const p = s.players[seat];
  const enemies = alivePlayers(s).filter((t) => t.seat !== seat && isEnemyFor(s, seat, t.seat));
  const junk = p.hand.findIndex((c) => c.name !== '桃' && !ASK_SHA.includes(c.name) && c.name !== '闪');

  if (hasSkill(p, 'zhiheng') && p.hand.length >= 3 && !p.hand.some((c) => ASK_SHA.includes(c.name))) {
    activateSkill(s, seat, 'zhiheng');
  }
  if (hasSkill(p, 'fanjian') && junk >= 0 && enemies.length > 0) {
    const idx = p.hand.indexOf(p.hand[junk]);
    activateSkill(s, seat, 'fanjian', { cardIdx: idx, targetSeat: enemies[0].seat });
  }
  if (hasSkill(p, 'kurou') && p.hp >= 3 && p.hand.length <= 3) {
    activateSkill(s, seat, 'kurou');
  }
  if (hasSkill(p, 'qingnang') && p.hp < p.maxHp && junk >= 0) {
    activateSkill(s, seat, 'qingnang', { cardIdx: junk, targetSeat: seat });
  }
  if (hasSkill(p, 'rende') && p.hp < p.maxHp) {
    const ally = alivePlayers(s)
      .filter((t) => t.seat !== seat && !isEnemyFor(s, seat, t.seat))
      .sort((a, b) => a.hp - b.hp)[0];
    if (ally) {
      const idx = p.hand.findIndex((c) => c.name === '闪' || c.name === '桃');
      if (idx >= 0) activateSkill(s, seat, 'rende', { cardIdx: idx, targetSeat: ally.seat });
    }
  }
}

interface Move { idx: number; target?: number; asSha?: boolean }

/** 挑一张当前最值得出的牌；返回 null 表示没牌可出 */
function chooseMove(s: GameState, seat: number): Move | null {
  const p = s.players[seat];
  const enemies = alivePlayers(s)
    .filter((t) => t.seat !== seat && isEnemyFor(s, seat, t.seat))
    .sort((a, b) => a.hp - b.hp);

  const has = (name: string) => p.hand.findIndex((c) => c.name === name);
  const equipIdx = p.hand.findIndex((c) => c.type === 'equip');

  // 1. 装备先上
  if (equipIdx >= 0) return { idx: equipIdx };

  // 2. 无中生有
  const wz = has('无中生有');
  if (wz >= 0) return { idx: wz };

  // 3. 桃
  if (p.hp < p.maxHp) {
    const tao = has('桃');
    if (tao >= 0) return { idx: tao };
  }

  // 4. 桃园结义（自己也受益）
  const ty = has('桃园结义');
  if (ty >= 0 && (p.hp < p.maxHp || alivePlayers(s).some((t) => t.seat !== seat && t.hp < t.maxHp))) {
    return { idx: ty };
  }

  // 5. 杀（含 火杀 / 雷杀 / 武圣闪）
  const shaable = p.hand.findIndex((c) => ASK_SHA.includes(c.name));
  const canSha = p.canPlaySha || hasSkill(p, 'paoxiao') || !!equipOf(p, 'lianu');
  if (canSha) {
    if (shaable >= 0) {
      const target = enemies.find(
        (t) => distance(s, seat, t.seat) <= attackRange(s, seat) && !(hasSkill(t, 'kongcheng') && t.hand.length === 0),
      );
      if (target) {
        const jiu = has('酒');
        if (jiu >= 0 && target.hp > 1) return { idx: jiu };
        return { idx: shaable, target: target.seat };
      }
    }
    if (hasSkill(p, 'wusheng')) {
      // 武圣：任意红色牌（优先闪等非桃牌）当杀
      const redIdx = p.hand.findIndex((c) => isRed(c.suit) && !ASK_SHA.includes(c.name) && c.name !== '桃');
      if (redIdx >= 0) {
        const target = enemies.find(
          (t) => distance(s, seat, t.seat) <= attackRange(s, seat) && !(hasSkill(t, 'kongcheng') && t.hand.length === 0),
        );
        if (target) return { idx: redIdx, target: target.seat, asSha: true };
      }
    }
  }

  // 6. 拆 / 牵 / 乐 / 兵粮
  for (const name of ['过河拆桥', '顺手牵羊', '乐不思蜀', '兵粮寸断']) {
    const idx = has(name);
    if (idx < 0) continue;
    const target = enemies.find((t) => {
      if (name === '顺手牵羊') return distance(s, seat, t.seat) <= 1 && (t.hand.length + t.equipZone.length) > 0;
      if (name === '乐不思蜀' || name === '兵粮寸断') return t.judgeZone.length === 0;
      return t.hand.length + t.equipZone.length + t.judgeZone.length > 0;
    });
    if (target) return { idx, target: target.seat };
  }

  // 7. 决斗（手里有杀才打）
  const jd = has('决斗');
  if (jd >= 0 && p.hand.some((c) => ASK_SHA.includes(c.name)) && enemies.length > 0) {
    return { idx: jd, target: enemies[0].seat };
  }

  // 8. 火攻
  const hg = has('火攻');
  if (hg >= 0) {
    const target = enemies.find((t) => t.hand.length > 0);
    if (target) return { idx: hg, target: target.seat };
  }

  // 9. 万箭 / 南蛮（收益按敌人数判断）
  const otherAlive = alivePlayers(s).filter((t) => t.seat !== seat);
  for (const name of ['万箭齐发', '南蛮入侵']) {
    const idx = has(name);
    if (idx >= 0 && otherAlive.length >= 1) return { idx };
  }

  // 10. 无懈可击：优先拆自己判定区的延时锦囊，其次帮同阵营拆
  const wx = has('无懈可击');
  if (wx >= 0) {
    if (p.judgeZone.length > 0) return { idx: wx, target: seat };
    const ally = alivePlayers(s).find(
      (t) => t.seat !== seat && t.judgeZone.length > 0 && !isEnemyFor(s, seat, t.seat),
    );
    if (ally) return { idx: wx, target: ally.seat };
  }

  // 11. 铁索连环：重铸摸牌
  const ts = has('铁索连环');
  if (ts >= 0) return { idx: ts };

  return null;
}

export function aiTakeTurn(s: GameState, seat: number) {
  const p = s.players[seat];
  if (p.role !== 'ai' || s.winner || s.phase !== 'play') return;
  if (s.activeSeat !== seat) return;

  aiSkills(s, seat);
  if (s.winner) return;

  let guard = 24;
  while (guard-- > 0) {
    if (s.ask || s.winner || s.phase !== 'play') return;
    const move = chooseMove(s, seat);
    if (!move) break;
    const res = playCard(s, seat, move.idx, move.target, { asSha: move.asSha });
    if (!res.ok) break;
  }

  if (s.ask || s.winner) return;
  endTurn(s);
}
