import { createSettings } from "./src/config/settings.js";
import { wait, waitForAnimationFrame } from "./src/lib/async.js";
import { formatPixelSize, clampExportDimension, getLocationQuaternion } from "./src/lib/coordinates.js";
import { createLocationGeocoder } from "./src/lib/geocoding.js";
import {
  loadStoredLocationCoordinates,
  persistLocationCoordinates,
} from "./src/lib/storage.js";
import { createMarkerManager } from "./src/scene/markers.js";
import {
  prepareRendererForRecording,
  startCanvasRecording,
} from "./src/scene/recording.js";
import { createGlobeScene } from "./src/scene/scene.js";
import { createSpinController } from "./src/scene/spin.js";
import { getUIElements } from "./src/ui/dom.js";
import {
  renderLocationList,
  renderRouteLocationOptions,
} from "./src/ui/locations.js";

const settings = createSettings();
const locationCoordinates = loadStoredLocationCoordinates();
const recordingState = {
  active: false,
  downloadUrl: "",
};

const ui = getUIElements();
const globeScene = createGlobeScene({
  container: ui.container,
  settings,
});
const markerManager = createMarkerManager({
  globe: globeScene.globe,
  settings,
});
const spinController = createSpinController({
  globe: globeScene.globe,
  camera: globeScene.camera,
  controls: globeScene.controls,
  settings,
});
const { geocodeLocation } = createLocationGeocoder({
  locationCoordinates,
  persistLocationCoordinates,
});

function setRecordingStatus(message) {
  ui.recordingStatus.textContent = message;
}

function setLocationStatus(message, tone = "default") {
  ui.locationStatus.textContent = message;
  ui.locationStatus.dataset.tone = tone;
}

function revokeDownloadUrl() {
  if (!recordingState.downloadUrl) {
    return;
  }

  URL.revokeObjectURL(recordingState.downloadUrl);
  recordingState.downloadUrl = "";
}

function updateDownloadLinkState({ url = "", filename = "" } = {}) {
  revokeDownloadUrl();

  if (url) {
    recordingState.downloadUrl = url;
    ui.downloadRecordingLink.href = url;
    ui.downloadRecordingLink.download = filename;
    ui.downloadRecordingLink.classList.remove("disabled");
    return;
  }

  ui.downloadRecordingLink.removeAttribute("href");
  ui.downloadRecordingLink.removeAttribute("download");
  ui.downloadRecordingLink.classList.add("disabled");
}

function updateRecordingControls() {
  const hasEnoughLocations = settings.locations.length >= 2;
  const hasSelections =
    Boolean(settings.startLocation) && Boolean(settings.endLocation);
  const hasDifferentLocations = settings.startLocation !== settings.endLocation;
  const disableSpinActions =
    recordingState.active ||
    spinController.isActive() ||
    !hasEnoughLocations ||
    !hasSelections ||
    !hasDifferentLocations;

  ui.previewSpinButton.disabled = disableSpinActions;
  ui.recordSpinButton.disabled = disableSpinActions;
}

function updateRouteLocationOptions() {
  renderRouteLocationOptions({
    settings,
    startLocationSelect: ui.startLocationSelect,
    endLocationSelect: ui.endLocationSelect,
  });
  updateRecordingControls();
}

function handleRemoveLocation(location) {
  settings.locations = settings.locations.filter(
    (candidate) => candidate !== location
  );
  locationCoordinates.delete(location);
  persistLocationCoordinates(locationCoordinates);
  markerManager.removeLocationMarker(location);
  updateLocationList();
  updateRouteLocationOptions();
  setLocationStatus(`Removed ${location}.`);
}

function updateLocationList() {
  renderLocationList({
    settings,
    locationList: ui.locationList,
    onRemoveLocation: handleRemoveLocation,
  });
}

function setLocationInputBusy(isBusy) {
  ui.addLocationButton.disabled = isBusy;
  ui.newLocationInput.disabled = isBusy;
}

async function geocodeAndAddMarkers() {
  markerManager.clearMarkers();

  for (const location of settings.locations) {
    const hadCachedCoordinates = locationCoordinates.has(location);

    try {
      const coordinates = await geocodeLocation(location);
      markerManager.renderLocationMarker(location, coordinates);
      console.log(
        `Added marker for ${location} at ${coordinates.lat}, ${coordinates.lon}`
      );

      if (!hadCachedCoordinates) {
        await wait(1000);
      }
    } catch (error) {
      console.error(`Error geocoding ${location}:`, error);
    }
  }
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
    ui.newLocationInput.value = "";
    updateLocationList();
    updateRouteLocationOptions();
    markerManager.renderLocationMarker(trimmedLocation, coordinates);
    setLocationStatus(`Added ${trimmedLocation}.`, "success");
  } catch (error) {
    console.error(`Error adding ${trimmedLocation}:`, error);
    setLocationStatus(
      error.message || `Unable to add ${trimmedLocation}.`,
      "error"
    );
  } finally {
    setLocationInputBusy(false);
    ui.newLocationInput.focus();
  }
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
  if (recordingState.active || spinController.isActive()) {
    return;
  }

  globeScene.controls.enabled = false;
  updateRecordingControls();

  try {
    const targets = await getSelectedLocationSpinTargets();

    if (!targets) {
      return;
    }

    globeScene.globe.quaternion.copy(targets.startQuaternion);
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    setRecordingStatus("Previewing spin...");
    await spinController.animateBetweenQuaternions(
      targets.startQuaternion,
      targets.endQuaternion
    );

    setRecordingStatus("Preview finished. Record the spin when ready.");
  } catch (error) {
    console.error("Error previewing spin:", error);
    setRecordingStatus(error.message || "Unable to preview the spin.");
  } finally {
    globeScene.controls.enabled = true;
    updateRecordingControls();
  }
}

async function recordSpinBetweenSelectedLocations() {
  if (recordingState.active || spinController.isActive()) {
    return;
  }

  recordingState.active = true;
  globeScene.controls.enabled = false;
  updateDownloadLinkState();
  updateRecordingControls();

  let recordingSession = null;
  let recordingRendererState = null;

  try {
    const targets = await getSelectedLocationSpinTargets();

    if (!targets) {
      return;
    }

    globeScene.globe.quaternion.copy(targets.startQuaternion);
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    recordingRendererState = prepareRendererForRecording({
      renderer: globeScene.renderer,
      camera: globeScene.camera,
      settings,
      syncRendererToViewport: globeScene.syncRendererToViewport,
    });
    setRecordingStatus(
      `Recording spin at ${recordingRendererState.width}x${recordingRendererState.height}...`
    );
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    recordingSession = startCanvasRecording(globeScene.renderer.domElement);

    await spinController.animateBetweenQuaternions(
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
    globeScene.controls.enabled = true;
    updateRecordingControls();
  }
}

function syncExportDimensionInput(input, key) {
  const parsedValue = Number.parseInt(input.value, 10);
  const nextValue = clampExportDimension(
    Number.isFinite(parsedValue) ? parsedValue : settings[key]
  );
  settings[key] = nextValue;
  input.value = String(nextValue);
}

function bindUIEvents() {
  ui.toggleButton.addEventListener("click", () => {
    ui.sidebar.classList.toggle("open");
  });

  ui.bgColorInput.addEventListener("input", (event) => {
    const color = event.target.value;
    settings.backgroundColor = parseInt(color.replace("#", "0x"), 16);
    globeScene.renderer.setClearColor(settings.backgroundColor, 1.0);
  });

  ui.markerColorInput.addEventListener("input", (event) => {
    settings.markerColor = parseInt(event.target.value.replace("#", "0x"), 16);
  });

  ui.markerSizeInput.addEventListener("input", (event) => {
    settings.markerSizePixels = parseFloat(event.target.value);
    ui.markerSizeValue.textContent = formatPixelSize(settings.markerSizePixels);
  });

  ui.ambientLightInput.addEventListener("input", (event) => {
    settings.ambientLightIntensity = parseFloat(event.target.value);
    globeScene.ambientLight.intensity = settings.ambientLightIntensity;
    ui.ambientLightValue.textContent =
      settings.ambientLightIntensity.toFixed(1);
  });

  ui.directionalLightInput.addEventListener("input", (event) => {
    settings.directionalLightIntensity = parseFloat(event.target.value);
    globeScene.directionalLight.intensity = settings.directionalLightIntensity;
    ui.directionalLightValue.textContent =
      settings.directionalLightIntensity.toFixed(1);
  });

  ui.shadowOpacityInput.addEventListener("input", (event) => {
    settings.shadowOpacity = parseFloat(event.target.value);
    ui.shadowOpacityValue.textContent = settings.shadowOpacity.toFixed(2);
    globeScene.updateShadowGradient();
  });

  ui.shadowSizeInput.addEventListener("input", (event) => {
    settings.shadowSize = parseFloat(event.target.value);
    ui.shadowSizeValue.textContent = settings.shadowSize.toFixed(1);
    globeScene.updateShadowScale();
  });

  ui.shadowPositionInput.addEventListener("input", (event) => {
    settings.shadowPosition = parseFloat(event.target.value);
    ui.shadowPositionValue.textContent = Math.abs(
      settings.shadowPosition
    ).toFixed(1);
    globeScene.updateShadowPosition();
  });

  ui.addLocationButton.addEventListener("click", async () => {
    await addLocation(ui.newLocationInput.value);
  });

  ui.newLocationInput.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await addLocation(ui.newLocationInput.value);
    }
  });

  ui.startLocationSelect.addEventListener("change", (event) => {
    settings.startLocation = event.target.value;
    updateRecordingControls();
  });

  ui.endLocationSelect.addEventListener("change", (event) => {
    settings.endLocation = event.target.value;
    updateRecordingControls();
  });

  ui.spinSpeedInput.addEventListener("input", (event) => {
    settings.spinSpeedDegreesPerSecond = parseFloat(event.target.value);
    ui.spinSpeedValue.textContent =
      `${settings.spinSpeedDegreesPerSecond.toFixed(0)}°/s`;
  });

  ui.exportWidthInput.addEventListener("input", () => {
    syncExportDimensionInput(ui.exportWidthInput, "exportWidth");
  });

  ui.exportHeightInput.addEventListener("input", () => {
    syncExportDimensionInput(ui.exportHeightInput, "exportHeight");
  });

  ui.previewSpinButton.addEventListener("click", () => {
    previewSpinBetweenSelectedLocations();
  });

  ui.recordSpinButton.addEventListener("click", () => {
    recordSpinBetweenSelectedLocations();
  });

  ui.refreshButton.addEventListener("click", async () => {
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

  window.addEventListener("resize", () => {
    if (recordingState.active) {
      return;
    }

    globeScene.syncRendererToViewport();
  });

  window.addEventListener("beforeunload", () => {
    revokeDownloadUrl();
  });
}

function animate(time = 0) {
  requestAnimationFrame(animate);

  spinController.update(time);
  globeScene.controls.update();
  globeScene.renderer.render(globeScene.scene, globeScene.camera);
}

function initializeUI() {
  updateLocationList();
  updateRouteLocationOptions();
  updateDownloadLinkState();
  updateRecordingControls();
  syncExportDimensionInput(ui.exportWidthInput, "exportWidth");
  syncExportDimensionInput(ui.exportHeightInput, "exportHeight");
  setRecordingStatus("Preview the spin or record it as a WebM download.");
  setLocationStatus("Add a location to place its marker immediately.");
}

bindUIEvents();
initializeUI();
animate();
void geocodeAndAddMarkers();
