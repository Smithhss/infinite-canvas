import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { App } from "antd";
import { useTranslation } from "react-i18next";

import { useConfigStore } from "@/stores/use-config-store";
import { usePromptSourceScheduler } from "@/hooks/use-prompt-source-scheduler";
import { assertProviderAccess, isManagedCanvas, refreshProviderPolicy } from "@/services/api/provider-policy";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const handledConfigParams = useRef(false);
    const importChannelCredentials = useConfigStore((state) => state.importChannelCredentials);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);

    usePromptSourceScheduler();

    useEffect(() => {
        if (!isManagedCanvas()) return;
        const refresh = () => { void refreshProviderPolicy().catch(() => undefined); };
        refresh();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, []);

    useEffect(() => {
        if (handledConfigParams.current) return;
        const searchParams = new URLSearchParams(window.location.search);
        const baseUrl = searchParams.get("baseUrl") || searchParams.get("baseurl");
        const apiKey = searchParams.get("apiKey") || searchParams.get("apikey");
        if (!baseUrl && !apiKey) return;
        handledConfigParams.current = true;
        searchParams.delete("baseUrl");
        searchParams.delete("baseurl");
        searchParams.delete("apiKey");
        searchParams.delete("apikey");
        window.history.replaceState(null, "", `${window.location.pathname}${searchParams.size ? `?${searchParams}` : ""}${window.location.hash}`);
        openConfigDialog(false, "channels");
        const importCredentials = () => {
            const result = importChannelCredentials({ baseUrl, apiKey });
            if (result.status === "created") message.success(t("config.importedChannelCreated", { name: result.channelName }));
            else if (result.status === "updated") message.success(t("config.importedChannelUpdated", { name: result.channelName }));
            else if (result.status === "missing-base-url") message.error(t("config.importedChannelBaseUrlRequired"));
            else message.error(t("config.importedChannelBaseUrlInvalid"));
        };
        if (!baseUrl) {
            importCredentials();
            return;
        }
        void assertProviderAccess(baseUrl).then(importCredentials).catch((error: Error) => message.error(error.message));
    }, [importChannelCredentials, message, openConfigDialog, t]);

    return <>{children}</>;
}
