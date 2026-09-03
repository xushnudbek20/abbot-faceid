import { ref } from 'vue'

const TOKEN_KEY = 'faceid_access_token'
const USER_KEY = 'faceid_user'

export interface AuthUser {
  id: number
  name: string
  login?: string
  photo_url?: string | null
  on_work_status?: number
  location_id?: number | null
  role?: { name?: string, display_name?: string } | null
  [key: string]: unknown
}

export const accessToken = ref<string | null>(localStorage.getItem(TOKEN_KEY))
export const authUser = ref<AuthUser | null>(readUser())

function readUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function setAuth(token: string, user: AuthUser) {
  accessToken.value = token
  authUser.value = user
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  accessToken.value = null
  authUser.value = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated() {
  return !!accessToken.value
}
