import type { CanvasScriptPreset, CanvasScriptV2 } from "@/types/canvas";

export type ScriptPresetOption = {
    value: string;
    label: string;
    labelEn: string;
};

export type ScriptPresetTemplate = {
    id: string;
    title: string;
    titleEn: string;
    description: string;
    descriptionEn: string;
    preset: CanvasScriptPreset;
};

export const SCRIPT_PRESET_LIMITS = {
    audience: 2,
    characters: 5,
    eras: 2,
    hooks: 3,
} as const;

export const SCRIPT_EPISODE_OPTIONS = [10, 12, 20, 24, 30, 40] as const;

export const SCRIPT_GENRE_OPTIONS: ScriptPresetOption[] = [
    { value: "玄幻修仙", label: "玄幻修仙", labelEn: "Fantasy cultivation" },
    { value: "都市现实", label: "都市现实", labelEn: "Urban realism" },
    { value: "古装言情", label: "古装言情", labelEn: "Period romance" },
    { value: "悬疑推理", label: "悬疑推理", labelEn: "Mystery" },
    { value: "惊悚怪谈", label: "惊悚怪谈", labelEn: "Supernatural thriller" },
    { value: "犯罪谍战", label: "犯罪谍战", labelEn: "Crime and espionage" },
    { value: "家庭伦理", label: "家庭伦理", labelEn: "Family drama" },
    { value: "末世科幻", label: "末世科幻", labelEn: "Post-apocalyptic sci-fi" },
    { value: "历史传奇", label: "历史传奇", labelEn: "Historical legend" },
    { value: "喜剧", label: "喜剧", labelEn: "Comedy" },
    { value: "主旋律", label: "主旋律", labelEn: "Inspirational drama" },
    { value: "体育竞技", label: "体育竞技", labelEn: "Sports" },
    { value: "职场行业", label: "职场行业", labelEn: "Workplace" },
    { value: "文旅非遗", label: "文旅非遗", labelEn: "Culture and heritage" },
    { value: "其他", label: "其他", labelEn: "Other" },
];

export const SCRIPT_AUDIENCE_OPTIONS: ScriptPresetOption[] = [
    { value: "男频", label: "男频", labelEn: "Male-oriented" },
    { value: "女频", label: "女频", labelEn: "Female-oriented" },
    { value: "泛人群", label: "泛人群", labelEn: "General audience" },
    { value: "出海", label: "出海", labelEn: "Global audience" },
    { value: "银发", label: "银发", labelEn: "Older audience" },
    { value: "其他", label: "其他", labelEn: "Other" },
];

export const SCRIPT_CHARACTER_OPTIONS: ScriptPresetOption[] = [
    { value: "小人物", label: "小人物", labelEn: "Underdog" },
    { value: "打工人", label: "打工人", labelEn: "Working professional" },
    { value: "女强", label: "女强", labelEn: "Strong female lead" },
    { value: "不完美成长型", label: "不完美成长型", labelEn: "Flawed growth arc" },
    { value: "专业型", label: "专业型", labelEn: "Specialist" },
    { value: "天才", label: "天才", labelEn: "Genius" },
    { value: "双强", label: "双强", labelEn: "Dual leads" },
    { value: "腹黑", label: "腹黑", labelEn: "Calculating rival" },
    { value: "黑莲花", label: "黑莲花", labelEn: "Cunning heroine" },
    { value: "忠犬", label: "忠犬", labelEn: "Devoted partner" },
    { value: "病娇", label: "病娇", labelEn: "Possessive admirer" },
    { value: "福宝", label: "福宝", labelEn: "Fortunate child" },
    { value: "大小姐", label: "大小姐", labelEn: "Heiress" },
    { value: "少爷", label: "少爷", labelEn: "Young master" },
    { value: "王爷", label: "王爷", labelEn: "Prince" },
    { value: "王妃", label: "王妃", labelEn: "Princess consort" },
    { value: "皇帝", label: "皇帝", labelEn: "Emperor" },
    { value: "将军", label: "将军", labelEn: "General" },
    { value: "修士", label: "修士", labelEn: "Cultivator" },
    { value: "龙王", label: "龙王", labelEn: "Dragon king" },
    { value: "医者", label: "医者", labelEn: "Healer" },
    { value: "律师", label: "律师", labelEn: "Lawyer" },
    { value: "警探", label: "警探", labelEn: "Detective" },
    { value: "教师", label: "教师", labelEn: "Teacher" },
    { value: "模特", label: "模特", labelEn: "Model" },
    { value: "其他", label: "其他", labelEn: "Other" },
];

export const SCRIPT_ERA_OPTIONS: ScriptPresetOption[] = [
    { value: "古代", label: "古代", labelEn: "Ancient" },
    { value: "现代", label: "现代", labelEn: "Contemporary" },
    { value: "架空", label: "架空", labelEn: "Fictional world" },
    { value: "末世", label: "末世", labelEn: "Post-apocalyptic" },
    { value: "民国", label: "民国", labelEn: "Republican era" },
    { value: "年代（80–90s）", label: "年代（80–90s）", labelEn: "1980s–90s" },
    { value: "近未来", label: "近未来", labelEn: "Near future" },
    { value: "平行世界", label: "平行世界", labelEn: "Parallel world" },
    { value: "多时空穿越", label: "多时空穿越", labelEn: "Time travel" },
    { value: "其他", label: "其他", labelEn: "Other" },
];

export const SCRIPT_HOOK_OPTIONS: ScriptPresetOption[] = [
    { value: "器物金手指", label: "器物金手指", labelEn: "Artifact advantage" },
    { value: "收集升级", label: "收集升级", labelEn: "Collection progression" },
    { value: "基建生存", label: "基建生存", labelEn: "Base building" },
    { value: "专业碾压", label: "专业碾压", labelEn: "Expertise showcase" },
    { value: "马甲大佬", label: "马甲大佬", labelEn: "Hidden identity" },
    { value: "先婚后爱", label: "先婚后爱", labelEn: "Marriage first" },
    { value: "重生复仇", label: "重生复仇", labelEn: "Rebirth revenge" },
    { value: "团宠被爱", label: "团宠被爱", labelEn: "Found family" },
    { value: "IP二创", label: "IP二创", labelEn: "IP reinterpretation" },
    { value: "双向救赎", label: "双向救赎", labelEn: "Mutual redemption" },
    { value: "穿越异世", label: "穿越异世", labelEn: "World transfer" },
    { value: "扮猪吃虎", label: "扮猪吃虎", labelEn: "Underestimated hero" },
    { value: "亲历行业细节", label: "亲历行业细节", labelEn: "Industry detail" },
    { value: "真实成长", label: "真实成长", labelEn: "Grounded growth" },
    { value: "规则禁忌", label: "规则禁忌", labelEn: "Rules and taboos" },
    { value: "单元解谜", label: "单元解谜", labelEn: "Episodic mystery" },
    { value: "文化元素新用", label: "文化元素新用", labelEn: "Cultural reinvention" },
    { value: "风格混搭", label: "风格混搭", labelEn: "Mixed genres" },
    { value: "视觉奇观", label: "视觉奇观", labelEn: "Visual spectacle" },
    { value: "隐藏身份", label: "隐藏身份", labelEn: "Secret identity" },
    { value: "真假千金", label: "真假千金", labelEn: "Identity swap" },
    { value: "契约婚姻", label: "契约婚姻", labelEn: "Contract marriage" },
    { value: "萌宝助攻", label: "萌宝助攻", labelEn: "Child matchmaker" },
    { value: "赘婿逆袭", label: "赘婿逆袭", labelEn: "Underdog rise" },
    { value: "系统傍身", label: "系统傍身", labelEn: "System assistance" },
    { value: "欢喜冤家", label: "欢喜冤家", labelEn: "Rivals to lovers" },
    { value: "普通人的处境", label: "普通人的处境", labelEn: "Ordinary life stakes" },
    { value: "群像时代切片", label: "群像时代切片", labelEn: "Ensemble period portrait" },
    { value: "姐弟恋", label: "姐弟恋", labelEn: "Older woman romance" },
    { value: "穿书", label: "穿书", labelEn: "Transported into a book" },
    { value: "时间循环", label: "时间循环", labelEn: "Time loop" },
];

export const SCRIPT_ART_STYLE_OPTIONS: ScriptPresetOption[] = [
    { value: "自定义", label: "自定义", labelEn: "Custom" },
    { value: "冷峻宫廷权谋", label: "冷峻宫廷权谋", labelEn: "Cold palace intrigue" },
    { value: "国产冷调悬疑", label: "国产冷调悬疑", labelEn: "Cold-toned mystery" },
    { value: "都市写实", label: "都市写实", labelEn: "Urban realism" },
    { value: "柔光古装言情", label: "柔光古装言情", labelEn: "Soft period romance" },
    { value: "日系青春胶片", label: "日系青春胶片", labelEn: "Japanese youth film" },
    { value: "写实江湖武侠", label: "写实江湖武侠", labelEn: "Wuxia realism" },
    { value: "高调棚拍广告", label: "高调棚拍广告", labelEn: "High-key commercial" },
    { value: "经典好莱坞", label: "经典好莱坞", labelEn: "Classic Hollywood" },
    { value: "赛博科幻", label: "赛博科幻", labelEn: "Cyber sci-fi" },
    { value: "冷感文艺", label: "冷感文艺", labelEn: "Minimal arthouse" },
    { value: "暗黑恐怖", label: "暗黑恐怖", labelEn: "Dark horror" },
    { value: "3D 奇幻动画", label: "3D 奇幻动画", labelEn: "3D fantasy animation" },
    { value: "工业质感", label: "工业质感", labelEn: "Industrial" },
    { value: "怀旧港片", label: "怀旧港片", labelEn: "Retro Hong Kong" },
    { value: "唯美国风 3D", label: "唯美国风 3D", labelEn: "Elegant Chinese 3D" },
    { value: "三渲二动漫", label: "三渲二动漫", labelEn: "Cel-shaded 3D" },
    { value: "超写实 3D", label: "超写实 3D", labelEn: "Hyperreal 3D" },
    { value: "暗调奇幻 CG", label: "暗调奇幻 CG", labelEn: "Dark fantasy CG" },
    { value: "东方玄幻 3D", label: "东方玄幻 3D", labelEn: "Eastern fantasy 3D" },
    { value: "经典国产美术", label: "经典国产美术", labelEn: "Classic Chinese animation" },
    { value: "国风壁画", label: "国风壁画", labelEn: "Chinese mural" },
];

export const SCRIPT_STRUCTURE_OPTIONS: ScriptPresetOption[] = [
    { value: "三幕式", label: "三幕式", labelEn: "Three-act" },
    { value: "五幕式", label: "五幕式", labelEn: "Five-act" },
    { value: "英雄旅程", label: "英雄旅程", labelEn: "Hero's journey" },
    { value: "平行结构", label: "平行结构", labelEn: "Parallel narrative" },
    { value: "交叉结构", label: "交叉结构", labelEn: "Intercut narrative" },
    { value: "非线性结构", label: "非线性结构", labelEn: "Nonlinear narrative" },
    { value: "环形结构", label: "环形结构", labelEn: "Circular narrative" },
    { value: "单元结构", label: "单元结构", labelEn: "Episodic structure" },
];

export const SCRIPT_TOP_PRESETS: ScriptPresetTemplate[] = [
    {
        id: "fantasy-rise",
        title: "玄幻修仙逆袭",
        titleEn: "Cultivation rise",
        description: "底层少年进入宗门，在资源争夺中逐步揭开身世与天道规则。",
        descriptionEn: "An underdog enters a sect and uncovers a hidden legacy amid a struggle for resources.",
        preset: {
            genre: "玄幻修仙",
            audience: ["男频"],
            characters: ["小人物", "天才", "修士"],
            eras: ["架空"],
            hooks: ["收集升级", "扮猪吃虎", "隐藏身份"],
            artStyle: "东方玄幻 3D",
            episodes: 20,
            structure: "英雄旅程",
        },
    },
    {
        id: "workplace-growth",
        title: "现实职场成长",
        titleEn: "Workplace growth",
        description: "普通打工人进入高压行业，用专业能力解决真实难题并获得成长。",
        descriptionEn: "An ordinary worker enters a high-pressure industry and grows through real professional challenges.",
        preset: {
            genre: "职场行业",
            audience: ["泛人群"],
            characters: ["打工人", "不完美成长型", "专业型"],
            eras: ["现代"],
            hooks: ["专业碾压", "真实成长", "普通人的处境"],
            artStyle: "都市写实",
            episodes: 20,
            structure: "三幕式",
        },
    },
    {
        id: "apocalypse-builder",
        title: "末世生存基建",
        titleEn: "Post-apocalyptic builder",
        description: "灾变后的幸存者从零建立据点，在资源、秩序和外部威胁之间抉择。",
        descriptionEn: "Survivors build a settlement from scratch while balancing resources, order, and external threats.",
        preset: {
            genre: "末世科幻",
            audience: ["男频", "泛人群"],
            characters: ["专业型", "双强"],
            eras: ["末世", "近未来"],
            hooks: ["基建生存", "收集升级", "视觉奇观"],
            artStyle: "工业质感",
            episodes: 20,
            structure: "三幕式",
        },
    },
    {
        id: "heritage-visual",
        title: "非遗国潮视觉",
        titleEn: "Heritage spectacle",
        description: "年轻传承人用当代方式重振非遗技艺，让传统美学进入大众视野。",
        descriptionEn: "A young inheritor revives a traditional craft through a contemporary visual language.",
        preset: {
            genre: "文旅非遗",
            audience: ["泛人群", "出海"],
            characters: ["小人物", "专业型"],
            eras: ["现代"],
            hooks: ["文化元素新用", "视觉奇观", "真实成长"],
            artStyle: "国风壁画",
            episodes: 12,
            structure: "单元结构",
        },
    },
    {
        id: "period-romance",
        title: "古代女频甜宠",
        titleEn: "Period romance",
        description: "契约关系开局，男女主在家族与朝堂压力中逐渐建立信任和情感。",
        descriptionEn: "A contract relationship becomes real trust and romance under family and court pressure.",
        preset: {
            genre: "古装言情",
            audience: ["女频"],
            characters: ["大小姐", "王爷", "忠犬", "双强"],
            eras: ["古代"],
            hooks: ["先婚后爱", "团宠被爱", "契约婚姻"],
            artStyle: "柔光古装言情",
            episodes: 20,
            structure: "三幕式",
        },
    },
    {
        id: "rule-mystery",
        title: "规则怪谈悬疑",
        titleEn: "Rule-based mystery",
        description: "普通人被卷入异常空间，必须识别规则漏洞并完成层层解谜。",
        descriptionEn: "An ordinary person enters an anomalous space and must expose the rules to survive.",
        preset: {
            genre: "惊悚怪谈",
            fusedGenre: "悬疑推理",
            audience: ["泛人群"],
            characters: ["小人物", "专业型"],
            eras: ["现代", "平行世界"],
            hooks: ["规则禁忌", "单元解谜", "时间循环"],
            artStyle: "国产冷调悬疑",
            episodes: 20,
            structure: "单元结构",
        },
    },
    {
        id: "rebirth-revenge",
        title: "重生复仇爽剧",
        titleEn: "Rebirth revenge",
        description: "主角带着前世记忆归来，在身份错位与权力博弈中完成反击。",
        descriptionEn: "With memories of a former life, the lead fights back through identity and power struggles.",
        preset: {
            genre: "古装言情",
            audience: ["女频"],
            characters: ["黑莲花", "病娇", "双强"],
            eras: ["架空"],
            hooks: ["重生复仇", "真假千金", "隐藏身份"],
            artStyle: "冷峻宫廷权谋",
            episodes: 20,
            structure: "三幕式",
        },
    },
    {
        id: "sect-family",
        title: "仙门团宠日常",
        titleEn: "Sect found family",
        description: "被仙门共同照料的少女在日常与危机中连接群像、修复关系。",
        descriptionEn: "A girl raised by a sect connects an ensemble and heals relationships through daily life and crises.",
        preset: {
            genre: "玄幻修仙",
            audience: ["女频", "泛人群"],
            characters: ["福宝", "修士", "双强"],
            eras: ["架空"],
            hooks: ["团宠被爱", "萌宝助攻", "欢喜冤家"],
            artStyle: "唯美国风 3D",
            episodes: 20,
            structure: "单元结构",
        },
    },
];

const optionValues = new Map<string, Set<string>>([
    ["genre", new Set(SCRIPT_GENRE_OPTIONS.map((option) => option.value))],
    ["audience", new Set(SCRIPT_AUDIENCE_OPTIONS.map((option) => option.value))],
    ["characters", new Set(SCRIPT_CHARACTER_OPTIONS.map((option) => option.value))],
    ["eras", new Set(SCRIPT_ERA_OPTIONS.map((option) => option.value))],
    ["hooks", new Set(SCRIPT_HOOK_OPTIONS.map((option) => option.value))],
    ["artStyle", new Set(SCRIPT_ART_STYLE_OPTIONS.map((option) => option.value))],
    ["structure", new Set(SCRIPT_STRUCTURE_OPTIONS.map((option) => option.value))],
]);

function cleanText(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function uniqueAllowed(values: unknown, key: string, limit: number) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((value): value is string => typeof value === "string" && optionValues.get(key)?.has(value) === true))].slice(0, limit);
}

function allowedSingle(value: unknown, key: string) {
    return typeof value === "string" && optionValues.get(key)?.has(value) ? value : undefined;
}

export function createEmptyScriptPreset(): CanvasScriptPreset {
    return { audience: [], characters: [], eras: [], hooks: [], episodes: 20 };
}

export function normalizeScriptPreset(value?: Partial<CanvasScriptPreset> | null): CanvasScriptPreset {
    const episodes = Number(value?.episodes);
    return {
        genre: allowedSingle(value?.genre, "genre"),
        fusedGenre: allowedSingle(value?.fusedGenre, "genre"),
        customGenre: cleanText(value?.customGenre, 80) || undefined,
        audience: uniqueAllowed(value?.audience, "audience", SCRIPT_PRESET_LIMITS.audience),
        characters: uniqueAllowed(value?.characters, "characters", SCRIPT_PRESET_LIMITS.characters),
        eras: uniqueAllowed(value?.eras, "eras", SCRIPT_PRESET_LIMITS.eras),
        hooks: uniqueAllowed(value?.hooks, "hooks", SCRIPT_PRESET_LIMITS.hooks),
        artStyle: allowedSingle(value?.artStyle, "artStyle"),
        customArtStyle: cleanText(value?.customArtStyle, 120) || undefined,
        episodes: Number.isInteger(episodes) && episodes > 0 && episodes <= 100 ? episodes : 20,
        structure: allowedSingle(value?.structure, "structure"),
    };
}

export function toggleScriptPresetOption(values: string[], value: string, limit: number) {
    if (values.includes(value)) {
        return { values: values.filter((item) => item !== value), changed: true, limitReached: false };
    }
    if (values.length >= limit) {
        return { values, changed: false, limitReached: true };
    }
    return { values: [...values, value], changed: true, limitReached: false };
}

export function toggleScriptPresetSingle(value: string | undefined, next: string) {
    return value === next ? undefined : next;
}

export function applyScriptPresetTemplate(templateId: string): CanvasScriptPreset | null {
    const template = SCRIPT_TOP_PRESETS.find((item) => item.id === templateId);
    return template ? normalizeScriptPreset(template.preset) : null;
}

export function applyScriptPresetToScript(script: CanvasScriptV2, preset?: CanvasScriptPreset | null): CanvasScriptV2 {
    return { ...script, preset: preset ? normalizeScriptPreset(preset) : undefined };
}

function optionLabel(options: ScriptPresetOption[], value: string | undefined) {
    return options.find((option) => option.value === value)?.label || value || "";
}

function resolvedGenre(preset: CanvasScriptPreset) {
    if (preset.genre === "其他" && preset.customGenre) return preset.customGenre;
    return optionLabel(SCRIPT_GENRE_OPTIONS, preset.genre);
}

function resolvedArtStyle(preset: CanvasScriptPreset) {
    if (preset.artStyle === "自定义" && preset.customArtStyle) return preset.customArtStyle;
    return optionLabel(SCRIPT_ART_STYLE_OPTIONS, preset.artStyle);
}

export function buildScriptPresetSummary(preset?: CanvasScriptPreset | null) {
    const value = normalizeScriptPreset(preset);
    const genre = resolvedGenre(value);
    const fusedGenre = value.fusedGenre && value.fusedGenre !== value.genre ? optionLabel(SCRIPT_GENRE_OPTIONS, value.fusedGenre) : "";
    const genreText = [genre, fusedGenre].filter(Boolean).join(" × ") || "自动";
    const artStyle = resolvedArtStyle(value) || "自动";
    return [
        `题材：${genreText}`,
        `目标受众：${value.audience.join("、") || "自动"}`,
        `角色设定：${value.characters.join("、") || "自动"}`,
        `时代背景：${value.eras.join("、") || "自动"}`,
        `核心看点：${value.hooks.join("、") || "自动"}`,
        `画风：${artStyle}`,
        `剧本结构：${value.episodes} 集${value.structure ? ` · ${optionLabel(SCRIPT_STRUCTURE_OPTIONS, value.structure)}` : ""}`,
    ].join("\n");
}

export function buildScriptPresetPrompt(preset?: CanvasScriptPreset | null) {
    const summary = buildScriptPresetSummary(preset).replaceAll("\n", "\n- ");
    return `请根据以下剧本设定创作一个适合分镜生产的故事方案，并输出可拆分为镜头的内容。不要直接生成付费图片或视频。\n\n- ${summary}`;
}
