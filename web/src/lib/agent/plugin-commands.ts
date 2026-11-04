export const AGENT_PLUGIN_INSTALL_COMMAND = ["git clone https://github.com/Smithhss/infinite-canvas.git ~/plugins/infinite-canvas", "codex plugin marketplace add ~/plugins/infinite-canvas", "codex plugin add infinite-canvas@infinite-canvas-local"].join(
    "\n",
);

export const AGENT_PLUGIN_REMOVE_COMMAND = "codex plugin remove infinite-canvas";
export const AGENT_MCP_REMOVE_COMMAND = "codex mcp remove infinite-canvas";
export const AGENT_CLI_COMMAND = "npx -y @smithhsiiiii/canvas-agent@latest";
