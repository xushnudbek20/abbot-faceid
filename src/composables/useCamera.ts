import { onUnmounted, readonly, ref } from 'vue'
import type { CameraConfig } from '@/types/liveness'
import { cameraConfig } from '@/config/liveness'

export function useCamera(config: CameraConfig = cameraConfig) {
  const videoStream = ref<MediaStream | null>(null)
  const isPermissionGranted = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const startCamera = async () => {
    isLoading.value = true
    error.value = null

    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

      // Prefer reasonable ideals but don't force exact aspect ratio on mobile
      // forcing exact sizes/aspect ratios can trigger digital zoom on some devices.
      const videoConstraints: MediaTrackConstraints = {
        facingMode: config.facingMode,
        width: { ideal: isMobile ? 1280 : 1280 },
        height: { ideal: isMobile ? 720 : 960 },
        // avoid setting aspectRatio on mobile; let the device choose a native preview
      }

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: false,
      }

      let stream: MediaStream | null = null

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err: any) {
        if (err.name === 'NotReadableError' || err.name === 'OverconstrainedError') {
          // Fallback to basic constraints if high quality/specific resolution fails
          const fallbackConstraints: MediaStreamConstraints = {
            video: {
              facingMode: config.facingMode,
            },
            audio: false,
          }
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints)
        } else {
          throw err
        }
      }

      videoStream.value = stream
      isPermissionGranted.value = true

      // Try to set camera zoom to 1 (if supported) to avoid immediate digital zoom
      try {
        const [track] = stream.getVideoTracks()
        if (track && typeof track.applyConstraints === 'function') {
          // @ts-expect-error - some browsers expose `zoom` in advanced constraints but TS lib may not.
          await track.applyConstraints({ advanced: [{ zoom: 1 }] })
        }
      } catch {
        // Non-fatal: ignore failures (many devices won't support zoom/applyConstraints)
      }

      return stream
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera'
      error.value = errorMessage

      if (errorMessage.includes('Permission denied') || err.name === 'NotAllowedError') {
        error.value = 'Camera permission denied. Please allow camera access and reload the page.'
      } else if (errorMessage.includes('not found') || err.name === 'NotFoundError') {
        error.value = 'No camera found on this device.'
      } else if (err.name === 'NotReadableError') {
        error.value = 'Camera is in use or not readable. Please close other camera apps.'
      } else {
        error.value = `Failed to start camera: ${errorMessage}`
      }

      throw new Error(error.value)
    } finally {
      isLoading.value = false
    }
  }

  const stopCamera = () => {
    if (videoStream.value) {
      videoStream.value.getTracks().forEach(track => track.stop())
      videoStream.value = null
      isPermissionGranted.value = false
    }
  }

  onUnmounted(() => {
    stopCamera()
  })

  return {
    videoStream: readonly(videoStream),
    isPermissionGranted: readonly(isPermissionGranted),
    isLoading: readonly(isLoading),
    error: readonly(error),
    startCamera,
    stopCamera,
  }
}
