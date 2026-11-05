import { useMemo, useState } from "react";
import { Button, Input, Popconfirm, Tooltip } from "antd";
import { ArrowUpRight, Box, Camera, Circle, Copy, Layers3, Plus, Sparkles, Trash2, Triangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { withShellFeatureFlags } from "@/components/layout/navigation-groups";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { createDirectorProject, type DirectorBackground } from "@/lib/canvas/director-project";
import { getThreeDBoxProjectPreview, getThreeDBoxProjectTitle, getThreeDBoxProjects } from "@/lib/canvas/three-d-box-projects";
import { useCanvasStore, type CanvasProject } from "@/stores/canvas/use-canvas-store";
import { useThemeStore } from "@/stores/use-theme-store";

const previewBackgrounds: DirectorBackground[] = ["studio", "sunset", "night", "sunset", "studio"];

export default function ThreeDBoxPage() {
    const { search } = useLocation();
    if (!isFeatureEnabled("director3d")) return <Navigate to={withShellFeatureFlags("/", search)} replace />;
    return <ThreeDBoxHome />;
}

function ThreeDBoxHome() {
    const { t } = useTranslation();
    const { search } = useLocation();
    const navigate = useNavigate();
    const dark = useThemeStore((state) => state.theme) === "dark";
    const hydrated = useCanvasStore((state) => state.hydrated);
    const projects = useCanvasStore((state) => state.projects);
    const createProject = useCanvasStore((state) => state.createProject);
    const duplicateProject = useCanvasStore((state) => state.duplicateProject);
    const deleteProjects = useCanvasStore((state) => state.deleteProjects);
    const updateProject = useCanvasStore((state) => state.updateProject);
    const [prompt, setPrompt] = useState("");
    const directorProjects = useMemo(() => getThreeDBoxProjects(projects), [projects]);
    const presets = [t("threeDBoxHub.presets.street"), t("threeDBoxHub.presets.product"), t("threeDBoxHub.presets.courtyard")];

    const openProject = (projectId: string) => {
        navigate(withShellFeatureFlags(`/canvas/${projectId}?ff_director3d=1&openDirector=1&returnTo=3d-box`, search));
    };
    const createScene = () => {
        if (!hydrated) return;
        const title = getThreeDBoxProjectTitle(prompt, t("threeDBoxHub.untitled", { count: directorProjects.length + 1 }));
        const projectId = createProject(title);
        updateProject(projectId, { director: createDirectorProject() });
        openProject(projectId);
    };

    return (
        <main className={`h-full overflow-y-auto transition-colors ${dark ? "bg-[#151515] text-[#f7f7f7]" : "bg-[#f4f2ed] text-[#1c1917]"}`}>
            <div className="mx-auto w-full max-w-[1512px] px-4 pb-16 pt-5 sm:px-7 lg:px-10">
                <section className={`relative overflow-hidden rounded-[28px] border ${dark ? "border-white/[0.07] bg-[#191919]" : "border-stone-200 bg-white shadow-[0_30px_90px_-70px_rgba(28,25,23,.5)]"}`}>
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_18%_0%,rgba(80,190,218,.16),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(244,114,182,.08),transparent_30%)]" />
                    <div className="relative px-3 pt-3 sm:px-5 sm:pt-5">
                        <div className="hide-scrollbar flex gap-2 overflow-x-auto sm:grid sm:grid-cols-5 sm:gap-3">
                            {previewBackgrounds.map((background, index) => (
                                <button
                                    key={`${background}:${index}`}
                                    type="button"
                                    className={`group w-40 shrink-0 overflow-hidden rounded-[18px] border text-left transition hover:-translate-y-0.5 sm:w-auto sm:shrink ${dark ? "border-white/[0.08] hover:border-white/20" : "border-stone-200 hover:border-stone-300"}`}
                                    aria-label={presets[index % presets.length]}
                                    onClick={() => setPrompt(presets[index % presets.length])}
                                >
                                    <SceneArtwork background={background} variant={index} />
                                    <span className={`block truncate px-3 py-2 text-[11px] ${dark ? "text-white/45" : "text-stone-500"}`}>{presets[index % presets.length]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative mx-auto max-w-3xl px-5 pb-8 pt-9 text-center sm:pb-10 sm:pt-12">
                        <div className={`mx-auto mb-4 inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-medium ${dark ? "border-white/10 bg-white/[0.04] text-white/55" : "border-stone-200 bg-stone-50 text-stone-500"}`}>
                            <Sparkles className="size-3.5 text-cyan-500" />
                            {t("threeDBoxHub.eyebrow")}
                        </div>
                        <h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-[38px]">{t("threeDBoxHub.title")}</h1>
                        <p className={`mx-auto mt-3 max-w-2xl text-sm leading-6 ${dark ? "text-white/45" : "text-stone-500"}`}>{t("threeDBoxHub.description")}</p>

                        <div className={`mt-7 rounded-[22px] border p-2 text-left shadow-[0_22px_70px_-50px_rgba(0,0,0,.75)] ${dark ? "border-white/[0.09] bg-[#202020]" : "border-stone-200 bg-white"}`}>
                            <Input.TextArea
                                variant="borderless"
                                autoSize={{ minRows: 3, maxRows: 5 }}
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                placeholder={t("threeDBoxHub.placeholder")}
                                aria-label={t("threeDBoxHub.placeholder")}
                                className="!px-3 !pt-2 !text-[14px] !leading-6"
                            />
                            <div className={`flex flex-wrap items-center justify-between gap-2 border-t px-2 pb-1 pt-2 ${dark ? "border-white/[0.07]" : "border-stone-100"}`}>
                                <div className={`flex items-center gap-1.5 text-[11px] ${dark ? "text-white/45" : "text-stone-500"}`}>
                                    <span className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 ${dark ? "bg-white/[0.05]" : "bg-stone-100"}`}>
                                        <Camera className="size-3.5" />
                                        16:9
                                    </span>
                                    <span className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 ${dark ? "bg-white/[0.05]" : "bg-stone-100"}`}>
                                        <Layers3 className="size-3.5" />
                                        {t("threeDBoxHub.sceneCount", { count: directorProjects.length })}
                                    </span>
                                </div>
                                <Button type="primary" disabled={!hydrated} className="!h-10 !rounded-xl !border-0 !bg-[#62bed8] !px-5 !font-medium !text-[#0d1a1e] hover:!bg-[#7dcee4]" icon={<Sparkles className="size-4" />} onClick={createScene}>
                                    {t("threeDBoxHub.start")}
                                </Button>
                            </div>
                        </div>

                        <div className={`mt-4 flex flex-col items-center gap-1.5 text-left text-xs ${dark ? "text-white/45" : "text-stone-500"}`}>
                            {presets.map((preset) => (
                                <button key={preset} type="button" className="inline-flex max-w-full items-center gap-2 rounded-md px-2 py-1 transition hover:bg-black/[0.04] hover:text-current dark:hover:bg-white/[0.05]" onClick={() => setPrompt(preset)}>
                                    <span className="text-cyan-500">↳</span>
                                    <span className="truncate">{preset}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mt-8">
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold tracking-[-0.025em]">{t("threeDBoxHub.myBoxes")}</h2>
                            <p className={`mt-1 text-xs ${dark ? "text-white/35" : "text-stone-500"}`}>{t("threeDBoxHub.myBoxesDescription")}</p>
                        </div>
                        <span className={`text-xs tabular-nums ${dark ? "text-white/30" : "text-stone-400"}`}>{directorProjects.length}</span>
                    </div>

                    {!hydrated ? (
                        <div className={`grid min-h-56 place-items-center rounded-[22px] border ${dark ? "border-white/[0.07] text-white/35" : "border-stone-200 text-stone-500"}`}>{t("threeDBoxHub.loading")}</div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <button
                                type="button"
                                className={`group flex min-h-64 flex-col items-center justify-center rounded-[22px] border border-dashed transition ${dark ? "border-white/15 bg-white/[0.025] text-white/55 hover:border-cyan-400/50 hover:bg-cyan-400/[0.04] hover:text-white" : "border-stone-300 bg-white/45 text-stone-500 hover:border-cyan-500/50 hover:bg-white hover:text-stone-950"}`}
                                onClick={createScene}
                            >
                                <span className={`grid size-14 place-items-center rounded-[18px] border transition group-hover:scale-105 ${dark ? "border-white/10 bg-white/[0.05]" : "border-stone-200 bg-white shadow-sm"}`}>
                                    <Plus className="size-5" />
                                </span>
                                <span className="mt-4 text-sm font-medium">{t("threeDBoxHub.createBlank")}</span>
                                <span className={`mt-1 text-[11px] ${dark ? "text-white/30" : "text-stone-400"}`}>{t("threeDBoxHub.createBlankHint")}</span>
                            </button>

                            {directorProjects.map((project, index) => (
                                <ThreeDBoxProjectCard key={project.id} project={project} index={index} dark={dark} onOpen={() => openProject(project.id)} onDuplicate={() => duplicateProject(project.id)} onDelete={() => deleteProjects([project.id])} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

function ThreeDBoxProjectCard({ project, index, dark, onOpen, onDuplicate, onDelete }: { project: CanvasProject; index: number; dark: boolean; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
    const { i18n, t } = useTranslation();
    const { background, objectCount, unsupportedVersion } = getThreeDBoxProjectPreview(project.director);
    const backgroundLabel = unsupportedVersion === null ? t(`canvas.director.backgrounds.${background}`) : t("threeDBoxHub.unsupportedVersion", { version: String(unsupportedVersion) });

    return (
        <article
            className={`group relative min-w-0 overflow-hidden rounded-[22px] border transition hover:-translate-y-0.5 ${dark ? "border-white/[0.08] bg-[#1c1c1c] hover:border-white/20" : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-[0_24px_60px_-50px_rgba(28,25,23,.6)]"}`}
        >
            <button type="button" className="block w-full text-left" onClick={onOpen}>
                <SceneArtwork background={background} variant={index + 1} />
                <div className="p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">{project.title}</h3>
                            <div className={`mt-2 flex items-center gap-2 text-[11px] ${dark ? "text-white/35" : "text-stone-500"}`}>
                                <span className="inline-flex items-center gap-1">
                                    <Box className="size-3" />
                                    {t("threeDBoxHub.objectCount", { count: objectCount })}
                                </span>
                                <span>·</span>
                                <span className="truncate">{backgroundLabel}</span>
                            </div>
                        </div>
                        <ArrowUpRight className={`mt-0.5 size-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${dark ? "text-white/25" : "text-stone-400"}`} />
                    </div>
                    <p className={`mt-4 text-[11px] ${dark ? "text-white/25" : "text-stone-400"}`}>
                        {t("threeDBoxHub.updated", { date: new Date(project.updatedAt).toLocaleString(i18n.resolvedLanguage, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) })}
                    </p>
                </div>
            </button>
            <div
                className={`absolute bottom-3 right-3 flex items-center gap-1 rounded-xl border p-1 opacity-100 shadow-sm transition sm:p-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 ${dark ? "border-white/10 bg-[#252525]" : "border-stone-200 bg-white"}`}
            >
                <Tooltip title={t("canvas.project.duplicate")}>
                    <Button type="text" size="small" className="!h-10 !w-10 !min-w-10 sm:!h-8 sm:!w-8 sm:!min-w-8" icon={<Copy className="size-3.5" />} onClick={onDuplicate} aria-label={t("canvas.project.duplicate")} />
                </Tooltip>
                <Popconfirm title={t("canvas.project.deleteTitle")} description={t("canvas.project.deleteDescription", { count: 1 })} okText={t("canvas.project.delete")} cancelText={t("common.cancel")} onConfirm={onDelete}>
                    <Button type="text" danger size="small" className="!h-10 !w-10 !min-w-10 sm:!h-8 sm:!w-8 sm:!min-w-8" icon={<Trash2 className="size-3.5" />} aria-label={t("canvas.project.delete")} />
                </Popconfirm>
            </div>
        </article>
    );
}

function SceneArtwork({ background, variant }: { background: DirectorBackground; variant: number }) {
    const palette = {
        studio: { base: "#24272d", glow: "#7dd3fc", grid: "rgba(255,255,255,.13)" },
        night: { base: "#091321", glow: "#60a5fa", grid: "rgba(125,211,252,.14)" },
        sunset: { base: "#321e25", glow: "#fb923c", grid: "rgba(251,146,60,.14)" },
    }[background];

    return (
        <div className="relative h-36 overflow-hidden" style={{ background: `radial-gradient(circle at ${28 + (variant % 3) * 18}% 24%, ${palette.glow}45, transparent 30%), linear-gradient(145deg, ${palette.base}, #111318)` }}>
            <div
                className="absolute -inset-x-10 -bottom-20 top-12 opacity-50"
                style={{
                    backgroundImage: `linear-gradient(${palette.grid} 1px, transparent 1px), linear-gradient(90deg, ${palette.grid} 1px, transparent 1px)`,
                    backgroundSize: "28px 28px",
                    transform: "perspective(220px) rotateX(58deg)",
                    transformOrigin: "center bottom",
                }}
            />
            <div className="absolute left-[18%] top-[45%] size-9 border" style={{ borderColor: palette.glow, background: `${palette.glow}22`, transform: "rotateX(58deg) rotateZ(-32deg)", boxShadow: `0 0 28px ${palette.glow}30` }} />
            <div
                className="absolute left-[48%] top-[38%] grid size-12 place-items-center rounded-md border text-white/70 backdrop-blur"
                style={{ borderColor: `${palette.glow}70`, background: `${palette.glow}12`, transform: "rotate(-8deg) skewY(-8deg)" }}
            >
                <Box className="size-5" />
            </div>
            <div className="absolute right-[16%] top-[56%] size-8 border" style={{ borderColor: `${palette.glow}bb`, background: `${palette.glow}18`, transform: "rotateX(58deg) rotateZ(32deg)" }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/[0.035]" />
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.15em] text-white/45">
                <Circle className="size-2 fill-current" />
                3D preview
                <Triangle className="ml-1 size-2 fill-current" />
            </div>
        </div>
    );
}
