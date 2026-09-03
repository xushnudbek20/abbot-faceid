import { reactive, ref, onUnmounted } from 'vue'
import type { LivenessState, LivenessPhase, FaceDetectionResult, HeadPosition } from '@/types/liveness'
import { livenessCheckConfig, detectionConfig } from '@/config/liveness'

export function useLivenessDetection() {
  const state = reactive<LivenessState>({
    isFaceDetected: false,
    isBlinkDetected: false,
    blinkCount: 0,
    isHeadMovementDetected: false,
    headMovementLeft: false,
    headMovementRight: false,
    isStable: false,
    isLivenessCheckPassed: false,
    currentInstruction: 'Yuzingizni ramkaga joylashtiring',
    isFaceInFrame: false,
    isFrameValid: false,
    faceDistance: 'none',
    lighting: 'unknown',
  })

  const phase = ref<LivenessPhase>('initializing')
  const previousEyeState = ref<'open' | 'closed'>('open')
  const baseHeadPosition = ref<HeadPosition | null>(null)
  const stabilityStartTime = ref<number | null>(null)
  const blinkTimeoutId = ref<number | null>(null)

  const validateFramePosition = (detection: FaceDetectionResult, _videoWidth: number, _videoHeight: number): boolean => {
    if (!detection.boundingBox)
      return false

    const { boundingBox } = detection

    const isCentered = Math.abs(boundingBox.xCenter - 0.5) < 0.2

    const faceHeightRatio = boundingBox.height
    const isHeightValid = faceHeightRatio >= 0.25 && faceHeightRatio <= 0.5

    const faceTopPosition = boundingBox.yCenter - boundingBox.height / 2
    const hasHeadVisible = faceTopPosition > 0.05 && faceTopPosition < 0.42

    const faceBottomPosition = boundingBox.yCenter + boundingBox.height / 2
    const hasChestSpace = faceBottomPosition < 0.82

    return isCentered && isHeightValid && hasHeadVisible && hasChestSpace
  }

  const checkFaceDistance = (detection: FaceDetectionResult): 'too-close' | 'too-far' | 'good' => {
    if (!detection.boundingBox)
      return 'too-far'

    const faceArea = detection.boundingBox.width * detection.boundingBox.height

    if (faceArea > 0.65)
      return 'too-close'
    if (faceArea < 0.08)
      return 'too-far'
    return 'good'
  }

  const detectBlink = (detection: FaceDetectionResult): boolean => {
    if (!detection.detections || detection.detections.length === 0)
      return false

    const faceDetection = detection.detections[0] as {
      landmarks?: Array<{ x: number, y: number, z: number }>
    }
    const landmarks = faceDetection.landmarks

    if (!landmarks || landmarks.length < 6)
      return false

    // landmarks order may vary across detectors; defensively try to find eye and nose-like points
    const rightEye = landmarks[0]!
    const leftEye = landmarks[1]!
    const nose = landmarks[2]!

    const eyeDistance = Math.sqrt(
      Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2),
    )

    const avgEyeToNoseY = ((rightEye.y + leftEye.y) / 2 - nose.y)
    const eyeOpenRatio = avgEyeToNoseY / eyeDistance

    const currentEyeState = eyeOpenRatio < 0.15 ? 'closed' : 'open'

    if (previousEyeState.value === 'open' && currentEyeState === 'closed') {
      previousEyeState.value = 'closed'
      return false
    }

    if (previousEyeState.value === 'closed' && currentEyeState === 'open') {
      previousEyeState.value = 'open'
      return true
    }

    previousEyeState.value = currentEyeState
    return false
  }

  const scheduleBlinkReset = () => {
    if (blinkTimeoutId.value) {
      clearTimeout(blinkTimeoutId.value)
      blinkTimeoutId.value = null
    }

    // reset isBlinkDetected after configured timeout
    blinkTimeoutId.value = window.setTimeout(() => {
      state.isBlinkDetected = false
      blinkTimeoutId.value = null
    }, livenessCheckConfig.blinkDetectionTimeoutMs ?? 1000)
  }

  const baseLandmarkDistances = ref<{ leftEarToNose: number, rightEarToNose: number } | null>(null)

  const detectHeadMovement = (detection: FaceDetectionResult): { left: boolean, right: boolean } => {
    if (!detection.detections || detection.detections.length === 0) {
      return { left: false, right: false }
    }

    const faceDetection = detection.detections[0] as {
      landmarks?: Array<{ x: number, y: number, z?: number }>
    }
    const keypoints = faceDetection.landmarks

    if (!keypoints || keypoints.length < 3) {
      return { left: false, right: false }
    }

    // Best-effort: treat first two as eyes and third as nose (model-dependent).
    const eyeA = keypoints[0]
    const eyeB = keypoints[1]
    const nose = keypoints[2]

    if (!eyeA || !eyeB || !nose || typeof eyeA.x !== 'number' || typeof eyeB.x !== 'number' || typeof nose.x !== 'number') {
      return { left: false, right: false }
    }

    // Order eyes so 'leftEye' has smaller x value (image-left)
    const leftEye = eyeA.x <= eyeB.x ? eyeA : eyeB
    const rightEye = eyeA.x <= eyeB.x ? eyeB : eyeA

    const eyeMidX = (leftEye.x + rightEye.x) / 2
    const interEyeDist = Math.max(Math.abs(rightEye.x - leftEye.x), 1e-6)

    // Signed offset of nose relative to eye midpoint, normalized by inter-eye distance
    const offset = (nose.x - eyeMidX) / interEyeDist

    const threshold = 0.6

    const turnedRight = offset < -threshold
    const turnedLeft = offset > threshold

    return { left: turnedLeft, right: turnedRight }
  }

  const checkStability = (detection: FaceDetectionResult): boolean => {
    if (!detection.boundingBox)
      return false

    if (!baseHeadPosition.value) {
      baseHeadPosition.value = {
        x: detection.boundingBox.xCenter,
        y: detection.boundingBox.yCenter,
        rotation: 0,
      }
      stabilityStartTime.value = Date.now()
      return false
    }

    const xDiff = Math.abs(detection.boundingBox.xCenter - baseHeadPosition.value.x)
    const yDiff = Math.abs(detection.boundingBox.yCenter - baseHeadPosition.value.y)

    if (xDiff < 0.02 && yDiff < 0.02) {
      if (!stabilityStartTime.value) {
        stabilityStartTime.value = Date.now()
      }

      const stableTime = Date.now() - stabilityStartTime.value
      return stableTime >= (livenessCheckConfig.stabilityDurationMs ?? 1200)
    }

    stabilityStartTime.value = null
    baseHeadPosition.value = {
      x: detection.boundingBox.xCenter,
      y: detection.boundingBox.yCenter,
      rotation: 0,
    }
    return false
  }

  const faceDetectionTimer = ref<number | null>(null)

  const processDetection = (detection: FaceDetectionResult, videoWidth: number, videoHeight: number) => {
    state.isFaceDetected = !!detection.detections && detection.detections.length > 0 && (detection.confidence ?? 0) > (detectionConfig.minDetectionConfidence ?? 0.7)

    if (!state.isFaceDetected) {
      state.currentInstruction = 'Iltimos, yuzingizni ramkaga joylashtiring'
      state.isFaceInFrame = false
      state.faceDistance = 'none'
      return
    }

    state.isFaceInFrame = true
    state.faceDistance = checkFaceDistance(detection)

    // Blink detection
    const blinked = detectBlink(detection)
    if (blinked) {
      state.isBlinkDetected = true
      state.blinkCount = (state.blinkCount ?? 0) + 1
      scheduleBlinkReset()
    }

    if (phase.value === 'detecting-face') {
      state.currentInstruction = 'Yuz aniqlandi! Hayotiylik tekshiruviga tayyorlanmoqda...'

      if (!faceDetectionTimer.value) {
        faceDetectionTimer.value = window.setTimeout(() => {
          if (state.isFaceDetected) {
            phase.value = 'checking-head-right'
            state.currentInstruction = 'Boshingizni o\'ngga buring'
            baseHeadPosition.value = null
            faceDetectionTimer.value = null
          }
        }, 1500)
      }
      return
    }

    if (phase.value === 'checking-head-right') {
      const movement = detectHeadMovement(detection)
      state.currentInstruction = 'Boshingizni o\'ngga buring'

      if (movement.right && !state.headMovementRight) {
        state.headMovementRight = true
        state.isHeadMovementDetected = true
        phase.value = 'checking-head-center'
        state.currentInstruction = 'Kameraga qarang'
        return
      }
    }

    if (phase.value === 'checking-head-center') {
      const movement = detectHeadMovement(detection)
      // Center means not turning left or right significantly
      if (!movement.left && !movement.right) {
        phase.value = 'checking-position'
        state.currentInstruction = 'Zo\'r! Endi o\'zingizni ramkaga joylashtiring'
        baseLandmarkDistances.value = null
        baseHeadPosition.value = null
        return
      } else {
        state.currentInstruction = 'Kameraga to\'g\'ri qarang'
        return
      }
    }

    if (phase.value === 'checking-position') {
      state.isFrameValid = validateFramePosition(detection, videoWidth, videoHeight)

      if (state.faceDistance === 'too-close') {
        state.currentInstruction = 'Biroz orqaga - juda yaqin turibsiz'
        return
      }
      if (state.faceDistance === 'too-far') {
        state.currentInstruction = 'Kameraga yaqinroq turing'
        return
      }

      if (!state.isFrameValid) {
        if (detection.boundingBox) {
          const bb = detection.boundingBox
          const faceTop = bb.yCenter - bb.height / 2
          const faceBottom = bb.yCenter + bb.height / 2
          const isCentered = Math.abs(bb.xCenter - 0.5) < 0.2

          if (!isCentered) {
            state.currentInstruction = 'Yuzingizni kamera markaziga joylashtiring'
          }
          else if (faceTop > 0.42) {
            state.currentInstruction = 'Telefoni tepaga ko\'taring yoki orqaga chekining'
          }
          else if (faceTop < 0.05) {
            state.currentInstruction = 'Kameradan biroz uzoqlashing'
          }
          else if (faceBottom > 0.82) {
            state.currentInstruction = 'Orqaga chekining — yelkalaringiz ko\'rinsin'
          }
          else {
            state.currentInstruction = 'Bosh va yelkalaringiz to\'liq ko\'rinsin'
          }
        }
        else {
          state.currentInstruction = 'Boshingizni ko\'taring, yelkalaringiz ko\'rinsin'
        }
        return
      }

      // require stability before considering the check passed
      const stable = checkStability(detection)
      state.isStable = stable

      if (!stable) {
        state.currentInstruction = 'Iltimos, bir oz harakatsiz turing'
        return
      }

      state.isLivenessCheckPassed = true
      phase.value = 'capturing'
      state.currentInstruction = 'Yaxshi! Surat olinmoqda...'
    }
  }

  const startDetection = () => {
    phase.value = 'detecting-face'
    state.currentInstruction = 'Yuzingizni qidiryapmiz...'

    if (faceDetectionTimer.value) {
      clearTimeout(faceDetectionTimer.value)
    }
  }

  const resetChecks = () => {
    state.isFaceDetected = false
    state.isBlinkDetected = false
    state.blinkCount = 0
    state.isHeadMovementDetected = false
    state.headMovementLeft = false
    state.headMovementRight = false
    state.isStable = false
    state.isLivenessCheckPassed = false
    state.currentInstruction = 'Yuzingizni ramkaga joylashtiring'
    state.isFaceInFrame = false
    state.isFrameValid = false
    state.faceDistance = 'none'
    phase.value = 'initializing'
    previousEyeState.value = 'open'
    baseHeadPosition.value = null
    baseLandmarkDistances.value = null
    stabilityStartTime.value = null

    if (blinkTimeoutId.value) {
      clearTimeout(blinkTimeoutId.value)
      blinkTimeoutId.value = null
    }
  }

  onUnmounted(() => {
    if (blinkTimeoutId.value) {
      clearTimeout(blinkTimeoutId.value)
    }
  })

  return {
    state,
    phase,
    startDetection,
    processDetection,
    resetChecks,
  }
}
