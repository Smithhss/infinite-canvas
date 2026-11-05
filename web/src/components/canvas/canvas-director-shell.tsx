import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, ColorPicker, Input, InputNumber, Modal, Select, Slider, Switch, theme as antdTheme } from "antd";
import { Box, Camera, Circle, Crosshair, Cylinder, Diamond, EyeOff, Focus, Folder, ImagePlus, Lightbulb, Lock, MapPin, Pause, Play, Plus, RotateCcw, Route, Save, Trash2, Triangle, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Group, Mesh, Object3D, Scene } from "three";

import {
    DIRECTOR_MAX_FOV,
    DIRECTOR_MAX_GLB_BYTES,
    DIRECTOR_MAX_ANIMATION_DURATION,
    DIRECTOR_MAX_KEYFRAMES,
    DIRECTOR_MAX_MOTION_PATHS,
    DIRECTOR_MAX_OBJECTS,
    DIRECTOR_MAX_PATH_POINTS,
    DIRECTOR_MAX_SCENE_NODES,
    DIRECTOR_MIN_ANIMATION_DURATION,
    DIRECTOR_MIN_FOV,
    createDirectorObject,
    createDirectorProject,
    createDirectorSceneNode,
    hasValidDirectorGlbHeader,
    isValidDirectorCapture,
    normalizeDirectorColor,
    normalizeDirectorProject,
    UnsupportedDirectorProjectVersionError,
    type DirectorBackground,
    type DirectorCameraKeyframe,
    type DirectorEnvironment,
    type DirectorMotionPath,
    type DirectorObject,
    type DirectorObjectKind,
    type DirectorPathNode,
    type DirectorPathNodeKind,
    type DirectorProjectState,
    type DirectorSceneNode,
    type DirectorVector3,
} from "@/lib/canvas/director-project";
import { getDirectorCameraTrack, removeDirectorCameraKeyframe, sampleDirectorCameraTrack, setDirectorAnimationDuration, updateDirectorCameraKeyframe, upsertDirectorCameraKeyframe } from "@/lib/canvas/director-animation";
import { addDirectorPathNode, createDirectorMotionPath, createDirectorPathNode, getAvailableDirectorPathNodeParents, isDirectorPathNodeVisible, removeDirectorMotionPath, removeDirectorPathNode, updateDirectorMotionPath, updateDirectorPathNode } from "@/lib/canvas/director-motion-path";
import { buildDirectorSceneTree, getAvailableDirectorSceneNodeParents, isDirectorSceneNodeVisible, type DirectorSceneTreeEntry } from "@/lib/canvas/director-scene-tree";
import { MAX_PANORAMA_SOURCE_BYTES, normalizePanoramaSource } from "@/lib/canvas/panorama-source";
import { canvasThemes } from "@/lib/canvas-theme";
import { getMediaBlob, uploadMediaFile } from "@/services/file-storage";
import { useThemeStore } from "@/stores/use-theme-store";

type DirectorSceneRuntime = {
    capture: () => string | null;
    captureCameraPose: () => { position: DirectorVector3; target: DirectorVector3; fov: number } | null;
    previewCamera: (keyframe: DirectorCameraKeyframe) => void;
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
    const glbInputRef = useRef<HTMLInputElement>(null);
    const runtimeRef = useRef<DirectorSceneRuntime | null>(null);
    const [initialProjectState] = useState(() => readDirectorProject(initialProject));
    const [project, setProject] = useState(initialProjectState.project);
    const [unsupportedProjectVersion, setUnsupportedProjectVersion] = useState(initialProjectState.unsupportedVersion);
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [selectedSceneNodeId, setSelectedSceneNodeId] = useState<string | null>(null);
    const [selectedMotionPathId, setSelectedMotionPathId] = useState<string | null>(null);
    const [selectedPathNodeId, setSelectedPathNodeId] = useState<string | null>(null);
    const [sceneError, setSceneError] = useState<string | null>(null);
    const [capturing, setCapturing] = useState(false);
    const [importingGlb, setImportingGlb] = useState(false);
    const [assetErrors, setAssetErrors] = useState<Record<string, boolean>>({});
    const [sceneRevision, setSceneRevision] = useState(0);
    const [playhead, setPlayhead] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [selectedKeyframeTime, setSelectedKeyframeTime] = useState<number | null>(null);
    const projectRef = useRef(project);
    const selectedObjectIdRef = useRef(selectedObjectId);
    const playheadRef = useRef(playhead);

    projectRef.current = project;
    selectedObjectIdRef.current = selectedObjectId;
    playheadRef.current = playhead;

    useEffect(() => {
        if (!open) return;
        const next = readDirectorProject(initialProject);
        setProject(next.project);
        setUnsupportedProjectVersion(next.unsupportedVersion);
        setSelectedObjectId(null);
        setSelectedSceneNodeId(null);
        setSelectedMotionPathId(null);
        setSelectedPathNodeId(null);
        setSceneError(null);
        setAssetErrors({});
        setPlayhead(0);
        setPlaying(false);
        setSelectedKeyframeTime(null);
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
                const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
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
                const assetRoot = new THREE.Group();
                scene.add(assetRoot);
                const studioGeometry = addStudioGeometry(THREE, scene);
                const loadedAssets = new Map<string, { storageKey: string; object: Object3D }>();
                const loadingAssets = new Map<string, string>();
                let latestSceneNodes = projectRef.current.sceneNodes;
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
                const applySceneNodeTransform = (object: Object3D, node: DirectorSceneNode) => {
                    object.position.set(node.transform.position.x, node.transform.position.y, node.transform.position.z);
                    object.rotation.set(
                        THREE.MathUtils.degToRad(node.transform.rotation.x),
                        THREE.MathUtils.degToRad(node.transform.rotation.y),
                        THREE.MathUtils.degToRad(node.transform.rotation.z),
                    );
                    object.scale.set(node.transform.scale.x, node.transform.scale.y, node.transform.scale.z);
                    object.visible = isDirectorSceneNodeVisible(node, latestSceneNodes);
                };
                const removeLoadedAsset = (nodeId: string) => {
                    const loaded = loadedAssets.get(nodeId);
                    if (!loaded) return;
                    assetRoot.remove(loaded.object);
                    disposeObject3D(loaded.object);
                    loadedAssets.delete(nodeId);
                };
                const loadSceneAsset = (node: DirectorSceneNode) => {
                    const storageKey = node.asset?.storageKey;
                    if (!storageKey || loadingAssets.has(node.id)) return;
                    loadingAssets.set(node.id, storageKey);
                    void (async () => {
                        try {
                            const blob = await getMediaBlob(storageKey);
                            if (!blob) throw new Error("missing");
                            const buffer = await blob.arrayBuffer();
                            if (!hasValidDirectorGlbHeader(buffer)) throw new Error("invalid");
                            const gltf = await new GLTFLoader().parseAsync(buffer, "");
                            const current = latestSceneNodes.find((item) => item.id === node.id);
                            if (cancelled || current?.asset?.storageKey !== storageKey) {
                                disposeObject3D(gltf.scene);
                                return;
                            }
                            const object = new THREE.Group();
                            object.userData.directorSceneNodeId = node.id;
                            object.add(gltf.scene);
                            gltf.scene.traverse((child) => {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            });
                            applySceneNodeTransform(object, current);
                            assetRoot.add(object);
                            loadedAssets.set(node.id, { storageKey, object });
                            setAssetErrors((currentErrors) => {
                                if (!currentErrors[node.id]) return currentErrors;
                                const { [node.id]: _removed, ...rest } = currentErrors;
                                return rest;
                            });
                        } catch {
                            if (!cancelled && latestSceneNodes.some((item) => item.id === node.id && item.asset?.storageKey === storageKey)) {
                                setAssetErrors((currentErrors) => (currentErrors[node.id] ? currentErrors : { ...currentErrors, [node.id]: true }));
                            }
                        } finally {
                            if (loadingAssets.get(node.id) === storageKey) loadingAssets.delete(node.id);
                        }
                    })();
                };
                const syncAssets = (sceneNodes: DirectorSceneNode[]) => {
                    latestSceneNodes = sceneNodes;
                    const desired = new Map(sceneNodes.flatMap((node) => node.kind === "asset" && node.asset?.storageKey ? [[node.id, node] as const] : []));
                    loadedAssets.forEach((loaded, nodeId) => {
                        if (desired.get(nodeId)?.asset?.storageKey !== loaded.storageKey) removeLoadedAsset(nodeId);
                    });
                    loadingAssets.forEach((storageKey, nodeId) => {
                        if (desired.get(nodeId)?.asset?.storageKey !== storageKey) loadingAssets.delete(nodeId);
                    });
                    desired.forEach((node, nodeId) => {
                        const loaded = loadedAssets.get(nodeId);
                        if (loaded) {
                            applySceneNodeTransform(loaded.object, node);
                        } else {
                            loadSceneAsset(node);
                        }
                    });
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
                    const hit = raycaster.intersectObjects([objectRoot, assetRoot], true)[0];
                    const selection = hit ? findDirectorSelection(hit.object) : null;
                    setSelectedObjectId(selection?.objectId || null);
                    setSelectedSceneNodeId(selection?.sceneNodeId || null);
                    setSelectedMotionPathId(null);
                    setSelectedPathNodeId(null);
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
                const captureCameraPose = () => ({
                    position: vectorState(camera.position),
                    target: vectorState(controls.target),
                    fov: camera.fov,
                });
                const previewCamera = (keyframe: DirectorCameraKeyframe) => {
                    camera.position.set(keyframe.position.x, keyframe.position.y, keyframe.position.z);
                    if (keyframe.lookAt) controls.target.set(keyframe.lookAt.x, keyframe.lookAt.y, keyframe.lookAt.z);
                    if (keyframe.fov !== undefined) camera.fov = keyframe.fov;
                    camera.updateProjectionMatrix();
                    controls.update();
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
                    syncAssets(nextProject.sceneNodes);
                    camera.position.set(nextProject.camera.position.x, nextProject.camera.position.y, nextProject.camera.position.z);
                    const cameraTarget = resolveDirectorCameraTarget(nextProject, nextProject.camera.followTargetId || nextProject.camera.lookAtTarget);
                    controls.target.set(
                        cameraTarget?.x ?? nextProject.camera.target.x,
                        cameraTarget?.y ?? nextProject.camera.target.y,
                        cameraTarget?.z ?? nextProject.camera.target.z,
                    );
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
                    captureCameraPose,
                    previewCamera,
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
                        loadedAssets.forEach((loaded) => {
                            assetRoot.remove(loaded.object);
                            disposeObject3D(loaded.object);
                        });
                        loadedAssets.clear();
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

    const activeCameraTrack = useMemo(() => getDirectorCameraTrack(project), [project]);
    const selectedKeyframe = useMemo(
        () => selectedKeyframeTime === null ? null : activeCameraTrack?.keyframes.find((keyframe) => Math.abs(keyframe.time - selectedKeyframeTime) < 0.0001) || null,
        [activeCameraTrack, selectedKeyframeTime],
    );

    useEffect(() => {
        if (!open || !playing || !activeCameraTrack?.keyframes.length) return;
        const duration = project.animation.duration;
        const startedAt = performance.now() - playheadRef.current * 1000;
        let frame = 0;
        let lastUiUpdate = 0;
        const tick = (now: number) => {
            const time = Math.min(duration, Math.max(0, (now - startedAt) / 1000));
            if (now - lastUiUpdate >= 33 || time >= duration) {
                lastUiUpdate = now;
                setPlayhead(time);
            }
            const sample = sampleDirectorCameraTrack(activeCameraTrack, time);
            if (sample) runtimeRef.current?.previewCamera(sample);
            if (time >= duration) {
                setPlaying(false);
                return;
            }
            frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
    }, [activeCameraTrack, open, playing, project.animation.duration]);

    const selectedObject = useMemo(() => project.objects.find((item) => item.id === selectedObjectId) || null, [project.objects, selectedObjectId]);
    const selectedSceneNode = useMemo(() => project.sceneNodes.find((item) => item.id === selectedSceneNodeId) || null, [project.sceneNodes, selectedSceneNodeId]);
    const availableSceneParents = useMemo(() => selectedSceneNode ? getAvailableDirectorSceneNodeParents(project.sceneNodes, selectedSceneNode.id) : [], [project.sceneNodes, selectedSceneNode]);
    const selectedMotionPath = useMemo(() => project.animation.motionPaths.find((item) => item.id === selectedMotionPathId) || null, [project.animation.motionPaths, selectedMotionPathId]);
    const selectedPathNode = useMemo(() => selectedMotionPath?.nodes.find((item) => item.id === selectedPathNodeId) || null, [selectedMotionPath, selectedPathNodeId]);
    const availablePathNodeParents = useMemo(() => selectedMotionPath && selectedPathNode ? getAvailableDirectorPathNodeParents(selectedMotionPath, selectedPathNode.id) : [], [selectedMotionPath, selectedPathNode]);
    const sceneTree = useMemo(() => buildDirectorSceneTree(project), [project]);
    const cameraTargets = useMemo(
        () => sceneTree.flatMap((entry) => {
            const value = entry.objectId || entry.sceneNodeId;
            return value ? [{ value, label: sceneTreeLabel(entry, t) }] : [];
        }),
        [sceneTree, t],
    );

    const addObject = (kind: DirectorObjectKind) => {
        if (project.objects.length >= DIRECTOR_MAX_OBJECTS) {
            message.warning(t("canvas.director.objectLimit", { count: DIRECTOR_MAX_OBJECTS }));
            return;
        }
        const item = createDirectorObject(kind, project.objects.length);
        setProject((current) => ({ ...current, objects: [...current.objects, item] }));
        setSelectedObjectId(item.id);
        setSelectedSceneNodeId(null);
        setSelectedMotionPathId(null);
        setSelectedPathNodeId(null);
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
        setSelectedMotionPathId(null);
        setSelectedPathNodeId(null);
    };

    const addMotionPath = () => {
        if (project.animation.motionPaths.length >= DIRECTOR_MAX_MOTION_PATHS) {
            message.warning(t("canvas.director.motionPathLimit", { count: DIRECTOR_MAX_MOTION_PATHS }));
            return;
        }
        const item = createDirectorMotionPath(project.animation.motionPaths.length);
        setProject((current) => ({
            ...current,
            animation: { ...current.animation, motionPaths: [...current.animation.motionPaths, item] },
        }));
        setSelectedObjectId(null);
        setSelectedSceneNodeId(null);
        setSelectedMotionPathId(item.id);
        setSelectedPathNodeId(null);
    };

    const addSelectedPathNode = (kind: DirectorPathNodeKind) => {
        if (!selectedMotionPath) return;
        if (selectedMotionPath.nodes.length >= DIRECTOR_MAX_PATH_POINTS) {
            message.warning(t("canvas.director.motionPathNodeLimit", { count: DIRECTOR_MAX_PATH_POINTS }));
            return;
        }
        const item = createDirectorPathNode(selectedMotionPath.id, kind, selectedMotionPath.nodes.length);
        setProject((current) => addDirectorPathNode(current, selectedMotionPath.id, item));
        setSelectedPathNodeId(item.id);
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
        if (!selectedSceneNode || (selectedSceneNode.locked && patch.locked !== false)) return;
        setProject((current) => ({
            ...current,
            sceneNodes: current.sceneNodes.map((item) => (item.id === selectedSceneNodeId ? { ...item, ...patch } : item)),
        }));
    };

    const updateSelectedMotionPath = (patch: Partial<Pick<DirectorMotionPath, "name" | "closed">>) => {
        if (!selectedMotionPath) return;
        setProject((current) => updateDirectorMotionPath(current, selectedMotionPath.id, patch));
    };

    const updateSelectedPathNode = (patch: Partial<Pick<DirectorPathNode, "name" | "parentId" | "visible" | "locked" | "transform">>) => {
        if (!selectedMotionPath || !selectedPathNode) return;
        setProject((current) => updateDirectorPathNode(current, selectedMotionPath.id, selectedPathNode.id, patch));
    };

    const updateSelectedPathTransform = (group: keyof DirectorPathNode["transform"], axis: keyof DirectorVector3, value: number | null) => {
        if (!selectedPathNode || value === null) return;
        updateSelectedPathNode({
            transform: {
                ...selectedPathNode.transform,
                [group]: { ...selectedPathNode.transform[group], [axis]: value },
            },
        });
    };

    const removeSelectedPathNode = () => {
        if (!selectedMotionPath || !selectedPathNode || selectedPathNode.locked) return;
        setProject((current) => removeDirectorPathNode(current, selectedMotionPath.id, selectedPathNode.id));
        setSelectedPathNodeId(null);
    };

    const removeSelectedMotionPath = () => {
        if (!selectedMotionPath) return;
        setProject((current) => removeDirectorMotionPath(current, selectedMotionPath.id));
        setSelectedMotionPathId(null);
        setSelectedPathNodeId(null);
    };

    const setCameraTarget = (key: "lookAtTarget" | "followTargetId", value: string | undefined) => {
        setProject((current) => {
            const camera = { ...current.camera };
            delete camera[key];
            if (value) camera[key] = value;
            return { ...current, camera };
        });
    };

    const previewCameraTime = (time: number) => {
        setPlaying(false);
        const nextTime = Math.min(project.animation.duration, Math.max(0, time));
        setPlayhead(nextTime);
        const sample = sampleDirectorCameraTrack(activeCameraTrack, nextTime);
        if (sample) runtimeRef.current?.previewCamera(sample);
    };

    const addCameraKeyframe = () => {
        const pose = runtimeRef.current?.captureCameraPose();
        if (!pose) {
            message.warning(t("canvas.director.keyframeUnavailable"));
            return;
        }
        setPlaying(false);
        const time = Math.min(project.animation.duration, Math.max(0, playhead));
        setProject((current) => upsertDirectorCameraKeyframe(current, {
            time,
            position: pose.position,
            lookAt: pose.target,
            fov: pose.fov,
            easing: "smooth",
        }));
        setSelectedKeyframeTime(Math.round(time * 100) / 100);
    };

    const updateAnimationDuration = (duration: number) => {
        setPlaying(false);
        setPlayhead((current) => Math.min(current, duration));
        setSelectedKeyframeTime((current) => current === null ? null : Math.min(current, duration));
        setProject((current) => setDirectorAnimationDuration(current, duration));
    };

    const removeCameraKeyframe = (time: number) => {
        setPlaying(false);
        setProject((current) => removeDirectorCameraKeyframe(current, time));
        setSelectedKeyframeTime((current) => current !== null && Math.abs(current - time) < 0.0001 ? null : current);
    };

    const updateSelectedKeyframe = (patch: Partial<Pick<DirectorCameraKeyframe, "time" | "easing" | "fov">>) => {
        if (selectedKeyframeTime === null) return;
        setPlaying(false);
        const nextTime = patch.time === undefined
            ? selectedKeyframeTime
            : Math.min(project.animation.duration, Math.max(0, patch.time));
        setProject((current) => updateDirectorCameraKeyframe(current, selectedKeyframeTime, { ...patch, time: nextTime }));
        setSelectedKeyframeTime(nextTime);
        const sample = sampleDirectorCameraTrack(activeCameraTrack, nextTime);
        if (sample) runtimeRef.current?.previewCamera(sample);
    };

    const updateSelectedSceneTransform = (group: keyof DirectorSceneNode["transform"], axis: keyof DirectorVector3, value: number | null) => {
        if (!selectedSceneNode || value === null) return;
        updateSelectedSceneNode({
            transform: {
                ...selectedSceneNode.transform,
                [group]: { ...selectedSceneNode.transform[group], [axis]: value },
            },
        });
    };

    const removeSelectedObject = () => {
        if (!selectedObjectId) return;
        const targetId = selectedObjectId;
        setProject((current) => ({
            ...current,
            objects: current.objects.filter((item) => item.id !== targetId),
            camera: withoutCameraTargets(current.camera, new Set([targetId])),
        }));
        setSelectedObjectId(null);
    };

    const removeSelectedSceneNode = () => {
        if (!selectedSceneNode || selectedSceneNode.locked) return;
        const nodeId = selectedSceneNode.id;
        const parentId = selectedSceneNode.parentId;
        setProject((current) => ({
            ...current,
            sceneNodes: current.sceneNodes.filter((item) => item.id !== nodeId).map((item) => (item.parentId === nodeId ? { ...item, parentId } : item)),
            objects: current.objects.map((item) => (item.parentId === nodeId ? (parentId ? { ...item, parentId } : withoutParent(item)) : item)),
            camera: withoutCameraTargets(current.camera, new Set([nodeId])),
        }));
        setSelectedSceneNodeId(null);
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

    const importGlbFile = async (file: File | undefined) => {
        if (!file) return;
        if (!/\.glb$/i.test(file.name)) {
            message.error(t("canvas.director.glbUnsupported"));
            return;
        }
        if (file.size > DIRECTOR_MAX_GLB_BYTES) {
            message.error(t("canvas.director.glbTooLarge"));
            return;
        }
        if (project.sceneNodes.length >= DIRECTOR_MAX_SCENE_NODES) {
            message.warning(t("canvas.director.sceneNodeLimit", { count: DIRECTOR_MAX_SCENE_NODES }));
            return;
        }

        let buffer: ArrayBuffer;
        try {
            buffer = await file.arrayBuffer();
        } catch {
            message.error(t("canvas.director.glbReadFailed"));
            return;
        }
        if (!hasValidDirectorGlbHeader(buffer)) {
            message.error(t("canvas.director.glbUnsupported"));
            return;
        }

        setImportingGlb(true);
        try {
            const stored = await uploadMediaFile(file, "director-glb");
            const item = createDirectorSceneNode("asset", project.sceneNodes.length, selectedSceneNodeId);
            const title = file.name.replace(/\.glb$/i, "").trim();
            item.name = (title || item.name).slice(0, 60);
            item.asset = { fileName: file.name, byteSize: file.size, storageKey: stored.storageKey };
            setProject((current) => ({ ...current, sceneNodes: [...current.sceneNodes, item] }));
            setSelectedObjectId(null);
            setSelectedSceneNodeId(item.id);
            setSelectedMotionPathId(null);
            setSelectedPathNodeId(null);
        } catch {
            message.error(t("canvas.director.glbStoreFailed"));
        } finally {
            setImportingGlb(false);
        }
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
        setSelectedMotionPathId(null);
        setSelectedPathNodeId(null);
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
                            <div className="flex min-w-0 items-center gap-1">
                                <Button size="small" type="text" className="!h-7 !w-7 !p-0" title={t("canvas.director.addMotionPath")} aria-label={t("canvas.director.addMotionPath")} icon={<Route className="size-3.5" />} onClick={addMotionPath} />
                                <Button size="small" type="text" className="!h-7 !px-2" loading={importingGlb} icon={<Upload className="size-3.5" />} onClick={() => glbInputRef.current?.click()}>
                                    {t("canvas.director.importGlb")}
                                </Button>
                                <Button size="small" type="text" className="!h-7 !px-2" icon={<Plus className="size-3.5" />} onClick={addSceneGroup}>
                                    {t("canvas.director.addSceneGroup")}
                                </Button>
                            </div>
                        </div>
                        <p className="mb-2 text-[10px] leading-4 opacity-40">{t("canvas.director.glbHint")}</p>
                        <input
                            ref={glbInputRef}
                            type="file"
                            accept=".glb,model/gltf-binary"
                            className="hidden"
                            onChange={(event) => {
                                void importGlbFile(event.currentTarget.files?.[0]);
                                event.currentTarget.value = "";
                            }}
                        />
                        <div className="max-h-52 overflow-y-auto rounded-xl border p-1.5" style={{ borderColor: canvasTheme.node.stroke }}>
                            {sceneTree.map((entry) => {
                                const Icon = sceneTreeIcon(entry);
                                const label = sceneTreeLabel(entry, t);
                                const selectable = Boolean(entry.objectId || entry.sceneNodeId || entry.pathId);
                                const selected = entry.objectId
                                    ? entry.objectId === selectedObjectId
                                    : entry.sceneNodeId
                                      ? entry.sceneNodeId === selectedSceneNodeId
                                      : entry.pathId
                                        ? entry.pathNodeId
                                            ? entry.pathId === selectedMotionPathId && entry.pathNodeId === selectedPathNodeId
                                            : entry.pathId === selectedMotionPathId && selectedPathNodeId === null
                                        : false;
                                const selectEntry = () => {
                                    if (entry.objectId) {
                                        setSelectedObjectId(entry.objectId);
                                        setSelectedSceneNodeId(null);
                                        setSelectedMotionPathId(null);
                                        setSelectedPathNodeId(null);
                                    } else if (entry.sceneNodeId) {
                                        setSelectedSceneNodeId(entry.sceneNodeId);
                                        setSelectedObjectId(null);
                                        setSelectedMotionPathId(null);
                                        setSelectedPathNodeId(null);
                                    } else if (entry.pathId) {
                                        setSelectedObjectId(null);
                                        setSelectedSceneNodeId(null);
                                        setSelectedMotionPathId(entry.pathId);
                                        setSelectedPathNodeId(entry.pathNodeId || null);
                                    }
                                };
                                const sceneNode = entry.sceneNodeId ? project.sceneNodes.find((item) => item.id === entry.sceneNodeId) : null;
                                const motionPath = entry.pathId ? project.animation.motionPaths.find((item) => item.id === entry.pathId) : null;
                                const pathNode = motionPath && entry.pathNodeId ? motionPath.nodes.find((item) => item.id === entry.pathNodeId) : null;
                                const content = (
                                    <>
                                        <Icon className="size-3.5 shrink-0 opacity-55" />
                                        <span className={`min-w-0 flex-1 truncate ${(sceneNode && !isDirectorSceneNodeVisible(sceneNode, project.sceneNodes)) || (pathNode && motionPath && !isDirectorPathNodeVisible(pathNode, motionPath)) ? "opacity-40" : ""}`}>{label}</span>
                                        {sceneNode && !sceneNode.visible ? <EyeOff className="size-3 shrink-0 opacity-35" /> : null}
                                        {sceneNode?.locked ? <Lock className="size-3 shrink-0 opacity-35" /> : null}
                                        {pathNode && !pathNode.visible ? <EyeOff className="size-3 shrink-0 opacity-35" /> : null}
                                        {pathNode?.locked ? <Lock className="size-3 shrink-0 opacity-35" /> : null}
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
                        <div>
                            <div className="mb-1 text-[11px] opacity-45">{t("canvas.director.lookAt")}</div>
                            <Select
                                className="w-full"
                                allowClear
                                placeholder={t("canvas.director.cameraTargetNone")}
                                value={project.camera.lookAtTarget}
                                options={cameraTargets}
                                onChange={(value: string | undefined) => setCameraTarget("lookAtTarget", value)}
                            />
                        </div>
                        <div>
                            <div className="mb-1 text-[11px] opacity-45">{t("canvas.director.follow")}</div>
                            <Select
                                className="w-full"
                                allowClear
                                placeholder={t("canvas.director.cameraTargetNone")}
                                value={project.camera.followTargetId}
                                options={cameraTargets}
                                onChange={(value: string | undefined) => setCameraTarget("followTargetId", value)}
                            />
                        </div>
                        <div className="rounded-xl border p-3" style={{ borderColor: canvasTheme.node.stroke }}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-medium opacity-60">{t("canvas.director.animation")}</div>
                                <span className="text-[10px] tabular-nums opacity-40">
                                    {activeCameraTrack?.keyframes.length || 0} / {DIRECTOR_MAX_KEYFRAMES}
                                </span>
                            </div>
                            <div className="mt-3">
                                <RangeField
                                    label={t("canvas.director.animationDuration")}
                                    value={project.animation.duration}
                                    min={DIRECTOR_MIN_ANIMATION_DURATION}
                                    max={DIRECTOR_MAX_ANIMATION_DURATION}
                                    step={1}
                                    suffix="s"
                                    onChange={updateAnimationDuration}
                                />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="small"
                                        type="text"
                                        className="!h-7 !px-2"
                                        icon={playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                                        disabled={!activeCameraTrack?.keyframes.length}
                                        onClick={() => {
                                            if (playing) {
                                                setPlaying(false);
                                                return;
                                            }
                                            setPlayhead(0);
                                            setPlaying(true);
                                        }}
                                    >
                                        {playing ? t("canvas.director.pausePreview") : t("canvas.director.playPreview")}
                                    </Button>
                                    <Button size="small" type="text" className="!h-7 !px-2" icon={<Plus className="size-3.5" />} onClick={addCameraKeyframe}>
                                        {t("canvas.director.addKeyframe")}
                                    </Button>
                                </div>
                                <span className="shrink-0 text-[10px] tabular-nums opacity-45">
                                    {formatDirectorTime(playhead)} / {formatDirectorTime(project.animation.duration)}
                                </span>
                            </div>
                            <input
                                type="range"
                                className="mt-3 h-3 w-full cursor-pointer"
                                style={{ accentColor: token.colorPrimary }}
                                aria-label={t("canvas.director.playhead")}
                                min={0}
                                max={project.animation.duration}
                                step={0.01}
                                value={Math.min(playhead, project.animation.duration)}
                                onChange={(event) => previewCameraTime(Number(event.currentTarget.value))}
                            />
                            <div className="max-h-32 space-y-1 overflow-y-auto">
                                {activeCameraTrack?.keyframes.length ? activeCameraTrack.keyframes.map((keyframe) => (
                                    <div key={keyframe.time} className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            className={`flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[10px] transition ${selectedKeyframeTime !== null && Math.abs(selectedKeyframeTime - keyframe.time) < 0.0001 ? "bg-black/[0.06] font-medium dark:bg-white/[0.09]" : "hover:bg-black/[0.035] dark:hover:bg-white/[0.05]"}`}
                                            onClick={() => {
                                                setSelectedKeyframeTime(keyframe.time);
                                                previewCameraTime(keyframe.time);
                                            }}
                                        >
                                            <Diamond className="size-3 shrink-0 opacity-45" />
                                            <span className="tabular-nums">{formatDirectorTime(keyframe.time)}</span>
                                            {keyframe.fov !== undefined ? <span className="opacity-40">FOV {Math.round(keyframe.fov)}°</span> : null}
                                        </button>
                                        <Button
                                            size="small"
                                            type="text"
                                            danger
                                            className="!h-7 !w-7 !p-0"
                                            icon={<Trash2 className="size-3" />}
                                            aria-label={t("canvas.director.removeKeyframe")}
                                            onClick={() => removeCameraKeyframe(keyframe.time)}
                                        />
                                    </div>
                                )) : (
                                    <div className="rounded-lg border border-dashed px-2 py-3 text-center text-[10px] leading-4 opacity-40" style={{ borderColor: canvasTheme.node.stroke }}>
                                        {t("canvas.director.keyframeEmpty")}
                                    </div>
                                )}
                            </div>
                            {selectedKeyframe ? (
                                <div className="mt-2 border-t pt-2" style={{ borderColor: canvasTheme.node.stroke }}>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="mb-1 text-[10px] opacity-45">{t("canvas.director.keyframeTime")}</div>
                                            <InputNumber
                                                size="small"
                                                className="w-full"
                                                min={0}
                                                max={project.animation.duration}
                                                step={0.1}
                                                value={selectedKeyframe.time}
                                                onChange={(time) => time !== null && updateSelectedKeyframe({ time })}
                                            />
                                        </div>
                                        <div>
                                            <div className="mb-1 text-[10px] opacity-45">{t("canvas.director.keyframeEasing")}</div>
                                            <Select
                                                size="small"
                                                className="w-full"
                                                value={selectedKeyframe.easing}
                                                options={[
                                                    { value: "linear", label: t("canvas.director.easings.linear") },
                                                    { value: "easeIn", label: t("canvas.director.easings.easeIn") },
                                                    { value: "easeOut", label: t("canvas.director.easings.easeOut") },
                                                    { value: "easeInOut", label: t("canvas.director.easings.easeInOut") },
                                                    { value: "smooth", label: t("canvas.director.easings.smooth") },
                                                    { value: "custom", label: t("canvas.director.easings.custom") },
                                                ]}
                                                onChange={(easing: DirectorCameraKeyframe["easing"]) => updateSelectedKeyframe({ easing })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
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

                    {selectedMotionPath ? (
                        selectedPathNode ? (
                            <div className="space-y-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold">{pathNodeKindLabel(selectedPathNode.kind, t)}</div>
                                        <div className="mt-1 truncate text-xs opacity-45">{selectedPathNode.id}</div>
                                    </div>
                                    <Button danger type="text" disabled={selectedPathNode.locked} icon={<Trash2 className="size-4" />} onClick={removeSelectedPathNode}>
                                        {t("common.delete")}
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: canvasTheme.node.stroke }}>
                                        <span className="text-[11px] opacity-55">{t("canvas.director.sceneNodeVisible")}</span>
                                        <Switch size="small" disabled={selectedPathNode.locked} checked={selectedPathNode.visible} onChange={(visible) => updateSelectedPathNode({ visible })} />
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: canvasTheme.node.stroke }}>
                                        <span className="text-[11px] opacity-55">{t("canvas.director.sceneNodeLocked")}</span>
                                        <Switch size="small" checked={selectedPathNode.locked} onChange={(locked) => updateSelectedPathNode({ locked })} />
                                    </div>
                                </div>
                                {selectedPathNode.locked ? <div className="text-[11px] leading-5 opacity-45">{t("canvas.director.motionPathNodeLockedHint")}</div> : null}
                                <div>
                                    <div className="mb-2 text-xs font-medium opacity-60">{t("canvas.director.sceneNodeName")}</div>
                                    <Input
                                        value={selectedPathNode.name}
                                        maxLength={60}
                                        disabled={selectedPathNode.locked}
                                        onChange={(event) => updateSelectedPathNode({ name: event.target.value })}
                                        onBlur={() => {
                                            if (selectedPathNode.name.trim()) {
                                                updateSelectedPathNode({ name: selectedPathNode.name.trim() });
                                                return;
                                            }
                                            const index = selectedMotionPath.nodes.findIndex((item) => item.id === selectedPathNode.id) + 1;
                                            updateSelectedPathNode({ name: defaultPathNodeName(selectedPathNode, index) });
                                        }}
                                    />
                                </div>
                                <div>
                                    <div className="mb-2 text-xs font-medium opacity-60">{t("canvas.director.sceneNodeParent")}</div>
                                    <Select
                                        className="w-full"
                                        value={selectedPathNode.parentId}
                                        disabled={selectedPathNode.locked}
                                        options={[
                                            { value: selectedMotionPath.id, label: t("canvas.director.motionPathRoot") },
                                            ...availablePathNodeParents.map((node) => ({ value: node.id, label: node.name })),
                                        ]}
                                        onChange={(parentId: string) => updateSelectedPathNode({ parentId })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <div className="text-xs font-medium opacity-60">{t("canvas.director.sceneNodeTransform")}</div>
                                    {([
                                        ["position", "sceneNodePosition"],
                                        ["rotation", "sceneNodeRotation"],
                                        ["scale", "sceneNodeScale"],
                                    ] as const).map(([group, label]) => (
                                        <div key={group}>
                                            <div className="mb-1 text-[11px] opacity-45">{t(`canvas.director.${label}`)}</div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(["x", "y", "z"] as const).map((axis) => (
                                                    <div key={axis}>
                                                        <div className="mb-1 text-center text-[10px] uppercase opacity-35">{axis}</div>
                                                        <InputNumber
                                                            className="w-full"
                                                            min={group === "scale" ? 0.01 : group === "rotation" ? -360 : -24}
                                                            max={group === "scale" ? 100 : group === "rotation" ? 360 : 24}
                                                            step={group === "rotation" ? 1 : 0.1}
                                                            value={selectedPathNode.transform[group][axis]}
                                                            disabled={selectedPathNode.locked}
                                                            onChange={(value) => updateSelectedPathTransform(group, axis, value)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold">{t("canvas.director.motionPath")}</div>
                                        <div className="mt-1 truncate text-xs opacity-45">{selectedMotionPath.id}</div>
                                    </div>
                                    <Button danger type="text" icon={<Trash2 className="size-4" />} onClick={removeSelectedMotionPath}>
                                        {t("common.delete")}
                                    </Button>
                                </div>
                                <div>
                                    <div className="mb-2 text-xs font-medium opacity-60">{t("canvas.director.sceneNodeName")}</div>
                                    <Input
                                        value={selectedMotionPath.name}
                                        maxLength={60}
                                        onChange={(event) => updateSelectedMotionPath({ name: event.target.value })}
                                        onBlur={() => {
                                            if (selectedMotionPath.name.trim()) {
                                                updateSelectedMotionPath({ name: selectedMotionPath.name.trim() });
                                                return;
                                            }
                                            const index = project.animation.motionPaths.findIndex((item) => item.id === selectedMotionPath.id) + 1;
                                            updateSelectedMotionPath({ name: `Path ${index}` });
                                        }}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: canvasTheme.node.stroke }}>
                                    <span className="text-[11px] opacity-55">{t("canvas.director.motionPathClosed")}</span>
                                    <Switch size="small" checked={selectedMotionPath.closed} onChange={(closed) => updateSelectedMotionPath({ closed })} />
                                </div>
                                <div className="rounded-xl border p-3" style={{ borderColor: canvasTheme.node.stroke }}>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs font-medium opacity-60">{t("canvas.director.motionPathNodes")}</span>
                                        <span className="text-[10px] tabular-nums opacity-40">
                                            {selectedMotionPath.nodes.length} / {DIRECTOR_MAX_PATH_POINTS}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-1">
                                        <Button size="small" type="text" className="!h-8 !px-1" icon={<MapPin className="size-3.5" />} onClick={() => addSelectedPathNode("waypoint")}>
                                            {t("canvas.director.pathNodeKinds.waypoint")}
                                        </Button>
                                        <Button size="small" type="text" className="!h-8 !px-1" icon={<Crosshair className="size-3.5" />} onClick={() => addSelectedPathNode("aim")}>
                                            {t("canvas.director.pathNodeKinds.aim")}
                                        </Button>
                                        <Button size="small" type="text" className="!h-8 !px-1" icon={<Focus className="size-3.5" />} onClick={() => addSelectedPathNode("focus")}>
                                            {t("canvas.director.pathNodeKinds.focus")}
                                        </Button>
                                    </div>
                                </div>
                                {!selectedMotionPath.nodes.length ? (
                                    <div className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] leading-5 opacity-45" style={{ borderColor: canvasTheme.node.stroke }}>
                                        {t("canvas.director.motionPathEmpty")}
                                    </div>
                                ) : null}
                            </div>
                        )
                    ) : selectedObject ? (
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
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold">
                                        {selectedSceneNode.kind === "group"
                                            ? t("canvas.director.sceneGroup")
                                            : selectedSceneNode.kind === "asset"
                                              ? t("canvas.director.sceneAsset")
                                              : t("canvas.director.sceneNode")}
                                    </div>
                                    <div className="mt-1 truncate text-xs opacity-45">{selectedSceneNode.asset?.fileName || selectedSceneNode.id}</div>
                                </div>
                                <Button danger type="text" disabled={selectedSceneNode.locked} icon={<Trash2 className="size-4" />} onClick={removeSelectedSceneNode}>
                                    {t("common.delete")}
                                </Button>
                            </div>
                            {selectedSceneNode.asset ? (
                                <div className="rounded-lg border px-3 py-2 text-[11px] leading-5 opacity-60" style={{ borderColor: canvasTheme.node.stroke }}>
                                    <div className="truncate">{selectedSceneNode.asset.fileName}</div>
                                    <div>{formatAssetBytes(selectedSceneNode.asset.byteSize)}</div>
                                    {assetErrors[selectedSceneNode.id] ? <div className="mt-1 text-red-500 opacity-100">{t("canvas.director.glbLoadFailed")}</div> : null}
                                </div>
                            ) : null}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: canvasTheme.node.stroke }}>
                                    <span className="text-[11px] opacity-55">{t("canvas.director.sceneNodeVisible")}</span>
                                    <Switch size="small" disabled={selectedSceneNode.locked} checked={selectedSceneNode.visible} onChange={(visible) => updateSelectedSceneNode({ visible })} />
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: canvasTheme.node.stroke }}>
                                    <span className="text-[11px] opacity-55">{t("canvas.director.sceneNodeLocked")}</span>
                                    <Switch size="small" checked={selectedSceneNode.locked} onChange={(locked) => updateSelectedSceneNode({ locked })} />
                                </div>
                            </div>
                            {selectedSceneNode.locked ? <div className="text-[11px] leading-5 opacity-45">{t("canvas.director.sceneNodeLockedHint")}</div> : null}
                            <div>
                                <div className="mb-2 text-xs font-medium opacity-60">{t("canvas.director.sceneNodeName")}</div>
                                <Input
                                    value={selectedSceneNode.name}
                                    maxLength={60}
                                    disabled={selectedSceneNode.locked}
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
                                    disabled={selectedSceneNode.locked}
                                    options={[
                                        { value: "", label: t("canvas.director.sceneNodeRoot") },
                                        ...availableSceneParents.map((node) => ({ value: node.id, label: node.name })),
                                    ]}
                                    onChange={(parentId: string) => updateSelectedSceneNode({ parentId: parentId || null })}
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="text-xs font-medium opacity-60">{t("canvas.director.sceneNodeTransform")}</div>
                                {([
                                    ["position", "sceneNodePosition"],
                                    ["rotation", "sceneNodeRotation"],
                                    ["scale", "sceneNodeScale"],
                                ] as const).map(([group, label]) => (
                                    <div key={group}>
                                        <div className="mb-1 text-[11px] opacity-45">{t(`canvas.director.${label}`)}</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(["x", "y", "z"] as const).map((axis) => (
                                                <div key={axis}>
                                                    <div className="mb-1 text-center text-[10px] uppercase opacity-35">{axis}</div>
                                                    <InputNumber
                                                        className="w-full"
                                                        min={group === "scale" ? 0.01 : group === "rotation" ? -360 : axis === "y" ? -8 : -24}
                                                        max={group === "scale" ? 100 : group === "rotation" ? 360 : axis === "y" ? 16 : 24}
                                                        step={group === "rotation" ? 1 : 0.1}
                                                        value={selectedSceneNode.transform[group][axis]}
                                                        disabled={selectedSceneNode.locked}
                                                        onChange={(value) => updateSelectedSceneTransform(group, axis, value)}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
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
    if (entry.kind === "waypoint") return MapPin;
    if (entry.kind === "aim") return Crosshair;
    if (entry.kind === "focus") return Focus;
    return Box;
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

function pathNodeKindLabel(kind: DirectorPathNodeKind, t: (key: string) => string) {
    return t(`canvas.director.pathNodeKinds.${kind}`);
}

function defaultPathNodeName(node: DirectorPathNode, index: number) {
    return node.kind === "waypoint" ? `WP ${index}` : `${node.kind === "aim" ? "Aim" : "Focus"} ${index}`;
}

function findDirectorSelection(object: Object3D) {
    let current: Object3D | null = object;
    while (current) {
        const objectId = typeof current.userData.directorObjectId === "string" ? current.userData.directorObjectId : null;
        const sceneNodeId = typeof current.userData.directorSceneNodeId === "string" ? current.userData.directorSceneNodeId : null;
        if (objectId || sceneNodeId) return { objectId, sceneNodeId };
        current = current.parent;
    }
    return null;
}

function withoutParent(object: DirectorObject): DirectorObject {
    const { parentId: _parentId, ...rest } = object;
    return rest;
}

function withoutCameraTargets(camera: DirectorProjectState["camera"], ids: Set<string>): DirectorProjectState["camera"] {
    const next = { ...camera };
    if (next.lookAtTarget && ids.has(next.lookAtTarget)) delete next.lookAtTarget;
    if (next.followTargetId && ids.has(next.followTargetId)) delete next.followTargetId;
    return next;
}

function resolveDirectorCameraTarget(project: DirectorProjectState, targetId: string | undefined): DirectorVector3 | null {
    if (!targetId) return null;
    const object = project.objects.find((item) => item.id === targetId);
    if (object) return object.position;
    return project.sceneNodes.find((item) => item.id === targetId)?.transform.position ?? null;
}

function formatAssetBytes(bytes: number) {
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDirectorTime(seconds: number) {
    const value = Math.max(0, seconds);
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${(value % 60).toFixed(1).padStart(4, "0")}`;
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
        materials.forEach(disposeMaterial);
    });
}

function disposeScene(THREE: typeof import("three"), scene: Scene) {
    scene.traverse((child) => {
        const mesh = child as Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach(disposeMaterial);
    });
    scene.clear();
}

function disposeMaterial(material: import("three").Material) {
    Object.values(material as unknown as Record<string, unknown>).forEach((value) => {
        if (value && typeof value === "object" && "isTexture" in value) (value as import("three").Texture).dispose();
    });
    material.dispose();
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
