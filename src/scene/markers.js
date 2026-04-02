import * as THREE from "three";

import {
  latLonToVector3,
  markerSizePixelsToWorld,
} from "../lib/coordinates.js";

export function createMarkerManager({ globe, settings }) {
  let markers = [];
  const locationMarkers = new Map();

  function addMarker(lat, lon, color, size) {
    const markerGroup = new THREE.Group();

    const markerGeometry = new THREE.CircleGeometry(size, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);

    const ringGeometry = new THREE.RingGeometry(size, size * 1.3, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);

    markerGroup.add(marker);
    markerGroup.add(ring);

    const position = latLonToVector3(lat, lon, 1.005);
    markerGroup.position.copy(position);

    const normalVector = position.clone().normalize();
    markerGroup.lookAt(markerGroup.position.clone().add(normalVector));

    globe.add(markerGroup);
    markers.push(markerGroup);
    return markerGroup;
  }

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

  return {
    clearMarkers,
    removeLocationMarker,
    renderLocationMarker,
  };
}
