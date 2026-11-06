import { expect, test } from "bun:test";

import { reconnectAgentWithDiscovery, suspendAgentAutoConnectForEdit } from "@/hooks/use-agent-auto-connect";
import { useAgentStore } from "@/stores/use-agent-store";

test("manual reconnect clears auto-connect suppression and requests discovery", () => {
    useAgentStore.setState({ enabled: true, connected: false, autoConnectSuppressed: true, autoConnectRequest: 4 });

    reconnectAgentWithDiscovery();

    const state = useAgentStore.getState();
    expect(state.enabled).toBe(false);
    expect(state.connected).toBe(false);
    expect(state.autoConnectSuppressed).toBe(false);
    expect(state.autoConnectRequest).toBe(5);
});

test("editing the endpoint or token pauses auto-connect and keeps the draft", () => {
    useAgentStore.setState({ enabled: true, connected: true, autoConnectSuppressed: false, url: "http://127.0.0.1:17371", token: "saved-token" });

    suspendAgentAutoConnectForEdit({ url: "http://127.0.0.1:19999" });

    const state = useAgentStore.getState();
    expect(state.enabled).toBe(false);
    expect(state.connected).toBe(false);
    expect(state.autoConnectSuppressed).toBe(true);
    expect(state.url).toBe("http://127.0.0.1:19999");
    expect(state.token).toBe("saved-token");
});

test("editing the token pauses auto-connect without replacing the endpoint", () => {
    useAgentStore.setState({ enabled: true, connected: true, autoConnectSuppressed: false, url: "http://127.0.0.1:17371", token: "saved-token" });

    suspendAgentAutoConnectForEdit({ token: "draft-token" });

    const state = useAgentStore.getState();
    expect(state.enabled).toBe(false);
    expect(state.connected).toBe(false);
    expect(state.autoConnectSuppressed).toBe(true);
    expect(state.url).toBe("http://127.0.0.1:17371");
    expect(state.token).toBe("draft-token");
});
