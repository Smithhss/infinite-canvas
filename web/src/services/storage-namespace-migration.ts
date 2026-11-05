import {
    getStorageNamespaceOverride,
    isManagedLegacyStorageKey,
    LEGACY_PLUGIN_DATABASE_NAME,
    LEGACY_STORAGE_DATABASE_NAME,
    migratedStorageKey,
    PLUGIN_DATABASE_NAME,
    setActiveStorageNamespace,
    STORAGE_DATABASE_NAME,
    STORAGE_NAMESPACE_VERSION,
    type StorageNamespace,
} from "@/lib/storage-namespace";

const MIGRATION_META_STORE = "migration_meta";
const TARGET_DATABASE_VERSION = 2;
const MIGRATION_OWNER = "infinite-canvas-storage-migration";
const MIGRATION_LOCK_NAME = "infinite-canvas:v1:storage-migration";
const KNOWN_STORES = ["app_state", "image_files", "image_previews", "image_generation_logs", "video_generation_logs", "media_files", "prompt_cache", "agent_memory", "agent_skill_favorites", "local-forage-detect-blob-support"];

type StoredRecord = { key: IDBValidKey; value: unknown };
type StoreSchema = { name: string; keyPath: string | string[] | null; autoIncrement: boolean; indexes: IndexSchema[] };
type IndexSchema = { name: string; keyPath: string | string[]; multiEntry: boolean; unique: boolean };
type DatabaseSnapshot = { name: string; version: number; stores: StoreSchema[]; records: Map<string, StoredRecord[]> };
type LocalPreference = { key: string; value: string };
type MigrationMeta = { key: string; value: unknown };
type MigrationMarker = {
    version: number;
    owner: string;
    sourceDatabase: string;
    sourceVersion: number;
    targetDatabase: string;
    migratedAt: string;
    stores: number;
    records: number;
    bytes: number;
};

export type StorageMigrationStatus = "idle" | "ready" | "migrated" | "fresh" | "legacy-fallback" | "override-legacy";

export type StorageMigrationState = {
    status: StorageMigrationStatus;
    namespace: StorageNamespace;
    database: string;
    sourceVersion: number;
    stores: number;
    records: number;
    bytes: number;
    reason: string;
};

let initialization: Promise<StorageMigrationState> | null = null;
let runtimeState: StorageMigrationState = {
    status: "idle",
    namespace: "current",
    database: STORAGE_DATABASE_NAME,
    sourceVersion: 0,
    stores: 0,
    records: 0,
    bytes: 0,
    reason: "",
};

export function getStorageMigrationState() {
    return runtimeState;
}

export function initializeStorageNamespace() {
    if (!initialization) initialization = bootstrapStorageNamespace();
    return initialization;
}

async function bootstrapStorageNamespace(): Promise<StorageMigrationState> {
    if (typeof indexedDB === "undefined") {
        return finish({ status: "ready", namespace: "current", database: STORAGE_DATABASE_NAME, sourceVersion: 0, stores: 0, records: 0, bytes: 0, reason: "indexeddb-unavailable" });
    }

    const override = getStorageNamespaceOverride();
    if (override === "legacy") {
        return finish({ status: "override-legacy", namespace: "legacy", database: LEGACY_STORAGE_DATABASE_NAME, sourceVersion: 0, stores: 0, records: 0, bytes: 0, reason: "manual-override" });
    }

    try {
        const marker = await readMigrationMarker(STORAGE_DATABASE_NAME);
        if (marker?.version === STORAGE_NAMESPACE_VERSION) {
            return finish({ status: "ready", namespace: "current", database: STORAGE_DATABASE_NAME, sourceVersion: marker.sourceVersion, stores: marker.stores, records: marker.records, bytes: marker.bytes, reason: "" });
        }
        if (marker) throw new Error("storage-migration-marker-version-unsupported");

        const legacyExists = await databaseExists(LEGACY_STORAGE_DATABASE_NAME);
        if (!legacyExists) {
            const fresh = await createFreshStorageNamespace();
            return finish({ status: "fresh", namespace: "current", database: STORAGE_DATABASE_NAME, ...fresh, reason: "" });
        }

        const migrated = await withMigrationLock(() => migrateLegacyStorageNamespace());
        return finish({ status: "migrated", namespace: "current", database: STORAGE_DATABASE_NAME, ...migrated, reason: "" });
    } catch (error) {
        return finish({
            status: "legacy-fallback",
            namespace: "legacy",
            database: LEGACY_STORAGE_DATABASE_NAME,
            sourceVersion: 0,
            stores: 0,
            records: 0,
            bytes: 0,
            reason: error instanceof Error ? error.message : String(error),
        });
    }
}

async function createFreshStorageNamespace() {
    const appStores = KNOWN_STORES.map((name) => ({ name, keyPath: null, autoIncrement: false, indexes: [] }));
    const database = await openTargetDatabase(STORAGE_DATABASE_NAME, [...appStores, migrationMetaSchema()]);
    try {
        await ensureOwned(database, { version: STORAGE_NAMESPACE_VERSION, owner: MIGRATION_OWNER });
        const preferences = readLegacyLocalPreferences();
        await writeMeta(database, { key: "local-preferences-backup", value: { version: 1, createdAt: new Date().toISOString(), values: preferences } });
        migrateLocalPreferences(preferences);
        verifyMigratedLocalPreferences(preferences);
        const marker: MigrationMarker = {
            version: STORAGE_NAMESPACE_VERSION,
            owner: MIGRATION_OWNER,
            sourceDatabase: "",
            sourceVersion: 0,
            targetDatabase: STORAGE_DATABASE_NAME,
            migratedAt: new Date().toISOString(),
            stores: appStores.length,
            records: 0,
            bytes: 0,
        };
        await writeMeta(database, { key: "migration", value: marker });
        return { sourceVersion: 0, stores: appStores.length, records: 0, bytes: 0 };
    } finally {
        database.close();
    }
}

async function migrateLegacyStorageNamespace() {
    const source = await readDatabaseSnapshot(LEGACY_STORAGE_DATABASE_NAME);
    validateSourceSnapshot(source);
    const preferences = readLegacyLocalPreferences();
    await assertStorageCapacity(snapshotBytes(source) + localPreferencesBytes(preferences));

    const stores = [...source.stores, migrationMetaSchema()];
    const database = await openTargetDatabase(STORAGE_DATABASE_NAME, stores);
    try {
        await ensureOwned(database, { version: STORAGE_NAMESPACE_VERSION, owner: MIGRATION_OWNER });
        await copySnapshot(source, database, "migrate");
        await writeMeta(database, { key: "local-preferences-backup", value: { version: 1, createdAt: new Date().toISOString(), values: preferences } });
        await migratePluginDatabase();

        const target = await readDatabaseSnapshot(STORAGE_DATABASE_NAME);
        verifySnapshotMigration(source, target);
        const summary = summarizeSnapshot(target);
        migrateLocalPreferences(preferences);
        verifyMigratedLocalPreferences(preferences);

        const marker: MigrationMarker = {
            version: STORAGE_NAMESPACE_VERSION,
            owner: MIGRATION_OWNER,
            sourceDatabase: source.name,
            sourceVersion: source.version,
            targetDatabase: target.name,
            migratedAt: new Date().toISOString(),
            stores: source.stores.length,
            records: summary.records,
            bytes: summary.bytes,
        };
        await writeMeta(database, { key: "migration", value: marker });
        return { sourceVersion: source.version, stores: marker.stores, records: marker.records, bytes: marker.bytes };
    } finally {
        database.close();
    }
}

async function migratePluginDatabase() {
    if (!(await databaseExists(LEGACY_PLUGIN_DATABASE_NAME))) return;
    const source = await readDatabaseSnapshot(LEGACY_PLUGIN_DATABASE_NAME);
    if (!source.stores.length) return;
    const stores = [...source.stores, migrationMetaSchema()];
    const database = await openTargetDatabase(PLUGIN_DATABASE_NAME, stores);
    try {
        await ensureOwned(database, { version: STORAGE_NAMESPACE_VERSION, owner: MIGRATION_OWNER });
        await copySnapshot(source, database, "preserve");
        const target = await readDatabaseSnapshot(PLUGIN_DATABASE_NAME);
        verifySnapshotMigration(source, target);
    } finally {
        database.close();
    }
}

async function openTargetDatabase(name: string, stores: StoreSchema[]) {
    if (!(await databaseExists(name))) return openDatabaseForUpgrade(name, TARGET_DATABASE_VERSION, stores);

    const current = await openDatabase(name);
    const version = current.version;
    const existingNames = new Set(Array.from(current.objectStoreNames));
    current.close();
    if (version >= TARGET_DATABASE_VERSION && stores.some((store) => !existingNames.has(store.name))) throw new Error("storage-target-schema-unknown");
    if (version > TARGET_DATABASE_VERSION) throw new Error("storage-target-version-unsupported");
    if (version < TARGET_DATABASE_VERSION) return openDatabaseForUpgrade(name, TARGET_DATABASE_VERSION, stores);

    const database = await openDatabase(name);
    if (stores.some((store) => !database.objectStoreNames.contains(store.name))) {
        database.close();
        throw new Error("storage-target-schema-unknown");
    }
    return database;
}

function openDatabaseForUpgrade(name: string, version: number, stores: StoreSchema[]) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("storage-database-blocked"));
        request.onupgradeneeded = () => {
            const database = request.result;
            for (const store of stores) {
                const target = database.objectStoreNames.contains(store.name) ? request.transaction!.objectStore(store.name) : database.createObjectStore(store.name, { keyPath: store.keyPath, autoIncrement: store.autoIncrement });
                for (const index of store.indexes) {
                    if (!target.indexNames.contains(index.name)) target.createIndex(index.name, index.keyPath, { multiEntry: index.multiEntry, unique: index.unique });
                }
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
}

async function ensureOwned(database: IDBDatabase, owner: unknown) {
    const existingOwner = await readMeta(database, "owner");
    if (existingOwner !== null) {
        if (valueFingerprint(existingOwner) !== valueFingerprint(owner)) throw new Error("storage-target-owner-mismatch");
        return;
    }
    if (await databaseHasRecords(database)) throw new Error("storage-target-has-unknown-data");
    await writeMeta(database, { key: "owner", value: owner });
}

async function databaseHasRecords(database: IDBDatabase) {
    for (const storeName of Array.from(database.objectStoreNames)) {
        if (storeName === MIGRATION_META_STORE) continue;
        const count = await countStore(database, storeName);
        if (count > 0) return true;
    }
    return false;
}

function countStore(database: IDBDatabase, storeName: string) {
    return new Promise<number>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function copySnapshot(source: DatabaseSnapshot, target: IDBDatabase, keyMode: "migrate" | "preserve") {
    for (const store of source.stores) {
        const transaction = target.transaction(store.name, "readwrite");
        const objectStore = transaction.objectStore(store.name);
        for (const record of source.records.get(store.name) || []) {
            const key = keyMode === "migrate" ? migratedRecordKey(store.name, record.key) : record.key;
            if (store.keyPath) objectStore.put(record.value);
            else objectStore.put(record.value, key);
        }
        await transactionDone(transaction);
    }
}

function verifySnapshotMigration(source: DatabaseSnapshot, target: DatabaseSnapshot) {
    const targetStores = new Map(target.stores.map((store) => [store.name, store]));
    for (const sourceStore of source.stores) {
        const targetStore = targetStores.get(sourceStore.name);
        if (!targetStore || valueFingerprint(sourceStore) !== valueFingerprint(targetStore)) throw new Error(`storage-schema-mismatch:${sourceStore.name}`);
        const sourceRecords = expectedRecords(sourceStore.name, source.records.get(sourceStore.name) || []);
        const targetRecords = target.records.get(sourceStore.name) || [];
        if (!recordsEqual(sourceRecords, targetRecords)) throw new Error(`storage-records-mismatch:${sourceStore.name}`);
    }
    const sourceSummary = criticalRecordSummary(source.records);
    const targetSummary = criticalRecordSummary(target.records);
    if (valueFingerprint(sourceSummary) !== valueFingerprint(targetSummary)) throw new Error("storage-critical-ids-mismatch");
}

function expectedRecords(storeName: string, records: StoredRecord[]) {
    return records.map((record) => ({ key: migratedRecordKey(storeName, record.key), value: record.value }));
}

function recordsEqual(source: StoredRecord[], target: StoredRecord[]) {
    if (source.length !== target.length) return false;
    const targetByKey = new Map(target.map((record) => [keyFingerprint(record.key), record.value]));
    return source.every((record) => targetByKey.has(keyFingerprint(record.key)) && equivalentValue(record.value, targetByKey.get(keyFingerprint(record.key))));
}

function migratedRecordKey(storeName: string, key: IDBValidKey): IDBValidKey {
    if (storeName !== "app_state" || typeof key !== "string" || !key.startsWith("infinite-canvas:")) return key;
    return key.slice("infinite-canvas:".length);
}

function validateSourceSnapshot(snapshot: DatabaseSnapshot) {
    for (const store of snapshot.stores) {
        if (!store.name || store.name === MIGRATION_META_STORE) throw new Error("storage-source-schema-unknown");
        const records = snapshot.records.get(store.name) || [];
        if (["image_files", "media_files"].includes(store.name) && records.some((record) => !(record.value instanceof Blob))) {
            throw new Error(`storage-binary-record-damaged:${store.name}`);
        }
        if (store.name === "image_previews" && records.some((record) => !isStoredPreview(record.value))) throw new Error("storage-preview-record-damaged");
        if (["image_generation_logs", "video_generation_logs"].includes(store.name) && records.some((record) => typeof record.key !== "string" || !record.key)) {
            throw new Error(`storage-log-id-damaged:${store.name}`);
        }
    }
    criticalRecordSummary(snapshot.records);
}

function criticalRecordSummary(records: Map<string, StoredRecord[]>) {
    const appState = new Map<string, unknown>();
    for (const record of records.get("app_state") || []) {
        if (typeof record.key !== "string") throw new Error("storage-app-state-key-damaged");
        const logicalKey = migratedRecordKey("app_state", record.key) as string;
        if (appState.has(logicalKey)) throw new Error(`storage-app-state-duplicate:${logicalKey}`);
        appState.set(logicalKey, parsePersistedValue(record.value));
    }

    const canvas = persistedStateValue(appState.get("canvas_store"));
    const projects = Array.isArray(canvas?.projects) ? canvas.projects : [];
    const projectIds = uniqueIds(projects, "canvas-project-id-damaged");
    let nodes = 0;
    let connections = 0;
    for (const project of projects) {
        if (!isRecord(project)) throw new Error("storage-canvas-project-damaged");
        if (!Array.isArray(project.nodes) || !Array.isArray(project.connections)) throw new Error("storage-canvas-graph-damaged");
        uniqueIds(project.nodes, "canvas-node-id-damaged");
        uniqueIds(project.connections, "canvas-connection-id-damaged");
        nodes += project.nodes.length;
        connections += project.connections.length;
    }

    const assets = persistedStateValue(appState.get("asset_store"));
    const assetItems = Array.isArray(assets?.assets) ? assets.assets : [];
    uniqueIds(assetItems, "asset-id-damaged");

    const workflows = persistedStateValue(appState.get("workflow_store"));
    const workflowItems = Array.isArray(workflows?.workflows) ? workflows.workflows : [];
    uniqueIds(workflowItems, "workflow-id-damaged");

    const plugins = persistedStateValue(appState.get("plugin_store"));
    const pluginItems = Array.isArray(plugins?.plugins) ? plugins.plugins : [];
    uniqueIds(pluginItems, "plugin-id-damaged");

    for (const storeName of ["image_generation_logs", "video_generation_logs"]) {
        const keys = (records.get(storeName) || []).map((record) => keyFingerprint(record.key));
        if (new Set(keys).size !== keys.length) throw new Error(`storage-log-id-duplicate:${storeName}`);
    }

    return {
        projects: projectIds.length,
        nodes,
        connections,
        assets: assetItems.length,
        workflows: workflowItems.length,
        plugins: pluginItems.length,
        imageLogs: records.get("image_generation_logs")?.length || 0,
        videoLogs: records.get("video_generation_logs")?.length || 0,
    };
}

function uniqueIds(items: unknown[], error: string) {
    const ids = items.map((item) => {
        if (!isRecord(item) || typeof item.id !== "string" || !item.id) throw new Error(error);
        return item.id;
    });
    if (new Set(ids).size !== ids.length) throw new Error(error);
    return ids;
}

async function assertStorageCapacity(additionalBytes: number) {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    const estimate = await navigator.storage.estimate();
    if (typeof estimate.quota !== "number" || typeof estimate.usage !== "number") return;
    if (estimate.usage + additionalBytes > estimate.quota) throw new Error("storage-quota-insufficient");
}

function readLegacyLocalPreferences(): LocalPreference[] {
    if (typeof window === "undefined") return [];
    const preferences: LocalPreference[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !isManagedLegacyStorageKey(key)) continue;
        const value = window.localStorage.getItem(key);
        if (value !== null) preferences.push({ key, value });
    }
    return preferences.sort((a, b) => a.key.localeCompare(b.key));
}

function migrateLocalPreferences(preferences: LocalPreference[]) {
    if (typeof window === "undefined") return;
    for (const preference of preferences) window.localStorage.setItem(migratedStorageKey(preference.key), preference.value);
}

function verifyMigratedLocalPreferences(preferences: LocalPreference[]) {
    if (typeof window === "undefined") return;
    for (const preference of preferences) {
        if (window.localStorage.getItem(migratedStorageKey(preference.key)) !== preference.value) throw new Error(`storage-preference-mismatch:${preference.key}`);
    }
}

function localPreferencesBytes(preferences: LocalPreference[]) {
    return preferences.reduce((total, preference) => total + new TextEncoder().encode(`${preference.key}${preference.value}`).byteLength, 0);
}

function snapshotBytes(snapshot: DatabaseSnapshot) {
    let bytes = 0;
    for (const records of snapshot.records.values()) {
        for (const record of records) bytes += valueBytes(record.value);
    }
    return bytes;
}

function summarizeSnapshot(snapshot: DatabaseSnapshot) {
    const records = Array.from(snapshot.records.values()).reduce((total, items) => total + items.length, 0);
    return { records, bytes: snapshotBytes(snapshot) };
}

async function readMigrationMarker(databaseName: string): Promise<MigrationMarker | null> {
    if (!(await databaseExists(databaseName))) return null;
    const database = await openDatabase(databaseName);
    try {
        if (!database.objectStoreNames.contains(MIGRATION_META_STORE)) return null;
        const value = await readMeta(database, "migration");
        if (value === null) return null;
        if (!isRecord(value) || value.owner !== MIGRATION_OWNER || typeof value.version !== "number") throw new Error("storage-migration-marker-damaged");
        return value as MigrationMarker;
    } finally {
        database.close();
    }
}

function readMeta(database: IDBDatabase, key: string) {
    return new Promise<unknown>((resolve, reject) => {
        if (!database.objectStoreNames.contains(MIGRATION_META_STORE)) {
            resolve(null);
            return;
        }
        const transaction = database.transaction(MIGRATION_META_STORE, "readonly");
        const request = transaction.objectStore(MIGRATION_META_STORE).get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const record = request.result as MigrationMeta | undefined;
            resolve(record && "value" in record ? record.value : null);
        };
    });
}

function writeMeta(database: IDBDatabase, record: MigrationMeta) {
    return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(MIGRATION_META_STORE, "readwrite");
        transaction.objectStore(MIGRATION_META_STORE).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

async function readDatabaseSnapshot(name: string): Promise<DatabaseSnapshot> {
    const database = await openDatabase(name);
    try {
        const stores: StoreSchema[] = [];
        const records = new Map<string, StoredRecord[]>();
        for (const storeName of Array.from(database.objectStoreNames)) {
            const transaction = database.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            stores.push(readStoreSchema(store));
            records.set(storeName, await readAllRecords(store));
            await transactionDone(transaction);
        }
        return { name, version: database.version, stores, records };
    } finally {
        database.close();
    }
}

function readStoreSchema(store: IDBObjectStore): StoreSchema {
    return {
        name: store.name,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes: Array.from(store.indexNames).map((name) => {
            const index = store.index(name);
            return { name, keyPath: index.keyPath, multiEntry: index.multiEntry, unique: index.unique };
        }),
    };
}

function readAllRecords(store: IDBObjectStore) {
    return new Promise<StoredRecord[]>((resolve, reject) => {
        const records: StoredRecord[] = [];
        const request = store.openCursor();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
                resolve(records);
                return;
            }
            records.push({ key: cursor.primaryKey, value: cursor.value });
            cursor.continue();
        };
    });
}

function openDatabase(name: string) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("storage-database-blocked"));
        request.onsuccess = () => resolve(request.result);
    });
}

async function databaseExists(name: string) {
    if (typeof indexedDB === "undefined") return false;
    if (typeof indexedDB.databases === "function") return (await indexedDB.databases()).some((database) => database.name === name);
    return new Promise<boolean>((resolve) => {
        let creating = false;
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => {
            creating = true;
            request.transaction?.abort();
        };
        request.onsuccess = () => {
            request.result.close();
            resolve(true);
        };
        request.onerror = () => resolve(!creating);
    });
}

function transactionDone(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function withMigrationLock<T>(task: () => Promise<T>): Promise<T> {
    if (typeof navigator === "undefined" || !navigator.locks?.request) return Promise.reject(new Error("storage-migration-lock-unavailable"));
    return navigator.locks.request(MIGRATION_LOCK_NAME, task) as Promise<T>;
}

function persistedStateValue(value: unknown) {
    return isRecord(value) && isRecord(value.state) ? value.state : null;
}

function parsePersistedValue(value: unknown) {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value) as unknown;
    } catch {
        throw new Error("storage-json-record-damaged");
    }
}

function equivalentValue(source: unknown, target: unknown): boolean {
    if (source instanceof Blob && target instanceof Blob) return source.size === target.size && source.type === target.type;
    if (source instanceof ArrayBuffer && target instanceof ArrayBuffer) return source.byteLength === target.byteLength;
    if (ArrayBuffer.isView(source) && ArrayBuffer.isView(target)) return source.byteLength === target.byteLength;
    if (isRecord(source) && isRecord(target)) {
        const sourceKeys = Object.keys(source);
        const targetKeys = Object.keys(target);
        return sourceKeys.length === targetKeys.length && sourceKeys.every((key) => key in target && equivalentValue(source[key], target[key]));
    }
    return valueFingerprint(source) === valueFingerprint(target);
}

function valueBytes(value: unknown): number {
    if (value instanceof Blob) return value.size;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (Array.isArray(value)) return value.reduce<number>((total, item) => total + valueBytes(item), 0);
    if (isRecord(value)) return Object.values(value).reduce<number>((total, item) => total + valueBytes(item), 0);
    return new TextEncoder().encode(typeof value === "string" ? value : valueFingerprint(value)).byteLength;
}

function valueFingerprint(value: unknown) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function keyFingerprint(key: IDBValidKey) {
    if (key instanceof Date) return `date:${key.toISOString()}`;
    if (Array.isArray(key)) return `array:${JSON.stringify(key)}`;
    return `${typeof key}:${String(key)}`;
}

function migrationMetaSchema(): StoreSchema {
    return { name: MIGRATION_META_STORE, keyPath: "key", autoIncrement: false, indexes: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isStoredPreview(value: unknown) {
    return value instanceof Blob || (isRecord(value) && typeof value.version === "number" && (value.blob === undefined || value.blob instanceof Blob));
}

function finish(state: StorageMigrationState) {
    setActiveStorageNamespace(state.namespace);
    runtimeState = state;
    return state;
}
