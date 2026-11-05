# LibTV 画布与分镜逆向及本地复刻计划

**目标：** 用 REA 的静态语义证据和 ego-browser 的运行时观察，复现 LibTV 画布、故事板、脚本 V2、Agent、插件和 3D-BOX 的信息架构、交互密度与工作流，而不是复制其品牌资产或内部服务端协议。

**当前结论：** LibTV 的“故事板”与“脚本 V2”是两层能力：故事板负责素材编排，脚本节点负责镜头生产。两者不是当前本地早期实现中的“文本 / 图片 / 视频三栏投影”。

- 左侧是 TV Director 对话与画布感知区。
- 右侧是“项目素材库 + 当前素材 / 脚本 V2 详情”的双栏编辑区。
- 脚本 V2 可以进入独立全屏工作台，包含镜头表、资产准备和提示词合成阶段；发布包中还存在“脚本视图 / 创意视图 / 资产视图”三类视图入口。
- 镜头表完成后，依次进入“确认镜头 → 准备资产 → 合成提示词 → 批量生成分镜 → 批量生视频”。
- 分镜组是脚本与图片 / 视频生产之间的桥；宫格、画幅、序号、拼接和清空都属于分镜组能力，不应硬塞进普通节点逻辑。
- Agent、Skill、插件和 3D-BOX 是独立入口，不应把本地“Agent 侧栏”当成 LibTV 的完整产品结构。
- 运行时节点注册表实际包含 22 种类型，但主“添加节点”菜单只暴露其中一部分；不能把内部注册表等同于全部公开入口。
- 3D-BOX 官方示例实际加载约 3.89 MB 的 GLB，而当前检查器只稳定暴露 Transform；关键帧、轨道、路径和速度曲线目前仍只能按“静态确认”处理。

本计划以现有 Infinite Canvas 节点模型为基础渐进扩展，不引入第二套白板框架，不复制 LibTV 的源码、图标、图片、字体、文案或接口。

## 1. 证据与边界

### 1.1 REA 证据

本轮复用并核对以下静态分析结果：

| 证据 | 内容 |
| --- | --- |
| `/tmp/liblib-reverse/chunks/12llspbqt3zay.js` | 脚本 V2 的节点字段、任务桥、提示词校验、分镜组布局 |
| `/tmp/liblib-reverse/rea-12ll.json` | 613 个函数、50 个字面量、12,750 个表达式；脚本 V2 核心数据流 |
| `/tmp/liblib-reverse/rea-1rrx.json` | 脚本表 UI、字段菜单、筛选、行操作、分镜生成入口 |
| `/tmp/liblib-reverse/rea-33c.json` | 脚本 / 分镜 / Agent / 插件 / 3D-BOX 的中英文界面词条 |
| `/tmp/liblib-reverse/rea-05oet.json` | 画布、节点、布局与运行时配置 |
| `/tmp/liblib-reverse/chunks/20mqejatmu6a8.js` | 3D 导演台场景数据、相机、相机轨道、关键帧、运动路径和资产清单 |
| `/tmp/liblib-reverse/chunks/0voukkk3xhnig.js` | MCP OAuth 入口、授权范围和回调校验 |
| `/tmp/liblib-reverse/chunks/1rrxb8h33bly_.js` | 脚本表字段 / 筛选、CSV 导出、分镜组布局与拼接入口 |
| `/tmp/liblib-reverse/node-types-contexts.txt` | 22 种画布节点注册、分镜关联、节点删除和脚本镜头映射上下文 |
| `/tmp/liblib-reverse/locale-relevant.json` | 3D 时间轴、关键帧、路径、速度曲线、高斯泼溅和视频导出的界面词条 |

运行时补充证据：

| 文件 | 内容 |
| --- | --- |
| `/tmp/liblib-reverse/runtime-p1-react-surface.json` | 22 种节点类型和边类型 |
| `/tmp/liblib-reverse/runtime-p1-project-hooks.json` | 当前测试项目和空间标识 |
| `/tmp/liblib-reverse/runtime-p3-scene-props.json` | 3D-BOX 相机、GLB、世界设置和场景版本 |
| `/tmp/liblib-reverse/runtime-p3-fiber-3d.json` | 3D-BOX Fiber 证据，含 GLB 字节数、时间轴可见状态和时间轴片段 |
| `/tmp/liblib-reverse/runtime-p3-page.json` | 3D-BOX 当前 DOM 文本、Canvas 尺寸和资源列表 |
| `/tmp/liblib-reverse/runtime-screenplay-settings.json` | 剧本设定器运行时文本、按钮和输入项 |
| `/tmp/liblib-reverse/runtime-script-preset-options.json` | 受众、角色、时代、看点、画风和结构的完整选项与勾选上限 |
| `/tmp/liblib-reverse/runtime-tv-director-settings.json` | TV Director 全局设置运行时文本和尺寸 |
| `/tmp/liblib-reverse/runtime-asset-view-options.json` | 资产库视图密度、排序和评级选项 |
| `/tmp/liblib-reverse/runtime-p1-asset-library-view-20261105.png` | 资产库“视图管理”截图 |
| `/tmp/liblib-reverse/runtime-p3-animation-clip-20261105.png` | 3D-BOX 成片预演和 15 秒镜头片段截图 |

REA 只能证明发布包中存在这些静态结构和文案，不能证明每个分支都能在当前账号、权限或套餐下执行。

### 1.2 ego-browser 证据

独立 TaskSpace：

- TaskSpace `25`，名称 `infinite-canvas-libtv-reverse-20261105`
- `p1`：LibTV 测试画布，包含一个空图片节点和一个脚本 V2 节点，没有触发付费生成
- `p2`：LibTV 插件页，验证 OpenAI 插件命令、MCP / CLI 切换和 CodeBuddy CLI 文案
- `p3`：LibTV 3D-BOX 示例项目，验证场景树、检查器、添加元素、撤销和成片预演
- `p4`：LibTV Skill 页，验证多 Skill 标签、重复添加、退格删除、收藏 / 我的空态和搜索
- `p5`：LibTV 3D-BOX 首页，验证 240px 侧栏、桌面 / 390px 输入卡和项目卡

截图：

| 文件 | 观察内容 |
| --- | --- |
| `/tmp/liblib-workflow-no-agent.png` | 工作流空态、顶部控制带、底部 dock |
| `/tmp/liblib-workflow-agent-float.png` | 右侧浮层 Agent 空态 |
| `/tmp/liblib-add-node-menu.png` | 添加节点菜单和分组 |
| `/tmp/liblib-node-selected.png` | 选中节点、画布底部控制 |
| `/tmp/liblib-script-node.png` | 脚本节点与图片节点并排 |
| `/tmp/liblib-storyboard-view.png` | 故事板：左侧 Assistant、中间素材库、右侧图片详情 |
| `/tmp/liblib-storyboard-with-script.png` | 故事板：脚本 V2 详情 |
| `/tmp/liblib-plugin-full.png` | 插件页完整长页面 |
| `/tmp/liblib-agent-page-loaded.png` | Agent / Skill 资源页 |
| `/tmp/liblib-3d-box.png` | 3D-BOX 首页 |
| `/tmp/liblib-canvas-shortcuts-20261105.png` | 画布快捷键面板 |
| `/tmp/liblib-canvas-to-storyboard-group-20261105.png` | 普通组转分镜组后的工具栏 |
| `/tmp/liblib-storyboard-grid-custom-20261105.png` | 自定义 5×5 宫格选择器 |
| `/tmp/liblib-storyboard-group-stitch-menu-20261105.png` | 分镜组拼接 2K / 4K 菜单 |
| `/tmp/liblib-script-toolbar-overlap-20261105.png` | 脚本全屏的节点工具栏被表头覆盖 |
| `/tmp/liblib-script-row-menu-20261105.png` | 脚本行颜色和删除菜单 |
| `/tmp/liblib-script-duration-editor-20261105.png` | 脚本时长编辑器 |
| `/tmp/liblib-script-assets-current-20261105.png` | 准备资产阶段 |
| `/tmp/liblib-script-compose-current-20261105.png` | 合成提示词阶段 |
| `/tmp/liblib-3d-current-20261105.png` | 3D-BOX 编辑器和场景树 |
| `/tmp/liblib-3d-animation-mode-20261105.png` | 3D-BOX 成片预演模式 |
| `/tmp/liblib-3d-add-element-current-20261105.png` | 3D-BOX 添加元素菜单 |
| `/tmp/liblib-plugin-current-20261105.png` | 当前 MCP / CLI 插件页 |
| `/tmp/liblib-skill-multiselect-current-20261105.png` | Skill 多选标签 |
| `/tmp/liblib-skill-selector-current-20261105.png` | Skill 选择器 |
| `/tmp/liblib-3d-box-home-current-20261105.png` | 3D-BOX 首页桌面布局 |
| `/tmp/liblib-3d-box-home-mobile-20261105.png` | 3D-BOX 首页 390×844 / DPR 3 布局 |

### 1.3 证据分级

文档中的结论按以下等级记录，避免把静态代码或占位文案误写成已验收能力：

| 等级 | 含义 | 采用方式 |
| --- | --- | --- |
| 运行时确认 | ego-browser 当前页面实际点击、输入、选择或观察到 | 可以作为交互和视觉基线 |
| 静态确认 | REA / 发布包中存在对应结构、文案或代码路径 | 只能作为设计意图和待验证能力 |
| 未验证 | 需要服务端契约、真实账号、真实计费或实体设备 | 不得进入复刻验收结论 |

### 1.4 不可直接复制的边界

- 不复制 LibTV 的品牌、Logo、插画、示例图片、用户内容、字体文件和专属图标。
- 不把 LibTV 的内部任务名、接口路径、积分规则或权限模型当成已确认契约。
- 不根据公开页面推断云同步、公共分享、团队权限、计费或退款已经可用。
- 本地实现继续以浏览器本地存储为主，除非后续冻结 FYT 服务端契约。

## 2. 运行时尺寸与视觉基线

以下数值来自 ego-browser 的 DOM 计算样式，仅作为密度参考；本地必须映射到 `canvasThemes` 或 Ant Design token，不能散落硬编码。

### 2.1 全局深色 token

```css
body: #141414
--canvas-bg: #1a1a1a
--canvas-controls-bg: #262626
--canvas-controls-border: #363636
--canvas-controls-text: #ffffff
--canvas-controls-text-muted: #919191
--canvas-controls-hover: #ffffff1a
--seg-control-active-bg: #363636
--seg-control-hover-bg: #ffffff0d
--panel-background: #262626
--border-neutral-l1: #ffffff14
```

### 2.2 画布

| 元素 | 实测尺寸 / 样式 |
| --- | --- |
| 顶部控制按钮 | 32 × 32，圆角 8px |
| 工作流 / 故事板切换 | 65 × 32，外层圆角 8px |
| 顶部左侧信息簇 | 约 227 × 32 |
| 顶部右侧系统簇 | 约 413 × 32 |
| 底部 dock | 约 338 × 49，`#262626`，圆角 12px，0.5px 边框 |
| dock 内按钮 | 32 × 32，透明背景，hover `#ffffff1a` |
| 左下画布信息行 | 约 283 × 40，半透明 `#1a1a1a`，圆角 12px |
| 空图片节点 | 约 622 × 350，`#262626`，圆角 12px |
| 添加节点菜单 | 约 220 × 379，菜单项约 212 × 32，圆角 8px，字号 13px |
| Agent 浮层 | 400 × 640，`rgba(31,31,31,.95)`，圆角 28px，边框 `rgba(255,255,255,.08)`，模糊 10px |

### 2.3 添加节点菜单

运行时主菜单（`1716 × 921`，菜单约 `220 × 379`）：

- 文本
- 脚本（二级：脚本 NEW / 脚本（旧版）Beta）
- 图片
- 视频
- 导演台 NEW
- 智能剪辑 Beta
- 音频

菜单顶部有“搜索画布节点”。主菜单下方另分“添加资源”：

- 上传
- 从生成历史选择

本地可先实现“文本、脚本、图片、视频、导演台、智能剪辑、音频”七项；上传和生成历史复用已有功能，不新增假入口。

### 2.4 Plugin、Skill 与 3D-BOX 基线

以下均来自当前 1716 × 921 视口的运行时测量。深色主题下，侧边导航到主内容的起点约为 `x=280`。

| 页面 | 元素 | 运行时基线 |
| --- | --- | --- |
| Skill | 主标题 | 24px，宋体类衬线字体，行高 40px；颜色 `#f7f7f7` |
| Skill | 主输入卡 | 860 × 136，`#212121`，边框 `#363636`，圆角 16px |
| Skill | 可编辑输入区 | 834 × 34，14px / 24px |
| Skill | Skill 卡片 | 455 × 129，`#212121`，圆角 16px，半透明白色边框；三列网格 |
| Skill | 一级标签 | 17px；激活 `#f7f7f7`，未激活 `#525252` |
| Skill | Skill 选择器 | 450 × 400，`#171717`，边框 `#363636`，圆角 12px |
| 插件 | 标题区 | 内容区宽约 1396；标题字号 28px |
| 插件 | Agent 选择 | OpenAI / Claude / Claude Code / OpenClaw / Hermes / CodeBuddy |
| 插件 | 接入方式 | MCP / CLI 二选一，切换会替换整段安装说明 |
| 3D-BOX | 右侧检查器 | 240 × 790，`#111111` |
| 3D-BOX | 场景调度 / 成片预演工具栏 | 224 × 48，顶部居中 |
| 3D-BOX | 底部生成输入 | 320 × 48，`#1f1f1f`，圆角 24px |
| 3D-BOX | 场景树 | 宽 216；示例项目为虚拟滚动，内容高度约 82,000px |

### 2.5 3D-BOX 首页基线

桌面 1716 × 921：

| 元素 | 运行时尺寸 / 样式 |
| --- | --- |
| 左侧导航 | 240px；项目、资产、插件和创作分组均为 32px 行 |
| 顶部作品带 | 5 张横向预览卡，单卡约 400 × 148 |
| 主标题 | 28px；内容区宽 1396 |
| 主输入卡 | 800 × 124；`rgba(31,31,31,.95)`；圆角 24px；内阴影与下方投影 |
| 可编辑输入区 | 768 × 48 |
| 输入工具栏 | 768 × 32；附件、模型、16:9、自动时长和生成按钮 |
| 生成按钮 | 86.6 × 32；圆角 24px；青色渐变，禁用时降饱和 |
| 示例提示行 | 768 × 40，共 3 条 |
| 新建空白卡 | 338.5 × 190.4；`rgba(255,255,255,.07)`；圆角 12px |
| 项目卡 | 338.5 × 240.4 |

390 × 844 / DPR 3：

- 页面 `scrollWidth` 为 390，无横向溢出。
- 输入卡为 350 × 196，左右各 20px 边距，圆角保持 24px。
- 可编辑输入区为 318 × 48。
- 附件、模型、比例、时长和生成按钮自动换行：附件第一行，模型第二行，比例 / 时长 / 生成第三行。
- 示例提示行保持 318 × 40。
- 顶部作品带横向裁切，主标题变为两行。

### 2.6 工作流侧边入口与全部功能

以下入口在 `1716 × 921` 的画布工作流中实际命中；它们不是同一个菜单，不能合并成一个泛化的“工具”按钮。

| 入口 | 运行时结构 |
| --- | --- |
| 素材库 | 左侧浮层，含“风格库 / 新增风格节点 NEW”和“特效库 / 新增特效节点 NEW” |
| 角色造型室 | 对话框；顶部“我的角色库 / 官方角色库”，筛选“性别 / 年龄段 / 文化区域”，支持角色名或描述搜索、多选、列表 / 宫格视图和“创建新角色” |
| 生成历史 | “资产库”对话框；标签“生成历史 / 我保存的 / 我上传的”，范围“本项目 / 全部项目”，类型“全部 / 图片 / 视频 / 音频”；“视图管理”内含密度滑杆、时间正 / 倒序和全部 / 1–5 星评级 |
| 全部功能 | 对话框内按“视频编辑 / 图片编辑”分组，见下表 |
| 快捷键 | 单独快捷键面板，见 6.4 |

“全部功能”运行时项目：

**视频编辑**

- 片段截图
- 高清
- 元素替换
- 去字幕
- 片段重拍
- 分离音视频
- 逐帧拉片
- 深度动作捕捉
- 创意片头
- 画面裁切
- 智能续写
- 主体消除
- 片段截取
- 智能抠像

**图片编辑**

- 高清
- 元素编辑
- 多角度
- 宫格切分
- 图层分离
- 720 度全景图
- 人像质感调节
- 旋转
- 标注
- 扩图
- 九宫格
- 打光
- 抠图
- 擦除
- 重绘
- 裁剪

这些全部是 LibTV 的运行时入口，不等于本地已经具备对应供应商能力。本地只保留可以真实实现的入口；需要云端编辑、动作捕捉、模型重绘或收费模型的项，必须单独接入和验收，不能先放可点击假按钮。

## 3. LibTV 画布信息架构

### 3.1 工作流模式

```text
┌ 顶部浮动控制带 ─────────────────────────────────────────────┐
│ 返回 / 工作区 / 画布 ▾    工作流 | 故事板    分享 / 积分 / 会员 / Agent │
└──────────────────────────────────────────────────────────────┘

┌ 左侧元素面板 ┐┌────────────── 无限画布 ──────────────┐┌ Agent 浮层 ┐
│ 画布 / 资产  ││ 节点、连线、缩放、小地图、框选       ││ 对话 / 历史 │
│ 提示词       ││                                     ││ 技能 / 设置 │
└──────────────┘└─────────────────────────────────────┘└────────────┘
                        底部中央 dock
        ┌────────────────────────────────────────────┐
        │ ＋  移动  素材  角色  全部功能  历史  快捷键  教程 │
        └────────────────────────────────────────────┘
```

关键行为：

- 顶部控制带无整块色带，只保留 32px 圆形或圆角控件。
- 底部 dock 只承载高频动作，低频动作收进菜单。
- 空画布不显示大面积说明，而是在中心显示节点快捷入口。
- 右侧 Agent 与画布共存，不抢占画布宽度；可拖拽、折叠和切换为左侧 Assistant。

### 3.2 故事板模式

实测桌面 1716px 宽时：

```text
┌ 48px 顶部画布控制带 ─────────────────────────────────────────────┐
│ 画布信息 / 工作流 / 故事板 / 分享 / 积分 / 会员 / Agent           │
└──────────────────────────────────────────────────────────────────┘
┌ 左侧 Mantine Drawer（覆盖层，0,48,908×873）┐┌ 右侧故事板工作台（808×873）┐
│ 新对话 / 历史 / 分享 / 设置 / 插件 / 布局  ││ 后退 / 前进 / 项目素材 / 搜索 / 添加 / 批量 │
│                                            │├──────── 320px ────────┬─ 488px ─┤
│ TV Director 空态                           ││ 图片 1                 │ 图片节点 1 │
│ 感知画布 / 剧本原创 / 上传故事             ││ 全部 角色 场景 物品 其他│ 预览 / 提示词 │
│ 剧本原创 / 剧本改编 / 导演执导             ││ 缩略图卡片              │ 脚本 V2 详情 │
│ 输入框 / 附件 / 模型 / Skill / 手动生成    ││ 脚本 V2 1              │ 参考图 / 生成 │
└────────────────────────────────────────────┘└────────────────────────┴──────────┘
```

左栏不是故事板栅格中的普通列，而是覆盖在画布上的 `mantine-Drawer-content`：实际矩形为 `x=0, y=48, 908 × 873`。右侧故事板工作台从 `x=908` 开始，内部主网格为 `808 × 824.5`。这不是“左侧 908px + 右侧 808px 两列同时参与布局”，而是 Drawer 覆盖左半屏、故事板占用右侧。

右侧内部有两条可拖动分隔线：

- `x≈904, 8 × 873`：调整 AI 助手面板宽度。
- `x≈1228, 8 × 824.5`：调整素材库 / 详情区列宽，双击恢复默认。

因此右栏可拆成素材库约 `320px` 和详情区约 `488px`。详情区标题是当前素材，例如“图片节点 1”或“脚本 V2 1”，右侧操作固定为“添加到对话 / 下载 / 更多 / 关闭”。

关键行为：

- Assistant 是覆盖层，可拖动宽度；窄屏时自动收起为抽屉或图标栏。
- 资产库有后退、前进、搜索、添加、批量操作。
- 分类固定为“全部 / 角色 / 场景 / 物品 / 其他”。
- 素材库按类型分组，实测可见“图片 1”和“脚本 V2 1”；每组有收起 / 展开按钮。
- 右侧详情面板可显示图片、视频、音频、脚本 V2。
- 选中素材后可以“添加到对话”，不直接把素材发送给模型。
- 故事板不显示工作流 dock、空态快捷入口、节点浮动工具条。

### 3.3 完整节点注册表

运行时从 React Fiber 取得 22 种已注册节点。注册类型只说明前端存在对应组件，不说明它一定出现在“添加节点”菜单、当前账号可用或服务端任务已接通。

| 分类 | 节点类型 | 组件 / 作用 |
| --- | --- | --- |
| 基础 | `custom` / `temp` | 通用或临时节点 |
| 基础 | `text` / `image` / `video` / `audio` | 文本、图片、视频、音频 |
| 基础 | `group` | 普通组与分镜组共用容器 |
| 脚本 | `script` | 旧脚本节点 |
| 脚本 | `storyboard` | 运行时实例化 `ScriptNode`，是注册别名，不应另造一套故事板节点 |
| 脚本 | `script-v2` | 新脚本表和资产 / 提示词工作流 |
| 脚本 | `screenplay` | 剧本节点，含项目 VFS 文件和生产工具栏 |
| 视频 | `video-story` / `video_group` | 视频故事与视频组 |
| 视频 | `video-clip` | 智能剪辑 |
| 视频 | `video-switch` | 元素替换，含动作迁移和元素替换标签 |
| 素材 | `reference` | 通用参考节点 |
| 素材 | `material-style` / `material-lens` | 风格、特效 |
| 素材 | `space-scene-720` | 720° 全景 |
| 分析 | `shot-breakdown` | 逐帧拉片 |
| 3D | `director-console-3d` / `director-studio` | 导演台与 Director Studio |

约束：

- 主菜单当前只直接暴露文本、脚本 NEW / 旧版、图片、视频、导演台、智能剪辑和音频；其他节点由素材库、分组转换、脚本投影、引用或条件入口创建。
- `storyboard` 和 `script` 共用 `ScriptNode`，但存储版本、界面和任务路径可能不同，不能在本地用一个布尔值混同。
- 旧脚本、脚本 V2、剧本节点是三层不同能力，分别对应旧分镜、镜头生产工作台和项目文件式剧本。

### 3.4 TV Director 与剧本设定器

TV Director 空态实际提供四个入口：

- 感知画布开始创作
- 从爆款预设开始剧本原创
- 上传故事来改编
- 批量优化提示词

输入模式下有三个独立模式：

1. 剧本原创
2. 剧本改编
3. 导演执导

“TV Director 全局设置”不是普通模型设置，运行时包含：

- 人像安全协议状态和签署入口；未签署时提示遇到人像不会使用 Seedance。
- 协作模式：“自动生成图片 / 视频 / 音频 / 剧本”；开启后可直接消耗积分并提交任务，无需逐次确认。
- 积分预算管理与提醒阈值，默认阈值为 `1000`。
- 浏览器通知开关和通知声音开关。
- 固定说明：推理和素材生成分别计费。

“剧本设定器”是 `1232 × 640` 的独立 Modal，左侧“爆款预设 Top 8”，右侧是完整设定区。它不是脚本 V2 表格的一个弹窗编辑器，也不是 TV Director 设置页。

爆款预设 Top 8：

1. 玄幻修仙逆袭
2. 现实职场成长
3. 末世生存基建
4. 非遗国潮视觉
5. 古代女频甜宠
6. 规则怪谈悬疑
7. 重生复仇爽剧
8. 仙门团宠日常

题材类型共 15 项：玄幻修仙、都市现实、古装言情、悬疑推理、惊悚怪谈、犯罪谍战、家庭伦理、末世科幻、历史传奇、喜剧、主旋律、体育竞技、职场行业、文旅非遗、其他；支持融合题材和自定义题材。

| 设定 | 规则 | 运行时选项 |
| --- | --- | --- |
| 目标受众 | 至多 2 项 | 男频、女频、泛人群、出海、银发、其他 |
| 角色设定 | 至多 5 项 | 小人物、打工人、女强、不完美成长型、专业型、天才、双强、腹黑、黑莲花、忠犬、病娇、福宝、大小姐、少爷、王爷、王妃、皇帝、将军、修士、龙王、医者、律师、警探、教师、模特、其他 |
| 时代背景 | 至多 2 项 | 古代、现代、架空、末世、民国、年代（80–90s）、近未来、平行世界、多时空穿越、其他 |
| 核心看点 | 至多 3 项 | 器物金手指、收集升级、基建生存、专业碾压、马甲大佬、先婚后爱、重生复仇、团宠被爱、IP 二创、双向救赎、穿越异世、扮猪吃虎、亲历行业细节、真实成长、规则禁忌、单元解谜、文化元素新用、风格混搭、视觉奇观、隐藏身份、真假千金、契约婚姻、萌宝助攻、赘婿逆袭、系统傍身、欢喜冤家、普通人的处境、群像时代切片、姐弟恋、穿书、时间循环 |
| 画风 | 单选，可自定义；参考图上传入口为静态确认 | 冷峻宫廷权谋、国产冷调悬疑、都市写实、柔光古装言情、日系青春胶片、写实江湖武侠、高调棚拍广告、经典好莱坞、赛博科幻、冷感文艺、暗黑恐怖、3D 奇幻动画、工业质感、怀旧港片、唯美国风 3D、三渲二动漫、超写实 3D、暗调奇幻 CG、东方玄幻 3D、经典国产美术、国风壁画 |
| 剧本结构 | 集数与叙事结构 | 集数默认 20；三幕式、五幕式、英雄旅程、平行结构、交叉结构、非线性结构、环形结构、单元结构 |

本地实现时应把“题材 / 设定筛选”和“镜头表”分开建模。设定器输出一段结构化摘要和提示词，不直接修改脚本镜头行；用户确认后，才把它作为脚本生成输入。

## 4. 脚本 V2 数据模型

### 4.1 节点持久化字段

REA 中的脚本 V2 节点包含两组结构：

```ts
type ScriptV2NodeData = {
  title: string;
  shotColumns: ShotColumnConfig[];
  tableConfig?: {
    columnVisibility?: Record<string, boolean>;
    columnFilters?: Array<{ id: string; value: { operator: "contains" | "equals" | "gt" | "lt"; value: string } }>;
  };
  viewMode?: "table" | "creative" | "asset" | string;
  views?: Array<{ id: string; name: string; type: "table" | "creative" | "asset" }>;
  imageGenConfig?: Record<string, unknown>;
  assets?: ScriptAssets;
  styleDescription?: string;
  originalStoryText?: string;
  theme?: string;
  totalDurationSeconds?: number;
  scriptV2PromptBatchRun?: PromptBatchRun;
  scriptV2PromptBatchRuns?: PromptBatchRun[];
  rows: ScriptV2Shot[];
};
```

镜头行：

```ts
type ScriptV2Shot = {
  id: string;
  shotNumber: number;
  durationSeconds: number;
  plotDescription: string;
  plotDescriptionEntityRefs?: EntityRef[];
  characters?: ScriptCharacter[];
  videoReference?: string;
  cinematics?: {
    shotSize?: string;
    cameraMovement?: string;
    lighting?: string;
  };
  shotSize?: string;
  emotion?: string;
  sceneAssetIds?: string[];
  propTags?: string[];
  propAssetIds?: string[];
  lightingAndAtmosphere?: string;
  audioEffects?: string;
  dialogue?: string;
  dialogueLines?: DialogueLine[];
  voiceover?: string;
  bgm?: string;
  sfx?: string;
  imageGenerationPrompt?: string;
  videoMotionPrompt?: string;
  finalImagePromptEntityRefs?: EntityRef[];
  finalVideoPromptEntityRefs?: EntityRef[];
  imageToVideoMotionPrompt?: string;
  userEditedImageToVideoMotionPrompt?: string;
  imageVersions?: VersionRef[];
  videoVersions?: VersionRef[];
  imagePromptState?: PromptState;
  videoPromptState?: PromptState;
  textHash?: string;
  payloadHash?: string;
  hiddenUuid?: string;
};
```

资产：

```ts
type ScriptAssets = {
  characters: Array<{ id: string; name: string; description?: string; thumbnailUrl?: string }>;
  scenes: Array<{ id: string; name: string; description?: string; thumbnailUrl?: string }>;
  props: Array<{ id: string; name: string; description?: string; thumbnailUrl?: string }>;
};
```

实体引用：

```ts
type EntityRef = {
  assetId: string;
  text: string;
};
```

### 4.2 任务载荷

全量脚本：

- 场景：`script-generate-v2`
- 结果：`result.texts[0]` 为内层 JSON
- 内层必须有 `shots` 数组

提示词重算：

- 场景：`script-recompute-prompts-v2`
- 每次最多 20 个 shot
- 结果要求：
  - `shots[].shot_id`
  - `shots[].image_generation_prompt`
  - `shots[].video_motion_prompt`
  - 可选 `plot_description_entity_refs`
  - 可选 `final_image_prompt_entity_refs`
  - 可选 `final_video_prompt_entity_refs`

资产识别：

- 场景：`recognize-assets-only`
- 不应覆盖已有镜头行和提示词。

任务上下文：

```ts
type ScriptV2TaskContext = {
  version: 1;
  sourceImages: Array<{
    refId: string;
    nodeId: string;
    url: string;
    displayName?: string;
  }>;
  inputTextList?: string[];
};
```

### 4.3 提示词质量门槛

REA 中的校验器可作为本地离线检查参考，不应把具体阈值写成不可配置的硬规则，除非产品明确接受：

- prompt / plot description 长度比不超过 20。
- 分镜提示词建议至少 200 字，推荐上限 400 字。
- 视频运动提示词去空白后至少 350 字。
- 分镜提示词至少包含 8 个不同视觉名词。
- 视频提示词至少包含 3 个运动动词和 1 个时序连接词。
- 相邻重复的资产名称会产生警告。
- 校验失败应重置对应行的提示词状态，不能留下永久“生成中”。

### 4.4 实际脚本 V2 节点形态

当前测试画布中的节点不是只有 `rows`。运行时实例至少包含：

```text
type: script-v2
name: 脚本 V2 1
viewMode: table
action: script_generate
generatorType: default
activeViewId: default
params.scene: script-generate-v2
params.model: aurora-3-prime
params.count: 1
assets.characters: 2 个待创建角色
```

当前镜头行实际字段：

```text
id
shotNumber
durationSeconds
plotDescription
characters
shotSize
emotion
sceneAssetIds
propTags
propAssetIds
lightingAndAtmosphere
audioEffects
dialogue
imageGenerationPrompt
videoMotionPrompt
imageToVideoMotionPrompt
hiddenUuid
textHash
payloadHash
imagePromptState
videoPromptState
dialogueLines
```

这说明 `hiddenUuid`、`textHash`、`payloadHash` 和两类提示词状态是脚本行与分镜 / 任务幂等关联的一部分，不能在本地编辑时每次击键重算或丢失。`params.model` 和 `generatorType` 是实例任务配置，应和镜头内容分开保存。

## 5. 脚本 V2 工作台

### 5.1 字段

| 字段 | 中文 |
| --- | --- |
| `shotNumber` | 镜号 |
| `durationSeconds` | 时长 |
| `plotDescription` | 画面描述 |
| `videoReference` | 视频参考图 |
| `shotSize` | 景别 |
| `emotion` | 表情 |
| `propTags` | 道具 |
| `cinematics.cameraMovement` | 运镜 |
| `lightingAndAtmosphere` | 光影氛围 |
| `audioEffects` | 音效 |
| `dialogueLines` | 对白 / 旁白 |
| `imageGenerationPrompt` | 分镜提示词 |
| `videoMotionPrompt` | 视频提示词 |

默认镜头表实际显示 10 列，顺序固定为：

1. 镜号
2. 时长
3. 画面描述
4. 景别
5. 光影氛围
6. 对白·旁白
7. 音效
8. 运镜
9. 最终提示词
10. 操作

视频参考图、表情、道具、分镜提示词、视频提示词不是默认列，需要通过字段可见性打开。不能把静态字段表中的所有字段都画进首屏。

景别下拉实际包含 12 项：

- 大远景
- 远景
- 全景
- 中远景
- 中景
- 中近景
- 近景
- 特写
- 大特写
- 头肩景
- 半身景
- 全身景

“对白·旁白”打开的是独立对话框，不是简单下拉：

- 空态文案为“空：请点击下方按钮添加”。
- “台词”会增加一条对白行，行内角色选择初始为“未绑定”。
- “旁白”增加旁白内容。
- 确认后通过“保存”写回行。

“光影氛围”打开文本弹窗，占位示例为“例如：日系青春动漫风、戏剧冲突氛围…”。这类单元格采用弹窗编辑器，不应在表格里直接塞入大段 textarea。

### 5.2 三阶段进度

全屏顶部实际只有三步，不是五步：

1. 确认镜头
   - 示例状态为“1 个镜头已就绪”。
   - 可以新增、插入、删除、拖动排序、设置行颜色。
   - 底部按钮为“添加镜头”和“下一步：准备资产”。
2. 准备资产
   - 示例状态为“0/2 已生成、还差 2 个”。
   - 分区为“角色 / 场景 / 道具”，每区都有“新增”。
   - 资产卡状态至少包括“待创建”；右下提示“一键生成所有资产”。
   - 页面上方说明：“点击后可勾选要批量生成的角色 / 场景 / 道具。”
   - 检测到角色没有设定图时，提示可以手动上传或 AI 批量生成。
3. 合成提示词
   - 示例状态为“0/1 已合成”。
   - 表格底部按钮为“一键合成全部提示词”。
   - 每一行显示提示词版本、状态和历史。

“批量生成分镜”和“批量生视频”是脚本节点的浮动工具栏动作，不是第四、第五个阶段标签。全屏顶部同时显示“1/3 完成后可批量生视频”，表示只有资产和提示词门槛满足后才会开放批量动作。

完成三步后：

- “批量生成分镜”创建分镜图组。
- “批量生视频”当前只接受全能参考 / `mixed2video` 路径；缺少资产参考图时会显示逐镜头阻断提示。
- 创建视频生成器前必须满足资产图和提示词都已准备。
- 发布包中存在“停止将不退还已消耗算力”的静态文案；本地任务取消、部分成功和退款语义必须等计费契约确认后再实现。

### 5.3 表格交互

- 拖动行重排镜头。
- 点击时长编辑，建议范围 5–15 秒，失焦保存。
- 点击画面描述编辑，支持 `@` 引用角色、场景、道具。
- 点击景别打开 12 项预设。
- 点击对白打开“台词 / 旁白”编辑器，台词行必须绑定角色。
- 点击光影氛围打开文本弹窗；音效和运镜使用同类单元格编辑器。
- 点击最终提示词图标打开全屏提示词编辑器。
- 行操作菜单支持删除、标红 / 黄 / 绿 / 蓝 / 灰、清除标记。
- 删除行前提示外部引用会一并丢失。
- 发布包静态代码支持字段显示 / 隐藏与按列筛选：筛选运算符为“包含 / 等于 / 大于 / 小于”，可添加多条并“清除全部”；“全部显示”打开所有字段，“全部隐藏”仍保留镜号。
- 发布包静态代码确认三种视图：`脚本视图 / 创意视图 / 资产视图`。脚本节点的主下拉只直接展示脚本视图和创意视图，资产视图通过多视图标签激活；本轮全屏视图没有命中这组工具栏，不能写成“当前入口已可用”。
- 发布包静态代码支持把镜头行、角色列和资产清单导出为带 BOM 的 CSV；本轮脚本全屏的节点工具栏下载按钮为禁用，不能据此判定 CSV 导出已完成用户级验收。
- 支持重新生成脚本，但必须二次确认覆盖当前镜头和最终提示词。
- 删除分镜组、分镜图组和分镜视频组时，发布包提示会一并移除组内节点及与脚本的关联，且无法重新生成关联分镜图或批量视频；本地必须在删除确认中逐项列出影响。

### 5.4 全屏编辑

- 全屏界面实际固定显示：三步进度、关闭按钮、镜头表、底部新增镜头 / 下一步按钮。
- 脚本节点浮动工具栏仍包含：重新生成、批量生成分镜、批量生视频、下载；但当前 1716 × 921 视口下该工具栏的 DOM 位于 `y≈61.5`，被 sticky 表头的 `TH` 覆盖，鼠标命中测试拿到的是“对白·旁白”或“音效”表头。复刻时必须修正层级和命中区域，不能照搬这个遮挡问题。
- 通过 DOM 触发“重新生成”后会出现二次确认：“重新生成会覆盖当前脚本内容及最终提示词”，按钮为“取消 / 开始生成”；本轮只打开并取消，没有触发生成。
- 左侧或上方保留脚本节点入口和阶段进度。
- 中间为镜头表，右侧为当前镜头详情 / 提示词编辑器。
- `ESC` 关闭全屏；全屏内禁用画布级 Undo / Redo，避免误操作其他节点。
- 重新打开应恢复滚动位置、字段可见性和未完成的重算批次。

## 6. 分镜组与分镜编排

### 6.1 普通组和分镜组是两种状态

普通组由空白画布的快捷操作或 `⌘G` 创建。Shift 点击可以多选，普通组工具栏当前实际可见：

- 整组执行
- 添加到我的预设
- 转分镜组
- 解组
- 下载

把普通组转为分镜组后，工具栏替换为分镜能力：

- 画幅：`21:9`、`16:9`、`4:3`、`1:1`、`3:4`、`9:16`
- 宫格：`2×2`、`3×3`、`4×4`、`5×5`、自定义
- 自定义宫格是 5×5 点阵选择器，最多 25 格
- 拼接：`2K` / `4K`
- 显示 / 隐藏镜号
- 清空
- 转普通组
- 解组

未额外选择宫格时，普通组转为分镜组会生成 `2×2` 四个空白单元。该行为是运行时确认，不是根据静态布局字段推断。

### 6.2 数据模型

发布包中的分镜组结构可以抽象为：

```ts
type StoryboardGroupData = {
  childNodeIds: string[];
  sourceScriptNodeId?: string;
  sourceScriptVersion?: "v1" | "v2";
  sourceImageGroupId?: string;
  storyboardSourceRowHiddenUuids?: string[];
  storyboardGroupType?: "image" | "video";
  groupLayoutMode?: "vertical" | "horizontal" | "grid" | "script-storyboard-grid";
  manualCols?: number;
  autoResizeToChildren?: boolean;
  autoResizePadding?: number;
  standaloneStoryboardImageGrid?: boolean;
  showShotNumbers?: boolean;
};
```

静态确认的约束：

- 组内节点最多 25 个。
- 分镜组只接受图片节点。
- `manualCols` 最大为 5。
- 节点间距约 40，网格外边距约 80。
- `script-storyboard-grid` 是脚本镜头投影到分镜组时的专用布局，不等同于普通网格。
- `standaloneStoryboardImageGrid` 用于独立分镜图组，不能和普通组布局共用一套状态。
- `sourceScriptNodeId` 标识来源脚本，`sourceScriptVersion` 区分旧脚本和 V2；两者必须同时保存。
- 图片节点通过 `scriptRowHiddenUuid` 映射脚本行，分镜组用 `storyboardSourceRowHiddenUuids` 保存当前投影集合。
- 删除分镜图片时，发布包会同步更新组内 `childNodeIds` 和 `storyboardSourceRowHiddenUuids`；本地删除也必须原子更新三者，避免留下幽灵映射。

### 6.3 脚本与分镜组的关联

- 批量生成分镜图时，脚本行 ID 与分镜图片节点保持稳定映射。
- 脚本新增、删除或重排镜头后，旧分镜组不能静默沿用旧序号。
- 旧分镜组需要提示“解除关联”或“重新绑定”，由用户确认后再更新。
- 分镜组内的图片用于首帧或多图参考；批量生视频前必须确认每张图仍属于当前镜头。
- 删除分镜组时必须区分图片组、视频组和混合组的实际移除范围；发布包对旧脚本分支有单独的二次提示，不能只显示通用“删除节点”。
- “清空”和解组对子节点、脚本行、最终提示词的实际影响尚未运行时确认。本地实现前必须先做一次可恢复测试，并在确认框中逐项写明会删除什么、保留什么。

### 6.4 画布快捷操作

运行时已确认的快捷键：

| 快捷键 | 行为 |
| --- | --- |
| `⌘G` | 创建普通组 |
| `⌘⌥G` | 合并分镜组 |
| `⇧⌘G` | 解组 |
| `L` | 进入连线模式 |
| `⌘D` | 创建副本 |
| `Enter` | 生成 |
| `Tab` | 新建节点 |
| Option + 拖动 | 复制 |
| `⌘Option + 拖动` | 创建副本 |
| `0` | 适应画布 |
| `⌘Z` | 撤销 |
| `⇧⌘Z` | 重做 |
| `F` | 节点搜索 |

注意：`⌘D` 在只选中一个脚本相关节点时曾复制出关联图片和脚本两个节点，因此本地实现不能把它简单写成“单节点副本”，必须先定义关联节点的复制边界。

### 6.5 右键菜单边界

画布空白右键实际只出现：

- 复制 `⌘C`
- 剪切 `⌘X`
- 粘贴 `⌘V`
- 全选 `⌘A`

图片节点右键实际出现：

- 保存到我的资产
- 创建主体
- 下载
- 复制节点 `⌘C`
- 创建副本 `⌘D`
- 粘贴 `⌘V`
- 删除 `⌫`
- 复制到剪贴板

脚本节点右键也命中同一组节点菜单，没有运行时确认到独立脚本菜单。因此本地不能在脚本节点右键新增未经逆向确认的复杂菜单。

## 7. Agent Skill 多选与资源页

### 7.1 运行时行为

在 `/skill` 页面实际验证：

- 页面有三个顶层标签：“Skill / 收藏 / 我的”。
- Skill 分类为：“推荐 / 专业影视 / 商业广告 / 短剧漫剧 / 动漫游戏 / 音乐MV / 自媒体创作 / 通用技能 / 发现”。
- 搜索框占位为“搜索 Skill”，搜索按钮与输入框同一行。
- 可以同时选择多个 Skill，并在主输入卡中显示多个标签。
- 重复添加同一个 Skill 会追加重复标签，这是 LibTV 当前行为，不应照搬。
- 在输入框末尾按 `Backspace` 可以删除最后一个 Skill 标签。
- “收藏”和“我的”两个分类当前均为空态，文案为“暂无 Skill”。
- 搜索“狼人”可以筛出“一键海外狼人吸血鬼短剧”。
- 当前保留的两个标签为“爆款拉片复刻”和“新中式美学TVC”。
- Skill 卡片结构为：类型图标、`类型 / slug` 路径、标题、一句话描述、作者、使用数、收藏按钮和“使用”按钮。
- 卡片网格是三列，卡片约 455 × 129；页面内容总高度超过 2,400px，首屏只露出前两行。

视觉基线：

| 元素 | 运行时尺寸 / 样式 |
| --- | --- |
| 主标题 | 24px，宋体类衬线字体，行高 40px |
| 主输入卡 | 860 × 136，`#212121`，边框 `#363636`，圆角 16px |
| 可编辑输入区 | 834 × 34，14px / 24px |
| Skill 卡片 | 455 × 129，圆角 16px，三列网格 |
| Skill 选择器 | 450 × 400，`#171717`，边框 `#363636`，圆角 12px |

### 7.2 本地已有能力

本地已经实现：

- `web/src/stores/use-agent-skill-store.ts` 使用 `selectedSkills` 保存多选。
- 选择相同 `name + path` 的 Skill 时不会重复追加。
- `setSelectedSkills` 会再次去重。
- 本地 Skill 收藏使用独立 store，并通过 BroadcastChannel 同步多标签页。
- Agent 消息元数据和请求体保存全部 Skill。
- `AgentSkillInstallModal` 已支持 GitHub 搜索、预览、内容哈希校验和安装。
- `AgentSkillResources` 已支持文本资源文件列表、创建、编辑、删除和 revision 冲突保护。

因此这一块不是“从零实现多选”，而是：

- 对齐 LibTV 的标签视觉和删除交互。
- 保留本地去重，不复制 LibTV 的重复标签缺陷。
- 补齐收藏 / 我的空态、分类计数和搜索结果密度。
- 对真实 GitHub 网络安装做独立验收，不把本地 mock 通过写成线上已验收。

### 7.3 不直接复用的部分

- 不复制 LibTV 的 Skill 名称、图标、作者信息和卡片图片。
- 不把 LibTV Skill 的提示词内容写入本地目录。
- 不把远端 Skill 直接执行；安装前仍要展示来源、路径、内容摘要和哈希。
- 不绕过本地 Agent 的路径穿越、文件大小、符号链接和 revision 校验。

## 8. MCP / CLI 插件接入

### 8.1 LibTV 当前插件矩阵

运行时页面确认：

| 分组 | 选项 |
| --- | --- |
| Agent | OpenAI、Claude、Claude Code、OpenClaw、Hermes、CodeBuddy |
| 接入方式 | MCP、CLI |

不同 Agent 和接入方式会替换整段说明、命令和状态区，不是静态装饰。

### 8.2 已验证的接入文案

运行时逐项切换后，接入面板的 12 个组合都能刷新步骤说明。当前文案分为两类：

| Agent + 方式 | 面板行为 |
| --- | --- |
| OpenAI + MCP | 使用 Codex Plugin marketplace 和 `codex plugin add` |
| OpenAI + CLI | 使用通用 LibTV CLI 安装包、配套 Skill 和 `libtv login` |
| Claude / Claude Code / OpenClaw / Hermes / CodeBuddy + MCP | 新建名为 LibTV 的连接器，填入 `https://mcp.liblib.tv/mcp`，再完成账户授权 |
| 任意 Agent + CLI | 使用同一 CLI 安装包、安装配套 Skill，再执行 `libtv login` |

OpenAI + MCP：

```text
codex plugin marketplace add https://github.com/liblib-ai/marketplace.git --ref main
codex plugin add libtv@libtv
```

通用 CLI（CodeBuddy 文案把 Agent 名称替换为 CodeBuddy）：

```text
1. https://liblibai-web-static.liblib.cloud/cli/1.2.0/libtv-cli-skill.zip
2. 安装 CLI 和配套 Skill
3. libtv login
```

接入面板的固定结构：

1. 第一步“复制并发送以下内容给你的 Agent / Claude / CodeBuddy”，下面是一段可复制的指令、目标 Agent 名称和一个“复制”按钮。
2. 第二步“连接账户，开始创作”，说明授权或登录后可以生成图片、视频和整理素材。
3. 切换 Agent 只替换 Agent 名称和相关命令，不抹掉步骤编号。
4. MCP / CLI 是互斥分段控件，不是两个同时显示的安装区块。

插件页的其他固定区块：

- 标题“LibTV Plugin，让你的 Agent 开始创作”。
- “使用指南”外链。
- “看看 LibTV Plugin 能做什么”。
- 案例导航“全模型调用生成 / 多资产管理提案 / 可控多场景生成”。
- 自动播放的案例演示和“重新播放演示”。
- 底部“让 LibTV Plugin 进入你的 Agent 工作流”的 Canvas 动画区。

MCP OAuth 静态确认：

- 入口：`/mcp/authorize`
- 客户端类型：`codex`、`chatgpt`、`generic`
- 端点：`https://mcp.liblib.tv`
- 权限：
  - `libtv:account:read`
  - `libtv:project:read`
  - `libtv:project:write`
  - `libtv:media:write`
  - `libtv:task:write`
  - `libtv:export:write`

这些是 LibTV 的服务端接入契约证据，不是本地项目可以直接实现的接口。本轮只把它们转换成“接入面板信息架构”的参考，不在本地首次请求 LibTV 服务，不保存 LibTV OAuth 凭证，也不调用其任务接口。

### 8.3 本地插件中心现状

本地 `pluginHub` 当前只提供：

- Codex
- Claude Code
- Codex 的 Plugin / CLI 两种方式

已有能力：

- 独立插件页面与画布插件管理弹窗共用安装、更新、启停和卸载逻辑。
- 官方、本地、第三方插件目录。
- 插件完整性提示和真实 Agent 连接状态。
- 移动端 40px 操作区与无横向溢出验收。

本地不能为了视觉对齐而伪造 OpenClaw、Hermes、CodeBuddy 的可执行安装命令。建议改成配置驱动目标列表：

```ts
type AgentIntegrationTarget = {
  id: string;
  label: string;
  modes: Array<"mcp" | "cli">;
  status: "available" | "planned";
  command?: string;
  steps?: string[];
  scopes?: string[];
};
```

有真实本地适配器的目标显示可复制命令；没有适配器的目标只显示“计划中”，不出现可执行按钮。

### 8.4 安全边界

- 只允许 HTTPS 来源。
- 命令中不拼接 Token，不把 OAuth 授权码写入日志。
- 不把 LibTV MCP 端点写死成本地默认端点。
- 权限范围要显示为申请内容，不能默认全部勾选或静默扩大。
- 插件安装继续校验来源、版本、完整性和兼容性。
- 不把“页面能显示某个 Agent”写成“本地已经支持该 Agent”。

## 9. 3D-BOX 数据模型与编辑器

### 9.1 运行时结构

3D-BOX 实际分成首页和编辑器两条路径：

- `/3d-box`：首页，主标题“LibTV 3D-BOX · 你的专业影视空间”，副标题“Agent 轻松搭景，精准调度站位，手绘轨迹实现大片级运镜”。
- `/animation-preview?projectId=...`：编辑器，示例项目为“【官方示例】古代街景一镜到底”。

首页输入卡：

- 提示词占位：“描述场景、人物动作和镜头怎么动，AI 帮你生成 3D 动画预演”。
- 模型按钮：“模型选择: DeepSeek V4.1 Flash 1017”。
- 比例：“画面比例: 16:9”。
- 时长：“时长: 自动”。
- 三条示例提示词，分别是城市追车、香水瓶环绕产品广告、古装庭院对峙。
- “我的 3D-BOX”区有“新建空白 3D-BOX”和官方示例项目卡。

编辑器实际观察到：

- 顶部为项目菜单、项目标题、“收起”；左侧为“收起项目资产”；上方有“分享 3D-BOX”和“导出”。
- 中央是“监视器”，可切换“俯视图 / 进入机位”，并有“进入俯视图 / 定位机位 / 进入机位”操作。
- 右侧是“场景检查器”，内部再分“项目资产”和“元素状态”。
- 资产树实际包含“灰色飞羽_1 / 深灰翼带_2 / 深灰翼带_3”，以及“15秒连续预演_·_唯一相机 / Path_15秒连续预演_·_唯一相机 / Aim_15秒连续预演_·_唯一相机 / Focus_15秒连续预演_·_唯一相机 / WP_1”到 `WP_11`。
- 场景组件实际收到 `ArrayBuffer` 型 GLB，字节数为 `3,890,196`；同时带有 `sceneVersion` 和世界设置 `{ type: "solid", color: [0.22, 0.24, 0.27], strength: 2 }`。官方示例不是纯程序化方块场景。
- 场景树约 81,988px 高，使用虚拟滚动。
- 相机父节点、Path 和 WP 都显示同一套 Transform 检查器。
- Transform 字段为位置 X/Y/Z、缩放 X/Y/Z、旋转 X/Y/Z，步长 0.1。
- 修改位置 X 后可以使用撤销恢复。
- 添加立方体后场景树出现“立方体 1”，撤销后消失。
- “场景调度 / 成片预演”是互斥模式，运行时都会保留时间轴但内容不同：
  - 场景调度：左侧保留项目资产和 Transform 检查器，时间轴只显示播放进度。
  - 成片预演：项目资产和检查器收起，时间轴出现“镜头片段”，当前示例为唯一相机 `00:15`。
- 当前时间轴约 1716 × 83，提供播放、速度、`00:00 / 00:15`、0–15 秒刻度、播放进度和时间轴缩放；能看到片段和时间轴，不等于已经确认关键帧新增、拖动或删除。
- 画布右上还有视窗操作：关闭时间轴、截取当前视窗、项目画幅比、撤销、重做。
- 画布底部是 Agent 输入表单，占位为“选中一个元素或机位，描述如何调整…”，并显示当前选中元素标签；按钮为“生成场景”。
- 两条列宽分隔线分别标记为“调整监视器栏宽度”和“调整项目资产栏宽度”；检查器内部还有“调整项目资产列表高度”。

添加元素菜单：

- 球体
- 立方体
- 棱锥
- 太阳光
- 点光源
- 聚光灯
- 机位
- 导入 GLB

视觉基线：

| 元素 | 运行时尺寸 / 样式 |
| --- | --- |
| 场景调度 / 成片预演工具栏 | 224 × 48，顶部居中 |
| 右侧检查器 | 240 × 790，`#111111` |
| 底部生成输入 | 320 × 48，`#1f1f1f`，圆角 24px |

静态发布包还确认：

- GLB 导入限制为 100 MB，格式必须为 GLB 2。
- 本地预演版本在浏览器最多保留 30 天，重要内容要导出 GLB 备份。
- 编辑器“成片预演”支持导出视频和转交画布。
- 3D 发布包还包含自动帧、变换 / 姿态 / 道具 / 分组 / 机位关键帧、四类动画轨道和贝塞尔速度曲线词条。
- 运动路径包含自由绘制、铅笔、钢笔、圆环、矩形和直线的静态入口。
- 视频片段层包含源入点、源出点、播放倍率、层级、反向、循环、锁定、复制和分割词条。
- 手机虚拟相机支持同 Wi-Fi 扫码连接；高斯泼溅包含地面检测、重新检测和高 / 标准 / 流畅画质分级。
- 导出项包含视频帧率；编辑器还包含录制画布并导出到画布的能力。

### 9.2 静态数据模型

发布包中确认到相机、动画轨道、关键帧和环境字段：

```ts
type BoxCamera = {
  fov?: number;
  position: Vector3;
  quaternion?: Quaternion;
  lookAtTarget?: string;
  followTargetId?: string;
  zoom?: number;
};

type BoxAnimation = {
  duration: number;
  characterTracks: BoxTrack[];
  propTracks: BoxTrack[];
  cameraTracks: BoxCameraTrack[];
  groupTracks: BoxTrack[];
  motionPaths: BoxMotionPath[];
  activeCameraTrackId?: string;
};

type BoxCameraKeyframe = {
  time: number;
  position: Vector3;
  quaternion?: Quaternion;
  lookAt?: Vector3;
  fov?: number;
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut" | "smooth" | "custom";
};

type BoxEnvironment = {
  panoramaUrl?: string;
  gaussianSplatUrl?: string;
  skyColor?: string;
  groundVisible?: boolean;
  groundOpacity?: number;
  groundHeight?: number;
  panoramaRotationY?: number;
  panoramaRadius?: number;
  sceneScale?: number;
  sceneTranslation?: Vector3;
  sceneRotation?: Vector3;
};

type BoxClip = {
  sourceIn: number;
  sourceOut: number;
  playRate: number;
  layer: number;
  reverse: boolean;
  loop: boolean;
  locked: boolean;
};
```

静态确认的相机默认值与范围：

- 默认 FOV 为 50。
- FOV 输入范围为 15–90 度。
- 默认 zoom 为 1。
- 动画时长为 1–15 秒，默认 10 秒。
- 运动路径最多约 120 个点。
- 默认环境天空色为 `#060608`，地面可见，透明度 0.4，高度 0，全景旋转 0，全景半径 60，场景缩放 3。

相机预设 14 个：

| ID | 显示名 | FOV |
| --- | --- | --- |
| `front_medium` | 正面中景 | 50 |
| `front_closeup` | 正面特写 | 35 |
| `front_wide` | 正面全景 | 60 |
| `side_tracking` | 侧面跟拍 | 50 |
| `side_close` | 侧面近景 | 40 |
| `back_medium` | 背面中景 | 50 |
| `top_wide` | 俯拍全景 | 55 |
| `top_45` | 45° 俯拍 | 50 |
| `low_angle` | 低角度仰拍 | 45 |
| `low_wide` | 低角度广角 | 70 |
| `over_shoulder_l` | 过肩镜头 | 50 |
| `over_shoulder_r` | 过肩镜头（右） | 50 |
| `birdseye` | 鸟瞰 | 60 |
| `dutch` | 荷兰角 | 50 |

场景预设 9 个：

- 空白场景：纯网格 + 默认机位。
- 对话双人：2 人面对面 + 中景机位。
- 三人对话：3 人三角站位 + 全景机位。
- 采访场景：1 主持 + 1 嘉宾 + 桌子 + 双机位。
- 独白特写：1 人 + 特写正面机位。
- 课堂/演讲：1 讲者 + 3 听众。
- 追逐场景：2 人前后 + 侧面跟拍 + 低角度。
- 户外行走：2 人并排 + 侧面跟拍。
- 会议室：4 人围桌 + 俯拍机位。

静态高级能力矩阵：

| 能力 | 静态证据 | 当前运行时边界 |
| --- | --- | --- |
| 自动帧 | `directorTimelineAutoKeyframe` | 未在当前示例命中开关 |
| 变换 / 姿态 / 道具 / 分组 / 机位关键帧 | 五类关键帧词条和数据结构 | 未验证新增、拖动、删除 |
| 机位 / 角色 / 道具 / 分组轨 | 四类轨道词条和模型字段 | 当前示例只显示唯一机位片段 |
| 自由绘制 / 铅笔 / 钢笔 / 圆环 / 矩形 / 直线路径 | 路径入口和中英文词条 | 未验证绘制、点序和上限 |
| 贝塞尔速度曲线 | 曲线编辑器、线性 / 缓入 / 缓出词条 | 未验证轨道选择和曲线编辑 |
| 片段分割 / 复制 / 锁定 / 反向 / 循环 / 播放倍率 | `BoxClip` 相关词条 | 只验证了片段可见与选中 |
| 手机虚拟相机 | 同 Wi-Fi 扫码连接词条 | 未执行配对 |
| Gaussian Splat | 地面检测、质量分级、上传和加载状态 | 未加载真实 PLY / SPZ |
| 视频导出 | 帧率、导出视频和转交画布词条 | 未执行导出 |
| 画布录制 | 录制画布并导出到画布词条 | 未执行录制 |

### 9.3 已确认与未确认

已运行时确认：

- 场景树、虚拟滚动
- 官方示例加载约 3.89 MB 的 GLB，并应用纯色世界背景和高强度光照设置
- Transform 检查器
- 添加元素
- 撤销
- 场景调度 / 成片预演切换
- 0–15 秒时间轴、播放 / 暂停、倍速、进度滑块、时间轴缩放
- 成片预演模式出现唯一相机 `00:15` 镜头片段，选中后底部输入绑定到 `0–15s`
- 底部生成输入

仅静态确认：

- 相机 FOV 和预设
- 自动帧、五类关键帧、四类轨道和 easing
- 运动路径绘制方式和约 120 点上限
- 贝塞尔速度曲线
- 片段源入点 / 源出点、层级、倍率、反向、循环、锁定、复制和分割
- 手机虚拟相机扫码配对
- 全景 URL、Gaussian Splat URL
- 高斯地面检测、质量分级和加载状态
- 地面透明度、高度、旋转和场景缩放
- 视频导出帧率和画布录制回写

未运行时确认：

- 当前检查器是否暴露 FOV、焦距、景深或视场角
- 时间轴是否可由用户新增、拖动和删除关键帧
- GLB 导入后的材质、骨骼、内置动画、Draco / Meshopt 压缩和资源释放
- Path / Aim / Focus 是否支持独立编辑和曲线插值
- 片段分割、复制、锁定、反向和循环是否会真实修改导出结果
- 手机虚拟相机在同 Wi-Fi、权限拒绝和断线重连下的行为
- Gaussian Splat 的真实加载、性能和浏览器兼容性

本地不能因为静态字段存在就声称这些能力已经可用。检查器当前只能把 Transform 作为已确认基线，其他字段必须逐项运行时验证。

### 9.4 本地现状

本地 `DirectorProjectState` 目前只有：

- `camera.position`
- `camera.target`
- `objects`
- `background`

对象仅支持 `box`、`sphere`、`cylinder`、`cone`，不是 LibTV 的完整场景树、灯光、机位、Path、GLB、材质和关键帧系统。3D-BOX 首页也只是从画布项目筛选出带 `director` 的项目卡片。

因此 3D-BOX 要分成两层：

- 先完成独立项目首页、项目卡片和可打开的真实项目路径。
- 再扩展编辑器数据模型和检查器，不把首页视觉完成误写成 WebGL 编辑器完成。

## 10. 本地现状与差距

本节只描述当前工作树中已经存在的实现，不把计划中的文件当成已完成代码。

| 领域 | 当前本地实现 | 与 LibTV 的差距 | 优先级 |
| --- | --- | --- | --- |
| 画布顶部 | 已有浮动控制带、32px 按钮和 48px 顶栏 | 需要更严格的三簇布局和 1024 / 768 / 390px 降级 | P1 |
| 底部 dock | 已有分组 dock | 需要精确到 338×49、32px 按钮和低频菜单 | P1 |
| 空态快捷入口 | 图片、视频、音频、文本、智能剪辑 | 已新增脚本节点入口，但仍需验证是否与 LibTV 的脚本二级菜单一致 | P1 |
| 添加节点 | 已有文本 / 图片 / 视频 / 音频 / 脚本等基础入口 | 没有搜索节点、脚本旧版 Beta、风格节点、特效节点和统一的“添加资源”分组 | P1 |
| 节点注册表 | 本地只接入当前功能需要的基础节点 | LibTV 运行时注册 22 种类型；不能一次补全所有入口，只对已经有真实编辑器和任务路径的节点开放 | P1 |
| 素材库 / 全部功能 | 已有素材选择和少量图片编辑能力 | 没有风格库、特效库、视频编辑 14 项和图片编辑 16 项的完整目录 | P2 |
| 角色造型室 | 未发现对应入口 | 需要我的 / 官方角色库、性别 / 年龄 / 文化区域筛选、列表 / 宫格、多选和新建角色 | P2 |
| 资产库 / 生成历史 | 已有项目资产选择和图片选择器 | 没有“生成历史 / 我保存的 / 我上传的”、本项目 / 全部项目和视图管理 | P1 |
| 故事板 | `CanvasStoryboardWorkbench` 已实现，受 `storyboardWorkbench` 默认关闭开关控制 | 需要人工长列表、真实触控和真实软键盘验收 | P1 |
| 脚本节点 | `CanvasNodeType.Script` 和 `CanvasScriptV2` 已加入 | 字段、资产、提示词、分镜和批量任务还不完整 | P0 |
| 剧本设定器 | 未发现对应入口 | 没有三模式入口、Top 8 预设、15 类题材、融合题材、6 类受限设定和结构化摘要 | P1 |
| 镜头表 | 已支持主题、画幅、风格、原始故事、完整高级字段、12 项景别预设、字段显隐、三视图、行颜色、插入、复制、拖动排序、列筛选、详情内撤销/重做，以及最终提示词本地合成、状态和版本恢复 | 仍缺少脚本级版本快照和接入真实生成任务后的重新生成覆盖确认 | P0 |
| 阶段工作台 | 本地界面已有五个阶段标签 | LibTV 运行时只有“确认镜头 / 准备资产 / 合成提示词”三步，批量生成分镜和批量生视频是浮动动作；本地五段式需要收敛或明确为批次动作 | P0 |
| 资产库 | 故事板按全部 / 角色 / 场景 / 物品 / 其他分类，支持搜索、批量选择和详情 | 没有角色 / 场景 / 道具资产实体、参考图绑定、资产生成状态和合规状态 | P1 |
| 分镜组 | 已实现按脚本创建 25 格上限图片节点组、2–5 列、六种画幅、镜号显隐、设置重应用、脚本变化后的重新绑定、清空和转普通组 | 仍缺少自定义 5×5 点阵、2K / 4K 拼接、详情内解组、真实逐镜头任务状态和批量视频生成 | P0 |
| 批量阶段 | 已有通用批量生成基础 | 没有按镜头批量准备资产、合成提示词、生成分镜和生成视频的状态机 | P1 |
| Agent | 工作流右侧抽屉、故事板左侧工作台已存在；支持多 Skill 和 GitHub 安装 | 需要对齐 400×640 浮层、历史 / 设置密度和真实 Claude 验收 | P2 |
| 插件 | `pluginHub` 已有独立页面，支持 Codex 和 Claude Code | 需要配置驱动的 Agent 目标列表、MCP / CLI 说明和更多计划中目标 | P2 |
| Agent / Skill | 已有分类、搜索、收藏、来源筛选、Skill 安装和资源编辑 | 需要对齐 LibTV 的三列卡片、标签多选、空态和输入卡密度 | P2 |
| 3D-BOX | 已有独立首页和项目卡，导演台支持基础对象、相机、背景、保存和截图；`director3d` 默认关闭 | 没有完整场景树、灯光、机位层级、FOV、关键帧、Path、GLB、片段时间轴和影棚环境；LibTV 示例已实际加载约 3.89 MB GLB | P2 |
| 3D-BOX 预设 | 未发现 14 个相机预设和 9 个场景预设 | 需要补齐预设数据层和检查器，不先做关键帧编辑器 | P2 |
| 云端分享 / 同步 | 未实现，只能使用浏览器本地数据 | 公共分享、云项目、版本历史和跨设备同步仍依赖服务端契约 | P3 |

### 10.1 本地实现准确边界

- 当前 `CanvasScriptV2` 的持久化字段只有 `version`、`theme`、`aspectRatio`、`styleDescription`、`originalStoryText` 和 `rows`。
- 当前镜头行是基础扁平结构，没有 `assets`、`tableConfig`、`viewMode`、`views`、`cinematics.cameraMovement`、提示词状态、版本引用和实体引用。
- 当前没有 `sourceScriptVersion`、`storyboardSourceRowHiddenUuids`、`scriptRowHiddenUuid`、`textHash` 和 `payloadHash` 这一整套脚本 / 分镜 / 任务关联字段。
- 当前脚本全屏的五个阶段标签已经存在，但它们只是展示；LibTV 的三阶段数据流、资产生成状态、提示词批量合成和批量视频门槛都还没有实现。
- 当前故事板工作台已有资产库、分类、搜索、详情、前进后退和定位回画布，但不能把 `storyboardWorkbench` 的开关关闭状态误写成生产默认可用。
- 当前 Agent 多 Skill 的 store 已去重；`AgentSkillInstallModal` 已有 GitHub 搜索、预览和内容哈希校验。还需要真实网络、真实 Agent 连接和用户级人工验收。
- 当前插件中心只支持 Codex 和 Claude Code，不应把页面静态文案扩展成未实现的 Agent 能力。
- 当前 3D 项目状态只有相机位置 / 目标、四类基础对象和背景；LibTV 的 3D-BOX 已经能加载 GLB、显示场景树和唯一机位片段，但关键帧、四类轨道、路径和速度曲线仍只属于静态确认能力。
- 当前没有角色造型室、风格/特效库和跨项目生成历史；这些入口即使补 UI，也必须先定义本地数据实体和任务边界。

## 11. 分阶段实施计划

### Stage 0：证据冻结与回归基线

状态：本轮执行中，计划文档收口后完成。

- 保留当前工作树所有用户已有改动，不执行 reset、clean 或强推。
- 记录 `git status` 和当前分支，避免把其他未提交功能混入本任务。
- 保留本计划的证据等级：运行时确认、静态确认、未验证。
- 以 `script-v2`、故事板投影、feature flag 和 3D project 归一化函数为纯逻辑测试边界。
- 任何真实生成、供应商调用、分享、计费和云同步都不在 Stage 0-2 内。

验收：

- 计划文档自身通过 `git diff --check`。
- 没有改动本计划之外的业务文件。
- 现有测试基线与新增 Undo、刷新和空数据检查可重复执行。

### Stage 1：故事板工作台收口

状态：已实现，受 `storyboardWorkbench` 默认关闭开关控制；等待人工长列表和真机验收。

- 保留 `buildStoryboardProjection` 作为节点到素材的只读投影。
- 资产库固定分类为“全部 / 角色 / 场景 / 物品 / 其他”。
- 详情面板支持图片、视频、音频、文本和 Script V2。
- 故事板不渲染工作流 dock、空态快捷入口和节点工具条。
- 移动端详情改为覆盖层或抽屉，避免 390px 横向溢出。
- 选中素材后“处理到画布”只返回对应节点，不自动触发生成。

验收：

- 空画布显示空资产库。
- 新增图片、视频、音频、文本和脚本节点后，故事板立即出现对应素材。
- 搜索覆盖标题、内容、提示词、模型和分组上下文。
- 分类、多选、批量操作、前进后退和定位回画布可用。
- 100+ 素材下滚动和搜索不出现明显卡顿。

### Stage 2：脚本 V2 镜头表基础能力

状态：基础交互已完成；字段菜单、12 项景别预设、筛选、颜色、三视图、插入、复制、拖动排序和详情内撤销/重做已实现。脚本重新生成需要先接入真实生成任务，完整画布级撤销边界仍待补齐。

- 保持脚本节点为真实 `CanvasNodeType.Script`，不再创建 Text 代替。
- 支持主题、画幅、风格、原始故事和至少一条镜头。
- 支持新增、插入、删除、排序、时长、景别、情绪、画面描述、对白、光影、音效、分镜提示词和视频提示词。
- 默认列按“镜号 / 时长 / 画面描述 / 景别 / 光影氛围 / 对白·旁白 / 音效 / 运镜 / 最终提示词 / 操作”排列；视频参考、表情、道具和两类原始提示词通过字段菜单开启。
- 字段编辑使用本地 draft + 失焦提交，避免每次击键都写入全画布历史。
- 增加行颜色、字段显隐、全部显示 / 全部隐藏和列筛选。
- 增加“脚本视图 / 创意视图 / 资产视图”三种视图状态。
- 增加重新生成二次确认，明确会覆盖镜头和最终提示词。
- 保留 `hiddenUuid`、`textHash`、`payloadHash` 和提示词状态；编辑镜头时只更新受影响字段，不能整体重算这些关联键。

验收：

- 刷新后镜头、字段、时长、颜色和当前视图保持。
- 至少一条有效镜头才能进入下一阶段。
- 删除行前确认外部引用影响，撤销可恢复。
- 脚本节点可在工作流与故事板中互相定位。
- 任何筛选、拖动和编辑不会改变节点 ID 或分镜映射。

### Stage 2.5：TV Director 与剧本设定器

这一阶段只做结构化创作输入，不直接生成付费内容。

- 保留 TV Director 的“剧本原创 / 剧本改编 / 导演执导”三模式。
- 增加全局设置的本地等价项：协作模式、预算提醒阈值、浏览器通知和声音；人像安全协议只做说明，不伪造平台签署状态。
- 实现独立剧本设定器 Modal，不塞进脚本表格。
- 支持 15 类题材、融合题材、自定义题材、Top 8 预设和重置。
- 按运行时上限实现受众 2 项、角色 5 项、时代 2 项、看点 3 项、画风单选、集数和叙事结构。
- 确认后输出结构化摘要与生成提示词，由用户再次提交；不能自动调用真实模型。

验收：

- 关闭后再次打开保留当前草稿，取消不会污染脚本。
- 各多选项达到上限后不能继续添加，并提供明确提示。
- Top 8 预设只填充设定，不直接覆盖已有镜头。
- 1440 / 1024 / 390px 下 Modal 可滚动，无横向溢出。

### Stage 3：资产准备与提示词合成

状态：最终提示词编辑器、本地合成、状态校验、单镜头版本历史、角色 / 场景 / 道具本地实体、镜头标签同步、手动新增和“我的素材”参考图绑定已完成；模型生成、模型驱动的批量合成和提示词中的实体引用仍待实现。当前“合成全部提示词”只使用已保存的镜头字段，不调用模型。

- 角色、场景、道具三类本地资产实体已完成；可从镜头角色/道具标签同步或手动新增。
- “我的素材”图片参考图绑定、替换、解绑和引用标题已完成；画布节点直接绑定仍待实现。
- 当前已有待创建/已就绪本地状态；生成中、合规通过和合规失败需要真实生成与审核路径后再增加。
- 增加“一键生成所有资产”和“合成全部提示词”，但默认使用 mock / 未配置渠道 / 用户明确授权的零收费路径。
- 增加提示词编辑器、实体引用、本地校验、版本历史和状态恢复。
- 资产未准备或提示词未完成时，批量视频入口必须禁用并显示原因。

验收：

- 资产生成中途刷新不会留下永久“生成中”。
- 校验失败不会覆盖已有有效提示词。
- 同一镜头可以查看历史版本并恢复。
- 脚本行与资产 ID、实体引用和最终提示词保持一致。

### Stage 4：分镜组与批量生成

状态：首个增量已完成。脚本到分镜图片节点组、25 格上限、2–5 列、六种画幅、镜号显隐、设置重应用、脚本变化后的重新绑定、节点映射损坏提示、锁定保护、组连线保留、普通删除/解组后的元数据隔离、复制隔离、清空、转普通组和节点映射测试已完成；2K / 4K 拼接、自定义 5×5 点阵、详情内解组、真实逐镜头任务、部分失败恢复和批量视频生成仍待实现。

- 实现 `script-storyboard-grid`，按脚本镜头生成图片节点组。
- 支持 25 格上限、画幅、2×2 到 5×5、自定义点阵和手动列数。
- 支持显示 / 隐藏镜号、2K / 4K 拼接、清空、转普通组和解组。
- 脚本新增、删除、重排后提示重新绑定，不静默复用旧节点。
- 批量视频前检查分镜图、资产图、提示词和视频模型能力。
- 生成任务要有稳定 idempotency key，刷新或重复点击不能创建重复任务。

验收：

- 分镜组与镜头 ID 映射稳定。
- 25 镜布局在 1440px 和 1024px 下可用。
- 取消、失败、部分成功和刷新恢复都有逐镜头状态。
- 拼接 2K / 4K 不改变原始图片节点。

### Stage 5：Skill 与插件页面视觉和功能收口

- 保留本地 Skill 多选去重，不复制 LibTV 的重复标签行为。
- 对齐多标签输入卡、退格删除、分类行、三列 Skill 卡片、收藏 / 我的空态和搜索。
- 将插件页改为配置驱动 Agent 目标；已接入目标显示可执行命令，未接入目标显示“计划中”。
- 保留 Codex Plugin / CLI、Claude Code MCP 的现有真实命令。
- 增加 MCP 权限范围展示、来源说明和连接状态，但不硬编码 LibTV OAuth 端点。
- 远端 Skill 安装继续执行 HTTPS、唯一 SKILL.md、内容哈希、大小和路径校验。

验收：

- 同一 Skill 不会重复插入标签。
- 删除任意标签后消息发送内容同步更新。
- 1440 / 1024 / 390px 无横向溢出。
- 没有真实适配器的 Agent 不会出现可执行安装按钮。
- 插件完整性校验、启停、更新和卸载回归通过。

### Stage 6：3D-BOX 首页与编辑器数据模型

第一阶段只做首页和项目路径，第二阶段再扩展编辑器：

- 保持独立 `/3d-box` 首页、项目卡片、新建、复制、删除和打开导演台。
- 增加场景树节点模型：组、相机、Path、资产、灯光和基础几何体。
- GLB 先实现导入、字节上限、场景版本和资源释放，不先承诺骨骼动画和材质编辑。
- 场景树与 Transform 检查器优先对齐；Path、Aim、Focus 和 WP 要作为有层级的真实节点，不得用平铺数组冒充。
- 增加相机 FOV、lookAtTarget、followTargetId、zoom 字段。
- 增加关键帧和相机轨道编辑器前，先用纯函数定义时间、位置、四元数、lookAt、FOV 和 easing。
- 增加运动路径点上限和点序校验。
- 时间轴先支持单一相机片段和播放头，再开放轨道、关键帧、片段分割和速度曲线。
- 环境字段先支持全景 URL、天空色、地面可见性、地面透明度和高度；Gaussian Splat 只做独立能力验证后再开放入口。
- 手机虚拟相机、画布录制和视频导出分别设独立开关，不能因时间轴存在就一起开放。
- 不修改现有 `director3d` 默认关闭行为。

验收：

- 3D-BOX 首页项目数与带 `director` 的真实项目一致。
- 复制、删除和返回画布只作用于当前项目。
- 检查器新增字段不会影响已有简单项目加载。
- 关键帧和 Path 的边界值有单元测试。
- 3.89 MB 量级 GLB 的加载、失败回退、切换项目和释放资源可重复验证。
- 场景调度与成片预演切换后，资产检查器和镜头片段状态不会互相污染。
- 关闭 `director3d` 时入口和 Three.js 请求都不出现。

### Stage 7：浏览器、设备与压力验收

- ego-browser 对照：工作流空态、选中节点、故事板、脚本全屏、TV Director 设置、剧本设定器、资产库视图管理、Skill 多选、插件页、3D-BOX 首页和导演台。
- 1440×900、1024×768、768px、390×844 / DPR 3。
- 100+ 素材和 130 节点故事板；25 镜分镜组；80+ 场景树节点。
- 真实触控惯性、软键盘、HiDPI、长时间滚动、多分钟 WebGL 和浏览器兼容由实体设备确认。
- 不关闭用户已有 ego 窗口或标签，使用独立测试页面和零收费 mock。

## 12. 测试与交付门禁

### 12.1 自动检查

每轮代码变更至少执行：

```bash
bun test
bun run typecheck
bun run build
git diff --check
```

已有失败需要单独记录，不能混入本次变更结论。纯文档变更至少执行 `git diff --check` 并检查只改了计划文档。

### 12.2 运行时检查

| 场景 | 必须确认 |
| --- | --- |
| 故事板 | 空态、搜索、分类、详情、多选、定位、刷新 |
| 脚本 | 新增 / 删除 / 插入 / 排序 / 时长 / 对白 / 颜色 / 筛选 / 全屏 ESC |
| TV Director | 三模式、空态四入口、全局设置、预算阈值和通知开关 |
| 剧本设定器 | Top 8、融合题材、各设定勾选上限、自定义画风、结构选择和取消恢复 |
| 资产库 | 生成历史 / 我保存的 / 我上传的、本项目 / 全部项目、密度 / 排序 / 评级 |
| 分镜组 | 2×2 默认、5×5 上限、自定义、2K / 4K、镜号、清空、解组 |
| Skill | 多选、去重、退格删除、收藏空态、搜索、资源编辑 |
| 插件 | Codex Plugin / CLI、Claude Code MCP、复制命令、完整性提示 |
| 3D-BOX | 首页项目卡、打开项目、GLB 加载、场景树、Transform、撤销、场景调度 / 成片预演、唯一镜头片段 |
| 移动端 | 390px 无横向溢出、触控 40px、软键盘不遮挡当前字段 |

### 12.3 证据等级

- 只有 ego-browser 实际命中的入口才能写“可用”。
- 只有真机或真实设备才能写“触控 / WebGL / 软键盘验收通过”。
- 只有真实服务端和授权才能写“分享 / 云同步 / 计费 / 供应商已验收”。
- 纯静态代码确认的能力必须标注“待运行时验证”。

## 13. 建议文件拆分

优先新增或扩展现有小文件，不继续把所有逻辑塞进 `web/src/pages/canvas/project.tsx`：

- `web/src/types/canvas-script.ts`
- `web/src/lib/canvas/script-v2.ts`
- `web/src/lib/canvas/script-v2-validation.ts`
- `web/src/lib/canvas/script-v2-task.ts`
- `web/src/lib/canvas/storyboard-assets.ts`
- `web/src/lib/canvas/storyboard-groups.ts`
- `web/src/components/canvas/storyboard/canvas-storyboard-workbench.tsx`
- `web/src/components/canvas/storyboard/canvas-storyboard-asset-library.tsx`
- `web/src/components/canvas/storyboard/canvas-storyboard-detail.tsx`
- `web/src/components/canvas/script/canvas-script-node-panel.tsx`
- `web/src/components/canvas/script/canvas-script-table.tsx`
- `web/src/components/canvas/script/canvas-script-row-editor.tsx`
- `web/src/components/canvas/script/canvas-script-prompt-editor.tsx`
- `web/src/lib/canvas/script-preset.ts`
- `web/src/components/canvas/script/canvas-script-preset-modal.tsx`
- `web/src/components/canvas/agent/canvas-tv-director-settings.tsx`
- `web/src/lib/canvas/director-project.ts` 扩展而不是另起一套 3D 状态

现有文件只在接入点做最小修改：

- `web/src/types/canvas.ts`
- `web/src/constant/canvas.ts`
- `web/src/pages/canvas/project.tsx`
- `web/src/components/canvas/canvas-storyboard.tsx`
- `web/src/components/canvas/canvas-create-menus.tsx`
- `web/src/lib/canvas/canvas-chrome.ts`
- `web/src/stores/use-agent-skill-store.ts`
- `web/src/pages/plugins/index.tsx`
- `web/src/pages/three-d-box/index.tsx`
- 中英文 locale
- `CHANGELOG.md`
- `docs/content/docs/progress/todo.mdx`
- `docs/content/docs/progress/pending-test.mdx`

## 14. 明确不做

- 不复制 LibTV 的品牌、Logo、真实 SKU、积分、会员、活动倒计时和促销视觉。
- 不复制 LibTV 的示例图片、用户内容、字体文件、专属图标和专有源码。
- 不把 LibTV 的任务名、MCP 端点或权限模型直接实现成本地服务。
- 不实现没有权限、分享凭证、撤销和审计契约的公共分享。
- 不做跨设备同步、云项目、团队空间和版本历史的假入口。
- 不为未确认的服务端契约新增依赖或数据库结构。
- 不把当前浏览器本地数据描述成云同步数据。
- 不因为 LibTV 页面显示某个 Agent 就声称本地已经支持该 Agent。
- 不把已确认的 GLB 基础加载扩大成完整材质、骨骼、动画和性能兼容已完成。
- 不把静态确认的相机轨道、关键帧、路径、速度曲线或 Gaussian Splat 写成已完成能力。

## 15. 完成判定

第一阶段可宣布“画布与分镜复刻完成”的最低门槛：

- 工作流、故事板、脚本 V2、插件、Agent / Skill 和 3D-BOX 六个界面有独立可访问路径。
- 画布视觉 token、顶部控制带、底部 dock、节点和弹层密度与逆向基线一致。
- 故事板是资产工作台，不是旧版三栏列表投影。
- 脚本 V2 支持镜头表编辑、字段筛选、行颜色、资产准备、提示词合成状态和批量分镜入口。
- TV Director 三模式、全局设置和剧本设定器可独立打开，设定器不会直接覆盖已有镜头。
- 分镜组支持 25 格、宫格、画幅、镜号、2K / 4K 拼接、清空、转普通组和解组。
- 22 种节点注册表只作为能力清单；没有真实编辑器和任务路径的节点保持未开放。
- Agent 同一轮可发送多个 Skill，重复选择不会生成重复标签。
- 插件页所有可执行命令都有真实本地适配器，未接入目标明确标为“计划中”。
- 3D-BOX 首页、基础导演台、GLB 基础加载和单一机位片段可用；关键帧、FOV、Path、速度曲线和 Gaussian Splat 逐项按证据等级验收。
- 所有入口都能处理空数据、失败、刷新和移动端。
- 自动化测试、类型检查、构建、`git diff --check` 和 ego-browser 对照通过。
- 真实生成、分享、云同步、计费和生产部署仍按外部授权范围单独记录。

达到该门槛前，不能把“页面看起来像 LibTV”写成“LibTV 画布与分镜完整复刻完成”。
