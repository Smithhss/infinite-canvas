import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("package metadata keeps the published CLI contract", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
        name: string;
        version: string;
        bin: Record<string, string>;
        files: string[];
    };

    assert.equal(pkg.name, "@smithhsiiiii/canvas-agent");
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
    assert.equal(pkg.bin["canvas-agent"], "dist/index.js");
    assert.ok(pkg.files.includes("dist"));
    assert.ok(pkg.files.includes("agent-instructions.md"));
});
