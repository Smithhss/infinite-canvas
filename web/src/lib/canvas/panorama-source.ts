export const MAX_PANORAMA_SOURCE_BYTES = 20 * 1024 * 1024;

const localImageDataUrl = /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i;

export function normalizePanoramaSource(value: unknown) {
    if (typeof value !== "string" || !value) return null;
    if (/^blob:/i.test(value)) return value;
    if (!localImageDataUrl.test(value)) return null;
    const payload = value.slice(value.indexOf(",") + 1);
    return Math.floor((payload.length * 3) / 4) <= MAX_PANORAMA_SOURCE_BYTES ? value : null;
}
