import { Drawer } from "antd";
import { BookOpen, Moon, Sun } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { changeAppLocale, type AppLocale } from "@/i18n";
import { DOCS_URL } from "@/constant/env";
import { cn } from "@/lib/utils";
import { getShellToolNavigation, isShellNavigationActive, shellCreateNavigation, shellPrimaryNavigation, withShellFeatureFlags, type ShellNavigationItem } from "@/components/layout/navigation-groups";
import { VersionReleaseModal } from "@/components/layout/version-release-modal";
import { useAgentStore } from "@/stores/use-agent-store";
import { useThemeStore } from "@/stores/use-theme-store";

type MobileNavDrawerProps = {
    open: boolean;
    compact?: boolean;
    onClose: () => void;
    onOpenAgent: () => void;
    onOpenPlugins: () => void;
};

export function MobileNavDrawer({ open, compact = false, onClose, onOpenAgent, onOpenPlugins }: MobileNavDrawerProps) {
    const { i18n, t } = useTranslation();
    const { pathname, search } = useLocation();
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const locale = i18n.resolvedLanguage as AppLocale;
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
    const languageLabel = t("topNav.switchLanguage", { language: t(nextLocale === "zh-CN" ? "locale.zhCN" : "locale.enUS") });
    const themeLabel = t(theme === "dark" ? "topNav.lightTheme" : "topNav.darkTheme");
    const utilityClass = "flex items-center gap-3 rounded-lg px-3 py-3 text-base text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100";
    const runAction = (item: ShellNavigationItem) => {
        if (item.action === "agent") onOpenAgent();
        if (item.action === "plugins") onOpenPlugins();
    };
    const itemActive = (item: ShellNavigationItem) => (item.action === "agent" ? panelOpen : isShellNavigationActive(item, pathname, search));
    const navItem = (item: ShellNavigationItem) => {
        const Icon = item.icon;
        const active = itemActive(item);
        const className = cn(
            "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition",
            active ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100",
        );
        return item.to ? (
            <Link key={item.key} to={withShellFeatureFlags(item.to, search)} aria-current={active ? "page" : undefined} onClick={onClose} className={className}>
                <Icon className="size-5" />
                <span>{t(item.labelKey)}</span>
            </Link>
        ) : (
            <button key={item.key} type="button" className={cn(className, "w-full border-0 bg-transparent text-left")} aria-current={active ? "page" : undefined} onClick={() => runAction(item)}>
                <Icon className="size-5" />
                <span>{t(item.labelKey)}</span>
            </button>
        );
    };

    return (
        <Drawer title={t("topNav.navigation")} placement="left" size={280} open={open} onClose={onClose} className={compact ? "lg:hidden" : "md:hidden"}>
            <div className="space-y-1">{shellPrimaryNavigation.map(navItem)}</div>
            <div className="mt-4 space-y-1 border-t border-stone-200 pt-3 dark:border-stone-800">
                <p className="px-3 pb-1 text-xs font-medium text-stone-400 dark:text-stone-500">{t("topNav.createGroup")}</p>
                {shellCreateNavigation.map(navItem)}
            </div>
            <div className="mt-4 space-y-1 border-t border-stone-200 pt-3 dark:border-stone-800">
                <p className="px-3 pb-1 text-xs font-medium text-stone-400 dark:text-stone-500">{t("topNav.tools")}</p>
                {getShellToolNavigation().map(navItem)}
            </div>
            <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-800">
                <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" onClick={onClose} className={utilityClass}>
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
