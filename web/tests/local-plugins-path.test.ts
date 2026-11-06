import { expect, test } from "bun:test";

import { localPluginAssetPath, localPluginManifestPath } from "../src/lib/canvas/local-plugins";

test("local plugin paths include the deployment base", () => {
    expect(localPluginManifestPath("/")).toBe("/local-plugins/index.json");
    expect(localPluginManifestPath("/infinite-canvas/")).toBe("/infinite-canvas/local-plugins/index.json");
    expect(localPluginAssetPath("/infinite-canvas/", "markdown.js")).toBe("/infinite-canvas/local-plugins/markdown.js");
});
