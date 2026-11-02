export const OFFICIAL_PLUGIN_SCHEMA_VERSION = 1;

const PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const APP_VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export type OfficialPluginEntry = {
    id: string;
    name: string;
    version: string;
    description?: string;
    icon?: string;
    url: string;
    sha256: string;
    size: number;
    minAppVersion: string;
    platform: "browser";
};

export type OfficialPluginManifestErrorCode = "invalid" | "duplicate" | "incompatible";

export class OfficialPluginManifestError extends Error {
    constructor(
        readonly code: OfficialPluginManifestErrorCode,
        readonly detail: string,
        readonly params: Record<string, string> = {},
    ) {
        super(`Invalid official plugin manifest: ${detail}`);
        this.name = "OfficialPluginManifestError";
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseVersion(value: string): [number, number, number] | null {
    const match = APP_VERSION_PATTERN.exec(value);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function compareVersions(a: string, b: string): number {
    const [left, right] = [parseVersion(a), parseVersion(b)];
    if (!left || !right) return 0;
    for (let index = 0; index < 3; index += 1) {
        const diff = left[index] - right[index];
        if (diff !== 0) return diff;
    }
    return 0;
}

export function hasUpgrade(installedVersion: string, remoteVersion: string): boolean {
    return compareVersions(remoteVersion, installedVersion) > 0;
}

export function isAppVersionCompatible(currentVersion: string, minVersion: string): boolean {
    if (currentVersion === "dev") return true;
    return Boolean(parseVersion(currentVersion) && parseVersion(minVersion) && compareVersions(currentVersion, minVersion) >= 0);
}

function isSafeEntry(entry: string): boolean {
    return Boolean(entry) && !/^[a-z][a-z0-9+.-]*:/i.test(entry) && !entry.startsWith("/") && !entry.includes("\\") && !entry.includes("?") && !entry.includes("#") && !entry.split("/").some((part) => !part || part === "." || part === "..");
}

function requiredString(value: unknown, detail: string): string {
    if (typeof value !== "string" || !value.trim()) throw new OfficialPluginManifestError("invalid", detail);
    return value.trim();
}

function optionalString(value: unknown, detail: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string") throw new OfficialPluginManifestError("invalid", detail);
    return value;
}

// Validate the complete registry before exposing any entry to the installer.
export function parseOfficialPluginManifest(value: unknown, registryUrl: string, currentAppVersion: string): OfficialPluginEntry[] {
    if (!isRecord(value) || value.schemaVersion !== OFFICIAL_PLUGIN_SCHEMA_VERSION) {
        throw new OfficialPluginManifestError("invalid", "schemaVersion");
    }
    if (!Array.isArray(value.plugins)) throw new OfficialPluginManifestError("invalid", "plugins");

    const ids = new Set<string>();
    const entries = new Set<string>();
    return value.plugins.map((item, index) => {
        const prefix = `plugins[${index}]`;
        if (!isRecord(item)) throw new OfficialPluginManifestError("invalid", prefix);

        const id = requiredString(item.id, `${prefix}.id`);
        if (!PLUGIN_ID_PATTERN.test(id)) throw new OfficialPluginManifestError("invalid", `${prefix}.id`);
        if (ids.has(id)) throw new OfficialPluginManifestError("duplicate", id, { id });
        ids.add(id);

        const name = requiredString(item.name, `${prefix}.name`);
        const version = requiredString(item.version, `${prefix}.version`);
        if (!PLUGIN_VERSION_PATTERN.test(version)) throw new OfficialPluginManifestError("invalid", `${prefix}.version`);

        const description = optionalString(item.description, `${prefix}.description`);
        const icon = optionalString(item.icon, `${prefix}.icon`);
        const entry = requiredString(item.entry, `${prefix}.entry`);
        if (!isSafeEntry(entry)) throw new OfficialPluginManifestError("invalid", `${prefix}.entry`);
        if (entries.has(entry)) throw new OfficialPluginManifestError("duplicate", entry, { id: entry });
        entries.add(entry);

        const sha256 = requiredString(item.sha256, `${prefix}.sha256`).toLowerCase();
        if (!SHA256_PATTERN.test(sha256)) throw new OfficialPluginManifestError("invalid", `${prefix}.sha256`);

        if (!Number.isSafeInteger(item.size) || (item.size as number) < 0) {
            throw new OfficialPluginManifestError("invalid", `${prefix}.size`);
        }

        const minAppVersion = requiredString(item.minAppVersion, `${prefix}.minAppVersion`).replace(/^v/, "");
        if (!parseVersion(minAppVersion)) throw new OfficialPluginManifestError("invalid", `${prefix}.minAppVersion`);
        if (!isAppVersionCompatible(currentAppVersion, minAppVersion)) {
            throw new OfficialPluginManifestError("incompatible", id, { name, required: minAppVersion, current: currentAppVersion });
        }

        if (item.platform !== "browser") throw new OfficialPluginManifestError("invalid", `${prefix}.platform`);

        let url: URL;
        try {
            url = new URL(entry, registryUrl);
        } catch {
            throw new OfficialPluginManifestError("invalid", `${prefix}.entry`);
        }
        if (!["http:", "https:"].includes(url.protocol)) throw new OfficialPluginManifestError("invalid", `${prefix}.entry`);
        const registryBase = new URL(".", registryUrl);
        if (url.origin !== registryBase.origin || !url.pathname.startsWith(registryBase.pathname)) {
            throw new OfficialPluginManifestError("invalid", `${prefix}.entry`);
        }

        return {
            id,
            name,
            version,
            description,
            icon,
            url: url.toString(),
            sha256,
            size: item.size as number,
            minAppVersion,
            platform: "browser",
        };
    });
}
