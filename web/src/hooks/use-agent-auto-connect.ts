import { useEffect, useRef } from "react";

import { discoverAgentConfig } from "@/services/api/canvas-agent";
import { useAgentStore } from "@/stores/use-agent-store";

const RETRY_DELAYS_MS = [0, 1200, 3000, 7000, 15000];

/** 让 Agent 页面重新走本地服务发现，而不是只重连旧地址。 */
export function reconnectAgentWithDiscovery() {
    const state = useAgentStore.getState();
    state.disconnectAgent({
        connectError: "",
        autoConnectSuppressed: false,
        autoConnectRequest: state.autoConnectRequest + 1,
    });
}

/** 用户编辑连接配置时先断开当前连接，避免 SSE 自动切到草稿地址。 */
export function suspendAgentAutoConnectForEdit(patch: { url?: string; token?: string }) {
    useAgentStore.getState().disconnectAgent({
        ...patch,
        connectError: "",
        autoConnectSuppressed: true,
    });
}

/** 本地 Agent 启动可能晚于网页，带退避自动恢复已保存的连接。 */
export function useAgentAutoConnect() {
    const url = useAgentStore((state) => state.url);
    const token = useAgentStore((state) => state.token);
    const enabled = useAgentStore((state) => state.enabled);
    const connected = useAgentStore((state) => state.connected);
    const connectError = useAgentStore((state) => state.connectError);
    const autoConnectSuppressed = useAgentStore((state) => state.autoConnectSuppressed);
    const autoConnectRequest = useAgentStore((state) => state.autoConnectRequest);
    const connectAgent = useAgentStore((state) => state.connectAgent);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const disconnectAgent = useAgentStore((state) => state.disconnectAgent);
    const attemptsRef = useRef(0);
    const hadConnectionRef = useRef(false);
    const inFlightRef = useRef(false);
    const endpointRef = useRef(url);
    const tokenRef = useRef(token);

    useEffect(() => {
        if (endpointRef.current === url && tokenRef.current === token) return;
        endpointRef.current = url;
        tokenRef.current = token;
        attemptsRef.current = 0;
        hadConnectionRef.current = false;
    }, [token, url]);

    useEffect(() => {
        if (!autoConnectRequest) return;
        attemptsRef.current = 0;
        hadConnectionRef.current = false;
        void attemptConnect();
    }, [autoConnectRequest]);

    useEffect(() => {
        if (connected) {
            hadConnectionRef.current = true;
            attemptsRef.current = 0;
            return;
        }
        if (autoConnectSuppressed) return;
        const shouldRetry = Boolean(connectError) || !hadConnectionRef.current;
        if (!shouldRetry) return;
        if (enabled && !connectError) return;
        const delay = RETRY_DELAYS_MS[Math.min(attemptsRef.current, RETRY_DELAYS_MS.length - 1)];
        const timer = window.setTimeout(() => {
            attemptsRef.current += 1;
            void attemptConnect();
        }, delay);
        return () => window.clearTimeout(timer);
    }, [autoConnectSuppressed, connectAgent, connectError, connected, enabled, setAgentState, disconnectAgent]);

    useEffect(() => {
        const retryWhenVisible = () => {
            if (document.visibilityState !== "visible") return;
            const state = useAgentStore.getState();
            if (state.autoConnectSuppressed || state.connected || (state.enabled && !state.connectError)) return;
            attemptsRef.current = 0;
            void attemptConnect();
        };
        window.addEventListener("focus", retryWhenVisible);
        document.addEventListener("visibilitychange", retryWhenVisible);
        return () => {
            window.removeEventListener("focus", retryWhenVisible);
            document.removeEventListener("visibilitychange", retryWhenVisible);
        };
    }, [connectAgent, disconnectAgent, setAgentState]);

    async function attemptConnect() {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const state = useAgentStore.getState();
            if (state.autoConnectSuppressed || state.connected) return;
            const requestedUrl = state.url.trim().replace(/\/$/, "");
            hadConnectionRef.current = false;
            if (state.enabled) {
                disconnectAgent();
            }
            const discovered = await discoverAgentConfig(requestedUrl);
            const latest = useAgentStore.getState();
            if (latest.autoConnectSuppressed || latest.connected) return;
            const discoveredUrl = discovered?.url?.trim().replace(/\/$/, "") || "";
            if (discoveredUrl && latest.url.trim().replace(/\/$/, "") === requestedUrl) {
                setAgentState({ url: discoveredUrl });
            }
            if (discovered?.token) {
                setAgentState({ token: discovered.token });
            }
            if (!useAgentStore.getState().token.trim()) return;
            connectAgent({ silent: true });
        } finally {
            inFlightRef.current = false;
        }
    }
}
