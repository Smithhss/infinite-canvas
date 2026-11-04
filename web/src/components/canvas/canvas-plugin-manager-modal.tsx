import type { ReactNode } from "react";
import { Button, Input, Modal, Popconfirm, Switch, Tabs } from "antd";
import { AlertTriangle, Download, Puzzle, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePluginCatalog, isPluginUpgradable } from "@/hooks/use-plugin-catalog";
import { canvasThemes } from "@/lib/canvas-theme";
import { type OfficialPluginEntry } from "@/lib/canvas/plugin-registry";
import { useThemeStore } from "@/stores/use-theme-store";
import { type InstalledPlugin } from "@/stores/canvas/use-plugin-store";

export function CanvasPluginManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const catalog = usePluginCatalog({ active: open });
    const { url, setUrl, installing, busyId, official, loadingOfficial, officialError, loadOfficial, officialRecordById, localPlugins, thirdPartyPlugins, installFromUrl, installOfficial, togglePlugin, updateInstalled, uninstall } = catalog;

    // Installed plugin actions: enable toggle plus update/uninstall for non-local plugins.
    // Highlight the update action when a newer remote version is available.
    const installedControls = (record: InstalledPlugin, upgradable = false, officialEntry?: OfficialPluginEntry) => (
        <>
            <Switch size="small" checked={record.enabled} loading={busyId === record.id} onChange={(checked) => togglePlugin(record, checked)} />
            {!record.local && (
                <>
                    <Button
                        type={upgradable ? "primary" : "text"}
                        size="small"
                        icon={<RefreshCw className="size-4" />}
                        loading={busyId === record.id}
                        title={t(upgradable ? "canvas.plugins.upgradeAvailable" : "canvas.plugins.updateFromSource")}
                        onClick={() => updateInstalled(record, officialEntry)}
                    />
                    <Popconfirm title={t("canvas.plugins.uninstallTitle")} okText={t("canvas.plugins.uninstall")} cancelText={t("canvas.editors.cancel")} onConfirm={() => uninstall(record)}>
                        <Button type="text" size="small" danger icon={<Trash2 className="size-4" />} title={t("canvas.plugins.uninstall")} />
                    </Popconfirm>
                </>
            )}
        </>
    );

    // Add a green dot at the icon's top-right corner when an update is available.
    // A card-colored box shadow separates the dot visually from the icon.
    const withUpgradeDot = (icon: ReactNode) => (
        <span className="relative inline-flex">
            {icon}
            <span className="absolute -right-1 -top-1 size-2 rounded-full" style={{ background: "#22c55e", boxShadow: `0 0 0 2px ${theme.node.fill}` }} title={t("canvas.plugins.newVersion")} />
        </span>
    );

    const versionTag = (version: string) => (
        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: theme.toolbar.activeBg, color: theme.node.muted }}>
            v{version}
        </span>
    );

    const emptyHint = (text: string) => (
        <div className="py-10 text-center text-sm" style={{ color: theme.node.muted }}>
            {text}
        </div>
    );

    // Shared plugin row: icon, title with name and version, description, and actions.
    const row = (key: string, icon: ReactNode, name: string, version: string, subtitle: string | undefined, right: ReactNode) => (
        <div key={key} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: theme.node.stroke, background: theme.node.fill }}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg text-base" style={{ background: theme.toolbar.activeBg, color: theme.node.muted }}>
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium" style={{ color: theme.node.text }}>
                    <span className="truncate">{name}</span>
                    {versionTag(version)}
                </div>
                {subtitle ? (
                    <div className="mt-0.5 truncate text-xs" style={{ color: theme.node.muted }}>
                        {subtitle}
                    </div>
                ) : null}
            </div>
            {right}
        </div>
    );

    const officialTab = (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="text-xs" style={{ color: theme.node.muted }}>
                    {t("canvas.plugins.officialDescription")}
                </div>
                <Button type="text" size="small" icon={<RefreshCw className={`size-4 ${loadingOfficial ? "animate-spin" : ""}`} />} onClick={loadOfficial} disabled={loadingOfficial}>
                    {t("canvas.plugins.refresh")}
                </Button>
            </div>
            {officialError ? (
                <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                    {t("canvas.plugins.loadFailed", { error: officialError })}
                </div>
            ) : loadingOfficial && official.length === 0 ? (
                emptyHint(t("canvas.plugins.loadingOfficial"))
            ) : official.length === 0 ? (
                emptyHint(t("canvas.plugins.noOfficial"))
            ) : (
                <div className="thin-scrollbar max-h-[46vh] space-y-2 overflow-auto">
                    {official.map((entry) => {
                        const record = officialRecordById.get(entry.id);
                        // Show the update dot and highlight the action when the remote version is newer.
                        const upgradable = isPluginUpgradable(record, entry);
                        const icon = entry.icon || <Puzzle className="size-4" />;
                        return row(
                            entry.id,
                            upgradable ? withUpgradeDot(icon) : icon,
                            entry.name,
                            // Show local and remote versions in the title so the update target is explicit.
                            upgradable && record ? `${record.version} → ${entry.version}` : entry.version,
                            entry.description,
                            record ? (
                                installedControls(record, upgradable, entry)
                            ) : (
                                <Button type="primary" size="small" icon={<Download className="size-4" />} loading={busyId === entry.id} onClick={() => installOfficial(entry)}>
                                    {t("canvas.plugins.install")}
                                </Button>
                            ),
                        );
                    })}
                </div>
            )}
        </div>
    );

    const localTab = (
        <div className="thin-scrollbar max-h-[52vh] space-y-2 overflow-auto">{localPlugins.map((record) => row(record.id, <Puzzle className="size-4" />, record.name, record.version, record.description || record.url, installedControls(record)))}</div>
    );

    const thirdPartyTab = (
        <div className="space-y-3">
            <div className="flex gap-2">
                <Input placeholder={t("canvas.plugins.urlPlaceholder")} value={url} onChange={(event) => setUrl(event.target.value)} onPressEnter={installFromUrl} allowClear />
                <Button type="primary" loading={installing} onClick={installFromUrl} icon={<Puzzle className="size-4" />}>
                    {t("canvas.plugins.install")}
                </Button>
            </div>
            <div className="thin-scrollbar max-h-[42vh] space-y-2 overflow-auto">
                {thirdPartyPlugins.length === 0
                    ? emptyHint(t("canvas.plugins.noThirdParty"))
                    : thirdPartyPlugins.map((record) => row(record.id, <Puzzle className="size-4" />, record.name, record.version, record.description || record.url, installedControls(record)))}
            </div>
        </div>
    );

    const tabs = [
        { key: "official", label: t("canvas.plugins.official"), children: officialTab },
        ...(localPlugins.length > 0 ? [{ key: "local", label: t("canvas.plugins.local"), children: localTab }] : []),
        { key: "third", label: t("canvas.plugins.thirdParty"), children: thirdPartyTab },
    ];

    return (
        <Modal title={t("canvas.plugins.title")} open={open} onCancel={onClose} footer={null} centered width={640}>
            <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5" style={{ borderColor: "#f59e0b55", background: "#f59e0b14", color: theme.node.text }}>
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <span>{t("canvas.plugins.warning")}</span>
                </div>
                <Tabs defaultActiveKey="official" items={tabs} />
            </div>
        </Modal>
    );
}
