import {
  RECORDING_MAX_HEIGHT,
  RECORDING_MAX_WIDTH,
} from "../config/settings.js";
import { clampExportDimension } from "../lib/coordinates.js";

function getRecordingBufferSize(settings) {
  return {
    width: clampExportDimension(
      Math.min(settings.exportWidth, RECORDING_MAX_WIDTH)
    ),
    height: clampExportDimension(
      Math.min(settings.exportHeight, RECORDING_MAX_HEIGHT)
    ),
  };
}

export function prepareRendererForRecording({
  renderer,
  camera,
  settings,
  syncRendererToViewport,
}) {
  const recordingSize = getRecordingBufferSize(settings);
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

function formatRecordingFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `globe-spin-${timestamp}.webm`;
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

export function startCanvasRecording(canvas) {
  if (!canvas.captureStream) {
    throw new Error("Canvas recording is not supported in this browser.");
  }

  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder is not supported in this browser.");
  }

  const mimeType = getRecordingMimeType();
  const stream = canvas.captureStream(60);
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
