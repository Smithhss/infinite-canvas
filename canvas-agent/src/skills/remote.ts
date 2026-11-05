import { parseSkillMarkdown, SkillStoreError } from "./store.js";

const GITHUB_API = "https://api.github.com";
const MAX_API_BYTES = 4 * 1024 * 1024;
const MAX_SKILL_BYTES = 256 * 1024;
const MAX_SEARCH_RESULTS = 10;
const REQUEST_TIMEOUT_MS = 15_000;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type RemoteSkillSearchResult = {
    repository: string;
    url: string;
    description: string;
    stars: number;
    defaultBranch: string;
    updatedAt: string;
};

export type RemoteSkillPreview = {
    name: string;
    description: string;
    instructions: string;
    repository: string;
    path: string;
    sourceUrl: string;
};

type GithubSource = {
    owner: string;
    repository: string;
    ref?: string;
    path?: string;
    raw?: boolean;
};

/** 搜索 GitHub 公开仓库；真正的 Skill 结构在预览阶段再校验。 */
export async function searchGithubSkillRepositories(queryValue: string, fetchImpl: FetchLike = fetch): Promise<RemoteSkillSearchResult[]> {
    const query = queryValue.trim();
    if (query.length < 2) throw new SkillRemoteError("请输入至少 2 个字符的搜索关键词", 400);
    if (query.length > 80) throw new SkillRemoteError("搜索关键词不能超过 80 个字符", 400);
    const url = new URL(`${GITHUB_API}/search/repositories`);
    url.searchParams.set("q", `${query} topic:agent-skills in:name,description,readme`);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", String(MAX_SEARCH_RESULTS));
    const data = await githubJson(url, fetchImpl);
    const items = Array.isArray(data.items) ? data.items : [];
    return items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const repo = item as Record<string, unknown>;
        const repository = typeof repo.full_name === "string" ? repo.full_name : "";
        const htmlUrl = typeof repo.html_url === "string" ? repo.html_url : "";
        if (!repository || !htmlUrl) return [];
        return [{
            repository,
            url: htmlUrl,
            description: typeof repo.description === "string" ? repo.description : "",
            stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
            defaultBranch: typeof repo.default_branch === "string" ? repo.default_branch : "main",
            updatedAt: typeof repo.updated_at === "string" ? repo.updated_at : "",
        }];
    });
}

/** 从 GitHub 仓库、目录、文件或 raw URL 读取并校验一份 SKILL.md。 */
export async function previewGithubSkill(sourceValue: string, fetchImpl: FetchLike = fetch): Promise<RemoteSkillPreview> {
    const source = parseGithubSource(sourceValue);
    const repository = `${source.owner}/${source.repository}`;
    let ref = source.ref;
    let skillPath = source.path && isSkillFile(source.path) ? source.path : undefined;
    if (source.raw && !skillPath) throw new SkillRemoteError("GitHub raw 链接必须指向 SKILL.md", 400);
    if (!ref) ref = await defaultBranch(repository, fetchImpl);
    if (!skillPath) {
        const tree = await githubJson(new URL(`${GITHUB_API}/repos/${repository}/git/trees/${encodeURIComponent(ref)}?recursive=1`), fetchImpl);
        if (tree.truncated === true) throw new SkillRemoteError("仓库文件过多，无法安全解析 Skill", 409);
        skillPath = findSkillPath(tree, source.path);
    }
    const rawUrl = `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(ref)}/${skillPath.split("/").map(encodeURIComponent).join("/")}`;
    const raw = await fetchText(rawUrl, fetchImpl, MAX_SKILL_BYTES, "Skill 文件");
    const parsed = parseSkillMarkdown(raw);
    return {
        name: parsed.name,
        description: parsed.description,
        instructions: parsed.instructions,
        repository,
        path: skillPath,
        sourceUrl: `https://github.com/${repository}/blob/${encodeURIComponent(ref)}/${skillPath}`,
    };
}

export class SkillRemoteError extends SkillStoreError {
    override name = "SkillRemoteError";
    constructor(message: string, statusCode: 400 | 404 | 409 | 429 | 502 | 504) {
        super(message, statusCode);
    }
}

function parseGithubSource(value: string): GithubSource {
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        throw new SkillRemoteError("请输入有效的 GitHub 链接", 400);
    }
    if (url.protocol !== "https:") throw new SkillRemoteError("只支持 HTTPS GitHub 链接", 400);
    const segments = url.pathname.split("/").filter(Boolean).map(decodePathSegment);
    if (url.hostname === "raw.githubusercontent.com") {
        if (segments.length < 4) throw new SkillRemoteError("GitHub raw 链接缺少文件路径", 400);
        const [owner, repository, ref, ...pathParts] = segments;
        return { owner, repository, ref, path: pathParts.join("/"), raw: true };
    }
    if (url.hostname !== "github.com" || segments.length < 2) throw new SkillRemoteError("只支持 github.com 公开仓库链接", 400);
    const [owner, repository, kind, ref, ...pathParts] = segments;
    if (!kind) return { owner, repository };
    if ((kind !== "tree" && kind !== "blob") || !ref || (kind === "blob" && !pathParts.length)) {
        throw new SkillRemoteError("GitHub 链接格式无效", 400);
    }
    return { owner, repository, ref, path: pathParts.join("/") };
}

function decodePathSegment(value: string) {
    let decoded: string;
    try {
        decoded = decodeURIComponent(value);
    } catch {
        throw new SkillRemoteError("GitHub 链接路径无效", 400);
    }
    if (!decoded || decoded === "." || decoded === ".." || decoded.includes("\\") || decoded.includes("\0")) {
        throw new SkillRemoteError("GitHub 链接路径无效", 400);
    }
    return decoded;
}

async function defaultBranch(repository: string, fetchImpl: FetchLike) {
    const data = await githubJson(new URL(`${GITHUB_API}/repos/${repository}`), fetchImpl);
    if (data.private === true) throw new SkillRemoteError("暂不支持安装私有仓库 Skill", 400);
    const branch = typeof data.default_branch === "string" ? data.default_branch.trim() : "";
    if (!branch) throw new SkillRemoteError("无法读取 GitHub 仓库默认分支", 502);
    return branch;
}

function findSkillPath(tree: Record<string, unknown>, directory?: string) {
    const prefix = directory ? `${directory.replace(/\/+$/, "")}/` : "";
    const entries = Array.isArray(tree.tree) ? tree.tree : [];
    const candidates = entries.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const filePath = typeof item.path === "string" ? item.path : "";
        if (item.type !== "blob" || !isSkillFile(filePath) || !filePath.startsWith(prefix)) return [];
        return [filePath];
    });
    if (!candidates.length) throw new SkillRemoteError("该仓库没有找到 SKILL.md", 404);
    if (candidates.length > 1) throw new SkillRemoteError("该仓库包含多个 Skill，请在链接中指定具体目录", 409);
    return candidates[0];
}

function isSkillFile(value: string) {
    return value === "SKILL.md" || value.endsWith("/SKILL.md");
}

async function githubJson(url: URL, fetchImpl: FetchLike) {
    const response = await request(url, fetchImpl);
    if (response.status === 429 || response.status === 403) throw new SkillRemoteError("GitHub 请求过于频繁，请稍后重试", 429);
    if (!response.ok) throw new SkillRemoteError(`GitHub 请求失败（${response.status}）`, response.status === 404 ? 404 : 502);
    const text = await readResponseText(response, MAX_API_BYTES, "GitHub 响应");
    try {
        const value = JSON.parse(text);
        return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    } catch {
        throw new SkillRemoteError("GitHub 返回内容格式无效", 502);
    }
}

async function fetchText(url: string, fetchImpl: FetchLike, maxBytes: number, label: string) {
    const response = await request(url, fetchImpl);
    if (response.status === 429 || response.status === 403) throw new SkillRemoteError("GitHub 请求过于频繁，请稍后重试", 429);
    if (!response.ok) throw new SkillRemoteError(`${label}读取失败（${response.status}）`, response.status === 404 ? 404 : 502);
    return await readResponseText(response, maxBytes, label);
}

async function request(url: string | URL, fetchImpl: FetchLike) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetchImpl(url, {
            redirect: "error",
            signal: controller.signal,
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "infinite-canvas-skill-installer",
            },
        });
    } catch (error) {
        if (controller.signal.aborted) throw new SkillRemoteError("GitHub 请求超时，请稍后重试", 504);
        throw new SkillRemoteError(error instanceof Error ? `GitHub 请求失败：${error.message}` : "GitHub 请求失败", 502);
    } finally {
        clearTimeout(timeout);
    }
}

async function readResponseText(response: Response, maxBytes: number, label: string) {
    const declared = Number(response.headers.get("content-length") || "0");
    if (declared > maxBytes) throw new SkillRemoteError(`${label}不能超过 ${Math.ceil(maxBytes / 1024)}KiB`, 409);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new SkillRemoteError(`${label}不能超过 ${Math.ceil(maxBytes / 1024)}KiB`, 409);
    return buffer.toString("utf8");
}
