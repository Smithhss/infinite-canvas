import { expect, test } from "bun:test";

import { selectTextModel } from "../src/lib/model-selection";
import type { AiConfig } from "../src/stores/use-config-store";

const config = {
    model: "gpt-image-2",
    textModel: "",
} as Pick<AiConfig, "model" | "textModel">;

test("text requests use the configured text model", () => {
    expect(selectTextModel({ ...config, textModel: "gpt-5.5" })).toBe("gpt-5.5");
});

test("text requests do not fall back to an image model", () => {
    expect(selectTextModel(config)).toBe("");
});
