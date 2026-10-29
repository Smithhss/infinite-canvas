import { expect, test } from "bun:test";

import { isPlatformProvider, providerAllowed, readProviderPolicy } from "../src/lib/provider-policy";

test("closed policy accepts only the platform origin and standard API roots", () => {
    for (const base of ["https://canvas.test", "https://canvas.test/v1/", "https://canvas.test/v1beta"]) {
        expect(isPlatformProvider(base, "https://canvas.test")).toBe(true);
    }
    for (const base of ["https://api.openai.com/v1", "https://canvas.test.evil.test/v1", "https://canvas.test/other", "https://user:pass@canvas.test/v1", "https://canvas.test/v1?target=evil", "https://canvas.test/v1#secret", "not-a-url"]) {
        expect(providerAllowed(false, base, "https://canvas.test")).toBe(false);
    }
    expect(providerAllowed(false, "https://canvas.test/v1", "https://canvas.test", true)).toBe(false);
    expect(providerAllowed(true, "https://api.openai.com/v1", "https://canvas.test", true)).toBe(true);
});

test("policy reads do not send credentials and cannot accept malformed or SPA responses", async () => {
    const valid = (enabled: boolean) => (async (path, init) => {
        expect(path).toBe("/api/creative/config");
        expect(init?.credentials).toBe("omit");
        expect(init?.cache).toBe("no-store");
        return Response.json({ success: true, data: { allow_external_providers: enabled } });
    }) as typeof fetch;
    expect(await readProviderPolicy(valid(false))).toBe(false);
    expect(await readProviderPolicy(valid(true))).toBe(true);
    for (const response of [new Response("<html>SPA</html>"), Response.json({ success: false }), Response.json({ success: true, data: { allow_external_providers: "true" } }), new Response("", { status: 503 })]) {
        await expect(readProviderPolicy((async () => response) as typeof fetch)).rejects.toThrow();
    }
});
