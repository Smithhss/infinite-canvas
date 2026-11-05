export type Position = {
    x: number;
    y: number;
};

export type ViewportTransform = {
    x: number;
    y: number;
    k: number;
};

export enum CanvasNodeType {
    Image = "image",
    Text = "text",
    Config = "config",
    Video = "video",
    Audio = "audio",
    Script = "script",
    Group = "group",
}

// Node types are open strings: built-ins use CanvasNodeType and plugins use "<pluginId>:<name>".
export type CanvasNodeTypeId = CanvasNodeType | (string & {});

export type CanvasNodeStatus = "idle" | "success" | "loading" | "error";
export type CanvasGenerationMode = "text" | "image" | "video" | "audio";
export type CanvasImageGenerationType = "generation" | "edit";
export type CanvasWorkspaceView = "workflow" | "storyboard";
export type CanvasStoryboardCategory = "character" | "scene" | "prop" | "other";

export type CanvasNodeImage = {
    id: string;
    status: CanvasNodeStatus;
    errorDetails?: string;
    content: string;
    storageKey?: string;
    naturalWidth: number;
    naturalHeight: number;
    bytes: number;
    mimeType: string;
};

export type CanvasNodeText = {
    id: string;
    status: CanvasNodeStatus;
    errorDetails?: string;
    content: string;
};

export type CanvasScriptShot = {
    id: string;
    shotNumber: number;
    durationSeconds: number;
    plotDescription: string;
    characters?: string[];
    videoReference?: string;
    shotSize?: string;
    emotion?: string;
    propTags?: string[];
    cameraMovement?: string;
    dialogue?: string;
    lightingAndAtmosphere?: string;
    audioEffects?: string;
    imageGenerationPrompt?: string;
    videoMotionPrompt?: string;
    imageToVideoMotionPrompt?: string;
    color?: string;
};

export type CanvasScriptViewMode = "table" | "creative" | "asset";

export type CanvasScriptColumnKey = "shotNumber" | "duration" | "plot" | "characters" | "videoReference" | "shotSize" | "emotion" | "props" | "cameraMovement" | "lighting" | "audio" | "dialogue" | "imagePrompt" | "videoPrompt" | "imageToVideoPrompt";

export type CanvasScriptColumnVisibility = Partial<Record<CanvasScriptColumnKey, boolean>>;

export type CanvasScriptFilterOperator = "contains" | "equals" | "greater" | "less";

export type CanvasScriptFilter = {
    id: string;
    column: CanvasScriptColumnKey;
    operator: CanvasScriptFilterOperator;
    value: string;
};

export type CanvasScriptPreset = {
    genre?: string;
    fusedGenre?: string;
    customGenre?: string;
    audience: string[];
    characters: string[];
    eras: string[];
    hooks: string[];
    artStyle?: string;
    customArtStyle?: string;
    episodes: number;
    structure?: string;
};

export type CanvasScriptV2 = {
    version: 1;
    theme?: string;
    aspectRatio?: string;
    styleDescription?: string;
    originalStoryText?: string;
    preset?: CanvasScriptPreset;
    viewMode?: CanvasScriptViewMode;
    columnVisibility?: CanvasScriptColumnVisibility;
    filters?: CanvasScriptFilter[];
    rows: CanvasScriptShot[];
};

export type CanvasNodeMetadata = {
    content?: string;
    composerContent?: string;
    prompt?: string;
    status?: CanvasNodeStatus;
    errorDetails?: string;
    fontSize?: number;
    generationMode?: CanvasGenerationMode;
    generationType?: CanvasImageGenerationType;
    model?: string;
    reasoningEffort?: "auto" | "low" | "medium" | "high" | "xhigh";
    size?: string;
    quality?: string;
    background?: string;
    count?: number;
    textCount?: number;
    texts?: CanvasNodeText[];
    primaryTextId?: string;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    videoMode?: string;
    audioVoice?: string;
    audioFormat?: string;
    audioSpeed?: string;
    audioInstructions?: string;
    references?: string[];
    naturalWidth?: number;
    naturalHeight?: number;
    freeResize?: boolean;
    images?: CanvasNodeImage[];
    primaryImageId?: string;
    storageKey?: string;
    mimeType?: string;
    bytes?: number;
    durationMs?: number;
    videoTaskId?: string;
    videoTaskProvider?: "openai" | "gemini";
    groupId?: string;
    storyboardCategory?: CanvasStoryboardCategory;
    scriptV2?: CanvasScriptV2;
    interactive?: boolean; // Plugin node interaction/move state; see CanvasNodeDefinition.interactionToggle.
};

export type CanvasNodeData = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    position: Position;
    width: number;
    height: number;
    locked?: boolean;
    metadata?: CanvasNodeMetadata;
};

export type CanvasConnection = {
    id: string;
    fromNodeId: string;
    toNodeId: string;
};

export type CanvasAssistantReference = {
    id: string;
    type: CanvasNodeTypeId;
    title: string;
    dataUrl?: string;
    storageKey?: string;
    text?: string;
};

export type CanvasAssistantImage = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    prompt: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant" | "system" | "tool" | "error";
    title?: string;
    text: string;
    meta?: string;
    detail?: unknown;
    references?: CanvasAssistantReference[];
};

export type CanvasAssistantSession = {
    id: string;
    title: string;
    messages: CanvasAssistantMessage[];
    createdAt: string;
    updatedAt: string;
};

export type ConnectionHandle = {
    nodeId: string;
    handleType: "source" | "target";
};

export type SelectionBox = {
    startWorldX: number;
    startWorldY: number;
    currentWorldX: number;
    currentWorldY: number;
    additive: boolean;
    initialSelectedNodeIds: string[];
};

export type ContextMenuState =
    | {
          type: "node";
          x: number;
          y: number;
          nodeId: string;
      }
    | {
          type: "connection";
          x: number;
          y: number;
          connectionId: string;
      };
