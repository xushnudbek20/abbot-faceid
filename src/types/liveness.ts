export interface FaceDetectionResult {
  detections: readonly any[]
  confidence: number
  boundingBox?: BoundingBox
}

export interface BoundingBox {
  xMin: number
  yMin: number
  width: number
  height: number
  xCenter: number
  yCenter: number
}

export interface LivenessCheck {
  blink: boolean
  headMovementLeft: boolean
  headMovementRight: boolean
  stability: boolean
}

export interface LivenessState {
  isFaceDetected: boolean
  isBlinkDetected: boolean
  blinkCount: number
  isHeadMovementDetected: boolean
  headMovementLeft: boolean
  headMovementRight: boolean
  isStable: boolean
  isLivenessCheckPassed: boolean
  currentInstruction: string
  isFaceInFrame: boolean
  isFrameValid: boolean
  faceDistance: 'too-close' | 'too-far' | 'good' | 'none'
  lighting: 'poor' | 'good' | 'unknown'
}

export interface CameraConfig {
  width: number
  height: number
  facingMode: 'user' | 'environment'
}

export interface DetectionConfig {
  minDetectionConfidence: number
  modelSelection: 0 | 1
  fpsLimit: number
}

export interface CaptureConfig {
  imageQuality: number
  format: 'image/jpeg' | 'image/png'
  maxSizeKB: number
}

export interface LivenessCheckConfig {
  requiredBlinks: number
  blinkDetectionTimeoutMs: number
  headMovementThreshold: number
  stabilityDurationMs: number
}

export interface FrameConfig {
  faceHeightPercentage: number
  validFrameTolerance: number
}

export type LivenessPhase
  = | 'initializing'
    | 'detecting-face'
    | 'checking-blink'
    | 'checking-head-left'
    | 'checking-head-right'
    | 'checking-head-center'
    | 'checking-position'
    | 'checking-stability'
    | 'capturing'
    | 'preview'
    | 'uploading'
    | 'complete'
    | 'error'

export interface HeadPosition {
  x: number
  y: number
  rotation: number
}
