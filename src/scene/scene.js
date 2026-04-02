import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  DEFAULT_CAMERA_DISTANCE,
  MAX_DISPLAY_PIXEL_RATIO,
} from "../config/settings.js";
import { createGlobe } from "./globe.js";
import { createShadowPlane } from "./shadow.js";

export function createGlobeScene({ container, settings }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  renderer.setClearColor(settings.backgroundColor, 1.0);
  container.appendChild(renderer.domElement);

  camera.position.z = DEFAULT_CAMERA_DISTANCE;

  const globe = createGlobe();
  scene.add(globe);

  const ambientLight = new THREE.AmbientLight(
    0xffffff,
    settings.ambientLightIntensity
  );
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    settings.directionalLightIntensity
  );
  directionalLight.position.set(0, 3, 2);
  camera.add(directionalLight);
  scene.add(camera);

  const {
    plane,
    updateShadowGradient,
    updateShadowScale,
    updateShadowPosition,
  } = createShadowPlane(settings);
  camera.add(plane);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableZoom = true;
  controls.autoRotate = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 5;

  function syncRendererToViewport() {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, MAX_DISPLAY_PIXEL_RATIO)
    );
    renderer.setSize(viewport.width, viewport.height, false);
  }

  syncRendererToViewport();

  return {
    scene,
    camera,
    renderer,
    globe,
    ambientLight,
    directionalLight,
    controls,
    syncRendererToViewport,
    updateShadowGradient,
    updateShadowScale,
    updateShadowPosition,
  };
}
