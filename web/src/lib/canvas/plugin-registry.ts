import { APP_VERSION, PLUGIN_REGISTRY_URL } from "@/constant/env";
import { OfficialPluginManifestError, parseOfficialPluginManifest, type OfficialPluginEntry } from "@/lib/canvas/plugin-manifest";
import i18n from "@/i18n";

export type { OfficialPluginEntry };
export { hasUpgrade } from "@/lib/canvas/plugin-manifest";

function formatManifestError(error: OfficialPluginManifestError) {
    if (error.code === "duplicate") return i18n.t("canvas.pluginErrors.registryDuplicate", { detail: error.detail });
    if (error.code === "incompatible") {
        return i18n.t("canvas.pluginErrors.registryIncompatible", {
            name: error.params.name,
            required: error.params.required,
            current: error.params.current,
        });
    }
    return i18n.t("canvas.pluginErrors.registryInvalid", { detail: error.detail });
}

// Fetch and fully validate the official registry before exposing any installer entries.
export async function fetchOfficialPlugins(registryUrl: string = PLUGIN_REGISTRY_URL): Promise<OfficialPluginEntry[]> {
    const absoluteRegistryUrl = new URL(registryUrl, window.location.href).toString();
    const response = await fetch(absoluteRegistryUrl, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(i18n.t("canvas.pluginErrors.registryFailed", { status: response.status }));

    let data: unknown;
    try {
        data = await response.json();
    } catch {
        throw new Error(i18n.t("canvas.pluginErrors.registryInvalid", { detail: "JSON" }));
    }

    try {
        return parseOfficialPluginManifest(data, absoluteRegistryUrl, APP_VERSION);
    } catch (error) {
        if (error instanceof OfficialPluginManifestError) throw new Error(formatManifestError(error));
        throw error;
    }
}
