import { ofetch } from 'ofetch'
import { accessToken, clearAuth } from '@/auth'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://api.abbot.uz/api/v1'

export const storageUrl = import.meta.env.VITE_STORAGE_URL || 'https://api.abbot.uz'

export const $api = ofetch.create({
  baseURL,
  onRequest({ options }) {
    if (accessToken.value) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${accessToken.value}`,
      }
    }
  },
  onResponseError({ response }) {
    if (response.status === 401) {
      clearAuth()
    }
  },
})

export function getPhotoUrl(photoUrl?: string | null): string {
  if (!photoUrl) return ''
  if (photoUrl.startsWith('http')) return photoUrl
  return `${storageUrl}/storage/${photoUrl}`
}
