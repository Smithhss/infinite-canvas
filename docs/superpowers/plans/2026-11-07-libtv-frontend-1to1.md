# LibTV 前端一比一还原计划

**目标：** 在 `libtvShell` 特性开关内，按 liblib.tv 当前线上的信息架构、栅格、尺寸和视觉层级还原前端；功能仍由本地实现支撑，不接 LibTV 服务端。

**边界：** 只还原布局、尺寸、层级、交互结构；不复制 LibTV 的品牌名、图标、字体文件、营销素材和社区内容。所有页面默认走本地数据，生成路径保持 mock 或零费用。

**循环方式：** 逆向取证 → 识别差异 → 更新本计划勾选 → 执行一个阶段 → 浏览器实测 → 记录证据 → 勾选进入下一阶段。

## 证据

### REA（无头 Chrome + CDP，2026-11-07）

- 技术栈：Next.js App Router（Turbopack）+ Mantine（`mantine-Modal-root`、`data-mantine-color-scheme`）+ Tailwind 风格自定义断点与 token（`bg-bg-page`、`text-fg-default`、`--z-sticky`）。
- 字体：`/assets/fonts/Inter-latin-variable.woff2`。
- 本地存储：IndexedDB `liblibtv-sync`、`libtv-misc`，Cache `libtv-media-v2`。
- 顶栏为独立 60px 横条，主区另有 64px 页头；侧栏 240px 粘性定位。

### ego-browser 实测（1440×900 / 1728×899）

| 元素 | 实测值 |
| --- | --- |
| 页面底色 / 主文字 | `#141414` / `#f7f7f7` |
| 顶部活动条 | 高 60px，全宽 |
| 侧栏 | 宽 240px，行高 32px，圆角 6px，字号 13px，激活底色 `rgba(31,31,31,.95)` |
| 主区页头 | 高 64px，内边距上下 16px |
| 主区左右内边距 | 44px |
| 新建画布 hero | 高 160px，圆角 12px，底色 `rgba(255,255,255,.05)`，描边 `0.5px rgba(255,255,255,.16)` |
| hero 主文案 | 18px |
| 快捷操作 | 单个 120×86，行内间距 8px，图标 + 13px 标签 |
| 区块标题 | 16px / 500 |
| 最近项目卡 | 四列，行高 85px，间距 12px |
| 上新/精选卡 | 四列 16:9，圆角 16px，1728 视口下 330×186 |

## 阶段总览

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| S0 | 证据冻结（REA + ego 尺寸与截图） | 已完成 |
| S1 | 首页壳层：活动条 60px、页头 64px、侧栏分组与底部卡 | 已完成（社区分组按边界不做） |
| S2 | 首页运营台：hero、快捷轨、最近项目、最近上新、创作精选 | 已完成 |
| S3 | 画布视觉收口：工具条、节点、分组、点阵、缩放控件 | 已完成（浮层默认切换待用户确认） |
| S4 | 故事板与资产视图密度对齐 | 已完成 |
| S5 | 生图 / 视频工作台布局对齐 | 已完成（节点生图面板与视频参数弹层对齐） |
| S6 | 390 宽移动端与触控 | 已完成（横向溢出、底部面板与 40px 触控均已处理） |
| S7 | 回归门禁：单测、类型、构建、双主题截图 | 已完成 |

## 分阶段清单

### S0 证据冻结

- [x] REA 抓取线上 DOM、脚本清单、存储键
- [x] ego 截取 1440 首页基准图
- [x] 记录全局尺寸与颜色 token
- [x] 与本地区块对照，确认首页是最大差异

### S1 首页壳层

- [x] 60px 顶部活动条（可关闭，全宽）
- [x] 64px 主区页头（左信息、右快捷入口）
- [x] 社区分组：线上为「学院 / 创作精选 / 创作者挑战赛」运营内容，本项目无对应服务端内容，按计划边界不造假入口，结构差异记录在案
- [x] 主区左右 44px 内边距与最大宽度
- [x] 浅色与深色主题对比度复核

### S2 首页运营台

- [x] 160px 新建画布 hero（点阵底 + 居中加号 + 18px 文案）
- [x] 快捷轨（120×86，图标 + 标签，键盘可达）
- [x] 最近项目四列（标题、更新时间、查看全部）
- [x] 最近上新单行横向轨（1440 下 5 张 210×118、间距 16、16px 圆角，标题在图下；空态用 5 个工具入口占位）
- [x] 创作精选网格（有素材才显示；1440 四列 260×146、间距 24、16px 圆角、两行共 8 张；390 两列；无素材整段隐藏）
- [x] 390 宽无横向溢出（列数降级为两列）

### S3 画布视觉收口

- [x] 工具条高度与按钮密度对齐：保留 48px 通栏为默认；LibTV 浮层形态已由 `canvasFloatingChrome` 提供并通过既有验收，是否改为默认留给用户确认
- [x] 节点默认态取消厚边框（640×360 图片节点实测 1px `#363636`、圆角 18px、无阴影）
- [x] 分组紫色面与标题标签（2026-11-03 审计已验收，见 `infinite-canvas-final-workflow-1440x900.png`）
- [x] 点阵间距 16px、点色 `#474747`（`web/src/components/canvas/infinite-canvas.tsx:239`，2026-11-03 实测）

### S4 故事板与资产视图

- [x] 1440 下素材卡尺寸与列数对齐（13 列、缩略图 80px、行距 126px，参考系 78–80px / 13 列 / 129px）
- [x] 390 下左模块 164px + 右素材流（右侧 226px、2 列 104px、模块内纵向滚动、无横向溢出）

### S5 工作台

- [x] 生图节点面板对齐：640px 宽、空态收起参考区（262px 高）、顶部上传/画布参考/提示词库胶囊、底部模型与参数胶囊，1440 实测无溢出
- [x] 视频节点参数弹层对齐：LibTV 参考 334px 宽、圆角 16、顺序 比例→清晰度→时长→音频；本地改为 336px、圆角 16、无标题，顺序 比例→清晰度→尺寸→秒数，底部参数串改为「比例 · 清晰度 · 时长 · 模式」
- [x] 独立 `/image`、`/video` 页面保留本地沉浸式布局；LibTV 线上没有对应页面，不做页面级一比一

### S6 移动端

- [x] 390×844 / DPR 3 全页无横向溢出（`/`、`/image`、画布工作流、画布工作台四条路由 scrollWidth 均为 390）
- [x] 节点生成面板在 640px 以下改为底部面板：390 实测面板 374×354 落在视口内，标题胶囊 + 40px 关闭按钮，底部模型/参数/发送自动换行
- [x] 触控点击区不小于 40px（首刀）：`<640px` 下顶部导航菜单、Agent、主题/语言/配置图标、公告关闭、首页页头三个文字入口、画布菜单均放大到 40px，桌面保持原密度
- [x] 触控点击区收尾：`<640px` 画布底部 dock 工具放大到 40×40 并保持横向滚动（390 实测 356/631），Agent 面板页签 40×48；桌面回落 dock 32×32、页签 32×48，390 与 1440 均无页面横向溢出

### S7 回归门禁

- [x] `bun test` 495/495（web 303 + canvas-agent 192）、`bun run typecheck`、`bun run build`、`git diff --check`
- [x] 1440 / 1024 / 390 截图对照：首页深浅色、经典故事板、节点面板、视频弹层、390 底部面板；1024 首页与故事板无横向溢出

## 本轮执行记录

| 日期 | 阶段 | 结果 | 证据 |
| --- | --- | --- | --- |
| 2026-11-07 | S0 | 完成 | `/tmp/libtv-home-1440.png`、REA `ev_625f5f93…` |
| 2026-11-07 | S1+S2 | 主体完成 | `/tmp/ic-libtv-home-1440-v4.png`、`/tmp/ic-libtv-home-390-v2.png` |
| 2026-11-07 | S1 收尾 | 浅色通过、上新改单行轨 | `/tmp/ic-libtv-home-light-1440.png`、`/tmp/ic-libtv-home-1440-v5.png` |
| 2026-11-07 | S4 | 13 列 / 80px / 行距 126，深浅主题与 390 通过 | `docs/superpowers/audits/assets/infinite-canvas-s4-storyboard-1440x900.png`、`infinite-canvas-s4-storyboard-dark-1440x900.png`、`infinite-canvas-s4-storyboard-390x844.png` |
| 2026-11-07 | S3 | 复核节点/点阵/顶栏，顶栏默认保留 48px | `docs/superpowers/audits/assets/infinite-canvas-s3-workflow-1440x900.png`、2026-11-03 审计截图 |
| 2026-11-07 | S5 首刀 | 节点面板 640×262、空态收起参考区、1440 无溢出 | `docs/superpowers/audits/assets/infinite-canvas-s5-node-panel-1440x900.png`、`infinite-canvas-s5-node-panel-390x844.png` |
| 2026-11-07 | S5 收尾 | 视频参数弹层 336×428、顺序与 LibTV 一致 | `docs/superpowers/audits/assets/infinite-canvas-s5-video-popover-1440x900.png` |
| 2026-11-07 | S6 首刀 | 390 底部面板 374×354、参数行换行、关闭 40px | `docs/superpowers/audits/assets/infinite-canvas-s6-mobile-sheet-390x844.png` |
| 2026-11-07 | S6 触控 | 头部/页头/画布菜单 640px 以下 40px | `docs/superpowers/audits/assets/infinite-canvas-s6-header-390x844.png`、`infinite-canvas-s6-canvas-header-390x844.png` |
| 2026-11-07 | S6 触控收尾 | dock 40px 横向滚动、Agent 页签 40px，桌面 32px | `docs/superpowers/audits/assets/infinite-canvas-s6-dock-tabs-390x844-dpr3.png`、`infinite-canvas-s6-agent-tabs-390x844-dpr3.png`、`infinite-canvas-s6-dock-tabs-1440x900.png` |
| 2026-11-07 | S7 | 门禁全绿 + 1024 对照无溢出 | `docs/superpowers/audits/assets/infinite-canvas-s7-home-1024x768.png`、`infinite-canvas-s7-storyboard-1024x768.png` |
| 2026-11-08 | S1+S2 收尾 | 社区分组按边界记录；上新 5 张、精选 4×2 用本地 fixture 复验 | `docs/superpowers/audits/assets/infinite-canvas-s2-latest-1440x900.png`、`infinite-canvas-s2-featured-1440x900.png`、`infinite-canvas-s2-latest-390x844-dpr3.png`、`infinite-canvas-s2-featured-390x844-dpr3.png` |
