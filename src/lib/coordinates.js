import * as THREE from "three";

export function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

export function getLocationQuaternion(lat, lon) {
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

export function markerSizePixelsToWorld(pixels) {
  return pixels * 0.000375;
}

export function clampExportDimension(value) {
  return THREE.MathUtils.clamp(Math.round(value), 240, 3840);
}

export function formatPixelSize(pixels) {
  return `${Number.isInteger(pixels) ? pixels : pixels.toFixed(1)}px`;
}
