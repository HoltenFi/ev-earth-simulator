export function createLocationGeocoder({
  locationCoordinates,
  persistLocationCoordinates,
  fetchImpl = fetch,
}) {
  const pendingGeocodeRequests = new Map();

  async function geocodeLocation(location, { forceRefresh = false } = {}) {
    if (!forceRefresh && locationCoordinates.has(location)) {
      return locationCoordinates.get(location);
    }

    if (!forceRefresh && pendingGeocodeRequests.has(location)) {
      return pendingGeocodeRequests.get(location);
    }

    const geocodePromise = (async () => {
      const response = await fetchImpl(
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
      persistLocationCoordinates(locationCoordinates);
      return coordinates;
    })();

    pendingGeocodeRequests.set(location, geocodePromise);

    try {
      return await geocodePromise;
    } finally {
      pendingGeocodeRequests.delete(location);
    }
  }

  return {
    geocodeLocation,
  };
}
