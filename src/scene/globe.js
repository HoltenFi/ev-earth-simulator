import * as THREE from "three";

const earthTextureUrl = new URL("../../earth_texture.png", import.meta.url);
const normalMapUrl = new URL("../../8k_earth_normal_map.png", import.meta.url);

function loadTexture(loader, url, { onLoad, label }) {
  return loader.load(
    url.href,
    (texture) => {
      if (onLoad) {
        onLoad(texture);
      }

      if (label) {
        console.log(`${label} loaded`);
      }
    },
    undefined,
    (error) => console.error(`Error loading ${label?.toLowerCase()}:`, error)
  );
}

export function createGlobe() {
  const geometry = new THREE.SphereGeometry(1, 256, 256);
  const textureLoader = new THREE.TextureLoader();

  const texture = loadTexture(textureLoader, earthTextureUrl, {
    label: "Base texture",
  });
  const normalMap = loadTexture(textureLoader, normalMapUrl, {
    label: "Normal map",
    onLoad(textureAsset) {
      textureAsset.colorSpace = THREE.NoColorSpace;
    },
  });

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    normalMap,
    normalScale: new THREE.Vector2(8.0, 8.0),
    displacementMap: normalMap,
    displacementScale: 0.04,
    displacementBias: -0.02,
    roughness: 1.0,
    metalness: 0.0,
    color: 0xffffff,
  });

  return new THREE.Mesh(geometry, material);
}
