import localforage from "localforage";
import type { StateStorage } from "zustand/middleware";

import { activeDatabaseName, activePluginDatabaseName, appStorageRecordKey, readAppStorageItem, removeAppStorageItem, writeAppStorageItem } from "@/lib/storage-namespace";

localforage.config({
    name: activeDatabaseName(),
    storeName: "app_state",
});

export const localForageStorage: StateStorage = {
    getItem: async (name) => {
        if (typeof window === "undefined") return null;
        try {
            return (await localforage.getItem<string>(appStorageRecordKey(name))) || readAppStorageItem(name);
        } catch {
            return readAppStorageItem(name);
        }
    },
    setItem: async (name, value) => {
        if (typeof window === "undefined") return;
        try {
            await localforage.setItem(appStorageRecordKey(name), value);
        } catch {
            writeAppStorageItem(name, value);
        }
    },
    removeItem: async (name) => {
        if (typeof window === "undefined") return;
        try {
            await localforage.removeItem(appStorageRecordKey(name));
        } catch {
            removeAppStorageItem(name);
        }
    },
};

export function createAppStorageInstance(storeName: string) {
    return localforage.createInstance({ name: activeDatabaseName(), storeName });
}

export function createPluginStorageInstance(pluginId: string) {
    return localforage.createInstance({ name: activePluginDatabaseName(), storeName: pluginId });
}
