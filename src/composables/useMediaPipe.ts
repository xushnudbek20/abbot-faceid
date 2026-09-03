import { onUnmounted, readonly, ref } from 'vue'
import type { Results, FaceDetection as FaceDetectionInstance, FaceDetectionConfig } from '@mediapipe/face_detection'
import * as faceDetectionModule from '@mediapipe/face_detection'
import type { FaceDetectionResult, BoundingBox } from '@/types/liveness'
import { detectionConfig } from '@/config/liveness'

// Versiyasiz jsdelivr URL `latest`ga ishora qiladi — o'rnatilgan paketga mos kelmasligi mumkin.
const MEDIAPIPE_VERSION = '0.4.1646425229'

type FaceDetectionCtor = new (config?: FaceDetectionConfig) => FaceDetectionInstance

// Paket — UMD skript, ESM eksporti yo'q. Dev'da Vite uni CJS deb pre-bundle qiladi
// va named export beradi; prod build'da esa Rollup top-level `this`ni `globalThis`ga
// bog'laydi, natijada konstruktor faqat `globalThis`da paydo bo'ladi. Ikkalasini ham qo'llaymiz.
const resolveFaceDetection = (): FaceDetectionCtor => {
  const ctor = (faceDetectionModule as Record<string, unknown>).FaceDetection
    ?? (globalThis as Record<string, unknown>).FaceDetection

  if (typeof ctor !== 'function')
    throw new TypeError('MediaPipe FaceDetection konstruktori topilmadi')

  return ctor as FaceDetectionCtor
}

export function useMediaPipe() {
  const isInitialized = ref(false)
  const isDetecting = ref(false)
  const lastDetectionResult = ref<FaceDetectionResult | null>(null)
  const error = ref<string | null>(null)

  let faceDetection: FaceDetectionInstance | null = null
  let animationFrameId: number | null = null
  let lastFrameTime = 0
  const frameInterval = 1000 / detectionConfig.fpsLimit

  const onResults = (results: Results) => {
    if (!results.detections || results.detections.length === 0) {
      lastDetectionResult.value = {
        detections: [],
        confidence: 0,
      }
      return
    }

    const detection = results.detections[0] as any
    const boundingBox = detection.boundingBox

    if (!boundingBox) {
      lastDetectionResult.value = {
        detections: [],
        confidence: 0,
      }
      return
    }

    const bbox: BoundingBox = {
      xMin: boundingBox.xMin ?? (boundingBox.xCenter - boundingBox.width / 2),
      yMin: boundingBox.yMin ?? (boundingBox.yCenter - boundingBox.height / 2),
      width: boundingBox.width,
      height: boundingBox.height,
      xCenter: boundingBox.xCenter,
      yCenter: boundingBox.yCenter,
    }

    const confidence = (detection as any).V?.[0]?.ga
      ?? detection.score?.[0]
      ?? (detection as any).score
      ?? 0.7

    lastDetectionResult.value = {
      detections: results.detections,
      confidence,
      boundingBox: bbox,
    }
  }

  const initialize = async () => {
    try {
      const FaceDetectionClass = resolveFaceDetection()

      const instance = new FaceDetectionClass({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@${MEDIAPIPE_VERSION}/${file}`
        },
      })

      instance.setOptions({
        model: 'short',
        minDetectionConfidence: detectionConfig.minDetectionConfidence,
      })

      instance.onResults(onResults)

      faceDetection = instance
      isInitialized.value = true
    } catch (err) {
      error.value = 'Failed to initialize MediaPipe Face Detection'
      console.error('MediaPipe initialization error:', err)
      throw err
    }
  }

  const startDetection = async (videoElement: HTMLVideoElement) => {
    if (!faceDetection || !isInitialized.value) {
      await initialize()
    }

    try {
      isDetecting.value = true

      const processFrame = async () => {
        if (!isDetecting.value || !faceDetection) return

        const now = Date.now()
        if (now - lastFrameTime >= frameInterval) {
          try {
            // Ensure video is ready
            if (videoElement.readyState >= 2) {
              await faceDetection.send({ image: videoElement })
              lastFrameTime = now
            }
          } catch (e) {
            console.warn('Face detection error (skipping frame):', e)
          }
        }

        if (isDetecting.value) {
          animationFrameId = requestAnimationFrame(processFrame)
        }
      }

      processFrame()
    } catch (err) {
      error.value = 'Failed to start face detection'
      console.error('Detection start error:', err)
      isDetecting.value = false
      throw err
    }
  }

  const stopDetection = () => {
    isDetecting.value = false
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  const cleanup = () => {
    stopDetection()
    if (faceDetection) {
      faceDetection.close()
      faceDetection = null
    }
    isInitialized.value = false
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    isInitialized: readonly(isInitialized),
    isDetecting: readonly(isDetecting),
    lastDetectionResult: readonly(lastDetectionResult),
    error: readonly(error),
    initialize,
    startDetection,
    stopDetection,
    cleanup,
  }
}
