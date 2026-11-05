import type { ReactNode } from "react";
import { ArrowRight, Clapperboard, GitBranch, Layers, Search, Sparkles } from "lucide-react";
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
        <div className="@container flex min-h-full flex-1 items-center justify-center px-4 py-8">
            <div className="relative m-auto w-full max-w-[400px]">
                <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-44 opacity-55" style={{ background: `radial-gradient(ellipse at top, color-mix(in srgb, ${theme.node.text} 8%, transparent), transparent 70%)` }} />
                <div className="relative">
                    <div className="mx-auto size-11 rounded-full" style={{ background: "radial-gradient(circle at 34% 28%, #f0fbff 0%, #b8eaff 14%, #69c9ff 34%, #238fe0 62%, #0c4da0 100%)", boxShadow: "0 0 20px rgba(68,183,255,.55), inset -6px -8px 16px rgba(3,53,130,.45)" }} />
                    <h2 className="mt-5 text-center text-base font-semibold tracking-[-0.02em]">{t("agent.workspace.emptyTitle")}</h2>

                    <div className="mt-7 space-y-0.5">
                        {suggestions.map((key) => (
                            <SuggestionRow key={key} suggestionKey={key} theme={theme} onUsePrompt={onUsePrompt} />
                        ))}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/[0.06]" style={{ color: theme.node.text, outlineColor: theme.toolbar.activeText }} onClick={onOpenSkills}>
                            <Sparkles className="size-3.5" />
                            {t("agent.workspace.browseSkills")}
                        </button>
                        {AGENT_SCENE_PRESET_KEYS.map((key) => (
                            <button key={key} type="button" className="inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/[0.06]" style={{ color: theme.node.muted, outlineColor: theme.toolbar.activeText }} onClick={() => onUsePrompt(t(key))}>
                                {t(scenePresetLabelKey(key))}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SuggestionRow({ suggestionKey, theme, onUsePrompt }: { suggestionKey: AgentSuggestionKey; theme: (typeof canvasThemes)[keyof typeof canvasThemes]; onUsePrompt: (prompt: string) => void }) {
    const { t } = useTranslation();
    const prompt = t(suggestionKey);
    return (
        <button
            type="button"
            className="group flex min-h-10 w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition hover:bg-black/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/[0.045]"
            style={{ color: theme.node.text, outlineColor: theme.toolbar.activeText }}
            aria-label={t("agent.workspace.useSuggestion", { prompt })}
            onClick={() => onUsePrompt(prompt)}
        >
            <span className="grid size-5 shrink-0 place-items-center" style={{ color: theme.node.text }}>
                {suggestionIcon(suggestionKey)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs leading-5">{prompt}</span>
            <ArrowRight className="size-3.5 shrink-0 opacity-35 transition group-hover:translate-x-0.5 group-hover:opacity-70" />
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
