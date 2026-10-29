import { expect, test } from "bun:test";

import { MAX_PANORAMA_SOURCE_BYTES, normalizePanoramaSource } from "../src/lib/canvas/panorama-source";

test("accepts local image sources only", () => {
    expect(normalizePanoramaSource("blob:http://localhost/panorama")).toBe("blob:http://localhost/panorama");
    expect(normalizePanoramaSource("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(normalizePanoramaSource("data:image/jpeg;base64,/9j/4AAQ")).toBe("data:image/jpeg;base64,/9j/4AAQ");
});

test("rejects remote, executable and non-image sources", () => {
    expect(normalizePanoramaSource("https://example.com/panorama.jpg")).toBeNull();
    expect(normalizePanoramaSource("http://example.com/panorama.jpg")).toBeNull();
    expect(normalizePanoramaSource("javascript:alert(1)")).toBeNull();
    expect(normalizePanoramaSource("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(normalizePanoramaSource("file:///tmp/panorama.jpg")).toBeNull();
});

test("rejects panorama sources above the local size limit", () => {
    const payloadLength = Math.ceil(((MAX_PANORAMA_SOURCE_BYTES + 3) * 4) / 3);
    expect(normalizePanoramaSource(`data:image/jpeg;base64,${"A".repeat(payloadLength)}`)).toBeNull();
});
