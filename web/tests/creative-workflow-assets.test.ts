import { expect, test } from "bun:test";

import { workflowResultToAsset } from "../src/lib/creative-workflow-assets";

test("maps a workflow result to a local image asset", () => {
    const asset = workflowResultToAsset({
        title: "海报",
        storageKey: "image:abc",
        dataUrl: "blob:test",
        width: 1024,
        height: 1024,
        bytes: 100,
        mimeType: "image/png",
        source: "workflow:run-1",
    });
    expect(asset.kind).toBe("image");
    expect(asset.source).toBe("workflow:run-1");
    expect(asset.data.storageKey).toBe("image:abc");
});
