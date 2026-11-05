import { Box, GalleryVerticalEnd, Home, Images, PanelsTopLeft, Puzzle, Sparkles, type LucideIcon } from "lucide-react";

import { isFeatureEnabled } from "@/constant/feature-flags";
import { isNavigationToolEnabled, navigationTools } from "@/constant/navigation-tools";

export type ShellNavigationAction = "agent" | "plugins";

export type ShellNavigationItem = {
    key: string;
    labelKey: string;
    icon: LucideIcon;
    to?: string;
    action?: ShellNavigationAction;
    badgeKey?: string;
    exactPath?: boolean;
    exactSearch?: boolean;
};

export const shellPrimaryNavigation: ShellNavigationItem[] = [
    { key: "home", labelKey: "topNav.home", icon: Home, to: "/", exactPath: true },
    { key: "projects", labelKey: "topNav.projects", icon: GalleryVerticalEnd, to: "/canvas", exactSearch: true },
    { key: "assets", labelKey: "topNav.assets", icon: Images, to: "/assets" },
    { key: "plugins", labelKey: "topNav.plugins", icon: Puzzle, action: "plugins" },
];

export function getShellCreateNavigation(): ShellNavigationItem[] {
    return [
        { key: "new-canvas", labelKey: "topNav.infiniteCanvas", icon: PanelsTopLeft, to: "/canvas?mode=new" },
        { key: "agent", labelKey: "topNav.creativeAgent", icon: Sparkles, action: "agent", badgeKey: "topNav.beta" },
        ...(isFeatureEnabled("director3d") ? [{ key: "director-3d", labelKey: "topNav.threeDBox", icon: Box, to: "/3d-box?ff_director3d=1" }] : []),
    ];
}

const shellToolSlugs = ["image", "video", "prompts", "workflows", "config"] as const;

export function getShellToolNavigation(): ShellNavigationItem[] {
    return shellToolSlugs.flatMap((slug) => {
        const tool = navigationTools.find((item) => item.slug === slug);
        if (!tool || !isNavigationToolEnabled(tool)) return [];
        return [{ key: tool.slug, labelKey: `navigation.${tool.slug}`, icon: tool.icon, to: `/${tool.slug}` }];
    });
}

export function isShellNavigationActive(item: ShellNavigationItem, pathname: string, search = "") {
    if (item.action === "plugins") return pathname === "/plugins";
    if (item.action === "agent") return pathname === "/agent";
    if (!item.to) return false;
    const target = new URL(item.to, "http://localhost");
    const pathMatches = item.exactPath ? pathname === target.pathname : pathname === target.pathname || pathname.startsWith(`${target.pathname}/`);
    if (!pathMatches) return false;

    const actual = new URLSearchParams(search);
    if (item.exactSearch) return [...actual.keys()].every((key) => key.startsWith("ff_"));
    return [...target.searchParams.entries()].every(([key, value]) => actual.get(key) === value);
}

export function withShellFeatureFlags(to: string, search = "") {
    const target = new URL(to, "http://localhost");
    for (const [key, value] of new URLSearchParams(search)) {
        if (key.startsWith("ff_") && !target.searchParams.has(key)) target.searchParams.set(key, value);
    }
    return `${target.pathname}${target.search}${target.hash}`;
}
