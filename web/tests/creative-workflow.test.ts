import { expect, test } from "bun:test";

import {
    createBlankWorkflow,
    normalizeWorkflowTemplate,
    renderWorkflowPrompt,
    validateWorkflowInputs,
    type WorkflowTemplate,
} from "../src/lib/creative-workflow";

const input: WorkflowTemplate = {
    schemaVersion: 1,
    id: "workflow-poster",
    name: "电商海报",
    description: "固定商业摄影质感和营销文案结构",
    taskType: "image",
    promptTemplate: "为 {{product_name}} 生成一张电商海报，突出 {{selling_points}}",
    variables: [
        { id: "product", key: "product_name", label: "产品名称", type: "text", required: true, defaultValue: "", options: [] },
        { id: "selling", key: "selling_points", label: "卖点", type: "textarea", required: true, defaultValue: "", options: [] },
    ],
    model: "default::gpt-image-2",
    params: { size: "1:1", quality: "auto", count: 1, background: "opaque" },
    createdAt: "2026-10-27T00:00:00.000Z",
    updatedAt: "2026-10-27T00:00:00.000Z",
};

test("normalizes a workflow and keeps only supported fields", () => {
    const template = normalizeWorkflowTemplate({ ...input, unknown: "drop-me" });
    expect(template.id).toBe("workflow-poster");
    expect(template.schemaVersion).toBe(1);
    expect(template.variables).toHaveLength(2);
    expect((template as WorkflowTemplate & { unknown?: string }).unknown).toBeUndefined();
});

test("renders variables and reports required values", () => {
    const template = normalizeWorkflowTemplate(input);
    expect(renderWorkflowPrompt(template, { product_name: "咖啡杯", selling_points: "保温" })).toContain("咖啡杯");
    const validation = validateWorkflowInputs(template, { product_name: "咖啡杯", selling_points: "" });
    expect(validation.ok).toBe(false);
    expect(validation.missingKeys).toEqual(["selling_points"]);
});

test("validates number and select variables", () => {
    const template = normalizeWorkflowTemplate({
        promptTemplate: "生成 {{count}} 张 {{style}}",
        variables: [
            { key: "count", type: "number", required: true },
            { key: "style", type: "select", required: true, options: ["写实", "插画"] },
        ],
    });
    const validation = validateWorkflowInputs(template, { count: "abc", style: "未知" });
    expect(validation.errors).toContain("invalid-number:count");
    expect(validation.errors).toContain("invalid-option:style");
});

test("a blank workflow is editable and normalization does not mutate the source", () => {
    const workflow = createBlankWorkflow();
    expect(workflow.schemaVersion).toBe(1);
    expect(workflow.taskType).toBe("image");
    expect(workflow.params.count).toBe(1);
    const source = { name: "A", promptTemplate: "B" };
    normalizeWorkflowTemplate(source);
    expect(source).toEqual({ name: "A", promptTemplate: "B" });
});
