import type { ReactNode } from "react";
import { FileText, Image as ImageIcon, MousePointer2, Music2, Scissors, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CANVAS_EMPTY_QUICK_ACTION_IDS, canvasEmptyQuickActionNodeType, isCanvasEmptyQuickActionEnabled, shouldShowCanvasEmptyQuickActions, type CanvasEmptyQuickActionId } from "@/lib/canvas/canvas-chrome";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasWorkspaceView } from "@/types/canvas";

type CanvasEmptyQuickActionsProps = {
    enabled: boolean;
    projectLoaded: boolean;
    workspaceView: CanvasWorkspaceView;
    nodeCount: number;
    onCreate: (type: CanvasNodeType.Image | CanvasNodeType.Video | CanvasNodeType.Audio | CanvasNodeType.Text | CanvasNodeType.Script) => void;
    onSmartCut: () => void;
};

export function CanvasEmptyQuickActions({ enabled, projectLoaded, workspaceView, nodeCount, onCreate, onSmartCut }: CanvasEmptyQuickActionsProps) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    if (!shouldShowCanvasEmptyQuickActions({ enabled, projectLoaded, workspaceView, nodeCount })) return null;

    return (
        <section className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4 pb-24 pt-16" aria-label={t("canvas.emptyActions.label")}>
            <div className="w-full max-w-[1120px] -translate-y-5">
                <div className="mx-auto max-w-xl text-center">
                    <div className="inline-flex items-center gap-2">
                        <MousePointer2 className="size-5 -rotate-12" style={{ color: theme.node.muted }} />
                        <h2 className="text-lg font-medium tracking-[-0.025em] sm:text-xl" style={{ color: theme.node.text }}>
                        {t("canvas.emptyActions.title")}
                        </h2>
                    </div>
                    <p className="mx-auto mt-2 max-w-md text-[11px] leading-5 sm:text-xs" style={{ color: theme.node.muted }}>
                        {t("canvas.emptyActions.description")}
                    </p>
                </div>
                <div className="thin-scrollbar mt-7 flex justify-start gap-2 overflow-x-auto px-1 pb-1 sm:justify-center">
                    {CANVAS_EMPTY_QUICK_ACTION_IDS.map((action) => (
                        <QuickActionCard key={action} action={action} theme={theme} onCreate={onCreate} onSmartCut={onSmartCut} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function QuickActionCard({
    action,
    theme,
    onCreate,
    onSmartCut,
}: {
    action: CanvasEmptyQuickActionId;
    theme: CanvasTheme;
    onCreate: CanvasEmptyQuickActionsProps["onCreate"];
    onSmartCut: () => void;
}) {
    const { t } = useTranslation();
    const nodeType = canvasEmptyQuickActionNodeType(action);
    const disabled = !isCanvasEmptyQuickActionEnabled(action);
    const meta = emptyActionMeta(action, theme);
    const labelKey = action === "smart-cut" ? "smartCut" : action;

    return (
        <button
            type="button"
            disabled={disabled}
            className="pointer-events-auto flex h-16 min-w-[168px] flex-1 items-center gap-3 rounded-[14px] border px-4 text-left shadow-[0_14px_34px_-30px_rgba(0,0,0,.8)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:max-w-[200px]"
            style={{ background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text, outlineColor: theme.toolbar.activeText }}
            title={t(`canvas.emptyActions.${labelKey}Hint`)}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onClick={() => {
                if (nodeType) onCreate(nodeType);
                if (action === "smart-cut") onSmartCut();
            }}
        >
            <span className="grid size-7 shrink-0 place-items-center" style={{ color: action === "smart-cut" ? "#e6b24a" : theme.node.text }}>
                {meta.icon}
            </span>
            <span className="min-w-0 truncate text-sm font-medium">{t(`canvas.emptyActions.${labelKey}`)}</span>
        </button>
    );
}

function emptyActionMeta(action: CanvasEmptyQuickActionId, theme: CanvasTheme): { icon: ReactNode } {
    if (action === "image") return { icon: <ImageIcon className="size-4.5" style={{ color: theme.node.text }} /> };
    if (action === "video") return { icon: <Video className="size-4.5" style={{ color: theme.node.text }} /> };
    if (action === "audio") return { icon: <Music2 className="size-4.5" style={{ color: theme.node.text }} /> };
    if (action === "script") return { icon: <FileText className="size-4.5" style={{ color: theme.node.text }} /> };
    return { icon: <Scissors className="size-4.5" style={{ color: "#e6b24a" }} /> };
}
