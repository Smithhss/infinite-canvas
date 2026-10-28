import { Button, Drawer, Input, InputNumber, Modal, Segmented, Select, Space, Switch } from "antd";
import { ListPlus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { resolveVideoCapabilities, VIDEO_MODES, type VideoModelCapabilities, type VideoModelMode } from "@/lib/video-model-capabilities";
import { defaultBaseUrlForApiFormat, guessCapability, normalizeChannelModels, type ApiCallFormat, type ChannelModel, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";
import { ModelScriptEditor } from "./model-script-editor";
import { ModelSelectModal } from "./model-select-modal";

type ScriptTarget = { name: string; capability: ModelCapability; value: string };

export function ChannelEditorDrawer({ open, channel, onSave, onClose }: { open: boolean; channel: ModelChannel | null; onSave: (channel: ModelChannel) => void; onClose: () => void }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<ModelChannel | null>(channel);
    const [selectOpen, setSelectOpen] = useState(false);
    const [scriptTarget, setScriptTarget] = useState<ScriptTarget | null>(null);
    const [capabilityTarget, setCapabilityTarget] = useState<string | null>(null);
    const apiFormatOptions: Array<{ label: string; value: ApiCallFormat }> = [
        { label: "OpenAI", value: "openai" },
        { label: "Gemini", value: "gemini" },
    ];
    const capabilityOptions: Array<{ label: string; value: ModelCapability }> = ["image", "video", "text", "audio"].map((value) => ({ label: t(`config.channelEditor.capabilities.${value}`), value: value as ModelCapability }));

    useEffect(() => {
        if (open && channel) setDraft(channel);
    }, [open, channel]);

    if (!draft) return null;

    const patch = (value: Partial<ModelChannel>) => setDraft((current) => (current ? { ...current, ...value } : current));
    const setModels = (models: ChannelModel[]) => patch({ models });

    const changeApiFormat = (apiFormat: ApiCallFormat) => {
        const baseUrl = !draft.baseUrl.trim() || draft.baseUrl.trim() === defaultBaseUrlForApiFormat(draft.apiFormat) ? defaultBaseUrlForApiFormat(apiFormat) : draft.baseUrl;
        patch({ apiFormat, baseUrl });
    };

    const applySelection = (names: string[]) => {
        const map = new Map(draft.models.map((model) => [model.name, model]));
        setModels(names.map((name) => map.get(name) || { name, capability: guessCapability(name) }));
    };

    const setCapability = (name: string, capability: ModelCapability) => setModels(draft.models.map((model) => (model.name === name ? { ...model, capability } : model)));
    const setScript = (name: string, script: string) => setModels(draft.models.map((model) => (model.name === name ? { ...model, script: script || undefined } : model)));
    const setVideoCapabilities = (name: string, videoCapabilities: ModelChannel["models"][number]["videoCapabilities"]) => setModels(draft.models.map((model) => (model.name === name ? { ...model, videoCapabilities } : model)));
    const removeModel = (name: string) => setModels(draft.models.filter((model) => model.name !== name));

    const save = () => {
        onSave({ ...draft, name: draft.name.trim() || t("config.channels.unnamed"), models: normalizeChannelModels(draft.models) });
        onClose();
    };

    return (
        <Drawer
            open={open}
            size={640}
            title={t("config.channelEditor.title")}
            onClose={onClose}
            styles={{ body: { paddingTop: 16 } }}
            extra={
                <Space>
                    <Button onClick={onClose}>{t("common.cancel")}</Button>
                    <Button type="primary" onClick={save}>
                        {t("common.save")}
                    </Button>
                </Space>
            }
        >
            <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.name")}</span>
                    <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.protocol")}</span>
                    <Select className="w-full" value={draft.apiFormat} options={apiFormatOptions} onChange={changeApiFormat} />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.baseUrl")}</span>
                    <Input value={draft.baseUrl} onChange={(event) => patch({ baseUrl: event.target.value })} placeholder="https://api.example.com" />
                </label>
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">API Key</span>
                    <Input.Password value={draft.apiKey} onChange={(event) => patch({ apiKey: event.target.value })} placeholder="sk-..." />
                </label>
            </div>

            <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-sm font-semibold">{t("config.channelEditor.models")}</div>
                    <div className="mt-0.5 text-xs text-stone-500">{t("config.channelEditor.modelDescription", { count: draft.models.length })}</div>
                </div>
                <Button type="primary" icon={<ListPlus className="size-4" />} onClick={() => setSelectOpen(true)}>
                    {t("config.channelEditor.selectModels")}
                </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-stone-200 p-2 dark:border-stone-800">
                {draft.models.length ? (
                    draft.models.map((model) => (
                        <div key={model.name} className="flex flex-wrap items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-900/40">
                            <span className="min-w-0 flex-1 truncate text-sm" title={model.name}>
                                {model.name}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                                <Segmented size="small" value={model.capability} options={capabilityOptions} onChange={(value) => setCapability(model.name, value as ModelCapability)} />
                                {model.capability === "video" ? (
                                    <Button size="small" type={model.videoCapabilities ? "primary" : "default"} ghost={Boolean(model.videoCapabilities)} icon={<SlidersHorizontal className="size-3.5" />} onClick={() => setCapabilityTarget(model.name)}>
                                        {t(model.videoCapabilities ? "config.channelEditor.videoCapabilitiesReady" : "config.channelEditor.videoCapabilities")}
                                    </Button>
                                ) : null}
                                <Button size="small" type={model.script ? "primary" : "default"} ghost={Boolean(model.script)} onClick={() => setScriptTarget({ name: model.name, capability: model.capability, value: model.script || "" })}>
                                    {t(model.script ? "config.channelEditor.scriptReady" : "config.channelEditor.script")}
                                </Button>
                                <Button size="small" danger type="text" icon={<Trash2 className="size-3.5" />} onClick={() => removeModel(model.name)} />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="px-2 py-8 text-center text-sm text-stone-500">{t("config.channelEditor.empty")}</div>
                )}
            </div>

            <ModelSelectModal open={selectOpen} channel={draft} selectedNames={draft.models.map((model) => model.name)} onConfirm={applySelection} onClose={() => setSelectOpen(false)} />

            <ModelScriptEditor
                open={Boolean(scriptTarget)}
                capability={scriptTarget?.capability || "text"}
                modelName={scriptTarget?.name || ""}
                value={scriptTarget?.value || ""}
                onSave={(script) => scriptTarget && setScript(scriptTarget.name, script)}
                onClose={() => setScriptTarget(null)}
            />

            <VideoCapabilityEditor
                open={Boolean(capabilityTarget)}
                channelId={draft.id}
                model={draft.models.find((model) => model.name === capabilityTarget) || null}
                onSave={(videoCapabilities) => capabilityTarget && setVideoCapabilities(capabilityTarget, videoCapabilities)}
                onClose={() => setCapabilityTarget(null)}
            />
        </Drawer>
    );
}

function VideoCapabilityEditor({ open, channelId, model, onSave, onClose }: { open: boolean; channelId: string; model: ChannelModel | null; onSave: (capabilities: ChannelModel["videoCapabilities"]) => void; onClose: () => void }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<VideoModelCapabilities | null>(null);
    const modeOptions = VIDEO_MODES.map((mode) => ({ value: mode, label: t(`config.channelEditor.videoCapabilityModes.${mode}`) }));

    useEffect(() => {
        if (!open || !model) return;
        setDraft(resolveVideoCapabilities({ channels: [{ id: channelId, models: [model] }] }, `${channelId}::${model.name}`));
    }, [channelId, model, open]);

    if (!model || !draft) return null;
    const patch = (value: Partial<VideoModelCapabilities>) => setDraft((current) => (current ? { ...current, ...value } : current));

    return (
        <Modal
            open={open}
            width={640}
            title={t("config.channelEditor.videoCapabilityTitle", { model: model.name })}
            onCancel={onClose}
            footer={[
                <Button
                    key="reset"
                    onClick={() => {
                        onSave(undefined);
                        onClose();
                    }}
                >
                    {t("config.channelEditor.videoCapabilityReset")}
                </Button>,
                <Button key="cancel" onClick={onClose}>
                    {t("common.cancel")}
                </Button>,
                <Button
                    key="save"
                    type="primary"
                    onClick={() => {
                        onSave(draft);
                        onClose();
                    }}
                >
                    {t("common.save")}
                </Button>,
            ]}
        >
            <p className="mb-4 text-xs text-stone-500">{t("config.channelEditor.videoCapabilityDescription")}</p>
            <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.videoCapabilityModesLabel")}</span>
                    <Select mode="multiple" className="w-full" value={draft.modes} options={modeOptions} onChange={(modes: VideoModelMode[]) => patch({ modes })} />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.videoCapabilityMaxReferenceImages")}</span>
                    <InputNumber className="w-full" min={0} max={20} value={draft.maxReferenceImages} onChange={(value) => patch({ maxReferenceImages: Number(value) || 0 })} />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm font-medium">{t("config.channelEditor.videoCapabilityMaxSeconds")}</span>
                    <InputNumber className="w-full" min={1} max={30} value={draft.maxSeconds} onChange={(value) => patch({ maxSeconds: Number(value) || 1 })} />
                </label>
                <VideoCapabilitySwitch label={t("config.channelEditor.videoCapabilityMultiShot")} checked={draft.supportsMultiShot} onChange={(supportsMultiShot) => patch({ supportsMultiShot })} />
                <VideoCapabilitySwitch label={t("config.channelEditor.videoCapabilityAudio")} checked={draft.supportsAudio} onChange={(supportsAudio) => patch({ supportsAudio })} />
                <VideoCapabilitySwitch label={t("config.channelEditor.videoCapabilityWatermark")} checked={draft.supportsWatermark} onChange={(supportsWatermark) => patch({ supportsWatermark })} />
                <VideoCapabilitySwitch label={t("config.channelEditor.videoCapabilityNegativePrompt")} checked={draft.supportsNegativePrompt} onChange={(supportsNegativePrompt) => patch({ supportsNegativePrompt })} />
            </div>
        </Modal>
    );
}

function VideoCapabilitySwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2 text-sm dark:border-stone-800">
            <span>{label}</span>
            <Switch checked={checked} onChange={onChange} />
        </label>
    );
}
