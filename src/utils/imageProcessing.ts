import { captureConfig } from '@/config/liveness'

export async function captureImageFromVideo(videoElement: HTMLVideoElement): Promise<Blob> {
  const vw = videoElement.videoWidth
  const vh = videoElement.videoHeight

  // Determine if the video element is visually mirrored (CSS scaleX(-1))
  const computedStyle = window.getComputedStyle(videoElement)
  const transform = computedStyle.getPropertyValue('transform') || ''
  const isMirrored = ((transform.includes('matrix') && transform.includes('-1')) || computedStyle.getPropertyValue('scale') === '-1' || videoElement.classList.contains('mirror'))

  const canvas = document.createElement('canvas')
  canvas.width = vw
  canvas.height = vh

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.save()

  if (isMirrored) {
    ctx.scale(-1, 1)
    ctx.drawImage(videoElement, -vw, 0, vw, vh)
  } else {
    ctx.drawImage(videoElement, 0, 0, vw, vh)
  }

  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to create blob from canvas'))
      }
    }, captureConfig.format, captureConfig.imageQuality)
  })
}

export async function compressImage(blob: Blob, maxSizeKB: number = captureConfig.maxSizeKB): Promise<Blob> {
  if (blob.size / 1024 <= maxSizeKB) {
    return blob
  }

  const img = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(img, 0, 0)

  let quality = captureConfig.imageQuality
  let compressedBlob: Blob | null = null

  while (quality > 0.1) {
    compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, captureConfig.format, quality)
    })

    if (compressedBlob && compressedBlob.size / 1024 <= maxSizeKB) {
      return compressedBlob
    }

    quality -= 0.1
  }

  return compressedBlob || blob
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert blob to data URL'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function dataURLToBlob(dataURL: string): Blob {
  const arr = dataURL.split(',')
  if (arr.length < 2) {
    throw new Error('Invalid data URL')
  }
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : 'image/jpeg'
  const dataPart = arr[1]
  if (typeof dataPart === 'undefined') {
    throw new Error('Invalid data URL')
  }
  const bstr = atob(dataPart)
  let n = bstr.length
  const u8arr = new Uint8Array(n)

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }

  return new Blob([u8arr], { type: mime })
}
