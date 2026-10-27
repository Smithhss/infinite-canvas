import { expect, test } from "bun:test";

import { normalizeWorkflowTemplate } from "../src/lib/creative-workflow";
import { MAX_WORKFLOW_IMPORT_BYTES, parseWorkflowExport, serializeWorkflowExport } from "../src/lib/creative-workflow-storage";

const workflow = normalizeWorkflowTemplate({
    id: "one",
    name: "海报",
    promptTemplate: "画 {{subject}}",
    variables: [{ id: "s", key: "subject", label: "主体", type: "text", required: true, defaultValue: "", options: [] }],
});

test("round-trips a workflow export without API credentials", () => {
    const text = serializeWorkflowExport([{ ...workflow, apiKey: "secret" } as typeof workflow]);
    const parsed = parseWorkflowExport(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("one");
    expect(text).not.toContain("secret");
});

test("rejects unknown versions and duplicate ids", () => {
    expect(() => parseWorkflowExport(JSON.stringify({ app: "infinite-canvas", version: 2, workflows: [] }))).toThrow("unsupported-version");
    expect(() => parseWorkflowExport(serializeWorkflowExport([workflow, workflow]))).toThrow("duplicate-workflow-id");
});

test("rejects oversized imports", () => {
    expect(MAX_WORKFLOW_IMPORT_BYTES).toBe(10 * 1024 * 1024);
    expect(() => parseWorkflowExport("x".repeat(MAX_WORKFLOW_IMPORT_BYTES + 1))).toThrow("file-too-large");
});
