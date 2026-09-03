<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

// Nuxt UI uslubidagi `name="i-lucide-user"` ni Iconify `lucide:user` ga o'giradi.
const props = defineProps<{ name: string }>()

const iconName = computed(() => {
  const raw = props.name.replace(/^i-/, '')
  const idx = raw.indexOf('-')
  if (idx === -1) return raw
  return `${raw.slice(0, idx)}:${raw.slice(idx + 1)}`
})
</script>

<template>
  <Icon :icon="iconName" />
</template>
