import { expect, test } from "bun:test";

import { sha256Hex, verifySha256 } from "../src/lib/canvas/plugin-integrity";
import { OfficialPluginManifestError, hasUpgrade, parseOfficialPluginManifest } from "../src/lib/canvas/plugin-manifest";

const registryUrl = "https://cdn.example.com/plugins/official-plugins.json";
const sha256 = "a".repeat(64);

function manifest(overrides: Record<string, unknown> = {}) {
    return {
        schemaVersion: 1,
        plugins: [
            {
                id: "sticky-note",
                name: "Sticky Note",
                version: "1.1.0",
                description: "A note node",
                icon: "N",
                entry: "sticky-note.js",
                sha256,
                size: 1234,
                minAppVersion: "0.23.0",
                platform: "browser",
                ...overrides,
            },
        ],
    };
}

function expectManifestError(action: () => unknown, code: OfficialPluginManifestError["code"], detail?: string) {
    try {
        action();
    } catch (error) {
        expect(error).toBeInstanceOf(OfficialPluginManifestError);
        const manifestError = error as OfficialPluginManifestError;
        expect(manifestError.code).toBe(code);
        if (detail) expect(manifestError.detail).toBe(detail);
        return;
    }
    throw new Error("Expected manifest validation to fail");
}

test("parses and resolves a valid official plugin manifest", () => {
    const [entry] = parseOfficialPluginManifest(manifest(), registryUrl, "v0.23.0");

    expect(entry).toMatchObject({
        id: "sticky-note",
        version: "1.1.0",
        sha256,
        size: 1234,
        minAppVersion: "0.23.0",
        platform: "browser",
        url: "https://cdn.example.com/plugins/sticky-note.js",
    });
});

test("fails closed for unknown schema versions", () => {
    expectManifestError(() => parseOfficialPluginManifest({ schemaVersion: 2, plugins: [] }, registryUrl, "v0.23.0"), "invalid", "schemaVersion");
});

test("rejects duplicate plugin IDs and duplicate entries", () => {
    const duplicateId = manifest();
    duplicateId.plugins.push({ ...duplicateId.plugins[0], entry: "other.js" });
    expectManifestError(() => parseOfficialPluginManifest(duplicateId, registryUrl, "v0.23.0"), "duplicate", "sticky-note");

    const duplicateEntry = manifest();
    duplicateEntry.plugins.push({ ...duplicateEntry.plugins[0], id: "other", sha256: "b".repeat(64) });
    expectManifestError(() => parseOfficialPluginManifest(duplicateEntry, registryUrl, "v0.23.0"), "duplicate", "sticky-note.js");
});

test("requires a valid SHA-256 and positive size metadata", () => {
    expectManifestError(() => parseOfficialPluginManifest(manifest({ sha256: undefined }), registryUrl, "v0.23.0"), "invalid", "plugins[0].sha256");
    expectManifestError(() => parseOfficialPluginManifest(manifest({ sha256: "not-a-hash" }), registryUrl, "v0.23.0"), "invalid", "plugins[0].sha256");
    expectManifestError(() => parseOfficialPluginManifest(manifest({ size: -1 }), registryUrl, "v0.23.0"), "invalid", "plugins[0].size");
});

test("rejects unsafe entries and unsupported platforms", () => {
    expectManifestError(() => parseOfficialPluginManifest(manifest({ entry: "../sticky-note.js" }), registryUrl, "v0.23.0"), "invalid", "plugins[0].entry");
    expectManifestError(() => parseOfficialPluginManifest(manifest({ entry: "%2e%2e/sticky-note.js" }), registryUrl, "v0.23.0"), "invalid", "plugins[0].entry");
    expectManifestError(() => parseOfficialPluginManifest(manifest({ entry: "https://evil.example/plugin.js" }), registryUrl, "v0.23.0"), "invalid", "plugins[0].entry");
    expectManifestError(() => parseOfficialPluginManifest(manifest({ platform: "node" }), registryUrl, "v0.23.0"), "invalid", "plugins[0].platform");
});

test("rejects plugins that require a newer app version", () => {
    expectManifestError(() => parseOfficialPluginManifest(manifest({ minAppVersion: "0.24.0" }), registryUrl, "v0.23.0"), "incompatible", "sticky-note");
});

test("compares versions without depending on a leading v", () => {
    expect(hasUpgrade("1.1.0", "1.2.0")).toBe(true);
    expect(hasUpgrade("v1.2.0", "1.2.0")).toBe(false);
    expect(hasUpgrade("1.10.0", "1.9.0")).toBe(false);
});

test("hashes downloaded bytes for integrity verification", async () => {
    const bytes = new TextEncoder().encode("hello");
    expect(await sha256Hex(bytes)).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(await verifySha256(bytes, "2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824")).toBe(true);
    expect(await verifySha256(bytes, "b".repeat(64))).toBe(false);
});
