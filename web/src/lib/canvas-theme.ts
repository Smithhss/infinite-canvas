export type CanvasColorTheme = "light" | "dark";
export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export const canvasThemes = {
    light: {
        canvas: {
            background: "#f4f2ed",
            dot: "rgba(68,64,60,.28)",
            line: "rgba(68,64,60,.12)",
            selectionStroke: "#1c1917",
            selectionFill: "rgba(28,25,23,.06)",
        },
        node: {
            label: "#57534e",
            fill: "#e7e5df",
            panel: "#fbfaf7",
            stroke: "#d6d3ca",
            activeStroke: "#1c1917",
            placeholder: "#8a8479",
            text: "#292524",
            muted: "#78716c",
            faint: "#a8a29e",
        },
        toolbar: {
            panel: "rgba(251,250,247,.96)",
            floating: "rgba(251,250,247,.98)",
            border: "#d6d3ca",
            item: "#57534e",
            itemHover: "#e7e5df",
            activeBg: "#e7e5df",
            activeText: "#292524",
        },
        group: {
            fill: "rgba(109,40,217,.055)",
            stroke: "rgba(109,40,217,.22)",
            activeStroke: "#6d28d9",
            labelFill: "rgba(109,40,217,.86)",
            labelText: "#ffffff",
        },
    },
    dark: {
        canvas: {
            background: "#1a1a1a",
            dot: "#474747",
            line: "rgba(255,255,255,.06)",
            selectionStroke: "#a8a8a8",
            selectionFill: "rgba(255,255,255,.06)",
        },
        node: {
            label: "#d8d8d8",
            fill: "#191e26",
            panel: "#1f1f1f",
            stroke: "#363636",
            activeStroke: "#a8a8a8",
            placeholder: "#919191",
            text: "#f7f7f7",
            muted: "#919191",
            faint: "#6f6f6f",
        },
        toolbar: {
            panel: "#171717",
            floating: "#262626",
            border: "#363636",
            item: "#ffffffd9",
            itemHover: "#ffffff1a",
            activeBg: "#ffffff26",
            activeText: "#ffffff",
        },
        group: {
            fill: "rgba(139,92,246,.10)",
            stroke: "rgba(139,92,246,.22)",
            activeStroke: "#a78bfa",
            labelFill: "#2e1b63",
            labelText: "#ffffff",
        },
    },
} as const;

export type CanvasTheme = (typeof canvasThemes)[CanvasColorTheme];
