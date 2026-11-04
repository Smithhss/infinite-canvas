import { useEffect, useState, type ReactNode } from "react";
import { Tooltip } from "antd";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { UserStatusActions } from "@/components/layout/user-status-actions";
import { getShellToolNavigation, isShellNavigationActive, shellCreateNavigation, shellPrimaryNavigation, withShellFeatureFlags, type ShellNavigationAction, type ShellNavigationItem } from "@/components/layout/navigation-groups";
import { VersionReleaseModal } from "@/components/layout/version-release-modal";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/use-agent-store";

type AppSidebarProps = {
    onOpenPlugins: () => void;
};

export function AppSidebar({ onOpenPlugins }: AppSidebarProps) {
    const { t } = useTranslation();
    const { pathname, search } = useLocation();
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const togglePanel = useAgentStore((state) => state.togglePanel);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem("libtv-sidebar-collapsed") === "1");
    const immersiveRoute = /^\/canvas\/[^/]+/.test(pathname);

    useEffect(() => {
        localStorage.setItem("libtv-sidebar-collapsed", collapsed ? "1" : "0");
    }, [collapsed]);

    if (immersiveRoute) return null;

    const runAction = (action: ShellNavigationAction) => {
        if (action === "agent") togglePanel();
        if (action === "plugins") onOpenPlugins();
    };

    const itemActive = (item: ShellNavigationItem) => (item.action === "agent" ? panelOpen : isShellNavigationActive(item, pathname, search));

    const navItem = (item: ShellNavigationItem, options?: { group?: boolean }) => {
        const active = itemActive(item);
        const Icon = item.icon;
        const content = (
            <>
                <Icon className="size-[18px] shrink-0" />
                <span className={cn("truncate text-[13px]", collapsed ? "hidden" : "hidden xl:inline")}>{t(item.labelKey)}</span>
            </>
        );
        const className = cn(
            "relative flex h-9 w-full shrink-0 items-center gap-3 rounded-lg px-3 text-left transition-colors",
            options?.group ? "text-stone-400 dark:text-stone-500" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/[0.06] dark:hover:text-white",
            active && !options?.group && "bg-stone-100 font-medium text-stone-950 dark:bg-white/[0.08] dark:text-white",
            collapsed && "justify-center px-0 xl:justify-start xl:px-3",
            !collapsed && "lg:justify-center lg:px-0 xl:justify-start xl:px-3",
        );

        const button = item.to ? (
            <Link to={withShellFeatureFlags(item.to, search)} aria-current={active ? "page" : undefined} className={className}>
                {content}
            </Link>
        ) : (
            <button type="button" className={className} aria-current={active ? "page" : undefined} onClick={() => item.action && runAction(item.action)}>
                {content}
            </button>
        );

        return (
            <Tooltip key={item.key} title={collapsed ? t(item.labelKey) : undefined} placement="right" mouseEnterDelay={0.2}>
                {button}
            </Tooltip>
        );
    };

    return (
        <aside
            data-libtv-sidebar
            className={cn(
                "hidden h-full shrink-0 flex-col border-r border-stone-200/80 bg-[#f7f5ef] text-stone-950 transition-[width] duration-200 lg:flex dark:border-stone-800/80 dark:bg-[#11110f] dark:text-stone-100",
                collapsed ? "w-[72px]" : "w-[72px] xl:w-[240px]",
            )}
        >
            <div className={cn("flex h-14 shrink-0 items-center gap-2 border-b border-stone-200/70 px-3 dark:border-stone-800/70", collapsed ? "justify-center xl:justify-between" : "justify-center xl:justify-between")}>
                <Link to="/" className="flex min-w-0 items-center gap-2.5 text-sm font-semibold tracking-tight" aria-label={t("meta.title")}>
                    <span
                        className="size-[18px] shrink-0 bg-current"
                        style={{
                            mask: "url(/logo.svg) center / contain no-repeat",
                            WebkitMask: "url(/logo.svg) center / contain no-repeat",
                        }}
                    />
                    <span className={cn("truncate", collapsed ? "hidden" : "hidden xl:inline")}>{t("meta.title")}</span>
                </Link>
                <button
                    type="button"
                    className="hidden size-7 shrink-0 items-center justify-center rounded-md text-stone-500 transition hover:bg-black/5 hover:text-stone-950 xl:inline-flex dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
                    onClick={() => setCollapsed((value) => !value)}
                    aria-label={t(collapsed ? "topNav.expandSidebar" : "topNav.collapseSidebar")}
                    title={t(collapsed ? "topNav.expandSidebar" : "topNav.collapseSidebar")}
                >
                    {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                </button>
            </div>

            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-3">
                <nav className="space-y-1" aria-label={t("topNav.navigation")}>
                    {shellPrimaryNavigation.map((item) => navItem(item))}
                </nav>

                <SidebarGroup title={t("topNav.createGroup")} collapsed={collapsed}>
                    {shellCreateNavigation.map((item) => navItem(item))}
                </SidebarGroup>

                <SidebarGroup title={t("topNav.tools")} collapsed={collapsed}>
                    {getShellToolNavigation().map((item) => navItem(item))}
                </SidebarGroup>
            </div>

            <div className="shrink-0 border-t border-stone-200/70 px-2 py-3 dark:border-stone-800/70">
                <div className={cn("mb-2 flex items-center gap-2 rounded-lg bg-stone-950/[0.035] px-3 py-2 text-xs text-stone-500 dark:bg-white/[0.035] dark:text-stone-400", collapsed ? "hidden xl:flex" : "hidden xl:flex")}>
                    <Sparkles className="size-3.5 shrink-0" />
                    <span className="truncate">{t("home.canvasHint")}</span>
                </div>
                <VersionReleaseModal className={cn("mx-auto mb-1 hidden cursor-pointer text-[11px] font-medium text-stone-500 transition hover:text-stone-950 xl:flex dark:text-stone-400 dark:hover:text-white", collapsed && "xl:hidden")} />
                <UserStatusActions showConfig={false} showVersion={false} className={cn("items-center justify-center gap-1", collapsed ? "flex flex-col" : "flex flex-col xl:flex-row xl:flex-wrap xl:justify-start")} />
            </div>
        </aside>
    );
}

function SidebarGroup({ title, collapsed, children }: { title: string; collapsed: boolean; children: ReactNode }) {
    return (
        <section className="mt-5">
            <p className={cn("mb-1.5 px-3 text-[11px] font-medium text-stone-400 dark:text-stone-500", collapsed ? "hidden" : "hidden xl:block")}>{title}</p>
            <div className="space-y-1">{children}</div>
        </section>
    );
}
