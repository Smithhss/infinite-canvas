import type { StateStorage } from "zustand/middleware";

export const STORAGE_NAMESPACE_VERSION = 1;
export const STORAGE_NAMESPACE_PREFIX = "infinite-canvas:v1:";
export const STORAGE_DATABASE_NAME = "infinite-canvas-v1";
export const LEGACY_STORAGE_DATABASE_NAME = "infinite-canvas";
export const PLUGIN_DATABASE_NAME = "infinite-canvas-plugins-v1";
export const LEGACY_PLUGIN_DATABASE_NAME = "infinite-canvas-plugins";
export const STORAGE_NAMESPACE_OVERRIDE_KEY = "infinite-canvas:v1:storage-namespace-override";

const LEGACY_NAMESPACE_PREFIX = "infinite-canvas:";
const LEGACY_STORAGE_KEYS = new Set(["canvas-workspace-view", "canvas-show-connections", "libtv-sidebar-collapsed"]);
const LEGACY_STORAGE_PREFIXES = [LEGACY_NAMESPACE_PREFIX, "canvas-storyboard-collapsed:", "canvas-agent-", "canvas-side-panel-", "canvas-image-quick-tools-"];

export type StorageNamespace = "current" | "legacy";

let activeNamespace: StorageNamespace = "current";

export function setActiveStorageNamespace(namespace: StorageNamespace) {
    activeNamespace = namespace;
}

export function getActiveStorageNamespace() {
    return activeNamespace;
}

export function getStorageNamespaceOverride(): StorageNamespace | null {
    if (typeof localStorage === "undefined") return null;
    try {
        const value = localStorage.getItem(STORAGE_NAMESPACE_OVERRIDE_KEY);
        return value === "legacy" || value === "current" ? value : null;
    } catch {
        return null;
    }
}

export function activeDatabaseName() {
    return activeNamespace === "current" ? STORAGE_DATABASE_NAME : LEGACY_STORAGE_DATABASE_NAME;
}

export function activePluginDatabaseName() {
    return activeNamespace === "current" ? PLUGIN_DATABASE_NAME : LEGACY_PLUGIN_DATABASE_NAME;
}

export function appStorageKey(name: string) {
    if (name.startsWith(STORAGE_NAMESPACE_PREFIX)) return name;
    return `${STORAGE_NAMESPACE_PREFIX}${logicalStorageName(name)}`;
}

export function legacyAppStorageKey(name: string) {
    if (name.startsWith(STORAGE_NAMESPACE_PREFIX)) {
        return `${LEGACY_NAMESPACE_PREFIX}${name.slice(STORAGE_NAMESPACE_PREFIX.length)}`;
    }
    return name;
}

export function appStorageRecordKey(name: string) {
    return activeNamespace === "current" ? logicalStorageName(name) : name;
}

export function appSessionStorageKey(name: string) {
    return `${STORAGE_NAMESPACE_PREFIX}${logicalStorageName(name)}`;
}

export function isManagedLegacyStorageKey(key: string) {
    if (key.startsWith(STORAGE_NAMESPACE_PREFIX)) return false;
    return LEGACY_STORAGE_KEYS.has(key) || LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function migratedStorageKey(key: string) {
    return appStorageKey(key);
}

export function readAppStorageItem(name: string) {
    if (typeof localStorage === "undefined") return null;
    try {
        const primary = activeNamespace === "current" ? appStorageKey(name) : legacyAppStorageKey(name);
        const value = localStorage.getItem(primary);
        if (value !== null || activeNamespace === "legacy") return value;
        const legacy = legacyAppStorageKey(name);
        return legacy === primary ? null : localStorage.getItem(legacy);
    } catch {
        return null;
    }
}

export function writeAppStorageItem(name: string, value: string) {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(activeNamespace === "current" ? appStorageKey(name) : legacyAppStorageKey(name), value);
}

export function removeAppStorageItem(name: string) {
    if (typeof localStorage === "undefined") return;
    const currentKey = appStorageKey(name);
    const legacyKey = legacyAppStorageKey(name);
    localStorage.removeItem(currentKey);
    if (legacyKey !== currentKey) localStorage.removeItem(legacyKey);
}

export const appLocalStorage: StateStorage = {
    getItem: readAppStorageItem,
    setItem: writeAppStorageItem,
    removeItem: removeAppStorageItem,
};

function logicalStorageName(name: string) {
    return name.startsWith(LEGACY_NAMESPACE_PREFIX) ? name.slice(LEGACY_NAMESPACE_PREFIX.length) : name;
}
