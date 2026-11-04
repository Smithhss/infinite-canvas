import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import { useTranslation } from "react-i18next";

import { isFeatureEnabled } from "@/constant/feature-flags";
import { useAgentCanvasSummary } from "@/hooks/use-agent-canvas-summary";
import { getAgentSuggestionKeys } from "@/lib/agent/agent-suggestions";
import { canvasThemes } from "@/lib/canvas-theme";
import { summarizeCanvasAgentOps } from "@/lib/canvas/canvas-agent-ops";
import { useAgentStore, type AgentChatItem, type AgentPendingApproval, type AgentPendingToolCall, type AgentTokenUsage } from "@/stores/use-agent-store";
import { AgentApprovalCard, AgentChatMessage, AgentCommandGroup, AgentPendingToolCard, AgentToolCard, AgentWorkingMessage } from "./agent-chat-message";
import { agentMessageToChatMessage, currentPlanMessage, isPlanMessage, latestPlanMessage, toolCallDetail, toolName, workingActivity } from "./agent-event-formatters";
import { AgentScrollToBottom } from "./agent-scroll-to-bottom";
import { AgentWorkspaceEmptyState } from "./agent-workspace-empty-state";

const SCROLL_BOTTOM_THRESHOLD = 48;
const historyMessageStyle = { contentVisibility: "auto", containIntrinsicSize: "0 80px" } as const;

export function AgentChatTimeline({
    theme,
    pendingTools,
    pendingApprovals,
    sending,
    waiting,
    onRejectTool,
    onApproveTool,
    onApprovalDecision,
}: {
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    pendingTools: AgentPendingToolCall[];
    pendingApprovals: AgentPendingApproval[];
    sending: boolean;
    waiting: boolean;
    onRejectTool: (requestId: string) => void;
    onApproveTool: (requestId: string) => void;
    onApprovalDecision: (approval: AgentPendingApproval, decision: "accept" | "acceptForSession" | "decline") => void;
}) {
    const { t } = useTranslation();
    const messages = useAgentStore((state) => state.messages);
    const connected = useAgentStore((state) => state.connected);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const bootstrapStatus = useAgentStore((state) => state.bootstrapStatus);
    const mcpStartupStatuses = useAgentStore((state) => state.mcpStartupStatuses);
    const timeline = useMemo(() => groupTimelineMessages(messages), [messages]);
    const listRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const followMessagesRef = useRef(true);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const streaming = messages.some((message) => message.streamId);
    const showBootstrap = Boolean(bootstrapStatus && bootstrapStatus.status !== "ready" && !messages.some((message) => message.role === "user" || message.role === "assistant"));
    const showEmptyState = connected && !timeline.length && !pendingTools.length && !pendingApprovals.length && !sending && !waiting && !showBootstrap;
    const working = showBootstrap ? bootstrapStatus! : workingActivity(messages.at(-1));
    const updateScrollState = useCallback(() => {
        const list = listRef.current;
        if (!list) return;
        const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= SCROLL_BOTTOM_THRESHOLD;
        followMessagesRef.current = atBottom;
        setShowScrollToBottom(!atBottom);
    }, []);
    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
        const list = listRef.current;
        if (!list) return;
        followMessagesRef.current = true;
        list.scrollTo({ top: list.scrollHeight, behavior });
        setShowScrollToBottom(false);
    }, []);
    useEffect(() => {
        const frame = requestAnimationFrame(() => (followMessagesRef.current ? scrollToBottom("auto") : updateScrollState()));
        return () => cancelAnimationFrame(frame);
    }, [messages, pendingApprovals, pendingTools, scrollToBottom, updateScrollState, waiting]);
    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;
        let frame = 0;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => (followMessagesRef.current ? scrollToBottom("auto") : updateScrollState()));
        });
        observer.observe(content);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [scrollToBottom, updateScrollState]);
    return (
        <div className="relative min-h-0 flex-1">
            <div ref={listRef} className="thin-scrollbar h-full select-text overflow-y-auto" onScroll={updateScrollState}>
                <div ref={contentRef} className="flex min-h-full flex-col gap-4 px-4 pt-4">
                    {timeline.map((entry) => entry.type === "commands"
                        ? <AgentCommandGroupRow key={entry.id} items={entry.items} theme={theme} />
                        : <AgentChatMessageRow key={entry.item.id} item={entry.item} theme={theme} />)}
                    {showEmptyState ? (isFeatureEnabled("agentPanelChrome")
                        ? <AgentWorkspaceEmptyState theme={theme} onUsePrompt={(prompt) => setAgentState({ prompt })} onOpenSkills={() => setAgentState({ activeTab: "skills" })} />
                        : <AgentChatEmptyState theme={theme} onUsePrompt={(prompt) => setAgentState({ prompt })} />) : null}
                    {pendingTools.map((pendingTool) => (
                        <AgentPendingToolCard
                            key={pendingTool.requestId}
                            summary={summarizeCanvasAgentOps(pendingTool.input?.ops || []) || toolName(pendingTool.name)}
                            detail={toolCallDetail(pendingTool.name, pendingTool.input, "pending")}
                            theme={theme}
                            onReject={() => onRejectTool(pendingTool.requestId)}
                            onApprove={() => onApproveTool(pendingTool.requestId)}
                        />
                    ))}
                    {pendingApprovals.map((approval) => <AgentApprovalCard key={approval.requestId} approval={approval} theme={theme} onDecision={(decision) => onApprovalDecision(approval, decision)} />)}
                    {(sending || waiting || showBootstrap) && !streaming && !pendingTools.length && !pendingApprovals.length ? <AgentWorkingMessage text={working.text} detail={"detail" in working && typeof working.detail === "string" ? working.detail : undefined} status={showBootstrap ? bootstrapStatus?.status : undefined} mcpStatuses={showBootstrap ? Object.entries(mcpStartupStatuses).map(([name, item]) => ({ name, ...item })) : []} activityKey={working.key} theme={theme} /> : null}
                </div>
            </div>
            {showScrollToBottom ? (
                <AgentScrollToBottom theme={theme} title={t("agent.chat.latestMessages")} onClick={() => scrollToBottom()} />
            ) : null}
        </div>
    );
}

export function AgentTaskProgress({ theme, busy }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; busy: boolean }) {
    const { t } = useTranslation();
    const plan = useAgentStore((state) => busy ? currentPlanMessage(state.messages) : latestPlanMessage(state.messages));
    if (!plan) return null;
    return (
        <div className="shrink-0 px-4 pt-2">
            <AgentToolCard key={plan.id} title={plan.title || t("agent.events.progress")} text={plan.text} detail={plan.detail} theme={theme} />
        </div>
    );
}

function AgentChatEmptyState({ theme, onUsePrompt }: { theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onUsePrompt: (prompt: string) => void }) {
    const { t } = useTranslation();
    const canvasSummary = useAgentCanvasSummary();
    const examples = getAgentSuggestionKeys(canvasSummary).slice(0, 3).map((key) => t(key));
    return (
        <div className="flex flex-1 flex-col justify-center py-8">
            <div className="mx-auto w-full max-w-md">
                <div className="text-lg font-semibold leading-7">{t("agent.connect.emptyTitle")}</div>
                <div className="mt-1.5 text-xs leading-5" style={{ color: theme.node.muted }}>{t("agent.connect.emptyDescription")}</div>
                <div className="mt-4 grid gap-2">
                    {examples.map((prompt) => (
                        <button key={prompt} type="button" className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-sm leading-6 transition hover:bg-black/5 dark:hover:bg-white/10" style={{ borderColor: theme.node.stroke, color: theme.node.text }} onClick={() => onUsePrompt(prompt)}>
                            <span>{prompt}</span>
                            <span className="shrink-0 text-[11px]" style={{ color: theme.node.muted }}>{t("agent.connect.fillPrompt")}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

const AgentChatMessageRow = memo(function AgentChatMessageRow({ item, theme }: { item: AgentChatItem; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const endpoint = useAgentStore((state) => state.url);
    const token = useAgentStore((state) => state.token);
    return (
        <div style={item.streamId ? undefined : historyMessageStyle}>
            <AgentChatMessage item={agentMessageToChatMessage(item, endpoint, token)} theme={theme} />
        </div>
    );
});

const AgentCommandGroupRow = memo(function AgentCommandGroupRow({ items, theme }: { items: AgentChatItem[]; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <div style={items.some((item) => item.streamId) ? undefined : historyMessageStyle}>
            <AgentCommandGroup items={items} theme={theme} />
        </div>
    );
});

type AgentTimelineEntry = { type: "message"; item: AgentChatItem } | { type: "commands"; id: string; items: AgentChatItem[] };

function groupTimelineMessages(messages: AgentChatItem[]) {
    const timeline: AgentTimelineEntry[] = [];
    let commands: AgentChatItem[] = [];
    let commandScope = "";
    const flushCommands = () => {
        if (!commands.length) return;
        timeline.push({ type: "commands", id: `commands:${commands[0].id}`, items: commands });
        commands = [];
        commandScope = "";
    };
    messages.forEach((item) => {
        if (isPlanMessage(item)) return;
        if (isCommandMessage(item)) {
            const scope = item.threadId && item.turnId ? `${item.threadId}\0${item.turnId}` : item.id;
            if (commands.length && scope !== commandScope) flushCommands();
            commands.push(item);
            commandScope = scope;
            return;
        }
        flushCommands();
        timeline.push({ type: "message", item });
    });
    flushCommands();
    return timeline;
}

function isCommandMessage(item: AgentChatItem) {
    return item.role === "tool" && item.detail && typeof item.detail === "object" && (item.detail as { kind?: unknown }).kind === "command";
}

export function AgentUsageBar({ usage, theme }: { usage: AgentTokenUsage; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-center gap-4 px-4 pt-1 text-[11px] tabular-nums" style={{ color: theme.node.muted }}>
            <span className="opacity-70">{t("agent.chat.latestCall")}</span>
            <UsageNumber label={t("agent.chat.input")} value={usage.input} color={theme.node.text} />
            <UsageNumber label={t("agent.chat.cached")} value={usage.cached} color={theme.node.text} />
            <UsageNumber label={t("agent.chat.output")} value={usage.output} color={theme.node.text} />
        </div>
    );
}

function UsageNumber({ label, value, color }: { label: string; value: number; color: string }) {
    const spring = useSpring(value, { stiffness: 110, damping: 24, mass: 0.7 });
    const text = useTransform(spring, (current) => Math.round(current).toLocaleString());
    useEffect(() => spring.set(value), [spring, value]);
    return (
        <span className="inline-flex items-baseline gap-1" aria-label={`${label} ${value.toLocaleString()}`}>
            <span>{label}</span>
            <motion.span aria-hidden className="font-medium" style={{ color }}>
                {text}
            </motion.span>
        </span>
    );
}
