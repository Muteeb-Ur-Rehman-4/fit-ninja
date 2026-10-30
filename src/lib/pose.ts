"use client";

import type { Shape } from "./types";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

interface LM { x: number; y: number; visibility?: number }

/**
 * Reads proportions from a full-length photo on this device (MediaPipe pose landmarker, segmentation on).
 * The photo is drawn to a canvas and never uploaded. Returns sliders in -1…1, 0 is average.
 */
export async function shapeFromPhoto(file: File): Promise<{ shape: Shape; note: string } | { error: string }> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 960 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);

  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL },
    runningMode: "IMAGE",
    numPoses: 1,
    outputSegmentationMasks: true,
  });
  try {
    const res = landmarker.detect(canvas);
    const lm = res.landmarks[0] as LM[] | undefined;
    if (!lm) return { error: "No person found. Try a full-length photo, standing, arms a little away from the body." };
    const need = [11, 12, 23, 24, 27, 28];
    if (need.some((i) => (lm[i].visibility ?? 1) < 0.4)) return { error: "Head to feet wasn't clear. Try a photo that shows the whole body." };

    const W = canvas.width, Hh = canvas.height;
    const dist = (a: LM, b: LM) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * Hh);
    const nose = lm[0];
    const ankleY = (lm[27].y + lm[28].y) / 2;
    const height = Math.abs(ankleY - nose.y) * Hh * 1.07; // nose-to-ankle is ~93% of height
    const shoulders = dist(lm[11], lm[12]) / height;
    const hips = dist(lm[23], lm[24]) / height;
    const hipY = (lm[23].y + lm[24].y) / 2;
    const shY = (lm[11].y + lm[12].y) / 2;
    const legs = Math.abs(ankleY - hipY) * Hh / height;

    // Waist from the segmentation mask: width of the body at 60% of the way from shoulders to hips.
    let waist = hips * 0.9;
    const mask = res.segmentationMasks?.[0];
    if (mask) {
      const arr = mask.getAsFloat32Array();
      const mw = mask.width, mh = mask.height;
      const row = Math.min(mh - 1, Math.round((shY + (hipY - shY) * 0.6) * mh));
      let left = -1, right = -1;
      for (let x = 0; x < mw; x++) if (arr[row * mw + x] > 0.5) { if (left < 0) left = x; right = x; }
      if (left >= 0) waist = ((right - left) / mw) * W / height;
      mask.close();
    }

    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    // Typical ratios (of height): shoulders 0.23, hips 0.17, waist 0.15, leg length (hip to ankle) 0.47
    const shape: Shape = {
      shoulders: clamp((shoulders - 0.23) / 0.05),
      hips: clamp((hips - 0.17) / 0.04),
      waist: clamp((waist - 0.15) / 0.05),
      legs: clamp((legs - 0.47) / 0.04),
    };
    return { shape, note: "Read on this device. The photo was not uploaded." };
  } catch (e) {
    return { error: e instanceof Error ? `Couldn't read that photo (${e.message}).` : "Couldn't read that photo." };
  } finally {
    landmarker.close();
  }
}
