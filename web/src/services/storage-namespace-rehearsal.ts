const SOURCE_DATABASE = "infinite-canvas";
const REHEARSAL_PREFIX = "infinite-canvas-migration-rehearsal-";
const LOCAL_STORAGE_KEYS = ["canvas-workspace-view", "canvas-show-connections"];
const LOCAL_STORAGE_PREFIXES = ["infinite-canvas:", "canvas-storyboard-collapsed:", "canvas-agent-", "canvas-side-panel-", "canvas-image-quick-tools-"];

type StoredRecord = { key: IDBValidKey; value: unknown };
type StoreSchema = { name: string; keyPath: string | string[] | null; autoIncrement: boolean; indexes: IndexSchema[] };
type IndexSchema = { name: string; keyPath: string | string[]; multiEntry: boolean; unique: boolean };
type DatabaseSnapshot = { name: string; version: number; stores: StoreSchema[]; records: Map<string, StoredRecord[]> };

export type StorageNamespaceSummary = {
    projects: number;
    nodes: number;
    connections: number;
    assets: number;
    generationRecords: number;
    localKeys: number;
    localBytes: number;
};

export type StorageStoreResult = { name: string; records: number; bytes: number; verified: boolean };

export type StorageNamespaceRehearsalResult = {
    sourceDatabase: string;
    sourceVersion: number;
    targetDatabase: string | null;
    summary: StorageNamespaceSummary;
    stores: StorageStoreResult[];
    localKeys: string[];
    verified: boolean;
    targetRemoved: boolean;
};

export async function scanStorageNamespace(): Promise<Omit<StorageNamespaceRehearsalResult, "targetDatabase" | "targetRemoved">> {
    if (!(await databaseExists(SOURCE_DATABASE))) {
        return { sourceDatabase: SOURCE_DATABASE, sourceVersion: 0, summary: emptySummary(), stores: [], localKeys: [], verified: false };
    }
    const snapshot = await readDatabaseSnapshot(SOURCE_DATABASE);
    return {
        sourceDatabase: snapshot.name,
        sourceVersion: snapshot.version,
        summary: summarizeSnapshot(snapshot),
        stores: snapshot.stores.map((store) => summarizeStore(store.name, snapshot.records.get(store.name) || [])),
        localKeys: readLocalStorageKeys().keys,
        verified: false,
    };
}

export async function rehearseStorageNamespaceMigration(): Promise<StorageNamespaceRehearsalResult> {
    if (!(await databaseExists(SOURCE_DATABASE))) {
        return {
            sourceDatabase: SOURCE_DATABASE,
            sourceVersion: 0,
            targetDatabase: null,
            summary: emptySummary(),
            stores: [],
            localKeys: [],
            verified: false,
            targetRemoved: false,
        };
    }

    const snapshot = await readDatabaseSnapshot(SOURCE_DATABASE);
    const targetDatabase = `${REHEARSAL_PREFIX}${Date.now()}`;
    const stores = await copyDatabaseSnapshot(snapshot, targetDatabase);
    const target = await readDatabaseSnapshot(targetDatabase);
    const verifiedStores = snapshot.stores.map((store) => verifyStore(store.name, snapshot.records.get(store.name) || [], target.records.get(store.name) || []));
    const verified = verifiedStores.every((store) => store.verified) && sameSchema(snapshot.stores, target.stores);
    const targetRemoved = await removeRehearsalDatabase(targetDatabase);

    return {
        sourceDatabase: snapshot.name,
        sourceVersion: snapshot.version,
        targetDatabase,
        summary: summarizeSnapshot(snapshot),
        stores: verifiedStores,
        localKeys: readLocalStorageKeys().keys,
        verified,
        targetRemoved,
    };
}

async function databaseExists(name: string) {
    if (typeof indexedDB === "undefined") return false;
    if (typeof indexedDB.databases === "function") {
        const databases = await indexedDB.databases();
        return databases.some((database) => database.name === name);
    }
    return true;
}

async function readDatabaseSnapshot(name: string): Promise<DatabaseSnapshot> {
    const database = await openDatabase(name);
    try {
        const names = Array.from(database.objectStoreNames);
        const stores: StoreSchema[] = [];
        const records = new Map<string, StoredRecord[]>();
        for (const storeName of names) {
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

async function copyDatabaseSnapshot(snapshot: DatabaseSnapshot, targetName: string) {
    const database = await createRehearsalDatabase(targetName, snapshot.stores);
    try {
        for (const store of snapshot.stores) {
            const records = snapshot.records.get(store.name) || [];
            const transaction = database.transaction(store.name, "readwrite");
            const target = transaction.objectStore(store.name);
            for (const record of records) {
                if (store.keyPath) target.put(record.value);
                else target.put(record.value, record.key);
            }
            await transactionDone(transaction);
        }
        return snapshot.stores.map((store) => summarizeStore(store.name, snapshot.records.get(store.name) || []));
    } finally {
        database.close();
    }
}

function createRehearsalDatabase(name: string, stores: StoreSchema[]) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
            const database = request.result;
            for (const store of stores) {
                const target = database.createObjectStore(store.name, { keyPath: store.keyPath, autoIncrement: store.autoIncrement });
                for (const index of store.indexes) {
                    target.createIndex(index.name, index.keyPath, { multiEntry: index.multiEntry, unique: index.unique });
                }
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
}

async function removeRehearsalDatabase(name: string) {
    if (!name.startsWith(REHEARSAL_PREFIX)) return false;
    return new Promise<boolean>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
        request.onblocked = () => resolve(false);
    });
}

function openDatabase(name: string) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function transactionDone(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
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

function verifyStore(name: string, source: StoredRecord[], target: StoredRecord[]): StorageStoreResult {
    const sourceMap = new Map(source.map((record) => [keyFingerprint(record.key), record.value]));
    const verified =
        source.length === target.length &&
        target.every((record) => {
            const key = keyFingerprint(record.key);
            return sourceMap.has(key) && equivalentValue(sourceMap.get(key), record.value);
        });
    return { name, records: source.length, bytes: source.reduce((total, record) => total + valueBytes(record.value), 0), verified };
}

function summarizeSnapshot(snapshot: DatabaseSnapshot): StorageNamespaceSummary {
    const canvas = persistedState(snapshot, "infinite-canvas:canvas_store");
    const assets = persistedState(snapshot, "infinite-canvas:asset_store");
    const projects = Array.isArray(canvas?.projects) ? canvas.projects : [];
    const local = readLocalStorageKeys();
    return {
        projects: projects.length,
        nodes: projects.reduce((total: number, project: unknown) => total + (isRecord(project) && Array.isArray(project.nodes) ? project.nodes.length : 0), 0),
        connections: projects.reduce((total: number, project: unknown) => total + (isRecord(project) && Array.isArray(project.connections) ? project.connections.length : 0), 0),
        assets: Array.isArray(assets?.assets) ? assets.assets.length : 0,
        generationRecords: (snapshot.records.get("image_generation_logs")?.length || 0) + (snapshot.records.get("video_generation_logs")?.length || 0),
        localKeys: local.keys.length,
        localBytes: local.bytes,
    };
}

function persistedState(snapshot: DatabaseSnapshot, recordKey: string) {
    const key = keyFingerprint(recordKey);
    const record = Array.from(snapshot.records.values()).flat().find((item) => keyFingerprint(item.key) === key);
    const value = parsePersistedValue(record?.value);
    return isRecord(value) && isRecord(value.state) ? value.state : null;
}

function parsePersistedValue(value: unknown) {
    if (typeof value === "string") {
        try {
            return JSON.parse(value) as unknown;
        } catch {
            return null;
        }
    }
    return value;
}

function summarizeStore(name: string, records: StoredRecord[]): StorageStoreResult {
    return { name, records: records.length, bytes: records.reduce((total, record) => total + valueBytes(record.value), 0), verified: false };
}

function readLocalStorageKeys() {
    try {
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
            (key): key is string => Boolean(key && (LOCAL_STORAGE_KEYS.includes(key) || LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)))),
        );
        return { keys, bytes: keys.reduce((total, key) => total + new TextEncoder().encode(`${key}${localStorage.getItem(key) || ""}`).byteLength, 0) };
    } catch {
        return { keys: [], bytes: 0 };
    }
}

function equivalentValue(source: unknown, target: unknown): boolean {
    if (source instanceof Blob && target instanceof Blob) return source.size === target.size && source.type === target.type;
    if (source instanceof ArrayBuffer && target instanceof ArrayBuffer) return source.byteLength === target.byteLength;
    if (ArrayBuffer.isView(source) && ArrayBuffer.isView(target)) return source.byteLength === target.byteLength;
    return valueFingerprint(source) === valueFingerprint(target);
}

function valueBytes(value: unknown) {
    if (value instanceof Blob) return value.size;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
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

function sameSchema(source: StoreSchema[], target: StoreSchema[]) {
    return valueFingerprint(source) === valueFingerprint(target);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function emptySummary(): StorageNamespaceSummary {
    return { projects: 0, nodes: 0, connections: 0, assets: 0, generationRecords: 0, localKeys: 0, localBytes: 0 };
}
