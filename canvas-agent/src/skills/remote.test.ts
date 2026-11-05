import assert from "node:assert/strict";
import test from "node:test";

import { previewGithubSkill, searchGithubSkillRepositories, SkillRemoteError } from "./remote.js";

test("搜索 GitHub 公开仓库并规范化结果", async () => {
    let requested = "";
    const results = await searchGithubSkillRepositories("product grid", async (input) => {
        requested = String(input);
        return jsonResponse({
            items: [{
                full_name: "example/product-grid",
                html_url: "https://github.com/example/product-grid",
                description: "Product image workflows",
                stargazers_count: 42,
                default_branch: "main",
                updated_at: "2026-11-01T00:00:00Z",
            }],
        });
    });
    assert.match(requested, /search\/repositories/);
    assert.match(requested, /q=product\+grid\+topic%3Aagent-skills\+in%3Aname%2Cdescription%2Creadme/);
    assert.deepEqual(results, [{
        repository: "example/product-grid",
        url: "https://github.com/example/product-grid",
        description: "Product image workflows",
        stars: 42,
        defaultBranch: "main",
        updatedAt: "2026-11-01T00:00:00Z",
    }]);
});

test("从仓库定位并解析唯一的 SKILL.md", async () => {
    const requests: string[] = [];
    const preview = await previewGithubSkill("https://github.com/example/product-grid", async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.endsWith("/repos/example/product-grid")) return jsonResponse({ default_branch: "main", private: false });
        if (url.includes("/git/trees/main")) return jsonResponse({ tree: [{ path: "skills/product-grid/SKILL.md", type: "blob" }] });
        return textResponse("---\nname: product-grid\ndescription: 生成商品图\n---\n\n按商品资料生成九宫格。\n");
    });
    assert.deepEqual(preview, {
        name: "product-grid",
        description: "生成商品图",
        instructions: "按商品资料生成九宫格。",
        repository: "example/product-grid",
        path: "skills/product-grid/SKILL.md",
        sourceUrl: "https://github.com/example/product-grid/blob/main/skills/product-grid/SKILL.md",
        contentHash: "3b806fa783bec7ae267bc19c673b42f32179fc1e13619e5d78dc3b4cb561d044",
    });
    assert.match(requests.at(-1) || "", /raw\.githubusercontent\.com/);
});

test("拒绝非 GitHub 地址、多个 Skill 和过大的远端文件", async () => {
    await assert.rejects(previewGithubSkill("https://example.com/skill", async () => textResponse("")), (error: unknown) => error instanceof SkillRemoteError && error.statusCode === 400);
    await assert.rejects(previewGithubSkill("https://github.com/example/many", async (input) => {
        const url = String(input);
        if (url.endsWith("/repos/example/many")) return jsonResponse({ default_branch: "main" });
        return jsonResponse({ tree: [{ path: "a/SKILL.md", type: "blob" }, { path: "b/SKILL.md", type: "blob" }] });
    }), /多个 Skill/);
    await assert.rejects(previewGithubSkill("https://raw.githubusercontent.com/example/one/main/SKILL.md", async () => textResponse("x".repeat(256 * 1024 + 1))), /256KiB/);
});

function jsonResponse(value: unknown) {
    return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function textResponse(value: string) {
    return new Response(value, { status: 200, headers: { "content-type": "text/plain" } });
}
