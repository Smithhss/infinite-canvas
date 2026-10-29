import { afterAll, expect, test } from "bun:test";
import axios from "axios";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalFetch = globalThis.fetch;
const originalAdapter = axios.defaults.adapter;
if (!globalThis.localStorage) Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} } });
const { createModelChannel, encodeChannelModel, useConfigStore } = await import("../src/stores/use-config-store");
const { requestGeneration, requestEdit, requestImageQuestion, fetchImageModels } = await import("../src/services/api/image");
const { createVideoGenerationTask, pollVideoGenerationTask } = await import("../src/services/api/video");
const { requestAudioGeneration } = await import("../src/services/api/audio");
const { requestBuiltinCanvasAgentTurn } = await import("../src/services/api/builtin-canvas-agent");
const { assertProviderAccess, refreshProviderPolicy, useProviderPolicyStore } = await import("../src/services/api/provider-policy");

afterAll(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    globalThis.fetch = originalFetch;
    axios.defaults.adapter = originalAdapter;
});

test("closed managed policy blocks every new model request before vendor traffic", async () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
        location: { origin: "https://canvas.test", search: "?ff_fytBackend=0&allow_external_providers=true" },
        __RUNTIME_CONFIG__: { FYT_MANAGED: "1" },
    } });
    let policyReads = 0;
    let vendorRequests = 0;
    globalThis.fetch = (async (url) => {
        if (url === "/api/creative/config") {
            policyReads += 1;
            return Response.json({ success: true, data: { allow_external_providers: false } });
        }
        vendorRequests += 1;
        throw new Error("unexpected-vendor-request");
    }) as typeof fetch;
    axios.defaults.adapter = async () => { vendorRequests += 1; throw new Error("unexpected-vendor-request"); };
    const model = encodeChannelModel("outside", "mock-model");
    const config = { ...useConfigStore.getState().config,
        model, imageModel: model, textModel: model, videoModel: model, audioModel: model,
        channels: [createModelChannel({ id: "outside", baseUrl: "https://vendor.invalid/v1", apiKey: "mock-only", models: [{ name: "mock-model", capability: "video" }] })],
    };
    const scriptedModel = encodeChannelModel("scripted", "scripted-model");
    const scriptedConfig = { ...config,
        model: scriptedModel,
        videoModel: scriptedModel,
        channels: [createModelChannel({ id: "scripted", baseUrl: "https://vendor.invalid/v1", apiKey: "mock-only", models: [{ name: "scripted-model", capability: "video", script: "return 'https://media.invalid/result.mp4'" }] })],
    };
    const actions = [
        () => fetchImageModels(config.channels[0]),
        () => requestGeneration(config, "mock"),
        () => requestEdit(config, "mock", []),
        () => requestImageQuestion(config, [], () => undefined),
        () => createVideoGenerationTask(config, "mock"),
        () => requestAudioGeneration(config, "mock"),
        () => requestBuiltinCanvasAgentTurn({ config, messages: [] }),
        () => createVideoGenerationTask(scriptedConfig, "mock"),
    ];
    for (const action of actions) await expect(action()).rejects.toThrow("管理员尚未允许外部渠道接入");
    expect(policyReads).toBe(actions.length);
    expect(vendorRequests).toBe(0);
});

test("administrator changes take effect on the next operation and policy failure stays closed", async () => {
    let allowed = true;
    globalThis.fetch = (async () => Response.json({ success: true, data: { allow_external_providers: allowed } })) as typeof fetch;
    await assertProviderAccess("https://vendor.invalid/v1");
    allowed = false;
    await expect(assertProviderAccess("https://vendor.invalid/v1")).rejects.toThrow("管理员尚未允许外部渠道接入");
    await assertProviderAccess("https://canvas.test/v1");
    await expect(assertProviderAccess("https://canvas.test/v1", true)).rejects.toThrow("管理员尚未允许外部渠道接入");
    globalThis.fetch = (async () => new Response("<html>unavailable</html>")) as typeof fetch;
    await expect(assertProviderAccess("https://vendor.invalid/v1")).rejects.toThrow("暂时无法读取管理员接入策略");
});

test("same-origin FYT bypasses policy reads and remains usable when the policy is unavailable", async () => {
    let policyReads = 0;
    const vendorUrls: string[] = [];
    axios.defaults.adapter = async (config) => {
        vendorUrls.push(config.url || "");
        const data = config.url?.includes("/v1beta/models") ? { models: [{ name: "models/mock-image" }] } : { data: [{ id: "mock-image" }] };
        return { data, status: 200, statusText: "OK", headers: {}, config };
    };
    for (const policyResponse of [
        () => Response.json({ success: true, data: { allow_external_providers: false } }),
        () => new Response("<html>unavailable</html>", { status: 503 }),
    ]) {
        globalThis.fetch = (async () => {
            policyReads += 1;
            return policyResponse();
        }) as typeof fetch;
        for (const [baseUrl, apiFormat] of [["https://canvas.test", "openai"], ["https://canvas.test/v1", "openai"], ["https://canvas.test/v1beta", "gemini"]] as const) {
            await expect(fetchImageModels({ baseUrl, apiKey: "mock-only", apiFormat })).resolves.toEqual(["mock-image"]);
        }
    }
    expect(policyReads).toBe(0);
    expect(vendorUrls).toEqual([
        "https://canvas.test/v1/models",
        "https://canvas.test/v1/models",
        "https://canvas.test/v1beta/models",
        "https://canvas.test/v1/models",
        "https://canvas.test/v1/models",
        "https://canvas.test/v1beta/models",
    ]);
});

test("a policy check does not reuse an older in-flight background refresh", async () => {
    let policyReads = 0;
    let releaseBackground!: (response: Response) => void;
    globalThis.fetch = (async () => {
        policyReads += 1;
        if (policyReads === 1) return await new Promise<Response>((resolve) => { releaseBackground = resolve; });
        return Response.json({ success: true, data: { allow_external_providers: false } });
    }) as typeof fetch;

    const backgroundRefresh = refreshProviderPolicy();
    expect(policyReads).toBe(1);
    await expect(assertProviderAccess("https://vendor.invalid/v1")).rejects.toThrow("管理员尚未允许外部渠道接入");
    expect(policyReads).toBe(2);

    releaseBackground(Response.json({ success: true, data: { allow_external_providers: true } }));
    await backgroundRefresh;
    expect(useProviderPolicyStore.getState().allowExternalProviders).toBe(false);
});

test("closed managed policy leaves existing video task polling and downloads available", async () => {
    const model = encodeChannelModel("outside", "mock-video");
    const config = { ...useConfigStore.getState().config,
        model,
        videoModel: model,
        channels: [createModelChannel({ id: "outside", baseUrl: "https://vendor.invalid/v1", apiKey: "mock-only", models: [{ name: "mock-video", capability: "video" }] })],
    };
    let policyReads = 0;
    const vendorUrls: string[] = [];
    globalThis.fetch = (async () => {
        policyReads += 1;
        return Response.json({ success: true, data: { allow_external_providers: false } });
    }) as typeof fetch;
    axios.defaults.adapter = async (request) => {
        vendorUrls.push(request.url || "");
        const data = request.url?.endsWith("/videos/existing") ? { id: "existing", status: "completed", video_url: "https://media.invalid/result.mp4" } : new Blob(["video"], { type: "video/mp4" });
        return { data, status: 200, statusText: "OK", headers: {}, config: request };
    };

    await expect(pollVideoGenerationTask(config, { id: "existing", provider: "openai", model })).resolves.toEqual({ status: "completed", result: { blob: new Blob(["video"], { type: "video/mp4" }) } });
    expect(policyReads).toBe(0);
    expect(vendorUrls).toEqual(["https://vendor.invalid/v1/videos/existing", "https://media.invalid/result.mp4"]);
});
