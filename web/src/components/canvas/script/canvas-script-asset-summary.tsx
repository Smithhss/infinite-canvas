import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { App, Empty, Input, Modal } from "antd";
import { Box, Check, Clapperboard, Image as ImageIcon, ImagePlus, Plus, RefreshCw, Search, Trash2, Unlink, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasTheme } from "@/lib/canvas-theme";
import { scriptAssetAvailability } from "@/lib/canvas/script-v2";
import { getImagePreviewRevision, previewUrlFor, subscribeImagePreviews } from "@/services/image-storage";
import { assetCoverUrl, useAssetStore, type Asset } from "@/stores/use-asset-store";
import type { CanvasScriptAssetEntity, CanvasScriptAssetKind, CanvasScriptAssetReference, CanvasScriptV2 } from "@/types/canvas";

type Props = {
    script: CanvasScriptV2;
    theme: CanvasTheme;
    onAddAsset: (kind: CanvasScriptAssetKind, name: string) => void;
    onBindAsset: (kind: CanvasScriptAssetKind, assetId: string, reference?: CanvasScriptAssetReference | null) => void;
    onRemoveAsset: (kind: CanvasScriptAssetKind, assetId: string) => void;
    onSyncAssets: () => void;
};

const ASSET_GROUPS: Array<{ kind: CanvasScriptAssetKind; icon: ReactNode }> = [
    { kind: "characters", icon: <UserRound className="size-4" /> },
    { kind: "scenes", icon: <Clapperboard className="size-4" /> },
    { kind: "props", icon: <Box className="size-4" /> },
];

export function CanvasScriptAssetSummary({ script, theme, onAddAsset, onBindAsset, onRemoveAsset, onSyncAssets }: Props) {
    const { t } = useTranslation();
    const { modal } = App.useApp();
    const libraryAssets = useAssetStore((state) => state.assets);
    const libraryHydrated = useAssetStore((state) => state.hydrated);
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const [bindingTarget, setBindingTarget] = useState<{ kind: CanvasScriptAssetKind; assetId: string } | null>(null);
    const [referenceKeyword, setReferenceKeyword] = useState("");
    const assets = script.assets || { characters: [], scenes: [], props: [] };
    const total = ASSET_GROUPS.reduce((count, group) => count + assets[group.kind].length, 0);
    const libraryAssetsById = useMemo(() => new Map(libraryAssets.map((asset) => [asset.id, asset])), [libraryAssets]);
    const referenceIds = useMemo(() => libraryHydrated ? new Set(libraryAssetsById.keys()) : null, [libraryAssetsById, libraryHydrated]);
    const ready = ASSET_GROUPS.reduce((count, group) => count + assets[group.kind].filter((asset) => scriptAssetAvailability(asset, referenceIds) === "ready").length, 0);
    const imageAssets = useMemo(() => {
        const query = referenceKeyword.trim().toLocaleLowerCase();
        return libraryAssets.filter((asset): asset is Extract<Asset, { kind: "image" }> => asset.kind === "image").filter((asset) => !query || [asset.title, ...(asset.tags || [])].join(" ").toLocaleLowerCase().includes(query));
    }, [libraryAssets, referenceKeyword]);
    const targetAsset = bindingTarget ? assets[bindingTarget.kind].find((asset) => asset.id === bindingTarget.assetId) : undefined;

    const confirmRemove = (kind: CanvasScriptAssetKind, asset: CanvasScriptAssetEntity) => {
        modal.confirm({
            title: t("canvas.storyboard.workbench.assets.removeTitle", { kind: t(`canvas.storyboard.workbench.assets.${kind}`) }),
            content: t("canvas.storyboard.workbench.assets.removeDescription"),
            okText: t("canvas.storyboard.workbench.assets.remove"),
            cancelText: t("common.cancel"),
            okButtonProps: { danger: true },
            onOk: () => onRemoveAsset(kind, asset.id),
        });
    };

    const bindReference = (asset: Extract<Asset, { kind: "image" }>) => {
        if (!bindingTarget) return;
        onBindAsset(bindingTarget.kind, bindingTarget.assetId, {
            referenceAssetId: asset.id,
            referenceTitle: asset.title,
            referenceStorageKey: asset.data.storageKey,
        });
        setBindingTarget(null);
        setReferenceKeyword("");
    };

    return (
        <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                <p className="min-w-[180px] flex-1 text-[10px] leading-5" style={{ color: theme.node.muted }}>
                    {t("canvas.storyboard.workbench.assets.boundary")}
                </p>
                <span className="text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                    {t("canvas.storyboard.workbench.assets.readyCount", { ready, total })}
                </span>
                <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: theme.node.text, border: `0.5px solid ${theme.toolbar.border}` }}
                    onClick={onSyncAssets}
                >
                    <RefreshCw className="size-3.5" />
                    {t("canvas.storyboard.workbench.assets.sync")}
                </button>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {ASSET_GROUPS.map((group) => (
                    <AssetGroup
                        key={group.kind}
                        kind={group.kind}
                        icon={group.icon}
                        assets={assets[group.kind]}
                        theme={theme}
                        libraryAssetsById={libraryAssetsById}
                        referenceIds={referenceIds}
                        onAdd={(name) => onAddAsset(group.kind, name)}
                        onBind={(assetId) => setBindingTarget({ kind: group.kind, assetId })}
                        onUnbind={(assetId) => onBindAsset(group.kind, assetId, null)}
                        onRemove={(asset) => confirmRemove(group.kind, asset)}
                    />
                ))}
            </div>
            <Modal
                open={Boolean(bindingTarget)}
                title={t("canvas.storyboard.workbench.assets.pickerTitle")}
                footer={null}
                width={760}
                destroyOnHidden
                onCancel={() => {
                    setBindingTarget(null);
                    setReferenceKeyword("");
                }}
            >
                <p className="mb-3 text-xs leading-5 text-stone-500 dark:text-stone-400">{t("canvas.storyboard.workbench.assets.pickerDescription", { name: targetAsset?.name || "" })}</p>
                <Input allowClear prefix={<Search className="size-3.5 text-stone-400" />} placeholder={t("canvas.storyboard.workbench.assets.pickerSearch")} value={referenceKeyword} onChange={(event) => setReferenceKeyword(event.target.value)} />
                {imageAssets.length ? (
                    <div className="thin-scrollbar mt-3 grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                        {imageAssets.map((asset) => {
                            const cover = assetCoverUrl(asset);
                            return (
                                <button
                                    key={asset.id}
                                    type="button"
                                    className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-500"
                                    onClick={() => bindReference(asset)}
                                >
                                    {cover ? (
                                        <img src={cover} alt={asset.title} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="grid aspect-[4/3] place-items-center bg-stone-100 dark:bg-stone-800">
                                            <ImageIcon className="size-6 text-stone-400" />
                                        </div>
                                    )}
                                    <span className="block truncate px-2.5 py-2 text-xs font-medium">{asset.title}</span>
                                    <span className="pointer-events-none absolute inset-0 grid place-items-center bg-stone-950/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-stone-950/55 group-hover:opacity-100">
                                        {t("canvas.storyboard.workbench.assets.pickerBind")}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.storyboard.workbench.assets.pickerEmpty")} className="py-12" />
                )}
            </Modal>
        </div>
    );
}

function AssetGroup({
    kind,
    icon,
    assets,
    theme,
    libraryAssetsById,
    referenceIds,
    onAdd,
    onBind,
    onUnbind,
    onRemove,
}: {
    kind: CanvasScriptAssetKind;
    icon: ReactNode;
    assets: CanvasScriptAssetEntity[];
    theme: CanvasTheme;
    libraryAssetsById: Map<string, Asset>;
    referenceIds: ReadonlySet<string> | null;
    onAdd: (name: string) => void;
    onBind: (assetId: string) => void;
    onUnbind: (assetId: string) => void;
    onRemove: (asset: CanvasScriptAssetEntity) => void;
}) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const title = t(`canvas.storyboard.workbench.assets.${kind}`);
    const ready = assets.filter((asset) => scriptAssetAvailability(asset, referenceIds) === "ready").length;
    const submit = () => {
        const value = name.trim();
        if (!value) return;
        onAdd(value);
        setName("");
    };

    return (
        <section className="min-w-0 rounded-xl p-3" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
            <div className="flex items-center gap-2">
                <span style={{ color: theme.node.muted }}>{icon}</span>
                <h3 className="text-xs font-medium">{title}</h3>
                <span className="ml-auto text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                    {ready}/{assets.length}
                </span>
            </div>
            <form
                className="mt-2 flex h-8 items-center gap-1 rounded-lg px-2"
                style={{ background: theme.canvas.background, border: `0.5px solid ${theme.toolbar.border}` }}
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <input
                    value={name}
                    maxLength={120}
                    className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                    style={{ color: theme.node.text }}
                    placeholder={t("canvas.storyboard.workbench.assets.addPlaceholder", { kind: title })}
                    aria-label={t("canvas.storyboard.workbench.assets.addPlaceholder", { kind: title })}
                    onChange={(event) => setName(event.target.value)}
                />
                <button type="submit" disabled={!name.trim()} className="grid size-6 place-items-center rounded disabled:opacity-25" style={{ color: theme.node.muted }} aria-label={t("canvas.storyboard.workbench.assets.add")}>
                    <Plus className="size-3.5" />
                </button>
            </form>
            {assets.length ? (
                <div className="mt-2 space-y-1.5">
                    {assets.map((asset) => (
                        <AssetRow
                            key={asset.id}
                            asset={asset}
                            theme={theme}
                            libraryAsset={asset.referenceAssetId ? libraryAssetsById.get(asset.referenceAssetId) : undefined}
                            availability={scriptAssetAvailability(asset, referenceIds)}
                            onBind={() => onBind(asset.id)}
                            onUnbind={() => onUnbind(asset.id)}
                            onRemove={() => onRemove(asset)}
                        />
                    ))}
                </div>
            ) : (
                <p className="mt-3 text-[10px]" style={{ color: theme.node.muted }}>
                    {t("canvas.storyboard.workbench.assets.empty")}
                </p>
            )}
        </section>
    );
}

function AssetRow({ asset, theme, libraryAsset, availability, onBind, onUnbind, onRemove }: { asset: CanvasScriptAssetEntity; theme: CanvasTheme; libraryAsset?: Asset; availability: "draft" | "ready" | "missing"; onBind: () => void; onUnbind: () => void; onRemove: () => void }) {
    const { t } = useTranslation();
    const referenceCover = libraryAsset?.kind === "image" ? assetCoverUrl(libraryAsset) : previewUrlFor(asset.referenceStorageKey) || "";
    return (
        <div className="rounded-lg p-2" style={{ background: theme.canvas.background, border: `0.5px solid ${theme.toolbar.border}` }}>
            <div className="flex min-w-0 items-center gap-2">
                {referenceCover ? (
                    <img src={referenceCover} alt={asset.referenceTitle || asset.name} className="size-9 shrink-0 rounded-md object-cover" />
                ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-md" style={{ color: theme.node.muted, border: `0.5px dashed ${theme.toolbar.border}` }}>
                        <ImageIcon className="size-3.5" />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium">{asset.name}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[9px]" style={{ color: availability === "ready" ? "#16a34a" : availability === "missing" ? "#d97706" : theme.node.muted }}>
                        {availability === "ready" ? <Check className="size-2.5" /> : null}
                        {t(`canvas.storyboard.workbench.assets.status.${availability}`)}
                    </div>
                </div>
                <div className="flex shrink-0 items-center">
                    <button
                        type="button"
                        className="grid size-6 place-items-center rounded transition hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: theme.node.muted }}
                        aria-label={t(asset.referenceAssetId ? "canvas.storyboard.workbench.assets.replaceReference" : "canvas.storyboard.workbench.assets.bind")}
                        title={t(asset.referenceAssetId ? "canvas.storyboard.workbench.assets.replaceReference" : "canvas.storyboard.workbench.assets.bind")}
                        onClick={onBind}
                    >
                        <ImagePlus className="size-3" />
                    </button>
                    {asset.referenceAssetId ? (
                        <button
                            type="button"
                            className="grid size-6 place-items-center rounded transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: theme.node.muted }}
                            aria-label={t("canvas.storyboard.workbench.assets.unbind")}
                            title={t("canvas.storyboard.workbench.assets.unbind")}
                            onClick={onUnbind}
                        >
                            <Unlink className="size-3" />
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="grid size-6 place-items-center rounded transition hover:bg-red-500/10"
                        style={{ color: theme.node.muted }}
                        aria-label={t("canvas.storyboard.workbench.assets.remove")}
                        title={t("canvas.storyboard.workbench.assets.remove")}
                        onClick={onRemove}
                    >
                        <Trash2 className="size-3" />
                    </button>
                </div>
            </div>
            {asset.referenceAssetId ? (
                <p className="mt-1.5 truncate text-[9px]" style={{ color: theme.node.muted }} title={asset.referenceTitle}>
                    {libraryAsset ? t("canvas.storyboard.workbench.assets.reference", { title: asset.referenceTitle || libraryAsset.title }) : t("canvas.storyboard.workbench.assets.referenceUnavailable")}
                </p>
            ) : null}
        </div>
    );
}
