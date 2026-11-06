/** 将 Vite base 转为 React Router basename，根路径保持默认行为。 */
export function routerBasename(baseUrl: string) {
    if (!baseUrl || baseUrl === "/") return undefined;
    return baseUrl.replace(/\/+$/, "") || undefined;
}
