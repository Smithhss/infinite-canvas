import { useMemo, useState, type ReactNode } from "react";
import { App, Button, Modal } from "antd";
import { Check, ChevronDown, ChevronUp, Copy, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCopyText } from "@/hooks/use-copy-text";
import type { CanvasTheme } from "@/lib/canvas-theme";
import {
    applyScriptPresetTemplate,
    buildScriptPresetPrompt,
    buildScriptPresetSummary,
    createEmptyScriptPreset,
    normalizeScriptPreset,
    SCRIPT_ART_STYLE_OPTIONS,
    SCRIPT_AUDIENCE_OPTIONS,
    SCRIPT_CHARACTER_OPTIONS,
    SCRIPT_EPISODE_OPTIONS,
    SCRIPT_ERA_OPTIONS,
    SCRIPT_GENRE_OPTIONS,
    SCRIPT_HOOK_OPTIONS,
    SCRIPT_PRESET_LIMITS,
    SCRIPT_STRUCTURE_OPTIONS,
    SCRIPT_TOP_PRESETS,
    toggleScriptPresetOption,
    toggleScriptPresetSingle,
    type ScriptPresetOption,
} from "@/lib/canvas/script-preset";
import { cn } from "@/lib/utils";
import type { CanvasScriptPreset } from "@/types/canvas";

type Props = {
    open: boolean;
    preset?: CanvasScriptPreset;
    theme: CanvasTheme;
    onClose: () => void;
    onConfirm: (preset: CanvasScriptPreset) => void;
};

type MultiKey = "audience" | "characters" | "eras" | "hooks";

export function CanvasScriptPresetModal({ open, preset, theme, onClose, onConfirm }: Props) {
    const { t, i18n } = useTranslation();
    const { message } = App.useApp();
    const copyText = useCopyText();
    const [draft, setDraft] = useState(() => normalizeScriptPreset(preset));
    const [showPresets, setShowPresets] = useState(true);
    const [showFusion, setShowFusion] = useState(() => Boolean(preset?.fusedGenre));
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const english = i18n.language.startsWith("en");
    const summary = useMemo(() => buildScriptPresetSummary(draft), [draft]);
    const prompt = useMemo(() => buildScriptPresetPrompt(draft), [draft]);

    const edit = (patch: Partial<CanvasScriptPreset>) => {
        setSelectedPresetId(null);
        setDraft((current) => ({ ...current, ...patch }));
    };

    const toggleMulti = (key: MultiKey, value: string, limit: number) => {
        const result = toggleScriptPresetOption(draft[key], value, limit);
        if (result.limitReached) {
            message.warning(t("canvas.storyboard.workbench.scriptPreset.limitReached", { count: limit }));
            return;
        }
        edit({ [key]: result.values });
    };

    const chooseTemplate = (templateId: string) => {
        const next = applyScriptPresetTemplate(templateId);
        if (!next) return;
        setDraft(next);
        setShowFusion(Boolean(next.fusedGenre));
        setSelectedPresetId(templateId);
    };

    const resetDraft = () => {
        setDraft(createEmptyScriptPreset());
        setShowFusion(false);
        setSelectedPresetId(null);
    };

    return (
        <Modal
            open={open}
            centered
            width="min(1120px, calc(100vw - 24px))"
            title={t("canvas.storyboard.workbench.scriptPreset.title")}
            destroyOnHidden={false}
            onCancel={onClose}
            styles={{
                body: { padding: 0 },
                header: { margin: 0, padding: "14px 18px", borderBottom: `1px solid ${theme.toolbar.border}` },
                footer: { margin: 0, padding: "12px 16px", borderTop: `1px solid ${theme.toolbar.border}` },
            }}
            footer={
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button icon={<RotateCcw className="size-3.5" />} onClick={resetDraft}>
                        {t("canvas.storyboard.workbench.scriptPreset.reset")}
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button onClick={onClose}>{t("common.cancel")}</Button>
                        <Button type="primary" icon={<Check className="size-3.5" />} onClick={() => onConfirm(draft)}>
                            {t("canvas.storyboard.workbench.scriptPreset.confirm")}
                        </Button>
                    </div>
                </div>
            }
        >
            <div
                className={cn(
                    "thin-scrollbar max-h-[calc(100vh-190px)] overflow-y-auto lg:h-[min(640px,calc(100vh-190px))] lg:max-h-none lg:overflow-hidden",
                    showPresets ? "lg:grid lg:grid-cols-[238px_minmax(0,1fr)]" : "lg:grid lg:grid-cols-1",
                )}
                style={{ background: theme.canvas.background, color: theme.node.text }}
            >
                {showPresets ? (
                    <aside className="border-b p-3 lg:h-full lg:overflow-y-auto lg:border-b-0 lg:border-r" style={{ borderColor: theme.toolbar.border, background: theme.node.panel }}>
                        <div className="mb-2 flex items-center gap-2 px-1">
                            <Sparkles className="size-3.5" style={{ color: theme.node.muted }} />
                            <span className="text-xs font-medium">{t("canvas.storyboard.workbench.scriptPreset.topPresets")}</span>
                            <button
                                type="button"
                                className="ml-auto grid size-6 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
                                style={{ color: theme.node.muted }}
                                aria-label={t("canvas.storyboard.workbench.scriptPreset.hidePresets")}
                                title={t("canvas.storyboard.workbench.scriptPreset.hidePresets")}
                                onClick={() => setShowPresets(false)}
                            >
                                <ChevronUp className="size-3.5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
                            {SCRIPT_TOP_PRESETS.map((item, index) => {
                                const active = selectedPresetId === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        aria-pressed={active}
                                        className="rounded-lg px-2.5 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
                                        style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.text }}
                                        onClick={() => chooseTemplate(item.id)}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="text-[10px] tabular-nums" style={{ color: active ? theme.toolbar.activeText : theme.node.muted }}>
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{english ? item.titleEn : item.title}</span>
                                        </span>
                                        <span className="mt-1 block line-clamp-2 text-[10px] leading-4" style={{ color: active ? theme.toolbar.activeText : theme.node.muted }}>
                                            {english ? item.descriptionEn : item.description}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                ) : null}

                <section className={cn("min-w-0 p-4 sm:p-5", showPresets ? "" : "mx-auto w-full max-w-[1040px]", "lg:h-full lg:overflow-y-auto")}>
                    {!showPresets ? (
                        <Button className="mb-3" size="small" icon={<ChevronDown className="size-3.5" />} onClick={() => setShowPresets(true)}>
                            {t("canvas.storyboard.workbench.scriptPreset.showPresets")}
                        </Button>
                    ) : null}

                    <SettingSection title={t("canvas.storyboard.workbench.scriptPreset.genre")} theme={theme}>
                        <OptionChips
                            options={SCRIPT_GENRE_OPTIONS}
                            english={english}
                            theme={theme}
                            selected={draft.genre ? [draft.genre] : []}
                            autoLabel={t("canvas.storyboard.workbench.scriptPreset.auto")}
                            onAuto={() => edit({ genre: undefined, customGenre: undefined })}
                            onToggle={(value) => edit({ genre: toggleScriptPresetSingle(draft.genre, value), customGenre: value === "其他" ? draft.customGenre : undefined })}
                        />
                        {draft.genre === "其他" ? (
                            <input
                                value={draft.customGenre || ""}
                                onChange={(event) => edit({ customGenre: event.target.value })}
                                placeholder={t("canvas.storyboard.workbench.scriptPreset.customGenrePlaceholder")}
                                className="mt-2 h-8 w-full rounded-lg border px-2.5 text-xs outline-none"
                                style={inputStyle(theme)}
                            />
                        ) : null}
                        <button
                            type="button"
                            className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed px-2.5 text-[10px] transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ borderColor: showFusion ? theme.toolbar.activeBg : theme.toolbar.border, color: showFusion ? theme.node.text : theme.node.muted }}
                            onClick={() => {
                                setShowFusion((current) => !current);
                                if (showFusion) edit({ fusedGenre: undefined });
                            }}
                        >
                            {showFusion ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                            {t("canvas.storyboard.workbench.scriptPreset.fusedGenre")}
                        </button>
                        {showFusion ? (
                            <div className="mt-2 rounded-lg p-2" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                                <OptionChips
                                    options={SCRIPT_GENRE_OPTIONS.filter((option) => option.value !== draft.genre)}
                                    english={english}
                                    theme={theme}
                                    selected={draft.fusedGenre ? [draft.fusedGenre] : []}
                                    onToggle={(value) => edit({ fusedGenre: toggleScriptPresetSingle(draft.fusedGenre, value) })}
                                />
                            </div>
                        ) : null}
                    </SettingSection>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <SettingSection title={t("canvas.storyboard.workbench.scriptPreset.audience")} meta={selectionMeta(draft.audience.length, SCRIPT_PRESET_LIMITS.audience)} theme={theme}>
                            <OptionChips
                                options={SCRIPT_AUDIENCE_OPTIONS}
                                english={english}
                                theme={theme}
                                selected={draft.audience}
                                limit={SCRIPT_PRESET_LIMITS.audience}
                                autoLabel={t("canvas.storyboard.workbench.scriptPreset.auto")}
                                onAuto={() => edit({ audience: [] })}
                                onToggle={(value) => toggleMulti("audience", value, SCRIPT_PRESET_LIMITS.audience)}
                            />
                        </SettingSection>
                        <SettingSection title={t("canvas.storyboard.workbench.scriptPreset.eras")} meta={selectionMeta(draft.eras.length, SCRIPT_PRESET_LIMITS.eras)} theme={theme}>
                            <OptionChips
                                options={SCRIPT_ERA_OPTIONS}
                                english={english}
                                theme={theme}
                                selected={draft.eras}
                                limit={SCRIPT_PRESET_LIMITS.eras}
                                autoLabel={t("canvas.storyboard.workbench.scriptPreset.auto")}
                                onAuto={() => edit({ eras: [] })}
                                onToggle={(value) => toggleMulti("eras", value, SCRIPT_PRESET_LIMITS.eras)}
                            />
                        </SettingSection>
                    </div>

                    <SettingSection title={t("canvas.storyboard.workbench.scriptPreset.characters")} meta={selectionMeta(draft.characters.length, SCRIPT_PRESET_LIMITS.characters)} theme={theme} className="mt-4">
                        <OptionChips
                            options={SCRIPT_CHARACTER_OPTIONS}
                            english={english}
                            theme={theme}
                            selected={draft.characters}
                            limit={SCRIPT_PRESET_LIMITS.characters}
                            autoLabel={t("canvas.storyboard.workbench.scriptPreset.auto")}
                            onAuto={() => edit({ characters: [] })}
                            onToggle={(value) => toggleMulti("characters", value, SCRIPT_PRESET_LIMITS.characters)}
                        />
                    </SettingSection>

                    <SettingSection title={t("canvas.storyboard.workbench.scriptPreset.hooks")} meta={selectionMeta(draft.hooks.length, SCRIPT_PRESET_LIMITS.hooks)} theme={theme} className="mt-4">
                        <OptionChips
                            options={SCRIPT_HOOK_OPTIONS}
                            english={english}
                            theme={theme}
                            selected={draft.hooks}
                            limit={SCRIPT_PRESET_LIMITS.hooks}
                            autoLabel={t("canvas.storyboard.workbench.scriptPreset.auto")}
                            onAuto={() => edit({ hooks: [] })}
                            onToggle={(value) => toggleMulti("hooks", value, SCRIPT_PRESET_LIMITS.hooks)}
                        />
                    </SettingSection>

                    <SettingSection title={t("canvas.storyboard.workbench.scriptPreset.artStyle")} theme={theme} className="mt-4">
                        <OptionChips
                            options={SCRIPT_ART_STYLE_OPTIONS}
                            english={english}
                            theme={theme}
                            selected={draft.artStyle ? [draft.artStyle] : []}
                            autoLabel={t("canvas.storyboard.workbench.scriptPreset.auto")}
                            onAuto={() => edit({ artStyle: undefined, customArtStyle: undefined })}
                            onToggle={(value) => edit({ artStyle: toggleScriptPresetSingle(draft.artStyle, value), customArtStyle: value === "自定义" ? draft.customArtStyle : undefined })}
                        />
                        {draft.artStyle === "自定义" ? (
                            <input
                                value={draft.customArtStyle || ""}
                                onChange={(event) => edit({ customArtStyle: event.target.value })}
                                placeholder={t("canvas.storyboard.workbench.scriptPreset.customArtStylePlaceholder")}
                                className="mt-2 h-8 w-full rounded-lg border px-2.5 text-xs outline-none"
                                style={inputStyle(theme)}
                            />
                        ) : null}
                    </SettingSection>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)]">
                        <SettingSection title={t("canvas.storyboard.workbench.scriptPreset.episodes")} theme={theme}>
                            <select
                                value={draft.episodes}
                                onChange={(event) => edit({ episodes: Number(event.target.value) })}
                                className="h-8 w-full rounded-lg border px-2.5 text-xs outline-none"
                                style={inputStyle(theme)}
                                aria-label={t("canvas.storyboard.workbench.scriptPreset.episodes")}
                            >
                                {SCRIPT_EPISODE_OPTIONS.map((value) => (
                                    <option key={value} value={value}>
                                        {t("canvas.storyboard.workbench.scriptPreset.episodeCount", { count: value })}
                                    </option>
                                ))}
                            </select>
                        </SettingSection>
                        <SettingSection title={t("canvas.storyboard.workbench.scriptPreset.structure")} theme={theme}>
                            <OptionChips
                                options={SCRIPT_STRUCTURE_OPTIONS}
                                english={english}
                                theme={theme}
                                selected={draft.structure ? [draft.structure] : []}
                                autoLabel={t("canvas.storyboard.workbench.scriptPreset.auto")}
                                onAuto={() => edit({ structure: undefined })}
                                onToggle={(value) => edit({ structure: toggleScriptPresetSingle(draft.structure, value) })}
                            />
                        </SettingSection>
                    </div>

                    <div className="mt-5 rounded-xl p-3.5" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                        <div className="flex items-center gap-2">
                            <WandSparkles className="size-4" style={{ color: theme.node.muted }} />
                            <h4 className="text-xs font-medium">{t("canvas.storyboard.workbench.scriptPreset.output")}</h4>
                            <Button className="ml-auto" size="small" icon={<Copy className="size-3" />} onClick={() => copyText(prompt)}>
                                {t("common.copyPrompt")}
                            </Button>
                        </div>
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                            <PreviewBlock title={t("canvas.storyboard.workbench.scriptPreset.summary")} content={summary} theme={theme} />
                            <PreviewBlock title={t("canvas.storyboard.workbench.scriptPreset.prompt")} content={prompt} theme={theme} />
                        </div>
                    </div>
                </section>
            </div>
        </Modal>
    );
}

function selectionMeta(selected: number, limit: number) {
    return `${selected}/${limit}`;
}

function inputStyle(theme: CanvasTheme) {
    return { background: theme.canvas.background, borderColor: theme.toolbar.border, color: theme.node.text };
}

function SettingSection({
    title,
    meta,
    theme,
    className,
    children,
}: {
    title: string;
    meta?: string;
    theme: CanvasTheme;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={className}>
            <div className="mb-2 flex items-center gap-2">
                <h3 className="text-[11px] font-medium">{title}</h3>
                {meta ? (
                    <span className="text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                        {meta}
                    </span>
                ) : null}
            </div>
            {children}
        </section>
    );
}

function OptionChips({
    options,
    selected,
    theme,
    english,
    limit,
    autoLabel,
    onAuto,
    onToggle,
}: {
    options: ScriptPresetOption[];
    selected: string[];
    theme: CanvasTheme;
    english: boolean;
    limit?: number;
    autoLabel?: string;
    onAuto?: () => void;
    onToggle: (value: string) => void;
}) {
    const atLimit = typeof limit === "number" && selected.length >= limit;
    return (
        <div className="flex flex-wrap gap-1.5">
            {onAuto && autoLabel ? (
                <OptionChip active={selected.length === 0} theme={theme} onClick={onAuto}>
                    {autoLabel}
                </OptionChip>
            ) : null}
            {options.map((option) => {
                const active = selected.includes(option.value);
                return (
                    <OptionChip key={option.value} active={active} muted={!active && atLimit && !selected.includes(option.value)} theme={theme} onClick={() => onToggle(option.value)}>
                        {english ? option.labelEn : option.label}
                    </OptionChip>
                );
            })}
        </div>
    );
}

function OptionChip({
    active,
    muted,
    theme,
    children,
    onClick,
}: {
    active: boolean;
    muted?: boolean;
    theme: CanvasTheme;
    children: ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            className={cn("h-7 rounded-full border px-2.5 text-[10px] transition hover:bg-black/5 dark:hover:bg-white/10", muted && "opacity-45")}
            style={{
                background: active ? theme.toolbar.activeBg : "transparent",
                borderColor: active ? theme.toolbar.activeBg : theme.toolbar.border,
                color: active ? theme.toolbar.activeText : theme.node.text,
            }}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function PreviewBlock({ title, content, theme }: { title: string; content: string; theme: CanvasTheme }) {
    return (
        <div className="min-w-0 rounded-lg p-2.5" style={{ background: theme.canvas.background, border: `0.5px solid ${theme.toolbar.border}` }}>
            <div className="text-[10px] font-medium" style={{ color: theme.node.muted }}>
                {title}
            </div>
            <pre className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[10px] leading-5" style={{ color: theme.node.text }}>
                {content}
            </pre>
        </div>
    );
}
