"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Cinematic hero background: a small "neural network" of nodes drifts through
 * three formations as the visitor scrolls — scattered (unmapped) → a tight
 * cluster (the learning profile) → branching paths (the personalized
 * curriculum). A much larger, cheap dust layer fills out the depth around it.
 *
 * Kept deliberately light: capped particle counts, Points/InstancedMesh only
 * (no per-particle meshes), paused whenever the hero scrolls off-screen or the
 * tab is hidden, and never mounted at all under prefers-reduced-motion (see
 * the CSS fallback in the default export below).
 */

const INDIGO = new THREE.Color("#818CF8");
const VIOLET = new THREE.Color("#A78BFA");
const AMBER = new THREE.Color("#FBBF24");

const DUST_COUNT = 900;
const NODE_COUNT = 42;

/**
 * A soft radial-gradient sprite, generated on a <canvas> at runtime (no image
 * asset to ship or fetch). Points rendered with the default Three.js material
 * are hard-edged squares — fine for debug, not for "premium and glowing".
 * This is what turns each point into a soft glowing orb that bloom can
 * actually bloom.
 */
function makeGlowSprite(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.7)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Formless scatter — a wide, loose sphere shell. Reads as "not yet mapped". */
function scatteredPositions(count: number, rand: () => number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 4.2 + rand() * 4.2;
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i * 3 + 2] = radius * Math.cos(phi) * 0.7;
  }
  return positions;
}

/** Tight sphere — the "learning profile" the assessment produces. */
function clusterPositions(count: number, rand: () => number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 1.1 * Math.cbrt(rand());
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  return positions;
}

/**
 * Branches radiating from the centre — the personalized paths the profile
 * unlocks. Returns positions plus a parent index per node so the edge layer
 * can draw each branch as a connected line rather than a random mesh.
 */
function branchPositions(
  count: number,
  rand: () => number
): { positions: Float32Array; parents: Int32Array } {
  const positions = new Float32Array(count * 3);
  const parents = new Int32Array(count).fill(-1);
  const branchCount = 6;
  let i = 0;
  for (let b = 0; b < branchCount && i < count; b++) {
    const angle = (b / branchCount) * Math.PI * 2 + rand() * 0.3;
    const tilt = (rand() - 0.5) * 0.8;
    const nodesInBranch = Math.floor(count / branchCount);
    let prevIndex = -1;
    let radius = 0.3;
    for (let n = 0; n < nodesInBranch && i < count; n++, i++) {
      radius += 0.35 + rand() * 0.25;
      const wobble = (rand() - 0.5) * 0.4;
      positions[i * 3] = Math.cos(angle + wobble) * radius;
      positions[i * 3 + 1] = tilt * radius + (rand() - 0.5) * 0.3;
      positions[i * 3 + 2] = Math.sin(angle + wobble) * radius * 0.8;
      parents[i] = prevIndex;
      prevIndex = i;
    }
  }
  // Any remainder (count not divisible by branchCount) just sits near centre.
  for (; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * 0.4;
    positions[i * 3 + 1] = (rand() - 0.5) * 0.4;
    positions[i * 3 + 2] = (rand() - 0.5) * 0.4;
  }
  return { positions, parents };
}

function nearestNeighborEdges(positions: Float32Array, count: number, k: number): Int32Array[] {
  const edges: Int32Array[] = [];
  for (let i = 0; i < count; i++) {
    const dists: { j: number; d: number }[] = [];
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const dx = positions[i * 3] - positions[j * 3];
      const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
      dists.push({ j, d: dx * dx + dy * dy + dz * dz });
    }
    dists.sort((a, b) => a.d - b.d);
    edges.push(Int32Array.from(dists.slice(0, k).map((d) => d.j)));
  }
  return edges;
}

function lerpColor(count: number, rand: () => number): Float32Array {
  const colors = new Float32Array(count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const roll = rand();
    if (roll < 0.5) tmp.copy(INDIGO);
    else if (roll < 0.85) tmp.copy(VIOLET);
    else tmp.copy(AMBER);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  return colors;
}

interface FieldProps {
  progressRef: React.MutableRefObject<number>;
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}

function NeuralField({ progressRef, mouseRef }: FieldProps) {
  const rand = useMemo(() => seededRandom(7), []);
  const glowSprite = useMemo(() => makeGlowSprite(), []);

  const dustPositions = useMemo(() => scatteredPositions(DUST_COUNT, rand), [rand]);
  const dustColors = useMemo(() => lerpColor(DUST_COUNT, rand), [rand]);

  const nodeScattered = useMemo(() => scatteredPositions(NODE_COUNT, rand), [rand]);
  const nodeCluster = useMemo(() => clusterPositions(NODE_COUNT, rand), [rand]);
  const nodeBranch = useMemo(() => branchPositions(NODE_COUNT, rand), [rand]);
  const nodeColors = useMemo(() => lerpColor(NODE_COUNT, rand), [rand]);

  // Edges only make sense for the two "structured" formations.
  const clusterEdges = useMemo(() => nearestNeighborEdges(nodeCluster, NODE_COUNT, 2), [nodeCluster]);

  const nodeGeomRef = useRef<THREE.BufferGeometry>(null);
  const lineGeomRef = useRef<THREE.BufferGeometry>(null);
  // Two independent groups, not one shared rotation: the dust layer answers
  // mouse movement much more weakly than the node/branch layer, which is what
  // actually reads as depth (the "background moves slower than foreground"
  // parallax) rather than the whole field panning as one flat sheet.
  const dustGroupRef = useRef<THREE.Group>(null);
  const nodeGroupRef = useRef<THREE.Group>(null);

  // Working buffers reused every frame — no per-frame allocation.
  const currentNodePos = useRef(new Float32Array(nodeScattered));
  const targetNodePos = useRef(new Float32Array(NODE_COUNT * 3));
  const lineBuffer = useMemo(() => new Float32Array(NODE_COUNT * 2 * 2 * 3), []);

  useFrame((_, delta) => {
    const progress = progressRef.current;
    const cur = currentNodePos.current;
    const target = targetNodePos.current;

    // Two-stage lerp: 0→0.5 scattered→cluster, 0.5→1 cluster→branch.
    const inBranchPhase = progress > 0.5;
    const t = inBranchPhase ? (progress - 0.5) * 2 : progress * 2;
    const from = inBranchPhase ? nodeCluster : nodeScattered;
    const to = inBranchPhase ? nodeBranch.positions : nodeCluster;

    for (let i = 0; i < NODE_COUNT * 3; i++) {
      target[i] = from[i] + (to[i] - from[i]) * t;
    }

    // Smooth, damped chase toward the target rather than snapping to it.
    const damp = 1 - Math.exp(-delta * 3.2);
    for (let i = 0; i < NODE_COUNT * 3; i++) {
      cur[i] += (target[i] - cur[i]) * damp;
    }

    const nodeGeom = nodeGeomRef.current;
    if (nodeGeom) {
      (nodeGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Edge layer: cluster edges fade in around the midpoint, branch "parent"
    // edges fade in during the second half — drawn from the same damped
    // positions so lines never detach from the dots they connect.
    let edgeCount = 0;
    const clusterOpacity = Math.max(0, 1 - Math.abs(progress - 0.5) * 3.2);
    const branchOpacity = Math.max(0, (progress - 0.55) * 2.4);

    if (clusterOpacity > 0.02) {
      for (let i = 0; i < NODE_COUNT; i++) {
        for (const j of clusterEdges[i]) {
          if (j < i) continue; // each pair once
          lineBuffer[edgeCount * 6] = cur[i * 3];
          lineBuffer[edgeCount * 6 + 1] = cur[i * 3 + 1];
          lineBuffer[edgeCount * 6 + 2] = cur[i * 3 + 2];
          lineBuffer[edgeCount * 6 + 3] = cur[j * 3];
          lineBuffer[edgeCount * 6 + 4] = cur[j * 3 + 1];
          lineBuffer[edgeCount * 6 + 5] = cur[j * 3 + 2];
          edgeCount++;
        }
      }
    } else if (branchOpacity > 0.02) {
      for (let i = 0; i < NODE_COUNT; i++) {
        const parent = nodeBranch.parents[i];
        if (parent < 0) continue;
        lineBuffer[edgeCount * 6] = cur[i * 3];
        lineBuffer[edgeCount * 6 + 1] = cur[i * 3 + 1];
        lineBuffer[edgeCount * 6 + 2] = cur[i * 3 + 2];
        lineBuffer[edgeCount * 6 + 3] = cur[parent * 3];
        lineBuffer[edgeCount * 6 + 4] = cur[parent * 3 + 1];
        lineBuffer[edgeCount * 6 + 5] = cur[parent * 3 + 2];
        edgeCount++;
      }
    }

    const lineGeom = lineGeomRef.current;
    if (lineGeom) {
      lineGeom.setDrawRange(0, edgeCount * 2);
      (lineGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      const material = (lineGeom as unknown as { parent?: THREE.LineSegments }).parent
        ?.material as THREE.LineBasicMaterial | undefined;
      if (material) material.opacity = Math.max(clusterOpacity, branchOpacity) * 0.35;
    }

    // Gentle auto-rotation plus mouse parallax, split across two groups with
    // different response strengths — the dust (background) barely reacts,
    // the nodes/branches (foreground) react markedly more, which is what
    // actually reads as depth rather than the whole field panning as one flat
    // sheet. Both still share the same base spin so they never visibly drift
    // apart from each other, only in how far they lean toward the pointer.
    const AUTO_SPIN = delta * 0.035;
    const dustGroup = dustGroupRef.current;
    if (dustGroup) {
      dustGroup.rotation.y += AUTO_SPIN;
      const targetRotX = mouseRef.current.y * 0.05;
      dustGroup.rotation.x += (targetRotX - dustGroup.rotation.x) * 0.03;
      dustGroup.rotation.z += (mouseRef.current.x * -0.015 - dustGroup.rotation.z) * 0.03;
    }
    const nodeGroup = nodeGroupRef.current;
    if (nodeGroup) {
      nodeGroup.rotation.y += AUTO_SPIN;
      const targetRotX = mouseRef.current.y * 0.18;
      nodeGroup.rotation.x += (targetRotX - nodeGroup.rotation.x) * 0.04;
      nodeGroup.rotation.z += (mouseRef.current.x * -0.06 - nodeGroup.rotation.z) * 0.04;
    }
  });

  return (
    <>
      <group ref={dustGroupRef}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[dustColors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={glowSprite}
            size={0.065}
            vertexColors
            transparent
            opacity={0.65}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>

      <group ref={nodeGroupRef}>
        <points>
          <bufferGeometry ref={nodeGeomRef}>
            <bufferAttribute attach="attributes-position" args={[currentNodePos.current, 3]} />
            <bufferAttribute attach="attributes-color" args={[nodeColors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={glowSprite}
            size={0.16}
            vertexColors
            transparent
            opacity={1}
            sizeAttenuation
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

        <lineSegments>
          <bufferGeometry ref={lineGeomRef}>
            <bufferAttribute attach="attributes-position" args={[lineBuffer, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color="#C4B5FD"
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      </group>
    </>
  );
}

/** Feeds live scroll-progress and pointer position into refs — no React state,
 *  so the animation never triggers a re-render. Takes the ref object itself
 *  (not a snapshot of `.current`) and re-reads it inside each callback: R3F
 *  mounts this subtree through its own async reconciler pass, so a value
 *  captured at render time can lag behind — or briefly be null — relative to
 *  the DOM ref's actual state. */
function SceneDriver({
  progressRef,
  mouseRef,
  containerRef,
}: FieldProps & { containerRef: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    // The formation cycle (scattered → cluster → branch) should complete
    // comfortably BEFORE the box's own bottom-edge fade (~78% of its ~672px
    // height, see the mask below) kicks in — so the branch formation is seen
    // fully assembled for a beat before it fades away, rather than still
    // resolving as it disappears.
    const SCROLL_RANGE = 480;
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const traversed = Math.max(0, -rect.top);
      progressRef.current = Math.min(1, Math.max(0, traversed / SCROLL_RANGE));
    };
    const onPointerMove = (event: PointerEvent) => {
      mouseRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      };
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [containerRef, progressRef, mouseRef]);

  return null;
}

/** Pure-CSS stand-in for prefers-reduced-motion and any environment where
 *  mounting WebGL isn't worth it. Same palette, no motion. */
function StaticFallback() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/3 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[100px]" />
      <div className="absolute right-1/4 top-1/2 h-72 w-72 rounded-full bg-secondary/15 blur-[90px]" />
      <div className="absolute left-1/4 bottom-0 h-64 w-64 rounded-full bg-amber/15 blur-[90px]" />
    </div>
  );
}

export function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setReady(true);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(el);
    const onVisibility = () => {
      if (document.hidden) setInView(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      // Bounded to roughly the hero copy's own height, NOT `inset-0` of the
      // whole `<section>` — that section also holds the much taller
      // LessonVideo demo further down, and a full-height canvas there fights
      // scroll-progress math (is progress driven by "scrolled past the copy"
      // or "scrolled past the whole section, video card included?") and needs
      // a mask to hide the bleed. Bounding the box itself sidesteps both:
      // there's nothing below the copy for the scene to bleed into, and
      // `SceneDriver`'s progress calc can just use this element's own rect.
      className="absolute inset-x-0 top-0 h-[42rem] max-h-full overflow-hidden"
      style={{
        // A soft internal fade at the box's own bottom edge, so the cut into
        // the plain page below reads as a fade, not a hard rectangle.
        maskImage: "linear-gradient(to bottom, black 0%, black 78%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 78%, transparent 100%)",
      }}
    >
      {/* A cinematic 3D scene needs dark contrast to actually glow — on this
       *  app's light page, blended-transparent points read as pale smudges
       *  against white. This "night window" fades out at every edge so it
       *  reads as a spotlight, not a hard box — the same deliberate
       *  dark-on-light move this app already makes for the chalkboard. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          // Matches this app's own `.dark` --background (hsl(240 28% 7%)) so the
          // vignette reads as the same product at night, not an arbitrary color.
          background:
            "radial-gradient(ellipse 60% 62% at 50% 38%, rgba(13,13,23,0.94) 0%, rgba(13,13,23,0.72) 42%, rgba(13,13,23,0.28) 68%, rgba(13,13,23,0) 88%)",
        }}
      />
      {!ready || reducedMotion ? (
        <StaticFallback />
      ) : (
        <Canvas
          camera={{ position: [0, 0, 7.2], fov: 45 }}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          dpr={[1, 1.75]}
          frameloop={inView ? "always" : "never"}
        >
          <SceneInner containerRef={containerRef} />
        </Canvas>
      )}
    </div>
  );
}

function SceneInner({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const progressRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  return (
    <>
      <SceneDriver progressRef={progressRef} mouseRef={mouseRef} containerRef={containerRef} />
      <NeuralField progressRef={progressRef} mouseRef={mouseRef} />
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.9} intensity={0.55} mipmapBlur radius={0.5} />
      </EffectComposer>
    </>
  );
}
