import { useEffect, useState } from "react";
import { App, Button, Form, Input, Modal, Switch, Tooltip } from "antd";
import { Brain, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { agentMemoryContextBytes, type AgentMemoryEntry } from "@/lib/agent/agent-memory";
import { canvasThemes } from "@/lib/canvas-theme";
import { useAgentMemoryStore } from "@/stores/use-agent-memory-store";
import { useAgentStore } from "@/stores/use-agent-store";
import { useThemeStore } from "@/stores/use-theme-store";

type MemoryEditor = { mode: "create" } | { mode: "edit"; entry: AgentMemoryEntry };
type MemoryFormValues = { title: string; content: string };

export function AgentMemoryView() {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { message, modal } = App.useApp();
    const connected = useAgentStore((state) => state.connected);
    const workspacePath = useAgentStore((state) => state.workspacePath);
    const entries = useAgentMemoryStore((state) => state.entries);
    const loaded = useAgentMemoryStore((state) => state.loaded);
    const loading = useAgentMemoryStore((state) => state.loading);
    const loadMemories = useAgentMemoryStore((state) => state.loadMemories);
    const createMemory = useAgentMemoryStore((state) => state.createMemory);
    const updateMemory = useAgentMemoryStore((state) => state.updateMemory);
    const removeMemory = useAgentMemoryStore((state) => state.removeMemory);
    const setMemoryEnabled = useAgentMemoryStore((state) => state.setMemoryEnabled);
    const [editor, setEditor] = useState<MemoryEditor | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm<MemoryFormValues>();
    const enabledCount = entries.filter((entry) => entry.enabled).length;
    const contextBytes = agentMemoryContextBytes(entries);

    useEffect(() => {
        if (connected && workspacePath) void loadMemories(workspacePath);
    }, [connected, loadMemories, workspacePath]);

    const openCreate = () => {
        form.resetFields();
        setEditor({ mode: "create" });
    };
    const openEdit = (entry: AgentMemoryEntry) => {
        form.setFieldsValue({ title: entry.title, content: entry.content });
        setEditor({ mode: "edit", entry });
    };
    const save = async () => {
        if (!editor) return;
        let values: MemoryFormValues;
        try {
            values = await form.validateFields();
        } catch {
            return;
        }
        setSaving(true);
        try {
            if (editor.mode === "create") await createMemory(values.title, values.content);
            else await updateMemory(editor.entry.id, values.title, values.content);
            message.success(t(editor.mode === "create" ? "agent.memory.created" : "agent.memory.updated"));
            setEditor(null);
        } catch (error) {
            message.error(memoryError(error, t));
        } finally {
            setSaving(false);
        }
    };
    const toggle = async (entry: AgentMemoryEntry, enabled: boolean) => {
        try {
            await setMemoryEnabled(entry.id, enabled);
        } catch (error) {
            message.error(memoryError(error, t));
        }
    };
    const confirmDelete = (entry: AgentMemoryEntry) => {
        modal.confirm({
            title: t("agent.memory.deleteTitle", { name: entry.title }),
            content: t("agent.memory.deleteDescription"),
            okText: t("agent.memory.delete"),
            okType: "danger",
            cancelText: t("common.cancel"),
            onOk: async () => {
                try {
                    await removeMemory(entry.id);
                    message.success(t("agent.memory.deleted"));
                } catch (error) {
                    message.error(memoryError(error, t));
                    throw error;
                }
            },
        });
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b px-4 py-3" style={{ borderColor: theme.node.stroke }}>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Brain className="size-4" />
                            {t("agent.memory.title")}
                        </div>
                        <div className="mt-0.5 text-xs leading-5" style={{ color: theme.node.muted }}>{t("agent.memory.description")}</div>
                    </div>
                    <Button type="text" className="!h-8 shrink-0 !px-2" disabled={!connected || !workspacePath} icon={<Plus className="size-4" />} onClick={openCreate}>
                        {t("agent.memory.add")}
                    </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]" style={{ color: theme.node.faint }}>
                    <span>{t("agent.memory.enabledCount", { enabled: enabledCount, total: entries.length })}</span>
                    <span>{t("agent.memory.contextSize", { size: formatBytes(contextBytes) })}</span>
                </div>
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4">
                {!connected || !workspacePath ? (
                    <MemoryEmptyState text={t("agent.memory.connectHint")} theme={theme} />
                ) : loading && !loaded ? (
                    <MemoryEmptyState text={t("agent.memory.loading")} theme={theme} />
                ) : entries.length ? (
                    <div className="divide-y" style={{ borderColor: theme.node.stroke }}>
                        {entries.map((entry) => (
                            <div key={entry.id} className={`py-3 transition-opacity ${entry.enabled ? "" : "opacity-55"}`} style={{ borderColor: theme.node.stroke }}>
                                <div className="flex items-start gap-3">
                                    <Switch
                                        size="small"
                                        checked={entry.enabled}
                                        aria-label={t(entry.enabled ? "agent.memory.disableNamed" : "agent.memory.enableNamed", { name: entry.title })}
                                        onChange={(enabled) => void toggle(entry, enabled)}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="break-words text-sm font-medium">{entry.title}</div>
                                        <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5" style={{ color: theme.node.muted }}>{entry.content}</div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5">
                                        <Tooltip title={t("agent.memory.editNamed", { name: entry.title })}>
                                            <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" aria-label={t("agent.memory.editNamed", { name: entry.title })} icon={<Pencil className="size-3.5" />} onClick={() => openEdit(entry)} />
                                        </Tooltip>
                                        <Tooltip title={t("agent.memory.deleteNamed", { name: entry.title })}>
                                            <Button danger type="text" shape="circle" className="!h-8 !w-8 !min-w-8" aria-label={t("agent.memory.deleteNamed", { name: entry.title })} icon={<Trash2 className="size-3.5" />} onClick={() => confirmDelete(entry)} />
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <MemoryEmptyState text={t("agent.memory.empty")} theme={theme} />
                )}
            </div>
            <Modal
                open={Boolean(editor)}
                title={t(editor?.mode === "edit" ? "agent.memory.editTitle" : "agent.memory.addTitle")}
                okText={t("agent.memory.save")}
                cancelText={t("common.cancel")}
                confirmLoading={saving}
                onOk={() => void save()}
                onCancel={() => setEditor(null)}
                afterClose={() => form.resetFields()}
            >
                <Form form={form} layout="vertical" className="pt-2" requiredMark={false}>
                    <Form.Item name="title" label={t("agent.memory.titleLabel")} rules={[{ required: true, whitespace: true, message: t("agent.memory.titleRequired") }]}>
                        <Input autoComplete="off" placeholder={t("agent.memory.titlePlaceholder")} />
                    </Form.Item>
                    <Form.Item name="content" label={t("agent.memory.contentLabel")} extra={t("agent.memory.contentExtra")} rules={[{ required: true, whitespace: true, message: t("agent.memory.contentRequired") }]}>
                        <Input.TextArea autoSize={{ minRows: 5, maxRows: 12 }} placeholder={t("agent.memory.contentPlaceholder")} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

function MemoryEmptyState({ text, theme }: { text: string; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid size-10 place-items-center rounded-full border" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                <Brain className="size-4" />
            </span>
            <div className="max-w-xs text-xs leading-5" style={{ color: theme.node.muted }}>{text}</div>
        </div>
    );
}

function memoryError(error: unknown, t: (key: string) => string) {
    const text = error instanceof Error ? error.message : "";
    if (text.includes("256KiB")) return t("agent.memory.tooLarge");
    return text || t("agent.memory.saveFailed");
}

function formatBytes(bytes: number) {
    return bytes >= 1024 ? `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)}KiB` : `${bytes}B`;
}
