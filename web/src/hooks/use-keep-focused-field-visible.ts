import { useEffect } from "react";

const EDITABLE_SELECTOR = [
    "textarea",
    '[contenteditable="true"]',
    'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"])',
].join(",");

export function focusedFieldNeedsReveal(field: { top: number; bottom: number }, viewport: { top: number; bottom: number }, margin = 16) {
    return field.top < viewport.top + margin || field.bottom > viewport.bottom - margin;
}

export function useKeepFocusedFieldVisible() {
    useEffect(() => {
        let frame = 0;
        const reveal = () => {
            const focused = document.activeElement;
            if (!(focused instanceof HTMLElement) || !focused.matches(EDITABLE_SELECTOR)) return;

            const visualViewport = window.visualViewport;
            const viewportTop = visualViewport?.offsetTop ?? 0;
            const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight);
            const rect = focused.getBoundingClientRect();
            if (!focusedFieldNeedsReveal({ top: rect.top, bottom: rect.bottom }, { top: viewportTop, bottom: viewportBottom })) return;

            focused.scrollIntoView({ block: "nearest", inline: "nearest" });
        };
        const scheduleReveal = () => {
            window.cancelAnimationFrame(frame);
            reveal();
            frame = window.requestAnimationFrame(reveal);
        };

        window.addEventListener("resize", scheduleReveal);
        document.addEventListener("focusin", scheduleReveal);
        window.visualViewport?.addEventListener("resize", scheduleReveal);
        window.visualViewport?.addEventListener("scroll", scheduleReveal);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("resize", scheduleReveal);
            document.removeEventListener("focusin", scheduleReveal);
            window.visualViewport?.removeEventListener("resize", scheduleReveal);
            window.visualViewport?.removeEventListener("scroll", scheduleReveal);
        };
    }, []);
}
