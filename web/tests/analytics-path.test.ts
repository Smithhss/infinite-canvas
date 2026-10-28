import { expect, test } from "bun:test";

import { sanitizeAnalyticsPath } from "../src/lib/analytics";

test("analytics page paths never include query values or fragments", () => {
    expect(sanitizeAnalyticsPath("/image?mode=image&prompt=private%20prompt#preview")).toBe("/image");
    expect(sanitizeAnalyticsPath("video?prompt=private")).toBe("/video");
    expect(sanitizeAnalyticsPath("//example.com/private?prompt=private")).toBe("/example.com/private");
    expect(sanitizeAnalyticsPath("")).toBe("/");
});
