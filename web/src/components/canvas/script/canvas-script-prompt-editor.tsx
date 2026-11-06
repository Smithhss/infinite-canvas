import { useEffect, useState } from "react";
import { Button, Modal } from "antd";
import { History, RotateCcw, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { buildScriptShotPrompt, SCRIPT_PROMPT_MAX_LENGTH, scriptShotPromptStatus, validateScriptPrompt } from "@/lib/canvas/script-v2";
import type { CanvasScriptShot, CanvasScriptV2 } from "@/types/canvas";

type Props = {
    script: CanvasScriptV2;
    shot: CanvasScriptShot;
    theme: CanvasTheme;
    onClose: () => void;
    onSave: (prompt: string) => void;
    onRestore: (version: number) => void;
};

export function CanvasScriptPromptEditor({ script, shot, theme, onClose, onSave, onRestore }: Props) {
    const { t, i18n } = useTranslation();
    const [draft, setDraft] = useState(shot.imageGenerationPrompt || "");
    const validation = validateScriptPrompt(draft);
    const status = scriptShotPromptStatus(script, shot);
    const history = shot.promptHistory || [];
    const controlStyle = {
        background: theme.node.panel,
        borderColor: theme.toolbar.border,
        color: theme.node.text,
    };

    useEffect(() => {
        setDraft(shot.imageGenerationPrompt || "");
    }, [shot.id, shot.imageGenerationPrompt]);

    return (
        <Modal
            open
            centered
            width="min(760px, calc(100vw - 24px))"
            title={t("canvas.storyboard.workbench.promptEditor.title", { number: shot.shotNumber })}
            onCancel={onClose}
            styles={{
                body: { padding: 0 },
                header: { margin: 0, padding: "14px 18px", borderBottom: `1px solid ${theme.toolbar.border}` },
            }}
            footer={null}
        >
            <div className="thin-scrollbar max-h-[calc(100vh-140px)] overflow-y-auto p-4" style={{ background: theme.canvas.background, color: theme.node.text }}>
                <div className="flex flex-wrap items-center gap-2 text-[10px]" style={{ color: theme.node.muted }}>
                    <span>{t(`canvas.storyboard.workbench.promptEditor.status.${status}`)}</span>
                    <span>V{shot.promptVersion || 0}</span>
                    <span>{t("canvas.storyboard.workbench.promptEditor.characterCount", { count: draft.trim().length, max: SCRIPT_PROMPT_MAX_LENGTH })}</span>
                </div>

                <textarea
                    value={draft}
                    rows={9}
                    autoFocus
                    placeholder={t("canvas.storyboard.workbench.promptEditor.placeholder")}
                    className="mt-3 w-full resize-y rounded-xl border px-3 py-2.5 text-xs leading-5 outline-none placeholder:opacity-45"
                    style={controlStyle}
                    onChange={(event) => setDraft(event.target.value)}
                />
                {validation.length ? (
                    <div className="mt-2 text-[10px] text-red-500">
                        {validation.map((error) => t(`canvas.storyboard.workbench.promptEditor.validation.${error}`)).join(" ")}
                    </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Button icon={<WandSparkles className="size-3.5" />} onClick={() => setDraft(buildScriptShotPrompt(script, shot))}>
                        {t("canvas.storyboard.workbench.promptEditor.composeLocal")}
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button onClick={onClose}>{t("common.cancel")}</Button>
                        <Button
                            type="primary"
                            disabled={validation.length > 0}
                            onClick={() => {
                                onSave(draft.trim());
                                onClose();
                            }}
                        >
                            {t("common.save")}
                        </Button>
                    </div>
                </div>

                <div className="mt-5 border-t pt-4" style={{ borderColor: theme.toolbar.border }}>
                    <div className="flex items-center gap-2">
                        <History className="size-3.5" style={{ color: theme.node.muted }} />
                        <span className="text-xs font-medium">{t("canvas.storyboard.workbench.promptEditor.history")}</span>
                        <span className="text-[10px] tabular-nums" style={{ color: theme.node.muted }}>{history.length}</span>
                    </div>
                    {history.length ? (
                        <div className="mt-2 space-y-2">
                            {history.map((entry) => (
                                <div key={`${entry.version}-${entry.createdAt}`} className="rounded-xl p-3" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                                    <div className="flex items-center gap-2 text-[10px]" style={{ color: theme.node.muted }}>
                                        <span className="font-medium">V{entry.version}</span>
                                        <span>{t(`canvas.storyboard.workbench.promptEditor.sources.${entry.source}`)}</span>
                                        {entry.createdAt ? <span>{new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(entry.createdAt)}</span> : null}
                                        <button
                                            type="button"
                                            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 transition hover:bg-black/5 dark:hover:bg-white/10"
                                            style={{ color: theme.node.text }}
                                            onClick={() => {
                                                onRestore(entry.version);
                                                onClose();
                                            }}
                                        >
                                            <RotateCcw className="size-3" />
                                            {t("canvas.storyboard.workbench.promptEditor.restore")}
                                        </button>
                                    </div>
                                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[11px] leading-5" style={{ color: theme.node.muted }}>{entry.prompt}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-2 rounded-xl px-4 py-6 text-center text-[10px]" style={{ color: theme.node.muted, border: `0.5px dashed ${theme.toolbar.border}` }}>
                            {t("canvas.storyboard.workbench.promptEditor.emptyHistory")}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
