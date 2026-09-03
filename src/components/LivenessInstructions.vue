<script setup lang="ts">
import { computed } from 'vue'
import type { LivenessState } from '@/types/liveness'

const props = defineProps<{
  state: LivenessState
}>()

const statusColor = computed(() => {
  if (props.state.isLivenessCheckPassed) {
    return 'text-green-400'
  }
  if (props.state.faceDistance === 'too-close' || props.state.faceDistance === 'too-far') {
    return 'text-yellow-400'
  }
  if (!props.state.isFaceDetected) {
    return 'text-red-400'
  }
  return 'text-blue-400'
})
</script>

<template>
  <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-md w-full px-4">
    <div class="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 text-center">
      <p :class="['text-lg font-semibold transition-colors', statusColor]">
        {{ state.currentInstruction }}
      </p>
    </div>
  </div>
</template>
