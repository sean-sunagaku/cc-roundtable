import { useEffect, useRef } from "react";
import * as THREE from "three";

const COOL_COLOR = 0x3d9b92;
const WARM_COLOR = 0xc49a35;
const COOL_COUNT = 200;
const WARM_COUNT = 40;
const FIELD_RADIUS = 12;

export function ObservatoryBackground(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const probeCanvas = document.createElement("canvas");
    const canUseWebgl = Boolean(
      probeCanvas.getContext("webgl2") ||
      probeCanvas.getContext("webgl") ||
      probeCanvas.getContext("experimental-webgl")
    );
    if (!canUseWebgl) {
      return;
    }
    let renderer: THREE.WebGLRenderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.z = 8;

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    } catch {
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const createParticles = (count: number, color: number, opacity: number) => {
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = FIELD_RADIUS * Math.cbrt(Math.random());
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        sizes[i] = 1.5 + Math.random() * 2.5;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        color,
        size: 2,
        sizeAttenuation: true,
        transparent: true,
        opacity,
        blending: THREE.NormalBlending,
        depthWrite: false,
      });

      return new THREE.Points(geometry, material);
    };

    const coolParticles = createParticles(COOL_COUNT, COOL_COLOR, 0.15);
    const warmParticles = createParticles(WARM_COUNT, WARM_COLOR, 0.12);
    scene.add(coolParticles, warmParticles);

    let animationId: number;

    if (!prefersReducedMotion) {
      const animate = () => {
        animationId = requestAnimationFrame(animate);
        const t = Date.now() * 0.00003;
        coolParticles.rotation.y = t;
        coolParticles.rotation.x = t * 0.3;
        warmParticles.rotation.y = -t * 0.7;
        warmParticles.rotation.x = t * 0.2;
        renderer.render(scene, camera);
      };
      animate();
    } else {
      renderer.render(scene, camera);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (prefersReducedMotion) renderer.render(scene, camera);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationId) cancelAnimationFrame(animationId);
      renderer.dispose();
      coolParticles.geometry.dispose();
      warmParticles.geometry.dispose();
      (coolParticles.material as THREE.PointsMaterial).dispose();
      (warmParticles.material as THREE.PointsMaterial).dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="observatory-bg" ref={containerRef} />;
}
