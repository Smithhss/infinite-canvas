import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AgentPanel } from "@/components/agent/agent-panel";
import { CanvasPluginManagerModal } from "@/components/canvas/canvas-plugin-manager-modal";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { withShellFeatureFlags } from "@/components/layout/navigation-groups";

export default function UserLayout({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const { search } = useLocation();
    const shellEnabled = isFeatureEnabled("libtvShell");
    const pluginHubEnabled = isFeatureEnabled("pluginHub");
    const [pluginManagerOpen, setPluginManagerOpen] = useState(false);
    const openPlugins = () => {
        if (pluginHubEnabled) navigate(withShellFeatureFlags("/plugins", search));
        else setPluginManagerOpen(true);
    };

    return (
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
            {shellEnabled ? <AppSidebar onOpenPlugins={openPlugins} /> : null}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <AppTopNav compact={shellEnabled} onOpenPlugins={openPlugins} />
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
            <AgentPanel />
            <CanvasPluginManagerModal open={pluginManagerOpen} onClose={() => setPluginManagerOpen(false)} />
            <AppConfigModal />
        </div>
    );
}
