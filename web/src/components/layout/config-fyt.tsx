import { App, Button, Input, Tag } from "antd";
import { KeyRound, PlugZap, Trash2, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchImageModels } from "@/services/api/image";
import type { AiConfig } from "@/stores/use-config-store";

type FytConnectionInput = {
    baseUrl: string;
    apiKey: string;
    models: string[];
};

export function ConfigFyt({ config, onSave, onClearKey }: { config: AiConfig; onSave: (input: FytConnectionInput) => Promise<void> | void; onClearKey: (baseUrl: string) => void }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const [baseUrl, setBaseUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [models, setModels] = useState<string[] | null>(null);
    const [loading, setLoading] = useState(false);
    const existingChannel = useMemo(() => config.channels.find((channel) => sameBaseUrl(channel.baseUrl, baseUrl)), [config.channels, baseUrl]);

    useEffect(() => {
        if (baseUrl || apiKey) return;
        const channel = config.channels.find((item) => /(^|[.-])(fyt|foyton)/i.test(`${item.name} ${item.baseUrl}`));
        if (!channel) return;
        setBaseUrl(channel.baseUrl);
        setApiKey(channel.apiKey);
    }, [apiKey, baseUrl, config.channels]);

    const loadModels = async () => {
        if (!isHttpBaseUrl(baseUrl)) throw new Error(t("config.fyt.baseUrlInvalid"));
        if (!apiKey.trim()) throw new Error(t("config.fyt.apiKeyRequired"));
        const result = await fetchImageModels({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), apiFormat: "openai" });
        if (!result.length) throw new Error(t("config.fyt.noModels"));
        setModels(result);
        return result;
    };

    const testConnection = async () => {
        setLoading(true);
        try {
            const result = await loadModels();
            message.success(t("config.fyt.connected", { count: result.length }));
        } catch (error) {
            setModels(null);
            message.error(error instanceof Error ? error.message : t("config.fyt.testFailed"));
        } finally {
            setLoading(false);
        }
    };

    const saveConnection = async () => {
        setLoading(true);
        try {
            const result = await loadModels();
            await onSave({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), models: result });
            message.success(t("config.fyt.saved", { count: result.length }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.fyt.saveFailed"));
        } finally {
            setLoading(false);
        }
    };

    const clearKey = () => {
        onClearKey(baseUrl);
        setApiKey("");
    };

    return (
        <section className="mb-4 rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-900/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <PlugZap className="size-4" />
                        {t("config.fyt.title")}
                    </div>
                    <div className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">{t("config.fyt.description")}</div>
                </div>
                <Tag className="m-0">{t("config.fyt.usageHint")}</Tag>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-xs font-medium">{t("config.fyt.baseUrl")}</span>
                    <Input
                        value={baseUrl}
                        placeholder="https://your-fyt-domain.com"
                        onChange={(event) => {
                            setBaseUrl(event.target.value);
                            setModels(null);
                        }}
                    />
                    <span className="mt-1 block text-[11px] text-stone-500">{t("config.fyt.baseUrlDescription")}</span>
                </label>
                <label className="block">
                    <span className="mb-1 block text-xs font-medium">API Key</span>
                    <Input.Password
                        value={apiKey}
                        autoComplete="off"
                        prefix={<KeyRound className="size-3.5 text-stone-400" />}
                        placeholder="sk-..."
                        onChange={(event) => {
                            setApiKey(event.target.value);
                            setModels(null);
                        }}
                    />
                    <span className="mt-1 block text-[11px] text-stone-500">{t("config.fyt.keySecurity")}</span>
                </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button icon={<Wifi className="size-4" />} loading={loading} onClick={() => void testConnection()}>
                    {t("config.fyt.test")}
                </Button>
                <Button type="primary" icon={<PlugZap className="size-4" />} loading={loading} onClick={() => void saveConnection()}>
                    {t("config.fyt.save")}
                </Button>
                <Button danger type="text" icon={<Trash2 className="size-4" />} disabled={!existingChannel?.apiKey} onClick={clearKey}>
                    {t("config.fyt.clearKey")}
                </Button>
                {models ? <span className="text-xs text-stone-500">{t("config.fyt.modelsFound", { count: models.length })}</span> : null}
            </div>
            {models?.length ? <div className="mt-2 truncate text-xs text-stone-500" title={models.join(", ")}>{models.join(", ")}</div> : null}
        </section>
    );
}

function isHttpBaseUrl(value: string) {
    try {
        const url = new URL(value.trim());
        return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
    } catch {
        return false;
    }
}

function sameBaseUrl(left: string, right: string) {
    return normalizeBaseUrl(left) === normalizeBaseUrl(right);
}

function normalizeBaseUrl(value: string) {
    return value.trim().replace(/\/+$/, "").replace(/\/v1$/i, "").toLowerCase();
}
