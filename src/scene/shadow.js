import * as THREE from "three";

const SHADOW_TEXTURE_SIZE = 512;
const BASE_SHADOW_SIZE = 5;

export function createShadowPlane(settings) {
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = SHADOW_TEXTURE_SIZE;
  shadowCanvas.height = SHADOW_TEXTURE_SIZE;

  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const planeMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(BASE_SHADOW_SIZE, BASE_SHADOW_SIZE),
    planeMaterial
  );

  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = -1;

  function updateShadowGradient() {
    const context = shadowCanvas.getContext("2d");
    const size = SHADOW_TEXTURE_SIZE;
    const center = size / 2;
    const gradientRadius = center;

    context.clearRect(0, 0, size, size);

    const gradient = context.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      gradientRadius
    );
    gradient.addColorStop(0, `rgba(0, 0, 0, ${settings.shadowOpacity})`);
    gradient.addColorStop(
      0.5,
      `rgba(0, 0, 0, ${settings.shadowOpacity * 0.43})`
    );
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    shadowTexture.needsUpdate = true;
  }

  function updateShadowScale() {
    const scale = settings.shadowSize / BASE_SHADOW_SIZE;
    plane.scale.set(scale, scale, scale);
  }

  function updateShadowPosition() {
    plane.position.set(0, settings.shadowPosition, 0);
  }

  updateShadowGradient();
  updateShadowScale();
  updateShadowPosition();

  return {
    plane,
    updateShadowGradient,
    updateShadowScale,
    updateShadowPosition,
  };
}
