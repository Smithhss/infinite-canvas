import { useEffect, useState, type ReactNode } from "react";
import { App, Button, Input, Tooltip } from "antd";
import copyToClipboard from "copy-to-clipboard";
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, Copy, KeyRound, Link2, LoaderCircle, PlugZap, RefreshCw, TerminalSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAgentCanvasSummary } from "@/hooks/use-agent-canvas-summary";
import { getAgentSetupChecks, resolveAgentSetupPhase, type AgentSetupCheckKey, type AgentSetupCheckState, type AgentSetupPhase } from "@/lib/agent/agent-setup";
import { getAgentSuggestionKeys } from "@/lib/agent/agent-suggestions";
import { AGENT_CLI_COMMAND, AGENT_MCP_REMOVE_COMMAND, AGENT_PLUGIN_INSTALL_COMMAND, AGENT_PLUGIN_REMOVE_COMMAND } from "@/lib/agent/plugin-commands";
import { canvasThemes } from "@/lib/canvas-theme";
import type { AgentConversationState } from "@/stores/use-agent-store";

export function AgentConnectView({
    theme,
    url,
    token,
    enabled,
    connected,
    pluginDetected,
    conversation,
    activity,
    connectError,
    onUrlChange,
    onTokenChange,
    onToggleEnabled,
    onReconnect,
    onOpenChat,
    onUsePrompt,
}: {
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    url: string;
    token: string;
    enabled: boolean;
    connected: boolean;
    pluginDetected: boolean;
    conversation: AgentConversationState;
    activity: string;
    connectError: string;
    onUrlChange: (value: string) => void;
    onTokenChange: (value: string) => void;
    onToggleEnabled: () => void;
    onReconnect: () => void;
    onOpenChat: () => void;
    onUsePrompt: (prompt: string) => void;
}) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const canvasSummary = useAgentCanvasSummary();
    const [connectionOpen, setConnectionOpen] = useState(false);
    const [installManualOpen, setInstallManualOpen] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const phase = resolveAgentSetupPhase({
        connected,
        enabled,
        connectError,
        conversationStatus: conversation.status,
        mcpStatuses: conversation.mcpStatuses,
        pluginDetected,
        tokenPresent: Boolean(token.trim()),
    });
    const checks = getAgentSetupChecks({
        connected,
        enabled,
        connectError,
        conversationStatus: conversation.status,
        mcpStatuses: conversation.mcpStatuses,
        pluginDetected,
        tokenPresent: Boolean(token.trim()),
    });
    const mcpCheck = checks.find((item) => item.key === "mcp");
    const suggestions = getAgentSuggestionKeys(canvasSummary).map((key) => t(key));
    const status = setupStatus(phase, activity, t);

    useEffect(() => {
        if (connectError) setConnectionOpen(true);
        else if (connected) setConnectionOpen(false);
    }, [connected, connectError]);

    const copyCommand = (command: string) => {
        copyToClipboard(command);
        message.success(t("agent.connect.commandCopied"));
    };
    const copyInstallPrompt = () => copyCommand(t("agent.connect.installPrompt"));
    const copyOpenPrompt = () => copyCommand(t("agent.connect.stepOpenPrompt"));

    return (
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
                <header className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-base font-semibold leading-6">{t("agent.connect.title")}</div>
                        <div className="mt-0.5 text-xs leading-5" style={{ color: theme.node.muted }}>
                            {t("agent.connect.subtitle")}
                        </div>
                    </div>
                    <StatusPill text={status.label} color={status.color} />
                </header>

                <section className="overflow-hidden rounded-2xl border" style={{ borderColor: status.border, background: status.background }}>
                    <div className="flex items-start gap-3 px-4 pb-3 pt-4">
                        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full" style={{ background: status.iconBackground, color: status.color }}>
                            <PhaseIcon phase={phase} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-semibold leading-6">{t(`agent.connect.${phase}Title`)}</div>
                            <div className="mt-0.5 text-xs leading-5" style={{ color: theme.node.muted }}>
                                {t(`agent.connect.${phase}Text`)}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3" style={{ borderColor: status.border }}>
                        {phase === "connected" ? (
                            <Button type="primary" className="!h-8 !px-3" onClick={onOpenChat}>
                                {t("agent.connect.startChat")}
                            </Button>
                        ) : phase === "not-detected" ? (
                            <>
                                <Button type="primary" className="!h-8 !px-3" icon={<Copy className="size-3.5" />} onClick={copyInstallPrompt}>
                                    {t("agent.connect.installPromptAction")}
                                </Button>
                                <TextAction icon={<TerminalSquare className="size-3.5" />} onClick={() => setInstallManualOpen((open) => !open)}>
                                    {t("agent.connect.manualInstall")}
                                </TextAction>
                            </>
                        ) : phase === "installed" ? (
                            <>
                                <Button type="primary" className="!h-8 !px-3" icon={<Copy className="size-3.5" />} onClick={copyOpenPrompt}>
                                    {t("agent.connect.copyOpenPrompt")}
                                </Button>
                                <TextAction icon={<RefreshCw className="size-3.5" />} onClick={onReconnect}>
                                    {t("agent.connect.retry")}
                                </TextAction>
                            </>
                        ) : phase === "failed" ? (
                            <>
                                <Button type="primary" className="!h-8 !px-3" icon={<RefreshCw className="size-3.5" />} onClick={pluginDetected ? onReconnect : copyInstallPrompt}>
                                    {t(pluginDetected ? "agent.connect.retry" : "agent.connect.installPromptAction")}
                                </Button>
                                <TextAction icon={<PlugZap className="size-3.5" />} onClick={() => setConnectionOpen(true)}>
                                    {t("agent.connect.connectionDetails")}
                                </TextAction>
                            </>
                        ) : (
                            <>
                                <span className="inline-flex h-8 items-center gap-2 text-xs" style={{ color: theme.node.muted }}>
                                    <LoaderCircle className="size-3.5 animate-spin" />
                                    {activity}
                                </span>
                                <TextAction onClick={onToggleEnabled}>{t("agent.connect.cancel")}</TextAction>
                            </>
                        )}
                    </div>
                </section>

                {phase === "not-detected" ? (
                    <section className="space-y-2">
                        <SectionLabel>{t("agent.connect.firstUse")}</SectionLabel>
                        <div className="overflow-hidden rounded-xl border" style={{ borderColor: theme.node.stroke }}>
                            <GuideStep number={1} title={t("agent.connect.stepInstallTitle")} text={t("agent.connect.stepInstallText")} theme={theme}>
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                    <Button size="small" className="!h-8 !px-3" icon={<Copy className="size-3.5" />} onClick={copyInstallPrompt}>
                                        {t("agent.connect.installPromptAction")}
                                    </Button>
                                    <TextAction icon={<TerminalSquare className="size-3.5" />} onClick={() => setInstallManualOpen((open) => !open)}>
                                        {t("agent.connect.manualInstall")}
                                    </TextAction>
                                </div>
                                {installManualOpen ? (
                                    <CommandRow command={AGENT_PLUGIN_INSTALL_COMMAND} label={t("agent.connect.manualInstallText")} onCopy={() => copyCommand(AGENT_PLUGIN_INSTALL_COMMAND)} theme={theme} copyLabel={t("agent.connect.copyCommand")} />
                                ) : null}
                            </GuideStep>
                            <GuideStep number={2} title={t("agent.connect.stepOpenTitle")} text={t("agent.connect.stepOpenText")} theme={theme} last>
                                <CommandRow command={t("agent.connect.stepOpenPrompt")} label={t("agent.connect.promptToCopy")} onCopy={copyOpenPrompt} theme={theme} copyLabel={t("agent.connect.copyCommand")} />
                            </GuideStep>
                        </div>
                        <div className="text-[11px] leading-5" style={{ color: theme.node.muted }}>
                            {t("agent.connect.installPromptHint")}
                        </div>
                    </section>
                ) : phase === "installed" ? (
                    <section className="space-y-2">
                        <SectionLabel>{t("agent.connect.nextStep")}</SectionLabel>
                        <div className="overflow-hidden rounded-xl border" style={{ borderColor: theme.node.stroke }}>
                            <GuideStep number={1} title={t("agent.connect.stepOpenTitle")} text={t("agent.connect.stepOpenText")} theme={theme} last>
                                <CommandRow command={t("agent.connect.stepOpenPrompt")} label={t("agent.connect.promptToCopy")} onCopy={copyOpenPrompt} theme={theme} copyLabel={t("agent.connect.copyCommand")} />
                            </GuideStep>
                        </div>
                    </section>
                ) : null}

                {phase === "failed" || mcpCheck?.state === "attention" ? <SetupDiagnostics checks={checks} theme={theme} /> : null}

                {phase === "connected" ? (
                    <section className="space-y-2">
                        <div className="flex items-end justify-between gap-3">
                            <SectionLabel>{t("agent.connect.tryTitle")}</SectionLabel>
                            <span className="pb-1 text-[11px]" style={{ color: theme.node.muted }}>
                                {t("agent.connect.fillOnly")}
                            </span>
                        </div>
                        <div className="grid gap-2">
                            {suggestions.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    className="group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-xs leading-5 transition hover:bg-black/5 dark:hover:bg-white/10"
                                    style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                                    onClick={() => onUsePrompt(prompt)}
                                >
                                    <span>{prompt}</span>
                                    <span className="shrink-0 text-[11px] opacity-55 transition group-hover:opacity-100" style={{ color: theme.node.muted }}>
                                        {t("agent.connect.fillPrompt")}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                ) : null}

                <section className="overflow-hidden rounded-xl border" style={{ borderColor: theme.node.stroke }}>
                    <button type="button" className="flex w-full items-center gap-3 px-3.5 py-3 text-left" onClick={() => setConnectionOpen((open) => !open)} aria-expanded={connectionOpen}>
                        <PlugZap className="size-4 shrink-0" style={{ color: status.color }} />
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium leading-5">{t("agent.connect.connectionDetails")}</div>
                            <div className="mt-0.5 truncate text-[11px] leading-4" style={{ color: theme.node.muted }}>
                                {connectError || t("agent.connect.connectionDetailsHint")}
                            </div>
                        </div>
                        <ChevronDown className={`size-4 shrink-0 transition-transform ${connectionOpen ? "rotate-180" : ""}`} style={{ color: theme.node.muted }} />
                    </button>
                    {connectionOpen ? (
                        <div className="grid gap-2.5 border-t px-3.5 py-3" style={{ borderColor: theme.node.stroke }}>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[11px] leading-4" style={{ color: theme.node.muted }}>
                                    {t("agent.connect.autoDiscover")}
                                </span>
                                <Button className="!h-8 shrink-0 !px-3" size="small" type={enabled ? "default" : "primary"} icon={<PlugZap className="size-3.5" />} onClick={onToggleEnabled}>
                                    {t(enabled ? "agent.connect.disconnect" : "agent.connect.connect")}
                                </Button>
                            </div>
                            <label className="grid gap-1.5">
                                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.node.muted }}>
                                    <Link2 className="size-3.5" />
                                    {t("agent.connect.localAddress")}
                                </span>
                                <Input size="large" value={url} onChange={(event) => onUrlChange(event.target.value)} placeholder={t("agent.connect.urlPlaceholder")} />
                            </label>
                            <label className="grid gap-1.5">
                                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.node.muted }}>
                                    <KeyRound className="size-3.5" />
                                    {t("agent.connect.token")}
                                </span>
                                <Input.Password size="large" value={token} onChange={(event) => onTokenChange(event.target.value)} placeholder={t("agent.connect.tokenPlaceholder")} />
                            </label>
                            {connectError ? <ErrorCallout text={connectError} /> : null}
                        </div>
                    ) : null}
                </section>

                <details className="group rounded-xl border px-3.5 py-3" style={{ borderColor: theme.node.stroke }} open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
                        <TerminalSquare className="size-3.5" style={{ color: theme.node.muted }} />
                        <span className="flex-1">{t("agent.connect.advancedTitle")}</span>
                        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" style={{ color: theme.node.muted }} />
                    </summary>
                    <div className="mt-2 text-[11px] leading-5" style={{ color: theme.node.muted }}>
                        {t("agent.connect.advancedText")}
                    </div>
                    {advancedOpen ? (
                        <div className="mt-2 grid gap-1.5">
                            <CommandRow command={AGENT_CLI_COMMAND} label={t("agent.connect.manualCommand")} onCopy={() => copyCommand(AGENT_CLI_COMMAND)} theme={theme} copyLabel={t("agent.connect.copyCommand")} />
                            <CommandRow command={AGENT_PLUGIN_REMOVE_COMMAND} label={t("agent.connect.removePlugin")} onCopy={() => copyCommand(AGENT_PLUGIN_REMOVE_COMMAND)} theme={theme} copyLabel={t("agent.connect.copyCommand")} />
                            <CommandRow command={AGENT_MCP_REMOVE_COMMAND} label={t("agent.connect.removeMcp")} onCopy={() => copyCommand(AGENT_MCP_REMOVE_COMMAND)} theme={theme} copyLabel={t("agent.connect.copyCommand")} />
                        </div>
                    ) : null}
                </details>
            </div>
        </div>
    );
}

function setupStatus(phase: AgentSetupPhase, activity: string, t: (key: string) => string) {
    const labels: Record<AgentSetupPhase, string> = {
        "not-detected": t("agent.connect.statusNotDetected"),
        installed: t("agent.connect.statusInstalled"),
        connecting: t("agent.connect.statusConnecting"),
        "mcp-starting": t("agent.connect.statusMcpStarting"),
        connected: t("agent.connect.statusConnected"),
        failed: t("agent.connect.statusFailed"),
    };
    if (phase === "failed") return { label: labels[phase], color: "#dc2626", border: "rgba(220,38,38,.28)", background: "rgba(220,38,38,.045)", iconBackground: "rgba(220,38,38,.1)" };
    if (phase === "connected") return { label: labels[phase], color: "#16a34a", border: "rgba(22,163,74,.28)", background: "rgba(22,163,74,.045)", iconBackground: "rgba(22,163,74,.1)" };
    if (phase === "connecting" || phase === "mcp-starting") return { label: labels[phase], color: "#d97706", border: "rgba(217,119,6,.28)", background: "rgba(217,119,6,.045)", iconBackground: "rgba(217,119,6,.1)" };
    return { label: labels[phase], color: "#78716c", border: "rgba(120,113,108,.22)", background: "rgba(120,113,108,.035)", iconBackground: "rgba(120,113,108,.09)" };
}

function PhaseIcon({ phase }: { phase: AgentSetupPhase }) {
    if (phase === "connected") return <CheckCircle2 className="size-4.5" />;
    if (phase === "failed") return <AlertTriangle className="size-4.5" />;
    if (phase === "connecting" || phase === "mcp-starting") return <LoaderCircle className="size-4.5 animate-spin" />;
    return <PlugZap className="size-4.5" />;
}

function SectionLabel({ children }: { children: ReactNode }) {
    return <div className="text-[11px] font-medium uppercase tracking-[.14em] opacity-60">{children}</div>;
}

function GuideStep({ number, title, text, theme, children, last = false }: { number: number; title: string; text: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; children?: ReactNode; last?: boolean }) {
    return (
        <div className={`flex gap-3 px-3.5 py-3 ${last ? "" : "border-b"}`} style={{ borderColor: theme.node.stroke }}>
            <span className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums" style={{ background: theme.node.fill, color: theme.node.text }}>
                {number}
            </span>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium leading-5">{title}</div>
                <div className="mt-0.5 text-[11px] leading-5" style={{ color: theme.node.muted }}>
                    {text}
                </div>
                {children}
            </div>
        </div>
    );
}

function CommandRow({ command, label, onCopy, theme, copyLabel }: { command: string; label: string; onCopy: () => void; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; copyLabel: string }) {
    return (
        <div className="mt-2 rounded-lg border px-2.5 py-2" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
            <div className="mb-1 text-[10px] leading-4" style={{ color: theme.node.muted }}>
                {label}
            </div>
            <div className="flex items-start gap-2">
                <code className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[11px] leading-5">{command}</code>
                <Tooltip title={copyLabel}>
                    <Button size="small" type="text" className="!h-6 !w-6 !min-w-6" icon={<Copy className="size-3.5" />} onClick={onCopy} aria-label={copyLabel} />
                </Tooltip>
            </div>
        </div>
    );
}

function TextAction({ children, icon, onClick }: { children: ReactNode; icon?: ReactNode; onClick: () => void }) {
    return (
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10" onClick={onClick}>
            {icon}
            {children}
        </button>
    );
}

function StatusPill({ text, color }: { text: string; color: string }) {
    return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] leading-4" style={{ borderColor: color, color }}>
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="max-w-24 truncate">{text}</span>
        </span>
    );
}

function SetupDiagnostics({ checks, theme }: { checks: ReturnType<typeof getAgentSetupChecks>; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const { t } = useTranslation();
    return (
        <section className="rounded-xl border p-3.5" style={{ borderColor: theme.node.stroke }}>
            <div className="text-xs font-medium">{t("agent.connect.diagnosticsTitle")}</div>
            <div className="mt-2.5 grid gap-2">
                {checks.map((check) => (
                    <div key={check.key} className="flex items-start gap-2.5">
                        <CheckIcon state={check.state} />
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium leading-4">{t(checkLabelKey(check.key))}</div>
                            <div className="mt-0.5 text-[10px] leading-4" style={{ color: theme.node.muted }}>
                                {t(checkDetailKey(check.key, check.state))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function CheckIcon({ state }: { state: AgentSetupCheckState }) {
    if (state === "ready") return <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />;
    if (state === "waiting") return <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin text-amber-600" />;
    if (state === "attention") return <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-600" />;
    return <Circle className="mt-0.5 size-3.5 shrink-0 opacity-35" />;
}

function checkLabelKey(key: AgentSetupCheckKey) {
    return `agent.connect.check${key[0].toUpperCase()}${key.slice(1)}Label`;
}

function checkDetailKey(key: AgentSetupCheckKey, state: AgentSetupCheckState) {
    return `agent.connect.check${key[0].toUpperCase()}${key.slice(1)}${state[0].toUpperCase()}${state.slice(1)}`;
}

function ErrorCallout({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-5" style={{ borderColor: "rgba(220,38,38,.35)", color: "#dc2626" }}>
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{text}</span>
        </div>
    );
}
