import { useState, type ReactNode } from "react";
import { Button, Input, Popconfirm, Switch, Tabs } from "antd";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, CircleAlert, Code2, Copy, Download, Image as ImageIcon, LoaderCircle, Puzzle, RefreshCw, ShieldCheck, Sparkles, TerminalSquare, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { useCopyText } from "@/hooks/use-copy-text";
import { isPluginUpgradable, usePluginCatalog } from "@/hooks/use-plugin-catalog";
import { useAgentStore } from "@/stores/use-agent-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { resolveAgentSetupPhase } from "@/lib/agent/agent-setup";
import { AGENT_CLAUDE_MCP_COMMAND, AGENT_CLI_COMMAND, AGENT_PLUGIN_INSTALL_COMMAND } from "@/lib/agent/plugin-commands";
import { canvasThemes } from "@/lib/canvas-theme";
import type { OfficialPluginEntry } from "@/lib/canvas/plugin-registry";
import type { InstalledPlugin } from "@/stores/canvas/use-plugin-store";

type InstallMode = "plugin" | "cli";
type AgentTarget = "codex" | "claude-code";

export default function PluginsPage() {
    const enabled = isFeatureEnabled("pluginHub");
    if (!enabled) return <Navigate to="/" replace />;
    return <PluginHubPage />;
}

function PluginHubPage() {
    const { t } = useTranslation();
    const copyText = useCopyText();
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const catalog = usePluginCatalog({ active: true });
    const [installMode, setInstallMode] = useState<InstallMode>("plugin");
    const [agentTarget, setAgentTarget] = useState<AgentTarget>("codex");

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
    const command = agentTarget === "claude-code" ? AGENT_CLAUDE_MCP_COMMAND : installMode === "plugin" ? t("agent.connect.installPrompt") : AGENT_CLI_COMMAND;
    const openAgent = () => {
        useAgentStore.getState().setAgentState({ activeTab: connected ? "chat" : "setup" });
        useAgentStore.getState().openPanel();
    };
    const copyCommand = () => copyText(command, t("pluginHub.commandCopied"));
    const dark = colorTheme === "dark";

    return (
        <main className={`h-full overflow-y-auto transition-colors ${dark ? "bg-[#141414] text-[#f7f7f7]" : "bg-[#f4f2ed] text-[#1c1917]"}`}>
            <div className="mx-auto w-full max-w-[1512px] px-4 pb-16 pt-4 sm:px-7 lg:px-10">
                <div className="flex min-h-8 items-center justify-end gap-2">
                    <span className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs ${dark ? "bg-white/[0.04] text-white/65" : "bg-white text-stone-500 shadow-sm"}`}>
                        <span className={`size-1.5 rounded-full ${phase === "connected" ? "bg-emerald-500" : phase === "failed" ? "bg-rose-500" : "bg-amber-500"}`} />
                        {t("pluginHub.agentStatus")} · {statusLabel}
                    </span>
                    <Button type="text" size="small" className="!h-10 !rounded-lg !px-2.5 sm:!h-8" icon={<Bot className="size-3.5" />} onClick={openAgent}>
                        {t(connected ? "pluginHub.openAgent" : "pluginHub.connectAgent")}
                    </Button>
                </div>

                <section className="mx-auto max-w-[1370px] pt-7 sm:pt-10">
                    <div className="mx-auto flex h-28 w-full max-w-xl items-center justify-center sm:h-36" aria-label={t("pluginHub.heroAppsLabel")}>
                        <HeroAppGlyph icon={<Bot className="size-6" />} className="-ml-5 bg-[#d96b48] text-white sm:size-14" />
                        <HeroAppGlyph icon={<Sparkles className="size-7" />} className="-ml-5 bg-[#ef8f70] text-white sm:size-14" />
                        <HeroAppGlyph icon={<Puzzle className="size-8" />} className="-ml-5 z-10 size-16 bg-[#101010] text-white sm:size-20" raised />
                        <HeroAppGlyph icon={<Code2 className="size-7" />} className="-ml-5 bg-[#f5f5f5] text-[#111111] sm:size-14" />
                        <HeroAppGlyph icon={<ImageIcon className="size-6" />} className="-ml-5 bg-[#ef4444] text-white sm:size-14" />
                        <HeroAppGlyph icon={<TerminalSquare className="size-6" />} className="-ml-5 bg-[#57b893] text-white sm:size-14" />
                    </div>

                    <div className="mx-auto mt-5 max-w-2xl text-center sm:mt-7">
                        <h1 className={`text-2xl font-bold tracking-[-0.035em] sm:text-[28px] ${dark ? "text-[#f7f7f7]" : "text-stone-950"}`}>{t("pluginHub.heroTitle")}</h1>
                        <p className={`mt-2 text-[13px] leading-6 ${dark ? "text-white/45" : "text-stone-500"}`}>{t("pluginHub.heroDescription")}</p>
                    </div>

                    <section className={`mt-8 rounded-[24px] border p-4 ${dark ? "border-white/[0.08] bg-[#171717]" : "border-stone-200 bg-white shadow-[0_24px_80px_-60px_rgba(28,25,23,.45)]"}`} aria-label={t("pluginHub.installPanelLabel")}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className={`flex flex-wrap items-center gap-1.5 ${dark ? "text-white/60" : "text-stone-500"}`} aria-label={t("pluginHub.chooseAgent")}>
                                {(["codex", "claude-code"] as const).map((target) => (
                                    <button
                                        key={target}
                                        type="button"
                                        className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition ${agentTarget === target ? (dark ? "border-white/15 bg-white/[0.09] text-white" : "border-stone-300 bg-white text-stone-950 shadow-sm") : dark ? "border-transparent text-white/45 hover:border-white/10 hover:text-white/80" : "border-transparent text-stone-500 hover:border-stone-200 hover:text-stone-950"}`}
                                        aria-pressed={agentTarget === target}
                                        onClick={() => {
                                            setAgentTarget(target);
                                            if (target === "claude-code") setInstallMode("cli");
                                        }}
                                    >
                                        {target === "codex" ? <Bot className="size-4" /> : <TerminalSquare className="size-4" />}
                                        {t(target === "codex" ? "pluginHub.codexAgent" : "pluginHub.claudeCodeAgent")}
                                    </button>
                                ))}
                            </div>
                            {agentTarget === "codex" ? (
                                <div className={`inline-flex h-10 w-fit items-center rounded-full p-1 ${dark ? "bg-white/[0.06]" : "bg-stone-100"}`}>
                                    {(["plugin", "cli"] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-medium transition ${installMode === mode ? (dark ? "bg-[#383838] text-white shadow-sm" : "bg-stone-950 text-white shadow-sm") : dark ? "text-white/55 hover:text-white" : "text-stone-500 hover:text-stone-950"}`}
                                            onClick={() => setInstallMode(mode)}
                                            aria-pressed={installMode === mode}
                                            style={installMode === mode ? { color: "#ffffff" } : undefined}
                                        >
                                            {mode === "plugin" ? <Puzzle className="size-3.5" /> : <Code2 className="size-3.5" />}
                                            {t(mode === "plugin" ? "pluginHub.pluginShort" : "pluginHub.cliShort")}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <span className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-medium ${dark ? "bg-white/[0.06] text-white/70" : "bg-stone-100 text-stone-600"}`}>
                                    <TerminalSquare className="size-3.5" />
                                    {t("pluginHub.mcpShort")}
                                </span>
                            )}
                        </div>

                        <ol className={`mt-4 grid overflow-hidden rounded-[20px] border lg:grid-cols-2 ${dark ? "border-white/[0.07]" : "border-stone-200"}`}>
                            <li className={`min-w-0 p-5 sm:p-6 lg:border-r ${dark ? "border-white/[0.07]" : "border-stone-200"}`}>
                                <StepNumber value="1" dark={dark} />
                                <h2 className="mt-4 text-base font-semibold">{t("pluginHub.stepCopyTitle")}</h2>
                                <p className={`mt-2 text-xs leading-5 ${dark ? "text-white/45" : "text-stone-500"}`}>{t(agentTarget === "claude-code" ? "pluginHub.claudeCodeStepCopyDescription" : "pluginHub.stepCopyDescription")}</p>
                                <CommandBlock command={command} onCopy={copyCommand} theme={theme} />
                            </li>
                            <li className="min-w-0 p-5 sm:p-6 lg:pl-7">
                                <StepNumber value="2" dark={dark} />
                                <h2 className="mt-4 text-base font-semibold">{t("pluginHub.stepConnectTitle")}</h2>
                                <p className={`mt-2 text-xs leading-5 ${dark ? "text-white/45" : "text-stone-500"}`}>{t(agentTarget === "claude-code" ? "pluginHub.claudeCodeStepConnectDescription" : "pluginHub.stepConnectDescription")}</p>
                                <div className={`mt-5 flex items-center gap-3 rounded-[14px] border px-4 py-3 ${dark ? "border-white/[0.07] bg-white/[0.02]" : "border-stone-200 bg-stone-50/70"}`}>
                                    <span className={`grid size-8 shrink-0 place-items-center rounded-full ${phase === "connected" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                                        {phase === "connected" ? <CheckCircle2 className="size-4" /> : phase === "connecting" || phase === "mcp-starting" ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-medium">{statusLabel}</div>
                                        <div className={`mt-0.5 truncate text-[11px] ${dark ? "text-white/35" : "text-stone-500"}`}>{connectError || activity || t("pluginHub.stepTwoHint")}</div>
                                    </div>
                                    <Button size="small" className="!h-10 shrink-0 !rounded-lg sm:!h-8" onClick={openAgent}>{t(connected ? "pluginHub.openAgent" : "pluginHub.openSetup")}</Button>
                                </div>
                            </li>
                        </ol>
                    </section>
                </section>

                <section className="mx-auto mt-4 grid max-w-[1370px] gap-3 sm:grid-cols-3">
                    <MetricCard icon={<CheckCircle2 className="size-4" />} label={t("pluginHub.agentStatus")} value={statusLabel} tone={phase === "connected" ? "good" : phase === "failed" ? "bad" : "neutral"} dark={dark} />
                    <MetricCard icon={<Puzzle className="size-4" />} label={t("pluginHub.installedCount")} value={String(installedCount)} dark={dark} />
                    <MetricCard icon={<Download className="size-4" />} label={t("pluginHub.catalogCount")} value={String(officialCount)} dark={dark} />
                </section>

                <section className="mx-auto mt-4 max-w-[1370px]">
                    <Panel
                        title={t("pluginHub.catalogTitle")}
                        description={t("pluginHub.catalogDescription")}
                        action={
                            <Button type="text" size="small" className="!h-10 sm:!h-8" icon={<RefreshCw className={`size-3.5 ${catalog.loadingOfficial ? "animate-spin" : ""}`} />} onClick={() => void catalog.loadOfficial()} disabled={catalog.loadingOfficial}>
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

                <div className={`mx-auto mt-4 flex max-w-[1370px] flex-wrap items-center justify-between gap-3 text-[11px] ${dark ? "text-white/35" : "text-stone-500"}`}>
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" />{t("pluginHub.integrity")}</span>
                        <span className="inline-flex items-center gap-1.5"><CircleAlert className="size-3.5" />{t("pluginHub.browserWarning")}</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${pluginDetected ? "bg-emerald-500" : dark ? "bg-white/20" : "bg-stone-300"}`} />
                        {pluginDetected ? t("pluginHub.pluginDetected") : t("pluginHub.pluginNotDetected")}
                    </span>
                </div>
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
                                <Button type="primary" size="small" className="!h-10 sm:!h-8" icon={<Download className="size-3.5" />} loading={catalog.busyId === entry.id} onClick={() => void catalog.installOfficial(entry)}>
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
                <Input className="!h-10 sm:!h-8" placeholder={t("canvas.plugins.urlPlaceholder")} value={catalog.url} onChange={(event) => catalog.setUrl(event.target.value)} onPressEnter={() => void catalog.installFromUrl()} allowClear />
                <Button type="primary" className="!h-10 sm:!h-8" loading={catalog.installing} icon={<Puzzle className="size-3.5" />} onClick={() => void catalog.installFromUrl()}>
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
            <Switch
                checked={record.enabled}
                loading={catalog.busyId === record.id}
                className="relative before:absolute before:-inset-y-[9px] before:inset-x-0 before:content-[''] sm:before:hidden"
                onChange={(checked) => void catalog.togglePlugin(record, checked)}
            />
            {!record.local ? (
                <>
                    <Button
                        type={upgradable ? "primary" : "text"}
                        size="small"
                        className="!h-10 !w-10 !min-w-10 sm:!h-8 sm:!w-8 sm:!min-w-8"
                        icon={<RefreshCw className="size-3.5" />}
                        loading={catalog.busyId === record.id}
                        title={t(upgradable ? "canvas.plugins.upgradeAvailable" : "canvas.plugins.updateFromSource")}
                        onClick={() => void catalog.updateInstalled(record, officialEntry)}
                    />
                    <Popconfirm title={t("canvas.plugins.uninstallTitle")} okText={t("canvas.plugins.uninstall")} cancelText={t("canvas.editors.cancel")} onConfirm={() => void catalog.uninstall(record)}>
                        <Button type="text" size="small" className="!h-10 !w-10 !min-w-10 sm:!h-8 sm:!w-8 sm:!min-w-8" danger icon={<Trash2 className="size-3.5" />} title={t("canvas.plugins.uninstall")} />
                    </Popconfirm>
                </>
            ) : null}
        </div>
    );
}

function PluginRow({ name, version, description, icon, installed, actions }: { name: string; version: string; description?: string; icon: ReactNode; installed?: boolean; actions: ReactNode }) {
    return (
        <div className="flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-stone-200/80 bg-white/70 px-3.5 py-3 transition hover:border-stone-300 dark:border-stone-800 dark:bg-stone-950/50 dark:hover:border-stone-700">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">{icon}</span>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-stone-900 dark:text-stone-100">{name}</span>
                    <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">v{version}</span>
                    {installed ? <span className="shrink-0 text-[10px] text-teal-600 dark:text-teal-400">●</span> : null}
                </div>
                {description ? <div className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{description}</div> : null}
            </div>
            {actions}
        </div>
    );
}

function HeroAppGlyph({ icon, className, raised = false }: { icon: ReactNode; className: string; raised?: boolean }) {
    return (
        <span className={`relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-[15px] border-2 border-[#141414] shadow-[0_12px_28px_rgba(0,0,0,.26)] ${raised ? "shadow-[0_18px_34px_rgba(0,0,0,.35)]" : ""} ${className}`}>
            <span className="absolute inset-0 bg-gradient-to-br from-white/18 to-transparent" />
            <span className="relative">{icon}</span>
        </span>
    );
}

function StepNumber({ value, dark }: { value: string; dark: boolean }) {
    return <span className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${dark ? "bg-white/[0.08] text-white/70" : "bg-stone-100 text-stone-600"}`}>{value}</span>;
}

function MetricCard({ icon, label, value, tone = "neutral", dark }: { icon: ReactNode; label: string; value: string; tone?: "good" | "bad" | "neutral"; dark: boolean }) {
    const valueClass = tone === "good" ? "text-teal-700 dark:text-teal-400" : tone === "bad" ? "text-rose-700 dark:text-rose-400" : "text-stone-900 dark:text-stone-100";
    return (
        <div className={`rounded-2xl border p-3.5 ${dark ? "border-white/[0.07] bg-[#1b1b1b]" : "border-stone-200 bg-white"}`}>
            <div className={`flex items-center gap-2 text-[11px] ${dark ? "text-white/35" : "text-stone-500"}`}>
                {icon}
                {label}
            </div>
            <div className={`mt-2 truncate text-sm font-semibold ${dark ? "text-white/85" : valueClass}`}>{value}</div>
        </div>
    );
}

function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-4 dark:border-white/[0.07] dark:bg-[#171717] sm:p-5">
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
    const { t } = useTranslation();
    return (
        <div className="relative mt-5 max-h-[104px] overflow-hidden rounded-[14px] border px-3.5 py-3" style={{ borderColor: theme.node.stroke, color: theme.node.text, background: theme.node.panel }}>
            <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[11px] leading-5 opacity-65">{command}</code>
                <Button type="text" size="small" className="!h-10 !w-10 !min-w-10 shrink-0 sm:!h-8 sm:!w-8 sm:!min-w-8" icon={<Copy className="size-3.5" />} onClick={onCopy} aria-label={t("pluginHub.copyInstall")} />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10" style={{ background: `linear-gradient(to top, ${theme.node.panel}, transparent)` }} />
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
