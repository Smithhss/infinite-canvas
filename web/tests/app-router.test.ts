import { expect, test } from "bun:test";

import { routerBasename } from "../src/lib/app-router";

test("router basename follows the deployed Vite base", () => {
    expect(routerBasename("/")).toBeUndefined();
    expect(routerBasename("/infinite-canvas/")).toBe("/infinite-canvas");
    expect(routerBasename("/infinite-canvas")).toBe("/infinite-canvas");
});
