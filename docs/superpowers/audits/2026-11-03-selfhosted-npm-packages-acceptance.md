# 自有 npm 包迁移验收

**验收日期：** 2026-11-03

**环境：** Infinite Canvas `dev@ae6974d`，独立本地预发 `http://127.0.0.1:4176/`，Ego Browser TaskSpace `infinite canvas npm entry acceptance 20261103 v2`（60）。

**结论：** `@smithhsiiiii/canvas-agent@0.7.0` 与 `@smithhsiiiii/canvas-proxy@0.2.0` 已公开发布，并通过匿名在线 `npx` 验收。网页 Agent 连接命令、本地代理命令和 Codex 插件入口已切换到新包；旧 `@basketikun/*` 在兼容窗口内继续保留。未部署生产，未合并 `main`。

## 包变更

| 包 | 旧版本 | 新版本 | 结果 |
| --- | --- | --- | --- |
| `@smithhsiiiii/canvas-agent` | `@basketikun/canvas-agent@0.6.0` | `0.7.0` | 已公开发布并通过在线验收 |
| `@smithhsiiiii/canvas-proxy` | `@basketikun/canvas-proxy@0.1.0` | `0.2.0` | 已公开发布并通过在线验收 |

CLI 名称、参数、端口、HTTP 转发、SSE 和现有 Agent 协议保持不变。npm 登录账号为 `smithhsiiiii`，两个包的访问状态均为 `public`，`latest` dist-tag 分别指向 `0.7.0` 和 `0.2.0`。GitHub 仓库已配置 `NPM_TOKEN` Secret，未输出或写入任何 token。

## 在线 npm 验收

验收使用 `NPM_CONFIG_USERCONFIG=/dev/null`、隔离 HOME、隔离 npm cache 和非默认端口，证明公开包可被匿名客户端安装运行。

| 检查项 | 结果 | 实测 |
| --- | --- | --- |
| Registry 版本 | 通过 | `npm view --prefer-online` 返回 `0.7.0` / `0.2.0`；两个 `latest` dist-tag 正确 |
| Registry tarball | 通过 | 两个公开 tarball 返回 HTTP 200，integrity 元数据存在 |
| Agent MCP 初始化 | 通过 | `npx -y @smithhsiiiii/canvas-agent@latest mcp` 返回 `canvas-agent@0.7.0` |
| Agent 工具发现 | 通过 | `tools/list` 返回 34 个工具 |
| Agent HTTP 启动 | 通过 | 隔离 HOME 下监听 `127.0.0.1:24931`，`/health` 返回协议版本 6 |
| Agent 鉴权 | 通过 | 无 token 访问工作区返回 401，带 token 返回 200 |
| Agent 进程清理 | 通过 | 验收后监听端口已关闭 |
| Proxy 身份 | 通过 | 根路径返回 `@smithhsiiiii/canvas-proxy@0.2.0` |
| Proxy CORS | 通过 | OPTIONS 返回 204，`access-control-allow-origin: *` |
| Proxy 转发 | 通过 | POST 请求体与自定义请求头原样到达测试上游，上游 201 和响应头正常返回 |
| Proxy SSE | 通过 | HTTP 200，两个 SSE 分块分别在约 20ms、271ms 到达，未整段缓冲 |
| Proxy 进程清理 | 通过 | 验收后代理与测试上游端口均已关闭 |

## 浏览器验收

| 检查项 | 结果 | 实测 |
| --- | --- | --- |
| Agent 连接面板 | 通过 | 中文和英文均显示 `npx -y @smithhsiiiii/canvas-agent@latest` |
| 本地代理页签 | 通过 | 中文和英文均显示 `npx @smithhsiiiii/canvas-proxy@latest` |
| 390px 布局 | 通过 | `innerWidth`、文档和 body 的 `scrollWidth` 均为 390，无页面级横向溢出 |
| Codex 插件清单 | 通过 | `.mcp.json` 与 ZCode 插件清单 JSON 有效，MCP 参数均指向新 Agent 包 |
| 付费请求 | 未触发 | 只检查本地命令、页面、代理和测试上游，没有调用模型或供应商 |

截图证据位于 `/Users/smith/.codex/visualizations/2026/11/03/infinite-canvas-npm-entry-20261103/`。

## 自动化验证

| 命令 | 结果 |
| --- | --- |
| `web: bun test` | 106 pass，0 fail，350 assertions |
| `web: bun run typecheck` | 通过 |
| `web: bun run build` | 通过，保留现有动态/静态混合导入和 chunk 体积警告 |
| `docs: bun run types:check` | 通过 |
| `docs: bun run build` | 通过，69 个静态页面生成成功；保留现有 Turbopack NFT 追踪警告 |
| `git diff --check` | 通过 |

迁移提交此前还通过了 Agent 127 tests、Proxy 4 tests、两包打包检查、Web standalone/FYT-managed 构建及隔离 `.tgz` 安装验收。

## 入口切换

- 网页 Agent 连接命令和本地代理常量已切换为 `@smithhsiiiii/*`。
- 中英文界面提示和本地代理命令已同步更新。
- Codex/ZCode 插件清单、`open-canvas` Skill 和当前使用文档已切换到新 Agent 包。
- 迁移待办已从 `todo` 移除，变更进入 `pending-test`，等待用户实际连接和刷新插件确认。

## 发布边界与剩余风险

- 发布工作流只在 `main` 的包目录变更或手动触发时运行，`dev` 合并不会自动发布 npm。
- 两个公开包已经可安装，但 npm 元数据传播仍可能受 CDN 缓存影响；遇到短暂 404 时应等待后重试，不要重复发布同一版本。
- 本轮没有部署生产，也没有把 `dev` 合并到 `main`。
- 旧包在兼容窗口内继续可用，尚未删除或取消发布。
- 用户仍需在实际 Codex 会话中刷新插件并确认 MCP 工具加载；自动化 MCP 初始化已通过，但无法替代产品层的插件刷新体验。
