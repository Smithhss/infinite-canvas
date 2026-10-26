import { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronDown, Cpu, Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useTranslation } from "react-i18next";

import i18n from "@/i18n";
import { cn } from "@/lib/utils";
import { decodeChannelModel, modelOptionName, selectableModelsByCapability, type AiConfig, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";

type StudioModelPickerProps = {
    config: AiConfig;
    value?: string;
    onChange: (model: string) => void;
    capability: ModelCapability;
    className?: string;
    fullWidth?: boolean;
    compact?: boolean;
    placeholder?: string;
    onMissingConfig?: () => void;
};

type StudioProvider = {
    key: string;
    label: string;
    initials: string;
    logo?: string;
    tone: string;
};

type StudioModelEntry = {
    value: string;
    model: string;
    provider: StudioProvider;
    channel?: ModelChannel;
    ready: boolean;
};

const PROVIDER_RULES: Array<Omit<StudioProvider, "initials"> & { initials?: string; keywords: string[] }> = [
    { key: "openai", label: "OpenAI", logo: "/icons/openai.svg", tone: "", keywords: ["openai", "gpt-image", "dall-e", "dalle"] },
    { key: "google", label: "Google", logo: "/icons/gemini.svg", tone: "", keywords: ["google", "gemini", "imagen", "nano-banana"] },
    { key: "anthropic", label: "Anthropic", logo: "/icons/claude.svg", tone: "", keywords: ["anthropic", "claude"] },
    { key: "grok", label: "xAI", logo: "/icons/grok.svg", tone: "", keywords: ["xai", "grok"] },
    { key: "deepseek", label: "DeepSeek", logo: "/icons/deepseek.svg", tone: "", keywords: ["deepseek"] },
    { key: "glm", label: "GLM", logo: "/icons/glm.svg", tone: "", keywords: ["glm", "chatglm", "cogview"] },
    { key: "bytedance", label: "ByteDance", initials: "BD", tone: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300", keywords: ["bytedance", "volcengine", "doubao", "seedream", "seedance"] },
    { key: "alibaba", label: "Alibaba", initials: "AL", tone: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300", keywords: ["alibaba", "dashscope", "tongyi", "qwen", "wan2", "wanx"] },
    { key: "blackforest", label: "Black Forest", initials: "BF", tone: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300", keywords: ["black forest", "black-forest", "blackforest", "bfl", "flux"] },
    { key: "kling", label: "Kuaishou", initials: "KL", tone: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300", keywords: ["kuaishou", "kling", "kolors"] },
    { key: "minimax", label: "MiniMax", initials: "MX", tone: "border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-300", keywords: ["minimax", "hailuo"] },
    { key: "ideogram", label: "Ideogram", initials: "ID", tone: "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300", keywords: ["ideogram"] },
    { key: "vidu", label: "Vidu", initials: "VD", tone: "border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300", keywords: ["vidu"] },
    { key: "luma", label: "Luma", initials: "LM", tone: "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-300", keywords: ["luma"] },
    { key: "runway", label: "Runway", initials: "RW", tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", keywords: ["runway"] },
    { key: "midjourney", label: "Midjourney", initials: "MJ", tone: "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300", keywords: ["midjourney"] },
    { key: "recraft", label: "Recraft", initials: "RC", tone: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300", keywords: ["recraft"] },
    { key: "stability", label: "Stability", initials: "SD", tone: "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-300", keywords: ["stability", "stable-diffusion", "sdxl"] },
    { key: "tencent", label: "Tencent", initials: "TC", tone: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300", keywords: ["tencent", "hunyuan"] },
    { key: "pika", label: "Pika", initials: "PK", tone: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-300", keywords: ["pika"] },
    { key: "suno", label: "Suno", initials: "SU", tone: "border-lime-500/20 bg-lime-500/10 text-lime-700 dark:text-lime-300", keywords: ["suno"] },
];

const DEFAULT_PROVIDER_TONE = "border-primary/15 bg-primary/10 text-primary";

export function StudioModelPicker({ config, value, onChange, capability, className, fullWidth = false, compact = false, placeholder, onMissingConfig }: StudioModelPickerProps) {
    const { t } = useTranslation();
    const pickerId = useId();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [providerKey, setProviderKey] = useState("all");
    const [scope, setScope] = useState<"all" | "configured">("all");
    const options = useMemo(() => {
        const current = value?.trim();
        return Array.from(new Set([...(current ? [current] : []), ...selectableModelsByCapability(config, capability)]));
    }, [capability, config, value]);
    const entries = useMemo(() => options.map((option) => buildEntry(config, option)), [config, options]);
    const providers = useMemo(() => {
        const seen = new Set<string>();
        return entries.filter((entry) => {
            if (seen.has(entry.provider.key)) return false;
            seen.add(entry.provider.key);
            return true;
        }).map((entry) => entry.provider);
    }, [entries]);
    const current = value || "";
    const currentEntry = entries.find((entry) => entry.value === current);
    const pickerPlaceholder = placeholder || t("settingsPanels.model.select");
    const filteredEntries = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return entries.filter((entry) => {
            if (providerKey !== "all" && entry.provider.key !== providerKey) return false;
            if (scope === "configured" && !entry.ready) return false;
            if (!keyword) return true;
            return `${entry.model} ${entry.provider.label} ${entry.channel?.name || ""}`.toLowerCase().includes(keyword);
        });
    }, [entries, providerKey, scope, search]);

    useEffect(() => {
        if (providerKey !== "all" && !providers.some((provider) => provider.key === providerKey)) setProviderKey("all");
    }, [providerKey, providers]);

    useEffect(() => {
        const closeOtherPicker = (event: Event) => {
            if ((event as CustomEvent<string>).detail !== pickerId) setOpen(false);
        };
        window.addEventListener("model-picker-open", closeOtherPicker);
        return () => window.removeEventListener("model-picker-open", closeOtherPicker);
    }, [pickerId]);

    const updateOpen = (nextOpen: boolean) => {
        if (nextOpen && !entries.length) {
            onMissingConfig?.();
            return;
        }
        if (nextOpen) window.dispatchEvent(new CustomEvent("model-picker-open", { detail: pickerId }));
        else {
            setSearch("");
            setProviderKey("all");
            setScope("all");
        }
        setOpen(nextOpen);
    };

    return (
        <Popover.Root open={open} onOpenChange={updateOpen}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className={cn(
                        "group flex h-11 min-w-0 items-center gap-2.5 rounded-xl border border-input bg-transparent px-3 text-left text-sm shadow-sm outline-none transition-colors hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/20",
                        fullWidth ? "w-full" : compact ? "w-fit max-w-full" : "w-fit min-w-[12rem] max-w-full",
                        className,
                    )}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    title={current ? [currentEntry?.model || current, currentEntry?.provider.label, currentEntry && !currentEntry.ready ? t("settingsPanels.model.studio.notConfigured") : ""].filter(Boolean).join(" · ") : pickerPlaceholder}
                >
                    {currentEntry ? <ProviderMark provider={currentEntry.provider} compact={compact} /> : <span className={cn("grid shrink-0 place-items-center rounded-full border border-dashed border-input text-muted-foreground", compact ? "size-7" : "size-8")}><Cpu className={compact ? "size-3.5" : "size-4"} /></span>}
                    <span className={cn("min-w-0 flex-1", compact && "flex items-center gap-1.5")}>
                        <span className="block truncate font-medium">{current ? currentEntry?.model || current : pickerPlaceholder}</span>
                        {compact ? (
                            currentEntry && !currentEntry.ready ? (
                                <span className="size-1.5 shrink-0 rounded-full bg-amber-500" title={t("settingsPanels.model.studio.notConfigured")}>
                                    <span className="sr-only">{t("settingsPanels.model.studio.notConfigured")}</span>
                                </span>
                            ) : null
                        ) : (
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="truncate">{currentEntry?.provider.label || t(`settingsPanels.model.capabilities.${capability}`)}</span>
                                {currentEntry && !currentEntry.ready ? <span className="shrink-0 text-amber-600 dark:text-amber-300">{t("settingsPanels.model.studio.notConfigured")}</span> : null}
                            </span>
                        )}
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    data-canvas-no-zoom
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    collisionPadding={12}
                    className="z-[1200] w-[min(620px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-3.5">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold">{t("settingsPanels.model.studio.title")}</h2>
                                <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{t(`settingsPanels.model.capabilities.${capability}`)}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{t("settingsPanels.model.studio.description")}</p>
                        </div>
                        <Popover.Close asChild>
                            <button type="button" className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label={t("common.cancel")}>
                                <X className="size-4" />
                            </button>
                        </Popover.Close>
                    </div>
                    <div className="flex h-[min(62vh,460px)] min-h-[340px]">
                        <aside className="thin-scrollbar flex w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border/70 bg-muted/20 px-2 py-3">
                            <button
                                type="button"
                                onClick={() => setProviderKey("all")}
                                aria-pressed={providerKey === "all"}
                                title={t("settingsPanels.model.studio.allProviders")}
                                className={cn("grid size-9 shrink-0 place-items-center rounded-full border transition", providerKey === "all" ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground")}
                            >
                                <span className={cn("text-xs font-bold", providerKey === "all" && "text-primary-foreground")}>全</span>
                            </button>
                            {providers.map((provider) => {
                                const active = provider.key === providerKey;
                                return (
                                    <button
                                        key={provider.key}
                                        type="button"
                                        onClick={() => setProviderKey(provider.key)}
                                        aria-pressed={active}
                                        title={provider.label}
                                        className={cn("grid size-9 shrink-0 place-items-center rounded-full border transition", active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-transparent hover:bg-accent")}
                                    >
                                        <ProviderRailMark provider={provider} active={active} />
                                    </button>
                                );
                            })}
                        </aside>
                        <section className="flex min-w-0 flex-1 flex-col">
                            <div className="space-y-3 border-b border-border/70 p-3.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
                                        {(["all", "configured"] as const).map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                onClick={() => setScope(item)}
                                                aria-pressed={scope === item}
                                                className={cn("rounded-md px-2.5 py-1 text-[11px] font-medium transition", scope === item ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                {t(item === "all" ? "settingsPanels.model.studio.allModels" : "settingsPanels.model.studio.configured")}
                                            </button>
                                        ))}
                                    </div>
                                    <span className="text-[11px] tabular-nums text-muted-foreground">{t("settingsPanels.model.studio.modelsCount", { count: filteredEntries.length })}</span>
                                </div>
                                <label className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15">
                                    <Search className="size-3.5 shrink-0 text-muted-foreground" />
                                    <input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                                        placeholder={t("settingsPanels.model.studio.searchPlaceholder")}
                                    />
                                </label>
                            </div>
                            <div className="thin-scrollbar flex-1 overflow-y-auto p-2">
                                {filteredEntries.length ? (
                                    <div className="space-y-1">
                                        {filteredEntries.map((entry) => {
                                            const selected = entry.value === current;
                                            return (
                                                <button
                                                    key={entry.value}
                                                    type="button"
                                                    onClick={() => {
                                                        onChange(entry.value);
                                                        updateOpen(false);
                                                    }}
                                                    className={cn(
                                                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                                                        selected ? "border-border bg-accent/80" : "border-transparent hover:border-border/60 hover:bg-accent/50",
                                                    )}
                                                >
                                                    <ProviderMark provider={entry.provider} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-medium">{entry.model}</span>
                                                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                                            {entry.provider.label}
                                                            {entry.channel?.name ? ` · ${entry.channel.name}` : ""}
                                                        </span>
                                                    </span>
                                                    {!entry.ready ? <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">{t("settingsPanels.model.studio.notConfigured")}</span> : null}
                                                    {selected ? <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span> : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 px-6 text-center">
                                        <Cpu className="size-7 text-muted-foreground/50" />
                                        <p className="text-sm font-medium">{t("settingsPanels.model.studio.noResults")}</p>
                                        <p className="text-xs text-muted-foreground">{config.models.length ? t("settingsPanels.model.noMatch", { capability: t(`settingsPanels.model.capabilities.${capability}`) }) : t("settingsPanels.model.addFirst")}</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}

function buildEntry(config: AiConfig, value: string): StudioModelEntry {
    const decoded = decodeChannelModel(value);
    const model = modelOptionName(value);
    const channel = decoded ? config.channels.find((item) => item.id === decoded.channelId) : config.channels.find((item) => item.models.some((entry) => entry.name === model));
    return {
        value,
        model,
        provider: resolveProvider(`${model} ${channel?.name || ""} ${channel?.baseUrl || ""}`, channel),
        channel,
        ready: Boolean(channel?.baseUrl.trim() && channel.apiKey.trim()),
    };
}

function resolveProvider(searchText: string, channel?: ModelChannel): StudioProvider {
    const text = searchText.toLowerCase();
    const rule = PROVIDER_RULES.find((provider) => provider.keywords.some((keyword) => text.includes(keyword)));
    if (rule) {
        const { keywords: _keywords, ...provider } = rule;
        return { ...provider, initials: provider.initials || initialsForLabel(provider.label) };
    }
    const label = channel?.name.trim() || i18n.t("settingsPanels.model.studio.customProvider");
    return {
        key: channel ? `channel-${channel.id}` : "custom",
        label,
        initials: initialsForLabel(label),
        tone: DEFAULT_PROVIDER_TONE,
    };
}

function initialsForLabel(label: string) {
    const words = label.match(/[A-Za-z0-9]+|[\u4e00-\u9fff]/g) || ["AI"];
    if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
    return words[0].slice(0, 2).toUpperCase();
}

function ProviderRailMark({ provider, active }: { provider: StudioProvider; active: boolean }) {
    return provider.logo ? (
        <span
            className={cn("size-5", active ? "bg-primary-foreground" : "bg-current")}
            style={{ mask: `url(${provider.logo}) center / contain no-repeat`, WebkitMask: `url(${provider.logo}) center / contain no-repeat` }}
        />
    ) : (
        <span className={cn("text-[10px] font-bold tracking-tight", active ? "text-primary-foreground" : provider.tone.includes("text-") ? "" : "text-foreground")}>{provider.initials}</span>
    );
}

function ProviderMark({ provider, compact = false }: { provider: StudioProvider; compact?: boolean }) {
    return (
        <span className={cn("grid shrink-0 place-items-center rounded-full border", compact ? "size-7" : "size-8", provider.logo ? "border-border bg-background text-foreground" : provider.tone)}>
            {provider.logo ? (
                <span className={cn("bg-current", compact ? "size-3.5" : "size-4")} style={{ mask: `url(${provider.logo}) center / contain no-repeat`, WebkitMask: `url(${provider.logo}) center / contain no-repeat` }} />
            ) : (
                <span className="text-[10px] font-bold tracking-tight">{provider.initials}</span>
            )}
        </span>
    );
}
