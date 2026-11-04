# Infinite Canvas LibTV 画布、插件与 Agent 前端改造计划

**目标:** 参考 LibTV 的信息层级、空间组织、低视觉重量和工作流表达，让 Infinite Canvas 的画布、插件和 Agent 入口更接近“一个持续工作的创作工作台”，而不是若干彼此分离的工具页。

**边界:** 只复现设计原则，不复制 LibTV 的源码、文案、图标、图片、字体、插画、动画或品牌资产；不把当前节点模型迁移到另一套白板框架；不为尚未冻结的服务端能力提前做 UI。

**当前状态:** 全站顶栏的“创作 / 插件”入口已完成最小修复并通过本地浏览器验证。`libtvShell` 侧栏实验模式、`pluginHub` 插件中心、`agentSkillHub` Agent/Skills 资源页、`canvasFloatingChrome` 画布浮动控制带、`agentPanelChrome` Agent 工作台、P2-C Claude Agent SDK 侧边栏入口和 P2-D 本机会话历史与续聊已合并到 `dev`。P2-E Claude 原生模型列表已实现，等待人工验收。所有实验能力仍默认关闭，尚未修改生产环境。

## 1. 逆向范围与证据

本轮使用 REA 观察公开页面资源边界，并使用 ego-browser 在独立 TaskSpace 中复核实际布局和交互。

| 页面                | 观察重点                                                                  | 可落地结论                                                               |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 全站导航            | 240px 左侧栏、紧凑一级导航、创作分组、插件横排兼容入口                    | 用窄侧栏替代高视觉重量的横向顶栏，把“创作”作为分组而不是单按钮           |
| LibTV 画布          | 48px 浮动顶部控制带、底部工具 dock、空画布快捷节点、右侧可调 Agent 抽屉   | 画布应保持无边框沉浸感，主操作沿画布边缘分组，Agent 与画布并存           |
| LibTV Plugin        | Agent 兼容选择、Plugin/CLI 两种接入方式、两步式安装、可复制命令、连接状态 | 插件页应回答“支持谁、怎么装、是否已安装、安装后能做什么”，而不是只列插件 |
| LibTV Agent / Skill | 大输入框、Skill/收藏/我的、分类、搜索、三列媒体卡                         | Agent 需要一个独立资源首页，侧边抽屉继续承担执行和上下文操作             |

公开页面中的关键尺寸只作为密度参考，不作为硬编码规范：

- 侧栏约 240px，一级导航行约 32px 高、6px 圆角。
- 画布顶部浮动控制带约 48px；底部工具按钮约 32px。
- 右侧 Agent 抽屉默认约 400px，可拖拽调整。
- Skill 卡片约 185px 缩略图 + 标题/说明，桌面三列。
- 深色基准大致为页面 `#141414`、画布 `#1a1a1a`、面板 `#1f1f1f`；本地实现必须转换为现有主题 token，不能硬编码 LibTV 色值。

REA 证据 ID：`ev_bd04aaa5e1e48e6786afb8279d62381b12dda5cd3ec65027d70ac110cec1f364`。

逆向限制：

- 公开页面只能证明当前可见界面，不代表登录后全部能力永久稳定。
- ego lite 未暴露可直接 attach 的 loopback CDP target，因此 ego 负责实际操作和视觉复核，REA 使用临时浏览器 capture 观察公开资源。
- 不根据 UI 推断未公开的接口、权限或计费逻辑，也不复制其内部协议。

## 2. 当前差距

| 领域       | 当前实现                                                    | 目标差异                                                         | 优先级 |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| 全站导航   | 横向 64px 顶栏；创作是下拉；插件打开 Modal                  | 240px 窄侧栏；一级入口和创作分组稳定可见；插件有独立页面         | P1     |
| 插件       | 一个 640px 管理 Modal，以官方/本地/第三方分页               | 独立插件 Hub，突出兼容 Agent、接入方式、安装状态、权限和能力说明 | P1     |
| Agent      | 全站右侧 400px 抽屉；已有对话、历史、技能、日志             | 增加独立 Skill 资源首页；侧栏强化空态引导、运行队列和工具状态    | P1/P2  |
| 画布       | 已有工作流/故事板、顶部 48px 色带、底部工具条、缩放和小地图 | 改成更轻的浮动控制带；底部工具按层级分组；空画布增加五种快捷节点 | P2     |
| 账户与增长 | 有本地账户状态、配置和版本入口                              | 不复制 LibTV 的会员、积分、活动横幅和促销视觉                    | 不实施 |
| 云端资源   | 当前画布和素材主要保存在浏览器本地                          | 分享、云项目、服务端 Skill 市场和计费必须先冻结服务端契约        | P3     |

## 3. 目标信息架构

桌面端建议采用沉浸式工作台外壳：

```text
┌──────────────── 240px 侧栏 ────────────────┬──────────────────────────────┐
│ Brand                                      │ 页面或画布工作区             │
│ 首页 / 项目 / 资产 / 插件                  │                              │
│                                            │                              │
│ 创作                                       │                              │
│   无限画布                                 │                              │
│   创作 Agent                               │                              │
│   3D 导演台（director3d）                  │                              │
│                                            │                              │
│ 工具                                       │                              │
│   生图 / 视频 / 提示词 / 工作流            │                              │
│                                            │                              │
│ 账户、文档、主题和版本                     │                              │
└────────────────────────────────────────────┴──────────────────────────────┘
```

画布项目页继续使用沉浸式路由 shell，不显示普通内容页侧栏。画布自己的顶部控制带承担返回、项目名、工作流/故事板切换和分享占位，避免双重导航。

建议路由：

| 路由          | 页面                | 说明                                         |
| ------------- | ------------------- | -------------------------------------------- |
| `/plugins`    | 插件 Hub            | 官方、第三方、本地插件；Agent 兼容和接入说明 |
| `/agent`      | Agent / Skills 首页 | Skill 搜索、收藏、分类、使用入口和连接状态   |
| `/canvas`     | 画布列表            | 保持现有路由                                 |
| `/canvas/:id` | 画布工作台          | 保持现有路由，隐藏普通全站导航               |

`/plugins`、`/agent` 和侧栏外壳分别受 `pluginHub`、`agentSkillHub`、`libtvShell` 控制，默认关闭，便于独立验收和回滚。

## 4. 分阶段修改计划

### P0：导航缺口修复与基线保护

状态：已完成本轮最小实现，等待人工验收。

已完成：

- 全站桌面顶栏增加“创作”分组，包含“我的画布 / 创作 Agent”。
- 全站增加一级“插件”，复用 `CanvasPluginManagerModal`。
- 移动导航按“创作 / 工具”分组，并支持直接打开 Agent 和插件管理。
- 中英文文案、`CHANGELOG.md` 和 `pending-test` 已同步。

涉及文件：

- `web/src/components/layout/app-top-nav.tsx`
- `web/src/components/layout/mobile-nav-drawer.tsx`
- `web/src/i18n/locales/zh-CN.ts`
- `web/src/i18n/locales/en-US.ts`
- `CHANGELOG.md`
- `docs/content/docs/progress/pending-test.mdx`
- `docs/content/docs/progress/pending-test.zh-CN.mdx`

验收：

- 从任意非画布项目页都能打开插件管理。
- “创作 > 创作 Agent”关闭移动导航后只打开一次 Agent 面板。
- 中文、英文、桌面和 390px 移动布局无横向溢出。
- 画布项目页仍通过画布内部入口打开插件、导演台和 Agent，不出现双层导航。

### P1-A：全站窄侧栏与创作分组

状态：已合并 `dev`，等待人工验收。

目标：

- 把横向导航降为左侧 240px 窄栏，同时保留浅色/深色主题。
- 把“画布、Agent、3D 导演台、工作流”统一表达为创作能力。
- 内容页与画布项目页使用两套明确 shell，不复制导航状态。

建议文件：

- 新增 `web/src/components/layout/app-sidebar.tsx`
- 新增 `web/src/components/layout/navigation-groups.ts`
- 修改 `web/src/layouts/user-layout.tsx`
- 修改 `web/src/components/layout/app-top-nav.tsx`
- 修改 `web/src/components/layout/mobile-nav-drawer.tsx`
- 修改 `web/src/constant/navigation-tools.ts`
- 修改 `web/src/constant/feature-flags.ts`
- 修改中英文 locale

实施步骤：

1. 抽取统一导航数据：一级页面、创作分组、工具分组、底部服务和移动端可见性。
2. `libtvShell=1` 时，桌面使用窄侧栏；关闭时保持当前顶栏。
3. 侧栏一级只保留 Logo、首页、项目入口、资产、插件，避免把当前所有工具都做成高权重一级项。
4. “创作”分组显示无限画布、创作 Agent、3D 导演台；3D 继续受 `director3d` 控制。
5. “工具”分组容纳生图、视频、提示词和创意工作流，继续受现有功能开关控制。
6. Agent 使用右侧抽屉，不在页面内再嵌一个重复对话面板。
7. 移动端继续使用 Drawer，分组顺序与桌面一致，不增加 hover-only 操作。
8. 侧栏和画布主题统一从 `canvasThemes` / Ant Design token 派生，不新增独立色板。

验收：

- 1440px、1024px、768px、390px 四档无横向溢出。
- 侧栏折叠后所有入口仍可通过键盘到达。
- 当前路由、功能开关和 Agent 开合状态不会被导航切换重置。
- 关闭 `libtvShell` 后，现有顶栏行为完全不变。

### P1-B：独立插件 Hub

状态：已合并 `dev`，等待人工验收。

目标：

- 把插件从“安装管理弹窗”升级为“能力入口 + 可信安装中心”。
- 保留现有 Registry 完整性校验和警告，不允许页面改版绕过安全边界。

页面结构：

1. Hero：项目自己的插件价值说明，不使用 LibTV 文案和品牌图。
2. Agent 兼容条：Codex、Claude、Claude Code 以及未来明确支持的本地 Agent。
3. 接入方式切换：Plugin / CLI；同一能力只描述本项目真实支持的路径。
4. 两步安装区：复制安装任务、验证本地 Agent 连接状态。
5. 已安装状态：版本、更新、启用、卸载、权限和兼容版本。
6. 插件目录：官方、第三方、本地三个筛选，不失去当前 Modal 的完整功能。
7. 能力展示：图像、视频、画布、素材、导演台等真实已支持能力。

建议文件：

- 新增 `web/src/pages/plugins/index.tsx`
- 新增 `web/src/pages/plugins/components/plugin-hero.tsx`
- 新增 `web/src/pages/plugins/components/plugin-agent-compatibility.tsx`
- 新增 `web/src/pages/plugins/components/plugin-install-guide.tsx`
- 新增 `web/src/pages/plugins/components/plugin-catalog.tsx`
- 新增 `web/src/hooks/use-plugin-catalog.ts`
- 将 `web/src/components/canvas/canvas-plugin-manager-modal.tsx` 的业务动作与展示拆成可复用组件
- 修改 `web/src/router.tsx`
- 修改 `web/src/constant/feature-flags.ts`
- 修改中英文 locale

实施步骤：

1. 先抽取插件 catalog/install/action hook，Modal 和页面共用同一数据源。
2. 保持 `fetchOfficialPlugins`、SHA-256、大小、`minAppVersion` 和版本拒绝逻辑不变。
3. 页面路由注册在 `/plugins`，`pluginHub=0` 时回退到当前 Modal 入口。
4. 安装命令按当前执行环境生成，并显式区分 Plugin 与 CLI，不伪造尚未实现的安装方式。
5. 连接状态只读取真实 Agent 状态；未连接时展示可操作步骤，不显示虚假的“已授权”。
6. 所有复制按钮统一使用现有复制反馈 hook 或同等全局交互。

验收：

- 官方 5 个插件、本地插件和第三方 URL 安装全部保持可用。
- 坏清单、重复 ID、不安全入口、缺失哈希、错误大小、SHA-256 不匹配或低版本应用仍整体失败关闭。
- 未连接 Agent 时不执行插件代码，不出现虚假授权状态。
- 页面和 Modal 的安装状态一致，刷新后仍从同一 store 恢复。
- 中文、英文、浅色、深色和 390px 布局可用。

### P1-C：Agent / Skills 资源首页

状态：已合并 `dev`，等待人工验收。

目标：

- 让 Agent 从“只有连上后才可用的侧栏”变成可发现的能力中心。
- 复用现有本地 Skill 管理、搜索、启用和安全边界，不建立第二套 Skill 数据。

页面结构：

1. 顶部大输入框：输入目标或搜索 Skill，不自动调用收费模型。
2. 一级切换：Skill / 收藏 / 我的。
3. 分类：优先使用 Skill 可选元数据；没有分类时按现有 scope、能力和用户自定义集合降级。
4. 搜索与卡片：标题、短说明、来源、启用状态、连接状态和“使用”入口。
5. 未连接状态：显示启动本地 Agent、安装插件、复制连接命令的真实步骤。
6. 选择 Skill 后：打开右侧 Agent 抽屉，写入 `$skill-name`，不直接发送。

建议文件：

- 新增 `web/src/pages/agent/index.tsx`
- 新增 `web/src/lib/agent/agent-skill-catalog.ts`
- 新增 `web/src/stores/use-agent-skill-favorite-store.ts`
- 新增 `web/src/hooks/use-agent-skill-favorites.ts`
- 复用 `web/src/components/agent/agent-skills-view.tsx`
- 复用 `web/src/stores/use-agent-skill-store.ts`
- 修改 `web/src/router.tsx`
- 修改 `web/src/constant/feature-flags.ts`
- 修改中英文 locale

实施步骤：

1. 第一版只使用 `AgentSkillSummary` 已有字段，不伪造分类、图标或安装量。
2. 收藏保存在浏览器本地，使用 Skill 的 `scope + path` 稳定识别，避免同名 Skill 冲突。
3. 分类先支持“全部、项目、个人、系统、管理员”和已启用状态；新增业务分类必须等 Agent 协议提供可选 `category/tags`。
4. `agentSkillHub=0` 时保持现有侧栏“技能”页签，不创建重复入口。
5. 未连接时只显示连接引导，不缓存或展示上次连接的其他工作区 Skill。
6. 点击“使用”统一调用现有 `selectSkill`，避免页面和侧栏各自维护选择态。

验收：

- 连接后能读取当前工作空间的 Skill，搜索、scope 筛选、启用状态和错误详情保持现有行为。
- 页面选择 Skill 后侧栏打开并显示同一选择，刷新后选择语义不回退。
- 断开、切换 Agent 或多标签页同步时，旧请求不能回写新列表。
- 收藏只存在浏览器本地，不进入 Skill 文件、导出或远端。
- 中文、英文、浅色、深色和 390px 布局可用。

### P2-A：画布浮动控制带与工具分组

状态：已实现并合并 `dev`（PR #26），等待人工验收。

目标：

- 在保留现有画布节点、工作流/故事板、小地图和保存能力的前提下，减少顶部与底部的整块色带感。
- 把高频操作、低频操作和系统操作分成三层，不继续平铺按钮。

布局目标：

- 顶部左：返回、工作区/项目名、画布名、工作流/故事板切换。
- 顶部右：保存状态、分享占位、Agent、账户和低频菜单。
- 底部中央：添加节点、选择/移动、素材库、全部功能、生成历史、快捷键。
- 左下：资产管理、整理画布、小地图、连线显隐、网格吸附、缩放。
- 空画布：图片、视频、音频、剧本、智能剪辑五个快捷入口，点击创建对应节点或打开已有生成器。

建议文件：

- 修改 `web/src/pages/canvas/project.tsx`
- 修改 `web/src/components/canvas/canvas-top-bar.tsx`
- 新增 `web/src/components/canvas/canvas-command-dock.tsx`
- 新增 `web/src/components/canvas/canvas-empty-quick-actions.tsx`
- 新增 `web/src/lib/canvas/canvas-chrome.ts`
- 修改 `web/src/constant/feature-flags.ts`
- 修改中英文 locale

实施步骤：

1. 保持 48px 顶栏和现有工具条测量锚点，通过 `canvasFloatingChrome` 独立切换，关闭时完整保留原行为。
2. 顶部按画布信息、工作流/故事板、保存/Agent/系统操作三组重排，并保持双击标题重命名和跨标签冲突提示。
3. 底部 dock 按“添加、选择/定位、素材、历史、外观、更多”分组，复用现有素材选择器、撤销/重做和快捷键。
4. 空态快捷节点只在已加载、无节点的 workflow 视图出现；点击只创建一个节点或打开已有生成器面板，不自动请求模型。
5. “智能剪辑”没有成熟本地能力前保持不可点击的占位状态。
6. 故事板、小地图、缩放、连线显隐和锁定状态全部回归，工作流 dock 与空态入口不得出现在故事板。

验收：

- 桌面 1440px 和 390px 均无横向溢出，控制带不遮挡节点、连线或上下文菜单。
- 画布空态在深色和浅色主题下清晰，不因快捷节点遮挡双击创建。
- 所有 dock 操作可通过键盘访问，焦点样式可见。
- 控制带和工具条不改变节点数据、连线数据、视口和保存时序。
- 100+ 节点项目下，工具条重排不引入额外长任务或明显重渲染。

### P2-B：Agent 空态、运行状态和侧栏细化

状态：已实现，开关 `agentPanelChrome` 默认关闭，等待人工验收。

目标：

- 让右侧 Agent 从“聊天表单”变成能解释自己能做什么的创作搭档。
- 保留现有 Codex/Claude 切换、附件、Skill、模型、权限、工具确认队列和中止能力。

空态结构：

1. 项目自有的简短标题和说明。
2. 四条基于当前画布状态的建议：选择 Skill、从预设开始、上传故事、批量分镜。
3. 快捷场景 chips：剧本原创、剧本改编、导演执导；没有后端能力时点击只填 prompt。
4. 输入框底部：附件、模型、Skill、工具确认、发送。
5. 运行中：工具队列、当前工具、等待确认数量、Stop 和 Usage 保持可见。

建议文件：

- 修改 `web/src/components/agent/local-agent-panel.tsx`
- 修改 `web/src/components/agent/agent-chat.tsx`
- 修改 `web/src/components/agent/agent-chat-composer.tsx`
- 修改 `web/src/components/agent/agent-chat-prompt-input.tsx`
- 修改 `web/src/components/agent/agent-panel.tsx`
- 修改 `web/src/stores/use-agent-store.ts`
- 修改中英文 locale

实施步骤：

1. 默认宽度保持约 400px，可拖拽范围建议 320–640px；390px 页面上面板全宽。
2. 空态建议只填入输入框，不自动发送；禁止默认调用收费模型。
3. 建议内容根据空画布、已有节点、选中节点、已有故事板和连接状态变化。
4. 不新增第二套工具状态；画布工具确认取现有单槽 `pendingTool`，权限审批取 `pendingApprovals`，两者分别计数展示，不伪造工具队列。
5. Codex/Claude 模式仍按现有规则隐藏或显示模型、权限、历史和 Skill 入口。
6. 所有按钮补充中英文 aria label、键盘焦点和 reduced-motion 行为。

本轮范围修订：

- 不修改侧栏 360–760px 的现有拖拽边界，避免未经确认变更交互边界值。
- 不开放 Codex/Claude 前端切换；该能力需要连接协议、登录检测、Usage 和终态事件配套，继续留在后续任务。
- 不实现故事文件上传；空态只提供“原创剧本 / 改编故事 / 导演视角”三条只填 prompt 的场景入口。
- 运行状态条直接复用 `sending`、`waiting`、`pendingTool`、`pendingApprovals`，不新增存储字段。

验收：

- 空态、发送中、等待确认、执行工具、完成、失败和中断七种状态都能识别。
- Agent 开关不改变当前画布 selected node、viewport 或保存状态。
- 多标签页仍严格绑定发起页面的 `clientId`、`threadId`、`turnId` 和 `itemId`。
- 图片附件、画布引用和 Skill token 在空态重构后保持原位置和发送顺序。
- 390px 下不覆盖画布核心控件，输入区不被软键盘遮挡。

### P2-C：Claude Agent SDK 侧边栏入口

状态：已合并 `dev`（PR #28），开关 `agentProviderSwitch` 默认关闭，等待人工验收。

目标：

- 复用 Canvas Agent 已提供的 `/agent/claude/turn` 和 `/agent/claude/interrupt`，在现有侧栏内切换 Codex / Claude，不复制第二套对话 UI。
- 只开放 Claude 真实支持的能力，不把 Codex 的模型、权限、历史、Skill 和图片附件能力伪装成 Claude 能力。

本轮实现：

1. 输入框工具栏增加 Agent 类型菜单；切换前若有任务运行则拒绝并提示先完成或停止。
2. Claude 模式隐藏 Codex 模型、思考强度、权限、Skill 和图片上传入口，仅保留文本输入、历史、画布工具确认、日志和停止。
3. 从 Codex 切到 Claude 时移除图片附件和图片引用，保留文本画布引用；发送前再次校验，避免绕过 UI 提交不支持的内容。
4. 连接设置页在 Claude 模式显示 Claude Agent SDK 说明，使用本机 Claude Code 登录态，不再展示 Codex 插件安装步骤。
5. Claude 事件复用现有 `thread.started`、`turn.started`、`item.*`、`usage.updated`、`turn.completed` 渲染；按 `runId` 适配会话线程，助手消息标题显示 Claude，终态清理运行状态。
6. 顶部连接文案改为中性的「Agent 已连接」，因为同一 Canvas Agent 可承载两种本地 Agent。

不在本轮范围：

- 真实工具队列。当前仍是单槽 `pendingTool`，同时到达的第二个工具会被拒绝；需要 Agent 协议升级后才能提供真实队列。
- Claude 模型列表、权限模式、Skill 选择和图片附件；这些需要 `/agent/claude` 对应契约，继续留在后续任务。
- Claude 登录态预检。侧栏不伪造已登录状态，首次发送时由 Canvas Agent 返回真实错误。

验收：

- 开关关闭时，即使浏览器保存过 Claude，也必须完整保持 Codex 侧栏、四页签和原控件。
- 开关打开后可切换 Codex / Claude；Claude 模式显示 Chat、History 和 Logs，模型、权限、Skill、上传控件全部消失。
- Claude 用户消息、流式助手消息、Usage、工具确认、批准/拒绝、停止和终态都能正确归属到当前 `threadId` / `turnId`。
- 未连接时 Claude 设置页只提供真实连接动作，不展示 Codex 插件安装步骤。
- 1440px、390px、中英文和浅深色无横向溢出。

### P2-D：Claude 本机会话历史与续聊

状态：已合并 `dev`（PR #29），沿用 `agentProviderSwitch`，等待人工验收。

目标：

- 直接读取 Claude Agent SDK 在当前工作空间持久化的本机会话，不建立第二套历史存储。
- 让历史恢复后的下一轮继续使用同一个 SDK `sessionId`，避免每轮都新建上下文。

已实现：

1. Canvas Agent 新增 `GET /agent/claude/threads`、`GET /agent/claude/threads/:threadId` 和 `POST /agent/claude/threads/:threadId/delete`，读写均限制在当前工作空间。
2. 历史只归一化用户文本、助手文本和工具名称/状态；不把工具输入、工具结果、本地路径、图片或其他附件内容返回浏览器。
3. Claude 模式复用现有 History 页签，支持刷新、恢复、删除和多选删除；恢复后加载 SDK 历史消息。
4. `/agent/claude/turn` 优先使用浏览器传入的真实 `sessionId` 执行 SDK `resume`；新会话首次收到 SDK session ID 后，将临时消息归属迁移到真实 ID。
5. 切换 Codex / Claude、清空 Claude 当前会话和删除当前 Claude 会话时，同步清理不再适用的消息、线程、工具和 Usage 状态，避免跨 Agent 污染。
6. 计划关闭功能开关时，即使浏览器保存过 Claude，也完整恢复 Codex 四页签与 Codex 历史行为。

不在本轮范围：

- Claude 权限模式、Skill 选择和图片附件。
- 跨工作空间或跨项目读取 Claude 会话。
- 多个工具同时等待确认的真实队列；当前仍保持单槽 `pendingTool`。

验收：

- 历史只显示当前工作空间会话；点击后恢复正确文本与工具摘要，刷新后仍可读取。
- 恢复历史后发送续聊，请求同时携带同一个 `threadId` 和 `sessionId`。
- 删除单条或多条 Claude 会话后列表与当前消息状态同步，不留下可继续操作的旧会话。
- “新对话”只清空 Claude 当前状态，不删除历史文件和 Codex 会话。
- Claude 与 Codex 来回切换后，两种 Agent 的消息、工具、审批和 Usage 不串线。
- `ff_agentProviderSwitch=0` 时恢复 Codex 四页签与固定 Codex 行为。
- 1440px、390px、中英文和浅深色无横向溢出。

### P2-E：Claude 原生模型列表

状态：已实现，沿用 `agentProviderSwitch`，等待人工验收。

目标：

- 从 Claude Agent SDK 原生初始化响应读取当前本机账号可用模型，不在前端硬编码模型名。
- 让 Claude 与 Codex 分别保存模型选择，并把所选模型透传到 Claude turn。
- 不把 Claude 未开放的思考强度、权限、Skill 或图片附件伪装成可用能力。

已实现：

1. Canvas Agent 新增 `GET /agent/claude/models`，通过 `Query.supportedModels()` 读取 SDK 模型列表；查询创建后立即关闭，不提交用户 prompt。
2. 模型列表只返回 `id`、模型值、显示名、说明和空推理强度列表；SDK 或初始化失败时原样返回错误，不伪造模型。
3. Claude capability 开放 `model`，继续关闭 `reasoning`、`permission`、`skills`、`attachments` 和 `imageReferences`。
4. 前端模型选择按 Agent 类型使用独立浏览器存储；Claude 只显示模型选择，不显示思考强度，Codex 原有模型与强度行为保持不变。
5. `/agent/claude/turn` 携带所选 `model`，不再发送 Claude 未开放的 `effort`。
6. 模型列表读取失败只记录诊断日志并清空当前选择，不阻断后续文本对话。

不在本轮范围：

- Claude 思考强度、权限模式、Skill 选择和图片附件。
- 模型别名与实际计费能力的二次校验；当前只信任 SDK 返回的可用模型。
- 多工具并发确认队列。

验收：

- 使用真实本机 Claude Code 登录态请求 `/agent/claude/models` 能读到 SDK 返回的模型列表，且没有触发模型生成。
- Claude 模型下拉只显示 SDK 返回项；切换后再切回 Codex，两个模型选择互不覆盖。
- Claude 请求体包含所选 `model`，不包含 `effort`；Codex 请求仍携带模型与思考强度。
- 模型列表读取失败时 Claude 文本对话仍可尝试发送，并由真实 Agent 返回后续错误。
- `ff_agentProviderSwitch=0` 时忽略浏览器保存的 Claude 选择，恢复 Codex 四页签、Codex 模型和推理强度。
- 1440px、390px、中英文和浅深色无横向溢出。

### P3：需要服务端或产品契约的能力

以下能力只保留信息和入口设计，不进入近期前端实现：

- 云项目、跨设备同步和服务端版本历史。
- 公开只读分享、分享凭证、撤销、权限和访问审计。
- Skill 市场、安装量、评分、远端分类和云端收藏。
- 积分、会员、计费、退款和供应商额度。
- 登录后真实账户、团队空间和多租户权限。

实施前置：

- 冻结数据格式、权限边界、错误码和回滚策略。
- 明确 Skill/插件制品的签名、来源和撤销机制。
- 明确本地数据迁移和双读校验方案，不能直接覆盖现有浏览器数据。

## 5. 功能开关与回滚

| 开关            | 默认 | 控制范围              | 回滚方式           |
| --------------- | ---- | --------------------- | ------------------ |
| `libtvShell`    | 关闭 | 240px 侧栏和导航分组  | 回到当前顶栏       |
| `pluginHub`     | 关闭 | `/plugins` 独立页面   | 回到现有插件 Modal |
| `agentSkillHub` | 关闭 | `/agent` Skill 资源页 | 回到侧栏技能页签   |
| `director3d`    | 关闭 | 3D 导演台入口和资源   | 保持现有行为       |
| `canvasFloatingChrome` | 关闭 | 画布浮动顶栏、dock 和空态快捷入口 | 恢复原顶栏与横向工具条 |
| `agentPanelChrome` | 关闭 | Agent 工作台空态、场景预设和运行状态条 | 恢复原 Agent 空态与布局 |
| `agentProviderSwitch` | 关闭 | 侧栏 Codex / Claude 切换和 Claude 专用设置页 | 固定使用 Codex 侧栏与能力 |

实施约束：

- 每个阶段单独验收，不把壳、插件页和画布工具条放进同一个大 PR。
- 新开关关闭时不得加载对应页面的大块资源。
- 侧栏、插件页和 Agent 页均不得新增依赖。
- 新增边界值（抽屉宽度、分页、搜索防抖）必须先取得确认，不能静默写入经验值。

## 6. 验证计划

自动化：

- `web:bun test`
- `web:bun run typecheck`
- `web:bun run build`
- `git diff --check`
- 为 `libtvShell`、`pluginHub`、`agentSkillHub` 补最小导航与开关回归测试
- 为 `canvasFloatingChrome` 补空态显示条件和快捷节点映射回归测试

浏览器：

- 1440×900、1024×768、390×844。
- 深色、浅色、中文、英文。
- DPR 2/3、真实触控和软键盘。
- 100+ 节点、100+ 素材、长会话 Agent 和重复打开/关闭画布工具。

关键回归：

- 画布保存、跨标签冲突、故事板定位、节点锁定、复制画布。
- 插件安装、更新、禁用、卸载、坏清单拒绝和 Agent 连接。
- Agent 附件、画布引用、Skill token、工具确认队列、中止和历史恢复。
- 功能开关关闭时入口隐藏且不请求对应静态资源。

## 7. 建议实施顺序

| 顺序 | 工作项                     | 可独立交付 | 依赖                                  |
| ---- | -------------------------- | ---------- | ------------------------------------- |
| 1    | P0 导航修复人工验收        | 是         | 无                                    |
| 2    | P1-A 窄侧栏与导航分组      | 是         | `libtvShell`                          |
| 3    | P1-B 插件 Hub              | 是         | 插件 catalog/action 复用              |
| 4    | P1-C Agent / Skills 首页   | 是         | 现有 Skill store；分类需 Agent 元数据 |
| 5    | P2-A 画布浮动控制带和 dock | 是         | P1-A 视觉基线                         |
| 6    | P2-B Agent 空态与运行状态  | 是         | P1-C 和 Agent 现有状态                |
| 7    | P2-C Claude SDK 侧栏入口   | 是         | Claude 后端接口和现有事件渲染         |
| 8    | P2-D Claude 历史与续聊     | 是         | SDK 会话 API 和现有 History 视图      |
| 9    | P2-E Claude 原生模型列表   | 是         | SDK 模型接口和现有模型选择器          |
| 10   | P3 云端、分享、市场与计费  | 否         | 服务端契约                            |

先做 P1-A 的原因：

- 侧栏决定页面密度和画布沉浸边界，是后续插件页与 Agent 页的共同容器。
- 单独做插件页或 Agent 页会反复修改导航和响应式，导致重复返工。
- 先固定 shell，再分别替换页面内容，可以把视觉回归限制在可控范围。

## 8. 明确不实施

- 不复制 LibTV 的活动横幅、会员、积分、充值、课程、排行榜和社区促销模块。
- 不使用 LibTV 的 Logo、模型供应商图标组合、卡片插画、视频封面和 Skill 示例文案。
- 不伪造安装量、评分、热度、收藏数或“官方推荐”。
- 不把未实现的“智能剪辑”等能力做成可点击的假入口。
- 不在没有服务端契约时实现分享链接、云同步、计费或远端 Skill 市场。
