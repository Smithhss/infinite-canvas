import { spawn } from "node:child_process";
import path from "node:path";

import { loadConfig } from "../config.js";

const HEALTH_TIMEOUT_MS = 600;
const START_TIMEOUT_MS = 4000;
const POLL_INTERVAL_MS = 150;

export type CanvasAgentServiceState = {
    url: string;
    runningBeforeStart: boolean;
    started: boolean;
};

/** 确保网页连接服务已运行；MCP 进程启动时调用。 */
export async function ensureCanvasAgentService(): Promise<CanvasAgentServiceState> {
    const config = loadConfig(true);
    if (await isHealthy(config.url)) return { url: config.url, runningBeforeStart: true, started: false };

    const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
    if (!entry || entry.endsWith(".ts")) return { url: config.url, runningBeforeStart: false, started: false };

    const child = spawn(process.execPath, [entry], {
        detached: true,
        stdio: "ignore",
    });
    child.unref();

    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await delay(POLL_INTERVAL_MS);
        if (await isHealthy(config.url)) return { url: config.url, runningBeforeStart: false, started: true };
    }
    return { url: config.url, runningBeforeStart: false, started: false };
}

async function isHealthy(url: string) {
    try {
        const response = await fetch(`${url.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS), cache: "no-store" });
        return response.ok;
    } catch {
        return false;
    }
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
