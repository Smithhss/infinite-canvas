import { Bot, Box, ChevronDown, Menu, Puzzle, Sparkles, SquareDashed } from "lucide-react";
import { Button, Dropdown, Tooltip } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { isNavigationToolEnabled, navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { withShellFeatureFlags } from "@/components/layout/navigation-groups";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/stores/use-agent-store";

export function AppTopNav({ compact = false, onOpenPlugins }: { compact?: boolean; onOpenPlugins: () => void }) {
    const { t } = useTranslation();
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [createMenuOpen, setCreateMenuOpen] = useState(false);
    const autoConnectRef = useRef(false);
    const agentToken = useAgentStore((state) => state.token);
    const agentEnabled = useAgentStore((state) => state.enabled);
    const agentConnected = useAgentStore((state) => state.connected);
    const connectAgent = useAgentStore((state) => state.connectAgent);
    const togglePanel = useAgentStore((state) => state.togglePanel);
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const agentSkillHubEnabled = isFeatureEnabled("agentSkillHub");
    const threeDBoxEnabled = isFeatureEnabled("director3d");
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;
    const generalTools = navigationTools.filter((tool) => isNavigationToolEnabled(tool) && tool.slug !== "canvas");
    const createActive = slug === "canvas" || slug === "agent" || slug === "3d-box" || panelOpen;
    const createItems = [
        { key: "canvas", icon: <SquareDashed className="size-4" />, label: t("navigation.canvas") },
        { key: "agent", icon: <Bot className="size-4" />, label: t("topNav.creativeAgent") },
        ...(threeDBoxEnabled ? [{ key: "director-3d", icon: <Box className="size-4" />, label: t("topNav.threeDBox") }] : []),
    ];

    const handleCreateMenuClick = ({ key }: { key: string }) => {
        setCreateMenuOpen(false);
        if (key === "canvas") navigate(withShellFeatureFlags("/canvas", search));
        if (key === "director-3d") navigate(withShellFeatureFlags("/3d-box?ff_director3d=1", search));
        if (key === "agent") {
            if (agentSkillHubEnabled) navigate(withShellFeatureFlags("/agent", search));
            else togglePanel();
        }
    };
    const handleOpenAgent = () => {
        if (agentSkillHubEnabled) navigate(withShellFeatureFlags("/agent", search));
        else togglePanel();
    };

    useEffect(() => {
        if (autoConnectRef.current || agentEnabled || agentConnected || !agentToken.trim()) return;
        autoConnectRef.current = true;
        connectAgent({ silent: true });
    }, [agentConnected, agentEnabled, agentToken, connectAgent]);

    return (
        <>
            {!hideHeader ? (
                <header className={cn("sticky top-0 z-20 h-16 shrink-0 border-b border-stone-200/80 bg-background/85 backdrop-blur-xl dark:border-stone-800/80", compact && "lg:hidden")}>
                    <div className="mx-auto flex h-full max-w-[1480px] items-stretch justify-between gap-5 px-5 lg:px-7">
                        <div className="flex min-w-0 items-center">
                            <Link to="/" className="flex h-full shrink-0 items-center gap-2.5 text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:opacity-65 dark:text-stone-100">
                                <span
                                    className="size-[18px] shrink-0 bg-current"
                                    style={{
                                        mask: "url(/logo.svg) center / contain no-repeat",
                                        WebkitMask: "url(/logo.svg) center / contain no-repeat",
                                    }}
                                />
                                <span className="text-[15px] font-semibold">{t("meta.title")}</span>
                            </Link>

                            <span className="mx-5 h-5 w-px shrink-0 bg-stone-200 dark:bg-stone-800" />

                            <button
                                type="button"
                                className={cn(
                                    "-ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-stone-600 transition hover:bg-black/5 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-white/10 dark:hover:text-white",
                                    compact ? "lg:hidden" : "md:hidden",
                                )}
                                onClick={() => setMobileNavOpen(true)}
                                aria-label={t("topNav.openMenu")}
                                title={t("topNav.menu")}
                            >
                                <Menu className="size-5" />
                            </button>

                            <nav className={cn("hide-scrollbar h-16 min-w-0 items-center gap-1 overflow-x-auto", compact ? "hidden" : "hidden md:flex")}>
                                <Dropdown open={createMenuOpen} onOpenChange={setCreateMenuOpen} menu={{ items: createItems, onClick: handleCreateMenuClick }} trigger={["click"]}>
                                    <button
                                        type="button"
                                        className={cn(
                                            "relative flex h-16 shrink-0 items-center gap-2 px-3 text-[13px] leading-5 transition after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:transition-colors",
                                            createActive
                                                ? "font-semibold text-stone-950 after:bg-stone-950 dark:text-stone-100 dark:after:bg-stone-100"
                                                : "font-medium text-stone-500 after:bg-transparent hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                        )}
                                    >
                                        <Sparkles className={cn("size-4 transition-colors", createActive ? "opacity-100" : "opacity-70")} />
                                        <span className="truncate">{t("topNav.createGroup")}</span>
                                        <ChevronDown className="size-3 opacity-45" />
                                    </button>
                                </Dropdown>
                                <button
                                    type="button"
                                    className="relative flex h-16 shrink-0 items-center gap-2 px-3 text-[13px] font-medium leading-5 text-stone-500 transition after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100"
                                    onClick={() => {
                                        setCreateMenuOpen(false);
                                        onOpenPlugins();
                                    }}
                                >
                                    <Puzzle className="size-4 opacity-70" />
                                    <span className="truncate">{t("topNav.plugins")}</span>
                                </button>
                                {generalTools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            to={`/${tool.slug}`}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "relative flex h-16 shrink-0 items-center gap-2 px-3 text-[13px] leading-5 transition after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:transition-colors",
                                                active
                                                    ? "font-semibold text-stone-950 after:bg-stone-950 dark:text-stone-100 dark:after:bg-stone-100"
                                                    : "font-medium text-stone-500 after:bg-transparent hover:text-stone-950 dark:text-stone-400 dark:hover:text-stone-100",
                                            )}
                                        >
                                            <Icon className={cn("size-4 transition-colors", active ? "opacity-100" : "opacity-70")} />
                                            <span className="truncate">{t(`navigation.${tool.slug}`)}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="my-auto flex h-9 min-w-0 items-center justify-end gap-1.5 justify-self-end whitespace-nowrap">
                            <Tooltip title={t(!agentSkillHubEnabled && panelOpen ? "topNav.closeAgent" : "topNav.openAgent")}>
                                <Button
                                    type="text"
                                    shape="circle"
                                    className="!h-8 !w-8 !min-w-8 !text-stone-600 hover:!text-stone-950 dark:!text-stone-300 dark:hover:!text-white"
                                    icon={<Bot className="size-4" />}
                                    onClick={handleOpenAgent}
                                    aria-label={t(!agentSkillHubEnabled && panelOpen ? "topNav.closeAgent" : "topNav.openAgent")}
                                />
                            </Tooltip>
                            <span className="mx-1 hidden h-4 w-px shrink-0 bg-stone-200 sm:block dark:bg-stone-800" />
                            <div className="hidden sm:flex">
                                <UserStatusActions showConfig={false} />
                            </div>
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer
                open={mobileNavOpen}
                compact={compact}
                onClose={() => setMobileNavOpen(false)}
                onOpenAgent={() => {
                    setMobileNavOpen(false);
                    if (agentSkillHubEnabled) navigate(withShellFeatureFlags("/agent", search));
                    else togglePanel();
                }}
                onOpenPlugins={() => {
                    setMobileNavOpen(false);
                    onOpenPlugins();
                }}
            />
        </>
    );
}
