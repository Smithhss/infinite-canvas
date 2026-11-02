export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifySha256(bytes: Uint8Array, expected: string): Promise<boolean> {
    return (await sha256Hex(bytes)) === expected.toLowerCase();
}
