import { AudioLines, BookOpen, Clapperboard, Image as ImageIcon, LayoutGrid, Plus, Puzzle, Scissors, Sparkles, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { assetCoverUrl, useAssetStore } from "@/stores/use-asset-store";
import { cn } from "@/lib/utils";

import { formatProjectDate, latestCoverAssets, recentCanvasProjects } from "./libtv-home-data";

const quickActions = [
    { key: "video", icon: Video, target: "/video" },
    { key: "image", icon: ImageIcon, target: "/image" },
    { key: "audio", icon: AudioLines, target: "/canvas?mode=new" },
    { key: "script", icon: Clapperboard, target: "/canvas?mode=new" },
    { key: "smartCut", icon: Scissors, target: "/canvas?mode=new" },
] as const;

const headerLinks = [
    { key: "models", icon: Sparkles, target: "/config" },
    { key: "plugins", icon: Puzzle, target: "/plugins" },
    { key: "docs", icon: BookOpen, target: "/docs" },
] as const;

export function LibtvHome() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const projects = useCanvasStore((state) => state.projects);
    const assets = useAssetStore((state) => state.assets);
    const recent = recentCanvasProjects(projects);
    const latest = latestCoverAssets(assets, 5);
    const featured = latestCoverAssets(assets, 13).slice(5);
    const locale = i18n.language;

    return (
        <main className="h-full overflow-y-auto bg-[#f7f6f3] text-stone-900 dark:bg-[#141414] dark:text-[#f7f7f7]">
            <div className="mx-auto w-full max-w-[1400px] px-5 pb-16 sm:px-8 lg:px-11">
                <header className="flex h-16 items-center gap-2">
                    <span className="hidden shrink-0 items-center gap-1.5 rounded-md border border-black/10 px-2.5 py-1.5 text-[12px] whitespace-nowrap text-stone-500 sm:inline-flex dark:border-white/10 dark:text-stone-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        {t("home.libtv.localOnly")}
                    </span>
                    <nav className="ml-auto flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap">
                        {headerLinks.map(({ key, icon: Icon, target }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => navigate(target)}
                                className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-black/10 px-2.5 text-[12px] text-stone-600 transition hover:border-black/20 hover:text-stone-900 sm:h-8 dark:border-white/10 dark:text-stone-300 dark:hover:border-white/20 dark:hover:text-white"
                            >
                                <Icon className="size-3.5" />
                                {t(`home.libtv.header.${key}`)}
                            </button>
                        ))}
                    </nav>
                </header>

                <section className="relative h-[160px] overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/[0.16] dark:bg-white/[0.05]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.14)_1px,transparent_1px)] bg-[size:16px_16px] opacity-60 dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16)_1px,transparent_1px)] dark:opacity-40" />
                    <button type="button" onClick={() => navigate("/canvas?mode=new")} className="group absolute inset-0 flex flex-col items-center justify-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-cyan-400">
                        <span className="grid h-[64px] w-[74px] place-items-center rounded-lg bg-white text-stone-900 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition group-hover:scale-[1.02] dark:bg-[#f5f5f4]">
                            <Plus className="size-7" strokeWidth={2.4} />
                        </span>
                        <span className="text-[18px] font-normal">{t("home.libtv.hero.title")}</span>
                        <span className="text-[12px] text-stone-500 dark:text-stone-400">{t("home.libtv.hero.hint")}</span>
                    </button>
                </section>

                <section className="mt-6">
                    <div className="flex h-5 items-center gap-2 pl-2 text-[13px] font-medium text-cyan-600 dark:text-cyan-400">
                        <Sparkles className="size-3.5" />
                        {t("home.libtv.quickTitle")}
                    </div>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {quickActions.map(({ key, icon: Icon, target }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => navigate(target)}
                                className="flex h-[86px] w-[120px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg transition hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 dark:hover:bg-white/[0.06]"
                            >
                                <span className="grid size-9 place-items-center rounded-full bg-black/[0.05] text-stone-700 dark:bg-white/[0.08] dark:text-white/80">
                                    <Icon className="size-[18px]" />
                                </span>
                                <span className="text-[13px]">{t(`home.libtv.quick.${key}`)}</span>
                            </button>
                        ))}
                    </div>
                </section>

                <SectionHeader title={t("home.libtv.sections.recent")} action={t("home.libtv.sections.viewAll")} onAction={() => navigate("/canvas")} />
                {recent.length ? (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {recent.map((project) => (
                            <button
                                key={project.id}
                                type="button"
                                onClick={() => navigate(`/canvas/${project.id}`)}
                                className="flex h-[85px] min-w-0 items-center gap-3 rounded-xl border border-black/10 px-4 text-left transition hover:border-black/20 hover:bg-black/[0.03] dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.05]"
                            >
                                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-black/[0.05] text-stone-500 dark:bg-white/[0.07] dark:text-stone-300">
                                    <LayoutGrid className="size-4" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-[14px]">{project.title}</span>
                                    <span className="mt-0.5 block text-[12px] text-stone-500 dark:text-stone-400">
                                        {formatProjectDate(project.updatedAt, locale.startsWith("zh") ? "zh" : "en")}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <EmptyLine text={t("home.libtv.sections.recentEmpty")} />
                )}

                <SectionHeader title={t("home.libtv.sections.latest")} />
                {latest.length ? (
                    <div className="flex gap-4 overflow-x-auto pb-1">
                        {latest.map((asset) => (
                            <button key={asset.id} type="button" onClick={() => navigate("/assets")} className="group min-w-[160px] flex-1 text-left transition hover:opacity-90 lg:min-w-0">
                                <span className="relative block aspect-video overflow-hidden rounded-[16px] bg-black/[0.06] dark:bg-white/[0.06]">
                                    <img src={assetCoverUrl(asset)} alt="" className="size-full object-cover" draggable={false} />
                                </span>
                                <span className="mt-2 flex items-center gap-2">
                                    <span className="block truncate text-[13px] text-stone-700 dark:text-stone-300">{asset.title}</span>
                                    {asset.tags[0] ? <span className="shrink-0 rounded bg-black/[0.05] px-1.5 py-0.5 text-[11px] text-stone-500 dark:bg-white/[0.08] dark:text-stone-400">{asset.tags[0]}</span> : null}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-1">
                        {quickActions.map(({ key, icon: Icon, target }) => (
                            <button key={key} type="button" onClick={() => navigate(target)} className="group min-w-[160px] flex-1 overflow-hidden rounded-2xl text-left lg:min-w-0">
                                <span className="relative flex aspect-video items-end overflow-hidden rounded-[16px] border border-black/10 bg-[linear-gradient(140deg,rgba(56,189,248,0.16),rgba(244,114,182,0.14),rgba(0,0,0,0.02))] p-4 dark:border-white/10">
                                    <Icon className="absolute right-4 top-4 size-5 text-stone-500 dark:text-white/50" />
                                    <span className="text-[13px] font-medium">{t(`home.libtv.quick.${key}`)}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {featured.length ? (
                    <>
                        <SectionHeader title={t("home.libtv.sections.featured")} />
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
                            {featured.map((asset) => (
                                <button key={asset.id} type="button" onClick={() => navigate("/assets")} className="min-w-0 overflow-hidden rounded-xl text-left transition hover:opacity-90">
                                    <span className="block aspect-video overflow-hidden rounded-[16px] bg-black/[0.06] dark:bg-white/[0.06]">
                                        <img src={assetCoverUrl(asset)} alt="" className="size-full object-cover" draggable={false} />
                                    </span>
                                    <span className="mt-2 block truncate text-[13px] text-stone-600 dark:text-stone-300">{asset.title}</span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : null}
            </div>
        </main>
    );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
    return (
        <div className="mt-7 mb-3 flex h-8 items-center gap-2 pl-2 max-sm:h-10">
            <h2 className="text-[16px] font-medium">{title}</h2>
            {action ? (
                <button type="button" onClick={onAction} className={cn("ml-auto text-[12px] text-stone-500 transition hover:text-stone-900 max-sm:inline-flex max-sm:h-10 max-sm:items-center max-sm:px-2 dark:text-stone-400 dark:hover:text-white")}>
                    {action}
                </button>
            ) : null}
        </div>
    );
}

function EmptyLine({ text }: { text: string }) {
    return <div className="flex h-[85px] items-center rounded-xl border border-dashed border-black/10 px-4 text-[13px] text-stone-500 dark:border-white/12 dark:text-stone-400">{text}</div>;
}
