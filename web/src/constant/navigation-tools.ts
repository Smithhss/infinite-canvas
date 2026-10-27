import { FileText, ImagePlus, Images, Maximize2, Settings2, Video, Workflow } from "lucide-react";

import { isFeatureEnabled, type FeatureFlagKey } from "@/constant/feature-flags";

export const navigationTools = [
    {
        slug: "canvas",
        icon: Maximize2,
    },
    {
        slug: "image",
        icon: ImagePlus,
    },
    {
        slug: "video",
        icon: Video,
    },
    {
        slug: "prompts",
        icon: FileText,
    },
    {
        slug: "workflows",
        icon: Workflow,
        featureFlag: "creativeWorkflow" as FeatureFlagKey,
    },
    {
        slug: "assets",
        icon: Images,
    },
    {
        slug: "config",
        icon: Settings2,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];

export function isNavigationToolEnabled(tool: (typeof navigationTools)[number]) {
    return !("featureFlag" in tool) || isFeatureEnabled(tool.featureFlag);
}
