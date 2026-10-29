import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, ColorPicker, InputNumber, Modal, Select, Slider, theme as antdTheme } from "antd";
import { Box, Camera, Circle, Cylinder, RotateCcw, Save, Trash2, Triangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Group, Mesh, Object3D, Scene } from "three";

import {
    DIRECTOR_MAX_OBJECTS,
    createDirectorObject,
    createDirectorProject,
    isValidDirectorCapture,
    normalizeDirectorColor,
    normalizeDirectorProject,
    type DirectorBackground,
    type DirectorObject,
    type DirectorObjectKind,
    type DirectorProjectState,
    type DirectorVector3,
} from "@/lib/canvas/director-project";
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
    const runtimeRef = useRef<DirectorSceneRuntime | null>(null);
    const [project, setProject] = useState(() => normalizeDirectorProject(initialProject));
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [sceneError, setSceneError] = useState<string | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [sceneRevision, setSceneRevision] = useState(0);
    const projectRef = useRef(project);
    const selectedObjectIdRef = useRef(selectedObjectId);

    projectRef.current = project;
    selectedObjectIdRef.current = selectedObjectId;

    useEffect(() => {
        if (!open) return;
        const next = normalizeDirectorProject(initialProject);
        setProject(next);
        setSelectedObjectId(null);
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
                addStudioGeometry(THREE, scene);

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
                };
                const rememberPointer = (event: PointerEvent) => {
                    pointerStart = { x: event.clientX, y: event.clientY };
                };
                const syncCamera = () => {
                    setProject((current) => ({
                        ...current,
                        camera: {
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

                const sync = (nextProject: DirectorProjectState, selectedId: string | null) => {
                    clearObjectRoot(objectRoot);
                    nextProject.objects.forEach((item) => {
                        const mesh = createObjectMesh(THREE, item, item.id === selectedId);
                        objectRoot.add(mesh);
                    });
                    applyBackground(THREE, scene, nextProject.background);
                    camera.position.set(nextProject.camera.position.x, nextProject.camera.position.y, nextProject.camera.position.z);
                    controls.target.set(nextProject.camera.target.x, nextProject.camera.target.y, nextProject.camera.target.z);
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

    const addObject = (kind: DirectorObjectKind) => {
        if (project.objects.length >= DIRECTOR_MAX_OBJECTS) {
            message.warning(t("canvas.director.objectLimit", { count: DIRECTOR_MAX_OBJECTS }));
            return;
        }
        const item = createDirectorObject(kind, project.objects.length);
        setProject((current) => ({ ...current, objects: [...current.objects, item] }));
        setSelectedObjectId(item.id);
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

    const removeSelectedObject = () => {
        if (!selectedObjectId) return;
        setProject((current) => ({ ...current, objects: current.objects.filter((item) => item.id !== selectedObjectId) }));
        setSelectedObjectId(null);
    };

    const save = () => {
        const next = normalizeDirectorProject(project);
        onSave(next);
        message.success(t("canvas.director.saved"));
    };

    const capture = async () => {
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
        setSelectedObjectId(null);
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
                    <div className="flex items-center gap-2">
                        <Button onClick={onClose}>{t("common.close")}</Button>
                        <Button icon={<Save className="size-4" />} onClick={save}>
                            {t("common.save")}
                        </Button>
                        <Button type="primary" loading={capturing} disabled={Boolean(sceneError)} icon={<Camera className="size-4" />} onClick={() => void capture()}>
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

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x25272c, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(40, 40, 0x78716c, 0x44403c);
    grid.position.y = 0.01;
    scene.add(grid);
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
