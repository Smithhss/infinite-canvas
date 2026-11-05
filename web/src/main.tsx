import React from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";
import "streamdown/styles.css";
import "./styles/globals.css";

import { initializeStorageNamespace } from "@/services/storage-namespace-migration";

async function bootstrap() {
    const storage = await initializeStorageNamespace();
    if (storage.status === "legacy-fallback") console.warn("[storage] 新命名空间迁移未完成，继续使用旧数据", storage.reason);

    const [{ RouterProvider }, { AppProviders }, { initAnalytics }, { router }] = await Promise.all([
        import("react-router-dom"),
        import("@/components/layout/app-providers"),
        import("@/lib/analytics"),
        import("@/router"),
        import("@/i18n"),
    ]);

    initAnalytics();
    document.body.style.fontFamily = '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';

    createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
            <AppProviders>
                <RouterProvider router={router} />
            </AppProviders>
        </React.StrictMode>,
    );
}

void bootstrap();
