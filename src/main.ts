import { createApp } from 'vue'
import App from '@/App.vue'
import UIcon from '@/components/UIcon.vue'
import '@/style.css'
// Tailwinddan keyin yuklanadi — `.ds-*` klasslari utility'lardan ustun bo'lsin (VisionHR kabi)
import '@/assets/design-system.css'

const app = createApp(App)

// Nuxt UI'dagi kabi global `<UIcon name="i-lucide-..." />`
app.component('UIcon', UIcon)

app.mount('#app')
