<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { $api } from '@/api'
import { useCamera } from '@/composables/useCamera'
import { useMediaPipe } from '@/composables/useMediaPipe'
import { useLivenessDetection } from '@/composables/useLivenessDetection'
import { captureImageFromVideo, compressImage, blobToDataURL } from '@/utils/imageProcessing'
import FaceOverlay from '@/components/FaceOverlay.vue'
import LivenessInstructions from '@/components/LivenessInstructions.vue'

interface Props {
  type: 'in' | 'out'
  comment?: string
  // xpert-api /hr/in-outs `warehouse_id` (ixtiyoriy) kutadi
  warehouseId?: number
  // Geofence tekshiruvi uchun foydalanuvchining joriy koordinatasi (backendga yuboriladi)
  latitude?: number | null
  longitude?: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  complete: [result: any]
  error: [error: string]
}>()

const videoRef = ref<HTMLVideoElement>()
const capturedImageUrl = ref<string>('')
const isUploading = ref(false)
const uploadError = ref<string>('')
const commentInput = ref<string>(props.comment || '')

const camera = useCamera()
const mediaPipe = useMediaPipe()
const liveness = useLivenessDetection()

const showPreview = ref(false)

let detectionInterval: number | null = null
let modelWatchdog: number | null = null

const MODEL_LOAD_TIMEOUT_MS = 15000
const VIDEO_READY_TIMEOUT_MS = 4000

const clearTimers = () => {
  if (detectionInterval) {
    clearInterval(detectionInterval)
    detectionInterval = null
  }
  if (modelWatchdog) {
    clearTimeout(modelWatchdog)
    modelWatchdog = null
  }
}

// iOS WebView'da MediaStream uchun `loadedmetadata` fire bo'lmasligi mumkin,
// shuning uchun bir nechta hodisani kuzatamiz va timeout bilan chegaralaymiz.
const waitForVideoReady = (video: HTMLVideoElement) => {
  return new Promise<void>((resolve) => {
    if (video.readyState >= 1) {
      resolve()
      return
    }

    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'playing']
    let settled = false

    const finish = () => {
      if (settled)
        return
      settled = true
      clearTimeout(timer)
      events.forEach(name => video.removeEventListener(name, finish))
      resolve()
    }

    const timer = window.setTimeout(finish, VIDEO_READY_TIMEOUT_MS)
    events.forEach(name => video.addEventListener(name, finish))
  })
}

// Model CDN'dan yuklanmasa `send()` har kadrda jimgina xato beradi —
// foydalanuvchi muzlab qolgan ekran o'rniga tushunarli xabar ko'rsin.
const startModelWatchdog = () => {
  if (modelWatchdog)
    clearTimeout(modelWatchdog)

  modelWatchdog = window.setTimeout(() => {
    modelWatchdog = null
    if (!mediaPipe.lastDetectionResult.value) {
      emit('error', 'Yuz aniqlash moduli yuklanmadi. Internet aloqasini tekshirib, qayta urinib ko\'ring.')
    }
  }, MODEL_LOAD_TIMEOUT_MS)
}

const runDetectionLoop = () => {
  detectionInterval = window.setInterval(() => {
    if (mediaPipe.lastDetectionResult.value && videoRef.value) {
      if (modelWatchdog) {
        clearTimeout(modelWatchdog)
        modelWatchdog = null
      }

      liveness.processDetection(
        mediaPipe.lastDetectionResult.value,
        videoRef.value.videoWidth,
        videoRef.value.videoHeight,
      )

      if (liveness.phase.value === 'capturing' && liveness.state.isLivenessCheckPassed) {
        handleCapture()
      }
    }
  }, 100)
}

const initializeCamera = async () => {
  try {
    const stream = await camera.startCamera()

    if (!videoRef.value || !stream) {
      throw new Error('Kamera oqimini ishga tushirib bo\'lmadi')
    }

    const videoEl = videoRef.value
    videoEl.srcObject = stream

    await waitForVideoReady(videoEl)
    await videoEl.play().catch(e => console.warn('Play error:', e))

    await mediaPipe.initialize()
    await mediaPipe.startDetection(videoEl)

    liveness.startDetection()
    startModelWatchdog()
    runDetectionLoop()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to initialize camera'
    emit('error', errorMessage)
  }
}

const handleCapture = async () => {
  if (!videoRef.value)
    return

  clearTimers()

  try {
    const imageBlob = await captureImageFromVideo(videoRef.value)
    const compressedBlob = await compressImage(imageBlob)
    const dataUrl = await blobToDataURL(compressedBlob)

    capturedImageUrl.value = dataUrl
    showPreview.value = true

    mediaPipe.stopDetection()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to capture image'
    emit('error', errorMessage)
  }
}

const handleConfirm = async () => {
  if (!capturedImageUrl.value)
    return

  isUploading.value = true
  uploadError.value = ''

  try {
    const blob = await fetch(capturedImageUrl.value).then(r => r.blob())

    const formData = new FormData()
    formData.append('type', props.type)
    formData.append('photo', blob, 'photo.jpg')

    if (commentInput.value) {
      formData.append('comment', commentInput.value)
    }
    if (props.warehouseId) {
      formData.append('warehouse_id', String(props.warehouseId))
    }
    // Geofence: backend masofani shu koordinata bo'yicha tekshiradi.
    if (props.latitude != null && props.longitude != null) {
      formData.append('latitude', String(props.latitude))
      formData.append('longitude', String(props.longitude))
    }

    const data = await $api('/hr/in-outs', {
      method: 'POST',
      body: formData,
    })

    if (data) {
      emit('complete', data)
    }
  } catch (err: any) {
    let errorMessage = err.message || 'Failed to upload image'
    const data = err.data || err.response?._data

    if (data) {
      if (data.errors) {
        const firstError = Object.values(data.errors)[0]
        if (Array.isArray(firstError) && firstError.length > 0) {
          errorMessage = String(firstError[0])
        } else if (data.message) {
          errorMessage = data.message
        }
      } else if (data.message) {
        errorMessage = data.message
      }
    }

    uploadError.value = errorMessage
    emit('error', errorMessage)
  } finally {
    isUploading.value = false
  }
}

const handleRetry = () => {
  capturedImageUrl.value = ''
  showPreview.value = false
  uploadError.value = ''
  liveness.resetChecks()

  if (videoRef.value && camera.videoStream.value) {
    mediaPipe.startDetection(videoRef.value)
    liveness.startDetection()
    startModelWatchdog()
    runDetectionLoop()
  }
}

onMounted(() => {
  initializeCamera()
})

onUnmounted(() => {
  clearTimers()
  mediaPipe.cleanup()
  camera.stopCamera()
})
</script>

<template>
  <div class="relative w-full aspect-[4/5] sm:aspect-video bg-black/40 overflow-hidden">
    <!-- Camera Loading -->
    <div v-if="camera.isLoading.value" class="absolute inset-0 flex items-center justify-center bg-[#0A0C10] z-50">
      <div class="flex flex-col items-center gap-4">
        <div class="h-12 w-12 border-4 border-[#00DC82]/20 border-t-[#00DC82] rounded-full animate-spin" />
        <p class="text-white text-sm font-medium animate-pulse">
          Kamera tayyorlanmoqda...
        </p>
      </div>
    </div>

    <!-- Camera Error -->
    <div v-if="camera.error.value" class="absolute inset-0 flex items-center justify-center bg-[#0A0C10] z-50 p-6 text-center">
      <div class="flex flex-col items-center gap-4 max-w-sm">
        <div class="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6">
            <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p class="text-white text-lg font-bold">Kamera xatoligi</p>
        <p class="text-gray-400 text-sm">
          {{ camera.error.value }}
        </p>
        <button
          class="rounded-xl px-6 py-2.5 bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
          @click="initializeCamera"
        >
          Qayta urinish
        </button>
      </div>
    </div>

    <video
      ref="videoRef"
      class="w-full h-full object-cover scale-x-[-1]"
      :class="{ hidden: showPreview }"
      autoplay
      playsinline
      muted
    />

    <FaceOverlay
      v-if="!showPreview"
      :is-frame-valid="liveness.state.isFrameValid"
      :face-distance="liveness.state.faceDistance"
    />

    <LivenessInstructions
      v-if="!showPreview"
      :state="liveness.state"
    />

    <div v-if="showPreview" class="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 z-40">
      <div class="relative w-full h-full flex flex-col items-center gap-4">
        <!-- Image area -->
        <div class="relative flex-1 min-h-0 flex items-center justify-center w-full">
          <img
            :src="capturedImageUrl"
            alt="Captured preview"
            class="rounded-3xl shadow-2xl max-w-full max-h-full object-contain border border-white/10"
          >
          <div class="absolute -bottom-3 -right-3 h-10 w-10 bg-[#00DC82] rounded-2xl flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0A0C10" stroke-width="3" class="w-6 h-6">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <!-- Controls -->
        <div class="w-full max-w-sm space-y-3 flex-shrink-0">
          <input
            v-model="commentInput"
            class="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-600 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#00DC82]/50 transition-all"
            placeholder="Izoh qoldiring (ixtiyoriy)"
          >

          <div class="flex gap-4">
            <button
              class="flex-1 rounded-xl py-4 font-bold bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
              :disabled="isUploading"
              @click="handleRetry"
            >
              QAYTA
            </button>
            <button
              class="flex-1 bg-[#00DC82] text-[#0A0C10] hover:bg-[#00C16A] rounded-xl py-4 font-bold transition-colors disabled:opacity-60"
              :disabled="isUploading"
              @click="handleConfirm"
            >
              {{ isUploading ? 'YUBORILMOQDA...' : 'YUBORISH' }}
            </button>
          </div>

          <div v-if="uploadError" class="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-xs font-medium">
            {{ uploadError }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleIn {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
