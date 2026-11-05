import type { ReactNode } from "react";
import { Box, Clapperboard, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasTheme } from "@/lib/canvas-theme";
import type { CanvasScriptV2 } from "@/types/canvas";

export function CanvasScriptAssetSummary({ script, theme }: { script: CanvasScriptV2; theme: CanvasTheme }) {
    const { t } = useTranslation();
    const characters = unique(script.rows.flatMap((row) => row.characters || []));
    const scenes: string[] = [];
    const props = unique(script.rows.flatMap((row) => row.propTags || []));

    return (
        <div className="mt-2 grid gap-3 lg:grid-cols-3">
            <AssetGroup icon={<UserRound className="size-4" />} title={t("canvas.storyboard.workbench.assets.characters")} values={characters} empty={t("canvas.storyboard.workbench.assets.empty")} theme={theme} />
            <AssetGroup icon={<Clapperboard className="size-4" />} title={t("canvas.storyboard.workbench.assets.scenes")} values={scenes} empty={t("canvas.storyboard.workbench.assets.empty")} theme={theme} />
            <AssetGroup icon={<Box className="size-4" />} title={t("canvas.storyboard.workbench.assets.props")} values={props} empty={t("canvas.storyboard.workbench.assets.empty")} theme={theme} />
        </div>
    );
}

function AssetGroup({ icon, title, values, empty, theme }: { icon: ReactNode; title: string; values: string[]; empty: string; theme: CanvasTheme }) {
    const { t } = useTranslation();
    return (
        <section className="min-w-0 rounded-xl p-3" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
            <div className="flex items-center gap-2">
                <span style={{ color: theme.node.muted }}>{icon}</span>
                <h3 className="text-xs font-medium">{title}</h3>
                <span className="ml-auto text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                    {values.length}
                </span>
            </div>
            {values.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {values.map((value) => (
                        <span key={value} className="rounded-full px-2 py-1 text-[10px]" style={{ background: theme.canvas.background, border: `0.5px solid ${theme.toolbar.border}` }}>
                            {value}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="mt-3 text-[10px]" style={{ color: theme.node.muted }}>
                    {empty}
                </p>
            )}
            <p className="mt-3 text-[9px] leading-4" style={{ color: theme.node.muted }}>
                {t("canvas.storyboard.workbench.assets.boundary")}
            </p>
        </section>
    );
}

function unique(values: string[]) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
