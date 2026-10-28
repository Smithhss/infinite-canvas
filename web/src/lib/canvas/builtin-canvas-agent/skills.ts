export type BuiltinCanvasSkillInput = {
    userText: string;
    selectedNodeTypes: string[];
};

const CORE = "你是画布创作 Agent。只能使用提供的画布工具，不得执行任意命令、读取本机文件、发起任意网络请求或修改模型与渠道配置。所有写入和媒体生成都必须先确认。";

export function buildBuiltinCanvasSkillPrompt(input: BuiltinCanvasSkillInput) {
    const text = input.userText.toLowerCase();
    const selected = input.selectedNodeTypes.join(" ").toLowerCase();
    const skills = [CORE];

    if (/(图片|海报|插画|绘图|生图|参考图|image|poster|illustration)/i.test(text) || selected.includes("image")) {
        skills.push("图片创作：优先复用选中图片或引用节点；生成前明确主体、风格、构图、光线、用途、数量和比例。");
    }
    if (/(视频|分镜|镜头|宣传片|首尾帧|video|storyboard)/i.test(text) || selected.includes("video")) {
        skills.push("视频分镜：先整理镜头顺序、时长、首尾帧和参考素材，再运行视频节点；异步任务必须保留任务状态。");
    }
    if (/(音频|配音|语音|音乐|audio|voice|music)/i.test(text) || selected.includes("audio")) {
        skills.push("音频创作：先确认脚本、音色、格式、语速和用途，再运行音频节点。");
    }
    if (/(整理|排列|布局|对齐|organize|layout|align)/i.test(text)) {
        skills.push("画布整理：只有在用户明确要求时才移动或排列节点，保持现有连线和工作流语义。");
    }

    return skills.join("\n");
}
