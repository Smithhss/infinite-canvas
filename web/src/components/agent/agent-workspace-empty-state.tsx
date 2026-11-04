import type { ReactNode } from "react";
import { Box, Clapperboard, GitBranch, Layers, Link2, MousePointer2, Search, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAgentCanvasSummary } from "@/hooks/use-agent-canvas-summary";
import { AGENT_SCENE_PRESET_KEYS, getAgentSuggestionKeys, type AgentScenePresetKey, type AgentSuggestionKey } from "@/lib/agent/agent-suggestions";
import { canvasThemes } from "@/lib/canvas-theme";

export function AgentWorkspaceEmptyState({
    theme,
    onUsePrompt,
    onOpenSkills,
}: {
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onUsePrompt: (prompt: string) => void;
    onOpenSkills: () => void;
}) {
    const { t } = useTranslation();
    const canvasSummary = useAgentCanvasSummary();
    const suggestions = getAgentSuggestionKeys(canvasSummary);

    return (
        <div className="@container flex min-h-full flex-1">
            <div className="relative m-auto w-full max-w-[460px] px-4 py-8">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-x-8 top-0 h-52 opacity-70"
                    style={{ background: `radial-gradient(ellipse at top, color-mix(in srgb, ${theme.node.text} 7%, transparent), transparent 68%)` }}
                />
                <div className="relative">
                    <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em]" style={{ color: theme.node.muted }}>
                        <Sparkles className="size-3.5" />
                        {t("agent.workspace.eyebrow")}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{t("agent.workspace.title")}</h2>
                    <p className="mt-2 max-w-sm text-xs leading-5" style={{ color: theme.node.muted }}>
                        {t("agent.workspace.description")}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                        <CanvasStat icon={<Box className="size-3" />} label={t("agent.workspace.nodes", { count: canvasSummary.nodeCount })} theme={theme} />
                        <CanvasStat icon={<Link2 className="size-3" />} label={t("agent.workspace.connections", { count: canvasSummary.connectionCount })} theme={theme} />
                        <CanvasStat icon={<MousePointer2 className="size-3" />} label={t("agent.workspace.selected", { count: canvasSummary.selectedNodeCount })} theme={theme} />
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-2 @min-[360px]:grid-cols-2">
                        {suggestions.map((key) => (
                            <SuggestionCard key={key} suggestionKey={key} theme={theme} onUsePrompt={onUsePrompt} />
                        ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/10" style={{ borderColor: theme.node.stroke, color: theme.node.text, outlineColor: theme.toolbar.activeText }} onClick={onOpenSkills}>
                            <Sparkles className="size-3.5" />
                            {t("agent.workspace.browseSkills")}
                        </button>
                        {AGENT_SCENE_PRESET_KEYS.map((key) => (
                            <button key={key} type="button" className="inline-flex h-8 items-center rounded-full border px-3 text-xs transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/10" style={{ borderColor: theme.node.stroke, color: theme.node.muted, outlineColor: theme.toolbar.activeText }} onClick={() => onUsePrompt(t(key))}>
                                {t(scenePresetLabelKey(key))}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-[10px] leading-4" style={{ color: theme.node.muted }}>
                        {t("agent.workspace.fillOnlyHint")}
                    </p>
                </div>
            </div>
        </div>
    );
}

function CanvasStat({ icon, label, theme }: { icon: ReactNode; label: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] tabular-nums" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
            {icon}
            {label}
        </span>
    );
}

function SuggestionCard({ suggestionKey, theme, onUsePrompt }: { suggestionKey: AgentSuggestionKey; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onUsePrompt: (prompt: string) => void }) {
    const { t } = useTranslation();
    const prompt = t(suggestionKey);
    return (
        <button
            type="button"
            className="group flex min-h-[82px] flex-col rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:bg-black/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/[0.035]"
            style={{ borderColor: theme.node.stroke, color: theme.node.text, outlineColor: theme.toolbar.activeText }}
            aria-label={t("agent.workspace.useSuggestion", { prompt })}
            onClick={() => onUsePrompt(prompt)}
        >
            <span className="grid size-7 place-items-center rounded-lg" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>
                {suggestionIcon(suggestionKey)}
            </span>
            <span className="mt-auto pt-3 text-xs font-medium leading-5">{prompt}</span>
            <span className="mt-1 text-[10px]" style={{ color: theme.node.muted }}>
                {t("agent.connect.fillPrompt")}
            </span>
        </button>
    );
}

function suggestionIcon(key: AgentSuggestionKey): ReactNode {
    if (key.includes("CreateFlow") || key.includes("ConnectFlow") || key.includes("Organize")) return <GitBranch className="size-3.5" />;
    if (key.includes("Grid") || key.includes("Variants")) return <Layers className="size-3.5" />;
    if (key.includes("Storyboard") || key.includes("ShotPlan")) return <Clapperboard className="size-3.5" />;
    if (key.includes("Review") || key.includes("Describe") || key.includes("Read") || key.includes("Find")) return <Search className="size-3.5" />;
    return <Sparkles className="size-3.5" />;
}

function scenePresetLabelKey(key: AgentScenePresetKey) {
    if (key === "agent.scenePreset.scriptOriginal") return "agent.scenePreset.scriptOriginalLabel";
    if (key === "agent.scenePreset.scriptAdaptation") return "agent.scenePreset.scriptAdaptationLabel";
    return "agent.scenePreset.directorLabel";
}
