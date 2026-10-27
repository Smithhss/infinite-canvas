export const FEATURE_FLAG_DEFAULTS = {
    creativeWorkflow: false,
    builtinCanvasAgent: false,
    director3d: false,
    panorama: false,
    quickCreate: false,
    fytBackend: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAG_DEFAULTS;

export function parseFeatureFlag(value: string | null | undefined, fallback = false) {
    if (value === "1" || value?.toLowerCase() === "true") return true;
    if (value === "0" || value?.toLowerCase() === "false") return false;
    return fallback;
}

export function isFeatureEnabled(key: FeatureFlagKey) {
    if (typeof window !== "undefined") {
        const queryValue = new URLSearchParams(window.location.search).get(`ff_${key}`);
        if (queryValue !== null) return parseFeatureFlag(queryValue, FEATURE_FLAG_DEFAULTS[key]);
    }

    const runtimeValue = typeof window !== "undefined" ? window.__RUNTIME_CONFIG__?.FEATURE_FLAGS?.[key] : undefined;
    const buildValue = import.meta.env[`VITE_FEATURE_${key.toUpperCase()}` as keyof ImportMetaEnv];
    return parseFeatureFlag(runtimeValue ?? buildValue, FEATURE_FLAG_DEFAULTS[key]);
}
