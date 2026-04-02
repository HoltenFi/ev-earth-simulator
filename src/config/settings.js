export const DEFAULT_CAMERA_DISTANCE = 2.5;
export const CLOSE_CAMERA_DISTANCE = 2.15;
export const MAX_DISPLAY_PIXEL_RATIO = 2;
export const RECORDING_MAX_WIDTH = 8000;
export const RECORDING_MAX_HEIGHT = 8000;

const DEFAULT_SETTINGS = {
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
    "Beau Champ, Mauritius",
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

export function createSettings() {
  return {
    ...DEFAULT_SETTINGS,
    locations: [...DEFAULT_SETTINGS.locations],
  };
}
