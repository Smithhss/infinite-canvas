# Infinite Canvas Agent

本地 Canvas Agent 用来连接画布网页和用户电脑上的 Codex / Claude Code。本地开发时优先连接 `http://localhost:3000`，不需要先使用线上站点。

包名已迁移到 `@smithhsiiiii/canvas-agent`。旧包 `@basketikun/canvas-agent` 在兼容窗口内仍可继续使用，`canvas-agent` 命令、`mcp` 子命令、Debug 参数和 HTTP/SSE 协议保持不变。

## 启动

```bash
npx -y @smithhsiiiii/canvas-agent@latest
```

带上 `@latest` 是因为 npx 会缓存已下载的版本，不加就可能一直运行旧版本。

需要排查连接、线程、Codex app-server 或工具调用问题时，可开启 Debug 模式：

```bash
npx -y @smithhsiiiii/canvas-agent@latest --debug
```

Debug 日志会以 `[DEBUG][HH:mm:ss]` 等传统格式输出到终端，并按启动日期保存到 `~/.infinite-canvas/logs/canvas-agent-YYYY-MM-DD.log`。终端日志带级别颜色，文件日志为纯文本；日志包含 HTTP、SSE、线程、turn、Codex app-server 和工具调用事件，token 与图片 Data URL 会自动隐藏。

本仓库开发时也可以直接运行：

```bash
cd canvas-agent
npm install
npm run build
node dist/index.js
```

启动后会输出本机地址和 token：

```txt
Local URL: http://127.0.0.1:17371
Connect token: xxxxxx
```

在画布右上角点击 `Agent`，填入地址和 token 后连接。

Codex app 插件会读取启动输出里的 Local URL 和 Connect token，并直接打开画布网页地址；Canvas Agent 不负责生成画布打开 URL。

Canvas Agent 默认只监听 `127.0.0.1`。网页第一次带正确 token 连接后，Canvas Agent 会记录该网页 Origin；之后其他 Origin 不能复用这个本地 Agent，除非用户清理 `~/.infinite-canvas/canvas-agent.json` 里的 `origins`。

## 发布

`canvas-agent` 使用自己的 `package.json` 版本号，不跟仓库根目录 `VERSION` 绑定。推送到 `main` 后，GitHub Actions 会检查 npm 上是否已经存在当前包版本；不存在时才发布 `@smithhsiiiii/canvas-agent`。旧包名在兼容窗口内继续保留，不在本次发布中删除。

发布前需要在 GitHub 仓库 Secrets 中配置 `NPM_TOKEN`。

## Codex MCP

如果希望 Codex 终端能直接操作画布，需要先把 Canvas Agent 注册成 Codex MCP。

直接运行 `npx -y @smithhsiiiii/canvas-agent@latest` 只启动本地 Agent 服务，不会安装 MCP，也不会增加 Codex 工具上下文。只有安装 Codex app 插件，或手动执行 `codex mcp add` 后，`infinite-canvas` 工具才会进入 Codex 上下文；由于工具较多，不使用时建议移除。

通过插件安装时移除插件：

```bash
codex plugin remove infinite-canvas
```

手动添加 MCP 时移除 MCP：

```bash
codex mcp remove infinite-canvas
```

### Codex app 插件

仓库内提供了 Codex app 插件：`plugins/infinite-canvas`。在 Codex app 中添加本仓库的 marketplace 后，可以安装 `Infinite Canvas` 插件；插件会注册同一个 `infinite-canvas` MCP，并带上画布操作说明。

添加本地 marketplace 时建议使用仓库绝对路径，避免 Codex 从其他工作目录解析失败：

```bash
cd /path/to/infinite-canvas
codex plugin marketplace add "$(pwd)"
codex plugin add infinite-canvas@infinite-canvas-local
```

插件默认通过 npm 启动 MCP；这个命令只提供 MCP 工具，不会把 MCP 写入全局配置，也不会在退出时自动卸载：

```bash
npx -y @smithhsiiiii/canvas-agent@latest mcp
```

使用时可以直接在 Codex 里说“打开 Infinite Canvas”，插件会启动本地 Agent 和当前项目的 Vite 前端，读取 Local URL 与 Connect token，然后在 Codex 右侧打开本地画布并自动连接。

Canvas Agent 启动后，给 Codex 添加 MCP：

```bash
codex mcp add infinite-canvas -- npx -y @smithhsiiiii/canvas-agent@latest mcp
```

本仓库开发时可以改成，实际使用建议替换为本机绝对路径：

```bash
codex mcp add infinite-canvas -- node /path/to/infinite-canvas/canvas-agent/dist/index.js mcp
```

Canvas Agent 源码使用 TypeScript 编写，MCP 协议层使用官方 `@modelcontextprotocol/sdk`，工具入参使用 `zod` 描述。

如果希望终端里的 Codex 不被 MCP 审批卡住，可以在 `~/.codex/config.toml` 里给这个 MCP 设置自动放行：

```toml
[mcp_servers.infinite-canvas]
command = "npx"
args = ["-y", "@smithhsiiiii/canvas-agent@latest", "mcp"]
default_tools_approval_mode = "approve"
```

可用工具：

- `canvas_get_state`
- `canvas_get_selection`
- `canvas_export_snapshot`
- `canvas_apply_ops`
- `canvas_create_text_node`
- `canvas_create_image_prompt_flow`

`canvas_apply_ops` 示例：

```json
{
  "ops": [
    {
      "type": "add_node",
      "nodeType": "text",
      "title": "标题",
      "position": { "x": 0, "y": 0 },
      "metadata": { "content": "文本内容" }
    }
  ]
}
```

## 侧边栏 Codex

本地面板会把提示词发送给 Canvas Agent。Canvas Agent 使用官方 `@openai/codex` CLI 的 `codex app-server --stdio` 启动并复用同一个 Codex thread，启动时会注入 `infinite-canvas` MCP 配置并自动放行 MCP 审批，真正执行画布修改前仍由网页侧边栏二次确认。

侧边栏会展示 Codex 返回的 `thread.started`、`turn.started`、`item.*`、`turn.completed` 等结构化事件；Canvas Agent 会合并短时间内的回复、思考摘要和命令输出增量，网页使用同一条消息持续更新，并把任务进度、计划、搜索、文件修改与工具操作整理为中文过程时间线。

侧边栏上传或粘贴的图片会先发到本机 Canvas Agent，再由 Canvas Agent 临时写入本机文件并作为 app-server `localImage` 输入传给 Codex；前端会提示附件体积，单次请求体限制为 30MB。

## Claude Agent SDK

Canvas Agent 已接入官方 `@anthropic-ai/claude-agent-sdk`。`POST /agent/claude/turn` 默认使用 SDK，并把画布工具注册为进程内 MCP，不需要先给 Claude 写入全局 MCP 配置。

SDK 模式会关闭 Claude 内置文件和命令工具，只允许 `mcp__infinite-canvas__*`，并启用流式文本、工具开始/完成、Usage、会话 ID、错误和取消事件。运行中的任务可通过 `POST /agent/claude/interrupt` 按发起网页中断：

```bash
curl -X POST http://127.0.0.1:17371/agent/claude/turn \
  -H 'content-type: application/json' \
  -H "x-canvas-agent-token: $TOKEN" \
  -d '{"clientId":"current-page-client-id","prompt":"读取当前画布"}'
```

`GET /agent/claude/models` 通过 SDK 原生 `supportedModels()` 返回当前登录态可用模型，只用于初始化列表，不提交用户 prompt：

```bash
curl http://127.0.0.1:17371/agent/claude/models \
  -H "x-canvas-agent-token: $TOKEN"
```

SDK 使用本机已有的 Claude Code 登录态，不上传登录凭证。网页侧边栏已通过默认关闭的 `agentProviderSwitch` 开放 Codex / Claude 切换；Claude 当前开放原生模型、项目 Skill、本机会话历史、文本对话、画布工具和 SDK 原生权限，图片附件仍只属于 Codex。网页选择 Claude 模型后会把它作为 `model` 传给 `/agent/claude/turn`。

Claude 权限模式通过 `/agent/claude/turn` 的 `permissionMode` 传入：`request` 映射到 SDK `default`，`automatic` 映射到 `auto`，`full` 映射到 `bypassPermissions`。请求模式下的画布写入通过 `POST /agent/claude/approval` 返回 `accept`、`acceptForSession` 或 `decline`；同一 SDK 会话中的“本会话允许”会跨 turn 保留，中断或 turn 结束时会自动拒绝仍未处理的审批。

`GET /agent/claude/skills` 通过 SDK `supportedCommands()` 读取当前工作空间 `.claude/skills` 中非内置 Skill，不提交 prompt 或触发模型生成。选择 Skill 后，`/agent/claude/turn` 接收 `skill.name` 并只开放 `Skill` 与画布 MCP；项目 hooks 会被关闭，Skill 文件仍由项目自身管理，网页只读。

需要兼容旧的 print 模式时，可在请求里传 `"transport": "cli"`。这条路径仍调用本机 `claude -p --output-format stream-json`，并默认允许 `mcp__infinite-canvas__*`。

如果希望终端里的 Claude Code 也能直接操作画布，仍需单独添加同一个 MCP。建议用 user scope，避免 Canvas Agent 从不同目录启动时找不到配置：

```bash
claude mcp add --scope user --transport stdio infinite-canvas -- npx -y @smithhsiiiii/canvas-agent@latest mcp
```

本仓库开发时可以改成：

```bash
claude mcp add --scope user --transport stdio infinite-canvas -- node /path/to/infinite-canvas/canvas-agent/dist/index.js mcp
```

真正修改画布仍由网页侧边栏确认。
