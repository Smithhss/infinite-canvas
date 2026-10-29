import { create } from "zustand";

import i18n from "@/i18n";
import { isPlatformProvider, providerAllowed, readProviderPolicy } from "@/lib/provider-policy";

export function isManagedCanvas() {
    const runtime = typeof window !== "undefined" ? window.__RUNTIME_CONFIG__?.FYT_MANAGED : undefined;
    return /^(1|true)$/i.test(runtime ?? import.meta.env?.VITE_FYT_MANAGED ?? "");
}

export const useProviderPolicyStore = create<{
    status: "loading" | "ready" | "error";
    allowExternalProviders: boolean;
}>(() => ({ status: isManagedCanvas() ? "loading" : "ready", allowExternalProviders: !isManagedCanvas() }));

let policyRequestVersion = 0;

export async function refreshProviderPolicy() {
    if (!isManagedCanvas()) return true;
    const requestVersion = ++policyRequestVersion;
    try {
        const allowed = await readProviderPolicy();
        if (requestVersion === policyRequestVersion) {
            useProviderPolicyStore.setState({ status: "ready", allowExternalProviders: allowed });
        }
        return allowed;
    } catch {
        if (requestVersion === policyRequestVersion) {
            useProviderPolicyStore.setState({ status: "error", allowExternalProviders: false });
        }
        throw new Error(i18n.t("providerPolicy.unavailable"));
    }
}

export function isProviderCurrentlyAllowed(baseUrl: string, customScript = false) {
    if (!isManagedCanvas()) return true;
    const policy = useProviderPolicyStore.getState();
    return policy.status === "ready" && providerAllowed(policy.allowExternalProviders, baseUrl, window.location.origin, customScript);
}

export async function assertProviderAccess(baseUrl: string, customScript = false) {
    if (!isManagedCanvas()) return;
    if (!customScript && isPlatformProvider(baseUrl, window.location.origin)) return;
    const allowed = await refreshProviderPolicy();
    if (!providerAllowed(allowed, baseUrl, window.location.origin, customScript)) throw new Error(i18n.t("providerPolicy.blocked"));
}
