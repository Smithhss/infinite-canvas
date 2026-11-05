import { Palette, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { SCRIPT_V2_COLUMNS, SCRIPT_V2_ROW_COLORS } from "@/lib/canvas/script-v2";
import { cn } from "@/lib/utils";
import type { CanvasScriptColumnKey, CanvasScriptShot, CanvasScriptV2 } from "@/types/canvas";

type Props = {
    script: CanvasScriptV2;
    visibleColumns: CanvasScriptColumnKey[];
    theme: CanvasTheme;
    onCommitShot: (shotId: string, patch: Partial<Omit<CanvasScriptShot, "id" | "shotNumber">>) => void;
    onRemoveShot: (shotId: string) => void;
};

const rowBackgrounds: Record<string, string> = {
    red: "rgba(239, 68, 68, 0.09)",
    orange: "rgba(245, 158, 11, 0.09)",
    green: "rgba(34, 197, 94, 0.09)",
    blue: "rgba(59, 130, 246, 0.09)",
    violet: "rgba(139, 92, 246, 0.09)",
};

const rowColorDots: Record<string, string> = {
    red: "#ef4444",
    orange: "#f59e0b",
    green: "#22c55e",
    blue: "#3b82f6",
    violet: "#8b5cf6",
};

export function CanvasScriptTable({ script, visibleColumns, theme, onCommitShot, onRemoveShot }: Props) {
    const { t } = useTranslation();
    const columns = SCRIPT_V2_COLUMNS.filter((column) => visibleColumns.includes(column.key));
    const gridTemplateColumns = `${columns.map((column) => column.width).join(" ")} 132px`;

    return (
        <div className="thin-scrollbar mt-2 overflow-auto rounded-xl" style={{ border: `0.5px solid ${theme.toolbar.border}` }}>
            <div className="min-w-max">
                <div className="sticky top-0 z-10 grid h-9 items-center" style={{ gridTemplateColumns, background: theme.toolbar.panel, borderBottom: `0.5px solid ${theme.toolbar.border}` }}>
                    {columns.map((column) => (
                        <div key={column.key} className="truncate px-2.5 text-[10px] font-medium" style={{ color: theme.node.muted }}>
                            {t(`canvas.storyboard.workbench.fields.${column.labelKey}`)}
                        </div>
                    ))}
                    <div className="px-2 text-[10px] font-medium" style={{ color: theme.node.muted }}>
                        {t("canvas.storyboard.workbench.table.actions")}
                    </div>
                </div>
                <div className="divide-y" style={{ borderColor: theme.toolbar.border }}>
                    {script.rows.map((row) => (
                        <div key={row.id} className="grid items-stretch" style={{ gridTemplateColumns, background: row.color ? rowBackgrounds[row.color] : "transparent" }}>
                            {columns.map((column) => (
                                <ScriptTableCell key={column.key} column={column.key} row={row} theme={theme} onCommit={(patch) => onCommitShot(row.id, patch)} />
                            ))}
                            <div className="flex items-center gap-1 px-1.5">
                                {SCRIPT_V2_ROW_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={cn("size-3 rounded-full border transition hover:scale-110", row.color === color && "ring-1 ring-offset-1")}
                                        style={{ background: rowColorDots[color], borderColor: row.color === color ? theme.node.text : "transparent", outlineColor: theme.node.text }}
                                        aria-label={t("canvas.storyboard.workbench.table.setColor", { color })}
                                        title={t("canvas.storyboard.workbench.table.setColor", { color })}
                                        onClick={() => onCommitShot(row.id, { color: row.color === color ? undefined : color })}
                                    />
                                ))}
                                <button
                                    type="button"
                                    className="ml-auto grid size-7 place-items-center rounded-md transition hover:bg-red-500/10"
                                    style={{ color: theme.node.muted }}
                                    aria-label={t("canvas.storyboard.workbench.removeShot")}
                                    title={t("canvas.storyboard.workbench.removeShot")}
                                    onClick={() => onRemoveShot(row.id)}
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ScriptTableCell({
    column,
    row,
    theme,
    onCommit,
}: {
    column: CanvasScriptColumnKey;
    row: CanvasScriptShot;
    theme: CanvasTheme;
    onCommit: (patch: Partial<Omit<CanvasScriptShot, "id" | "shotNumber">>) => void;
}) {
    const { t } = useTranslation();
    const style = { borderColor: theme.toolbar.border, color: theme.node.text };

    if (column === "shotNumber") {
        return (
            <div className="flex items-center px-2.5 text-xs font-medium tabular-nums" style={{ color: theme.node.text }}>
                #{row.shotNumber}
            </div>
        );
    }

    if (column === "duration") {
        return (
            <label className="flex items-center gap-1 border-r px-1.5" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}>
                <input
                    type="number"
                    min={1}
                    defaultValue={row.durationSeconds}
                    aria-label={t("canvas.storyboard.workbench.fields.duration")}
                    className="min-w-0 flex-1 bg-transparent px-1 text-xs tabular-nums outline-none"
                    style={{ color: theme.node.text }}
                    onBlur={(event) => onCommit({ durationSeconds: Math.max(1, Number(event.target.value) || 1) })}
                />
                <span className="text-[9px]">{t("canvas.storyboard.workbench.seconds")}</span>
            </label>
        );
    }

    if (column === "characters" || column === "props") {
        const values = column === "characters" ? row.characters || [] : row.propTags || [];
        return (
            <input
                defaultValue={values.join("、")}
                placeholder={t(`canvas.storyboard.workbench.fields.${column}`)}
                className="border-r bg-transparent px-2.5 text-xs outline-none placeholder:opacity-45"
                style={style}
                onBlur={(event) => {
                    const next = [...new Set(event.target.value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean))];
                    onCommit(column === "characters" ? { characters: next } : { propTags: next });
                }}
            />
        );
    }

    const textareaColumns: CanvasScriptColumnKey[] = ["plot", "lighting", "audio", "dialogue", "imagePrompt", "videoPrompt", "imageToVideoPrompt"];
    const valueByColumn = scriptCellValue(row, column);
    if (textareaColumns.includes(column)) {
        return (
            <textarea
                defaultValue={valueByColumn}
                placeholder={t(`canvas.storyboard.workbench.fields.${column}`)}
                className="min-h-[88px] resize-none border-r bg-transparent px-2.5 py-2 text-xs leading-5 outline-none placeholder:opacity-45"
                style={style}
                onBlur={(event) => onCommit(scriptCellPatch(column, event.target.value))}
            />
        );
    }

    return (
        <input
            defaultValue={valueByColumn}
            placeholder={t(`canvas.storyboard.workbench.fields.${column}`)}
            className="min-h-11 border-r bg-transparent px-2.5 text-xs outline-none placeholder:opacity-45"
            style={style}
            onBlur={(event) => onCommit(scriptCellPatch(column, event.target.value))}
        />
    );
}

function scriptCellValue(row: CanvasScriptShot, column: CanvasScriptColumnKey) {
    if (column === "plot") return row.plotDescription;
    if (column === "lighting") return row.lightingAndAtmosphere || "";
    if (column === "audio") return row.audioEffects || "";
    if (column === "dialogue") return row.dialogue || "";
    if (column === "imagePrompt") return row.imageGenerationPrompt || "";
    if (column === "videoPrompt") return row.videoMotionPrompt || "";
    if (column === "imageToVideoPrompt") return row.imageToVideoMotionPrompt || "";
    if (column === "videoReference") return row.videoReference || "";
    if (column === "shotSize") return row.shotSize || "";
    if (column === "emotion") return row.emotion || "";
    if (column === "cameraMovement") return row.cameraMovement || "";
    return "";
}

function scriptCellPatch(column: CanvasScriptColumnKey, value: string): Partial<Omit<CanvasScriptShot, "id" | "shotNumber">> {
    if (column === "plot") return { plotDescription: value };
    if (column === "lighting") return { lightingAndAtmosphere: value };
    if (column === "audio") return { audioEffects: value };
    if (column === "dialogue") return { dialogue: value };
    if (column === "imagePrompt") return { imageGenerationPrompt: value };
    if (column === "videoPrompt") return { videoMotionPrompt: value };
    if (column === "imageToVideoPrompt") return { imageToVideoMotionPrompt: value };
    if (column === "videoReference") return { videoReference: value };
    if (column === "shotSize") return { shotSize: value };
    if (column === "emotion") return { emotion: value };
    if (column === "cameraMovement") return { cameraMovement: value };
    return {};
}
