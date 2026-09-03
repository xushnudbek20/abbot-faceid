<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isFrameValid: boolean
  faceDistance: 'too-close' | 'too-far' | 'good' | 'none'
}>()

const statusColor = computed(() => {
  if (props.faceDistance === 'good' && props.isFrameValid) {
    return '#00DC82' // primary green
  }
  if (props.faceDistance === 'too-close' || props.faceDistance === 'too-far') {
    return '#EAB308' // warning yellow
  }
  return '#94A3B8' // gray
})

const statusShadow = computed(() => {
  return `0 0 20px ${statusColor.value}44, inset 0 0 20px ${statusColor.value}22`
})
</script>

<template>
  <div class="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
    <div
      class="relative w-full max-w-[400px] aspect-[3/4] rounded-[4rem] transition-all duration-500 ease-out"
      :style="{
        border: `3px dashed ${statusColor}`,
        boxShadow: statusShadow,
        backgroundColor: `${statusColor}08`,
      }"
    >
      <!-- Corner Accents -->
      <div
        class="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 rounded-tl-[4rem] transition-colors duration-500"
        :style="{ borderColor: statusColor }"
      />
      <div
        class="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 rounded-tr-[4rem] transition-colors duration-500"
        :style="{ borderColor: statusColor }"
      />
      <div
        class="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 rounded-bl-[4rem] transition-colors duration-500"
        :style="{ borderColor: statusColor }"
      />
      <div
        class="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 rounded-br-[4rem] transition-colors duration-500"
        :style="{ borderColor: statusColor }"
      />

      <!-- Scanning Line Animation -->
      <div
        v-if="faceDistance === 'good' && isFrameValid"
        class="absolute inset-x-4 top-0 h-1 bg-gradient-to-r from-transparent via-[#00DC82] to-transparent animate-scan z-10 opacity-50"
      />

      <!-- Body position guide: distance correct but position is wrong -->
      <svg
        v-if="faceDistance === 'good' && !isFrameValid"
        viewBox="0 0 100 133"
        class="absolute inset-0 w-full h-full pointer-events-none"
        fill="none"
        :stroke="statusColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="opacity: 0.35;"
      >
        <!-- Head oval -->
        <ellipse cx="50" cy="21" rx="14" ry="17" stroke-width="2" stroke-dasharray="5 3" />
        <!-- Neck -->
        <line x1="43" y1="37" x2="41" y2="46" stroke-width="2" />
        <line x1="57" y1="37" x2="59" y2="46" stroke-width="2" />
        <!-- Shoulders -->
        <path d="M 10,60 C 20,51 34,46 41,46 L 59,46 C 66,46 80,51 90,60" stroke-width="2" stroke-dasharray="5 3" />
        <!-- Body sides -->
        <line x1="10" y1="60" x2="13" y2="100" stroke-width="2" />
        <line x1="90" y1="60" x2="87" y2="100" stroke-width="2" />
        <!-- Body bottom -->
        <line x1="13" y1="100" x2="87" y2="100" stroke-width="2" stroke-dasharray="5 3" />
      </svg>

      <!-- Position label inside overlay -->
      <div
        v-if="faceDistance === 'good' && !isFrameValid"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
        :style="{ color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}44` }"
      >
        Ideal holat
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scan {
  0% { top: 10%; opacity: 0; }
  50% { opacity: 0.8; }
  100% { top: 90%; opacity: 0; }
}

.animate-scan {
  animation: scan 2s linear infinite;
}
</style>
