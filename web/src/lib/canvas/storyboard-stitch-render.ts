import type { StoryboardStitchPlan } from "@/lib/canvas/storyboard-stitch";

function loadImage(source: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`无法读取分镜图片：${source.slice(0, 64)}`));
        image.src = source;
    });
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, cell: StoryboardStitchPlan["cells"][number]) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = cell.width / cell.height;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;
    if (sourceRatio > targetRatio) {
        sourceWidth = Math.round(image.naturalHeight * targetRatio);
        sourceX = Math.round((image.naturalWidth - sourceWidth) / 2);
    } else if (sourceRatio < targetRatio) {
        sourceHeight = Math.round(image.naturalWidth / targetRatio);
        sourceY = Math.round((image.naturalHeight - sourceHeight) / 2);
    }
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, cell.x, cell.y, cell.width, cell.height);
}

export async function renderStoryboardStitch(sources: string[], plan: StoryboardStitchPlan) {
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器不支持画布合成");
    context.fillStyle = "#000000";
    context.fillRect(0, 0, plan.width, plan.height);

    const images = await Promise.all(plan.cells.map((cell) => loadImage(sources[cell.index])));
    plan.cells.forEach((cell, index) => {
        const image = images[index];
        if (image) drawCover(context, image, cell);
    });

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("分镜拼接图片编码失败"));
        }, "image/png");
    });
}
