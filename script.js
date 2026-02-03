import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Settings
let settings = {
  backgroundColor: 0xffffff,
  markerColor: 0xff0000,
  markerSize: 0.008,
  locations: ["New York, USA", "Miami, USA", "Cancun, Mexico"],
  shadowOpacity: 0.35,
  shadowSize: 5,
  shadowPosition: -1.8,
};

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1.0);
document.getElementById("container").appendChild(renderer.domElement);

camera.position.z = 2.5;

// Create sphere geometry for globe - increase segments for displacement mapping
const geometry = new THREE.SphereGeometry(1, 256, 256);

// Load real Earth texture - light colored map
// Use Parcel's URL import for static assets
const earthTextureUrl = new URL('./earth_texture.png', import.meta.url);
const normalMapUrl = new URL('./8k_earth_normal_map.png', import.meta.url);
const specularMapUrl = new URL('./8k_earth_specular_map.png', import.meta.url);

const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load(
  earthTextureUrl.href,
  () => console.log("Base texture loaded"),
  undefined,
  (err) => console.error("Error loading base texture:", err)
);
const normalMap = textureLoader.load(
  normalMapUrl.href,
  (tex) => {
    tex.colorSpace = THREE.NoColorSpace; // Normal maps should not have color space correction
    console.log("Normal map loaded");
  },
  undefined,
  (err) => console.error("Error loading normal map:", err)
);
const specularMap = textureLoader.load(
  specularMapUrl.href,
  (tex) => {
    tex.colorSpace = THREE.NoColorSpace;
    console.log("Specular map loaded");
  },
  undefined,
  (err) => console.error("Error loading specular map:", err)
);

const material = new THREE.MeshStandardMaterial({
  map: texture,
  normalMap: normalMap,
  normalScale: new THREE.Vector2(8.0, 8.0), // Strong normal mapping for detail
  displacementMap: normalMap, // Use normal map as displacement for physical elevation
  displacementScale: 0.04, // Reduced to avoid spikes while keeping 3D effect
  displacementBias: -0.02, // Adjusted to keep oceans smooth
  roughness: 1.0, // Fully matte surface
  metalness: 0.0, // No metallic reflection
  color: 0xffffff, // Ensure full color saturation
});
const globe = new THREE.Mesh(geometry, material);
scene.add(globe);

// Create shadow gradient texture
let shadowCanvas = document.createElement('canvas');
shadowCanvas.width = 512;
shadowCanvas.height = 512;
let shadowTexture = new THREE.CanvasTexture(shadowCanvas);

// Function to update shadow gradient
function updateShadowGradient() {
  const ctx = shadowCanvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  // Keep gradient radius fixed - only plane scaling controls size
  const gradientRadius = 256;

  // Create radial gradient from center (dark) to edges (transparent)
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, gradientRadius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${settings.shadowOpacity})`); // Dark center
  gradient.addColorStop(0.5, `rgba(0, 0, 0, ${settings.shadowOpacity * 0.43})`); // Mid fade
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Transparent edge

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  shadowTexture.needsUpdate = true;
}

// Create shadow plane
const planeMaterial = new THREE.MeshBasicMaterial({
  map: shadowTexture,
  transparent: true,
  opacity: 1.0,
  depthWrite: false, // Prevent z-fighting
});
const plane = new THREE.Mesh(new THREE.PlaneGeometry(settings.shadowSize, settings.shadowSize), planeMaterial);
plane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
plane.position.set(0, settings.shadowPosition, 0); // Position below the globe relative to camera
plane.renderOrder = -1; // Render shadow before globe
camera.add(plane); // Attach to camera so it stays fixed with viewpoint

// Initialize shadow gradient
updateShadowGradient();

// Function to convert lat/lon to 3D coordinates
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Store markers
let markers = [];

// Add marker
function addMarker(lat, lon, color, size) {
  const markerGeometry = new THREE.CircleGeometry(size, 32);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
  });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);

  const position = latLonToVector3(lat, lon, 1.005);
  marker.position.copy(position);

  // Make the marker face outward from the globe center (look away from origin)
  const normalVector = position.clone().normalize();
  marker.lookAt(marker.position.clone().add(normalVector));

  globe.add(marker);
  markers.push(marker);
  return marker;
}

// Clear all markers
function clearMarkers() {
  markers.forEach((marker) => globe.remove(marker));
  markers = [];
}

// Geocode cities and add markers
async function geocodeAndAddMarkers() {
  clearMarkers();
  for (const city of settings.locations) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          city
        )}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        addMarker(lat, lon, settings.markerColor, settings.markerSize);
        console.log(`Added marker for ${city} at ${lat}, ${lon}`);
      }

      // Add delay to respect API rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error geocoding ${city}:`, error);
    }
  }
}

// Start geocoding and adding markers
geocodeAndAddMarkers();

// Lighting - Simple setup with light from behind camera
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// Main directional light attached to camera
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(0, 3, 2); // Position relative to camera
camera.add(directionalLight); // Attach to camera so it moves with the viewpoint
scene.add(camera);

// Orbit controls for mouse interaction
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.autoRotate = false;
controls.minDistance = 1.5;
controls.maxDistance = 5;

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  controls.update();
  renderer.render(scene, camera);
}

animate();

// UI Controls
// Toggle sidebar
const toggleBtn = document.getElementById("toggleSidebar");
const sidebar = document.getElementById("sidebar");

toggleBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Background color control
const bgColorInput = document.getElementById("bgColor");
bgColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  settings.backgroundColor = parseInt(color.replace("#", "0x"));
  renderer.setClearColor(settings.backgroundColor, 1.0);
});

// Marker color control
const markerColorInput = document.getElementById("markerColor");
markerColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  settings.markerColor = parseInt(color.replace("#", "0x"));
});

// Marker size control
const markerSizeInput = document.getElementById("markerSize");
const markerSizeValue = document.getElementById("markerSizeValue");

markerSizeInput.addEventListener("input", (e) => {
  settings.markerSize = parseFloat(e.target.value);
  markerSizeValue.textContent = settings.markerSize.toFixed(3);
});

// Ambient light control
const ambientLightInput = document.getElementById("ambientLight");
const ambientLightValue = document.getElementById("ambientLightValue");

ambientLightInput.addEventListener("input", (e) => {
  settings.ambientLightIntensity = parseFloat(e.target.value);
  ambientLight.intensity = settings.ambientLightIntensity;
  ambientLightValue.textContent = settings.ambientLightIntensity.toFixed(1);
});

// Directional light control
const directionalLightInput = document.getElementById("directionalLight");
const directionalLightValue = document.getElementById("directionalLightValue");

directionalLightInput.addEventListener("input", (e) => {
  settings.directionalLightIntensity = parseFloat(e.target.value);
  directionalLight.intensity = settings.directionalLightIntensity;
  directionalLightValue.textContent =
    settings.directionalLightIntensity.toFixed(1);
});

// Shadow opacity control
const shadowOpacityInput = document.getElementById("shadowOpacity");
const shadowOpacityValue = document.getElementById("shadowOpacityValue");

shadowOpacityInput.addEventListener("input", (e) => {
  settings.shadowOpacity = parseFloat(e.target.value);
  shadowOpacityValue.textContent = settings.shadowOpacity.toFixed(2);
  updateShadowGradient();
});

// Shadow size control
const shadowSizeInput = document.getElementById("shadowSize");
const shadowSizeValue = document.getElementById("shadowSizeValue");

shadowSizeInput.addEventListener("input", (e) => {
  settings.shadowSize = parseFloat(e.target.value);
  shadowSizeValue.textContent = settings.shadowSize.toFixed(1);
  // Scale the plane instead of changing geometry
  const scale = settings.shadowSize / 5; // 5 is the base size
  plane.scale.set(scale, scale, scale);
});

// Shadow position control
const shadowPositionInput = document.getElementById("shadowPosition");
const shadowPositionValue = document.getElementById("shadowPositionValue");

shadowPositionInput.addEventListener("input", (e) => {
  settings.shadowPosition = parseFloat(e.target.value);
  shadowPositionValue.textContent = Math.abs(settings.shadowPosition).toFixed(1);
  plane.position.y = settings.shadowPosition;
});

// Update location list UI
function updateLocationList() {
  const locationList = document.getElementById("locationList");
  locationList.innerHTML = "";

  settings.locations.forEach((location, index) => {
    const item = document.createElement("div");
    item.className = "location-item";

    const locationText = document.createElement("span");
    locationText.textContent = location;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Remove";
    deleteBtn.addEventListener("click", () => {
      settings.locations.splice(index, 1);
      updateLocationList();
    });

    item.appendChild(locationText);
    item.appendChild(deleteBtn);
    locationList.appendChild(item);
  });
}

// Add new location
const newLocationInput = document.getElementById("newLocation");
const addLocationBtn = document.getElementById("addLocation");

addLocationBtn.addEventListener("click", () => {
  const location = newLocationInput.value.trim();
  if (location) {
    settings.locations.push(location);
    newLocationInput.value = "";
    updateLocationList();
  }
});

newLocationInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addLocationBtn.click();
  }
});

// Refresh markers button
const refreshBtn = document.getElementById("refreshMarkers");
refreshBtn.addEventListener("click", () => {
  geocodeAndAddMarkers();
});

// Initialize location list
updateLocationList();
