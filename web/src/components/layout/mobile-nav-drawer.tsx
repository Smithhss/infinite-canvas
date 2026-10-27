import { Drawer } from "antd";
import { BookOpen, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { changeAppLocale, type AppLocale } from "@/i18n";
import { isNavigationToolEnabled, navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { DOCS_URL } from "@/constant/env";
import { cn } from "@/lib/utils";
import { VersionReleaseModal } from "@/components/layout/version-release-modal";
import { useThemeStore } from "@/stores/use-theme-store";

type MobileNavDrawerProps = {
    open: boolean;
    activeToolSlug?: NavigationToolSlug;
    onClose: () => void;
};

export function MobileNavDrawer({ open, activeToolSlug, onClose }: MobileNavDrawerProps) {
    const { i18n, t } = useTranslation();
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const locale = i18n.resolvedLanguage as AppLocale;
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
    const languageLabel = t("topNav.switchLanguage", { language: t(nextLocale === "zh-CN" ? "locale.zhCN" : "locale.enUS") });
    const themeLabel = t(theme === "dark" ? "topNav.lightTheme" : "topNav.darkTheme");
    const utilityClass = "flex items-center gap-3 rounded-lg px-3 py-3 text-base text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100";

    return (
        <Drawer title={t("topNav.navigation")} placement="left" size={280} open={open} onClose={onClose} className="md:hidden">
            <div className="space-y-1">
                {navigationTools.filter(isNavigationToolEnabled).map((tool) => {
                    const Icon = tool.icon;
                    const active = tool.slug === activeToolSlug;
                    return (
                        <Link
                            key={tool.slug}
                            to={`/${tool.slug}`}
                            onClick={onClose}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition",
                                active ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                            )}
                        >
                            <Icon className="size-5" />
                            <span>{t(`navigation.${tool.slug}`)}</span>
                        </Link>
                    );
                })}
            </div>
            <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-800">
                <a
                    href={DOCS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className={utilityClass}
                >
                    <BookOpen className="size-5" />
                    <span>{t("topNav.docs")}</span>
                </a>
                <button type="button" className={`${utilityClass} w-full border-0 bg-transparent text-left`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={themeLabel}>
                    {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
                    <span>{themeLabel}</span>
                </button>
                <button type="button" className={`${utilityClass} w-full border-0 bg-transparent text-left`} onClick={() => void changeAppLocale(nextLocale)} aria-label={languageLabel}>
                    <span className="grid size-5 place-items-center text-xs font-semibold">{locale === "zh-CN" ? "中" : "EN"}</span>
                    <span>{languageLabel}</span>
                </button>
                <VersionReleaseModal className={`${utilityClass} w-full border-0 bg-transparent text-left`} />
            </div>
        </Drawer>
    );
}
