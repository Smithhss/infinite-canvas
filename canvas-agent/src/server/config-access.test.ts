import assert from "node:assert/strict";
import test from "node:test";

import { isLocalConfigOrigin } from "./config-access.js";

test("local config origins include loopback hosts", () => {
    assert.equal(isLocalConfigOrigin("http://localhost:3000"), true);
    assert.equal(isLocalConfigOrigin("https://app.localhost"), true);
    assert.equal(isLocalConfigOrigin("http://127.0.0.1:4185"), true);
    assert.equal(isLocalConfigOrigin("http://[::1]:4185"), true);
});

test("local config origins reject remote, opaque and invalid origins", () => {
    assert.equal(isLocalConfigOrigin("https://canvas.example.com"), false);
    assert.equal(isLocalConfigOrigin("null"), false);
    assert.equal(isLocalConfigOrigin(""), false);
    assert.equal(isLocalConfigOrigin(undefined), false);
});
