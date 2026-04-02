import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Settings
let settings = {
  backgroundColor: 0xffffff,
  markerColor: 0xff0000,
  markerSizePixels: 8,
  ambientLightIntensity: 1.2,
  directionalLightIntensity: 1.5,
  locations: [
    "Whistler, Canada",
    "Québec, Canada",
    "Utah, USA",
    "New York, USA",
    "Los Angeles, USA",
    "Panama City, Panama",
    "Mexico City, Mexico",
    "Acapulco, Mexico",
    "Bogota, Colombia",
    "British Virgin Islands",
    "Valparaíso, Chile",
    "Berlin, Germany",
    "Kitzbühel, Austria",
    "Budapest, Hungary",
    "Prague, Czechia",
    "Andratx, Spain",
    "Lindos, Greece",
    "Athens, Greece",
    "Paris, France",
    "Monaco",
    "Dubai, UAE",
    "Cape Town, South Africa",
    "Durban, South Africa",
    "Mpumalanga, South Africa",
    "Beau Champ, Mauritius"
  ],
  startLocation: "Whistler, Canada",
  endLocation: "Berlin, Germany",
  spinSpeedDegreesPerSecond: 35,
  exportWidth: 1920,
  exportHeight: 1080,
  shadowOpacity: 0.35,
  shadowSize: 5,
  shadowPosition: -1.8,
};

const FRONT_VECTOR = new THREE.Vector3(0, 0, 1);
const DEFAULT_CAMERA_DISTANCE = 2.5;
const CLOSE_CAMERA_DISTANCE = 2.15;
const MAX_DISPLAY_PIXEL_RATIO = 2;
const RECORDING_MAX_WIDTH = 8000;
const RECORDING_MAX_HEIGHT = 8000;
const LOCATION_COORDINATES_STORAGE_KEY =
  "ev-earth-simulator.location-coordinates";
const locationCoordinates = loadStoredLocationCoordinates();
const locationMarkers = new Map();
const pendingGeocodeRequests = new Map();
const spinAnimation = {
  active: false,
  segments: [],
  currentSegmentIndex: 0,
  segmentStartTime: 0,
  resolve: null,
};
const recordingState = {
  active: false,
  downloadUrl: "",
};

function isValidCoordinateValue(value) {
  return value && Number.isFinite(value.lat) && Number.isFinite(value.lon);
}

function loadStoredLocationCoordinates() {
  const coordinates = new Map();

  if (typeof localStorage === "undefined") {
    return coordinates;
  }

  try {
    const storedCoordinates = localStorage.getItem(
      LOCATION_COORDINATES_STORAGE_KEY
    );

    if (!storedCoordinates) {
      return coordinates;
    }

    const parsedCoordinates = JSON.parse(storedCoordinates);

    if (!parsedCoordinates || typeof parsedCoordinates !== "object") {
      return coordinates;
    }

    Object.entries(parsedCoordinates).forEach(([location, value]) => {
      if (isValidCoordinateValue(value)) {
        coordinates.set(location, {
          lat: value.lat,
          lon: value.lon,
        });
      }
    });
  } catch (error) {
    console.warn("Unable to load stored location coordinates:", error);
  }

  return coordinates;
}

function persistLocationCoordinates() {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      LOCATION_COORDINATES_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(locationCoordinates.entries()))
    );
  } catch (error) {
    console.warn("Unable to persist location coordinates:", error);
  }
}

// Scene setup
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
renderer.setClearColor(0xffffff, 1.0);
document.getElementById("container").appendChild(renderer.domElement);

camera.position.z = DEFAULT_CAMERA_DISTANCE;

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function clampExportDimension(value) {
  return THREE.MathUtils.clamp(Math.round(value), 240, 3840);
}

function syncRendererToViewport() {
  const viewport = getViewportSize();
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DISPLAY_PIXEL_RATIO));
  renderer.setSize(viewport.width, viewport.height, false);
}

function getRecordingBufferSize() {
  return {
    width: clampExportDimension(
      Math.min(settings.exportWidth, RECORDING_MAX_WIDTH)
    ),
    height: clampExportDimension(
      Math.min(settings.exportHeight, RECORDING_MAX_HEIGHT)
    ),
  };
}

function prepareRendererForRecording() {
  const recordingSize = getRecordingBufferSize();
  camera.aspect = recordingSize.width / recordingSize.height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);
  renderer.setSize(recordingSize.width, recordingSize.height, false);

  return {
    width: recordingSize.width,
    height: recordingSize.height,
    restore() {
      syncRendererToViewport();
    },
  };
}

syncRendererToViewport();

function formatRecordingFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `globe-spin-${timestamp}.webm`;
}

function revokeDownloadUrl() {
  if (recordingState.downloadUrl) {
    URL.revokeObjectURL(recordingState.downloadUrl);
    recordingState.downloadUrl = "";
  }
}

async function geocodeLocation(location, { forceRefresh = false } = {}) {
  if (!forceRefresh && locationCoordinates.has(location)) {
    return locationCoordinates.get(location);
  }

  if (!forceRefresh && pendingGeocodeRequests.has(location)) {
    return pendingGeocodeRequests.get(location);
  }

  const geocodePromise = (async () => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        location
      )}&limit=1`
    );

    if (!response.ok) {
      throw new Error(`Failed to geocode ${location}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error(`No result found for ${location}`);
    }

    const coordinates = {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };

    locationCoordinates.set(location, coordinates);
    persistLocationCoordinates();
    return coordinates;
  })();

  pendingGeocodeRequests.set(location, geocodePromise);

  try {
    return await geocodePromise;
  } finally {
    pendingGeocodeRequests.delete(location);
  }
}

function getLocationQuaternion(lat, lon) {
  const yaw = THREE.MathUtils.degToRad(-(lon + 90));
  const pitch = THREE.MathUtils.degToRad(lat);
  const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    yaw
  );
  const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    pitch
  );

  return pitchQuaternion.multiply(yawQuaternion);
}

function markerSizePixelsToWorld(pixels) {
  return pixels * 0.000375;
}

function formatPixelSize(pixels) {
  return `${Number.isInteger(pixels) ? pixels : pixels.toFixed(1)}px`;
}

// Add marker
function addMarker(lat, lon, color, size) {
  // Create a group to hold both the marker and its ring
  const markerGroup = new THREE.Group();

  // Create the main marker
  const markerGeometry = new THREE.CircleGeometry(size, 32);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
  });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);

  // Create the white ring around the marker
  const ringGeometry = new THREE.RingGeometry(size, size * 1.3, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);

  // Add both to the group
  markerGroup.add(marker);
  markerGroup.add(ring);

  const position = latLonToVector3(lat, lon, 1.005);
  markerGroup.position.copy(position);

  // Make the marker group face outward from the globe center (look away from origin)
  const normalVector = position.clone().normalize();
  markerGroup.lookAt(markerGroup.position.clone().add(normalVector));

  globe.add(markerGroup);
  markers.push(markerGroup);
  return markerGroup;
}

// Clear all markers
function clearMarkers() {
  markers.forEach((marker) => globe.remove(marker));
  markers = [];
  locationMarkers.clear();
}

function removeLocationMarker(location) {
  const marker = locationMarkers.get(location);

  if (!marker) {
    return;
  }

  globe.remove(marker);
  markers = markers.filter((candidate) => candidate !== marker);
  locationMarkers.delete(location);
}

function renderLocationMarker(location, coordinates) {
  removeLocationMarker(location);

  const marker = addMarker(
    coordinates.lat,
    coordinates.lon,
    settings.markerColor,
    markerSizePixelsToWorld(settings.markerSizePixels)
  );

  locationMarkers.set(location, marker);
  return marker;
}

// Geocode cities and add markers
async function geocodeAndAddMarkers() {
  clearMarkers();
  for (const city of settings.locations) {
    const hadCachedCoordinates = locationCoordinates.has(city);

    try {
      const coordinates = await geocodeLocation(city);
      renderLocationMarker(city, coordinates);
      console.log(
        `Added marker for ${city} at ${coordinates.lat}, ${coordinates.lon}`
      );

      if (!hadCachedCoordinates) {
        // Respect the public Nominatim rate limit only when a network request is made.
        await wait(1000);
      }
    } catch (error) {
      console.error(`Error geocoding ${city}:`, error);
    }
  }
}

// Start geocoding and adding markers
geocodeAndAddMarkers();

// Lighting - Simple setup with light from behind camera
const ambientLight = new THREE.AmbientLight(
  0xffffff,
  settings.ambientLightIntensity
);
scene.add(ambientLight);

// Main directional light attached to camera
const directionalLight = new THREE.DirectionalLight(
  0xffffff,
  settings.directionalLightIntensity
);
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

function setRecordingStatus(message) {
  recordingStatus.textContent = message;
}

function setLocationStatus(message, tone = "default") {
  locationStatus.textContent = message;
  locationStatus.dataset.tone = tone;
}

function updateDownloadLinkState({ url = "", filename = "" } = {}) {
  revokeDownloadUrl();

  if (url) {
    recordingState.downloadUrl = url;
    downloadRecordingLink.href = url;
    downloadRecordingLink.download = filename;
    downloadRecordingLink.classList.remove("disabled");
    return;
  }

  downloadRecordingLink.removeAttribute("href");
  downloadRecordingLink.removeAttribute("download");
  downloadRecordingLink.classList.add("disabled");
}

function updateRecordingControls() {
  const hasEnoughLocations = settings.locations.length >= 2;
  const hasSelections =
    Boolean(settings.startLocation) && Boolean(settings.endLocation);
  const hasDifferentLocations = settings.startLocation !== settings.endLocation;
  const disableSpinActions =
    recordingState.active ||
    spinAnimation.active ||
    !hasEnoughLocations ||
    !hasSelections ||
    !hasDifferentLocations;

  previewSpinButton.disabled = disableSpinActions;
  recordSpinButton.disabled = disableSpinActions;
}

function updateSpinAnimation(time) {
  if (!spinAnimation.active) {
    return;
  }

  const currentSegment =
    spinAnimation.segments[spinAnimation.currentSegmentIndex];

  if (!currentSegment) {
    spinAnimation.active = false;
    if (spinAnimation.resolve) {
      const resolve = spinAnimation.resolve;
      spinAnimation.resolve = null;
      resolve();
    }
    return;
  }

  const elapsed = time - spinAnimation.segmentStartTime;
  const rawProgress =
    currentSegment.durationMs === 0
      ? 1
      : Math.min(elapsed / currentSegment.durationMs, 1);

  currentSegment.apply(rawProgress);

  if (rawProgress >= 1) {
    spinAnimation.currentSegmentIndex += 1;
    spinAnimation.segmentStartTime = time;

    const nextSegment =
      spinAnimation.segments[spinAnimation.currentSegmentIndex];

    if (!nextSegment) {
      spinAnimation.active = false;
      if (spinAnimation.resolve) {
        const resolve = spinAnimation.resolve;
        spinAnimation.resolve = null;
        resolve();
      }
    } else {
      nextSegment.apply(0);
    }
  }
}

function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function setCameraDistance(distance) {
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
}

function createFlightSegment(
  startQuaternion,
  endQuaternion,
  durationMs
) {
  return {
    durationMs,
    apply(progress) {
      const easedProgress = easeInOutCubic(progress);
      globe.quaternion.slerpQuaternions(
        startQuaternion,
        endQuaternion,
        easedProgress
      );

      const zoomCurve = Math.sin(Math.PI * easedProgress);
      const cameraDistance = THREE.MathUtils.lerp(
        CLOSE_CAMERA_DISTANCE,
        DEFAULT_CAMERA_DISTANCE,
        zoomCurve
      );
      setCameraDistance(cameraDistance);
    },
  };
}

function animateGlobeBetweenQuaternions(startQuaternion, endQuaternion) {
  const angle = startQuaternion.angleTo(endQuaternion);
  const degrees = THREE.MathUtils.radToDeg(angle);
  const rotationDurationMs = Math.max(
    1400,
    (degrees / settings.spinSpeedDegreesPerSecond) * 1000
  );

  globe.quaternion.copy(startQuaternion);
  setCameraDistance(CLOSE_CAMERA_DISTANCE);
  spinAnimation.segments = [
    createFlightSegment(startQuaternion, endQuaternion, rotationDurationMs),
  ];
  spinAnimation.currentSegmentIndex = 0;
  spinAnimation.segmentStartTime = performance.now();
  spinAnimation.active = true;
  spinAnimation.segments[0].apply(0);

  return new Promise((resolve) => {
    spinAnimation.resolve = resolve;
  });
}

function getRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  return (
    candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || ""
  );
}

function startCanvasRecording() {
  if (!renderer.domElement.captureStream) {
    throw new Error("Canvas recording is not supported in this browser.");
  }

  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder is not supported in this browser.");
  }

  const mimeType = getRecordingMimeType();
  const stream = renderer.domElement.captureStream(60);
  const chunks = [];

  const mediaRecorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  const stopped = new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (event) => {
      stream.getTracks().forEach((track) => track.stop());
      reject(event.error || new Error("Recording failed."));
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, {
        type: mimeType || "video/webm",
      });
      resolve({
        blob,
        url: URL.createObjectURL(blob),
        filename: formatRecordingFilename(),
      });
    };
  });

  mediaRecorder.start();

  return {
    mediaRecorder,
    stopped,
  };
}

function canRunSelectedLocationSpin() {
  if (!settings.startLocation || !settings.endLocation) {
    setRecordingStatus("Choose both a start and an end location.");
    return false;
  }

  if (settings.startLocation === settings.endLocation) {
    setRecordingStatus("Choose two different locations.");
    return false;
  }

  setRecordingStatus("Resolving locations...");
  return true;
}

async function getSelectedLocationSpinTargets() {
  if (!canRunSelectedLocationSpin()) {
    return null;
  }

  const [startCoordinates, endCoordinates] = await Promise.all([
    geocodeLocation(settings.startLocation),
    geocodeLocation(settings.endLocation),
  ]);

  return {
    startQuaternion: getLocationQuaternion(
      startCoordinates.lat,
      startCoordinates.lon
    ),
    endQuaternion: getLocationQuaternion(endCoordinates.lat, endCoordinates.lon),
  };
}

async function previewSpinBetweenSelectedLocations() {
  if (recordingState.active || spinAnimation.active) {
    return;
  }

  controls.enabled = false;
  updateRecordingControls();

  try {
    const targets = await getSelectedLocationSpinTargets();

    if (!targets) {
      return;
    }

    globe.quaternion.copy(targets.startQuaternion);
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    setRecordingStatus("Previewing spin...");
    await animateGlobeBetweenQuaternions(
      targets.startQuaternion,
      targets.endQuaternion
    );

    setRecordingStatus("Preview finished. Record the spin when ready.");
  } catch (error) {
    console.error("Error previewing spin:", error);
    setRecordingStatus(error.message || "Unable to preview the spin.");
  } finally {
    controls.enabled = true;
    updateRecordingControls();
  }
}

async function recordSpinBetweenSelectedLocations() {
  if (recordingState.active || spinAnimation.active) {
    return;
  }

  recordingState.active = true;
  controls.enabled = false;
  updateDownloadLinkState();
  updateRecordingControls();

  let recordingSession = null;
  let recordingRendererState = null;

  try {
    const targets = await getSelectedLocationSpinTargets();

    if (!targets) {
      return;
    }

    globe.quaternion.copy(targets.startQuaternion);
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    recordingRendererState = prepareRendererForRecording();
    setRecordingStatus(
      `Recording spin at ${recordingRendererState.width}x${recordingRendererState.height}...`
    );
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    recordingSession = startCanvasRecording();

    await animateGlobeBetweenQuaternions(
      targets.startQuaternion,
      targets.endQuaternion
    );
    await wait(150);

    if (recordingSession.mediaRecorder.state !== "inactive") {
      recordingSession.mediaRecorder.stop();
    }

    const recordingResult = await recordingSession.stopped;

    updateDownloadLinkState({
      url: recordingResult.url,
      filename: recordingResult.filename,
    });

    setRecordingStatus("Recording ready. Download the WebM file.");
  } catch (error) {
    if (recordingSession?.mediaRecorder?.state === "recording") {
      recordingSession.mediaRecorder.stop();
    }
    console.error("Error recording spin:", error);
    setRecordingStatus(error.message || "Unable to create recording.");
  } finally {
    if (recordingRendererState) {
      recordingRendererState.restore();
    }
    recordingState.active = false;
    controls.enabled = true;
    updateRecordingControls();
  }
}

// Handle window resize
window.addEventListener("resize", () => {
  if (recordingState.active) {
    return;
  }

  syncRendererToViewport();
});

window.addEventListener("beforeunload", () => {
  revokeDownloadUrl();
});

// Animation loop
function animate(time = 0) {
  requestAnimationFrame(animate);

  updateSpinAnimation(time);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// UI Controls
// Toggle sidebar
const toggleBtn = document.getElementById("toggleSidebar");
const sidebar = document.getElementById("sidebar");
const bgColorInput = document.getElementById("bgColor");
const markerColorInput = document.getElementById("markerColor");
const markerSizeInput = document.getElementById("markerSize");
const markerSizeValue = document.getElementById("markerSizeValue");
const ambientLightInput = document.getElementById("ambientLight");
const ambientLightValue = document.getElementById("ambientLightValue");
const directionalLightInput = document.getElementById("directionalLight");
const directionalLightValue = document.getElementById("directionalLightValue");
const shadowOpacityInput = document.getElementById("shadowOpacity");
const shadowOpacityValue = document.getElementById("shadowOpacityValue");
const shadowSizeInput = document.getElementById("shadowSize");
const shadowSizeValue = document.getElementById("shadowSizeValue");
const shadowPositionInput = document.getElementById("shadowPosition");
const shadowPositionValue = document.getElementById("shadowPositionValue");
const newLocationInput = document.getElementById("newLocation");
const addLocationBtn = document.getElementById("addLocation");
const startLocationSelect = document.getElementById("startLocation");
const endLocationSelect = document.getElementById("endLocation");
const spinSpeedInput = document.getElementById("spinSpeed");
const spinSpeedValue = document.getElementById("spinSpeedValue");
const exportWidthInput = document.getElementById("exportWidth");
const exportHeightInput = document.getElementById("exportHeight");
const previewSpinButton = document.getElementById("previewSpin");
const recordSpinButton = document.getElementById("recordSpin");
const downloadRecordingLink = document.getElementById("downloadRecording");
const recordingStatus = document.getElementById("recordingStatus");
const refreshBtn = document.getElementById("refreshMarkers");
const locationStatus = document.getElementById("locationStatus");

toggleBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Background color control
bgColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  settings.backgroundColor = parseInt(color.replace("#", "0x"));
  renderer.setClearColor(settings.backgroundColor, 1.0);
});

// Marker color control
markerColorInput.addEventListener("input", (e) => {
  const color = e.target.value;
  settings.markerColor = parseInt(color.replace("#", "0x"));
});

// Marker size control
markerSizeInput.addEventListener("input", (e) => {
  settings.markerSizePixels = parseFloat(e.target.value);
  markerSizeValue.textContent = formatPixelSize(settings.markerSizePixels);
});

// Ambient light control
ambientLightInput.addEventListener("input", (e) => {
  settings.ambientLightIntensity = parseFloat(e.target.value);
  ambientLight.intensity = settings.ambientLightIntensity;
  ambientLightValue.textContent = settings.ambientLightIntensity.toFixed(1);
});

// Directional light control
directionalLightInput.addEventListener("input", (e) => {
  settings.directionalLightIntensity = parseFloat(e.target.value);
  directionalLight.intensity = settings.directionalLightIntensity;
  directionalLightValue.textContent =
    settings.directionalLightIntensity.toFixed(1);
});

// Shadow opacity control
shadowOpacityInput.addEventListener("input", (e) => {
  settings.shadowOpacity = parseFloat(e.target.value);
  shadowOpacityValue.textContent = settings.shadowOpacity.toFixed(2);
  updateShadowGradient();
});

// Shadow size control
shadowSizeInput.addEventListener("input", (e) => {
  settings.shadowSize = parseFloat(e.target.value);
  shadowSizeValue.textContent = settings.shadowSize.toFixed(1);
  // Scale the plane instead of changing geometry
  const scale = settings.shadowSize / 5; // 5 is the base size
  plane.scale.set(scale, scale, scale);
});

// Shadow position control
shadowPositionInput.addEventListener("input", (e) => {
  settings.shadowPosition = parseFloat(e.target.value);
  shadowPositionValue.textContent = Math.abs(settings.shadowPosition).toFixed(1);
  plane.position.y = settings.shadowPosition;
});

function updateLocationSelections() {
  if (settings.locations.length === 0) {
    settings.startLocation = "";
    settings.endLocation = "";
    return;
  }

  if (!settings.locations.includes(settings.startLocation)) {
    settings.startLocation = settings.locations[0];
  }

  if (!settings.locations.includes(settings.endLocation)) {
    settings.endLocation =
      settings.locations.find(
        (location) => location !== settings.startLocation
      ) || settings.locations[0];
  }
}

function buildLocationOption(location, isSelected) {
  const option = document.createElement("option");
  option.value = location;
  option.textContent = location;
  option.selected = isSelected;
  return option;
}

function updateRouteLocationOptions() {
  updateLocationSelections();

  startLocationSelect.innerHTML = "";
  endLocationSelect.innerHTML = "";

  settings.locations.forEach((location) => {
    startLocationSelect.appendChild(
      buildLocationOption(location, location === settings.startLocation)
    );
    endLocationSelect.appendChild(
      buildLocationOption(location, location === settings.endLocation)
    );
  });

  updateRecordingControls();
}

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
      locationCoordinates.delete(location);
      persistLocationCoordinates();
      removeLocationMarker(location);
      updateLocationList();
      updateRouteLocationOptions();
      setLocationStatus(`Removed ${location}.`, "default");
    });

    item.appendChild(locationText);
    item.appendChild(deleteBtn);
    locationList.appendChild(item);
  });
}

function setLocationInputBusy(isBusy) {
  addLocationBtn.disabled = isBusy;
  newLocationInput.disabled = isBusy;
}

async function addLocation(location) {
  const trimmedLocation = location.trim();

  if (!trimmedLocation) {
    setLocationStatus("Enter a location name.", "error");
    return;
  }

  if (settings.locations.includes(trimmedLocation)) {
    setLocationStatus(`${trimmedLocation} is already in the list.`, "error");
    return;
  }

  const hadCachedCoordinates = locationCoordinates.has(trimmedLocation);
  setLocationInputBusy(true);
  setLocationStatus(
    hadCachedCoordinates
      ? `Adding ${trimmedLocation} from cache...`
      : `Looking up ${trimmedLocation}...`,
    "pending"
  );

  try {
    const coordinates = await geocodeLocation(trimmedLocation);
    settings.locations.push(trimmedLocation);
    newLocationInput.value = "";
    updateLocationList();
    updateRouteLocationOptions();
    renderLocationMarker(trimmedLocation, coordinates);
    setLocationStatus(`Added ${trimmedLocation}.`, "success");
  } catch (error) {
    console.error(`Error adding ${trimmedLocation}:`, error);
    setLocationStatus(
      error.message || `Unable to add ${trimmedLocation}.`,
      "error"
    );
  } finally {
    setLocationInputBusy(false);
    newLocationInput.focus();
  }
}

// Add new location
addLocationBtn.addEventListener("click", async () => {
  await addLocation(newLocationInput.value);
});

newLocationInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    await addLocation(newLocationInput.value);
  }
});

startLocationSelect.addEventListener("change", (e) => {
  settings.startLocation = e.target.value;
  updateRecordingControls();
});

endLocationSelect.addEventListener("change", (e) => {
  settings.endLocation = e.target.value;
  updateRecordingControls();
});

spinSpeedInput.addEventListener("input", (e) => {
  settings.spinSpeedDegreesPerSecond = parseFloat(e.target.value);
  spinSpeedValue.textContent = `${settings.spinSpeedDegreesPerSecond.toFixed(0)}°/s`;
});

function syncExportDimensionInput(input, key) {
  const parsedValue = Number.parseInt(input.value, 10);
  const nextValue = clampExportDimension(
    Number.isFinite(parsedValue) ? parsedValue : settings[key]
  );
  settings[key] = nextValue;
  input.value = String(nextValue);
}

exportWidthInput.addEventListener("input", () => {
  syncExportDimensionInput(exportWidthInput, "exportWidth");
});

exportHeightInput.addEventListener("input", () => {
  syncExportDimensionInput(exportHeightInput, "exportHeight");
});

previewSpinButton.addEventListener("click", () => {
  previewSpinBetweenSelectedLocations();
});

recordSpinButton.addEventListener("click", () => {
  recordSpinBetweenSelectedLocations();
});

// Refresh markers button
refreshBtn.addEventListener("click", async () => {
  setLocationStatus("Refreshing markers...", "pending");

  try {
    await geocodeAndAddMarkers();
    setLocationStatus("Markers refreshed.", "success");
  } catch (error) {
    console.error("Error refreshing markers:", error);
    setLocationStatus(
      error.message || "Unable to refresh markers.",
      "error"
    );
  }
});

// Initialize location list
updateLocationList();
updateRouteLocationOptions();
updateDownloadLinkState();
updateRecordingControls();
syncExportDimensionInput(exportWidthInput, "exportWidth");
syncExportDimensionInput(exportHeightInput, "exportHeight");
setRecordingStatus("Preview the spin or record it as a WebM download.");
setLocationStatus("Add a location to place its marker immediately.");
