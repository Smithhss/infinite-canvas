import type { ReactNode } from "react";
import { FileText, Image as ImageIcon, Music2, Scissors, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CANVAS_EMPTY_QUICK_ACTION_IDS, canvasEmptyQuickActionNodeType, shouldShowCanvasEmptyQuickActions, type CanvasEmptyQuickActionId } from "@/lib/canvas/canvas-chrome";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasWorkspaceView } from "@/types/canvas";

type CanvasEmptyQuickActionsProps = {
    enabled: boolean;
    projectLoaded: boolean;
    workspaceView: CanvasWorkspaceView;
    nodeCount: number;
    onCreate: (type: CanvasNodeType.Image | CanvasNodeType.Video | CanvasNodeType.Audio | CanvasNodeType.Text) => void;
};

export function CanvasEmptyQuickActions({ enabled, projectLoaded, workspaceView, nodeCount, onCreate }: CanvasEmptyQuickActionsProps) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    if (!shouldShowCanvasEmptyQuickActions({ enabled, projectLoaded, workspaceView, nodeCount })) return null;

    return (
        <section className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4 pb-28 pt-20" aria-label={t("canvas.emptyActions.label")}>
            <div className="w-full max-w-4xl">
                <div className="mx-auto max-w-xl text-center">
                    <h2 className="text-lg font-semibold tracking-[-0.025em] sm:text-xl" style={{ color: theme.node.text }}>
                        {t("canvas.emptyActions.title")}
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-5 sm:text-sm" style={{ color: theme.node.muted }}>
                        {t("canvas.emptyActions.description")}
                    </p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {CANVAS_EMPTY_QUICK_ACTION_IDS.map((action) => (
                        <QuickActionCard key={action} action={action} theme={theme} onCreate={onCreate} />
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
}: {
    action: CanvasEmptyQuickActionId;
    theme: CanvasTheme;
    onCreate: CanvasEmptyQuickActionsProps["onCreate"];
}) {
    const { t } = useTranslation();
    const nodeType = canvasEmptyQuickActionNodeType(action);
    const disabled = !nodeType;
    const meta = emptyActionMeta(action, theme);
    const labelKey = action === "smart-cut" ? "smartCut" : action;

    return (
        <button
            type="button"
            disabled={disabled}
            className="pointer-events-auto flex min-h-24 flex-col items-start rounded-2xl border p-3 text-left shadow-[0_18px_45px_-34px_rgba(28,25,23,.7)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-32px_rgba(28,25,23,.65)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            style={{ background: theme.toolbar.floating, borderColor: theme.toolbar.border, color: theme.node.text, outlineColor: theme.toolbar.activeText }}
            title={t(`canvas.emptyActions.${labelKey}Hint`)}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onClick={() => {
                if (nodeType) onCreate(nodeType);
            }}
        >
            <span className="grid size-8 place-items-center rounded-xl" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>
                {meta.icon}
            </span>
            <span className="mt-auto pt-4 text-sm font-semibold">{t(`canvas.emptyActions.${labelKey}`)}</span>
            <span className="mt-1 line-clamp-2 text-[10px] leading-4" style={{ color: theme.node.muted }}>
                {t(`canvas.emptyActions.${labelKey}Hint`)}
            </span>
        </button>
    );
}

function emptyActionMeta(action: CanvasEmptyQuickActionId, theme: CanvasTheme): { icon: ReactNode } {
    if (action === "image") return { icon: <ImageIcon className="size-4" style={{ color: theme.node.text }} /> };
    if (action === "video") return { icon: <Video className="size-4" style={{ color: theme.node.text }} /> };
    if (action === "audio") return { icon: <Music2 className="size-4" style={{ color: theme.node.text }} /> };
    if (action === "script") return { icon: <FileText className="size-4" style={{ color: theme.node.text }} /> };
    return { icon: <Scissors className="size-4" style={{ color: theme.node.text }} /> };
}
