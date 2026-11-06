/** 只允许本机页面通过 /config 读取连接 token。 */
export function isLocalConfigOrigin(origin: string | undefined) {
    if (!origin) return false;
    try {
        const url = new URL(origin);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        return url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname === "::1";
    } catch {
        return false;
    }
}
