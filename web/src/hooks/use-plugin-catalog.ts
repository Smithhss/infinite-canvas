import { App } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { installPluginFromUrl, setPluginEnabled, uninstallPlugin, updatePlugin } from "@/lib/canvas/plugin-loader";
import { fetchOfficialPlugins, hasUpgrade, type OfficialPluginEntry } from "@/lib/canvas/plugin-registry";
import { usePluginStore, type InstalledPlugin } from "@/stores/canvas/use-plugin-store";

export function usePluginCatalog({ active }: { active: boolean }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const plugins = usePluginStore((state) => state.plugins);
    const [url, setUrl] = useState("");
    const [installing, setInstalling] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [official, setOfficial] = useState<OfficialPluginEntry[]>([]);
    const [loadingOfficial, setLoadingOfficial] = useState(false);
    const [officialError, setOfficialError] = useState<string | null>(null);

    const officialRecordById = useMemo(() => new Map(plugins.filter((item) => item.official).map((item) => [item.id, item])), [plugins]);
    const localPlugins = useMemo(() => plugins.filter((item) => item.local), [plugins]);
    const thirdPartyPlugins = useMemo(() => plugins.filter((item) => !item.local && !item.official), [plugins]);

    const loadOfficial = useCallback(async () => {
        setLoadingOfficial(true);
        setOfficialError(null);
        try {
            setOfficial(await fetchOfficialPlugins());
        } catch (error) {
            setOfficialError(error instanceof Error ? error.message : String(error));
        } finally {
            setLoadingOfficial(false);
        }
    }, []);

    useEffect(() => {
        if (active && official.length === 0 && !loadingOfficial && !officialError) void loadOfficial();
    }, [active, official.length, loadingOfficial, officialError, loadOfficial]);

    const runOnPlugin = useCallback(
        async (record: InstalledPlugin, action: () => Promise<void> | void, successText: string) => {
            setBusyId(record.id);
            try {
                await action();
                message.success(successText);
            } catch (error) {
                message.error(error instanceof Error ? error.message : String(error));
            } finally {
                setBusyId(null);
            }
        },
        [message],
    );

    const installFromUrl = useCallback(async () => {
        const target = url.trim();
        if (!target) return;
        try {
            const parsed = new URL(target);
            if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        } catch {
            message.error(t("canvas.plugins.invalidUrl"));
            return;
        }
        setInstalling(true);
        try {
            const plugin = await installPluginFromUrl(target);
            message.success(t("canvas.plugins.installedPlugin", { name: plugin.name }));
            setUrl("");
        } catch (error) {
            message.error(t("canvas.plugins.installFailed", { error: error instanceof Error ? error.message : String(error) }));
        } finally {
            setInstalling(false);
        }
    }, [message, t, url]);

    const installOfficial = useCallback(
        async (entry: OfficialPluginEntry) => {
            setBusyId(entry.id);
            try {
                const plugin = await installPluginFromUrl(entry.url, { official: true, bustCache: true, expected: officialExpectation(entry) });
                message.success(t("canvas.plugins.installed", { name: plugin.name }));
            } catch (error) {
                message.error(t("canvas.plugins.installFailed", { error: error instanceof Error ? error.message : String(error) }));
            } finally {
                setBusyId(null);
            }
        },
        [message, t],
    );

    const togglePlugin = useCallback((record: InstalledPlugin, enabled: boolean) => runOnPlugin(record, () => setPluginEnabled(record, enabled), t(enabled ? "canvas.plugins.enabled" : "canvas.plugins.disabled")), [runOnPlugin, t]);

    const updateInstalled = useCallback(
        (record: InstalledPlugin, entry?: OfficialPluginEntry) => runOnPlugin(record, async () => void (await updatePlugin(record, entry ? officialExpectation(entry) : undefined)), t("canvas.plugins.updated")),
        [runOnPlugin, t],
    );

    const uninstall = useCallback((record: InstalledPlugin) => runOnPlugin(record, () => uninstallPlugin(record.id), t("canvas.plugins.uninstalled")), [runOnPlugin, t]);

    return {
        url,
        setUrl,
        installing,
        busyId,
        official,
        loadingOfficial,
        officialError,
        loadOfficial,
        officialRecordById,
        localPlugins,
        thirdPartyPlugins,
        installFromUrl,
        installOfficial,
        togglePlugin,
        updateInstalled,
        uninstall,
    };
}

function officialExpectation(entry: OfficialPluginEntry) {
    return {
        id: entry.id,
        version: entry.version,
        sha256: entry.sha256,
        size: entry.size,
        minAppVersion: entry.minAppVersion,
    };
}

export function isPluginUpgradable(record: InstalledPlugin | undefined, entry: OfficialPluginEntry) {
    return Boolean(record && hasUpgrade(record.version, entry.version));
}
