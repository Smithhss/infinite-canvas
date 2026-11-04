import { LoaderCircle, ShieldAlert, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";

import { summarizeAgentRuntime } from "@/lib/agent/agent-runtime-status";
import { canvasThemes } from "@/lib/canvas-theme";
import type { AgentPendingApproval, AgentPendingToolCall } from "@/stores/use-agent-store";

export function AgentRuntimeStatus({
    activity,
    sending,
    waiting,
    pendingTools,
    pendingApprovals,
    theme,
}: {
    activity: string;
    sending: boolean;
    waiting: boolean;
    pendingTools: AgentPendingToolCall[];
    pendingApprovals: AgentPendingApproval[];
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
}) {
    const { t } = useTranslation();
    const runtime = summarizeAgentRuntime({ sending, waiting, pendingTools, pendingApprovals });
    const active = runtime.phase !== "idle";
    const color = runtime.phase === "approval" ? "#d97706" : runtime.phase === "tool" ? "#ea580c" : active ? "#16a34a" : theme.node.muted;

    return (
        <div className="flex min-h-10 shrink-0 items-center gap-2 border-b px-4 py-2 text-[11px]" role="status" aria-live="polite" aria-label={t("agent.runtimeStatus.label", { activity })} style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
            <span className="relative grid size-2 shrink-0 place-items-center">
                <span className="absolute size-2 rounded-full opacity-20" style={{ background: color }} />
                <span className={`size-1.5 rounded-full ${active ? "animate-pulse motion-reduce:animate-none" : ""}`} style={{ background: color }} />
            </span>
            <span className="min-w-0 flex-1 truncate" style={{ color: active ? theme.node.text : theme.node.muted }}>
                {activity}
            </span>
            {runtime.pendingToolCount ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: theme.node.stroke, color: theme.node.text }} title={pendingTools.map((tool) => tool.name).join(", ")}>
                    <Wrench className="size-3" />
                    {t("agent.runtimeStatus.tool", { count: runtime.pendingToolCount })}
                </span>
            ) : null}
            {runtime.pendingApprovalCount ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5" style={{ borderColor: theme.node.stroke, color: "#d97706" }}>
                    <ShieldAlert className="size-3" />
                    {t("agent.runtimeStatus.approval", { count: runtime.pendingApprovalCount })}
                </span>
            ) : null}
            {active && !runtime.queueCount ? <LoaderCircle className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
        </div>
    );
}
