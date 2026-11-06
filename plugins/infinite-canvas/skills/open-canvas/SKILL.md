---
name: open-canvas
description: 启动 Infinite Canvas 本地画布，并自动连接本地 Canvas Agent。用户要求打开、启动、进入或使用 Infinite Canvas 画布时使用。
---

# Open Infinite Canvas

默认从当前项目启动本地前端。部署到自有域名后，再用该域名替换 Vite 本地地址。

## 启动流程

1. 在 Infinite Canvas 项目中启动前端，并使用 Vite 输出的 `Local` 地址：

```bash
cd web
bun install
bun run dev
```

2. 插件 MCP 启动时会自动拉起本地 Canvas Agent 网页服务。只有 MCP 未加载或连接失败时，才手动运行：

```bash
npx -y @smithhsiiiii/canvas-agent@latest
```

3. 在 Codex 右侧浏览器打开：

```text
<Vite Local 地址>/canvas?mode=new
```

本地页面会从 `http://127.0.0.1:17371/config` 自动发现地址和 token；部署页面首次仍通过插件注入的连接片段完成配对，之后会持久化并自动重连。

## MCP 与连接地址

插件在新的 Codex 任务中加载时会自动启动 `npx -y @smithhsiiiii/canvas-agent@latest mcp`。MCP 进程会检查本机网页连接服务，必要时以 detached 模式启动同一个 CLI；两个进程读取同一份本地配置，因此不需要用户每次手动填写地址或 token。

## 打开模式

用户没有明确指定打开方式时，始终使用 `mode=new` 新建画布。只有用户明确要求时才替换为：

- 最近画布：`mode=recent`
- 自己选择：`mode=choose`
