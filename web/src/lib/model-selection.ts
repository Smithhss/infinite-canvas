import type { AiConfig } from "@/stores/use-config-store";

export function selectTextModel(config: Pick<AiConfig, "textModel">) {
    return config.textModel.trim();
}
