function getElement(id) {
  return document.getElementById(id);
}

export function getUIElements() {
  return {
    container: getElement("container"),
    toggleButton: getElement("toggleSidebar"),
    sidebar: getElement("sidebar"),
    bgColorInput: getElement("bgColor"),
    markerColorInput: getElement("markerColor"),
    markerSizeInput: getElement("markerSize"),
    markerSizeValue: getElement("markerSizeValue"),
    ambientLightInput: getElement("ambientLight"),
    ambientLightValue: getElement("ambientLightValue"),
    directionalLightInput: getElement("directionalLight"),
    directionalLightValue: getElement("directionalLightValue"),
    shadowOpacityInput: getElement("shadowOpacity"),
    shadowOpacityValue: getElement("shadowOpacityValue"),
    shadowSizeInput: getElement("shadowSize"),
    shadowSizeValue: getElement("shadowSizeValue"),
    shadowPositionInput: getElement("shadowPosition"),
    shadowPositionValue: getElement("shadowPositionValue"),
    locationList: getElement("locationList"),
    newLocationInput: getElement("newLocation"),
    addLocationButton: getElement("addLocation"),
    startLocationSelect: getElement("startLocation"),
    endLocationSelect: getElement("endLocation"),
    spinSpeedInput: getElement("spinSpeed"),
    spinSpeedValue: getElement("spinSpeedValue"),
    exportWidthInput: getElement("exportWidth"),
    exportHeightInput: getElement("exportHeight"),
    previewSpinButton: getElement("previewSpin"),
    recordSpinButton: getElement("recordSpin"),
    downloadRecordingLink: getElement("downloadRecording"),
    recordingStatus: getElement("recordingStatus"),
    refreshButton: getElement("refreshMarkers"),
    locationStatus: getElement("locationStatus"),
  };
}
