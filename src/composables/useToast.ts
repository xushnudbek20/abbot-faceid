import { ref } from 'vue'

export interface ToastItem {
  id: number
  title?: string
  description?: string
  color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  duration?: number
}

export const toasts = ref<ToastItem[]>([])

let seq = 0

// Nuxt UI `useToast()` bilan mos: toast.add({ title, description, color })
export function useToast() {
  const add = (t: Omit<ToastItem, 'id'>) => {
    const id = ++seq
    toasts.value.push({ id, duration: 4000, color: 'primary', ...t })
    const dur = t.duration ?? 4000
    if (dur > 0) {
      window.setTimeout(() => remove(id), dur)
    }
    return id
  }

  const remove = (id: number) => {
    toasts.value = toasts.value.filter(x => x.id !== id)
  }

  return { add, remove }
}
