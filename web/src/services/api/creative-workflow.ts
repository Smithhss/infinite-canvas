import { requestEdit, requestGeneration } from "@/services/api/image";
import type { AiConfig } from "@/stores/use-config-store";
import type { WorkflowExecutionAdapter } from "@/lib/creative-workflow-runner";

export function createWorkflowImageAdapter(config: AiConfig, model: string): WorkflowExecutionAdapter {
    return {
        async generateImage(input, signal) {
            let requestId: string | undefined;
            const requestConfig = {
                ...config,
                model,
                imageModel: model,
                quality: input.params.quality,
                size: input.params.size,
                count: "1",
                background: input.params.background || "",
            };
            const images = input.references.length
                ? await requestEdit(requestConfig, input.prompt, input.references, { signal, onRequestId: (id) => { requestId = id; } })
                : await requestGeneration(requestConfig, input.prompt, { signal, onRequestId: (id) => { requestId = id; } });
            return {
                images: images.map((image) => image.dataUrl),
                ...(requestId ? { requestId } : {}),
            };
        },
    };
}
