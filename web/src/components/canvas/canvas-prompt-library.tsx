import { useState } from "react";
import { Button, Tooltip } from "antd";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

export function CanvasPromptLibrary({ onSelect, showLabel = false }: { onSelect: (prompt: string) => void; showLabel?: boolean }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];

    return (
        <>
            <Tooltip title={t("navigation.prompts")}>
                <Button
                    type="text"
                    className={`!h-8 shrink-0 !rounded-lg !bg-transparent !p-0 ${showLabel ? "!w-auto !px-2.5" : "!w-8 !min-w-8"}`}
                    style={{ color: theme.node.text }}
                    icon={<BookOpen className="size-3.5" />}
                    onClick={() => setOpen(true)}
                    aria-label={t("navigation.prompts")}
                >
                    {showLabel ? <span className="text-[11px]">{t("navigation.prompts")}</span> : null}
                </Button>
            </Tooltip>
            <PromptSelectDialog open={open} onOpenChange={setOpen} onSelect={onSelect} />
        </>
    );
}
