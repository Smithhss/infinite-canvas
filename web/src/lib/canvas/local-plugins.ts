export const LOCAL_PLUGINS_DIRECTORY = "local-plugins";

export function localPluginBasePath(baseUrl: string) {
    return `${baseUrl.replace(/\/+$/, "")}/${LOCAL_PLUGINS_DIRECTORY}`;
}

export function localPluginManifestPath(baseUrl: string) {
    return `${localPluginBasePath(baseUrl)}/index.json`;
}

export function localPluginAssetPath(baseUrl: string, file: string) {
    return `${localPluginBasePath(baseUrl)}/${file}`;
}
