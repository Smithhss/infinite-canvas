import { ArrowDown, ArrowRight, ImagePlus, Layers3, Sparkles, Video, Workflow } from "lucide-react";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";
import { App, Button, Image, Input, Tag } from "antd";
import { useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import { fetchPrompts, type Prompt } from "@/services/api/prompts";
import { navigationTools } from "@/constant/navigation-tools";
import { isFeatureEnabled } from "@/constant/feature-flags";
import i18n from "@/i18n";
import { buildQuickCreateUrl, storeQuickCreateDraft } from "@/lib/quick-create";
import { cn } from "@/lib/utils";

const heroFallbacks = [
    "linear-gradient(145deg, #a8edf1 0%, #3257a8 42%, #10111c 100%)",
    "linear-gradient(145deg, #ffd6a5 0%, #d95f45 48%, #2b1836 100%)",
    "linear-gradient(145deg, #d6d1ff 0%, #6f69c9 45%, #15172b 100%)",
    "linear-gradient(145deg, #b8f1cc 0%, #3b7a67 42%, #101a18 100%)",
];

const showcaseLayout = [
    "md:col-span-5 md:row-span-2",
    "md:col-span-4 md:row-span-2",
    "md:col-span-3",
    "md:col-span-3",
    "md:col-span-4 md:row-span-2",
    "md:col-span-4 md:row-span-2",
    "md:col-span-4 md:row-span-2",
    "md:col-span-3",
    "md:col-span-3",
    "md:col-span-6",
    "md:col-span-3",
    "md:col-span-3",
];

function HeroTile({ item, index, className, rotate, label, parallax }: { item?: Prompt; index: number; className: string; rotate: string; label: string; parallax: CSSProperties }) {
    return (
        <div className={cn("absolute", className)}>
            <div className="transition-transform duration-500 ease-out will-change-transform" style={parallax}>
                <div className={cn("overflow-hidden rounded-[clamp(18px,3vw,32px)] border border-white/15 bg-white/8 shadow-[0_32px_90px_-28px_rgba(0,0,0,0.9)]", rotate)}>
                    <div className="relative aspect-[4/3] overflow-hidden">
                        {item?.coverUrl ? (
                            <img src={item.coverUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                        ) : (
                            <div className="relative h-full w-full" style={{ background: heroFallbacks[index % heroFallbacks.length] }}>
                                <span className="absolute left-[12%] top-[14%] size-[58%] rounded-full border border-white/25 bg-white/10 backdrop-blur-sm" />
                                <span className="absolute bottom-[13%] right-[12%] size-[36%] rounded-[38%] border border-white/20 bg-black/15" />
                                <Sparkles className="absolute right-[18%] top-[20%] size-6 text-white/65" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-white/10" />
                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 text-white sm:p-4">
                            <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.18em] text-white/70 sm:text-xs">{label}</span>
                            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/15 bg-black/25 text-[10px] text-white/70 backdrop-blur-md">0{index + 1}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HeroCanvas({ items }: { items: Prompt[] }) {
    const { t } = useTranslation();
    const reducedMotion = useReducedMotion();
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const movePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (reducedMotion || event.pointerType !== "mouse") return;
        const rect = event.currentTarget.getBoundingClientRect();
        setOffset({
            x: (event.clientX - rect.left) / rect.width - 0.5,
            y: (event.clientY - rect.top) / rect.height - 0.5,
        });
    };

    return (
        <div data-testid="home-hero-canvas" className="relative mx-auto mt-8 h-[330px] w-full max-w-6xl touch-pan-y select-none sm:mt-10 sm:h-[430px] lg:h-[500px]" onPointerMove={movePointer} onPointerLeave={() => setOffset({ x: 0, y: 0 })}>
            <div className="absolute inset-[8%_3%_3%] rounded-[40px] border border-white/8 bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_60px_120px_-50px_rgba(0,0,0,1)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:22px_22px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_72%)]" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 500" fill="none" aria-hidden="true">
                <path d="M244 254C344 168 410 206 470 286" stroke="rgba(117,231,239,.46)" strokeWidth="1.2" strokeDasharray="5 8" />
                <path d="M714 284C826 204 900 194 978 248" stroke="rgba(255,190,128,.42)" strokeWidth="1.2" strokeDasharray="5 8" />
                <path d="M460 324C540 362 650 368 740 324" stroke="rgba(255,255,255,.2)" strokeWidth="1" />
                <circle cx="244" cy="254" r="5" fill="#75e7ef" />
                <circle cx="978" cy="248" r="5" fill="#ffbe80" />
                <circle cx="600" cy="352" r="4" fill="#f8fafc" />
            </svg>

            <div className="absolute left-[4%] top-[8%] z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/65 backdrop-blur-xl sm:left-[7%] sm:text-xs">
                <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.85)]" />
                {t("home.canvasLive")}
            </div>

            <HeroTile
                item={items[1]}
                index={1}
                className="left-[1%] top-[27%] z-10 w-[30%] sm:left-[4%] sm:top-[23%] sm:w-[28%]"
                rotate="-rotate-[8deg]"
                label={t("home.nodeReference")}
                parallax={{ transform: `translate3d(${offset.x * -16}px,${offset.y * -12}px,0)` }}
            />
            <HeroTile item={items[0]} index={0} className="left-[29%] top-[10%] z-20 w-[43%]" rotate="rotate-[1deg]" label={t("home.nodeGenerated")} parallax={{ transform: `translate3d(${offset.x * 14}px,${offset.y * 10}px,0)` }} />
            <HeroTile
                item={items[2]}
                index={2}
                className="right-[1%] top-[28%] z-10 w-[30%] sm:right-[4%] sm:top-[21%] sm:w-[28%]"
                rotate="rotate-[8deg]"
                label={t("home.nodeVariation")}
                parallax={{ transform: `translate3d(${offset.x * 22}px,${offset.y * 14}px,0)` }}
            />
            <HeroTile item={items[3]} index={3} className="bottom-0 left-[38%] z-30 hidden w-[24%] sm:block" rotate="-rotate-[1deg]" label={t("home.nodeContinue")} parallax={{ transform: `translate3d(${offset.x * 30}px,${offset.y * 18}px,0)` }} />

            <div className="absolute bottom-[4%] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#15171c]/80 px-3 py-2 text-[10px] text-white/55 shadow-2xl backdrop-blur-xl sm:bottom-[1%] sm:px-4 sm:text-xs">
                <Layers3 className="size-3.5" />
                {t("home.canvasHint")}
            </div>
        </div>
    );
}

export default function IndexPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const reducedMotion = useReducedMotion();
    const [primaryTool] = navigationTools;
    const [promptShowcase, setPromptShowcase] = useState<Prompt[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [quickPrompt, setQuickPrompt] = useState("");
    const quickCreateEnabled = isFeatureEnabled("quickCreate");
    const workflowEnabled = isFeatureEnabled("creativeWorkflow");
    const showcaseItems = promptShowcase.length > 4 ? promptShowcase.slice(4, 16) : promptShowcase;

    useEffect(() => {
        void fetchPrompts({ pageSize: 18 })
            .then((data) => setPromptShowcase(data.items))
            .catch((error) => message.error(error instanceof Error ? error.message : i18n.t("home.promptError")));
    }, [message]);

    const openQuickCreate = (mode: "image" | "video") => {
        const prompt = quickPrompt.trim();
        if (!prompt) {
            message.warning(t("home.quickPromptRequired"));
            return;
        }
        const draft = { mode, prompt } as const;
        if (!storeQuickCreateDraft(draft)) {
            message.error(t("home.quickStorageFailed"));
            return;
        }
        navigate(buildQuickCreateUrl(mode), { state: { quickCreate: true } });
    };

    return (
        <main className="relative h-full overflow-y-auto bg-[#f3f0ea] text-stone-950 dark:bg-[#0c0d10] dark:text-stone-100">
            <section className="relative isolate overflow-hidden bg-[#0b0c0f] text-white">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -left-[18%] top-[-26%] size-[62vw] rounded-full bg-cyan-400/16 blur-[120px]" />
                    <div className="absolute -right-[16%] top-[8%] size-[52vw] rounded-full bg-orange-400/14 blur-[130px]" />
                    <div className="absolute bottom-[-36%] left-[25%] size-[64vw] rounded-full bg-indigo-500/12 blur-[140px]" />
                    <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.045),transparent_28%,transparent_72%,rgba(255,255,255,0.035))]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.16] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
                </div>

                <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[1480px] flex-col px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:px-12">
                    <div className="mx-auto max-w-6xl text-center">
                        <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3.5 py-2 text-[10px] font-medium uppercase tracking-[0.24em] text-white/60 backdrop-blur-xl sm:text-xs">
                            <Sparkles className="size-3.5 text-cyan-200" />
                            {t("home.heroEyebrow")}
                        </div>
                        <h1 className="mt-7 text-balance text-[clamp(4rem,10vw,9rem)] leading-[0.88] tracking-[-0.075em]" style={{ fontWeight: 800 }}>
                            {t("meta.title")}
                        </h1>
                        <p className="mx-auto mt-7 max-w-3xl text-balance text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
                            <Trans i18nKey="home.description" components={{ canvas: <strong className="font-medium text-white" />, content: <strong className="font-medium text-white" /> }} />
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => navigate(`/${primaryTool.slug}`)}
                                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-6 text-sm font-semibold text-stone-950 shadow-[0_18px_45px_-18px_rgba(103,232,249,0.7)] transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
                            >
                                {t("home.start")}
                                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate("/canvas")}
                                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.055] px-6 text-sm font-medium text-white/85 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.09] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60"
                            >
                                {t("home.openCanvas")}
                            </button>
                        </div>

                        {quickCreateEnabled ? (
                            <div className="mx-auto mt-7 w-full max-w-3xl rounded-[24px] border border-white/12 bg-white/[0.06] p-2 text-left shadow-2xl backdrop-blur-2xl">
                                <Input.TextArea
                                    value={quickPrompt}
                                    onChange={(event) => setQuickPrompt(event.target.value)}
                                    placeholder={t("home.quickPlaceholder")}
                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                    maxLength={600}
                                    variant="borderless"
                                    className="!px-3 !py-2 !text-sm !text-white placeholder:!text-white/35"
                                />
                                <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
                                    <Button type="primary" shape="round" icon={<ImagePlus className="size-4" />} onClick={() => openQuickCreate("image")}>
                                        {t("home.quickImage")}
                                    </Button>
                                    <Button ghost shape="round" icon={<Video className="size-4" />} onClick={() => openQuickCreate("video")}>
                                        {t("home.quickVideo")}
                                    </Button>
                                    {workflowEnabled ? (
                                        <Button type="text" shape="round" className="!text-white/65 hover:!text-white" icon={<Workflow className="size-4" />} onClick={() => navigate("/workflows")}>
                                            {t("home.quickWorkflow")}
                                        </Button>
                                    ) : null}
                                    <span className="ml-auto pr-2 text-[11px] text-white/35">{t("home.quickNoCharge")}</span>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <HeroCanvas items={promptShowcase.slice(0, 4)} />
                    <button
                        type="button"
                        onClick={() => document.getElementById("home-showcase")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })}
                        className="mx-auto mt-2 inline-flex items-center gap-2 text-xs text-white/35 transition hover:text-white/70"
                    >
                        {t("home.exploreResults")}
                        <ArrowDown className="size-3.5" />
                    </button>
                </div>
            </section>

            <section id="home-showcase" className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(245,158,11,0.09),transparent_30%),radial-gradient(circle_at_12%_70%,rgba(6,182,212,0.08),transparent_32%)]" />
                <div className="relative mx-auto max-w-[1320px]">
                    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="max-w-3xl">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-stone-400 dark:text-stone-500">{t("home.showcaseEyebrow")}</p>
                            <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">{t("home.showcaseTitle")}</h2>
                            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.showcaseDescription")}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/prompts")}
                            className="group inline-flex w-fit items-center gap-3 rounded-full border border-stone-300/80 bg-white/55 px-5 py-3 text-sm font-medium shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-stone-400 dark:border-white/10 dark:bg-white/[0.045] dark:hover:border-white/20"
                        >
                            {t("home.viewPrompts")}
                            <span className="grid size-7 place-items-center rounded-full bg-stone-950 text-white dark:bg-white dark:text-stone-950">
                                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                        </button>
                    </div>

                    <div data-testid="home-showcase-grid" className="mt-12 grid auto-rows-[190px] grid-cols-1 gap-3 md:grid-cols-12 md:auto-rows-[145px]">
                        {showcaseItems.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                className={cn(
                                    "group relative min-h-0 cursor-pointer overflow-hidden rounded-[20px] bg-stone-200 text-left shadow-[0_20px_60px_-45px_rgba(28,25,23,0.85)] ring-1 ring-black/5 transition duration-500 hover:z-10 hover:scale-[1.012] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-950 dark:bg-stone-900 dark:ring-white/10 dark:focus-visible:outline-white",
                                    showcaseLayout[index % showcaseLayout.length],
                                )}
                            >
                                {item.coverUrl ? (
                                    <img src={item.coverUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.035]" />
                                ) : (
                                    <div className="h-full w-full" style={{ background: heroFallbacks[index % heroFallbacks.length] }} />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-90 transition duration-500 group-hover:opacity-100" />
                                <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                                    <div className="mb-2 flex flex-wrap gap-1.5 opacity-90">
                                        {item.tags.slice(0, 2).map((tag) => (
                                            <Tag key={tag} variant="filled" className="m-0 border-0 bg-white/15 text-[10px] text-white backdrop-blur-md">
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <h3 className="line-clamp-2 text-sm font-medium sm:text-base">{item.title}</h3>
                                    <p className="mt-1 hidden line-clamp-2 max-w-2xl text-xs leading-5 text-white/65 transition duration-500 group-hover:block">{item.prompt}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <Image.PreviewGroup
                preview={{
                    open: previewOpen,
                    current: previewIndex,
                    onOpenChange: setPreviewOpen,
                    onChange: setPreviewIndex,
                }}
            >
                <div className="hidden">
                    {showcaseItems.map((item) => (
                        <Image key={item.id} src={item.coverUrl} alt={item.title} />
                    ))}
                </div>
            </Image.PreviewGroup>
        </main>
    );
}
