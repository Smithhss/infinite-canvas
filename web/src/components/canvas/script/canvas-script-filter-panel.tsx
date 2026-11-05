import { ListFilter, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { createScriptFilter, SCRIPT_FILTER_OPERATORS, SCRIPT_V2_COLUMNS } from "@/lib/canvas/script-v2";
import type { CanvasScriptFilter, CanvasScriptFilterOperator } from "@/types/canvas";

type Props = {
    filters: CanvasScriptFilter[];
    theme: CanvasTheme;
    onChange: (filters: CanvasScriptFilter[]) => void;
};

export function CanvasScriptFilterPanel({ filters, theme, onChange }: Props) {
    const { t } = useTranslation();
    const controlStyle = {
        background: theme.node.panel,
        borderColor: theme.toolbar.border,
        color: theme.node.text,
    };

    return (
        <div className="mt-3 rounded-xl p-3" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
            <div className="flex flex-wrap items-center gap-2">
                <ListFilter className="size-3.5" style={{ color: theme.node.muted }} />
                <span className="text-[11px] font-medium">{t("canvas.storyboard.workbench.filters.title")}</span>
                <span className="text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                    {filters.length}
                </span>
                <button
                    type="button"
                    className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: theme.node.muted }}
                    disabled={filters.length >= 20}
                    onClick={() => onChange([...filters, createScriptFilter()])}
                >
                    <Plus className="size-3" />
                    {t("canvas.storyboard.workbench.filters.add")}
                </button>
                <button
                    type="button"
                    className="h-7 rounded-md px-2 text-[10px] transition hover:bg-black/5 disabled:opacity-35 dark:hover:bg-white/10"
                    style={{ color: theme.node.muted }}
                    disabled={!filters.length}
                    onClick={() => onChange([])}
                >
                    {t("canvas.storyboard.workbench.filters.clearAll")}
                </button>
            </div>
            {filters.length ? (
                <div className="mt-2 space-y-2">
                    {filters.map((filter) => (
                        <div key={filter.id} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(130px,1fr)_120px_minmax(160px,1.4fr)_32px]">
                            <select
                                value={filter.column}
                                aria-label={t("canvas.storyboard.workbench.filters.column")}
                                className="h-8 min-w-0 rounded-lg border px-2 text-[10px] outline-none"
                                style={controlStyle}
                                onChange={(event) => {
                                    const column = event.target.value as CanvasScriptFilter["column"];
                                    onChange(filters.map((item) => (item.id === filter.id ? { ...item, column } : item)));
                                }}
                            >
                                {SCRIPT_V2_COLUMNS.map((column) => (
                                    <option key={column.key} value={column.key}>
                                        {t(`canvas.storyboard.workbench.fields.${column.labelKey}`)}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={filter.operator}
                                aria-label={t("canvas.storyboard.workbench.filters.operator")}
                                className="h-8 min-w-0 rounded-lg border px-2 text-[10px] outline-none"
                                style={controlStyle}
                                onChange={(event) => {
                                    const operator = event.target.value as CanvasScriptFilterOperator;
                                    onChange(filters.map((item) => (item.id === filter.id ? { ...item, operator } : item)));
                                }}
                            >
                                {SCRIPT_FILTER_OPERATORS.map((operator) => (
                                    <option key={operator} value={operator}>
                                        {t(`canvas.storyboard.workbench.filters.operators.${operator}`)}
                                    </option>
                                ))}
                            </select>
                            <input
                                value={filter.value}
                                aria-label={t("canvas.storyboard.workbench.filters.value")}
                                placeholder={t("canvas.storyboard.workbench.filters.valuePlaceholder")}
                                className="h-8 min-w-0 rounded-lg border px-2.5 text-xs outline-none placeholder:opacity-45"
                                style={controlStyle}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    onChange(filters.map((item) => (item.id === filter.id ? { ...item, value } : item)));
                                }}
                            />
                            <button
                                type="button"
                                className="grid size-8 place-items-center rounded-lg transition hover:bg-red-500/10"
                                style={{ color: theme.node.muted }}
                                aria-label={t("canvas.storyboard.workbench.filters.remove")}
                                onClick={() => onChange(filters.filter((item) => item.id !== filter.id))}
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
