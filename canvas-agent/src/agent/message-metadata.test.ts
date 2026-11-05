import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { withAttachmentContext } from "./claude-attachments.js";
import { normalizeClaudeHistory } from "./claude-sessions.js";
import { MessageMetadataStore } from "./message-metadata.js";

test("message metadata survives Agent restarts", async (context) => {
    const fixture = await createFixture(context);
    await fixture.store.recordPending("message-1", sampleMetadata());
    await fixture.store.bindThread("message-1", "thread-1");
    await fixture.store.bindTurn("message-1", "thread-1", "turn-1");

    const [message] = await fixture.reopen().mergeThread("thread-1", [{ role: "user", threadId: "thread-1", turnId: "turn-1", text: "Generate product images" }]);
    assert.equal(message.clientMessageId, "message-1");
    assert.equal(message.attachments?.[0].name, "image.png");
    assert.equal(message.canvasReferences?.[0].nodeId, "node-1");
    assert.equal(message.skill?.name, "product-grid");
});

test("multiple skills survive restarts and keep the legacy first-skill field", async (context) => {
    const fixture = await createFixture(context);
    await fixture.store.recordPending("message-1", {
        skills: [
            { name: "product-grid", path: "D:\\skills\\product-grid\\SKILL.md", displayName: "Product grid" },
            { name: "copy-review", path: "D:\\skills\\copy-review\\SKILL.md", displayName: "Copy review" },
            { name: "product-grid", path: "D:\\skills\\product-grid\\SKILL.md", displayName: "Product grid" },
        ],
    });
    await fixture.store.bindTurn("message-1", "thread-1", "turn-1");

    const [message] = await fixture.reopen().mergeThread("thread-1", [{ role: "user", threadId: "thread-1", turnId: "turn-1", text: "Generate and review" }]);
    assert.equal(message.skill?.name, "product-grid");
    assert.deepEqual(message.skills?.map((skill) => skill.name), ["product-grid", "copy-review"]);
});

test("legacy skill metadata upgrades to a skill list", async (context) => {
    const fixture = await createFixture(context);
    await fixture.store.recordPending("message-1", sampleMetadata());
    await fixture.store.bindTurn("message-1", "thread-1", "turn-1");

    const [message] = await fixture.reopen().mergeThread("thread-1", [{ role: "user", threadId: "thread-1", turnId: "turn-1" }]);
    assert.equal(message.skill?.name, "product-grid");
    assert.deepEqual(message.skills?.map((skill) => skill.name), ["product-grid"]);
});

test("message preview assets survive restarts and are deleted with their thread", async (context) => {
    const fixture = await createFixture(context);
    const metadata = await fixture.store.recordPending("message-1", sampleMetadata());
    await fixture.store.bindTurn("message-1", "thread-1", "turn-1");

    const match = metadata?.attachments?.[0].url.match(/^agent-asset:([a-f0-9]{64})\/([a-f0-9]{64}\.png)$/);
    assert.ok(match);
    const asset = await fixture.reopen().readAsset(match[1], match[2]);
    assert.equal(asset?.contentType, "image/png");
    assert.equal(asset?.data.toString(), "a");

    await fixture.store.removeThread("thread-1");
    assert.equal(await fixture.reopen().readAsset(match[1], match[2]), undefined);
});

test("deleting a thread only removes its metadata", async (context) => {
    const fixture = await createFixture(context);
    for (const number of [1, 2]) {
        await fixture.store.recordPending(`message-${number}`, { skill: { name: `skill-${number}`, path: `D:\\skills\\skill-${number}\\SKILL.md` } });
        await fixture.store.bindTurn(`message-${number}`, `thread-${number}`, `turn-${number}`);
    }
    await fixture.store.removeThread("thread-1");

    const first = await fixture.reopen().mergeThread("thread-1", [{ role: "user", threadId: "thread-1", turnId: "turn-1" }]);
    const second = await fixture.reopen().mergeThread("thread-2", [{ role: "user", threadId: "thread-2", turnId: "turn-2" }]);
    assert.equal(first[0].skill, undefined);
    assert.equal(second[0].skill?.name, "skill-2");
});

test("history metadata is matched by thread and turn instead of client message id alone", async (context) => {
    const fixture = await createFixture(context);
    await fixture.store.recordPending("message-1", { skill: { name: "product-grid", path: "D:\\skills\\product-grid\\SKILL.md" } });
    await fixture.store.bindTurn("message-1", "thread-1", "turn-1");

    const [message] = await fixture.store.mergeThread("thread-1", [{ role: "user", threadId: "thread-1", turnId: "turn-2", clientMessageId: "message-1" }]);
    assert.equal(message.skill, undefined);
});

test("Claude history restores metadata by the SDK user message UUID", async (context) => {
    const fixture = await createFixture(context);
    await fixture.store.recordPending("message-1", sampleMetadata());
    await fixture.store.bindTurn("message-1", "session-1", "user-1");
    const history = normalizeClaudeHistory("session-1", [{
        uuid: "user-1",
        type: "user",
        message: { content: [{ type: "text", text: "比较这两张图" }] },
    }]);

    const [message] = await fixture.store.mergeThread("session-1", history);
    assert.equal(message.clientMessageId, "message-1");
    assert.equal(message.attachments?.[0].name, "image.png");
    assert.equal(message.canvasReferences?.[0].nodeId, "node-1");
});

test("Claude history restores attachment and canvas metadata from a combined context prompt", async (context) => {
    const fixture = await createFixture(context);
    await fixture.store.recordPending("message-1", sampleMetadata());
    await fixture.store.bindTurn("message-1", "session-1", "user-1");
    const prompt = withAttachmentContext([
        "比较这两张图",
        "本轮引用的当前画布素材：",
        '1. mention="@Image_1", nodeId="node-1", title="Product image", type=image',
        "需要读取或操作这些素材时，先调用 canvas_get_state，并使用上面的 nodeId 精确定位，不要按标题猜测节点。",
    ].join("\n\n"), [{ id: "image-1", name: "image.png" }]);
    const history = normalizeClaudeHistory("session-1", [{
        uuid: "user-1",
        type: "user",
        message: { content: [{ type: "text", text: prompt }] },
    }]);

    const [message] = await fixture.store.mergeThread("session-1", history);
    assert.equal(message.text, "比较这两张图");
    assert.equal(message.clientMessageId, "message-1");
    assert.equal(message.attachments?.[0].name, "image.png");
    assert.equal(message.canvasReferences?.[0].nodeId, "node-1");
    assert.equal(message.skill?.name, "product-grid");
    assert.doesNotMatch(JSON.stringify(message), /本轮可用图片附件|本轮引用的当前画布素材/);
});

test("Claude metadata binds thread and turn in one committed record", async (context) => {
    const fixture = await createFixture(context);
    await fixture.store.recordPending("message-1", sampleMetadata());
    await fixture.store.bindThreadAndTurn("message-1", "session-1", "user-1");

    const [message] = await fixture.reopen().mergeThread("session-1", [{ role: "user", threadId: "session-1", turnId: "user-1" }]);
    assert.equal(message.clientMessageId, "message-1");
    assert.equal(message.attachments?.[0].name, "image.png");
});

test("failed Claude metadata binding can remove its pending record", async (context) => {
    const fixture = await createFixture(context);
    await fixture.store.recordPending("message-1", sampleMetadata());
    const threadKey = crypto.createHash("sha256").update("session-1").digest("hex");
    const blocker = path.join(fixture.storeDirectory, "threads", threadKey);
    await fs.writeFile(blocker, "not a directory");

    await assert.rejects(() => fixture.store.bindThreadAndTurn("message-1", "session-1", "user-1"));
    await fixture.store.remove("message-1");
    await fs.rm(blocker);

    const [message] = await fixture.store.mergeThread("session-1", [{ role: "user", threadId: "session-1", turnId: "user-1" }]);
    assert.equal(message.clientMessageId, undefined);
    assert.equal(message.attachments, undefined);
});

test("unknown storage versions are never overwritten", async (context) => {
    const fixture = await createFixture(context, false);
    await fs.mkdir(fixture.storeDirectory, { recursive: true });
    const manifestFile = path.join(fixture.storeDirectory, "manifest.json");
    await fs.writeFile(manifestFile, '{"version":99}');

    await assert.rejects(() => fixture.store.recordPending("message-1", sampleMetadata()), /Unsupported message metadata version/);
    assert.equal(await fs.readFile(manifestFile, "utf8"), '{"version":99}');
});

test("storage without a manifest is never overwritten", async (context) => {
    const fixture = await createFixture(context, false);
    await fs.mkdir(fixture.storeDirectory, { recursive: true });
    const existingFile = path.join(fixture.storeDirectory, "existing.json");
    await fs.writeFile(existingFile, "existing data");

    await assert.rejects(() => fixture.store.mergeThread("thread-1", []), /missing manifest/);
    assert.equal(await fs.readFile(existingFile, "utf8"), "existing data");
});

test("oversized image previews are rejected instead of silently dropped", async (context) => {
    const fixture = await createFixture(context);
    await assert.rejects(
        () => fixture.store.recordPending("message-1", { attachments: [{ id: "image-1", name: "large.png", url: `data:image/png;base64,${"a".repeat(500_001)}` }] }),
        /attachments metadata is invalid/,
    );
});

async function createFixture(context: TestContext, initialize = true) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "canvas-agent-message-metadata-"));
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const storeDirectory = path.join(root, "message-metadata");
    const createStore = () => new MessageMetadataStore(storeDirectory);
    const fixture = { root, storeDirectory, store: createStore(), reopen: createStore };
    if (initialize) await fixture.store.mergeThread("empty", []);
    return fixture;
}

function sampleMetadata() {
    return {
        attachments: [{ id: "image-1", name: "image.png", url: "data:image/png;base64,YQ==" }],
        canvasReferences: [{ nodeId: "node-1", label: "Image 1", title: "Product image", kind: "image", previewUrl: "data:image/png;base64,YQ==" }],
        skill: { name: "product-grid", path: "D:\\skills\\product-grid\\SKILL.md", displayName: "Product grid" },
    };
}
