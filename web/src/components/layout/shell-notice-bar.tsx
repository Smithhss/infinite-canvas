import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ShellNoticeBar() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(true);
    if (!open) return null;

    return (
        <div className="relative flex h-[60px] shrink-0 items-center justify-center bg-[linear-gradient(90deg,#ff477e,#ff6b4a)] px-14 text-center text-[13px] font-medium text-white">
            <span className="truncate">{t("home.libtv.notice")}</span>
            <button
                type="button"
                aria-label={t("home.libtv.noticeDismiss")}
                className="absolute right-4 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-white/80 transition hover:bg-black/10 hover:text-white sm:size-8"
                onClick={() => setOpen(false)}
            >
                <X className="size-4" />
            </button>
        </div>
    );
}
