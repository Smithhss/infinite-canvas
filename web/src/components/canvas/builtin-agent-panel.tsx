import { useRef } from "react";
import { Bot, CircleStop, ImagePlus, PanelRightClose, Send, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { Button, Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import type { BuiltinCanvasBudget, BuiltinCanvasRunResult } from "@/lib/canvas/builtin-canvas-agent/runtime";
import type { BuiltinAgentAttachment, BuiltinAgentChatMessage, BuiltinAgentConfirmation } from "@/lib/canvas/builtin-canvas-agent/ui-state";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { BuiltinAgentConfirmDialog } from "./builtin-agent-confirm-dialog";

export type BuiltinAgentPanelController = {
    messages: BuiltinAgentChatMessage[];
    attachments: BuiltinAgentAttachment[];
    input: string;
    running: boolean;
    modelReady: boolean;
    modelLabel: string;
    confirmation: BuiltinAgentConfirmation | null;
    budget: BuiltinCanvasBudget;
    lastResult: BuiltinCanvasRunResult | null;
    canUndo: boolean;
    setInput: (value: string) => void;
    send: () => void;
    stop: () => void;
    clear: () => void;
    undo: () => void;
    addFiles: (files: FileList | File[]) => void;
    removeAttachment: (id: string) => void;
    resolveConfirmation: (confirmed: boolean) => void;
    openConfig: () => void;
};

export function BuiltinAgentPanel({ controller, onClose }: { controller: BuiltinAgentPanelController; onClose: () => void }) {
    const { t } = useTranslation();
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const effectiveConfig = useEffectiveConfig();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageModel = effectiveConfig.imageModel || effectiveConfig.model;

    return (
        <>
            <aside
                data-canvas-shortcuts-ignore
                className="absolute bottom-20 right-4 top-20 z-[75] flex w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl"
                style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text, backdropFilter: "blur(18px)" }}
            >
                <header className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: theme.toolbar.border }}>
                    <span className="grid size-8 place-items-center rounded-xl" style={{ background: theme.node.fill }}>
                        <Sparkles className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{t("canvas.builtinAgent.title")}</div>
                        <button type="button" className="max-w-full truncate text-left text-xs opacity-55 hover:opacity-80" onClick={controller.openConfig}>
                            {controller.modelLabel || t("canvas.builtinAgent.modelMissing")}
                        </button>
                    </div>
                    <Tooltip title={t("canvas.builtinAgent.clear")}>
                        <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30" disabled={!controller.messages.length || controller.running} onClick={controller.clear}>
                            <Trash2 className="size-4" />
                        </button>
                    </Tooltip>
                    <Tooltip title={t("canvas.builtinAgent.undo")}>
                        <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30" disabled={!controller.canUndo} onClick={controller.undo}>
                            <Undo2 className="size-4" />
                        </button>
                    </Tooltip>
                    <Tooltip title={t("canvas.builtinAgent.close")}>
                        <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" onClick={onClose}>
                            <PanelRightClose className="size-4" />
                        </button>
                    </Tooltip>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    {!controller.messages.length ? (
                        <div className="flex h-full flex-col justify-center px-4 text-center">
                            <Sparkles className="mx-auto size-8 opacity-30" />
                            <h2 className="mt-4 text-base font-semibold">{t("canvas.builtinAgent.emptyTitle")}</h2>
                            <p className="mt-2 text-sm leading-6 opacity-55">{t("canvas.builtinAgent.emptyDescription")}</p>
                            <div className="mt-5 flex flex-wrap justify-center gap-2">
                                {[t("canvas.builtinAgent.suggestions.organize"), t("canvas.builtinAgent.suggestions.image"), t("canvas.builtinAgent.suggestions.text")].map((text) => (
                                    <button key={text} type="button" className="rounded-full border px-3 py-1.5 text-xs transition hover:bg-black/5 dark:hover:bg-white/10" style={{ borderColor: theme.toolbar.border }} onClick={() => controller.setInput(text)}>
                                        {text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {controller.messages.map((item) => (
                                <div key={item.id} className={item.role === "user" ? "ml-8 rounded-2xl px-3 py-2" : "mr-2 rounded-2xl border px-3 py-2"} style={item.role === "user" ? { background: theme.node.fill } : { borderColor: theme.toolbar.border }}>
                                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide opacity-45">
                                        {item.role === "tool" ? <Bot className="size-3" /> : null}
                                        {item.meta || item.role}
                                    </div>
                                    <div className="whitespace-pre-wrap break-words text-sm leading-6">{item.text}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {controller.attachments.length ? (
                    <div className="flex gap-2 overflow-x-auto border-t px-4 py-2" style={{ borderColor: theme.toolbar.border }}>
                        {controller.attachments.map((attachment) => (
                            <div key={attachment.id} className="relative shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: theme.toolbar.border }}>
                                <img src={attachment.url} alt={attachment.name} className="size-12 object-cover" />
                                <button type="button" className="absolute right-0 top-0 grid size-4 place-items-center rounded-bl bg-black/70 text-white" onClick={() => controller.removeAttachment(attachment.id)} aria-label={t("canvas.builtinAgent.removeAttachment")}>
                                    <X className="size-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : null}

                <footer className="border-t p-3" style={{ borderColor: theme.toolbar.border }}>
                    <div className="rounded-2xl border p-2" style={{ borderColor: theme.toolbar.border, background: theme.node.panel }}>
                        <textarea
                            value={controller.input}
                            onChange={(event) => controller.setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    controller.send();
                                }
                            }}
                            rows={2}
                            disabled={!controller.modelReady || controller.running}
                            placeholder={controller.modelReady ? t("canvas.builtinAgent.placeholder") : t("canvas.builtinAgent.configureFirst")}
                            className="max-h-36 min-h-14 w-full resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:opacity-40"
                            style={{ color: theme.node.text }}
                        />
                        <div className="mt-1 flex items-center gap-1">
                            <Tooltip title={t("canvas.builtinAgent.addAttachment")}>
                                <button type="button" className="grid size-8 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" onClick={() => fileInputRef.current?.click()}>
                                    <ImagePlus className="size-4" />
                                </button>
                            </Tooltip>
                            <Tag className="!m-0 !max-w-[190px] !truncate !rounded-full !border-0 !px-2 !text-[11px]" style={{ background: theme.node.fill, color: theme.node.muted }}>
                                {imageModel || t("canvas.builtinAgent.imageModelMissing")}
                            </Tag>
                            <span className="ml-auto text-[11px] opacity-40">
                                {controller.budget.mediaTasks}/6 · {controller.budget.imageOutputs}/12
                            </span>
                            {controller.running ? (
                                <Button size="small" danger icon={<CircleStop className="size-3.5" />} onClick={controller.stop}>
                                    {t("canvas.builtinAgent.stop")}
                                </Button>
                            ) : (
                                <Button size="small" type="primary" icon={<Send className="size-3.5" />} disabled={!controller.modelReady || !controller.input.trim()} onClick={controller.send}>
                                    {t("canvas.builtinAgent.send")}
                                </Button>
                            )}
                        </div>
                    </div>
                </footer>
            </aside>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { if (event.target.files) controller.addFiles(event.target.files); event.target.value = ""; }} />
            <BuiltinAgentConfirmDialog confirmation={controller.confirmation} onConfirm={() => controller.resolveConfirmation(true)} onCancel={() => controller.resolveConfirmation(false)} />
        </>
    );
}
