import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createProxyServer } from "./index.js";

function listen(server) {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            resolve(address.port);
        });
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections?.();
    });
}

test("root reports the package identity", async () => {
    const proxy = createProxyServer();
    const port = await listen(proxy);
    try {
        const response = await fetch(`http://127.0.0.1:${port}/`);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.app, "infinite-canvas");
        assert.equal(body.proxy, "@smithhsiiiii/canvas-proxy");
        assert.match(body.version, /^\d+\.\d+\.\d+$/);
    } finally {
        await close(proxy);
    }
});

test("forwards method, path, headers, body and upstream status", async () => {
    const upstream = createServer((request, response) => {
        const chunks = [];
        request.on("data", (chunk) => chunks.push(chunk));
        request.on("end", () => {
            response.writeHead(201, { "content-type": "application/json", "x-upstream": "yes" });
            response.end(
                JSON.stringify({
                    method: request.method,
                    url: request.url,
                    body: Buffer.concat(chunks).toString("utf8"),
                    testHeader: request.headers["x-test"],
                }),
            );
        });
    });
    const upstreamPort = await listen(upstream);
    const proxy = createProxyServer();
    const proxyPort = await listen(proxy);
    try {
        const target = `http://127.0.0.1:${upstreamPort}/echo?value=1`;
        const response = await fetch(`http://127.0.0.1:${proxyPort}/${target}`, {
            method: "POST",
            headers: { "content-type": "text/plain", "x-test": "forwarded" },
            body: "payload",
        });
        assert.equal(response.status, 201);
        assert.equal(response.headers.get("x-upstream"), "yes");
        assert.deepEqual(await response.json(), {
            method: "POST",
            url: "/echo?value=1",
            body: "payload",
            testHeader: "forwarded",
        });
    } finally {
        await close(proxy);
        await close(upstream);
    }
});

test("replies to CORS preflight without forwarding", async () => {
    const proxy = createProxyServer();
    const port = await listen(proxy);
    try {
        const response = await fetch(`http://127.0.0.1:${port}/https://example.com`, { method: "OPTIONS" });
        assert.equal(response.status, 204);
        assert.equal(response.headers.get("access-control-allow-origin"), "*");
    } finally {
        await close(proxy);
    }
});

test("runs through an npm-style executable symlink", async () => {
    const directory = await mkdtemp(join(tmpdir(), "canvas-proxy-"));
    try {
        const executable = join(directory, "canvas-proxy");
        await symlink(fileURLToPath(new URL("./index.js", import.meta.url)), executable);
        const result = spawnSync(process.execPath, [executable, "--help"], { encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /@smithhsiiiii\/canvas-proxy v\d+\.\d+\.\d+/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
