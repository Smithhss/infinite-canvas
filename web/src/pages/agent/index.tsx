import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Input } from "antd";
import { motion } from "motion/react";
import {
    ArrowRight,
    Bot,
    Check,
    CheckCircle2,
    ChevronRight,
    Clapperboard,
    Compass,
    Cpu,
    FileText,
    FolderGit2,
    Gamepad2,
    Hand,
    ImagePlus,
    LoaderCircle,
    Megaphone,
    MonitorCog,
    MousePointerClick,
    Music2,
    RefreshCw,
    Search,
    ShieldCheck,
    Sparkles,
    Star,
    UserRound,
    WandSparkles,
    X,
    Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router-dom";

import { withShellFeatureFlags } from "@/components/layout/navigation-groups";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { reconnectAgentWithDiscovery } from "@/hooks/use-agent-auto-connect";
import { useAgentSkillFavorites } from "@/hooks/use-agent-skill-favorites";
import { activeAgentProvider } from "@/lib/agent/agent-provider";
import {
    agentSkillDescription,
    agentSkillDisplayName,
    agentSkillKey,
    agentSkillMarker,
    filterAgentSkills,
    type AgentSkillCollection,
    type AgentSkillScopeFilter,
} from "@/lib/agent/agent-skill-catalog";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { writeAppStorageItem } from "@/lib/storage-namespace";
import { fetchCodexSkill, type AgentSkillDetail, type AgentSkillSummary } from "@/services/api/canvas-agent";
import { useAgentSkillFavoriteStore } from "@/stores/use-agent-skill-favorite-store";
import { useAgentSkillStore } from "@/stores/use-agent-skill-store";
import { useAgentStore, type AgentModel } from "@/stores/use-agent-store";
import { useThemeStore } from "@/stores/use-theme-store";

type AgentScopeOption = { value: AgentSkillScopeFilter; label: string; icon: ReactNode };
type AgentCategory = "recommended" | "film" | "commercial" | "drama" | "anime" | "music" | "creator" | "general" | "discover";
type AgentCategoryOption = { value: AgentCategory; label: string; icon: ReactNode };
const EMPTY_SKILLS: AgentSkillSummary[] = [];

export default function AgentPage() {
    const { search } = useLocation();
    if (!isFeatureEnabled("agentSkillHub")) return <Navigate to={withShellFeatureFlags("/", search)} replace />;
    return <AgentSkillHubPage />;
}

function AgentSkillHubPage() {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const favoritesLoaded = useAgentSkillFavorites();
    const connected = useAgentStore((state) => state.connected);
    const enabled = useAgentStore((state) => state.enabled);
    const endpoint = useAgentStore((state) => state.url.trim().replace(/\/$/, ""));
    const token = useAgentStore((state) => state.token);
    const provider = activeAgentProvider(useAgentStore((state) => state.agentProvider));
    const connectError = useAgentStore((state) => state.connectError);
    const prompt = useAgentStore((state) => state.prompt);
    const confirmTools = useAgentStore((state) => state.confirmTools);
    const models = useAgentStore((state) => state.models);
    const model = useAgentStore((state) => state.model);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const openPanel = useAgentStore((state) => state.openPanel);
    const skills = useAgentSkillStore((state) => state.skills);
    const selectedSkills = useAgentSkillStore((state) => state.selectedSkills);
    const loading = useAgentSkillStore((state) => state.loading);
    const loaded = useAgentSkillStore((state) => state.loaded);
    const errors = useAgentSkillStore((state) => state.errors);
    const loadSkills = useAgentSkillStore((state) => state.loadSkills);
    const favoriteKeys = useAgentSkillFavoriteStore((state) => state.keys);
    const toggleFavorite = useAgentSkillFavoriteStore((state) => state.toggleFavorite);
    const [query, setQuery] = useState("");
    const [collection, setCollection] = useState<AgentSkillCollection>("all");
    const [category, setCategory] = useState<AgentCategory>("recommended");
    const [scope, setScope] = useState<AgentSkillScopeFilter>("all");
    const [enabledOnly, setEnabledOnly] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<AgentSkillSummary | null>(null);
    const [modelPickerOpen, setModelPickerOpen] = useState(false);
    const [modePickerOpen, setModePickerOpen] = useState(false);
    useEffect(() => {
        if (connected && !loaded && !loading) void loadSkills(endpoint, token);
    }, [connected, endpoint, loadSkills, loaded, loading, provider, token]);

    const availableSkills = connected ? skills : EMPTY_SKILLS;
    const categorySkills = useMemo(
        () => filterAgentSkills({ skills: availableSkills, query: "", scope: "all", collection, enabledOnly: false, favoriteKeys }),
        [availableSkills, collection, favoriteKeys],
    );
    const visibleSkills = useMemo(
        () =>
            filterAgentSkills({ skills: availableSkills, query, scope, collection, enabledOnly, favoriteKeys }).filter((skill) =>
                matchesAgentCategory(skill, category),
            ),
        [availableSkills, category, collection, enabledOnly, favoriteKeys, query, scope],
    );
    const managedCount = availableSkills.filter((skill) => skill.managed).length;
    const favoriteCount = availableSkills.filter((skill) => favoriteKeys.includes(agentSkillKey(skill))).length;
    const hasFilter = Boolean(query.trim()) || category !== "recommended" || scope !== "all" || enabledOnly;
    const collectionEmpty = !categorySkills.length;
    const selectedKeys = new Set(selectedSkills.map(agentSkillKey));
    const currentModel = models.find((item) => item.model === model) || models[0];
    const canSubmit = Boolean(prompt.trim() || selectedSkills.length);

    const scopeOptions: AgentScopeOption[] = [
        { value: "all", label: t("agentHub.allSources"), icon: <Sparkles className="size-3.5" /> },
        { value: "repo", label: t("agent.skillManager.scopes.repo"), icon: <FolderGit2 className="size-3.5" /> },
        { value: "user", label: t("agent.skillManager.scopes.user"), icon: <UserRound className="size-3.5" /> },
        { value: "system", label: t("agent.skillManager.scopes.system"), icon: <MonitorCog className="size-3.5" /> },
        { value: "admin", label: t("agent.skillManager.scopes.admin"), icon: <ShieldCheck className="size-3.5" /> },
    ];
    const categoryOptions: AgentCategoryOption[] = [
        { value: "recommended", label: t("agentHub.categories.recommended"), icon: <Sparkles className="size-3.5" /> },
        { value: "film", label: t("agentHub.categories.film"), icon: <Clapperboard className="size-3.5" /> },
        { value: "commercial", label: t("agentHub.categories.commercial"), icon: <Megaphone className="size-3.5" /> },
        { value: "drama", label: t("agentHub.categories.drama"), icon: <FileText className="size-3.5" /> },
        { value: "anime", label: t("agentHub.categories.anime"), icon: <Gamepad2 className="size-3.5" /> },
        { value: "music", label: t("agentHub.categories.music"), icon: <Music2 className="size-3.5" /> },
        { value: "creator", label: t("agentHub.categories.creator"), icon: <MousePointerClick className="size-3.5" /> },
        { value: "general", label: t("agentHub.categories.general"), icon: <WandSparkles className="size-3.5" /> },
        { value: "discover", label: t("agentHub.categories.discover"), icon: <Compass className="size-3.5" /> },
    ];
    const collectionItems: Array<{ key: AgentSkillCollection; label: string; count: number }> = [
        { key: "all", label: t("agentHub.tabs.all"), count: availableSkills.length },
        { key: "favorites", label: t("agentHub.tabs.favorites"), count: favoriteCount },
        { key: "mine", label: t("agentHub.tabs.mine"), count: managedCount },
    ];

    const openAgent = (tab: "chat" | "setup" = connected ? "chat" : "setup") => {
        setAgentState({ activeTab: tab });
        openPanel();
    };
    const selectSkill = (skill: AgentSkillSummary) => {
        const current = useAgentSkillStore.getState().skills.find((item) => agentSkillKey(item) === agentSkillKey(skill));
        if (!current?.enabled) return;
        const skillState = useAgentSkillStore.getState();
        if (skillState.selectedSkills.some((item) => agentSkillKey(item) === agentSkillKey(current))) skillState.removeSkill(current);
        else skillState.selectSkill(current);
    };
    const useSkill = (skill: AgentSkillSummary) => {
        const current = useAgentSkillStore.getState().skills.find((item) => agentSkillKey(item) === agentSkillKey(skill));
        if (!current?.enabled) return;
        if (!useAgentSkillStore.getState().selectedSkills.some((item) => agentSkillKey(item) === agentSkillKey(current))) useAgentSkillStore.getState().selectSkill(current);
        requestAnimationFrame(() => {
            const composer = document.getElementById("agent-skill-composer");
            composer?.scrollIntoView({ behavior: "smooth", block: "center" });
            composer?.focus();
        });
    };
    const openComposerTarget = () => {
        if (!prompt.trim() && !selectedSkills.length) return;
        setAgentState({ activeTab: connected ? "chat" : "setup" });
        openPanel();
    };
    const changeModel = (nextModel: string) => {
        const selected = models.find((item) => item.model === nextModel);
        if (!selected) return;
        const effort = selected.defaultReasoningEffort || selected.supportedReasoningEfforts[0]?.reasoningEffort;
        writeAppStorageItem(`canvas-agent-model-${provider}`, nextModel);
        if (effort) writeAppStorageItem("canvas-agent-reasoning-effort-codex", effort);
        setAgentState({ model: nextModel, ...(effort ? { reasoningEffort: effort } : {}) });
    };
    const resetFilters = () => {
        setQuery("");
        setCategory("recommended");
        setScope("all");
        setEnabledOnly(false);
    };
    const browseAllSkills = () => {
        setCollection("all");
        resetFilters();
    };

    return (
        <main className="relative h-full overflow-y-auto" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-80"
                style={{
                    backgroundImage: `radial-gradient(circle at 50% -12%, color-mix(in srgb, ${theme.node.text} 7%, transparent), transparent 38%), linear-gradient(color-mix(in srgb, ${theme.node.stroke} 20%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, ${theme.node.stroke} 16%, transparent) 1px, transparent 1px)`,
                    backgroundSize: "auto, 48px 48px, 48px 48px",
                    maskImage: "linear-gradient(to bottom, rgba(0,0,0,.78), transparent 62%)",
                }}
            />

            <div className="relative mx-auto max-w-[1400px] px-4 pb-12 sm:px-6 lg:px-10">
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    className="relative flex min-h-[330px] flex-col items-center justify-center pb-8 pt-9 text-center"
                >
                    <button
                        type="button"
                        className="absolute right-0 top-5 hidden h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-medium transition hover:bg-white/5 sm:flex"
                        style={{ borderColor: theme.node.stroke, color: theme.node.muted }}
                        onClick={() => openAgent(connected ? "chat" : "setup")}
                    >
                        <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-400" : enabled ? "bg-amber-400" : "bg-stone-500"}`} />
                        {connected ? t("agentHub.connected") : enabled ? t("agentHub.connecting") : t("agentHub.disconnected")}
                        <ChevronRight className="size-3" />
                    </button>

                    <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.node.faint }}>
                        <WandSparkles className="size-3.5" />
                        LibTV Agent
                        <span className="rounded border px-1.5 py-0.5 text-[9px] tracking-[0.12em]" style={{ borderColor: theme.node.stroke }}>BETA</span>
                    </div>
                    <h1 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[34px]">{t("agentHub.heroTitle")}</h1>

                    <div
                        className="mt-7 w-full max-w-[860px] overflow-hidden rounded-[18px] border text-left shadow-[0_24px_80px_-58px_rgba(0,0,0,.95)]"
                        style={{ background: theme.node.panel, borderColor: theme.node.stroke }}
                    >
                        <div className="px-4 pb-1 pt-4">
                            {selectedSkills.length ? (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {selectedSkills.map((skill) => (
                                        <button
                                            key={agentSkillKey(skill)}
                                            type="button"
                                            className="inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] transition hover:bg-white/5"
                                            style={{ borderColor: theme.node.stroke, background: theme.toolbar.activeBg, color: theme.node.text }}
                                            onClick={() => selectSkill(skill)}
                                        >
                                            <Sparkles className="size-3" />
                                            {agentSkillDisplayName(skill)}
                                            <X className="size-3 opacity-50" />
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            <Input.TextArea
                                id="agent-skill-composer"
                                variant="borderless"
                                autoSize={{ minRows: 2, maxRows: 5 }}
                                className="!resize-none !border-0 !bg-transparent !px-0 !py-0 !text-sm !leading-6 !shadow-none"
                                style={{ color: theme.node.text }}
                                placeholder={t("agentHub.composerPlaceholder")}
                                value={prompt}
                                onChange={(event) => setAgentState({ prompt: event.target.value })}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        openComposerTarget();
                                    }
                                }}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3 pt-2">
                            <ComposerButton theme={theme} icon={<ImagePlus className="size-3.5" />} label={t("agentHub.addAttachment")} onClick={() => openAgent(connected ? "chat" : "setup")} />
                            <ComposerButton
                                theme={theme}
                                icon={<Cpu className="size-3.5" />}
                                label={currentModel?.displayName || currentModel?.model || t("agentHub.selectModel")}
                                onClick={() => setModelPickerOpen(true)}
                            />
                            <ComposerButton
                                theme={theme}
                                icon={<Sparkles className="size-3.5" />}
                                label={`${t("agentHub.selectSkill")}${selectedSkills.length ? ` · ${selectedSkills.length}` : ""}`}
                                onClick={() => document.getElementById("agent-skill-library")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                            />
                            {provider === "codex" ? (
                                <ComposerButton
                                    theme={theme}
                                    icon={confirmTools ? <Hand className="size-3.5" /> : <Zap className="size-3.5" />}
                                    label={t(confirmTools ? "agentHub.manualMode" : "agentHub.automaticMode")}
                                    onClick={() => setModePickerOpen(true)}
                                />
                            ) : null}
                            <button
                                type="button"
                                className="ml-auto grid size-9 shrink-0 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30"
                                style={{ background: theme.node.text, color: theme.node.panel }}
                                disabled={!canSubmit}
                                aria-label={t("agentHub.openConversation")}
                                onClick={openComposerTarget}
                            >
                                <ArrowRight className="size-4" />
                            </button>
                        </div>
                    </div>
                </motion.section>

                <section id="agent-skill-library" className="scroll-mt-5 border-t pt-6" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-5" role="tablist" aria-label={t("agentHub.libraryLabel")}>
                            {collectionItems.map((item) => {
                                const active = collection === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        className="relative h-9 text-[15px] font-medium transition"
                                        style={{ color: active ? theme.node.text : theme.node.muted }}
                                        onClick={() => setCollection(item.key)}
                                    >
                                        <span className={active ? "font-semibold" : ""}>{item.label}</span>
                                        <span className="ml-1.5 text-[11px] tabular-nums opacity-45">{item.count}</span>
                                        {active ? <span className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full" style={{ background: theme.node.text }} /> : null}
                                    </button>
                                );
                            })}
                        </div>
                        <Input
                            allowClear
                            variant="borderless"
                            prefix={<Search className="size-3.5 opacity-45" />}
                            placeholder={t("agentHub.searchPlaceholder")}
                            className="!h-9 !w-full !rounded-lg !border !px-3 xl:!w-[280px]"
                            style={{ borderColor: theme.node.stroke, background: theme.node.panel, color: theme.node.text }}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {categoryOptions.map((item) => {
                            const active = category === item.value;
                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] transition"
                                    style={{
                                        background: active ? theme.toolbar.activeBg : "transparent",
                                        borderColor: active ? theme.node.stroke : "transparent",
                                        color: active ? theme.node.text : theme.node.muted,
                                    }}
                                    onClick={() => setCategory(item.value)}
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: theme.node.faint }}>
                                {t("agentHub.source")}
                            </span>
                            {scopeOptions.map((item) => {
                                const active = scope === item.value;
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] transition"
                                        style={{
                                            background: active ? theme.toolbar.activeBg : "transparent",
                                            borderColor: active ? theme.node.stroke : "transparent",
                                            color: active ? theme.node.text : theme.node.muted,
                                        }}
                                        onClick={() => setScope(item.value)}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] transition"
                                style={{ borderColor: enabledOnly ? theme.node.stroke : "transparent", background: enabledOnly ? theme.toolbar.activeBg : "transparent", color: enabledOnly ? theme.node.text : theme.node.muted }}
                                onClick={() => setEnabledOnly((value) => !value)}
                            >
                                {enabledOnly ? <Check className="size-3.5" /> : <MousePointerClick className="size-3.5" />}
                                {t("agentHub.enabledOnly")}
                            </button>
                            <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] transition hover:bg-white/5 disabled:opacity-40"
                                style={{ color: theme.node.muted }}
                                disabled={!connected || loading}
                                onClick={() => void loadSkills(endpoint, token, true)}
                            >
                                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                                {t("agentHub.refresh")}
                            </button>
                        </div>
                    </div>

                    {errors.length ? (
                        <details className="mt-4 rounded-xl border px-3.5 py-3 text-xs" style={{ borderColor: theme.node.stroke, background: theme.node.panel }}>
                            <summary className="cursor-pointer font-medium">{t("agentHub.errors", { count: errors.length })}</summary>
                            <div className="thin-scrollbar mt-2 max-h-32 space-y-1 overflow-y-auto pr-2 font-mono text-[11px] leading-5" style={{ color: theme.node.muted }}>
                                {errors.map((error, index) => <div key={`${index}:${error}`}>{error}</div>)}
                            </div>
                        </details>
                    ) : null}

                    <div className="mt-5">
                        {!connected ? (
                            <ConnectionGate
                                connecting={enabled}
                                error={connectError}
                                onOpenAgent={() => openAgent("setup")}
                                onReconnect={reconnectAgentWithDiscovery}
                                theme={theme}
                            />
                        ) : loading && !loaded ? (
                            <div className="flex min-h-52 items-center justify-center gap-2 text-sm" style={{ color: theme.node.muted }}>
                                <LoaderCircle className="size-4 animate-spin" />
                                {t("agentHub.loading")}
                            </div>
                        ) : visibleSkills.length ? (
                            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                                {visibleSkills.map((skill, index) => (
                                    <SkillCard
                                        key={agentSkillKey(skill)}
                                        skill={skill}
                                        provider={provider}
                                        theme={theme}
                                        index={index}
                                        selected={selectedKeys.has(agentSkillKey(skill))}
                                        favorite={favoriteKeys.includes(agentSkillKey(skill))}
                                        favoriteReady={favoritesLoaded}
                                        onOpen={() => setSelectedSkill(skill)}
                                        onSelect={() => selectSkill(skill)}
                                        onToggleFavorite={() => toggleFavorite(skill)}
                                        onUse={() => useSkill(skill)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <LibraryEmpty
                                collection={collection}
                                collectionEmpty={collectionEmpty}
                                filtered={hasFilter}
                                onReset={resetFilters}
                                onBrowseAll={browseAllSkills}
                                theme={theme}
                            />
                        )}
                    </div>
                </section>
            </div>

            {selectedSkill ? (
                <SkillDetailsDialog
                    skill={selectedSkill}
                    provider={provider}
                    theme={theme}
                    connected={connected}
                    endpoint={endpoint}
                    token={token}
                    selected={selectedKeys.has(agentSkillKey(selectedSkill))}
                    favorite={favoriteKeys.includes(agentSkillKey(selectedSkill))}
                    onFavorite={() => toggleFavorite(selectedSkill)}
                    onUse={() => {
                        useSkill(selectedSkill);
                        setSelectedSkill(null);
                    }}
                    onClose={() => setSelectedSkill(null)}
                />
            ) : null}
            {modelPickerOpen ? (
                <ModelPickerDialog
                    theme={theme}
                    models={models}
                    model={model}
                    provider={provider}
                    connected={connected}
                    onSelect={(nextModel) => {
                        changeModel(nextModel);
                        setModelPickerOpen(false);
                    }}
                    onOpenAgent={() => {
                        setModelPickerOpen(false);
                        openAgent(connected ? "chat" : "setup");
                    }}
                    onClose={() => setModelPickerOpen(false)}
                />
            ) : null}
            {modePickerOpen ? (
                <GenerationModeDialog
                    theme={theme}
                    manual={confirmTools}
                    onSelect={(manual) => {
                        setAgentState({ confirmTools: manual });
                        setModePickerOpen(false);
                    }}
                    onClose={() => setModePickerOpen(false)}
                />
            ) : null}
        </main>
    );
}

function ComposerButton({ theme, icon, label, onClick }: { theme: CanvasTheme; icon: ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition hover:bg-white/5"
            style={{ color: theme.node.muted }}
            onClick={onClick}
        >
            {icon}
            <span className="max-w-40 truncate">{label}</span>
        </button>
    );
}

function SkillCard({
    skill,
    provider,
    theme,
    index,
    selected,
    favorite,
    favoriteReady,
    onOpen,
    onSelect,
    onToggleFavorite,
    onUse,
}: {
    skill: AgentSkillSummary;
    provider: "codex" | "claude";
    theme: CanvasTheme;
    index: number;
    selected: boolean;
    favorite: boolean;
    favoriteReady: boolean;
    onOpen: () => void;
    onSelect: () => void;
    onToggleFavorite: () => void;
    onUse: () => void;
}) {
    const { t } = useTranslation();
    const Icon = skillIcon(skill);
    const accent = skillAccent(skill);
    const description = agentSkillDescription(skill);

    return (
        <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.025, 0.18), duration: 0.28 }}
            role="button"
            tabIndex={0}
            className="group flex min-h-[132px] cursor-pointer gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5"
            style={{
                borderColor: selected ? accent : theme.node.stroke,
                background: theme.node.panel,
                color: theme.node.text,
                boxShadow: selected ? `0 0 0 1px ${accent}55` : undefined,
            }}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen();
                }
            }}
        >
            <div
                className="relative hidden w-[112px] shrink-0 overflow-hidden rounded-xl border sm:block"
                style={{
                    borderColor: theme.node.stroke,
                    background: `radial-gradient(circle at 70% 18%, ${accent}66, transparent 36%), linear-gradient(145deg, color-mix(in srgb, ${accent} 36%, ${theme.node.fill}), ${theme.node.fill})`,
                }}
            >
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
                <span className="absolute left-2.5 top-2.5 rounded bg-black/35 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur">SKILL</span>
                <span className="absolute bottom-2.5 left-2.5 grid size-9 place-items-center rounded-xl border border-white/20 bg-black/25 text-white backdrop-blur">
                    <Icon className="size-4" />
                </span>
                <span className="absolute bottom-3 right-2 max-w-[66px] truncate font-mono text-[9px] text-white/60" title={skill.path}>
                    {shortSkillPath(skill.path)}
                </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-start gap-2">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
                        <h3 className="truncate text-[14px] font-semibold leading-5">{agentSkillDisplayName(skill)}</h3>
                        <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4" style={{ color: theme.node.muted }}>
                            {description || t("agentHub.noDescription")}
                        </p>
                    </button>
                    <button
                        type="button"
                        className="grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-white/5 disabled:opacity-40"
                        style={{ color: favorite ? "#f59e0b" : theme.node.faint }}
                        disabled={!favoriteReady}
                        aria-label={t(favorite ? "agentHub.unfavorite" : "agentHub.favorite")}
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleFavorite();
                        }}
                    >
                        <Star className={`size-4 ${favorite ? "fill-current" : ""}`} />
                    </button>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px]" style={{ color: theme.node.muted }}>
                            <span className="min-w-0 truncate font-mono">{agentSkillMarker(skill, provider)}</span>
                            <span className="size-0.5 rounded-full bg-current opacity-40" />
                            <span className="shrink-0">{t(`agent.skillManager.scopes.${skill.scope}`)}</span>
                            {skill.enabled ? <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" title={t("agent.skillManager.enabled")} /> : null}
                        </div>
                        {selected ? (
                            <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: accent }}>
                                <CheckCircle2 className="size-3" />
                                {t("agentHub.selected")}
                            </div>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            className="hidden h-7 items-center rounded-lg px-2 text-[10px] transition hover:bg-white/5 sm:inline-flex"
                            style={{ color: theme.node.muted }}
                            onClick={(event) => {
                                event.stopPropagation();
                                onSelect();
                            }}
                        >
                            {t(selected ? "agentHub.remove" : "agentHub.select")}
                        </button>
                        <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[10px] font-semibold transition disabled:opacity-40"
                            style={{ background: accent, color: "#ffffff" }}
                            disabled={!skill.enabled}
                            onClick={(event) => {
                                event.stopPropagation();
                                onUse();
                            }}
                        >
                            {t("agentHub.use")}
                            <ChevronRight className="size-3" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.article>
    );
}

function ConnectionGate({
    connecting,
    error,
    onOpenAgent,
    onReconnect,
    theme,
}: {
    connecting: boolean;
    error: string;
    onOpenAgent: () => void;
    onReconnect: () => void;
    theme: CanvasTheme;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed px-5 text-center" style={{ borderColor: theme.node.stroke }}>
            <span className="grid size-12 place-items-center rounded-2xl border" style={{ borderColor: theme.node.stroke, background: theme.node.panel, color: theme.node.muted }}>
                {connecting ? <LoaderCircle className="size-5 animate-spin" /> : <Bot className="size-5" />}
            </span>
            <h2 className="mt-4 text-base font-semibold">{t(connecting ? "agentHub.connectingTitle" : "agentHub.connectTitle")}</h2>
            <p className="mt-2 max-w-xl text-xs leading-5" style={{ color: theme.node.muted }}>{error || t(connecting ? "agentHub.connectingDescription" : "agentHub.connectDescription")}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button type="button" className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-semibold" style={{ background: theme.node.text, color: theme.node.panel }} onClick={onOpenAgent}>
                    {t("agentHub.openSetup")}
                    <ArrowRight className="size-3.5" />
                </button>
                {error && !connecting ? (
                    <button type="button" className="inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-xs font-medium" style={{ borderColor: theme.node.stroke }} onClick={onReconnect}>
                        <RefreshCw className="size-3.5" />
                        {t("agentHub.reconnect")}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function LibraryEmpty({
    collection,
    collectionEmpty,
    filtered,
    onReset,
    onBrowseAll,
    theme,
}: {
    collection: AgentSkillCollection;
    collectionEmpty: boolean;
    filtered: boolean;
    onReset: () => void;
    onBrowseAll: () => void;
    theme: CanvasTheme;
}) {
    const { t } = useTranslation();
    const noMatch = filtered && !collectionEmpty;
    const title = noMatch ? "agentHub.emptyNoMatch" : collection === "favorites" ? "agentHub.emptyFavorites" : collection === "mine" ? "agentHub.emptyMine" : "agentHub.emptyTitle";
    return (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center" style={{ borderColor: theme.node.stroke }}>
            <span className="grid size-10 place-items-center rounded-xl" style={{ background: theme.node.panel, color: theme.node.muted }}>
                <Sparkles className="size-4" />
            </span>
            <div className="mt-3 text-sm font-medium">{t(title)}</div>
            <div className="mt-1 max-w-md text-xs leading-5" style={{ color: theme.node.muted }}>{t(noMatch ? "agentHub.emptyNoMatchHint" : "agentHub.emptyHint")}</div>
            {collectionEmpty && collection !== "all" ? (
                <button type="button" className="mt-4 h-8 rounded-lg border px-3 text-xs" style={{ borderColor: theme.node.stroke }} onClick={onBrowseAll}>{t("agentHub.browseAll")}</button>
            ) : noMatch ? (
                <button type="button" className="mt-4 h-8 rounded-lg border px-3 text-xs" style={{ borderColor: theme.node.stroke }} onClick={onReset}>{t("agentHub.resetFilter")}</button>
            ) : null}
        </div>
    );
}

function SkillDetailsDialog({
    skill,
    provider,
    theme,
    connected,
    endpoint,
    token,
    selected,
    favorite,
    onFavorite,
    onUse,
    onClose,
}: {
    skill: AgentSkillSummary;
    provider: "codex" | "claude";
    theme: CanvasTheme;
    connected: boolean;
    endpoint: string;
    token: string;
    selected: boolean;
    favorite: boolean;
    onFavorite: () => void;
    onUse: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const [detail, setDetail] = useState<AgentSkillDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState("");
    const Icon = skillIcon(skill);
    const accent = skillAccent(skill);

    useEffect(() => {
        setDetail(null);
        setDetailError("");
        if (!connected || provider !== "codex" || !skill.managed) return;
        let cancelled = false;
        setDetailLoading(true);
        void fetchCodexSkill(endpoint, token, skill.name)
            .then((response) => {
                if (!cancelled) setDetail(response.data || null);
            })
            .catch((error: unknown) => {
                if (!cancelled) setDetailError(error instanceof Error ? error.message : String(error));
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [connected, endpoint, provider, skill.managed, skill.name, token]);

    return (
        <DialogFrame
            theme={theme}
            width="max-w-[860px]"
            title={agentSkillDisplayName(skill)}
            subtitle={agentSkillDescription(skill)}
            icon={<span className="grid size-11 place-items-center rounded-2xl" style={{ background: `${accent}22`, color: accent }}><Icon className="size-5" /></span>}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs" style={{ borderColor: theme.node.stroke, color: favorite ? "#f59e0b" : theme.node.muted }} onClick={onFavorite}>
                        <Star className={`size-3.5 ${favorite ? "fill-current" : ""}`} />
                        {t(favorite ? "agentHub.unfavorite" : "agentHub.favorite")}
                    </button>
                    <button type="button" className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-semibold disabled:opacity-40" style={{ background: accent, color: "#ffffff" }} disabled={!skill.enabled} onClick={onUse}>
                        {t(selected ? "agentHub.openConversation" : "agentHub.use")}
                        <ArrowRight className="size-3.5" />
                    </button>
                </>
            }
        >
            <div className="p-5 pb-0">
                <div
                    className="relative aspect-[16/6] min-h-36 overflow-hidden rounded-xl border"
                    style={{
                        borderColor: theme.node.stroke,
                        background: `radial-gradient(circle at 78% 18%, ${accent}66, transparent 34%), linear-gradient(135deg, color-mix(in srgb, ${accent} 32%, ${theme.node.fill}), ${theme.node.fill})`,
                    }}
                >
                    <div
                        className="absolute inset-0 opacity-25"
                        style={{
                            backgroundImage: "linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
                            backgroundSize: "22px 22px",
                        }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="grid size-16 place-items-center rounded-2xl border border-white/20 bg-black/20 text-white backdrop-blur">
                            <Icon className="size-7" />
                        </span>
                    </div>
                    <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3 text-white">
                        <div className="min-w-0">
                            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/65">LOCAL SKILL</div>
                            <div className="mt-1 truncate text-lg font-semibold">{agentSkillDisplayName(skill)}</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur">
                            {provider === "codex" ? "Codex" : "Claude"}
                        </span>
                    </div>
                </div>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="min-w-0">
                    <DetailLabel theme={theme}>{t("agentHub.detailDescription")}</DetailLabel>
                    <p className="mt-2 text-sm leading-6" style={{ color: theme.node.muted }}>{skill.description || agentSkillDescription(skill) || t("agentHub.noDescription")}</p>

                    <DetailLabel theme={theme} className="mt-6">{t("agentHub.howToUse")}</DetailLabel>
                    {detailLoading ? (
                        <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: theme.node.muted }}><LoaderCircle className="size-3.5 animate-spin" />{t("agentHub.detailLoading")}</div>
                    ) : detail?.instructions ? (
                        <pre className="thin-scrollbar mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border p-3 font-mono text-[11px] leading-5" style={{ borderColor: theme.node.stroke, background: theme.canvas.background, color: theme.node.muted }}>{detail.instructions}</pre>
                    ) : (
                        <p className="mt-2 text-xs leading-5" style={{ color: theme.node.muted }}>{detailError || t("agentHub.detailHint")}</p>
                    )}
                </div>
                <aside className="space-y-2">
                    <InfoRow theme={theme} label={t("agentHub.source")} value={t(`agent.skillManager.scopes.${skill.scope}`)} />
                    <InfoRow theme={theme} label={t("agentHub.provider")} value={provider === "codex" ? "Codex" : "Claude"} />
                    <InfoRow theme={theme} label={t("agentHub.path")} value={skill.path} mono />
                    <InfoRow theme={theme} label={t("agentHub.status")} value={t(skill.enabled ? "agent.skillManager.enabled" : "agent.skillManager.disabled")} />
                </aside>
            </div>
        </DialogFrame>
    );
}

function ModelPickerDialog({
    theme,
    models,
    model,
    provider,
    connected,
    onSelect,
    onOpenAgent,
    onClose,
}: {
    theme: CanvasTheme;
    models: AgentModel[];
    model: string;
    provider: "codex" | "claude";
    connected: boolean;
    onSelect: (model: string) => void;
    onOpenAgent: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    return (
        <DialogFrame
            theme={theme}
            width="max-w-[560px]"
            title={t("agentHub.modelTitle")}
            subtitle={t("agentHub.modelDescription")}
            icon={<span className="grid size-11 place-items-center rounded-2xl" style={{ background: `${theme.node.text}10`, color: theme.node.text }}><Cpu className="size-5" /></span>}
            onClose={onClose}
        >
            <div className="p-4">
                <div className="mb-3 inline-flex rounded-lg border p-0.5" style={{ borderColor: theme.node.stroke, background: theme.canvas.background }}>
                    <span className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: theme.toolbar.activeBg, color: theme.node.text }}>{provider === "codex" ? "Codex" : "Claude"}</span>
                </div>
                {models.length ? (
                    <div className="space-y-1.5">
                        {models.map((item) => {
                            const active = item.model === (model || models[0]?.model);
                            return (
                                <button
                                    key={item.model}
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-white/5"
                                    style={{ borderColor: active ? theme.node.text : theme.node.stroke, background: active ? theme.toolbar.activeBg : "transparent" }}
                                    onClick={() => onSelect(item.model)}
                                >
                                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border" style={{ borderColor: theme.node.stroke }}><Bot className="size-4" /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium">{item.displayName || item.model}</span>
                                        <span className="mt-0.5 block truncate text-[11px]" style={{ color: theme.node.muted }}>{item.description || item.model}</span>
                                    </span>
                                    {active ? <CheckCircle2 className="size-4 shrink-0" /> : null}
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center" style={{ borderColor: theme.node.stroke }}>
                        <Cpu className="mx-auto size-5" style={{ color: theme.node.muted }} />
                        <div className="mt-3 text-sm font-medium">{t("agentHub.noModels")}</div>
                        <p className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>{t("agentHub.noModelsHint")}</p>
                        {!connected ? <button type="button" className="mt-4 h-8 rounded-lg px-3 text-xs font-medium" style={{ background: theme.node.text, color: theme.node.panel }} onClick={onOpenAgent}>{t("agentHub.openSetup")}</button> : null}
                    </div>
                )}
            </div>
        </DialogFrame>
    );
}

function GenerationModeDialog({ theme, manual, onSelect, onClose }: { theme: CanvasTheme; manual: boolean; onSelect: (manual: boolean) => void; onClose: () => void }) {
    const { t } = useTranslation();
    return (
        <DialogFrame
            theme={theme}
            width="max-w-[520px]"
            title={t("agentHub.modeTitle")}
            subtitle={t("agentHub.modeDescription")}
            icon={<span className="grid size-11 place-items-center rounded-2xl" style={{ background: `${theme.node.text}10`, color: theme.node.text }}><Zap className="size-5" /></span>}
            onClose={onClose}
        >
            <div className="space-y-2 p-4">
                <ModeOption
                    theme={theme}
                    active={manual}
                    icon={<Hand className="size-4" />}
                    title={t("agentHub.manualMode")}
                    description={t("agentHub.manualModeDescription")}
                    onClick={() => onSelect(true)}
                />
                <ModeOption
                    theme={theme}
                    active={!manual}
                    icon={<Zap className="size-4" />}
                    title={t("agentHub.automaticMode")}
                    description={t("agentHub.automaticModeDescription")}
                    onClick={() => onSelect(false)}
                />
            </div>
        </DialogFrame>
    );
}

function ModeOption({ theme, active, icon, title, description, onClick }: { theme: CanvasTheme; active: boolean; icon: ReactNode; title: string; description: string; onClick: () => void }) {
    return (
        <button
            type="button"
            className="flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition hover:bg-white/5"
            style={{ borderColor: active ? theme.node.text : theme.node.stroke }}
            onClick={onClick}
        >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border" style={{ borderColor: theme.node.stroke }}>{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-xs leading-5" style={{ color: theme.node.muted }}>{description}</span>
            </span>
            {active ? <Check className="mt-1 size-4 shrink-0" /> : null}
        </button>
    );
}

function DialogFrame({
    theme,
    width,
    title,
    subtitle,
    icon,
    children,
    footer,
    onClose,
}: {
    theme: CanvasTheme;
    width: string;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4" role="presentation" onMouseDown={onClose}>
            <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={`relative flex max-h-[86vh] w-full ${width} flex-col overflow-hidden rounded-2xl border shadow-2xl`}
                style={{ background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="flex items-start gap-3 border-b px-5 py-4" style={{ borderColor: theme.node.stroke }}>
                    {icon}
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-semibold tracking-[-0.02em]">{title}</h2>
                        {subtitle ? <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: theme.node.muted }}>{subtitle}</p> : null}
                    </div>
                    <button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-white/5" style={{ color: theme.node.muted }} aria-label="Close" onClick={onClose}>
                        <X className="size-4" />
                    </button>
                </header>
                <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
                {footer ? <footer className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: theme.node.stroke }}>{footer}</footer> : null}
            </motion.div>
        </div>
    );
}

function DetailLabel({ theme, children, className = "" }: { theme: CanvasTheme; children: ReactNode; className?: string }) {
    return <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${className}`} style={{ color: theme.node.faint }}>{children}</div>;
}

function InfoRow({ theme, label, value, mono = false }: { theme: CanvasTheme; label: string; value: string; mono?: boolean }) {
    return (
        <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: theme.node.stroke, background: theme.canvas.background }}>
            <div className="text-[10px]" style={{ color: theme.node.faint }}>{label}</div>
            <div className={`mt-1 break-words text-xs ${mono ? "font-mono" : ""}`} style={{ color: theme.node.text }}>{value}</div>
        </div>
    );
}

function shortSkillPath(path: string) {
    const parts = path.split("/").filter(Boolean);
    return parts.at(-2) || parts.at(-1) || path;
}

const agentCategoryPatterns: Record<Exclude<AgentCategory, "recommended" | "general" | "discover">, RegExp> = {
    film: /film|video|storyboard|shot|camera|director|cinema|影视|电影|分镜|镜头|导演|视频/i,
    commercial: /commercial|marketing|product|brand|advert|image|design|商业|广告|营销|产品|电商|图片|海报/i,
    drama: /drama|comic|script|story|storyboard|shot|短剧|漫剧|漫画|剧本|分镜/i,
    anime: /anime|manga|game|character|illustration|动漫|动画|游戏|角色|插画/i,
    music: /music|audio|voice|song|mv|音乐|音频|配音|歌曲/i,
    creator: /browser|social|creator|notion|docs|writing|publish|自媒体|浏览器|写作|发布|文档|办公/i,
};

function matchesAgentCategory(skill: AgentSkillSummary, category: AgentCategory) {
    if (category === "recommended" || category === "general" || category === "discover") return true;
    const text = [
        skill.name,
        skill.shortDescription,
        skill.interface?.displayName,
        skill.interface?.shortDescription,
        skill.path,
    ]
        .filter(Boolean)
        .join(" ");
    return agentCategoryPatterns[category].test(text);
}

function skillAccent(skill: Pick<AgentSkillSummary, "path" | "scope">) {
    const palette = ["#f59e0b", "#38bdf8", "#34d399", "#fb7185", "#84cc16", "#f97316"];
    const source = `${skill.scope}:${skill.path}`;
    let hash = 0;
    for (let index = 0; index < source.length; index++) hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    return palette[hash % palette.length];
}

function skillIcon(skill: Pick<AgentSkillSummary, "path" | "scope">) {
    const value = `${skill.path} ${skill.scope}`.toLowerCase();
    if (value.includes("storyboard") || value.includes("shot") || value.includes("video")) return Clapperboard;
    if (value.includes("browser")) return MousePointerClick;
    if (value.includes("doc") || value.includes("pdf")) return FileText;
    if (value.includes("image") || value.includes("design")) return ImagePlus;
    if (value.includes("repo") || value.includes("git")) return FolderGit2;
    return Sparkles;
}
