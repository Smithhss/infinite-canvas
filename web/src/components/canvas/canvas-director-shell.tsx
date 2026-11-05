import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, ColorPicker, Input, InputNumber, Modal, Select, Slider, Switch, theme as antdTheme } from "antd";
import { Box, Camera, Circle, Cylinder, Folder, ImagePlus, Lightbulb, MapPin, Plus, RotateCcw, Route, Save, Trash2, Triangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Group, Mesh, Object3D, Scene } from "three";

import {
    DIRECTOR_MAX_FOV,
    DIRECTOR_MAX_OBJECTS,
    DIRECTOR_MAX_SCENE_NODES,
    DIRECTOR_MIN_FOV,
    createDirectorObject,
    createDirectorProject,
    createDirectorSceneNode,
    isValidDirectorCapture,
    normalizeDirectorColor,
    normalizeDirectorProject,
    UnsupportedDirectorProjectVersionError,
    type DirectorBackground,
    type DirectorEnvironment,
    type DirectorObject,
    type DirectorObjectKind,
    type DirectorProjectState,
    type DirectorSceneNode,
    type DirectorVector3,
} from "@/lib/canvas/director-project";
import { buildDirectorSceneTree, getAvailableDirectorSceneNodeParents, type DirectorSceneTreeEntry } from "@/lib/canvas/director-scene-tree";
import { MAX_PANORAMA_SOURCE_BYTES, normalizePanoramaSource } from "@/lib/canvas/panorama-source";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

type DirectorSceneRuntime = {
    capture: () => string | null;
    sync: (project: DirectorProjectState, selectedObjectId: string | null) => void;
    dispose: () => void;
};

const objectKinds: Array<{ kind: DirectorObjectKind; icon: typeof Box }> = [
    { kind: "box", icon: Box },
    { kind: "sphere", icon: Circle },
    { kind: "cylinder", icon: Cylinder },
    { kind: "cone", icon: Triangle },
];

export function CanvasDirectorShell({
    open,
    initialProject,
    onClose,
    onSave,
    onCapture,
}: {
    open: boolean;
    initialProject?: DirectorProjectState;
    onClose: () => void;
    onSave: (project: DirectorProjectState) => void;
    onCapture: (dataUrl: string, project: DirectorProjectState) => Promise<void>;
}) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const colorTheme = useThemeStore((state) => state.theme);
    const canvasTheme = canvasThemes[colorTheme];
    const { token } = antdTheme.useToken();
    const stageRef = useRef<HTMLDivElement>(null);
    const panoramaInputRef = useRef<HTMLInputElement>(null);
    const runtimeRef = useRef<DirectorSceneRuntime | null>(null);
    const [initialProjectState] = useState(() => readDirectorProject(initialProject));
    const [project, setProject] = useState(initialProjectState.project);
    const [unsupportedProjectVersion, setUnsupportedProjectVersion] = useState(initialProjectState.unsupportedVersion);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [selectedSceneNodeId, setSelectedSceneNodeId] = useState<string | null>(null);
    const [sceneError, setSceneError] = useState<string | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [sceneRevision, setSceneRevision] = useState(0);
    const projectRef = useRef(project);
    const selectedObjectIdRef = useRef(selectedObjectId);

    projectRef.current = project;
    selectedObjectIdRef.current = selectedObjectId;

    useEffect(() => {
        if (!open) return;
        const next = readDirectorProject(initialProject);
        setProject(next.project);
        setUnsupportedProjectVersion(next.unsupportedVersion);
        setSelectedObjectId(null);
        setSelectedSceneNodeId(null);
        setSceneError(null);
    }, [initialProject, open]);

    useEffect(() => {
        if (!open || !stageRef.current) return;
        let cancelled = false;
        let frame = 0;
        let resizeObserver: ResizeObserver | null = null;
        let runtime: DirectorSceneRuntime | null = null;

        const setup = async () => {
            try {
                const THREE = await import("three");
                const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
                if (cancelled || !stageRef.current) return;

                const stage = stageRef.current;
                const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                renderer.shadowMap.enabled = true;
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                renderer.domElement.className = "block size-full touch-none";
                renderer.domElement.setAttribute("aria-label", t("canvas.director.stageLabel"));
                stage.appendChild(renderer.domElement);

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.minDistance = 3;
                controls.maxDistance = 30;
                controls.maxPolarAngle = Math.PI / 2 - 0.04;
                controls.screenSpacePanning = true;

                const objectRoot = new THREE.Group();
                scene.add(objectRoot);
                const studioGeometry = addStudioGeometry(THREE, scene);
                let panoramaMesh: Mesh | null = null;
                let panoramaTexture: import("three").Texture | null = null;
                let panoramaUrl: string | undefined;
                let panoramaRequest = 0;

                const clearPanorama = () => {
                    panoramaRequest += 1;
                    if (panoramaMesh) {
                        scene.remove(panoramaMesh);
                        panoramaMesh.geometry.dispose();
                        const materials = Array.isArray(panoramaMesh.material) ? panoramaMesh.material : [panoramaMesh.material];
                        materials.forEach((material) => material.dispose());
                        panoramaMesh = null;
                    }
                    panoramaTexture?.dispose();
                    panoramaTexture = null;
                    panoramaUrl = undefined;
                };
                const applyPanoramaTransform = (environment: DirectorEnvironment) => {
                    if (!panoramaMesh) return;
                    panoramaMesh.scale.setScalar(environment.panoramaRadius);
                    panoramaMesh.rotation.y = THREE.MathUtils.degToRad(environment.panoramaRotationY);
                };
                const syncPanorama = (environment: DirectorEnvironment) => {
                    if (environment.panoramaUrl !== panoramaUrl) {
                        clearPanorama();
                        panoramaUrl = environment.panoramaUrl;
                        if (panoramaUrl) {
                            const requestedUrl = panoramaUrl;
                            const request = ++panoramaRequest;
                            void new THREE.TextureLoader().loadAsync(requestedUrl).then((texture) => {
                                if (cancelled || request !== panoramaRequest) {
                                    texture.dispose();
                                    return;
                                }
                                texture.colorSpace = THREE.SRGBColorSpace;
                                texture.minFilter = THREE.LinearFilter;
                                panoramaTexture = texture;
                                panoramaMesh = new THREE.Mesh(
                                    new THREE.SphereGeometry(1, 64, 40),
                                    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, toneMapped: false, fog: false }),
                                );
                                scene.add(panoramaMesh);
                                applyPanoramaTransform(environment);
                            }).catch(() => {
                                if (!cancelled && request === panoramaRequest) panoramaUrl = undefined;
                            });
                        }
                    }
                    applyPanoramaTransform(environment);
                };

                const raycaster = new THREE.Raycaster();
                const pointer = new THREE.Vector2();
                let pointerStart = { x: 0, y: 0 };

                const resize = () => {
                    const rect = stage.getBoundingClientRect();
                    const width = Math.max(1, rect.width);
                    const height = Math.max(1, rect.height);
                    renderer.setSize(width, height, false);
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                };
                resizeObserver = new ResizeObserver(resize);
                resizeObserver.observe(stage);
                resize();

                const selectAtPointer = (event: PointerEvent) => {
                    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
                    const rect = renderer.domElement.getBoundingClientRect();
                    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
                    raycaster.setFromCamera(pointer, camera);
                    const hit = raycaster.intersectObjects(objectRoot.children, true).find((item) => item.object.userData.directorObjectId);
                    setSelectedObjectId(hit?.object.userData.directorObjectId || null);
                    setSelectedSceneNodeId(null);
                };
                const rememberPointer = (event: PointerEvent) => {
                    pointerStart = { x: event.clientX, y: event.clientY };
                };
                const syncCamera = () => {
                    setProject((current) => ({
                        ...current,
                        camera: {
                            ...current.camera,
                            position: vectorState(camera.position),
                            target: vectorState(controls.target),
                        },
                    }));
                };
                const contextLost = (event: Event) => {
                    event.preventDefault();
                    setSceneError(t("canvas.director.webglLost"));
                };
                renderer.domElement.addEventListener("pointerdown", rememberPointer);
                renderer.domElement.addEventListener("pointerup", selectAtPointer);
                renderer.domElement.addEventListener("webglcontextlost", contextLost);
                controls.addEventListener("end", syncCamera);

                let syncedObjects: DirectorProjectState["objects"] | null = null;
                let syncedSelectedId: string | null | undefined;
                const sync = (nextProject: DirectorProjectState, selectedId: string | null) => {
                    if (nextProject.objects !== syncedObjects || selectedId !== syncedSelectedId) {
                        clearObjectRoot(objectRoot);
                        nextProject.objects.forEach((item) => {
                            const mesh = createObjectMesh(THREE, item, item.id === selectedId);
                            objectRoot.add(mesh);
                        });
                        syncedObjects = nextProject.objects;
                        syncedSelectedId = selectedId;
                    }
                    applyBackground(THREE, scene, nextProject.background);
                    applyEnvironment(studioGeometry.floor, studioGeometry.grid, nextProject.environment);
                    syncPanorama(nextProject.environment);
                    camera.position.set(nextProject.camera.position.x, nextProject.camera.position.y, nextProject.camera.position.z);
                    controls.target.set(nextProject.camera.target.x, nextProject.camera.target.y, nextProject.camera.target.z);
                    camera.fov = nextProject.camera.fov;
                    camera.zoom = nextProject.camera.zoom;
                    camera.updateProjectionMatrix();
                    controls.update();
                };

                const capture = () => {
                    const rect = stage.getBoundingClientRect();
                    const width = Math.max(1, rect.width);
                    const height = Math.max(1, rect.height);
                    renderer.setPixelRatio(1);
                    renderer.setSize(1280, 720, false);
                    camera.aspect = 16 / 9;
                    camera.updateProjectionMatrix();
                    controls.update();
                    renderer.render(scene, camera);
                    const dataUrl = renderer.domElement.toDataURL("image/png");
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                    renderer.setSize(width, height, false);
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                    renderer.render(scene, camera);
                    return dataUrl;
                };

                const render = () => {
                    controls.update();
                    renderer.render(scene, camera);
                    frame = window.requestAnimationFrame(render);
                };

                runtime = {
                    capture,
                    sync,
                    dispose: () => {
                        window.cancelAnimationFrame(frame);
                        resizeObserver?.disconnect();
                        renderer.domElement.removeEventListener("pointerdown", rememberPointer);
                        renderer.domElement.removeEventListener("pointerup", selectAtPointer);
                        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
                        controls.removeEventListener("end", syncCamera);
                        controls.dispose();
                        clearPanorama();
                        clearObjectRoot(objectRoot);
                        disposeScene(THREE, scene);
                        renderer.dispose();
                        renderer.forceContextLoss();
                        renderer.domElement.remove();
                    },
                };
                runtimeRef.current = runtime;
                sync(projectRef.current, selectedObjectIdRef.current);
                render();
            } catch {
                if (!cancelled) setSceneError(t("canvas.director.webglUnavailable"));
            }
        };

        void setup();
        return () => {
            cancelled = true;
            resizeObserver?.disconnect();
            window.cancelAnimationFrame(frame);
            runtime?.dispose();
            runtimeRef.current = null;
        };
    }, [open, sceneRevision, t]);

    useEffect(() => {
        runtimeRef.current?.sync(project, selectedObjectId);
    }, [project, selectedObjectId]);

    const selectedObject = useMemo(() => project.objects.find((item) => item.id === selectedObjectId) || null, [project.objects, selectedObjectId]);
    const selectedSceneNode = useMemo(() => project.sceneNodes.find((item) => item.id === selectedSceneNodeId) || null, [project.sceneNodes, selectedSceneNodeId]);
    const availableSceneParents = useMemo(() => selectedSceneNode ? getAvailableDirectorSceneNodeParents(project.sceneNodes, selectedSceneNode.id) : [], [project.sceneNodes, selectedSceneNode]);
    const sceneTree = useMemo(() => buildDirectorSceneTree(project), [project]);

    const addObject = (kind: DirectorObjectKind) => {
        if (project.objects.length >= DIRECTOR_MAX_OBJECTS) {
            message.warning(t("canvas.director.objectLimit", { count: DIRECTOR_MAX_OBJECTS }));
            return;
        }
        const item = createDirectorObject(kind, project.objects.length);
        setProject((current) => ({ ...current, objects: [...current.objects, item] }));
        setSelectedObjectId(item.id);
        setSelectedSceneNodeId(null);
    };

    const addSceneGroup = () => {
        if (project.sceneNodes.length >= DIRECTOR_MAX_SCENE_NODES) {
            message.warning(t("canvas.director.sceneNodeLimit", { count: DIRECTOR_MAX_SCENE_NODES }));
            return;
        }
        const item = createDirectorSceneNode("group", project.sceneNodes.length, selectedSceneNodeId);
        setProject((current) => ({ ...current, sceneNodes: [...current.sceneNodes, item] }));
        setSelectedObjectId(null);
        setSelectedSceneNodeId(item.id);
    };

    const updateSelectedObject = (patch: Partial<DirectorObject>) => {
        if (!selectedObjectId) return;
        setProject((current) => ({
            ...current,
            objects: current.objects.map((item) => (item.id === selectedObjectId ? { ...item, ...patch } : item)),
        }));
    };

    const updateSelectedPosition = (axis: keyof DirectorVector3, value: number | null) => {
        if (!selectedObject || value === null) return;
        updateSelectedObject({ position: { ...selectedObject.position, [axis]: value } });
    };

    const updateSelectedSceneNode = (patch: Partial<DirectorSceneNode>) => {
        if (!selectedSceneNodeId) return;
        setProject((current) => ({
            ...current,
            sceneNodes: current.sceneNodes.map((item) => (item.id === selectedSceneNodeId ? { ...item, ...patch } : item)),
        }));
    };

    const removeSelectedObject = () => {
        if (!selectedObjectId) return;
        setProject((current) => ({ ...current, objects: current.objects.filter((item) => item.id !== selectedObjectId) }));
        setSelectedObjectId(null);
    };

    const updateEnvironment = (patch: Partial<DirectorEnvironment>) => {
        setProject((current) => ({ ...current, environment: { ...current.environment, ...patch } }));
    };

    const loadPanoramaFile = (file: File | undefined) => {
        if (!file) return;
        if (file.size > MAX_PANORAMA_SOURCE_BYTES) {
            message.error(t("canvas.director.panoramaTooLarge"));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const source = normalizePanoramaSource(reader.result);
            if (!source) {
                message.error(t("canvas.director.panoramaUnsupported"));
                return;
            }
            updateEnvironment({ panoramaUrl: source });
        };
        reader.onerror = () => message.error(t("canvas.director.panoramaReadFailed"));
        reader.readAsDataURL(file);
    };

    const save = () => {
        if (unsupportedProjectVersion !== null) {
            message.error(t("canvas.director.unsupportedVersion", { version: String(unsupportedProjectVersion) }));
            return;
        }
        const next = normalizeDirectorProject(project);
        onSave(next);
        message.success(t("canvas.director.saved"));
    };

    const capture = async () => {
        if (unsupportedProjectVersion !== null) {
            message.error(t("canvas.director.unsupportedVersion", { version: String(unsupportedProjectVersion) }));
            return;
        }
        const dataUrl = runtimeRef.current?.capture();
        if (!dataUrl || !isValidDirectorCapture(dataUrl)) {
            message.error(t("canvas.director.captureFailed"));
            return;
        }
        setCapturing(true);
        try {
            await onCapture(dataUrl, normalizeDirectorProject(project));
            message.success(t("canvas.director.captureSuccess"));
        } catch {
            message.error(t("canvas.director.captureFailed"));
        } finally {
            setCapturing(false);
        }
    };

    const resetProject = () => {
        setProject(createDirectorProject());
        setUnsupportedProjectVersion(null);
        setSelectedObjectId(null);
        setSelectedSceneNodeId(null);
    };

    return (
        <Modal
            open={open}
            centered
            width="min(1180px, 96vw)"
            destroyOnHidden
            mask={{ closable: false }}
            afterOpenChange={(visible) => {
                if (visible) setSceneRevision((current) => current + 1);
            }}
            onCancel={onClose}
            title={t("canvas.director.title")}
            styles={{
                body: { padding: 0, overflow: "hidden", borderRadius: 16 },
                header: { margin: 0, padding: "14px 18px", borderBottom: `1px solid ${token.colorBorderSecondary}` },
                footer: { margin: 0, padding: "12px 16px", borderTop: `1px solid ${token.colorBorderSecondary}` },
            }}
            footer={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button icon={<RotateCcw className="size-4" />} onClick={resetProject}>
                        {t("canvas.director.reset")}
                    </Button>
                    <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                        <Button onClick={onClose}>{t("common.close")}</Button>
                        <Button icon={<Save className="size-4" />} disabled={unsupportedProjectVersion !== null} onClick={save}>
                            {t("common.save")}
                        </Button>
                        <Button type="primary" loading={capturing} disabled={Boolean(sceneError) || unsupportedProjectVersion !== null} icon={<Camera className="size-4" />} onClick={() => void capture()}>
                            {t("canvas.director.capture")}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px]">
                <div className="relative min-h-[420px] overflow-hidden bg-[#17191d]" style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}>
                    <div ref={stageRef} className="absolute inset-0" />
                    {sceneError ? (
                        <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm" style={{ background: "#17191d", color: "#d6d3d1" }}>
                            {sceneError}
                        </div>
                    ) : null}
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-white/70">
                        <span>{t("canvas.director.dragHint")}</span>
                        <span>{t("canvas.director.count", { count: project.objects.length, max: DIRECTOR_MAX_OBJECTS })}</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 p-4">
                        {objectKinds.map(({ kind, icon: Icon }) => (
                            <Button key={kind} ghost icon={<Icon className="size-4" />} onClick={() => addObject(kind)}>
                                {t(`canvas.director.objects.${kind}`)}
                            </Button>
                        ))}
                        <Button ghost icon={<RotateCcw className="size-4" />} onClick={() => setProject((current) => ({ ...current, camera: createDirectorProject().camera }))}>
                            {t("canvas.director.resetCamera")}
                        </Button>
                    </div>
                </div>

                <div className="thin-scrollbar max-h-[620px] overflow-y-auto p-4">
                    {unsupportedProjectVersion !== null ? (
                        <div className="mb-4 rounded-xl border px-3 py-2 text-xs leading-5" style={{ background: token.colorWarningBg, borderColor: token.colorWarningBorder, color: token.colorWarningText }}>
                            {t("canvas.director.unsupportedVersion", { version: String(unsupportedProjectVersion) })}
                        </div>
                    ) : null}
                    <div className="mb-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <label className="text-xs font-medium opacity-60">{t("canvas.director.sceneTree")}</label>
                            <Button size="small" type="text" className="!h-7 !px-2" icon={<Plus className="size-3.5" />} onClick={addSceneGroup}>
                                {t("canvas.director.addSceneGroup")}
                            </Button>
                        </div>
                        <div className="max-h-52 overflow-y-auto rounded-xl border p-1.5" style={{ borderColor: canvasTheme.node.stroke }}>
                            {sceneTree.map((entry) => {
                                const Icon = sceneTreeIcon(entry);
                                const label = sceneTreeLabel(entry, t);
                                const selectable = Boolean(entry.objectId || entry.sceneNodeId);
                                const selected = entry.objectId ? entry.objectId === selectedObjectId : entry.sceneNodeId ? entry.sceneNodeId === selectedSceneNodeId : false;
                                const selectEntry = () => {
                                    if (entry.objectId) {
                                        setSelectedObjectId(entry.objectId);
                                        setSelectedSceneNodeId(null);
                                    } else if (entry.sceneNodeId) {
                                        setSelectedSceneNodeId(entry.sceneNodeId);
                                        setSelectedObjectId(null);
                                    }
                                };
                                const content = (
                                    <>
                                        <Icon className="size-3.5 shrink-0 opacity-55" />
                                        <span className="min-w-0 flex-1 truncate">{label}</span>
                                    </>
                                );
                                return selectable ? (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] transition ${selected ? "bg-black/[0.06] font-medium dark:bg-white/[0.09]" : "hover:bg-black/[0.035] dark:hover:bg-white/[0.05]"}`}
                                        style={{ paddingLeft: 8 + entry.depth * 12 }}
                                        onClick={selectEntry}
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <div key={entry.id} className="flex h-8 items-center gap-2 px-2 text-[11px] opacity-70" style={{ paddingLeft: 8 + entry.depth * 12 }}>
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mb-5 space-y-4">
                        <div className="text-xs font-medium opacity-60">{t("canvas.director.camera")}</div>
                        <RangeField label={t("canvas.director.fov")} value={project.camera.fov} min={DIRECTOR_MIN_FOV} max={DIRECTOR_MAX_FOV} step={1} suffix="°" onChange={(fov) => setProject((current) => ({ ...current, camera: { ...current.camera, fov } }))} />
                        <RangeField label={t("canvas.director.zoom")} value={project.camera.zoom} min={0.1} max={5} step={0.1} onChange={(zoom) => setProject((current) => ({ ...current, camera: { ...current.camera, zoom } }))} />
                    </div>

                    <div className="mb-5 space-y-3">
                        <div className="flex items-center justify-between gap-3 text-xs font-medium opacity-60">
                            <span>{t("canvas.director.ground")}</span>
                            <Switch size="small" checked={project.environment.groundVisible} onChange={(groundVisible) => updateEnvironment({ groundVisible })} />
                        </div>
                        <RangeField label={t("canvas.director.groundOpacity")} value={project.environment.groundOpacity} min={0} max={1} step={0.1} onChange={(groundOpacity) => updateEnvironment({ groundOpacity })} />
                        <div>
                            <div className="mb-1 text-[11px] opacity-45">{t("canvas.director.groundHeight")}</div>
                            <InputNumber className="w-full" min={-8} max={8} step={0.1} value={project.environment.groundHeight} onChange={(groundHeight) => groundHeight !== null && updateEnvironment({ groundHeight })} />
                        </div>
                    </div>

                    <div className="mb-5 rounded-xl border p-3" style={{ borderColor: canvasTheme.node.stroke }}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs font-medium opacity-60">{t("canvas.director.panorama")}</div>
                                <div className="mt-1 text-[10px] leading-4 opacity-40">{t("canvas.director.panoramaHint")}</div>
                            </div>
                            <Button size="small" type="text" className="!h-7 shrink-0 !px-2" icon={<ImagePlus className="size-3.5" />} onClick={() => panoramaInputRef.current?.click()}>
                                {project.environment.panoramaUrl ? t("canvas.director.replacePanorama") : t("canvas.director.loadPanorama")}
                            </Button>
                        </div>
                        {project.environment.panoramaUrl ? (
                            <div className="mt-3 space-y-3">
                                <div className="relative overflow-hidden rounded-lg border" style={{ borderColor: canvasTheme.node.stroke }}>
                                    <img src={project.environment.panoramaUrl} alt={t("canvas.director.panorama")} className="aspect-[2/1] w-full object-cover" />
                                    <Button className="!absolute right-1.5 top-1.5" size="small" danger type="primary" icon={<Trash2 className="size-3.5" />} aria-label={t("canvas.director.removePanorama")} onClick={() => updateEnvironment({ panoramaUrl: undefined })} />
                                </div>
                                <RangeField label={t("canvas.director.panoramaRotation")} value={project.environment.panoramaRotationY} min={-180} max={180} step={1} suffix="°" onChange={(panoramaRotationY) => updateEnvironment({ panoramaRotationY })} />
                            </div>
                        ) : null}
                        <input
                            ref={panoramaInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(event) => {
                                loadPanoramaFile(event.currentTarget.files?.[0]);
                                event.currentTarget.value = "";
                            }}
                        />
                    </div>

                    <div className="mb-5">
                        <label className="mb-2 block text-xs font-medium opacity-60">{t("canvas.director.background")}</label>
                        <Select
                            className="w-full"
                            value={project.background}
                            onChange={(value: DirectorBackground) => setProject((current) => ({ ...current, background: value }))}
                            options={[
                                { value: "studio", label: t("canvas.director.backgrounds.studio") },
                                { value: "night", label: t("canvas.director.backgrounds.night") },
                                { value: "sunset", label: t("canvas.director.backgrounds.sunset") },
                            ]}
                        />
                    </div>

                    {selectedObject ? (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold">{t(`canvas.director.objects.${selectedObject.kind}`)}</div>
                                    <div className="mt-1 text-xs opacity-45">{selectedObject.id}</div>
                                </div>
                                <Button danger type="text" icon={<Trash2 className="size-4" />} onClick={removeSelectedObject}>
                                    {t("common.delete")}
                                </Button>
                            </div>

                            <div>
                                <div className="mb-2 text-xs font-medium opacity-60">{t("canvas.director.position")}</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {(["x", "y", "z"] as const).map((axis) => (
                                        <div key={axis}>
                                            <div className="mb-1 text-center text-[11px] uppercase opacity-45">{axis}</div>
                                            <InputNumber className="w-full" min={axis === "y" ? 0 : -8} max={axis === "y" ? 6 : 8} step={0.1} value={selectedObject.position[axis]} onChange={(value) => updateSelectedPosition(axis, value)} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <RangeField label={t("canvas.director.rotation")} value={selectedObject.rotationY} min={-180} max={180} step={1} suffix="°" onChange={(rotationY) => updateSelectedObject({ rotationY })} />
                            <RangeField label={t("canvas.director.scale")} value={selectedObject.scale} min={0.2} max={3} step={0.1} onChange={(scale) => updateSelectedObject({ scale })} />

                            <div>
                                <div className="mb-2 text-xs font-medium opacity-60">{t("canvas.director.color")}</div>
                                <ColorPicker
                                    value={selectedObject.color}
                                    disabledAlpha
                                    showText
                                    onChange={(_, css) => {
                                        const color = normalizeDirectorColor(css);
                                        if (color) updateSelectedObject({ color });
                                    }}
                                />
                            </div>
                        </div>
                    ) : selectedSceneNode ? (
                        <div className="space-y-5">
                            <div>
                                <div className="text-sm font-semibold">{selectedSceneNode.kind === "group" ? t("canvas.director.sceneGroup") : t("canvas.director.sceneNode")}</div>
                                <div className="mt-1 text-xs opacity-45">{selectedSceneNode.id}</div>
                            </div>
                            <div>
                                <div className="mb-2 text-xs font-medium opacity-60">{t("canvas.director.sceneNodeName")}</div>
                                <Input
                                    value={selectedSceneNode.name}
                                    maxLength={60}
                                    onChange={(event) => updateSelectedSceneNode({ name: event.target.value })}
                                    onBlur={() => {
                                        if (selectedSceneNode.name.trim()) {
                                            updateSelectedSceneNode({ name: selectedSceneNode.name.trim() });
                                            return;
                                        }
                                        const index = project.sceneNodes.findIndex((item) => item.id === selectedSceneNode.id) + 1;
                                        updateSelectedSceneNode({ name: defaultSceneNodeName(selectedSceneNode, index, t) });
                                    }}
                                />
                            </div>
                            <div>
                                <div className="mb-2 text-xs font-medium opacity-60">{t("canvas.director.sceneNodeParent")}</div>
                                <Select
                                    className="w-full"
                                    value={selectedSceneNode.parentId ?? ""}
                                    options={[
                                        { value: "", label: t("canvas.director.sceneNodeRoot") },
                                        ...availableSceneParents.map((node) => ({ value: node.id, label: node.name })),
                                    ]}
                                    onChange={(parentId: string) => updateSelectedSceneNode({ parentId: parentId || null })}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="grid min-h-72 place-items-center rounded-xl border border-dashed p-6 text-center text-sm opacity-55" style={{ borderColor: canvasTheme.node.stroke }}>
                            {t("canvas.director.selectObject")}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

function RangeField({ label, value, min, max, step, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium opacity-60">{label}</span>
                <span className="tabular-nums opacity-55">
                    {value.toFixed(step < 1 ? 1 : 0)}
                    {suffix}
                </span>
            </div>
            <Slider min={min} max={max} step={step} value={value} onChange={(next) => onChange(Number(next))} />
        </div>
    );
}

function sceneTreeIcon(entry: DirectorSceneTreeEntry) {
    if (entry.kind === "camera") return Camera;
    if (entry.kind === "group") return Folder;
    if (entry.kind === "light") return Lightbulb;
    if (entry.kind === "path") return Route;
    return entry.kind === "waypoint" ? MapPin : Box;
}

function sceneTreeLabel(entry: DirectorSceneTreeEntry, t: (key: string) => string) {
    if (entry.kind === "camera") return t("canvas.director.mainCamera");
    return entry.label;
}

function defaultSceneNodeName(node: DirectorSceneNode, index: number, t: (key: string, values?: Record<string, unknown>) => string) {
    return node.kind === "group"
        ? t("canvas.director.defaultSceneGroupName", { count: index })
        : t("canvas.director.defaultSceneNodeName", { count: index });
}

function addStudioGeometry(THREE: typeof import("three"), scene: Scene) {
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1c1917, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(6, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xfb923c, 1.4);
    rimLight.position.set(-8, 5, -7);
    scene.add(rimLight);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x25272c, roughness: 0.9, transparent: true, opacity: 0.4 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(40, 40, 0x78716c, 0x44403c);
    grid.position.y = 0.01;
    scene.add(grid);
    return { floor, grid };
}

function applyBackground(THREE: typeof import("three"), scene: Scene, background: DirectorBackground) {
    const preset = {
        studio: { background: 0x17191d, fog: 0x17191d, fogNear: 20, fogFar: 48 },
        night: { background: 0x07101d, fog: 0x07101d, fogNear: 16, fogFar: 42 },
        sunset: { background: 0x321b20, fog: 0x321b20, fogNear: 18, fogFar: 44 },
    }[background];
    scene.background = new THREE.Color(preset.background);
    scene.fog = new THREE.Fog(preset.fog, preset.fogNear, preset.fogFar);
}

function applyEnvironment(floor: Mesh, grid: import("three").GridHelper, environment: DirectorEnvironment) {
    floor.visible = environment.groundVisible;
    floor.position.y = environment.groundHeight;
    const material = floor.material as import("three").MeshStandardMaterial;
    material.opacity = environment.groundOpacity;
    material.transparent = environment.groundOpacity < 1;
    material.needsUpdate = true;
    grid.visible = environment.groundVisible;
    grid.position.y = environment.groundHeight + 0.01;
}

function createObjectMesh(THREE: typeof import("three"), item: DirectorObject, selected: boolean) {
    const geometry =
        item.kind === "sphere"
            ? new THREE.SphereGeometry(0.8, 32, 20)
            : item.kind === "cylinder"
              ? new THREE.CylinderGeometry(0.7, 0.7, 1.6, 32)
              : item.kind === "cone"
                ? new THREE.ConeGeometry(0.8, 1.7, 32)
                : new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const material = new THREE.MeshStandardMaterial({
        color: item.color,
        roughness: 0.48,
        metalness: 0.08,
        emissive: selected ? 0xffffff : 0x000000,
        emissiveIntensity: selected ? 0.18 : 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(item.position.x, item.position.y, item.position.z);
    mesh.rotation.y = THREE.MathUtils.degToRad(item.rotationY);
    mesh.scale.setScalar(item.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.directorObjectId = item.id;
    return mesh;
}

function clearObjectRoot(root: Group) {
    root.children.forEach((child) => disposeObject3D(child));
    root.clear();
}

function disposeObject3D(object: Object3D) {
    object.traverse((child) => {
        const mesh = child as Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach((material) => material.dispose());
    });
}

function disposeScene(THREE: typeof import("three"), scene: Scene) {
    scene.traverse((child) => {
        const mesh = child as Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach((material) => material.dispose());
    });
    scene.clear();
}

function vectorState(vector: { x: number; y: number; z: number }): DirectorVector3 {
    return { x: vector.x, y: vector.y, z: vector.z };
}

function readDirectorProject(value: unknown) {
    try {
        return { project: normalizeDirectorProject(value), unsupportedVersion: null };
    } catch (error) {
        if (error instanceof UnsupportedDirectorProjectVersionError) {
            return { project: createDirectorProject(), unsupportedVersion: error.version };
        }
        throw error;
    }
}
