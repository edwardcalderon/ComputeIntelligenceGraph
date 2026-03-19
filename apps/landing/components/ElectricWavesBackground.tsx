"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Full-viewport WebGL electric-waves shader rendered as a fixed background.
 * No control panel — tuned for the CIG authenticated hero.
 */
export function ElectricWavesBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const clock  = new THREE.Clock();

    const vertexShader = /* glsl */ `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = /* glsl */ `
      precision mediump float;

      uniform float u_time;
      uniform vec2  u_resolution;
      uniform float u_waveCount;
      uniform float u_amplitude;
      uniform float u_frequency;
      uniform float u_brightness;
      uniform float u_colorSeparation;

      float pattern(vec2 uv) {
        float intensity = 0.0;
        for (float i = 0.0; i < u_waveCount; i++) {
          uv.x += sin(u_time * (1.0 + i) + uv.y * u_frequency) * u_amplitude;
          intensity += u_brightness / abs(uv.x);
        }
        return intensity;
      }

      vec3 scene(vec2 uv) {
        vec3 color = vec3(0.0);
        vec2 ruv   = vec2(uv.y, uv.x);
        for (float i = 0.0; i < u_waveCount; i++) {
          int channel = int(mod(i, 3.0));
          vec2 cuv    = ruv + vec2(0.0, i * u_colorSeparation);
          color[channel] += pattern(cuv);
        }
        return color;
      }

      void main() {
        vec2 uv  = (gl_FragCoord.xy - 0.5 * u_resolution)
                   / min(u_resolution.x, u_resolution.y);
        vec3 col = scene(uv);
        // Blend to near-black so the hero text stays readable
        col = mix(vec3(0.02, 0.04, 0.08), col, 0.55);
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const uniforms = {
      u_time:            { value: 0 },
      u_resolution:      { value: new THREE.Vector2() },
      // Tuned values — subtle CIG palette
      u_waveCount:       { value: 6.0 },
      u_amplitude:       { value: 0.08 },
      u_frequency:       { value: 2.5 },
      u_brightness:      { value: 0.004 },
      u_colorSeparation: { value: 0.08 },
    };

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h);
    };
    window.addEventListener("resize", onResize);
    onResize();

    renderer.setAnimationLoop(() => {
      uniforms.u_time.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    });

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.setAnimationLoop(null);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full -z-10"
    />
  );
}
