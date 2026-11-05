import { useState } from "react";
import { App, Button, Input, Modal } from "antd";
import { Download, GitBranch, LoaderCircle, Search, ShieldAlert, Sparkles, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { installRemoteSkill, previewRemoteSkill, searchRemoteSkills, type AgentRemoteSkillPreview, type AgentRemoteSkillSearchResult } from "@/services/api/canvas-agent";
import { useAgentStore } from "@/stores/use-agent-store";
import { useThemeStore } from "@/stores/use-theme-store";

export function AgentSkillInstallModal({ open, onClose, onInstalled }: { open: boolean; onClose: () => void; onInstalled: () => Promise<void> }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const connected = useAgentStore((state) => state.connected);
    const endpoint = useAgentStore((state) => state.url.trim().replace(/\/$/, ""));
    const token = useAgentStore((state) => state.token);
    const [query, setQuery] = useState("");
    const [url, setUrl] = useState("");
    const [results, setResults] = useState<AgentRemoteSkillSearchResult[]>([]);
    const [preview, setPreview] = useState<AgentRemoteSkillPreview | null>(null);
    const [previewSource, setPreviewSource] = useState("");
    const [searched, setSearched] = useState(false);
    const [searching, setSearching] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [previewError, setPreviewError] = useState("");
    const busy = searching || previewing || installing;
    const connectionIsCurrent = () => {
        const agent = useAgentStore.getState();
        return agent.connected && agent.url.trim().replace(/\/$/, "") === endpoint && agent.token === token;
    };
    const close = () => {
        if (busy) return;
        onClose();
    };
    const search = async () => {
        if (!connected || searching || query.trim().length < 2) return;
        setSearching(true);
        setSearched(true);
        setSearchError("");
        try {
            const response = await searchRemoteSkills(endpoint, token, query.trim());
            if (!connectionIsCurrent()) return;
            setResults(response.data || []);
        } catch (error) {
            if (connectionIsCurrent()) setSearchError(error instanceof Error ? error.message : t("agent.skillManager.searchFailed"));
        } finally {
            if (connectionIsCurrent()) setSearching(false);
        }
    };
    const loadPreview = async (source = url) => {
        if (!connected || previewing || installing || !source.trim()) return;
        setUrl(source.trim());
        setPreviewSource(source.trim());
        setPreviewing(true);
        setPreviewError("");
        setPreview(null);
        try {
            const response = await previewRemoteSkill(endpoint, token, source.trim());
            if (!connectionIsCurrent()) return;
            if (!response.data) throw new Error(t("agent.skillManager.previewFailed"));
            setPreview(response.data);
        } catch (error) {
            if (connectionIsCurrent()) setPreviewError(error instanceof Error ? error.message : t("agent.skillManager.previewFailed"));
        } finally {
            if (connectionIsCurrent()) setPreviewing(false);
        }
    };
    const install = async () => {
        if (!preview || !connected || installing) return;
        setInstalling(true);
        setPreviewError("");
        try {
            await installRemoteSkill(endpoint, token, previewSource, preview.contentHash);
            if (!connectionIsCurrent()) return;
            await onInstalled();
            if (!connectionIsCurrent()) return;
            message.success(t("agent.skillManager.installed"));
            setQuery("");
            setUrl("");
            setResults([]);
            setPreview(null);
            setPreviewSource("");
            setSearched(false);
            onClose();
        } catch (error) {
            if (connectionIsCurrent()) setPreviewError(error instanceof Error ? error.message : t("agent.skillManager.installFailed"));
        } finally {
            if (connectionIsCurrent()) setInstalling(false);
        }
    };

    return (
        <Modal open={open} title={t("agent.skillManager.installTitle")} footer={null} width={760} centered destroyOnHidden maskClosable={!busy} onCancel={close}>
            <p className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>{t("agent.skillManager.installDescription")}</p>
            <div className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{t("agent.skillManager.installWarning")}</span>
            </div>
            <div className="mt-5 flex gap-2">
                <Input
                    className="!h-10 sm:!h-8"
                    value={query}
                    maxLength={80}
                    allowClear
                    disabled={!connected || busy}
                    prefix={<GitBranch className="size-3.5" />}
                    placeholder={t("agent.skillManager.searchGithubPlaceholder")}
                    onChange={(event) => setQuery(event.target.value)}
                    onPressEnter={() => void search()}
                />
                <Button className="shrink-0 !h-10 sm:!h-8" icon={<Search className="size-3.5" />} loading={searching} disabled={!connected || query.trim().length < 2 || previewing || installing} onClick={() => void search()}>{t("agent.skillManager.searchGithub")}</Button>
            </div>
            {searchError ? <div className="mt-2 text-xs text-rose-500">{searchError}</div> : null}
            {results.length ? (
                <div className="thin-scrollbar mt-3 max-h-52 space-y-2 overflow-y-auto">
                    {results.map((result) => (
                        <div key={result.repository} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: theme.node.stroke }}>
                            <GitBranch className="size-4 shrink-0" style={{ color: theme.node.muted }} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{result.repository}</div>
                                <div className="mt-0.5 line-clamp-2 text-xs leading-5" style={{ color: theme.node.muted }}>{result.description || t("agent.skillManager.noDescription")}</div>
                            </div>
                            <span className="flex shrink-0 items-center gap-1 text-xs" style={{ color: theme.node.faint }}><Star className="size-3" />{result.stars}</span>
                            <Button size="small" className="shrink-0 !h-10 sm:!h-8" disabled={busy} onClick={() => void loadPreview(result.url)}>{t("agent.skillManager.preview")}</Button>
                        </div>
                    ))}
                </div>
            ) : searching ? null : searchError ? null : searched ? <div className="mt-3 text-xs" style={{ color: theme.node.muted }}>{t("agent.skillManager.searchEmpty")}</div> : null}
            <div className="my-5 border-t" style={{ borderColor: theme.node.stroke }} />
            <div className="flex gap-2">
                <Input className="!h-10 sm:!h-8" value={url} maxLength={2048} allowClear disabled={!connected || busy} placeholder={t("agent.skillManager.urlPlaceholder")} onChange={(event) => { setUrl(event.target.value); setPreview(null); setPreviewSource(""); setPreviewError(""); }} onPressEnter={() => void loadPreview()} />
                <Button className="shrink-0 !h-10 sm:!h-8" loading={previewing} disabled={!connected || !url.trim() || searching || installing} onClick={() => void loadPreview()}>{t("agent.skillManager.preview")}</Button>
            </div>
            {previewError ? <div className="mt-2 text-xs text-rose-500">{previewError}</div> : null}
            {previewing ? <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: theme.node.muted }}><LoaderCircle className="size-4 animate-spin" />{t("agent.skillManager.previewing")}</div> : null}
            {preview ? (
                <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: theme.node.stroke }}><Sparkles className="size-4" /></span>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{preview.name}</div>
                            <div className="mt-1 break-all text-xs" style={{ color: theme.node.muted }}>{preview.repository} · {preview.path}</div>
                        </div>
                        <Button type="primary" className="shrink-0 !h-10 sm:!h-8" icon={<Download className="size-3.5" />} loading={installing} disabled={searching || previewing} onClick={() => void install()}>{t("agent.skillManager.install")}</Button>
                    </div>
                    <p className="mt-3 text-xs leading-5" style={{ color: theme.node.muted }}>{preview.description}</p>
                    <div className="mt-3 text-xs font-medium">{t("agent.skillManager.instructionsPreview")}</div>
                    <pre className="thin-scrollbar mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-xl border p-3 font-mono text-[11px] leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>{preview.instructions}</pre>
                </div>
            ) : null}
        </Modal>
    );
}
