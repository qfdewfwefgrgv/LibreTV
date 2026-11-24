# 江湖同伴系统 · 项目扫描报告与 MVP 计划

> 依据：`武侠RPG项目_跨AI协作交接文档.docx`
> 本文回答该文档「十、尚待项目扫描后确定的事项」的全部疑问，并给出最小可玩版本的实施计划。
> **扫描方式：直接读代码，不是推测。**

## 一、项目扫描结果（回答 10 个待定问题）

### 1. 是 Unity 还是网页？

**纯网页（Next.js），与 Unity 无关。**

| 项 | 实测 |
|---|---|
| 框架 | Next.js `^15.1.0`（App Router）+ React `^19.0.0` + TypeScript + Tailwind |
| 部署 | Docker `node:22-alpine`，`next build` 产物，nginx 反代到 `:8080` |
| 核心文件 | `src/components/jianghu.tsx` **4888 行** |
| 拆分模块 | `jianghu/world.tsx`（Canvas 世界）、`quests-ext.ts`、`quests-story.ts`、`treasure.ts`、`prison.ts`、`story-ch4.ts`、`story-ch5.ts`、`combat-ext.ts` |

### 2. 战斗是什么形式？

**回合制**，已在代码中确认：

- `battle.round` 回合计数、`combo` 连招、`breath` 内息
- 技能有冷却（`skillCd`）、敌人有 AI 与 Boss 阶段（`BOSS_NAMES`）
- 结算入口 `settleBattle()`，胜负分支 `battle.over: 'win' | 'lose'`

所以「一回合两次技能」「持续两回合」可以直接按 `round` 定义，不需要另建循环。

### 3. 敌人有没有性别 / 类型标签？

**没有。** 当前 `EnemyDef` 只有：

```ts
type EnemyDef = { name; school; qi; wit; power; hpBase; hpPerDiff; intro };
```

结论：柳红绡「对男性敌人 200%」这类机制，**必须先给 `EnemyDef` 加 `tags: ('male'|'female'|'beast'|'mech'|'human')[]`**，否则无从判定。这是同伴系统的前置改动。

### 4. 有没有同伴 / 队伍架构？

**完全没有。** 代码里搜不到 `companion` / `party` / `队伍`。当前是**单人主角**（`avatarKey` + `avatarKey` 立绘），战斗结算、存档、UI 全部按单人设计。

结论：同伴不是「加个数据表」就行，需要新增：`party` 阵容、战斗内同伴位、结算分摊、存档字段、同行录 UI。

### 5. 存档结构是什么？

```ts
type SaveData = {
  v: 1; playerName; avatarKey; originKey; hero; nodeId; cleared: string[];
  lastIdle?: number;              // 离线挂机结算
  questProgress?: QuestProgress;  // 多步任务
  activeQuestId?: string | null;
  treasure?: TreasureState;       // 藏宝图
  prison?: PrisonState;           // 天牢
};
```

已有 `normalizeHero` 与各模块 `normalizeXxx` 兜底，**新增 `companions` 可以沿用同一套模式**，旧存档不会崩。

### 6. 真实章节数？

**5 章**：`第一章 初入江湖`、`第二章 名动一方`、`第三章 风云际会`、`第四章 余烬`、`第五章 九州风雷`，合计 **87 个节点**（主文件 65 + 第四章 11 + 第五章 11）。

所以藏宝图按 7 章分配的示例**不适用**，我已按 5 章改为 `50 / 20 / 10 / 10 / 10 = 100`（见 `docs/stage6-audit.md` 附录三）。

### 7. 天牢每日刷新用本地还是服务器时间？

**本地时间 + 回拨检测**，已在 `prison.ts` 实现并有 10 项单元测试覆盖：

- `todayKey()` 生成日键
- `refreshDaily()` 仅日键变化时清空挑战资格
- `clockRolledBack()`：系统时间早于记录 5 分钟以上 → 不刷新
- 碎片永久保留，不受刷新影响

单机版够用；将来接服务器只需把 `todayKey` 换成服务端时间源。

### 8. 移动端与性能

世界层用 Canvas 2D + AABB 碰撞，**没有寻路系统**。同伴跟随要么做「跟随队列（记录主角历史轨迹）」，要么做「简单吸附」，**不要引入 A\***，否则移动端帧率风险高。

摇杆已实现但**未真机实测**。

### 9. 随机是否可复现？

**不可复现**：代码里直接 `Math.random()`。交接文档要求「概率技能要测试 0%、100% 和中间概率」，因此需要：

- 抽出 `rng()` 注入点（默认 `Math.random`，测试传入固定序列）
- 战斗日志记录触发原因

这是同伴概率类技能（追加释放、自动服药）的前置改动。

### 10. 技能是否支持条件倍率？

**不支持。** 现有技能只有固定 `atk` 倍率与冷却，没有「按目标标签改变倍率」的机制。

## 二、可复用模块清单（不重写，只扩展）

| 能力 | 位置 | 同伴系统怎么用 |
|---|---|---|
| `startBattle(combat)` / `settleBattle()` | jianghu.tsx | 同伴参战复用同一战斗循环 |
| `Combat { enemy, difficulty, win, lose, quest?, prison? }` | jianghu.tsx | 加 `companion?` 标记用于同伴专属战 |
| `applyEffects` / `grantExp` / `pushLog` | jianghu.tsx | 同伴奖励与日志 |
| `normalizeHero` 模式 | jianghu.tsx | 照抄成 `normalizeCompanions` |
| `PORTRAITS` 立绘表 | jianghu.tsx | 同伴立绘直接加条目 |
| `StageArt` 双立绘舞台 | jianghu.tsx | 右侧可扩展为「敌人 + 同伴」 |
| `WorldScene` 跟随点 | world.tsx | 同伴跟随用轨迹队列 |
| `QuestDef` 多步任务 | quests-ext.ts | 招募任务直接用链式任务 |
| `TREASURE_TIERS` / `PRISONERS` 的写法 | treasure.ts / prison.ts | 同伴数据表照此结构 |

## 三、风险清单

| 风险 | 说明 | 对策 |
|---|---|---|
| **战斗结算改造面大** | `settleBattle` 只处理单人，加入同伴要改伤害分摊、治疗、死亡判定 | 第一版同伴**只做被动 + 每回合触发**，不做独立行动条 |
| **存档字段膨胀** | 已有 treasure / prison，再加 companions | 统一 normalize + 迁移函数，缺字段走默认值 |
| **性别/标签缺失** | 条件倍率无从判定 | 先给 `EnemyDef` 加 `tags`，再谈柳红绡 |
| **随机不可测** | 概率技能无法验证 0%/100% | 先抽 `rng` 注入点 |
| **移动端性能** | 无寻路、Canvas 重绘 | 跟随用轨迹队列，禁止 A* |
| **数值平衡** | 同伴会显著提高战力 | 同伴属性按主角等级百分比挂载，不做固定值 |

## 四、MVP 方案（阶段 B：最小可玩版本）

**目标**：主角通过一个任务招募一名同伴，该同伴可上阵、在战斗中触发独特效果、并正确保存/读取。

**选谁**：沈青衣（护卫型）——她的「替主角承伤」是**被动触发**，不需要行动条，改造面最小，最适合验证架构。

### 实施切片（每步可独立验收）

| 步 | 内容 | 改动文件 |
|---|---|---|
| B1 | 同伴数据模块：`CompanionDef`、`CompanionsState`、`normalizeCompanions` | 新增 `src/components/jianghu/companions.ts` |
| B2 | 存档接入：`SaveData.companions` + 读档兜底 + 重开清空 | `jianghu.tsx` |
| B3 | 招募任务：新增链式任务「山道救孤」，完成即入队 | `quests-story.ts` |
| B4 | 战斗接入（被动）：主角受到致命伤害时，沈青衣代受 30% 并有日志 | `jianghu.tsx` `settleBattle` / 伤害计算处 |
| B5 | 立绘与 UI：同行录面板，显示同伴、好感、被动、招募状态 | `jianghu.tsx` + `PORTRAITS` |
| B6 | 测试：招募→上阵→代受→存档往返→旧档缺字段 | 新增 `companions.test.ts` |

### 明确的非目标（本版不做）

- 不做 3 人编队、不做同伴独立行动条、不做 AI 指令
- 不做好感度事件链、不做羁绊组合
- 不做地图跟随（放到阶段 F）
- 不做柳红绡/百里神机/萧烈这类特殊机制角色（放到阶段 E）

### 验收标准

1. 完成「山道救孤」后，同行录出现沈青衣
2. 战斗日志能出现「沈青衣以身挡刃，代你受了 X 点」
3. 退出重进后同伴仍在，好感/状态不丢
4. 旧存档（无 companions 字段）读取不报错，正常进游戏
5. `tsc` 0 error、`next build` 通过、新增测试全绿、原有 464 项测试不回归

## 五、需要你确认的三件事

1. **是否按上面的 MVP 开工**（只做沈青衣一人、只做被动代受）？
2. **是否同意先给 `EnemyDef` 加 `tags` 并把 `Math.random` 抽成可注入 `rng`**？这两项是柳红绡/概率技能的前置，但不做也不影响 MVP 验收。
3. **同伴立绘**：是复用现有立绘，还是让 Muse/Ark 新出一张沈青衣？（Ark 账户当前欠费，Muse 队列拥堵，出图可能延迟）

确认后我按 B1→B6 顺序推进，每步给修改文件清单与测试证据。
