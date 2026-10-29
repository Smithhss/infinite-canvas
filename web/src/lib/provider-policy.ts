export function isPlatformProvider(baseUrl: string, origin: string) {
    try {
        const url = new URL(baseUrl);
        return url.origin === origin && !url.username && !url.password && !url.search && !url.hash
            && ["", "/v1", "/v1beta"].includes(url.pathname.replace(/\/+$/, ""));
    } catch {
        return false;
    }
}

export function providerAllowed(allowExternalProviders: boolean, baseUrl: string, origin: string, customScript = false) {
    return allowExternalProviders || (!customScript && isPlatformProvider(baseUrl, origin));
}

export async function readProviderPolicy(fetcher: typeof fetch = fetch): Promise<boolean> {
    const response = await fetcher("/api/creative/config", { credentials: "omit", cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error("provider-policy-unavailable");
    const body = await response.json() as { success?: boolean; data?: { allow_external_providers?: unknown } };
    if (body.success !== true || typeof body.data?.allow_external_providers !== "boolean") throw new Error("provider-policy-unavailable");
    return body.data.allow_external_providers;
}
