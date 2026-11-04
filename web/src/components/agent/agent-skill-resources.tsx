import { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Modal, Tooltip } from "antd";
import { FileText, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { createCodexSkillResource, deleteCodexSkillResource, fetchCodexSkillResource, fetchCodexSkillResources, updateCodexSkillResource, type AgentSkillResourceDetail, type AgentSkillResourceSummary } from "@/services/api/canvas-agent";
import { useThemeStore } from "@/stores/use-theme-store";

type ResourceEditor = { mode: "create"; path: string; content: string } | { mode: "edit"; detail: AgentSkillResourceDetail };

export function AgentSkillResources({ endpoint, token, skillName }: { endpoint: string; token: string; skillName: string }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { message, modal } = App.useApp();
    const [resources, setResources] = useState<AgentSkillResourceSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [busyPath, setBusyPath] = useState("");
    const [editor, setEditor] = useState<ResourceEditor | null>(null);
    const [saving, setSaving] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetchCodexSkillResources(endpoint, token, skillName);
            setResources(response.data || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("agent.skillManager.resourceLoadFailed"));
        } finally {
            setLoading(false);
        }
    }, [endpoint, message, skillName, t, token]);

    useEffect(() => {
        setEditor(null);
        setResources([]);
        void refresh();
    }, [refresh]);

    const openEdit = async (resource: AgentSkillResourceSummary) => {
        setBusyPath(resource.path);
        try {
            const response = await fetchCodexSkillResource(endpoint, token, skillName, resource.path);
            if (!response.data) throw new Error(t("agent.skillManager.resourceMissing"));
            setEditor({ mode: "edit", detail: response.data });
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("agent.skillManager.resourceReadFailed"));
        } finally {
            setBusyPath("");
        }
    };

    const save = async () => {
        if (!editor || !editor.mode) return;
        const path = editor.mode === "create" ? editor.path.trim() : editor.detail.path;
        const content = editor.mode === "create" ? editor.content : editor.detail.content;
        if (!path) {
            message.warning(t("agent.skillManager.resourcePathRequired"));
            return;
        }
        setSaving(true);
        try {
            if (editor.mode === "create") {
                await createCodexSkillResource(endpoint, token, skillName, { path, content });
            } else {
                await updateCodexSkillResource(endpoint, token, skillName, { path, content, expectedRevision: editor.detail.revision });
            }
            message.success(t(editor.mode === "create" ? "agent.skillManager.resourceCreated" : "agent.skillManager.resourceUpdated"));
            setEditor(null);
            await refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("agent.skillManager.resourceSaveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const remove = (resource: AgentSkillResourceSummary) => {
        modal.confirm({
            title: t("agent.skillManager.resourceDeleteTitle", { path: resource.path }),
            content: t("agent.skillManager.resourceDeleteDescription"),
            okText: t("common.delete"),
            okType: "danger",
            cancelText: t("common.cancel"),
            onOk: async () => {
                setBusyPath(resource.path);
                try {
                    await deleteCodexSkillResource(endpoint, token, skillName, resource.path, resource.revision);
                    await refresh();
                    message.success(t("agent.skillManager.resourceDeleted"));
                } catch (error) {
                    message.error(error instanceof Error ? error.message : t("agent.skillManager.resourceDeleteFailed"));
                    throw error;
                } finally {
                    setBusyPath("");
                }
            },
        });
    };

    return (
        <div className="mt-5 border-t pt-4" style={{ borderColor: theme.node.stroke }}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-medium">{t("agent.skillManager.resources")}</div>
                    <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>{t("agent.skillManager.resourcesHint")}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Tooltip title={t("agent.skillManager.resourceReload")}>
                        <Button type="text" shape="circle" size="small" aria-label={t("agent.skillManager.resourceReload")} disabled={loading} icon={<RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />} onClick={() => void refresh()} />
                    </Tooltip>
                    <Button type="text" size="small" icon={<Plus className="size-3.5" />} onClick={() => setEditor({ mode: "create", path: "", content: "" })}>{t("agent.skillManager.resourceAdd")}</Button>
                </div>
            </div>
            {loading && !resources.length ? (
                <div className="flex h-16 items-center justify-center gap-2 text-xs" style={{ color: theme.node.muted }}><LoaderCircle className="size-3.5 animate-spin" />{t("agent.skillManager.resourceLoading")}</div>
            ) : resources.length ? (
                <div className="mt-3 divide-y rounded-md border" style={{ borderColor: theme.node.stroke }}>
                    {resources.map((resource) => (
                        <div key={resource.path} className="flex items-center gap-2 px-3 py-2" style={{ borderColor: theme.node.stroke }}>
                            <FileText className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-mono text-xs">{resource.path}</div>
                                <div className="mt-0.5 text-[11px]" style={{ color: theme.node.faint }}>{formatBytes(resource.size)}</div>
                            </div>
                            <Tooltip title={t("common.edit")}>
                                <Button type="text" shape="circle" size="small" aria-label={t("agent.skillManager.resourceEdit", { path: resource.path })} disabled={Boolean(busyPath)} icon={busyPath === resource.path ? <LoaderCircle className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />} onClick={() => void openEdit(resource)} />
                            </Tooltip>
                            <Tooltip title={t("common.delete")}>
                                <Button danger type="text" shape="circle" size="small" aria-label={t("agent.skillManager.resourceDelete", { path: resource.path })} disabled={Boolean(busyPath)} icon={<Trash2 className="size-3.5" />} onClick={() => remove(resource)} />
                            </Tooltip>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mt-3 rounded-md border border-dashed px-3 py-4 text-center text-xs" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>{t("agent.skillManager.resourceEmpty")}</div>
            )}
            <Modal
                title={editor?.mode === "edit" ? t("agent.skillManager.resourceEditTitle", { path: editor.detail.path }) : t("agent.skillManager.resourceAdd")}
                open={Boolean(editor)}
                okText={t("agent.skillManager.resourceSave")}
                cancelText={t("common.cancel")}
                confirmLoading={saving}
                width={620}
                destroyOnHidden
                onCancel={() => {
                    if (!saving) setEditor(null);
                }}
                onOk={() => void save()}
            >
                {editor?.mode === "create" ? (
                    <Input className="mb-3 font-mono" value={editor.path} placeholder="references/example.md" aria-label={t("agent.skillManager.resourcePath")} onChange={(event) => setEditor({ ...editor, path: event.target.value })} />
                ) : null}
                {editor ? (
                    <Input.TextArea
                        className="!font-mono !leading-5"
                        aria-label={t("agent.skillManager.resourceContent")}
                        value={editor.mode === "edit" ? editor.detail.content : editor.content}
                        autoSize={{ minRows: 10, maxRows: 20 }}
                        onChange={(event) => setEditor(editor.mode === "edit" ? { ...editor, detail: { ...editor.detail, content: event.target.value } } : { ...editor, content: event.target.value })}
                    />
                ) : null}
                <div className="mt-2 text-xs" style={{ color: theme.node.muted }}>{t("agent.skillManager.resourceLimit")}</div>
            </Modal>
        </div>
    );
}

function formatBytes(size: number) {
    return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KiB`;
}
