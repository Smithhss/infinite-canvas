import { saveAs } from "file-saver";

import i18n from "@/i18n";
import type { StoryboardItem } from "@/lib/canvas/storyboard-projection";
import { createZip } from "@/lib/zip";
import { getMediaBlob } from "@/services/file-storage";
import { getImageBlob } from "@/services/image-storage";
import type { CanvasExportAsset, CanvasExportFile } from "@/types/canvas-export";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export async function exportCanvasProjects(projects: CanvasProject[], fileName = i18n.t("canvas.export.defaultProjectName")) {
    const zipFiles: { name: string; data: BlobPart }[] = [];
    const exportedProjects = await Promise.all(
        projects.map(async (project) => {
            const files: CanvasExportAsset[] = [];
            await Promise.all(
                collectStorageKeys(project).map(async (storageKey) => {
                    const blob = storageKey.startsWith("image:") ? await getImageBlob(storageKey) : await getMediaBlob(storageKey);
                    if (!blob) return;
                    const path = `projects/${project.id}/files/${safeFileName(storageKey)}.${fileExtension(blob.type, storageKey)}`;
                    files.push({ storageKey, path, mimeType: blob.type || "application/octet-stream", bytes: blob.size });
                    zipFiles.push({ name: path, data: blob });
                }),
            );
            return { project, files };
        }),
    );

    const data: CanvasExportFile = { app: "infinite-canvas", version: 3, exportedAt: new Date().toISOString(), projects: exportedProjects };
    const zip = await createZip([{ name: "projects.json", data: JSON.stringify(data, null, 2) }, ...zipFiles]);
    saveAs(zip, `${safeFileName(fileName)}.zip`);
}

export async function exportCanvasNodes(nodes: CanvasNodeData[], fileName = i18n.t("canvas.export.defaultNodesName")) {
    const zipFiles: { name: string; data: BlobPart }[] = [];
    const used = new Set<string>();
    const uniqueName = (base: string, ext: string) => {
        const safe = safeFileName(base) || i18n.t("canvas.export.item");
        let name = `${safe}.${ext}`;
        for (let i = 1; used.has(name); i += 1) name = `${safe}-${i}.${ext}`;
        used.add(name);
        return name;
    };

    await Promise.all(
        nodes.map(async (node) => {
            const title = node.title || node.type;
            const storageKey = node.metadata?.storageKey || "";
            if (storageKey) {
                const blob = storageKey.startsWith("image:") ? await getImageBlob(storageKey) : await getMediaBlob(storageKey);
                if (blob) return void zipFiles.push({ name: uniqueName(title, fileExtension(blob.type, storageKey)), data: blob });
            }
            if (node.type === CanvasNodeType.Text) return void zipFiles.push({ name: uniqueName(title, "txt"), data: node.metadata?.content || node.metadata?.prompt || "" });
            const content = node.metadata?.content;
            if (content && content.startsWith("data:")) {
                const blob = await (await fetch(content)).blob();
                return void zipFiles.push({ name: uniqueName(title, fileExtension(blob.type, storageKey)), data: blob });
            }
            zipFiles.push({ name: uniqueName(title, "json"), data: JSON.stringify(node, null, 2) });
        }),
    );

    const zip = await createZip(zipFiles);
    saveAs(zip, `${safeFileName(fileName)}.zip`);
}

export function storyboardExportFileNames(items: StoryboardItem[], extensions: Array<string | undefined> = []) {
    const used = new Set<string>();
    return items.map((item, index) => {
        const base = safeFileName(item.title) || i18n.t("canvas.export.item");
        return uniqueStoryboardExportName(base, extensions[index] || storyboardExportExtension(item), used);
    });
}

type StoryboardExportFile = { name: string; data: BlobPart };
type PendingStoryboardExportFile = { base: string; extension: string; data: BlobPart };

export async function collectStoryboardExportFiles(items: StoryboardItem[], readMedia: (item: StoryboardItem) => Promise<Blob | null> = storyboardMediaBlob) {
    const results = await Promise.all(
        items.map(async (item): Promise<PendingStoryboardExportFile | null> => {
            const base = safeFileName(item.title) || i18n.t("canvas.export.item");
            if (item.kind === "text" || item.kind === "script") {
                return { base, extension: storyboardExportExtension(item), data: item.content || item.prompt || "" };
            }
            try {
                const blob = await readMedia(item);
                return blob ? { base, extension: storyboardExportExtension(item, blob.type), data: blob } : null;
            } catch {
                return null;
            }
        }),
    );
    const used = new Set<string>();
    const files = results.filter((item): item is PendingStoryboardExportFile => Boolean(item)).map((item): StoryboardExportFile => ({ name: uniqueStoryboardExportName(item.base, item.extension, used), data: item.data }));
    return { files, failed: items.length - files.length };
}

export async function exportStoryboardItems(items: StoryboardItem[], fileName = i18n.t("canvas.export.defaultNodesName")) {
    const { files, failed } = await collectStoryboardExportFiles(items);
    if (!files.length) return { exported: 0, failed: items.length };
    const zip = await createZip(files);
    saveAs(zip, `${safeFileName(fileName)}.zip`);
    return { exported: files.length, failed };
}

async function storyboardMediaBlob(item: StoryboardItem) {
    if (item.storageKey) {
        const stored = item.storageKey.startsWith("image:") ? await getImageBlob(item.storageKey) : await getMediaBlob(item.storageKey);
        if (stored) return stored;
    }
    if (!item.content) return null;
    const response = await fetch(item.content);
    if (!response.ok) throw new Error("Storyboard media download failed");
    return response.blob();
}

function storyboardExportExtension(item: StoryboardItem, mimeType = "") {
    if (item.kind === "script") return "md";
    if (item.kind === "text") return "txt";
    const normalized = mimeType.toLowerCase().split(";")[0].trim();
    if (item.kind === "image") {
        return (
            {
                "image/avif": "avif",
                "image/gif": "gif",
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/svg+xml": "svg",
                "image/webp": "webp",
            }[normalized] || "png"
        );
    }
    return (
        {
            "video/mp4": "mp4",
            "video/quicktime": "mov",
            "video/webm": "webm",
            "video/x-matroska": "mkv",
        }[normalized] || "mp4"
    );
}

function uniqueStoryboardExportName(base: string, extension: string, used: Set<string>) {
    let name = `${base}.${extension}`;
    for (let index = 1; used.has(name.toLowerCase()); index += 1) name = `${base}-${index}.${extension}`;
    used.add(name.toLowerCase());
    return name;
}

function collectStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return [...keys];
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.includes(":")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectStorageKeys(child, keys)) : collectStorageKeys(item, keys)));
    return [...keys];
}

function safeFileName(value: string) {
    return value
        .replace(/[\u0000-\u001f\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[. ]+$/g, "")
        .slice(0, 120);
}

function fileExtension(mimeType: string, storageKey: string) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg")) return "jpg";
    if (mimeType.includes("webp")) return "webp";
    if (mimeType.includes("gif")) return "gif";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("ogg")) return "ogg";
    return storageKey.startsWith("image:") ? "png" : "bin";
}
