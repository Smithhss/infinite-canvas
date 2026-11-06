# LibTV Agent 逆向评审与一比一复刻计划

## 结论

LibTV Agent 的视觉外壳、Skill 首页、Composer、Skill 卡片、分类筛选、会话时间线和结构化追问，可以在 Infinite Canvas 中做到高保真复刻。当前本地实现的 Codex / Claude Agent 执行层、画布工具、会话历史和问题回答链路也已经能承接主要交互。

但“完全一比一”需要拆成三个层级判断：

| 层级 | 判断 | 说明 |
| --- | --- | --- |
| 前端视觉与交互 | 可以高保真复刻 | 暗色工作台、Composer、Skill 市场布局、状态与卡片层级都能用现有 React / Tailwind / Ant Design 实现 |
| 本地 Agent 能力 | 可以接近，但协议不同 | Codex / Claude 的工具审批、结构化追问、Skill 选择和画布操作已接通；仍需补齐媒体节点锚定、统一工具预算和失败恢复 |
| 无登录、无本地安装、云端会话 | 不能只靠前端复刻 | 需要账号、托管 Agent 中继、服务端会话、Skill 审核、分享凭证、权限、计费和审计契约 |

因此建议目标定为“LibTV Agent 体验等价、Infinite Canvas 品牌和技术栈自有”，而不是复制其源码、商标、图片、字体或线上素材。视觉可以贴近，运行时保持本地优先。

## 逆向证据

- REA Browser Scenario Evidence：`ev_88052667b7fba2d4e0b54ae39f1ede9b9b31d9196254c9b4a382101d228550a0`
- REA Environment Manifest View：`ev_1a544421d144ed7469ba2e9c35f369c6e67995abcb63135de16fb7d9b0b3552c`
- 原始 capture：`/tmp/libtv-agent-rea-capture.json`
- 公开会话快照：`/tmp/libtv-public-session.json`
- Skill feed：`/tmp/libtv-skill-feed.json`
- Skill tags：`/tmp/libtv-skill-tags.json`
- 页面截图：
  - `/tmp/libtv-agent-review-home.png`
  - `/tmp/libtv-agent-review-session.png`
  - `/tmp/libtv-agent-review-local.png`

REA capture 的完整性状态为 `incomplete`，缺失项为 `events`，因此不能把本次 capture 当作完整网络协议或二进制等价证明。下列结论只使用已观察到的页面、网络请求、公开会话数据和实际交互，不推断未捕获的服务端实现。

## 本轮深度逆向补充

### 前端与运行时

- 站点外壳基于 Next.js / Turbopack，样式组合使用 Tailwind 和 Mantine，画布图谱使用 React Flow，Agent 会话界面使用 CopilotKit。
- Agent 通信使用 `text/event-stream`，客户端可走单端点 `agent/connect`、`agent/run`、`agent/stop`，也可按 Agent 使用 `/agent/{id}/connect`、`/agent/{id}/run`、`/agent/{id}/stop/{threadId}`。
- 已观察到的 Agent 类型：
  - `libtv_agent_copilot`：通用画布 Agent。
  - `libtv_agent_director_copilot`：导演 / 镜头 Agent。
  - `libtv_agent_script_copilot`：脚本 Agent。

### 工具面

已从前端 bundle 和运行事件确认的工具名称包括：

| 分类 | 工具 |
| --- | --- |
| 生成 | `create_generation_task`、`generate_text`、`generate_image`、`generate_video`、`generate_audio` |
| 视频编辑 | `edit_video.*`、`composite_video`、`ffmpeg_execute` |
| 画布操作 | `nodes_connections_batch`、`search_canvas_nodes`、`get_canvas_node_details`、`get_canvas_nodes_view` |
| 媒体分析 | `analyze_media`、`analyze_video` |
| 沙箱 | `sandbox_run` |
| 交互 | `propose_plan`、`request_feedback`、`ask_human` |
| Agent 编排 | `script_agent`、`transfer_to_agent` |

关键差异不是工具名字，而是 LibTV 把“读画布、分析媒体、生成、剪辑、回写、继续分析”组织成连续任务链。无限画布已有大部分基础工具，下一步应补工具预算、任务幂等、部分失败恢复和统一媒体锚定。

### 前端工具协议

LibTV 的浏览器工具桥使用独立事件：

| 方向 | 事件 |
| --- | --- |
| 服务端到浏览器 | `fe_tool_call`、`fe_tool_cancel`、`fe_tool_receipt` |
| 浏览器到服务端 | `fe_tool_ack`、`fe_tool_progress`、`fe_tool_result` |

- 默认工具超时为 30 秒。
- 未注册工具返回 `FE_TOOL_UNSUPPORTED`。
- 支持会话抢占、隐藏页面基础会话校验、取消和幂等结果回传。
- 这意味着前端不仅是聊天展示层，还要对每个工具声明能力、执行状态和可恢复结果。

### 审批与上下文

- 可观察审批模式：
  - `ask_for_approval`：每个敏感工具询问。
  - `approve_for_me`：自动批准，但保留过程记录。
  - `approve_run_node_once`：只批准当前节点或单次运行。
- 会话上下文包含 `currentNodeKey`、`approve.tool_call_id`、`script_model`、`agent_mode`、`skipSkills` 等字段。
- 公开会话使用 `{{i-nodeId}}`、`{{v-nodeId}}` 引用画布媒体；本地已有 `{{image:nodeId}}`、`{{video:nodeId}}`、`{{audio:nodeId}}`、`{{text:nodeId}}`，需要在发送前统一校验节点仍存在。
- 画布核心视觉 token 包括 `--nt-bg-body: #121212`、`--nt-bg-canvas: #1a1a1a`、`--canvas-node-bg: #191e26`、`--input-border: #525252`、`--radius-2xl: 16px`。这些只能用于视觉对齐，不能直接复制 LibTV 的品牌资源。

### 设置与 Skill

- Agent 设置包含审批模式、Agent 模式、脚本模型、Skill 开关和隐藏页基础会话选项。
- Skill feed 为 `POST /api/community/skill/template/feed/stream`。
- Skill 标签为 `GET /api/community/skill/tag/list?parentTagId=0`。
- 公开会话读取为 `GET https://im.liblib.tv/api/v1/project/share?shareId=...`。
- 这些接口说明“Skill 市场”和“公开分享”都依赖服务端目录、权限和审计，不是单靠前端就能补齐。

### 高价值证据

- 深度 capture：`/tmp/libtv-agent-deep-result.json`
- Capture Evidence：`ev_ad8d006f1d749c5a977346b2afb6d1c33715452f6907aa8c9b6ed0d5a4513ecc`
- 脚本导出：`/tmp/libtv-agent-scripts-20261106/files`
- 脚本 manifest：`/tmp/libtv-agent-script-manifest.json`
- 脚本 Evidence：`ev_602a315618be1c9315ae8cd47e0b88a833bacc1a4f5b6ceea6dbe18217a84d95`
- 公开会话结构：`/tmp/libtv-p2-structure.json`
- 当前页面截图：`/tmp/libtv-p1-current.png`、`/tmp/libtv-p2-current.png`、`/tmp/libtv-agent-page.png`
- 重点脚本：`chunks/2_cz2qi2e5lqg.js`（工具集合）、`chunks/3niql7nj6fb6k.js`（前端工具协议）、`chunks/1u4syj7bzjjpm.js`（CopilotKit 运行时）、`chunks/44gqh5upjo_6q.js`（会话与审批）、`chunks/2_ptpk82vut30.js`（Agent 设置）、`chunks/21x157oh6uyxp.js`（Skill 面板）、`chunks/0gbmg16se82z3.js`（事件 schema）。

REA 的静态 JavaScript 分析器当前受 macOS SDK 27 的 Swift interface 与 `xcrun` 不兼容影响；本轮没有重复相同失败调用，而是直接审计已导出的 89 个脚本。因此结论是可复核的前端与协议证据，不是完整服务端实现证明。

## “一比一”复刻评审

建议把目标拆成“体验等价、品牌自有”，否则无法在合法和可维护范围内承诺完全一比一。

| 层级 | 可复刻程度 | 评审 |
| --- | --- | --- |
| 视觉外壳、Composer、会话流、计划卡、工具卡、追问卡 | 高 | 用现有 React / Tailwind / Ant Design 可以做到接近；难点是细节密度、动效和状态切换，不是基础布局 |
| Skill 首页、分类、搜索、收藏、详情 | 高 | 本地数据结构已足够；远端市场、审核和统计需要服务端 |
| Codex / Claude 本地工具执行 | 中高 | 已有画布工具、审批、结构化追问和线程恢复；需补统一预算、幂等、取消和失败恢复 |
| 连续媒体任务链 | 中 | 需要图片/视频/音频稳定锚定、生成任务持久化、部分失败恢复和成本边界 |
| 无安装、全托管、账号和计费 | 低 | 依赖身份、任务队列、资源隔离、额度、退款和审计，前端无法替代 |
| 公开只读分享和跨设备同步 | 低 | 依赖服务端存储、分享凭证、撤销、权限和版本历史 |

结论：

1. 前端一比一不是主要难点，按现有实现继续做视觉收口即可。
2. 本地 Agent 体验可以接近，关键是消除每次手动连接、统一工具协议和补齐失败恢复。
3. 真正困难的是云端运行、Skill 市场、分享、账号、计费和审计；这些必须等待服务端契约。
4. 不建议复制 LibTV 源码、Logo、字体、头像和线上素材；应保留 Infinite Canvas 自有品牌，只复刻信息架构和交互模式。

## 已观察到的产品结构

### Skill 首页

- 暗色应用壳与左侧创作导航。
- 顶部大面积 Composer，支持文本、附件、模型、Skill 和多 Skill 标签。
- 手动 / 自动生成模式入口。
- Skill / 收藏 / 我的三组资源集合。
- 推荐、专业影视、商业广告、短剧漫剧、动漫游戏、音乐 MV、自媒体创作、通用技能、发现分类。
- 搜索、来源筛选、只看已启用、刷新。
- Skill 卡片包含封面、名称、描述、作者、使用量、收藏、选择和直接使用。

### Agent 会话

- 画布与右侧会话工作区并列，Agent 可直接引用和创建画布节点。
- 消息流包含用户文本、Skill 标记、媒体占位符、计划、工具调用、进度、生成结果和最终总结。
- Agent 可以在执行中追问，也可以请求用户批准工具或权限。
- 生成结果能回写画布，并由后续工具继续处理。
- 视频生成通过 `{{node_key}}` 一类占位符绑定画布媒体；公开会话中缺少占位符会导致调用失败，修正后才能执行。

### Skill 数据

Skill feed 请求路径：

```text
POST https://api.liblib.tv/api/community/skill/template/feed/stream
```

标签请求路径：

```text
GET https://api.liblib.tv/api/community/skill/tag/list?parentTagId=0
```

可观察字段包括：

- `templateUuid`
- `skillKey`
- `name`
- `version`
- `description`
- `resultType`，图片为 2，视频为 3
- `coverUrl`
- `likeCount`
- `usePv`
- `useUv`
- `ownerName`
- `ownerAvatar`
- `tags`
- `useScenario`
- `inputType`
- `outputContent`
- `caseItems`

这些字段足以支撑本地 Skill 卡片、分类、作者、热度、案例、收藏和详情布局，但不包含可直接复用的云端审核、权限和计费状态。

### 会话与画布

公开会话响应包含：

- `shareId`
- `sessionId`
- `canvasJson`
- `contexts`
- `lastMessageId`
- `title`

`contexts` 中实际出现 `text`、`skill`、`image`、`video` 和 `context` 类型。用户文本通过 `{{ image:nodeKey }}`、`{{ video:nodeKey }}`、`{{ skill:skillKey }}` 绑定媒体和 Skill。

`canvasJson` 中包含项目元数据、视口、节点、连线和草稿数据。节点至少有：

- `nodeKey`
- `type`
- `name`
- `position`
- `measured`
- `data`
- `parentKey`
- `status`
- `workflowUuid`
- `workflowRoot`

这说明 Agent 不是只处理聊天文本，而是把画布节点作为一等媒体上下文。本轮本地实现仍需补齐等价的稳定媒体锚定协议。

### 会话中观察到的工具

- `Skill`
- `ask_human`
- `request_feedback`
- `analyze_media`
- `analyze_video`
- `generate_video_v3`
- `create_generation_task`
- `nodes_connections_batch`
- `ffmpeg_execute`
- `sandbox_run`
- `propose_plan`
- `write_file`
- `show_optimized_prompts`
- `director_apply`
- `search_canvas_nodes`
- `get_canvas_node_details`

`ask_human`、`request_feedback` 对应结构化追问；`propose_plan` 对应计划卡；`nodes_connections_batch` 对应批量画布写入；媒体分析与生成工具则要求稳定的节点引用协议。

## 当前本地实现

已具备的 Agent 基础：

- `/agent?ff_agentSkillHub=1` LibTV 风格 Skill 首页。
- Composer 中的附件、模型、Skill、手动 / 自动模式。
- Skill / 收藏 / 我的、分类、搜索、来源和启用筛选。
- Skill 详情、收藏、选择、使用和快捷键填入。
- Codex / Claude Agent 切换。
- 多 Skill 选择与消息元数据持久化。
- 工具调用、计划、推理摘要、权限审批和错误卡片。
- 分页线程历史兼容。
- 页面刷新后恢复未完成的工具审批。
- 自动重连退避：`0 / 1.2 / 3 / 7 / 15` 秒，并在 focus / visibility 时立即重试。

本轮新增的结构化追问链路：

- Codex app-server 识别 `item/tool/requestUserInput` 与 `tool/requestUserInput`。
- Canvas Agent 广播 `codex_user_input` 和 `codex_user_input_resolved`。
- `POST /agent/codex/user-input` 校验 `requestId` 与 `answers`，拒绝空回答。
- 刷新后通过 `hello.pendingUserInputs` 恢复当前线程未回答的问题。
- 前端问题卡支持选项、自由文本、密码字段、多问题、超时提示、提交 loading、就地错误和成功移除。
- 运行状态显示待回答数量。

本轮新增的自动重连链路：

- 保存过地址和 Token 后，页面启动、窗口重新聚焦或恢复可见时会自动执行本地服务发现和连接。
- 自动连接成功不弹重复通知；手动连接和手动重试保留一次成功提示。
- 编辑地址或 Token 会先暂停当前 SSE 连接并保持草稿，不会立即向草稿地址发起请求；只有用户主动连接后才使用新配置。
- 插件 MCP 启动时会检查网页连接服务，必要时 detached 拉起同一个 CLI；本机回环页面可从 `/config` 安全取得 token，非本机 Origin 不返回 token。
- 本地发现到新 token 时会替换浏览器中的失效 token，避免配置重建后一直用旧 token 重试。

本轮新增的画布媒体 token：

- 隐藏 Agent 上下文同时提供 `{{image|video|audio|text:nodeId}}` 和原有 `@` 引用。
- 生成流程可识别两类引用，并在提示词只包含节点引用时复用已有节点，不额外创建重复提示词节点。

## 能力差距

| 能力 | LibTV 观察 | 当前本地 | 差距与优先级 |
| --- | --- | --- | --- |
| Composer 与多 Skill | 支持 | 支持 | 已完成主流程，继续做细节视觉收口 |
| Skill 分类、搜索、收藏 | 支持 | 支持本地数据 | 云端市场、审核、作者统计和跨设备收藏未实现 |
| Agent 会话 | 支持 | 支持 Codex / Claude | 需要真实登录态、长会话与异常恢复验收 |
| 结构化追问 | `ask_human` / `request_user_input` | 已接通 | 需要真实模型触发和人工验收 |
| 计划与工具卡 | 支持 | 已支持主要形态 | 继续统一工具预算、批准模式和失败恢复 |
| 画布媒体锚定 | `{{ image:node_key }}` 等 | 已有 `{{kind:nodeId}}` 稳定 token 和旧 `@` 引用 | P1，补发送前 fail-closed 校验和失效节点 UI |
| 画布批量写入 | `nodes_connections_batch` | 已有 Canvas Agent ops | 需补齐事务边界与部分失败恢复 |
| 视频分析 / 剪辑 | `analyze_video` / `ffmpeg_execute` | 本地智能剪辑与部分分析入口 | 需要真实媒体管线与零收费压测 |
| Skill 云端市场 | 有 | 本地 Skill + GitHub 安装 | 需要后端目录、审核、版本和统计 |
| 公开会话分享 | 有 | 未实现 | 阻塞于服务端存储、权限和分享凭证 |
| 跨设备历史 | 有云端语义 | 浏览器 / 本机历史 | 需要服务端会话和同步 |
| 账号、积分、计费 | 有 | 未实现 | 等待 FYT Phase E |
| 无安装直接使用 | 有托管 Agent | 否 | 需要托管中继、资源隔离、身份和计费 |

## 复刻难度

### 可以独立完成

1. Skill 首页与卡片的剩余视觉差异。
2. 结构化问题卡的键盘、屏幕阅读器和窄屏细节。
3. 工具预算、工具批准模式、队列状态和失败恢复。
4. `{{node_key}}` 等稳定媒体 token，与现有 `@` 引用并存。
5. 会话分享的本地导出格式，不包含公开链接。
6. 真实的零收费工具回放和压力测试。

### 需要服务端契约

1. Skill 市场、审核、版本、评分、作者和跨设备收藏。
2. 公共会话只读分享、撤销、访问审计和权限。
3. 跨设备项目、历史、素材和版本冲突处理。
4. 托管 Agent、匿名体验、资源配额、计费和退款。

### 不建议承诺

- 不使用 LibTV 源码、图标、字体、图片、作者头像和案例素材。
- 不在前端伪造云端审核、热度或计费状态。
- 不把当前本地 Skill 列表描述成服务器 Skill 市场。
- 不在没有真实 Claude / Codex 登录态时宣称真实登录、流式、附件和续聊已验收。

## 分阶段执行计划

| 阶段 | 优先级 | 内容 | 完成标准 |
| --- | --- | --- | --- |
| Agent A | P0 | 结构化追问、自动重连、零手动连接、分页历史 | 已实现；单测、类型检查、浏览器自动发现和失效 token 恢复通过 |
| Agent B | P1 | 统一媒体 token：`{{node_key}}`、图片、视频、音频和 Skill | 生成请求不会把已失效节点当作有效媒体；缺失媒体在发起前失败 |
| Agent C | P1 | 工具预算、批准模式、队列和部分失败恢复 | 单一 turn 有明确预算；重复调用可检测；失败只影响对应任务 |
| Agent D | P1 | 真实模型验收 | 真实登录、流式回复、问题、审批、附件、历史续聊全部通过 |
| Agent E | P2 | Skill 市场本地适配层 | 本地字段与远端字段可映射；远端不可用时降级为本地数据 |
| Agent F | P2 | 会话导出与分享契约 | 先实现脱敏本地导出；公网分享等待服务端 |
| Agent G | P2 | 云端会话、跨设备同步、计费 | 只在 FYT 契约冻结后启动 |

## 验收矩阵

- 单元测试：问题 schema、重复提交、resolved、进程失败取消、分页历史。
- Canvas Agent 集成测试：SSE 广播、刷新恢复、回答 POST、失效 requestId。
- 浏览器：问题卡显示、选项、自由文本、密码输入、提交成功、提交失败、窄屏布局。
- 真实模型：不能使用收费模型时保持 mock；使用真实模型前单独取得授权和费用上限。
- 视觉：桌面、1024px、390px、浅色和深色主题都不能出现横向溢出。

## 本轮验证

- Web TypeScript：通过。
- Web 测试：276 项通过。
- Web production build：通过，仅保留既有动态导入和大 chunk 警告。
- Canvas Agent 测试：192 项通过。
- Canvas Agent TypeScript build：通过。
- Runtime status 单测：新增问题阶段，6 项通过。
- MCP 自动拉起网页服务：隔离 HOME 和端口实测通过，MCP stderr 输出服务已启动。
- `/config` 权限：`127.0.0.1` Origin 返回 token；远程 Origin 不返回 token。
- 浏览器自动连接：清空保存 token 后进入 `/agent` 自动连接成功；写入失效 token 后刷新，token 被替换并恢复连接；再次刷新继续自动连接。
- 浏览器问题卡：显示、两项回答、提交按钮启用、请求体、成功移除均通过；后端成功响应用临时 fetch 桩模拟。
- 尚未完成：真实 Codex `request_user_input` 触发、真实 Claude 登录态、公开会话分享、云端 Skill 市场和 FYT 计费。

## 复核后加固

- 保留字符串或整数 JSON-RPC RequestId，避免 `req_*` 形式的审批和问题响应被写成 `null`。
- 按 app-server 的 `autoResolutionMs` 自动提交空回答并广播超时清理，防止无人值守 turn 永久占用。
- 回答前校验问题 ID、完整性、选项和自由输入约束；相同回答幂等返回，不同回答返回冲突。
- `serverRequest/resolved`、进程退出和分页线程恢复路径同步清理问题定时器与缓存。
- 自动重连不会覆盖用户主动断开、正在编辑的地址或 Token；`/agent` 的重新连接会重新执行本地服务发现。
- Codex 状态、发送互斥和 Claude 发送回调增加待回答与线程切换保护。
- 定向测试：Codex client 42 项通过，Session 36 项通过，Web Agent 定向测试 7 项通过；Web 与 Canvas Agent TypeScript 构建通过。
