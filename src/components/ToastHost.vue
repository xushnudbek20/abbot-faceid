<script setup lang="ts">
import { toasts, useToast } from '@/composables/useToast'

const { remove } = useToast()

const colorClass = (c?: string) => {
  switch (c) {
    case 'success': return 'border-l-[#00C16A]'
    case 'error': return 'border-l-rose-500'
    case 'warning': return 'border-l-amber-500'
    default: return 'border-l-[#4E5BE4]'
  }
}
</script>

<template>
  <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="pointer-events-auto rounded-xl border-l-4 px-4 py-3 shadow-lg ds-fade-in flex items-start gap-3"
      :class="colorClass(t.color)"
      style="background: var(--ds-surface-container-lowest);"
    >
      <div class="flex-1 min-w-0">
        <p v-if="t.title" class="text-sm font-bold" style="color: var(--ds-on-surface);">{{ t.title }}</p>
        <p v-if="t.description" class="text-xs mt-0.5" style="color: var(--ds-secondary);">{{ t.description }}</p>
      </div>
      <button
        class="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        style="color: var(--ds-secondary);"
        @click="remove(t.id)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </div>
</template>
