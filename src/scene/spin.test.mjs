import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";

import {
  CLOSE_CAMERA_DISTANCE,
  DEFAULT_CAMERA_DISTANCE,
  createSettings,
} from "../config/settings.js";
import { createSpinController } from "./spin.js";

function setup(t, overrides = {}) {
  t.mock.method(performance, "now", () => 0);
  const settings = Object.assign(createSettings(), overrides);
  const camera = new THREE.PerspectiveCamera();
  const globe = new THREE.Object3D();
  const controls = { target: new THREE.Vector3() };
  const controller = createSpinController({ globe, camera, controls, settings });
  const start = new THREE.Quaternion();
  const end = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 4
  );
  return { controller, camera, globe, start, end };
}

function assertDistance(camera, expected) {
  assert.ok(Math.abs(camera.position.z - expected) < 1e-10);
}

test("default zoom preserves the original flight curve", async (t) => {
  const { controller, camera, start, end } = setup(t);
  const animation = controller.animateBetweenQuaternions(start, end);
  assertDistance(camera, CLOSE_CAMERA_DISTANCE);
  controller.update(700);
  assertDistance(camera, DEFAULT_CAMERA_DISTANCE);
  controller.update(1400);
  await animation;
  assertDistance(camera, CLOSE_CAMERA_DISTANCE);
  assert.equal(controller.isActive(), false);
});

test("independent endpoint zooms apply to the prepared recording frame and flight", async (t) => {
  const { controller, camera, globe, start, end } = setup(t, {
    startZoom: 1.4,
    endZoom: 0.5,
  });
  controller.prepareStartView(start);
  assertDistance(camera, CLOSE_CAMERA_DISTANCE / 1.4);
  assert.ok(globe.quaternion.equals(start));

  const animation = controller.animateBetweenQuaternions(start, end);
  assertDistance(camera, CLOSE_CAMERA_DISTANCE / 1.4);
  controller.update(700);
  assertDistance(camera, CLOSE_CAMERA_DISTANCE / 0.5);
  controller.update(1400);
  await animation;
  assertDistance(camera, CLOSE_CAMERA_DISTANCE / 0.5);
  assert.ok(globe.quaternion.angleTo(end) < 1e-7);
});

test("zoomed-out start and zoomed-in end stay within orbit distance limits", async (t) => {
  const { controller, camera, start, end } = setup(t, {
    startZoom: 0.5,
    endZoom: 1.4,
  });
  const animation = controller.animateBetweenQuaternions(start, end);
  assertDistance(camera, CLOSE_CAMERA_DISTANCE / 0.5);
  for (let time = 0; time <= 1400; time += 100) {
    controller.update(time);
    assert.ok(camera.position.z >= 1.5 && camera.position.z <= 5);
  }
  await animation;
  assertDistance(camera, CLOSE_CAMERA_DISTANCE / 1.4);
});
