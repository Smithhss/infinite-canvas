import { ArrowRight, ImagePlus, Video, Workflow } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { App, Button, Image, Input, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

import { fetchPrompts, type Prompt } from "@/services/api/prompts";
import { navigationTools } from "@/constant/navigation-tools";
import { isFeatureEnabled } from "@/constant/feature-flags";
import i18n from "@/i18n";
import { buildQuickCreateUrl } from "@/lib/quick-create";
import { cn } from "@/lib/utils";

function Highlighter({ action, color, children }: { action: "highlight" | "underline"; color: string; children?: ReactNode }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <span className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-45" style={{ backgroundColor: color }} />
            ) : (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full opacity-80" style={{ backgroundColor: color }} />
            )}
            <span className="relative font-medium text-stone-800 dark:text-stone-200">{children}</span>
        </span>
    );
}

export default function IndexPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [primaryTool] = navigationTools;
    const [promptShowcase, setPromptShowcase] = useState<Prompt[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [quickPrompt, setQuickPrompt] = useState("");
    const quickCreateEnabled = isFeatureEnabled("quickCreate");
    const workflowEnabled = isFeatureEnabled("creativeWorkflow");

    useEffect(() => {
        void fetchPrompts({ pageSize: 12 })
            .then((data) => setPromptShowcase(data.items))
            .catch((error) => message.error(error instanceof Error ? error.message : i18n.t("home.promptError")));
    }, [message]);

    const openQuickCreate = (mode: "image" | "video") => {
        const prompt = quickPrompt.trim();
        if (!prompt) {
            message.warning(t("home.quickPromptRequired"));
            return;
        }
        navigate(buildQuickCreateUrl({ mode, prompt, run: false }));
    };

    return (
        <main className="relative h-full overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] text-stone-950 dark:bg-[radial-gradient(rgba(245,245,244,.18)_1px,transparent_1px)] dark:text-stone-100">
            <section className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden px-6">
                <div className="pointer-events-none absolute left-[15%] top-24 size-20 rounded-full border border-dashed border-stone-200 dark:border-stone-800" />
                <div className="pointer-events-none absolute right-[23%] top-[48%] size-20 rounded-full border border-dashed border-stone-200 dark:border-stone-800" />

                <div className="relative flex min-h-[620px] flex-col items-center justify-center pt-10 text-center">
                    <h1 className="ai-title-aurora max-w-5xl text-balance text-5xl font-semibold tracking-normal sm:text-7xl lg:text-8xl">{t("meta.title")}</h1>
                    <p className="mt-8 max-w-3xl text-balance text-lg leading-8 text-stone-500 dark:text-stone-400">
                        <Trans i18nKey="home.description" components={{ canvas: <Highlighter action="underline" color="#FF9800" />, content: <Highlighter action="highlight" color="#87CEFA" /> }} />
                    </p>
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        <Button type="primary" size="large" onClick={() => navigate(`/${primaryTool.slug}`)} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            {t("home.start")}
                        </Button>
                        <Button size="large" onClick={() => navigate("/canvas")}>
                            {t("home.openCanvas")}
                        </Button>
                    </div>
                </div>

                {quickCreateEnabled ? (
                    <section className="relative mx-auto mb-16 max-w-5xl overflow-hidden rounded-[28px] border border-stone-200 bg-white/75 p-5 shadow-[0_24px_80px_-48px_rgba(28,25,23,0.45)] backdrop-blur-xl sm:p-7 dark:border-white/10 dark:bg-white/[0.035]">
                        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-cyan-300/20 blur-3xl" />
                        <div className="relative grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-400">{t("home.quickEyebrow")}</p>
                                <h2 className="mt-3 text-2xl font-semibold text-stone-950 dark:text-stone-100">{t("home.quickTitle")}</h2>
                                <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">{t("home.quickDescription")}</p>
                            </div>
                            <div>
                                <Input.TextArea
                                    value={quickPrompt}
                                    onChange={(event) => setQuickPrompt(event.target.value)}
                                    placeholder={t("home.quickPlaceholder")}
                                    autoSize={{ minRows: 3, maxRows: 5 }}
                                    maxLength={600}
                                    className="!rounded-2xl !bg-white/80 !text-sm dark:!bg-black/20"
                                />
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Button type="primary" icon={<ImagePlus className="size-4" />} onClick={() => openQuickCreate("image")}>
                                        {t("home.quickImage")}
                                    </Button>
                                    <Button icon={<Video className="size-4" />} onClick={() => openQuickCreate("video")}>
                                        {t("home.quickVideo")}
                                    </Button>
                                    {workflowEnabled ? (
                                        <Button type="text" icon={<Workflow className="size-4" />} onClick={() => navigate("/workflows")}>
                                            {t("home.quickWorkflow")}
                                        </Button>
                                    ) : null}
                                    <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">{t("home.quickNoCharge")}</span>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}

                <section className="relative mx-auto mb-20 max-w-6xl border-t border-stone-200 pt-12 dark:border-stone-800">
                    <div className="mb-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                        <div />
                        <div className="max-w-2xl text-center">
                            <h2 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">{t("home.showcaseTitle")}</h2>
                            <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.showcaseDescription")}</p>
                        </div>
                        <Button type="link" onClick={() => navigate("/prompts")} className="justify-self-center md:justify-self-end" icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            {t("home.viewPrompts")}
                        </Button>
                    </div>
                    <div className="grid auto-rows-[210px] gap-4 md:grid-cols-4">
                        {promptShowcase.map((item, index) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                className={cn(
                                    "group relative cursor-pointer overflow-hidden border border-stone-200 bg-stone-100 text-left dark:border-stone-800 dark:bg-stone-900",
                                    index === 0 && "md:col-span-2 md:row-span-2",
                                    index === 3 && "md:col-span-2",
                                )}
                            >
                                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-4 text-white">
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {item.tags.slice(0, 2).map((tag) => (
                                            <Tag key={tag} variant="filled" className="m-0 bg-white/15 text-[11px] text-white backdrop-blur">
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <h3 className="text-sm font-medium">{item.title}</h3>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{item.prompt}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
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
                    {promptShowcase.map((item) => (
                        <Image key={item.id} src={item.coverUrl} alt={item.title} />
                    ))}
                </div>
            </Image.PreviewGroup>
        </main>
    );
}
