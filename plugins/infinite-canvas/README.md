# Infinite Canvas Plugin

让 Codex / ZCode 可以打开并操作 Infinite Canvas。

## 第一次使用

1. 安装插件。
2. 新建一个 Codex 对话，让 Skill 和 MCP 工具加载。
3. 发送“打开 Infinite Canvas 新建画布，并连接好 Codex”。
4. 看到右侧 Agent 面板显示“已连接”后，发送“读取当前画布并总结节点结构”。

### Codex 安装

macOS / Linux：

```bash
git clone https://github.com/Smithhss/infinite-canvas.git
cd infinite-canvas
codex plugin marketplace add "$(pwd)"
codex plugin add infinite-canvas@infinite-canvas-local
```

Windows PowerShell：

```powershell
git clone https://github.com/Smithhss/infinite-canvas.git
cd infinite-canvas
codex plugin marketplace add "$PWD"
codex plugin add infinite-canvas@infinite-canvas-local
```

Windows CMD 将 `$PWD` 替换为 `%cd%`。

### ZCode

- 打开 **Settings → Plugin Management → Discover**，点击右上角 **`+`** 添加 marketplace。
- 选择 **本仓库目录**（`plugins/infinite-canvas`）或本仓库根目录，即可发现 `infinite-canvas` 插件并安装。
- 或在 ZCode 界面直接以本地目录方式加载该插件目录。

安装后新建一个任务，然后输入：

```text
打开 Infinite Canvas 新建画布，并连接好 Codex
```

连接成功后可以直接发送：

```text
读取当前画布并总结节点结构
根据当前选中的内容整理一组可以直接使用的提示词
把当前选中的节点整理成一个生图流程
```

需要生成时先让 Codex 创建流程并确认参数，再单独要求生成。示例和教程按钮只填入提示词，不会自动触发生成。

## 连接面板

点击 Agent 面板顶部的连接状态可以打开连接面板：

- 自动状态：区分未检测到插件、已安装、连接中、MCP 启动中、已连接和失败。
- 按状态操作：未安装时显示安装指令，已安装时显示打开画布指令，已连接时直接开始对话。
- 动态示例：按空画布、已有节点、连线和选区推荐任务，点击只填入输入框。
- 失败检查：分别检查插件、本地 Agent、MCP 和 Token。
- 连接详情：通常由插件自动填写，仅在自动发现失败时检查 Local URL 和 Connect token。
- 高级设置：手动启动 Agent、移除插件或 MCP。

手动排查网页连接：

```bash
npx -y @smithhsiiiii/canvas-agent@latest
```

这条命令只提供网页连接服务，不会安装 Codex MCP。插件自身的 MCP 命令是：

```bash
npx -y @smithhsiiiii/canvas-agent@latest mcp
```

如果 MCP 已就绪但网页仍显示未连接，先检查普通 Canvas Agent 是否正在运行。
