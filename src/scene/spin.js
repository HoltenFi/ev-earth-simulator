import * as THREE from "three";

import {
  CLOSE_CAMERA_DISTANCE,
  DEFAULT_CAMERA_DISTANCE,
} from "../config/settings.js";

function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export function createSpinController({ globe, camera, controls, settings }) {
  const spinAnimation = {
    active: false,
    segments: [],
    currentSegmentIndex: 0,
    segmentStartTime: 0,
    resolve: null,
  };

  function finishAnimation() {
    spinAnimation.active = false;

    if (!spinAnimation.resolve) {
      return;
    }

    const resolve = spinAnimation.resolve;
    spinAnimation.resolve = null;
    resolve();
  }

  function setCameraDistance(distance) {
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
  }

  function createFlightSegment(startQuaternion, endQuaternion, durationMs) {
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

  function update(time) {
    if (!spinAnimation.active) {
      return;
    }

    const currentSegment =
      spinAnimation.segments[spinAnimation.currentSegmentIndex];

    if (!currentSegment) {
      finishAnimation();
      return;
    }

    const elapsed = time - spinAnimation.segmentStartTime;
    const rawProgress =
      currentSegment.durationMs === 0
        ? 1
        : Math.min(elapsed / currentSegment.durationMs, 1);

    currentSegment.apply(rawProgress);

    if (rawProgress < 1) {
      return;
    }

    spinAnimation.currentSegmentIndex += 1;
    spinAnimation.segmentStartTime = time;

    const nextSegment =
      spinAnimation.segments[spinAnimation.currentSegmentIndex];

    if (!nextSegment) {
      finishAnimation();
      return;
    }

    nextSegment.apply(0);
  }

  function animateBetweenQuaternions(startQuaternion, endQuaternion) {
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

  return {
    animateBetweenQuaternions,
    isActive() {
      return spinAnimation.active;
    },
    update,
  };
}
