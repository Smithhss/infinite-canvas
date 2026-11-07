import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AgentPanel } from "@/components/agent/agent-panel";
import { CanvasPluginManagerModal } from "@/components/canvas/canvas-plugin-manager-modal";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { ShellNoticeBar } from "@/components/layout/shell-notice-bar";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { withShellFeatureFlags } from "@/components/layout/navigation-groups";
import { useKeepFocusedFieldVisible } from "@/hooks/use-keep-focused-field-visible";

export default function UserLayout({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    const shellEnabled = isFeatureEnabled("libtvShell");
    const showShellNotice = shellEnabled && pathname === "/";
    const pluginHubEnabled = isFeatureEnabled("pluginHub");
    const [pluginManagerOpen, setPluginManagerOpen] = useState(false);
    useKeepFocusedFieldVisible();
    const openPlugins = () => {
        if (pluginHubEnabled) navigate(withShellFeatureFlags("/plugins", search));
        else setPluginManagerOpen(true);
    };

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            {showShellNotice ? <ShellNoticeBar /> : null}
            <div className="flex min-h-0 flex-1 overflow-hidden">
                {shellEnabled ? <AppSidebar onOpenPlugins={openPlugins} /> : null}
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <AppTopNav compact={shellEnabled} onOpenPlugins={openPlugins} />
                    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
                </div>
                <AgentPanel />
            </div>
            <CanvasPluginManagerModal open={pluginManagerOpen} onClose={() => setPluginManagerOpen(false)} />
            <AppConfigModal />
        </div>
    );
}
