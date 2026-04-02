const LOCATION_COORDINATES_STORAGE_KEY =
  "ev-earth-simulator.location-coordinates";

function isValidCoordinateValue(value) {
  return value && Number.isFinite(value.lat) && Number.isFinite(value.lon);
}

export function loadStoredLocationCoordinates(storage = globalThis.localStorage) {
  const coordinates = new Map();

  if (!storage) {
    return coordinates;
  }

  try {
    const storedCoordinates = storage.getItem(LOCATION_COORDINATES_STORAGE_KEY);

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

export function persistLocationCoordinates(
  locationCoordinates,
  storage = globalThis.localStorage
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      LOCATION_COORDINATES_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(locationCoordinates.entries()))
    );
  } catch (error) {
    console.warn("Unable to persist location coordinates:", error);
  }
}
