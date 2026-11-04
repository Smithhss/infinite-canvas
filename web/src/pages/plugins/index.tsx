import { useState, type ReactNode } from "react";
import { Button, Input, Popconfirm, Switch, Tabs } from "antd";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, CircleAlert, Code2, Copy, Download, FileTerminal, LoaderCircle, Puzzle, RefreshCw, ShieldCheck, Sparkles, TerminalSquare, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { useCopyText } from "@/hooks/use-copy-text";
import { isPluginUpgradable, usePluginCatalog } from "@/hooks/use-plugin-catalog";
import { useAgentStore } from "@/stores/use-agent-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { resolveAgentSetupPhase } from "@/lib/agent/agent-setup";
import { AGENT_CLI_COMMAND, AGENT_PLUGIN_INSTALL_COMMAND } from "@/lib/agent/plugin-commands";
import { canvasThemes } from "@/lib/canvas-theme";
import type { OfficialPluginEntry } from "@/lib/canvas/plugin-registry";
import type { InstalledPlugin } from "@/stores/canvas/use-plugin-store";

type InstallMode = "plugin" | "cli";

export default function PluginsPage() {
    const enabled = isFeatureEnabled("pluginHub");
    if (!enabled) return <Navigate to="/" replace />;
    return <PluginHubPage />;
}

function PluginHubPage() {
    const { t } = useTranslation();
    const copyText = useCopyText();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const catalog = usePluginCatalog({ active: true });
    const [installMode, setInstallMode] = useState<InstallMode>("plugin");

    const connected = useAgentStore((state) => state.connected);
    const enabled = useAgentStore((state) => state.enabled);
    const token = useAgentStore((state) => state.token);
    const connectError = useAgentStore((state) => state.connectError);
    const pluginDetected = useAgentStore((state) => state.pluginDetected);
    const conversation = useAgentStore((state) => state.conversation);
    const activity = useAgentStore((state) => state.activity);
    const phase = resolveAgentSetupPhase({ connected, enabled, connectError, conversationStatus: conversation.status, mcpStatuses: conversation.mcpStatuses, pluginDetected, tokenPresent: Boolean(token.trim()) });
    const statusLabel = t(`agent.connect.status${phase === "not-detected" ? "NotDetected" : phase === "mcp-starting" ? "McpStarting" : phase.charAt(0).toUpperCase() + phase.slice(1)}`);

    const officialCount = catalog.official.length;
    const installedCount = catalog.officialRecordById.size + catalog.localPlugins.length + catalog.thirdPartyPlugins.length;
    const command = installMode === "plugin" ? t("agent.connect.installPrompt") : AGENT_CLI_COMMAND;
    const openAgent = () => {
        useAgentStore.getState().setAgentState({ activeTab: connected ? "chat" : "setup" });
        useAgentStore.getState().openPanel();
    };
    const copyCommand = () => copyText(command, t("pluginHub.commandCopied"));

    return (
        <main className="h-full overflow-y-auto bg-[radial-gradient(circle_at_10%_0%,rgba(20,184,166,.08),transparent_32%),radial-gradient(circle_at_90%_18%,rgba(245,158,11,.08),transparent_28%)]">
            <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
                <section className="relative overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/75 shadow-[0_24px_80px_-48px_rgba(28,25,23,.55)] dark:border-stone-800/80 dark:bg-stone-950/70">
                    <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-300/10" />
                    <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-amber-400/10 blur-3xl dark:bg-amber-300/10" />
                    <div className="relative grid gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10 lg:py-10">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-[11px] font-medium text-stone-500 dark:border-stone-700 dark:text-stone-400">
                                <Sparkles className="size-3.5 text-amber-500" />
                                {t("pluginHub.eyebrow")}
                            </div>
                            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-4xl dark:text-stone-100">{t("pluginHub.title")}</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500 dark:text-stone-400">{t("pluginHub.description")}</p>
                            <div className="mt-6 flex flex-wrap items-center gap-2">
                                <Button type="primary" size="large" className="!h-10 !rounded-xl" icon={<TerminalSquare className="size-4" />} onClick={copyCommand}>
                                    {t("pluginHub.copyInstall")}
                                </Button>
                                <Button size="large" className="!h-10 !rounded-xl" icon={connected ? <Bot className="size-4" /> : <ArrowRight className="size-4" />} onClick={openAgent}>
                                    {connected ? t("pluginHub.openAgent") : t("pluginHub.connectAgent")}
                                </Button>
                            </div>
                            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-500 dark:text-stone-400">
                                <span className="inline-flex items-center gap-1.5">
                                    <ShieldCheck className="size-3.5 text-teal-600 dark:text-teal-400" />
                                    {t("pluginHub.integrity")}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <CircleAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
                                    {t("pluginHub.browserWarning")}
                                </span>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            <MetricCard icon={<CheckCircle2 className="size-4" />} label={t("pluginHub.agentStatus")} value={statusLabel} tone={phase === "connected" ? "good" : phase === "failed" ? "bad" : "neutral"} />
                            <MetricCard icon={<Puzzle className="size-4" />} label={t("pluginHub.installedCount")} value={String(installedCount)} />
                            <MetricCard icon={<Download className="size-4" />} label={t("pluginHub.catalogCount")} value={String(officialCount)} />
                        </div>
                    </div>
                </section>

                <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
                    <Panel title={t("pluginHub.compatibilityTitle")} description={t("pluginHub.compatibilityDescription")}>
                        <div className="grid gap-2 sm:grid-cols-3">
                            <CompatibilityCard icon={<Code2 className="size-4" />} name="Codex" description={t("pluginHub.codexDescription")} status={t("pluginHub.available")} available />
                            <CompatibilityCard icon={<Bot className="size-4" />} name="Claude" description={t("pluginHub.claudeDescription")} status={t("pluginHub.available")} available />
                            <CompatibilityCard icon={<FileTerminal className="size-4" />} name="Claude Code" description={t("pluginHub.claudeCodeDescription")} status={t("pluginHub.planned")} />
                        </div>
                    </Panel>

                    <Panel title={t("pluginHub.connectionTitle")} description={t("pluginHub.connectionDescription")}>
                        <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 p-3.5 dark:border-stone-800 dark:bg-stone-900/50">
                            <div className="flex items-start gap-3">
                                <span className={phase === "connected" ? "text-teal-600 dark:text-teal-400" : phase === "failed" ? "text-rose-600 dark:text-rose-400" : "text-stone-400 dark:text-stone-500"}>
                                    {phase === "connected" ? <CheckCircle2 className="size-5" /> : phase === "connecting" || phase === "mcp-starting" ? <LoaderCircle className="size-5 animate-spin" /> : <Bot className="size-5" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100">{t(`agent.connect.${phaseTitleKey(phase)}`)}</div>
                                    <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{connectError || activity}</div>
                                </div>
                            </div>
                            <Button className="mt-3 !h-8 !rounded-lg" block onClick={openAgent} icon={<ArrowRight className="size-3.5" />}>
                                {connected ? t("pluginHub.openAgent") : t("pluginHub.openSetup")}
                            </Button>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                            <span className={`size-1.5 rounded-full ${pluginDetected ? "bg-teal-500" : "bg-stone-300 dark:bg-stone-600"}`} />
                            {pluginDetected ? t("pluginHub.pluginDetected") : t("pluginHub.pluginNotDetected")}
                        </div>
                    </Panel>
                </section>

                <section className="mt-6">
                    <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-lg font-semibold tracking-[-0.02em] text-stone-950 dark:text-stone-100">{t("pluginHub.installTitle")}</h2>
                            <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("pluginHub.installDescription")}</p>
                        </div>
                        <div className="inline-flex w-fit rounded-xl border border-stone-200 bg-white p-1 dark:border-stone-800 dark:bg-stone-950">
                            {(["plugin", "cli"] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                                    style={installMode === mode ? { background: theme.toolbar.activeBg, color: theme.toolbar.activeText } : { color: theme.node.muted }}
                                    onClick={() => setInstallMode(mode)}
                                    aria-pressed={installMode === mode}
                                >
                                    {t(mode === "plugin" ? "pluginHub.pluginMode" : "pluginHub.cliMode")}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <Panel title={t("pluginHub.stepOne")} description={t("pluginHub.stepOneDescription")}>
                            <CommandBlock
                                command={installMode === "plugin" ? AGENT_PLUGIN_INSTALL_COMMAND : AGENT_CLI_COMMAND}
                                onCopy={() => copyText(installMode === "plugin" ? AGENT_PLUGIN_INSTALL_COMMAND : AGENT_CLI_COMMAND, t("pluginHub.commandCopied"))}
                                theme={theme}
                            />
                        </Panel>
                        <Panel title={t("pluginHub.stepTwo")} description={t("pluginHub.stepTwoDescription")}>
                            <div className="flex items-center gap-3 rounded-xl border border-dashed border-stone-300 px-3.5 py-3 dark:border-stone-700">
                                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${phase === "connected" ? "bg-teal-500/10 text-teal-600 dark:text-teal-400" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"}`}>
                                    {phase === "connected" ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-stone-900 dark:text-stone-100">{t("pluginHub.stepTwoStatus")}</div>
                                    <div className="mt-0.5 text-[11px] leading-4 text-stone-500 dark:text-stone-400">{t("pluginHub.stepTwoHint")}</div>
                                </div>
                                <Button size="small" className="!rounded-lg" onClick={openAgent}>
                                    {t("pluginHub.openAgent")}
                                </Button>
                            </div>
                        </Panel>
                    </div>
                </section>

                <section className="mt-6">
                    <Panel
                        title={t("pluginHub.catalogTitle")}
                        description={t("pluginHub.catalogDescription")}
                        action={
                            <Button type="text" size="small" icon={<RefreshCw className={`size-3.5 ${catalog.loadingOfficial ? "animate-spin" : ""}`} />} onClick={() => void catalog.loadOfficial()} disabled={catalog.loadingOfficial}>
                                {t("pluginHub.refresh")}
                            </Button>
                        }
                    >
                        <Tabs
                            items={[
                                {
                                    key: "official",
                                    label: `${t("canvas.plugins.official")}${catalog.official.length ? ` · ${catalog.official.length}` : ""}`,
                                    children: <OfficialCatalog catalog={catalog} />,
                                },
                                {
                                    key: "local",
                                    label: `${t("canvas.plugins.local")}${catalog.localPlugins.length ? ` · ${catalog.localPlugins.length}` : ""}`,
                                    children: <InstalledCatalog records={catalog.localPlugins} empty={t("pluginHub.noLocal")} catalog={catalog} />,
                                },
                                {
                                    key: "third-party",
                                    label: t("canvas.plugins.thirdParty"),
                                    children: <ThirdPartyCatalog catalog={catalog} />,
                                },
                            ]}
                        />
                    </Panel>
                </section>
            </div>
        </main>
    );
}

function OfficialCatalog({ catalog }: { catalog: ReturnType<typeof usePluginCatalog> }) {
    const { t } = useTranslation();
    if (catalog.officialError) return <InlineNotice tone="bad" text={t("canvas.plugins.loadFailed", { error: catalog.officialError })} />;
    if (catalog.loadingOfficial && catalog.official.length === 0) return <InlineNotice tone="neutral" text={t("canvas.plugins.loadingOfficial")} />;
    if (catalog.official.length === 0) return <InlineNotice tone="neutral" text={t("canvas.plugins.noOfficial")} />;
    return (
        <div className="grid gap-2">
            {catalog.official.map((entry) => {
                const record = catalog.officialRecordById.get(entry.id);
                const upgradable = isPluginUpgradable(record, entry);
                return (
                    <PluginRow
                        key={entry.id}
                        name={entry.name}
                        version={upgradable && record ? `${record.version} → ${entry.version}` : entry.version}
                        description={entry.description}
                        icon={<Puzzle className="size-4" />}
                        installed={Boolean(record)}
                        actions={
                            record ? (
                                <InstalledActions record={record} catalog={catalog} officialEntry={entry} upgradable={upgradable} />
                            ) : (
                                <Button type="primary" size="small" icon={<Download className="size-3.5" />} loading={catalog.busyId === entry.id} onClick={() => void catalog.installOfficial(entry)}>
                                    {t("canvas.plugins.install")}
                                </Button>
                            )
                        }
                    />
                );
            })}
        </div>
    );
}

function InstalledCatalog({ records, empty, catalog }: { records: InstalledPlugin[]; empty: string; catalog: ReturnType<typeof usePluginCatalog> }) {
    if (records.length === 0) return <InlineNotice tone="neutral" text={empty} />;
    return (
        <div className="grid gap-2">
            {records.map((record) => (
                <PluginRow key={record.id} name={record.name} version={record.version} description={record.description || record.url} icon={<Puzzle className="size-4" />} installed actions={<InstalledActions record={record} catalog={catalog} />} />
            ))}
        </div>
    );
}

function ThirdPartyCatalog({ catalog }: { catalog: ReturnType<typeof usePluginCatalog> }) {
    const { t } = useTranslation();
    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input placeholder={t("canvas.plugins.urlPlaceholder")} value={catalog.url} onChange={(event) => catalog.setUrl(event.target.value)} onPressEnter={() => void catalog.installFromUrl()} allowClear />
                <Button type="primary" loading={catalog.installing} icon={<Puzzle className="size-3.5" />} onClick={() => void catalog.installFromUrl()}>
                    {t("canvas.plugins.install")}
                </Button>
            </div>
            {catalog.thirdPartyPlugins.length === 0 ? (
                <InlineNotice tone="neutral" text={t("canvas.plugins.noThirdParty")} />
            ) : (
                <div className="grid gap-2">
                    {catalog.thirdPartyPlugins.map((record) => (
                        <PluginRow
                            key={record.id}
                            name={record.name}
                            version={record.version}
                            description={record.description || record.url}
                            icon={<Puzzle className="size-4" />}
                            installed
                            actions={<InstalledActions record={record} catalog={catalog} />}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function InstalledActions({ record, catalog, officialEntry, upgradable = false }: { record: InstalledPlugin; catalog: ReturnType<typeof usePluginCatalog>; officialEntry?: OfficialPluginEntry; upgradable?: boolean }) {
    const { t } = useTranslation();
    return (
        <div className="flex shrink-0 items-center gap-1">
            <Switch size="small" checked={record.enabled} loading={catalog.busyId === record.id} onChange={(checked) => void catalog.togglePlugin(record, checked)} />
            {!record.local ? (
                <>
                    <Button
                        type={upgradable ? "primary" : "text"}
                        size="small"
                        icon={<RefreshCw className="size-3.5" />}
                        loading={catalog.busyId === record.id}
                        title={t(upgradable ? "canvas.plugins.upgradeAvailable" : "canvas.plugins.updateFromSource")}
                        onClick={() => void catalog.updateInstalled(record, officialEntry)}
                    />
                    <Popconfirm title={t("canvas.plugins.uninstallTitle")} okText={t("canvas.plugins.uninstall")} cancelText={t("canvas.editors.cancel")} onConfirm={() => void catalog.uninstall(record)}>
                        <Button type="text" size="small" danger icon={<Trash2 className="size-3.5" />} title={t("canvas.plugins.uninstall")} />
                    </Popconfirm>
                </>
            ) : null}
        </div>
    );
}

function PluginRow({ name, version, description, icon, installed, actions }: { name: string; version: string; description?: string; icon: ReactNode; installed?: boolean; actions: ReactNode }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white/70 px-3.5 py-3 transition hover:border-stone-300 dark:border-stone-800 dark:bg-stone-950/50 dark:hover:border-stone-700">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">{icon}</span>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">{name}</span>
                    <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">v{version}</span>
                    {installed ? <span className="shrink-0 text-[10px] text-teal-600 dark:text-teal-400">●</span> : null}
                </div>
                {description ? <div className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{description}</div> : null}
            </div>
            {actions}
        </div>
    );
}

function CompatibilityCard({ icon, name, description, status, available = false }: { icon: ReactNode; name: string; description: string; status: string; available?: boolean }) {
    return (
        <div className="rounded-2xl border border-stone-200/80 p-3.5 dark:border-stone-800">
            <div className="flex items-center justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">{icon}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${available ? "bg-teal-500/10 text-teal-700 dark:text-teal-400" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"}`}>{status}</span>
            </div>
            <div className="mt-3 text-sm font-medium text-stone-900 dark:text-stone-100">{name}</div>
            <div className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{description}</div>
        </div>
    );
}

function MetricCard({ icon, label, value, tone = "neutral" }: { icon: ReactNode; label: string; value: string; tone?: "good" | "bad" | "neutral" }) {
    const valueClass = tone === "good" ? "text-teal-700 dark:text-teal-400" : tone === "bad" ? "text-rose-700 dark:text-rose-400" : "text-stone-900 dark:text-stone-100";
    return (
        <div className="rounded-2xl border border-stone-200/80 bg-white/65 p-3.5 dark:border-stone-800 dark:bg-stone-950/55">
            <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                {icon}
                {label}
            </div>
            <div className={`mt-2 truncate text-sm font-semibold ${valueClass}`}>{value}</div>
        </div>
    );
}

function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-2xl border border-stone-200/80 bg-white/70 p-4 dark:border-stone-800 dark:bg-stone-950/50">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
                    {description ? <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-stone-400">{description}</p> : null}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function CommandBlock({ command, onCopy, theme }: { command: string; onCopy: () => void; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
            <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[11px] leading-5">{command}</code>
                <Button type="text" size="small" className="!h-7 !w-7 !min-w-7" icon={<Copy className="size-3.5" />} onClick={onCopy} aria-label="copy command" />
            </div>
        </div>
    );
}

function InlineNotice({ tone, text }: { tone: "neutral" | "bad"; text: string }) {
    return (
        <div
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-3 text-xs ${tone === "bad" ? "border-rose-200 text-rose-700 dark:border-rose-900/60 dark:text-rose-400" : "border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400"}`}
        >
            {tone === "bad" ? <AlertTriangle className="size-4 shrink-0" /> : <LoaderCircle className="size-4 shrink-0" />}
            <span>{text}</span>
        </div>
    );
}

function phaseTitleKey(phase: ReturnType<typeof resolveAgentSetupPhase>) {
    return `${phase}Title`;
}
