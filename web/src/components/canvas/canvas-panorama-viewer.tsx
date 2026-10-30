import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { normalizePanoramaSource } from "@/lib/canvas/panorama-source";

export function CanvasPanoramaViewer({ open, source, title, onClose }: { open: boolean; source?: string; title?: string; onClose: () => void }) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [sceneRevision, setSceneRevision] = useState(0);
    const safeSource = useMemo(() => normalizePanoramaSource(source), [source]);

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (!safeSource) {
            setError(t("canvas.panorama.unsupported"));
            return;
        }
        if (!containerRef.current) return;

        let cancelled = false;
        let frame = 0;
        let renderer: import("three").WebGLRenderer | null = null;
        let texture: import("three").Texture | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let removePointerListeners: () => void = () => undefined;
        let removeContextLostListener: () => void = () => undefined;
        let releaseScene = () => undefined;
        let disposed = false;

        const stop = (forceContextLoss: boolean) => {
            if (disposed) return;
            disposed = true;
            window.cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            removePointerListeners();
            removeContextLostListener();
            releaseScene();
            if (renderer) {
                const canvas = renderer.domElement;
                renderer.dispose();
                if (forceContextLoss) renderer.forceContextLoss();
                canvas.remove();
                renderer = null;
            }
        };
        const fail = (key: string, forceContextLoss = true) => {
            if (cancelled || disposed) return;
            stop(forceContextLoss);
            setError(t(key));
        };

        const setup = async () => {
            try {
                const THREE = await import("three");
                if (cancelled || disposed || !containerRef.current) return;
                renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                renderer.outputColorSpace = THREE.SRGBColorSpace;
                renderer.domElement.className = "block size-full cursor-grab touch-none active:cursor-grabbing";
                renderer.domElement.tabIndex = 0;
                renderer.domElement.setAttribute("role", "img");
                renderer.domElement.setAttribute("aria-label", `${title || t("canvas.panorama.title")}. ${t("canvas.panorama.hint")}`);
                containerRef.current.appendChild(renderer.domElement);

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
                const geometry = new THREE.SphereGeometry(500, 64, 40);
                geometry.scale(-1, 1, 1);
                const material = new THREE.MeshBasicMaterial();
                const sphere = new THREE.Mesh(geometry, material);
                scene.add(sphere);
                releaseScene = () => {
                    texture?.dispose();
                    texture = null;
                    material.dispose();
                    geometry.dispose();
                };

                const contextLost = (event: Event) => {
                    event.preventDefault();
                    fail("canvas.panorama.webglLost", false);
                };
                renderer.domElement.addEventListener("webglcontextlost", contextLost);
                removeContextLostListener = () => {
                    renderer?.domElement.removeEventListener("webglcontextlost", contextLost);
                };

                texture = await new THREE.TextureLoader().loadAsync(safeSource);
                if (cancelled || disposed) return;
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.minFilter = THREE.LinearFilter;
                material.map = texture;
                material.needsUpdate = true;

                let longitude = 0;
                let latitude = 0;
                let activePointerId: number | null = null;
                let pointerX = 0;
                let pointerY = 0;
                const updateCamera = () => {
                    const phi = THREE.MathUtils.degToRad(90 - latitude);
                    const theta = THREE.MathUtils.degToRad(longitude);
                    camera.lookAt(500 * Math.sin(phi) * Math.cos(theta), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(theta));
                };
                updateCamera();

                const pointerDown = (event: PointerEvent) => {
                    if (activePointerId !== null) return;
                    activePointerId = event.pointerId;
                    pointerX = event.clientX;
                    pointerY = event.clientY;
                    renderer?.domElement.setPointerCapture(event.pointerId);
                };
                const pointerMove = (event: PointerEvent) => {
                    if (event.pointerId !== activePointerId) return;
                    longitude -= (event.clientX - pointerX) * 0.12;
                    latitude = Math.max(-85, Math.min(85, latitude + (event.clientY - pointerY) * 0.12));
                    pointerX = event.clientX;
                    pointerY = event.clientY;
                    updateCamera();
                };
                const pointerUp = (event: PointerEvent) => {
                    if (event.pointerId !== activePointerId) return;
                    activePointerId = null;
                    if (renderer?.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
                };
                const wheel = (event: WheelEvent) => {
                    event.preventDefault();
                    camera.fov = Math.max(42, Math.min(95, camera.fov + event.deltaY * 0.03));
                    camera.updateProjectionMatrix();
                };
                renderer.domElement.addEventListener("pointerdown", pointerDown);
                renderer.domElement.addEventListener("pointermove", pointerMove);
                renderer.domElement.addEventListener("pointerup", pointerUp);
                renderer.domElement.addEventListener("pointercancel", pointerUp);
                renderer.domElement.addEventListener("wheel", wheel, { passive: false });
                removePointerListeners = () => {
                    renderer?.domElement.removeEventListener("pointerdown", pointerDown);
                    renderer?.domElement.removeEventListener("pointermove", pointerMove);
                    renderer?.domElement.removeEventListener("pointerup", pointerUp);
                    renderer?.domElement.removeEventListener("pointercancel", pointerUp);
                    renderer?.domElement.removeEventListener("wheel", wheel);
                };

                const resize = () => {
                    if (!renderer || !containerRef.current) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    const width = Math.max(1, rect.width);
                    const height = Math.max(1, rect.height);
                    renderer.setSize(width, height, false);
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                };
                resizeObserver = new ResizeObserver(resize);
                resizeObserver.observe(containerRef.current);
                resize();

                const render = () => {
                    renderer?.render(scene, camera);
                    frame = window.requestAnimationFrame(render);
                };
                render();
            } catch {
                fail("canvas.panorama.loadFailed");
            }
        };

        void setup();
        return () => {
            cancelled = true;
            stop(true);
        };
    }, [open, safeSource, sceneRevision, t, title]);

    return (
        <Modal
            open={open}
            centered
            width="min(1180px, 96vw)"
            footer={null}
            destroyOnHidden
            afterOpenChange={(visible) => {
                if (visible) setSceneRevision((current) => current + 1);
            }}
            title={title || t("canvas.panorama.title")}
            onCancel={onClose}
            styles={{ body: { padding: 0, overflow: "hidden", background: "#09090b" } }}
        >
            <div className="relative aspect-video max-h-[78vh] w-full overflow-hidden bg-black">
                <div ref={containerRef} className="absolute inset-0" />
                {error ? (
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black p-2 text-center text-sm text-white/70">
                        {safeSource ? <img src={safeSource} alt={title || t("canvas.panorama.title")} className="max-h-full max-w-full object-contain opacity-70" /> : null}
                        <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/80 px-3 py-2 text-xs text-white" role="status" aria-live="polite">
                            {error}
                        </div>
                    </div>
                ) : null}
                {!error ? <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-center text-xs text-white/70">{t("canvas.panorama.hint")}</div> : null}
            </div>
        </Modal>
    );
}
