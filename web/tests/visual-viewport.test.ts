import { expect, test } from "bun:test";

import { focusedFieldNeedsReveal } from "../src/hooks/use-keep-focused-field-visible";

test("focused fields are revealed only when the visual viewport clips them", () => {
    const viewport = { top: 0, bottom: 500 };
    expect(focusedFieldNeedsReveal({ top: 200, bottom: 300 }, viewport)).toBe(false);
    expect(focusedFieldNeedsReveal({ top: 470, bottom: 545 }, viewport)).toBe(true);
    expect(focusedFieldNeedsReveal({ top: -8, bottom: 72 }, viewport)).toBe(true);
    expect(focusedFieldNeedsReveal({ top: 16, bottom: 484 }, viewport)).toBe(false);
});
