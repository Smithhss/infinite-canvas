import { useState, type ReactNode } from "react";

import { AgentPanel } from "@/components/agent/agent-panel";
import { CanvasPluginManagerModal } from "@/components/canvas/canvas-plugin-manager-modal";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { isFeatureEnabled } from "@/constant/feature-flags";

export default function UserLayout({ children }: { children: ReactNode }) {
    const shellEnabled = isFeatureEnabled("libtvShell");
    const [pluginManagerOpen, setPluginManagerOpen] = useState(false);

    return (
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
            {shellEnabled ? <AppSidebar onOpenPlugins={() => setPluginManagerOpen(true)} /> : null}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <AppTopNav compact={shellEnabled} onOpenPlugins={() => setPluginManagerOpen(true)} />
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </div>
            <AgentPanel />
            <CanvasPluginManagerModal open={pluginManagerOpen} onClose={() => setPluginManagerOpen(false)} />
            <AppConfigModal />
        </div>
    );
}
