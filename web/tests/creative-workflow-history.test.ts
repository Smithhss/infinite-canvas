import { expect, test } from "bun:test";

import { appendWorkflowRun, MAX_WORKFLOW_RUNS, normalizeWorkflowRuns } from "../src/lib/creative-workflow-history";

test("keeps valid summaries and strips transient image data", () => {
    const runs = normalizeWorkflowRuns([
        {
            id: "run-1",
            templateId: "template-1",
            templateName: "海报",
            status: "succeeded",
            inputs: { subject: "花" },
            referenceKeys: ["image:one"],
            requestIds: ["request-1"],
            taskIds: [],
            generations: 1,
            startedAt: "2026-10-27T00:00:00.000Z",
            images: [{ id: "image", dataUrl: "data:image/png;base64,AA==", prompt: "x", taskIds: [] }],
        },
        null,
        { id: "bad" },
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0].images).toBeUndefined();
    expect(runs[0].referenceKeys).toEqual(["image:one"]);
    expect(MAX_WORKFLOW_RUNS).toBe(200);
});

test("newest run is kept first", () => {
    const next = appendWorkflowRun([], {
        id: "run-1",
        templateId: "template-1",
        templateName: "海报",
        status: "succeeded",
        inputs: {},
        referenceKeys: [],
        requestIds: [],
        taskIds: [],
        generations: 1,
        startedAt: "2026-10-27T00:00:00.000Z",
        endedAt: "2026-10-27T00:00:01.000Z",
    });
    expect(next[0].id).toBe("run-1");
});
