import { expect, test } from "bun:test";

import { builtinActionNeedsMaterialization, materializeBuiltinAttachment, requestBuiltinActionConfirmation } from "../src/lib/canvas/builtin-canvas-agent/attachments";

test("read-only actions never materialize attachments", () => {
    expect(builtinActionNeedsMaterialization({ name: "get_canvas_summary", args: {} })).toBe(false);
    expect(builtinActionNeedsMaterialization({ name: "create_text_node", args: { title: "A", content: "B", position: { x: 0, y: 0 } } })).toBe(true);
});

test("an attachment is materialized at most once", async () => {
    const materialized = new Set<string>();
    let calls = 0;
    const materializer = async () => {
        calls += 1;
        return { id: "node-1", type: "image", title: "Image", position: { x: 0, y: 0 }, width: 10, height: 10 };
    };
    const reference = { id: "attachment-1", type: "image", title: "Image" };
    expect(await materializeBuiltinAttachment(reference, materialized, materializer)).not.toBeNull();
    expect(await materializeBuiltinAttachment(reference, materialized, materializer)).toBeNull();
    expect(calls).toBe(1);
});

test("a failed materializer does not mark the attachment complete", async () => {
    const materialized = new Set<string>();
    const reference = { id: "attachment-2", type: "image", title: "Image" };
    await expect(materializeBuiltinAttachment(reference, materialized, async () => { throw new Error("read-failed"); })).rejects.toThrow("read-failed");
    expect(materialized.has(reference.id)).toBe(false);
});

test("confirmation includes target titles and payment state", () => {
    const nodes = [{ id: "node-1", title: "角色设定" }] as never;
    const update = requestBuiltinActionConfirmation({ name: "update_text_node", args: { id: "node-1", content: "更新" } }, { steps: 0, writeActions: 0, mediaTasks: 0, imageOutputs: 0 }, nodes);
    expect(update.targetTitles).toEqual(["角色设定"]);
    expect(update.requiresPayment).toBe(false);

    const run = requestBuiltinActionConfirmation({ name: "run_node", args: { nodeId: "node-1", mode: "image" } }, { steps: 0, writeActions: 0, mediaTasks: 0, imageOutputs: 0 }, nodes);
    expect(run.requiresPayment).toBe(true);
    expect(run.mediaTasks).toBe(1);
});
