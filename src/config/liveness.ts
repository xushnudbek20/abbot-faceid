import type { DetectionConfig, CaptureConfig, LivenessCheckConfig, FrameConfig, CameraConfig } from '@/types/liveness'

export const cameraConfig: CameraConfig = {
  width: 1080,
  height: 1920,
  facingMode: 'user',
}

export const detectionConfig: DetectionConfig = {
  minDetectionConfidence: 0.5,
  modelSelection: 0,
  fpsLimit: 15,
}

export const captureConfig: CaptureConfig = {
  imageQuality: 0.9,
  format: 'image/jpeg',
  maxSizeKB: 2048,
}

export const livenessCheckConfig: LivenessCheckConfig = {
  requiredBlinks: 2,
  blinkDetectionTimeoutMs: 10000,
  headMovementThreshold: 0.1,
  stabilityDurationMs: 500,
}

export const frameConfig: FrameConfig = {
  faceHeightPercentage: 35,
  validFrameTolerance: 0.1,
}

export const livenessConfig = {
  detection: detectionConfig,
  capture: captureConfig,
  liveness: livenessCheckConfig,
  frame: frameConfig,
  camera: cameraConfig,
}
