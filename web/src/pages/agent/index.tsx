import { useEffect, useMemo, useState, type ReactNode } from "react";
import { App, Button, Input, Switch, Tooltip } from "antd";
import { ArrowRight, Bot, CheckCircle2, FolderGit2, LoaderCircle, MonitorCog, RefreshCw, Search, ShieldCheck, Sparkles, Star, UserRound, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { withShellFeatureFlags } from "@/components/layout/navigation-groups";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { useAgentSkillFavorites } from "@/hooks/use-agent-skill-favorites";
import { useCopyText } from "@/hooks/use-copy-text";
import { agentSkillDescription, agentSkillDisplayName, agentSkillKey, filterAgentSkills, type AgentSkillCollection, type AgentSkillScopeFilter } from "@/lib/agent/agent-skill-catalog";
import { AGENT_PLUGIN_INSTALL_COMMAND } from "@/lib/agent/plugin-commands";
import type { AgentSkillScope, AgentSkillSummary } from "@/services/api/canvas-agent";
import { useAgentSkillFavoriteStore } from "@/stores/use-agent-skill-favorite-store";
import { useAgentSkillStore } from "@/stores/use-agent-skill-store";
import { useAgentStore } from "@/stores/use-agent-store";

const scopeFilters: AgentSkillScope[] = ["repo", "user", "system", "admin"];

export default function AgentPage() {
    const { search } = useLocation();
    if (!isFeatureEnabled("agentSkillHub")) return <Navigate to={withShellFeatureFlags("/", search)} replace />;
    return <AgentSkillHubPage />;
}

function AgentSkillHubPage() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const { search } = useLocation();
    const copyText = useCopyText();
    const favoritesLoaded = useAgentSkillFavorites();
    const connected = useAgentStore((state) => state.connected);
    const enabled = useAgentStore((state) => state.enabled);
    const endpoint = useAgentStore((state) => state.url.trim().replace(/\/$/, ""));
    const token = useAgentStore((state) => state.token);
    const connectError = useAgentStore((state) => state.connectError);
    const skills = useAgentSkillStore((state) => state.skills);
    const selectedSkill = useAgentSkillStore((state) => state.selectedSkill);
    const loading = useAgentSkillStore((state) => state.loading);
    const loaded = useAgentSkillStore((state) => state.loaded);
    const errors = useAgentSkillStore((state) => state.errors);
    const loadSkills = useAgentSkillStore((state) => state.loadSkills);
    const favoriteKeys = useAgentSkillFavoriteStore((state) => state.keys);
    const toggleFavorite = useAgentSkillFavoriteStore((state) => state.toggleFavorite);
    const [query, setQuery] = useState("");
    const [collection, setCollection] = useState<AgentSkillCollection>("all");
    const [scope, setScope] = useState<AgentSkillScopeFilter>("all");
    const [enabledOnly, setEnabledOnly] = useState(false);

    useEffect(() => {
        if (connected && !loaded && !loading) void loadSkills(endpoint, token);
    }, [connected, endpoint, loadSkills, loaded, loading, token]);

    const availableSkills = connected ? skills : [];
    const visibleSkills = useMemo(() => filterAgentSkills({ skills: availableSkills, query, scope, collection, enabledOnly, favoriteKeys }), [availableSkills, collection, enabledOnly, favoriteKeys, query, scope]);
    const enabledCount = availableSkills.filter((skill) => skill.enabled).length;
    const managedCount = availableSkills.filter((skill) => skill.managed).length;
    const favoriteCount = availableSkills.filter((skill) => favoriteKeys.includes(agentSkillKey(skill))).length;
    const hasFilter = Boolean(query.trim()) || scope !== "all" || enabledOnly;
    const collectionEmpty = !filterAgentSkills({ skills: availableSkills, query: "", scope: "all", collection, enabledOnly: false, favoriteKeys }).length;
    const pluginHubEnabled = isFeatureEnabled("pluginHub");

    const openAgent = () => {
        useAgentStore.getState().setAgentState({ activeTab: connected ? "chat" : "setup" });
        useAgentStore.getState().openPanel();
    };
    const openPlugins = () => {
        if (pluginHubEnabled) navigate(withShellFeatureFlags("/plugins", search));
        else copyText(AGENT_PLUGIN_INSTALL_COMMAND, t("agentHub.installCopied"));
    };
    const useSkill = (skill: AgentSkillSummary) => {
        const current = useAgentSkillStore.getState().skills.find((item) => agentSkillKey(item) === agentSkillKey(skill));
        if (!current?.enabled) {
            message.warning(t("agentHub.skillUnavailable"));
            return;
        }
        useAgentSkillStore.getState().selectSkill(current);
        useAgentStore.getState().setAgentState({ activeTab: "chat" });
        useAgentStore.getState().openPanel();
    };
    const resetFilters = () => {
        setQuery("");
        setScope("all");
        setEnabledOnly(false);
    };
    const browseAllSkills = () => {
        setCollection("all");
        resetFilters();
    };

    const collectionItems: Array<{ key: AgentSkillCollection; label: string; count: number; icon: ReactNode }> = [
        { key: "all", label: t("agentHub.tabs.all"), count: availableSkills.length, icon: <Sparkles className="size-3.5" /> },
        { key: "favorites", label: t("agentHub.tabs.favorites"), count: favoriteCount, icon: <Star className="size-3.5" /> },
        { key: "mine", label: t("agentHub.tabs.mine"), count: managedCount, icon: <UserRound className="size-3.5" /> },
    ];

    return (
        <main className="h-full overflow-y-auto bg-[radial-gradient(circle_at_4%_0%,rgba(245,158,11,.1),transparent_28%),radial-gradient(circle_at_94%_12%,rgba(20,184,166,.09),transparent_30%),linear-gradient(180deg,rgba(250,250,249,.65),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_4%_0%,rgba(245,158,11,.08),transparent_28%),radial-gradient(circle_at_94%_12%,rgba(20,184,166,.08),transparent_30%)]">
            <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
                <section className="relative overflow-hidden rounded-[30px] border border-stone-200/80 bg-white/75 shadow-[0_28px_90px_-54px_rgba(28,25,23,.6)] dark:border-stone-800/80 dark:bg-stone-950/70">
                    <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-amber-400/10 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-36 left-1/4 size-80 rounded-full bg-teal-400/10 blur-3xl" />
                    <div className="relative grid gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_310px] lg:px-10 lg:py-10">
                        <div className="min-w-0">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-[11px] font-medium text-stone-500 dark:border-stone-700 dark:text-stone-400">
                                <WandSparkles className="size-3.5 text-amber-500" />
                                {t("agentHub.eyebrow")}
                            </div>
                            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.045em] text-stone-950 sm:text-4xl dark:text-stone-100">{t("agentHub.title")}</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500 dark:text-stone-400">{t("agentHub.description")}</p>

                            <div className="mt-6 rounded-2xl border border-stone-200/90 bg-white p-2 shadow-[0_14px_40px_-30px_rgba(28,25,23,.55)] dark:border-stone-800 dark:bg-stone-900">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Input
                                        size="large"
                                        variant="borderless"
                                        aria-label={t("agentHub.searchPlaceholder")}
                                        className="!h-11 min-w-0 flex-1 !px-3 !text-base"
                                        prefix={<Search className="mr-1 size-4 text-stone-400" />}
                                        placeholder={t("agentHub.searchPlaceholder")}
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        allowClear
                                    />
                                    <Button type="primary" size="large" className="!h-11 !shrink-0 !rounded-xl !px-5" icon={<Bot className="size-4" />} onClick={openAgent}>
                                        {connected ? t("agentHub.openChat") : t("agentHub.connectAgent")}
                                    </Button>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-1.5 pt-1 text-[11px] text-stone-400 dark:text-stone-500">
                                    <span>{t("agentHub.searchHint")}</span>
                                    <span>{t("agentHub.resultCount", { count: visibleSkills.length })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid content-start gap-3">
                            <div className="rounded-2xl border border-stone-200/90 bg-stone-50/80 p-4 dark:border-stone-800 dark:bg-stone-900/55">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">{t("agentHub.agentStatus")}</span>
                                    <span className={`size-2 rounded-full ${connected ? "bg-teal-500" : enabled ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600"}`} />
                                </div>
                                <div className="mt-3 flex items-start gap-3">
                                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${connected ? "bg-teal-500/10 text-teal-700 dark:text-teal-400" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"}`}>
                                        {connected ? <CheckCircle2 className="size-5" /> : enabled ? <LoaderCircle className="size-5 animate-spin" /> : <Bot className="size-5" />}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t(connected ? "agentHub.connected" : enabled ? "agentHub.connecting" : "agentHub.disconnected")}</div>
                                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{connectError || t(connected ? "agentHub.connectedHint" : "agentHub.disconnectedHint")}</div>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    <Metric label={t("agentHub.metrics.skills")} value={availableSkills.length} />
                                    <Metric label={t("agentHub.metrics.enabled")} value={enabledCount} />
                                    <Metric label={t("agentHub.metrics.favorites")} value={favoriteCount} />
                                </div>
                                <Button className="mt-3 !h-9 !rounded-xl" block icon={connected ? <ArrowRight className="size-3.5" /> : <Bot className="size-3.5" />} onClick={openAgent}>
                                    {connected ? t("agentHub.openChat") : t("agentHub.openSetup")}
                                </Button>
                            </div>
                            <button
                                type="button"
                                className="flex items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white/55 px-3.5 py-3 text-left transition hover:border-stone-400 hover:bg-white dark:border-stone-700 dark:bg-stone-950/40 dark:hover:border-stone-600 dark:hover:bg-stone-900/60"
                                onClick={openPlugins}
                            >
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                                    <ShieldCheck className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-medium text-stone-900 dark:text-stone-100">{t(pluginHubEnabled ? "agentHub.pluginHub" : "agentHub.installPlugin")}</span>
                                    <span className="mt-0.5 block text-[11px] leading-4 text-stone-500 dark:text-stone-400">{t(pluginHubEnabled ? "agentHub.pluginHubHint" : "agentHub.installPluginHint")}</span>
                                </span>
                                <ArrowRight className="size-3.5 shrink-0 text-stone-400" />
                            </button>
                        </div>
                    </div>
                </section>

                <section className="mt-6 rounded-[24px] border border-stone-200/80 bg-white/65 p-4 sm:p-5 dark:border-stone-800/80 dark:bg-stone-950/45">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="tablist" aria-label={t("agentHub.libraryLabel")}>
                            {collectionItems.map((item) => {
                                const active = collection === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium transition ${active ? "bg-stone-950 !text-white shadow-sm dark:bg-stone-100 dark:!text-stone-950" : "!text-stone-500 hover:bg-stone-100 hover:!text-stone-950 dark:!text-stone-400 dark:hover:bg-white/[0.06] dark:hover:!text-stone-100"}`}
                                        onClick={() => setCollection(item.key)}
                                    >
                                        {item.icon}
                                        {item.label}
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/15 text-white dark:bg-stone-950/10 dark:text-stone-700" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"}`}>
                                            {item.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                className={`h-8 rounded-lg px-2.5 text-[11px] font-medium transition ${scope === "all" ? "bg-stone-200/80 !text-stone-950 dark:bg-stone-800 dark:!text-stone-100" : "!text-stone-500 hover:bg-stone-100 dark:!text-stone-400 dark:hover:bg-white/[0.06]"}`}
                                onClick={() => setScope("all")}
                            >
                                {t("agent.skillManager.scopes.all")}
                            </button>
                            {scopeFilters.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    className={`h-8 rounded-lg px-2.5 text-[11px] font-medium transition ${scope === item ? "bg-stone-200/80 !text-stone-950 dark:bg-stone-800 dark:!text-stone-100" : "!text-stone-500 hover:bg-stone-100 dark:!text-stone-400 dark:hover:bg-white/[0.06]"}`}
                                    onClick={() => setScope(item)}
                                >
                                    {t(`agent.skillManager.scopes.${item}`)}
                                </button>
                            ))}
                            <span className="mx-1 hidden h-4 w-px bg-stone-200 sm:block dark:bg-stone-800" />
                            <label className="inline-flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                                <Switch size="small" checked={enabledOnly} onChange={setEnabledOnly} />
                                {t("agentHub.enabledOnly")}
                            </label>
                            <Button type="text" size="small" className="!h-8 !px-2" disabled={!connected || loading} icon={<RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />} onClick={() => void loadSkills(endpoint, token, true)}>
                                {t("agentHub.refresh")}
                            </Button>
                        </div>
                    </div>

                    {errors.length ? (
                        <details className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                            <summary className="cursor-pointer font-medium">{t("agentHub.errors", { count: errors.length })}</summary>
                            <div className="thin-scrollbar mt-2 max-h-32 space-y-1 overflow-y-auto pr-2 font-mono text-[11px] leading-5">
                                {errors.map((error, index) => (
                                    <div key={`${index}:${error}`}>{error}</div>
                                ))}
                            </div>
                        </details>
                    ) : null}

                    <div className="mt-5">
                        {!connected ? (
                            <ConnectionGate connecting={enabled} error={connectError} onOpenAgent={openAgent} onOpenPlugins={openPlugins} pluginHubEnabled={pluginHubEnabled} />
                        ) : loading && !loaded ? (
                            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                                <LoaderCircle className="size-4 animate-spin" />
                                {t("agentHub.loading")}
                            </div>
                        ) : visibleSkills.length ? (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {visibleSkills.map((skill) => (
                                    <SkillCard
                                        key={agentSkillKey(skill)}
                                        skill={skill}
                                        selected={Boolean(selectedSkill && agentSkillKey(selectedSkill) === agentSkillKey(skill))}
                                        favorite={favoriteKeys.includes(agentSkillKey(skill))}
                                        favoriteReady={favoritesLoaded}
                                        onToggleFavorite={() => toggleFavorite(skill)}
                                        onUse={() => useSkill(skill)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <LibraryEmpty collection={collection} collectionEmpty={collectionEmpty} filtered={hasFilter} onReset={resetFilters} onBrowseAll={browseAllSkills} />
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

function SkillCard({ skill, selected, favorite, favoriteReady, onToggleFavorite, onUse }: { skill: AgentSkillSummary; selected: boolean; favorite: boolean; favoriteReady: boolean; onToggleFavorite: () => void; onUse: () => void }) {
    const { t } = useTranslation();
    const Icon = scopeIcon(skill.scope);
    const description = agentSkillDescription(skill);
    return (
        <article
            className={`group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border bg-white/75 p-4 transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_18px_50px_-36px_rgba(28,25,23,.55)] dark:bg-stone-950/55 dark:hover:border-stone-700 ${selected ? "border-teal-300 dark:border-teal-800" : "border-stone-200/80 dark:border-stone-800"}`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_15%_0%,rgba(245,158,11,.1),transparent_55%),radial-gradient(circle_at_85%_0%,rgba(20,184,166,.08),transparent_50%)]" />
            <div className="relative flex items-start justify-between gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-stone-200/80 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
                    <Icon className="size-4.5" />
                </span>
                <Tooltip title={t(favorite ? "agentHub.unfavorite" : "agentHub.favorite")}>
                    <button
                        type="button"
                        className={`grid size-8 place-items-center rounded-lg transition ${favorite ? "!text-amber-500 hover:bg-amber-500/10" : "!text-stone-400 hover:bg-stone-100 hover:!text-stone-700 dark:hover:bg-white/[0.06] dark:hover:!text-stone-200"} disabled:cursor-not-allowed disabled:opacity-40`}
                        disabled={!favoriteReady}
                        aria-label={t(favorite ? "agentHub.unfavorite" : "agentHub.favorite")}
                        aria-pressed={favorite}
                        onClick={onToggleFavorite}
                    >
                        <Star className={`size-4 ${favorite ? "fill-current" : ""}`} />
                    </button>
                </Tooltip>
            </div>
            <div className="relative mt-4 min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{agentSkillDisplayName(skill)}</h3>
                    {selected ? <CheckCircle2 className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" /> : null}
                </div>
                <div className="mt-1 truncate font-mono text-[10px] text-stone-400 dark:text-stone-500" title={skill.path}>
                    ${skill.name}
                </div>
                <p className="mt-3 line-clamp-3 min-h-[60px] text-xs leading-5 text-stone-500 dark:text-stone-400">{description || t("agentHub.noDescription")}</p>
            </div>
            <div className="relative mt-auto flex items-end justify-between gap-3 pt-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">{t(`agent.skillManager.scopes.${skill.scope}`)}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${skill.enabled ? "bg-teal-500/10 text-teal-700 dark:text-teal-400" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"}`}>
                            <span className={`size-1 rounded-full ${skill.enabled ? "bg-teal-500" : "bg-stone-400"}`} />
                            {t(skill.enabled ? "agent.skillManager.enabled" : "agent.skillManager.disabled")}
                        </span>
                        {skill.managed ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">{t("agentHub.managed")}</span> : null}
                    </div>
                </div>
                <Button type="primary" size="small" className="!h-8 !shrink-0 !rounded-lg" disabled={!skill.enabled} icon={selected ? <CheckCircle2 className="size-3.5" /> : <ArrowRight className="size-3.5" />} onClick={onUse}>
                    {t(selected ? "agentHub.selected" : "agentHub.use")}
                </Button>
            </div>
        </article>
    );
}

function ConnectionGate({ connecting, error, onOpenAgent, onOpenPlugins, pluginHubEnabled }: { connecting: boolean; error: string; onOpenAgent: () => void; onOpenPlugins: () => void; pluginHubEnabled: boolean }) {
    const { t } = useTranslation();
    return (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-stone-50/55 px-5 py-8 text-center dark:border-stone-700 dark:bg-stone-900/35">
            <div className="pointer-events-none absolute left-1/2 top-0 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-3xl" />
            <span className="relative mx-auto grid size-12 place-items-center rounded-2xl border border-stone-200 bg-white text-stone-500 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
                {connecting ? <LoaderCircle className="size-5 animate-spin" /> : <Bot className="size-5" />}
            </span>
            <h2 className="relative mt-4 text-base font-semibold text-stone-950 dark:text-stone-100">{t(connecting ? "agentHub.connectingTitle" : "agentHub.connectTitle")}</h2>
            <p className="relative mx-auto mt-2 max-w-xl text-xs leading-5 text-stone-500 dark:text-stone-400">{error || t(connecting ? "agentHub.connectingDescription" : "agentHub.connectDescription")}</p>
            <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button type="primary" icon={<ArrowRight className="size-3.5" />} onClick={onOpenAgent}>
                    {t("agentHub.openSetup")}
                </Button>
                <Button icon={<ShieldCheck className="size-3.5" />} onClick={onOpenPlugins}>
                    {t(pluginHubEnabled ? "agentHub.pluginHub" : "agentHub.installPlugin")}
                </Button>
            </div>
            <div className="relative mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-stone-400 dark:text-stone-500">
                <span>{t("agentHub.noOldSkills")}</span>
                <span>{t("agentHub.noModelRequest")}</span>
            </div>
        </div>
    );
}

function LibraryEmpty({ collection, collectionEmpty, filtered, onReset, onBrowseAll }: { collection: AgentSkillCollection; collectionEmpty: boolean; filtered: boolean; onReset: () => void; onBrowseAll: () => void }) {
    const { t } = useTranslation();
    const noMatch = filtered && !collectionEmpty;
    const title = noMatch ? "agentHub.emptyNoMatch" : collection === "favorites" ? "agentHub.emptyFavorites" : collection === "mine" ? "agentHub.emptyMine" : "agentHub.emptyTitle";
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 px-4 text-center dark:border-stone-700">
            <span className="grid size-10 place-items-center rounded-xl bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500">
                <Sparkles className="size-4" />
            </span>
            <div className="mt-3 text-sm font-medium text-stone-800 dark:text-stone-200">{t(title)}</div>
            <div className="mt-1 max-w-md text-xs leading-5 text-stone-500 dark:text-stone-400">{t(noMatch ? "agentHub.emptyNoMatchHint" : "agentHub.emptyHint")}</div>
            {collectionEmpty && collection !== "all" ? (
                <Button size="small" className="mt-4" onClick={onBrowseAll}>
                    {t("agentHub.browseAll")}
                </Button>
            ) : noMatch ? (
                <Button size="small" className="mt-4" onClick={onReset}>
                    {t("agentHub.resetFilter")}
                </Button>
            ) : null}
        </div>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl bg-white/75 px-2 py-2 text-center dark:bg-stone-950/55">
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">{value}</div>
            <div className="mt-0.5 truncate text-[9px] text-stone-400 dark:text-stone-500">{label}</div>
        </div>
    );
}

function scopeIcon(scope: AgentSkillScope) {
    if (scope === "repo") return FolderGit2;
    if (scope === "user") return UserRound;
    if (scope === "system") return MonitorCog;
    return ShieldCheck;
}
