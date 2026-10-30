"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULTS, createFigure, loadFigureData, studio, type BodyInput, type FigureData, type FigureModel } from "@/lib/figure/engine";
import type { MacroKey, Skin } from "@/lib/types";

export interface FigureProps {
  body: BodyInput;
  skin: Skin;
  fill: Record<MacroKey, number>;
  dark?: boolean;
  highlight?: MacroKey | null;
  /** 1.2 shows the whole body with some air; smaller crops in. */
  frame?: number;
  lookY?: number;
  angle?: number;
  follow?: boolean;
  sway?: boolean;
  disc?: boolean;
  className?: string;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Scene({ body, skin, fill, dark = false, highlight = null, frame = 1.2, lookY = 0.86, angle = -0.35, follow, sway = true, disc = true }: FigureProps) {
  const { gl, camera, size, invalidate } = useThree();
  const env = useMemo(() => studio(gl, dark), [gl, dark]);
  const [data, setData] = useState<FigureData | null>(null);
  const rootRef = useRef<THREE.Group>(null);
  const model = useRef<FigureModel | null>(null);
  const cur = useRef<Record<MacroKey, number>>({ carbs: 0, protein: 0, fat: 0 });
  const anim = useRef({ from: { carbs: 0, protein: 0, fat: 0 } as Record<MacroKey, number>, to: fill, start: 0, dur: 0 });
  const rot = useRef({ y: angle, pointer: 0 });
  const hi = useRef<MacroKey | null>(highlight);
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    loadFigureData().then((d) => alive && setData(d)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const bodyKey = JSON.stringify([body.sex, body.heightCm, body.weightKg, body.age, body.bodyFat ?? null, body.shape ?? null, skin]);
  const stableBody = useMemo(() => JSON.parse(bodyKey) as [BodyInput["sex"], number, number, number, number | null, BodyInput["shape"] | null, Skin], [bodyKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!data || !root) return;
    const [sex, heightCm, weightKg, age, bodyFat, shape, sk] = stableBody;
    const m = createFigure(data, { ...DEFAULTS[sex], sex, heightCm, weightKg, age, bodyFat, shape: shape ?? undefined }, sk);
    model.current = m;
    root.add(m.group);
    m.applyFill(cur.current, hi.current);
    invalidate();
    return () => {
      root.remove(m.group);
      m.dispose();
      model.current = null;
    };
  }, [data, stableBody, invalidate]);

  useEffect(() => {
    const a = anim.current;
    a.from = { ...cur.current };
    a.to = fill;
    a.start = performance.now();
    a.dur = first.current || reduced() ? 0 : 700;
    first.current = false;
    if (!a.dur) cur.current = { ...fill };
  }, [fill]);

  useEffect(() => { hi.current = highlight; }, [highlight]);

  useEffect(() => {
    if (!follow) return;
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      rot.current.pointer = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [follow, gl]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const H = 1.76 * frame;
    let d = H / (2 * Math.tan((cam.fov * Math.PI) / 360));
    if (aspect < 0.55) d *= 0.55 / aspect;
    cam.position.set(0, 1.0, d);
    cam.lookAt(0, lookY, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, frame, lookY]);

  useFrame(({ clock }) => {
    const a = anim.current;
    const t = a.dur ? Math.min(1, (performance.now() - a.start) / a.dur) : 1;
    const k = 1 - Math.pow(1 - t, 3);
    for (const m of ["carbs", "protein", "fat"] as MacroKey[]) cur.current[m] = a.from[m] + (a.to[m] - a.from[m]) * k;
    model.current?.applyFill(cur.current, hi.current);
    const root = rootRef.current;
    if (root) {
      const target = reduced() ? angle : angle + (sway ? Math.sin(clock.elapsedTime * 1000 / 2600) * 0.22 : 0) + rot.current.pointer * 0.55;
      rot.current.y += (target - rot.current.y) * 0.06;
      root.rotation.y = rot.current.y;
    }
  });

  return (
    <>
      <primitive object={env} attach="environment" />
      <directionalLight color={0xfff4ea} intensity={dark ? 1.4 : 1.2} position={[2.2, 4.2, 3.2]} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-1} shadow-camera-right={1} shadow-camera-top={2.2} shadow-camera-bottom={-0.3} shadow-radius={6} shadow-bias={-0.0006} shadow-normalBias={0.01} />
      <directionalLight color={dark ? 0xffb39b : 0xffe6da} intensity={dark ? 1.6 : 0.7} position={[-3, 2.6, -3.2]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[0.8, 64]} />
        <shadowMaterial opacity={dark ? 0.55 : 0.22} />
      </mesh>
      {disc && (
        <mesh position-y={-0.0125} receiveShadow>
          <cylinderGeometry args={[0.6, 0.62, 0.025, 72]} />
          <meshStandardMaterial color={dark ? 0x18221c : 0xe6eae0} roughness={0.85} />
        </mesh>
      )}
      <group ref={rootRef} />
    </>
  );
}

export default function Figure(props: FigureProps) {
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = host.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((e) => setVisible(e[0].isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={host} className={props.className} role="img" aria-label="3D figure that fills with the day's food">
      {failed ? (
        <div className="grid h-full w-full place-items-center text-sm opacity-70">3D view needs WebGL</div>
      ) : (
        <Canvas
          frameloop={visible ? "always" : "never"}
          dpr={[1, 2]}
          shadows
          camera={{ fov: 26, near: 0.1, far: 50, position: [0, 1, 5] }}
          gl={{ antialias: true, alpha: true, toneMappingExposure: props.dark ? 1.05 : 0.95 }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.domElement.addEventListener("webglcontextcreationerror", () => setFailed(true));
          }}
          onError={() => setFailed(true)}
          style={{ touchAction: "pan-y" }}
        >
          <Scene {...props} />
        </Canvas>
      )}
    </div>
  );
}
