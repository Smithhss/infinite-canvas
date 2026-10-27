import { expect, test } from "bun:test";

import { normalizeWorkflowTemplate } from "../src/lib/creative-workflow";
import { executeWorkflow, runWithConcurrency, type WorkflowExecutionAdapter } from "../src/lib/creative-workflow-runner";

const template = normalizeWorkflowTemplate({
    id: "one",
    taskType: "image",
    promptTemplate: "画 {{subject}}",
    variables: [{ id: "s", key: "subject", label: "主体", type: "text", required: true, defaultValue: "", options: [] }],
    params: { count: 2, size: "1:1", quality: "auto" },
});

test("runs the requested image count and records request ids", async () => {
    const calls: string[] = [];
    const adapter: WorkflowExecutionAdapter = {
        async generateImage(input) {
            calls.push(input.prompt);
            return { images: ["data:image/png;base64,AA=="], requestId: `request-${calls.length}` };
        },
    };
    const run = await executeWorkflow({ template, values: { subject: "花" }, references: [], adapter, count: 2 });
    expect(calls).toHaveLength(2);
    expect(run.status).toBe("succeeded");
    expect(run.generations).toBe(2);
    expect(run.requestIds).toEqual(["request-1", "request-2"]);
});

test("respects cancellation before starting a request", async () => {
    const controller = new AbortController();
    controller.abort();
    const adapter: WorkflowExecutionAdapter = { async generateImage() { throw new Error("should-not-run"); } };
    const run = await executeWorkflow({ template, values: { subject: "花" }, references: [], adapter, count: 1, signal: controller.signal });
    expect(run.status).toBe("canceled");
    expect(run.generations).toBe(0);
});

test("keeps successful images when another call fails", async () => {
    let call = 0;
    const adapter: WorkflowExecutionAdapter = {
        async generateImage() {
            call += 1;
            if (call === 1) return { images: ["data:image/png;base64,AA=="] };
            throw new Error("upstream failed");
        },
    };
    const run = await executeWorkflow({ template, values: { subject: "花" }, references: [], adapter, count: 2 });
    expect(run.status).toBe("partial");
    expect(run.generations).toBe(1);
    expect(run.error).toContain("upstream failed");
});

test("never exceeds three concurrent calls", async () => {
    let active = 0;
    let peak = 0;
    const results = await runWithConcurrency({
        items: [1, 2, 3, 4, 5],
        concurrency: 5,
        runOne: async (item) => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active -= 1;
            return item;
        },
    });
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(peak).toBe(3);
});
