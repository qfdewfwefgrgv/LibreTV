# 第六阶段 · 洛阳风云 —— 第一步审计报告

> 产出时间：2026-11-25
> 范围：`libretv-space` / `src/components/jianghu.tsx`、`src/components/jianghu/*`、`src/app/game/*`

## 一、现状盘点（实测数据）

| 项 | 现状 | 与任务书要求 |
|---|---|---|
| 剧情节点 | 主文件 65 + 第四章 11 + 第五章 11 = **87** | ✅ 与「87 节点」一致，不可推翻 |
| 章节 | 1 初入江湖 / 2 名动一方 / 3 风云际会 / 4 余烬 / 5 九州风雷 | ✅ |
| 过场影像 | `NODE_VIDEO` 9 节点挂 5 段 mp4 | ✅ |
| 任务系统 | `quests-ext.ts`：`QuestDef`（id/title/kind/scene/desc/minLevel/enemy/difficulty/reward/多步 step）、`QUEST_CHAINS` **17 条**、`advanceQuestStep`、`questStepHint` | ⚠️ 有骨架，缺「接取条件/失败处理/放弃」显式字段 |
| 存档 | `SaveData v:1 { playerName, avatarKey, originKey, hero, nodeId, cleared, lastIdle?, questProgress?, activeQuestId? }`；`normalizeHero` 兜底 | ⚠️ 缺 NPC 关系、探索记录、世界状态、声望 |
| 世界层 | `WorldScene`：Canvas 2D，洛阳 2000×1500，**5 NPC / 15 建筑**，WASD+拖拽摇杆、AABB 碰撞、贴片渲染 | ⚠️ 只有「走进来 + 点 NPC」 |
| 战斗 | `combat-ext.ts`：技能/连招/内息/敌人 AI/Boss 阶段；舞台为场景+双立绘+悬浮血条 | ✅ |
| 养成 | 装备（商店可买）、武学（门派独占 D10/C25/B45/A70/S100 贡献）、经脉、炼丹、生活技能、离线挂机 | ✅ |
| 门派 | 六派 + `SECT_HALLS` 堂口 + 退门转派保留贡献 | ✅ |
| 大厅 | 游戏盒门户、宣传片 Steam 式轮播、攻略/礼包/榜单 | ✅ |

### 生态类系统：全部为零

| 系统 | 状态 |
|---|---|
| 江湖声望 | ❌ 无（只有 `chivalry` 侠义值，不能替代势力声望） |
| NPC 关系/好感 | ❌ 无 |
| 昼夜 | ❌ 无 |
| 天气 | ❌ 无 |
| 探索发现记录 | ❌ 无 |
| 区域划分 | ❌ 地图只有一个平铺城市，无城门/主街/客栈/黑市等分区语义 |

## 二、可复用的现有能力（不重写，只接线）

| 能力 | 位置 | 复用方式 |
|---|---|---|
| `enter(nodeId, hero)` | jianghu.tsx | 世界层交互直接调它进剧情 |
| `choose(choice)` | jianghu.tsx | 剧情分支沿用 |
| `startBattle(combat)` | jianghu.tsx | 世界遭遇战复用同一战斗舞台 |
| `grantExp` / `pushLog` / `setHero` | jianghu.tsx | 任务奖励与日志 |
| `sectOf` / `joinSect` / `leaveSect` / `donateSect` | jianghu.tsx | 门派与声望挂钩 |
| `learnManual` / `learnInner` | jianghu.tsx | 武学获取保持不变 |
| `exploreHerbs` / `exploreTreasure` / `digTreasure` | jianghu.tsx | 探索发现系统可直接扩展这三条 |
| `QUEST_CHAINS` / `advanceQuestStep` / `questStepHint` | quests-ext.ts | 主支线共用同一数据结构 |
| `WorldScene` 贴片渲染与碰撞 | world.tsx | 保留，只加数据驱动层 |
| `SECT_HALLS` | jianghu.tsx | 门派堂口展示 |

## 三、缺口 → 实施映射（对应任务书八步）

| 步 | 任务书要求 | 本阶段落点 |
|---|---|---|
| 1 | 代码审查与架构检查 | ✅ 本文件 |
| 2 | 任务与世界交互打通 | 本轮实现：任务 HUD + NPC 任务标记（红 `!` 主线 / 蓝 `?` 支线 / 金脉冲=追踪中 + 距离米数） |
| 3 | 洛阳主线《洛阳疑云》12 节点 | 需新增 `story-luoyang.ts`，六幕结构，接现有 `enter/choose/startBattle` |
| 4 | NPC 数据驱动（id/势力/区域/好感/出现条件） | 扩展 `Npc` 类型 + `NPCS` 数据表，行为状态机（巡逻/驻留/交谈/休息） |
| 5 | 支线 10 条 + 随机事件 8 种 | 扩 `QUEST_CHAINS`；新增 `events.ts`（地点/条件/冷却/一次性完成） |
| 6 | 声望/关系/昼夜/天气/探索记录 | `hero.reputation`、`npcRelation`、`worldClock`、`weather`、`discoveries`，全部进存档 v2 |
| 7 | 视觉表现 | 昼夜光照叠色、天气粒子、交互提示、场景切换淡入淡出 |
| 8 | 存档兼容 + 回归 | `SaveData v:2` + 迁移函数，v1 读取时补默认值；回归 87 节点 + 四/五章 |

## 四、本轮已完成（第一步 + 第二步首刀）

**修改文件清单**

| 文件 | 改动 |
|---|---|
| `src/components/jianghu/world.tsx` | 新增 `WorldHud` 类型；`WorldScene` 增加 `hud` / `npcQuests` 入参；`questsRef` 把任务态送进绘制循环；NPC 标记改为任务态驱动（追踪中金色脉冲圈 + 距离米数，未完成红/蓝，已完成淡灰）；左上角常驻任务 HUD（当前目标 + 主线/支线计数 + 声望） |
| `src/components/jianghu.tsx` | 渲染派生 `worldNpcQuests`（任务 → 城中 NPC 映射）与 `worldHud`（主线/支线完成度、当前追踪目标、声望）；传给 `WorldScene` |

**已完成内容**

1. 任务进度第一次真正进入世界层：`questProgress` / `activeQuestId` → 城中 NPC 头顶标记 + HUD。
2. 追踪中的任务目标会显示脉冲金圈与距离（按 10px=1m 折算）。
3. HUD 显示「主线 x/y、支线 x/y、声望」，为后续声望系统留好位置。

**未完成内容**

- 任务接取/放弃/失败三态 UI（现在只有进度展示）
- 目标指引虚线（下一步）
- 《洛阳疑云》主线 12 节点
- NPC 数据表扩展与行为状态机
- 支线 10 条、随机事件 8 种
- 声望/关系/昼夜/天气/探索记录与存档 v2
- 区域划分（城门/主街/客栈/铁匠铺/药铺/武馆/黑市/官府/山林）与各区域的独立玩法

**测试结果**

```
npx tsc --noEmit            0 error
npm run build               ✓ Compiled successfully in 4.6s
npx vitest run              36 files / 445 tests passed
```

**已发现的问题**

1. 任务 ↔ NPC 目前是**按下标取模**映射（`QUEST_CHAINS[i] → n1..n5`），一个 NPC 只挂一条任务。要做任务书要求的「NPC 关联任务」，必须在 `Npc` 上加 `questId` 字段并显式配置，不能继续用取模。
2. 现有 17 条 `QUEST_CHAINS` 缺少「接取条件 / 失败条件 / 可否放弃」，任务书要求的「失败或放弃处理」需要给 `QuestDef` 扩字段。
3. 声望暂用 `hero.chivalry` 顶替，只用于 HUD 展示，**尚未影响任何 NPC 行为**——任务书明确不允许「只加数值显示」，下一轮必须接进对话分支。
4. 世界层没有区域概念，所有 NPC 平铺在一张图上，「城门盘查」「地下黑市」这类分区玩法需要先加区域数据与分区进入逻辑。
5. 昼夜/天气会影响贴片渲染，需要考虑在 Canvas 上加光照叠层，不能直接改贴片颜色（会破坏现有美术）。


---

# 附录：第二步落尾（区域划分 + NPC 显式任务关联）

## 修改文件清单

| 文件 | 改动 |
|---|---|
| `src/components/jianghu/world.tsx` | 新增 `Region` 类型与洛阳 **10 个区域**（城门/客栈/百草堂/铁匠铺/官府/武馆/城南集市/地下黑市/主街/城外山林）；`Npc` 增加 `region` 字段；新增 `regionAt()` 按「最小矩形优先」判定所在区域；`step()` 内实时更新区域并在顶栏显示；导出 `WORLD_NPC_QUESTS` 显式 NPC→任务映射 |
| `src/components/jianghu.tsx` | 改为读取 `WORLD_NPC_QUESTS` 构建 `worldNpcQuests`，**废弃下标取模** |

## 已完成

1. 洛阳从「一张平铺地图」变为 **10 个语义区域**，玩家走到哪，顶栏就显示 `洛阳城 · 悦来客栈` 这样的当前区域。
2. NPC 与任务的关联改为**显式配置**：顾长风→q-ember-scout、苏挽→q-ember-letter、独眼掌柜→q-temple-elder、灯市老翁→q-fuzhou-chain、青城弟子→q-valley-herb。
3. 区域数据可直接被后续主线复用：每幕主线只需绑定 `region` 字段即可定位。

## 测试证据

```
npx tsc --noEmit      0 error
npm run build         ✓ Compiled successfully in 3.8s
npx vitest run        36 files / 445 tests passed
```

## 遗留

- 区域目前只做「识别 + 显示」，尚未绑定**独立玩法**（任务书要求「每个场景必须有独立玩法，不能只是换背景图」）。这是第三~五步的主要工作量。
- `Region` 还没有 `desc`/`enemies`/`interactables` 字段，需要在做「城门盘查」「黑市交易」这些时补。


---

# 附录二：五条剧情联动任务链（第七阶段首刀）

## 修改文件清单

| 文件 | 改动 |
|---|---|
| `src/components/jianghu/quests-story.ts`（新增） | 5 条链式任务，每条的每一步都绑定**现有生活技能动作** |
| `src/components/jianghu.tsx` | 导入 `STORY_QUESTS`；新增 `ALL_CHAINS = [...QUEST_CHAINS, ...STORY_QUESTS]`；8 处运行时引用改指向 `ALL_CHAINS` |

## 五条链与系统联动

| 任务链 | 步骤（全部复用现有动作） | 关联系统 |
|---|---|---|
| 救命的七叶草 | 采药 → 炼丹 → 交付 | 采药 / 炼丹 |
| 铁匠的遗愿 | 采矿 → 锻造 → 交付 | 采矿 / 锻造 |
| 失传的内功 | 探索 → 战斗 → 交付 | 探索 / 战斗 |
| 药王谷秘闻 | 探索 → 炼丹 → 对话 | 采药 / 炼丹 / NPC |
| 寒铁矿脉 | 探索 → 战斗 → 锻造 | 探索 / 战斗 / 锻造 |

动作映射：`explore` 接 `exploreHerbs/digTreasure`，`craft` 接 `craftMed/forgeWeapon`，`fight` 接 `startBattle`，`deliver`/`talk` 接交还与对话。

## 测试证据

```
npx tsc --noEmit      0 error
npm run build         ✓ Compiled successfully in 3.7s
npx vitest run        36 files / 445 tests passed
剧情链数量            5 条
ALL_CHAINS 引用        8 处
```

## 未完成 / 风险

1. 任务链目前是**独立接取**，还没有挂在四章/第五章的具体剧情节点上（需要给节点加「触发任务」字段，而不是另开入口）。
2. 奖励里的「丹方 / 图纸 / 内功残页」目前是普通道具名，**还没有解锁真实内容**，需要在丹方表与锻造图纸表里补实体。
3. 步骤完成依赖玩家先「接取」，未接取时做动作不会推进；体验上需要在相关区域给出提示，否则容易漏接。


---

# 附录三：藏宝图与江湖秘藏系统（首版）

## 修改文件清单

| 文件 | 改动 |
|---|---|
| `src/components/jianghu/treasure.ts`（新增） | 数据层与纯函数：`TreasureState`、6 级藏宝图、章节碎片表、领取/合成/开启/图鉴/存档兜底 |
| `src/components/jianghu/treasure.test.ts`（新增） | 9 个单元测试：首发唯一、五章合计 100、合成消耗、等级/技能门槛、开启消耗、旧存档兜底、图鉴换算 |
| `src/components/jianghu.tsx` | `SaveData.treasure`；`treasure` 状态；存档写入/读档恢复/重开清空；`claimTreasureChapter`/`craftTreasureMaps`/`openTreasureMap`；「宝藏」面板与侧栏入口 |

## 计量与章节分配（按实际 5 章调整）

`1 张完整藏宝图 = 100 微单位`

| 章节 | 首发碎片 |
|---|---:|
| 第一章 | 50 |
| 第二章 | 20 |
| 第三章 | 10 |
| 第四章 | 10 |
| 第五章 | 10 |

合计 100 → 正好拼出第一张图；后续碎片来自宝箱、奇遇与重复兑换（待接）。

## 六档藏宝图

| 档 | 名称 | 门槛 | 奖励要点 |
|---|---|---|---|
| 1 | 江湖残图 | 1 级 | 草药、金创药、银两 |
| 2 | 山河秘图 | 3 级 + 采矿 Lv.2 | 矿石 ×3 |
| 3 | 古墓藏宝图 | 6 级 + 采药 Lv.3 | 真武剑、金创药 |
| 4 | 门派秘藏图 | 10 级 + 炼丹 Lv.4 | 虎骨膏、草药 |
| 5 | 天机残卷 | 15 级 | 矿石、藏宝图碎片 |
| 6 | 天下秘藏图 | 20 级 | 镇远剑、真武剑 |

## 已实现的防漏洞机制

1. 章节首发**每章一次**（`claimedChapters`）。
2. 开图后**消耗该图**并写入 `opened`，不重复发奖。
3. 等级 / 生活技能门槛不满足时**不消耗图**。
4. 旧存档自动补默认值（`normalizeTreasure`），负数与非法等级会被清洗。

## 测试证据

```
npx tsc --noEmit      0 error
npm run build         ✓ Compiled successfully in 4.4s
npx vitest run        37 files / 454 tests passed
  ✓ src/components/jianghu/treasure.test.ts (9 tests)
```

## 未完成（下一轮）

1. **寻宝还不是「按图索骥」**：现在是面板点击直接结算，没有「查看线索 → 走到对应区域 → 触发隐藏交互」的过程。要接世界层区域（`Region`）与交互点。
2. 假图 / 被抢先挖走 / 他人争夺 / Boss 守护 / 夜间秘藏 这五类特殊事件尚未实现。
3. 碎片来源只接了章节首发，支线、Boss、奇遇、探索掉落还没接。
4. 图鉴尚无独立全屏界面（现嵌在宝藏面板内），也未做成就体系。
