# 3D 导演台来源、许可证与资产完整性审计

- 审计日期：2026-10-28
- 审计状态：`BLOCKED`
- 审计范围：参考仓 `web/public/director`、iframe 适配器、根许可证和随包资产
- 主仓许可证：MIT，见 `/Users/smith/develop/project/infinite-canvas/LICENSE:1`
- 参考仓：`/Users/smith/develop/project/infinite-canvas-moeacgx`

## 结论

Phase C 不得进入 C2-C5。当前导演台是可运行的前端构建产物，但来源仓采用 AGPL-3.0，目录内没有该应用的对应源码、构建清单或完整第三方许可证清单，不能据此把它移植进 MIT 主仓。

本结论只阻止复用参考实现。后续如继续该方向，必须做 clean-room 自研：使用自己的 3D 壳、消息协议、占位模型和经单独审查的依赖，不复制参考仓的压缩脚本、样式、模型或其他资产。

## 仓库与提交

| 项目 | 值 |
|---|---|
| 参考仓 remote | `git@github.com:moeacgx/infinite-canvas.git` |
| 分支 | `main` |
| HEAD | `c8d6f6ca293b3d771dadfa6cacd690fea7338987` |
| 工作区 | clean |
| 引入导演台资产的提交 | `91eadb9db6ba6f6b6a99d5157307f70a1399908a` |
| 对应 tag | `v0.11.0` |
| 提交标题 | `feat(canvas): 发布 v0.11.0 完整创作工作台 (#4)` |

## 文件清单

`web/public/director` 共 6 个文件，合计 3,608,283 字节。

| 文件 | 字节 | SHA256 |
|---|---:|---|
| `index.html` | 648 | `905a78d6210c625df8ab80866707409c724791e2f233d4609f65d8c80fb37f47` |
| `assets/index-1sHY9TaJ.css` | 57,695 | `0458b460950bcdd15b83ecd06ff3fccf7496aeec24945ca61d5fc905fc96979e` |
| `assets/index-BHT57_C-.js` | 1,399,269 | `8f2b6fd8f01f41d72c4b3205cab03dae77ad12441fd86a5d141bed7b4db0d2a3` |
| `assets/index-CHMhBrQ3.js` | 1,399,768 | `eb0eded8f051fcd824bb547bc3fbff03289e577f9809401ad88cc51c1cacce83` |
| `models/ue-mannequin-retopology.glb` | 750,464 | `5622c6150467fb96ff70d30eb3393286131c8523feaa3b78f80515d499cb1a14` |
| `models/ue-mannequin-retopology.license.txt` | 439 | `26b0b701ff1feaa5dccde23ae249681bd350ff219d773b8f717359810da4729b` |

## 源码和构建完整性

代码事实：

- 入口页只加载 `index-CHMhBrQ3.js` 和 `index-1sHY9TaJ.css`，见 `/Users/smith/develop/project/infinite-canvas-moeacgx/web/public/director/index.html:16`。
- `index-BHT57_C-.js` 未被入口页或当前静态目录中的其他文件引用，属于无法确认用途的冗余构建产物。
- 两个 JavaScript 文件都是约 1.4 MB 的压缩构建产物。
- 目录内没有 source map，也没有 `sourceMappingURL` 或 `sourcesContent`。
- 仓库只包含 iframe 适配器和节点面板，没有导演台应用的源代码、独立 `package.json`、锁文件、构建命令或依赖版本清单。
- 压缩包中出现 `@react-three`、`three`、`fflate`、`react-use-measure` 等运行时线索，但无法据此确认完整依赖树、版本和许可证。

审计判断：

- 当前材料不足以复现构建，也不足以完成 AGPL 对应源码和第三方许可证审计。
- “仓库公开”只说明代码可按其许可证使用，不等于可把 AGPL 代码或构建产物直接改许可证后并入 MIT 项目。

## 许可证与资产

代码事实：

- 参考仓根 `LICENSE:1` 是 GNU Affero General Public License Version 3。
- 仓库内未发现覆盖 `web/public/director` 的单独商业许可、NOTICE 或完整第三方许可证清单。
- 随包模型许可证记录模型名为 `UE Mannequin (Retopology)`，作者 William Luque，来源 Sketchfab，许可类型为 `SKETCHFAB Standard`，见 `/Users/smith/develop/project/infinite-canvas-moeacgx/web/public/director/models/ue-mannequin-retopology.license.txt:1`。
- Sketchfab Standard 只说明该模型自身的使用条件，不能覆盖导演台代码、CSS、打包后的第三方库或其他未列明资产。

审计判断：

- AGPL-3.0 导演台代码不能直接进入 MIT 主仓。
- 模型许可证和代码许可证必须分别处理；即使模型允许使用，也不能证明整套导演台可移植。
- 在完整依赖、版本、许可证和资产来源明确前，不能复制 `web/public/director` 下任何文件。

## iframe 协议检查

参考适配器会校验消息 `origin` 和 `event.source`，见 `/Users/smith/develop/project/infinite-canvas-moeacgx/web/src/app/(user)/canvas/components/canvas-director.tsx:47`。

| 消息 | 当前 payload | 当前校验 |
|---|---|---|
| `storyai:director-ready` | 无明确业务字段 | 仅消息类型 |
| `storyai:director-close` | 无明确业务字段 | 仅消息类型 |
| `storyai:director-project-changed` | `project` | 只要求非数组对象 |
| `storyai:director-panorama-removed` | `edgeId`、`sourceNodeId` | 去空格后要求非空字符串 |
| `storyai:director-captures-sent` | `captures[].dataUrl`、`fileName` | 只检查 `data:image/` 前缀 |
| `storyai:director-session` | `instanceId`、`theme`、`project` | 由父页发出 |
| `storyai:director-panoramas` | `panoramas` | 由父页发出 |

压缩包还出现 `storyai:director-panorama`，但该消息未在参考适配器中处理。

现有 `captures-sent` 没有单张大小、总大小、数量或 MIME 白名单限制，不能按当前实现直接视为安全协议。若未来实施，必须使用本主仓自有的消息类型和严格 schema，并限制来源、字段、长度、数量与总字节数。

## 最终判定

`BLOCKED`

停止条件：

1. 不复制 AGPL 源码、压缩脚本、CSS、模型、纹理、HDR、字体、音频或其他构建产物。
2. 不启动 C2-C5，也不以“只复用协议名称”为由绕过来源审查。
3. 如产品仍需要 3D 导演台或全景，另立 clean-room 任务，从公开产品行为出发定义自有协议，使用自有占位 3D 和经过许可证审查的依赖。
4. 新方案的依赖、资产、性能预算、回滚开关和零收费验收必须先单独评审。

## Clean-room 实施记录（2026-10-29）

参考仓结论继续维持 `BLOCKED`，不复制其源码、压缩脚本、CSS、模型、纹理、HDR、字体、音频或构建产物。主仓改为独立的 clean-room 实现：

| 项目 | 决策 |
|---|---|
| 场景 | 程序化地台、网格、灯光和立方体、球体、圆柱、圆锥占位道具 |
| 依赖 | `three@0.186.1` 与 `@types/three@0.186.0`，均为 MIT |
| 外部资产 | 无模型、纹理、HDR、字体、音频或远端 iframe |
| 加载方式 | 仅在功能开关开启且用户打开导演台或全景查看器时动态加载 Three.js |
| 项目数据 | 只保存版本、相机、背景、受控道具字段；不保存截图 data URL |
| 截图 | 浏览器内生成 PNG，经现有 `uploadImage` 写入本地图片存储后创建普通图片节点 |
| 全景 | 复用图片节点，仅接受 `blob:` 或受大小限制的本地 `data:image` PNG/JPEG/WebP |
| 降级 | WebGL 不可用、上下文丢失或全景加载失败时显示明确错误和普通图片回退 |
| 默认状态 | `director3d=false`、`panorama=false` |

本次只完成代码与零收费预发验收，不证明真实移动设备长期 WebGL 性能、GPU 内存表现或生产浏览器兼容性。

## 交付状态（2026-10-30）

clean-room 实现提交 `80dba98`，测试兼容修复提交 `41e729b`，状态文档提交 `5e9689a`。PR #11 已普通合并到 `dev`，merge commit 为 `81e3c0215231f9c505342d0da81e2e4493ac48ee`，合并后 Quality CI `40989445330` 成功。ego-browser 零收费验收覆盖默认关闭、颜色编辑、保存恢复、截图回画布、40 道具上限、重复开关资源释放、全景拖动、WebGL 上下文丢失降级和 390px 布局；未发现运行时报错。生产 `create.aicos.ink` 仍为 `v0.22.0`，`director3d` 与 `panorama` 仍默认关闭，真实移动设备长期 WebGL 性能和跨浏览器兼容性仍需验收。
