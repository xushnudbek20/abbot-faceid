<script setup lang="ts">
import { reactive, ref } from 'vue'
import { $api } from '@/api'
import { setAuth, type AuthUser } from '@/auth'
import { useToast } from '@/composables/useToast'
import logoImg from '@/assets/images/logo.png'

const toast = useToast()
const loading = ref(false)
const showPassword = ref(false)

const state = reactive({
  login: '',
  password: '',
})

async function onSubmit() {
  if (state.login.trim().length < 2) {
    toast.add({ title: 'Xatolik', description: 'Login kamida 2 ta belgi', color: 'error' })
    return
  }
  if (state.password.length < 4) {
    toast.add({ title: 'Xatolik', description: 'Parol kamida 4 ta belgi', color: 'error' })
    return
  }

  loading.value = true
  try {
    const res: any = await $api('/auth/login', {
      method: 'POST',
      body: { login: state.login, password: state.password },
    })

    if (res?.success === false) {
      toast.add({ title: 'Xatolik', description: res.message, color: 'error' })
      return
    }

    const token = res?.data?.access_token ?? res?.data?.token
    const user: AuthUser = res?.data?.user
    if (!token) {
      throw new Error('Token olinmadi')
    }
    setAuth(token, user)
  } catch (err: any) {
    const message = err.response?._data?.message || err.data?.message || err.message || 'Tizimda xatolik yuz berdi'
    toast.add({ title: 'Xatolik', description: message, color: 'error' })
  } finally {
    loading.value = false
  }
}

const onHelpClick = () => {
  window.open('https://t.me/abbot_support', '_blank')
}
</script>

<template>
  <div class="fixed inset-0 flex h-screen w-screen overflow-hidden font-sans">
    <!-- Left Side: Branding Panel (Desktop only) -->
    <div class="login-brand-panel relative hidden w-1/2 flex-col items-center justify-center lg:flex overflow-hidden">
      <!-- Decorative Elements -->
      <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-full opacity-[0.04]" style="background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 40px 40px;" />
        <div class="absolute -top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full blur-[120px]" style="background: rgba(99, 102, 241, 0.2);" />
        <div class="absolute -bottom-[15%] -left-[15%] w-[50%] h-[50%] rounded-full blur-[100px]" style="background: rgba(78, 91, 228, 0.15);" />
        <!-- Floating geometric shapes -->
        <div class="absolute top-[15%] left-[10%] w-20 h-20 rounded-2xl rotate-12 animate-float-slow" style="border: 1px solid rgba(255,255,255,0.08);" />
        <div class="absolute bottom-[20%] right-[15%] w-14 h-14 rounded-full animate-float-reverse" style="border: 1px solid rgba(255,255,255,0.08);" />
        <div class="absolute top-[60%] left-[20%] w-10 h-10 rounded-lg rotate-45 animate-float-slow" style="border: 1px solid rgba(255,255,255,0.05);" />
      </div>

      <!-- Center Content -->
      <div class="relative z-10 flex flex-col items-center text-center px-12 animate-fade-in-up">
        <!-- Logo -->
        <div class="mb-8 relative">
          <div class="absolute inset-0 rounded-full scale-150 blur-[60px]" style="background: rgba(99, 102, 241, 0.3);" />
          <img
            :src="logoImg"
            alt="Abbot Logo"
            class="relative h-36 w-auto object-contain drop-shadow-[0_0_40px_rgba(78,91,228,0.4)]"
          >
        </div>

        <!-- Tagline -->
        <h1 class="login-tagline">
          ABBOT
          <br>
          Zamonaviy
          <span class="login-tagline-accent">boshqaruv tizimi</span>
        </h1>
        <p class="max-w-sm text-base leading-relaxed" style="color: rgba(255,255,255,0.6);">
          Xodimlarni boshqarish, davomatni kuzatish va kompaniya samaradorligini oshirish — barchasi bir joyda.
        </p>

        <!-- Feature Pills -->
        <div class="flex flex-wrap justify-center gap-3 mt-10">
          <div class="login-pill">
            <UIcon name="i-lucide-scan-face" class="w-3.5 h-3.5" style="color: #E0E7FF;" />
            Face ID orqali davomat
          </div>
          <div class="login-pill">
            <UIcon name="i-lucide-bar-chart-3" class="w-3.5 h-3.5" style="color: #E0E7FF;" />
            Real-time statistika
          </div>
          <div class="login-pill">
            <UIcon name="i-lucide-map-pin" class="w-3.5 h-3.5" style="color: #E0E7FF;" />
            Lokatsiya nazorati
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="absolute bottom-8 left-0 right-0 text-center text-[11px] font-medium tracking-widest uppercase" style="color: rgba(255,255,255,0.3);">
        &copy; {{ new Date().getFullYear() }} Abbot &middot; Barchasi nazorat ostida
      </div>
    </div>

    <!-- Right Side: Login Form -->
    <div class="login-form-panel relative w-full flex items-center justify-center p-6 lg:w-1/2">
      <!-- Subtle background glow -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 rounded-full blur-[120px]" style="background: rgba(78, 91, 228, 0.06);" />
      </div>

      <div class="relative z-10 w-full max-w-100 space-y-8 animate-fade-in">
        <!-- Mobile Logo -->
        <div class="flex flex-col items-center lg:hidden mb-4">
          <img
            :src="logoImg"
            alt="Abbot Logo"
            class="h-20 w-auto object-contain mb-4"
          >
        </div>

        <!-- Header -->
        <div class="text-center lg:text-left space-y-2">
          <h2 class="login-heading">
            Tizimga kirish
          </h2>
          <p class="ds-body-md">
            Login va parolingizni kiriting
          </p>
        </div>

        <!-- Login Form -->
        <form class="space-y-5" @submit.prevent="onSubmit">
          <div class="space-y-1.5">
            <label class="login-field-label">Login</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center" style="color: var(--ds-secondary);">
                <UIcon name="i-lucide-user" />
              </span>
              <input
                v-model="state.login"
                placeholder="Login yoki email"
                class="login-input"
                style="background: var(--ds-surface-container-high); color: var(--ds-on-surface);"
              >
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="login-field-label">Parol</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center" style="color: var(--ds-secondary);">
                <UIcon name="i-lucide-lock" />
              </span>
              <input
                v-model="state.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                class="login-input"
                style="background: var(--ds-surface-container-high); color: var(--ds-on-surface);"
              >
              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 transition-opacity opacity-50 hover:opacity-100"
                :title="showPassword ? 'Yashirish' : 'Ko\'rsatish'"
                @click="showPassword = !showPassword"
              >
                <UIcon
                  :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  class="w-4 h-4"
                  style="color: var(--ds-secondary);"
                />
              </button>
            </div>
          </div>

          <!-- Forgot password -->
          <div class="flex justify-end">
            <span class="ds-btn-tertiary text-xs cursor-pointer">
              Parolni unutdingizmi?
            </span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="login-submit-btn w-full flex items-center justify-center group"
            :disabled="loading"
          >
            {{ loading ? 'Kirilmoqda...' : 'Kirish' }}
            <UIcon name="i-lucide-arrow-right" class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <!-- Divider -->
        <div class="flex items-center gap-4 pt-2">
          <div class="flex-1 h-px" style="background: var(--ds-surface-container-high);" />
          <span class="ds-label-xs" style="color: var(--ds-secondary);">yoki</span>
          <div class="flex-1 h-px" style="background: var(--ds-surface-container-high);" />
        </div>

        <!-- Help link -->
        <div class="text-center">
          <p class="ds-body-sm">
            Muammo bormi?
            <span class="cursor-pointer font-semibold transition-colors" style="color: var(--ds-primary);" @click="onHelpClick">Yordam olish</span>
          </p>
        </div>

        <!-- Mobile footer -->
        <div class="text-center lg:hidden pt-6">
          <p class="text-[11px] tracking-wider" style="color: var(--ds-secondary);">
            &copy; {{ new Date().getFullYear() }} Abbot
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Brand Panel — Abbot Indigo gradient ──────────────────────── */
.login-brand-panel {
  background: linear-gradient(135deg, #3730A3 0%, #4E5BE4 50%, #6366F1 100%);
}

.login-tagline {
  font-family: 'Manrope', sans-serif;
  font-size: 3rem;
  font-weight: 800;
  color: white;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin-bottom: 1.5rem;
}

.login-tagline-accent {
  background: linear-gradient(90deg, #E0E7FF, #A5B4FC);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.75);
}

/* ── Form Panel ───────────────────────────────────────────────── */
.login-form-panel {
  background: var(--ds-surface);
}

.login-heading {
  font-family: 'Manrope', sans-serif;
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: var(--ds-on-surface);
}

.login-field-label {
  display: block;
  font-family: 'Inter', sans-serif;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ds-secondary);
  margin-bottom: 0.375rem;
}

.login-input {
  width: 100%;
  padding: 0.875rem 3rem 0.875rem 2.75rem;
  border: none;
  border-radius: 0.75rem;
  outline: none;
  font-size: 1rem;
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.login-input::placeholder {
  color: var(--ds-outline-variant);
}

.login-input:focus {
  background: var(--ds-surface-container-lowest) !important;
  box-shadow: 0 0 0 3px rgba(78, 91, 228, 0.15) !important;
}

.login-submit-btn {
  background: var(--ds-gradient-primary);
  color: white;
  padding: 1rem;
  border-radius: var(--ds-radius-md);
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.01em;
  border: none;
  box-shadow: 0 8px 30px rgba(78, 91, 228, 0.25);
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.login-submit-btn:hover {
  box-shadow: 0 12px 40px rgba(78, 91, 228, 0.35);
  transform: translateY(-1px);
}

.login-submit-btn:active {
  transform: scale(0.98);
}

.login-submit-btn:disabled {
  opacity: 0.7;
  cursor: default;
  transform: none;
}

/* ── Animations ───────────────────────────────────────────────── */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes floatSlow {
  0%, 100% { transform: translateY(0) rotate(12deg); }
  50% { transform: translateY(-20px) rotate(12deg); }
}

@keyframes floatReverse {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(15px); }
}

.animate-fade-in-up {
  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.animate-fade-in {
  animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
}

.animate-float-slow {
  animation: floatSlow 6s ease-in-out infinite;
}

.animate-float-reverse {
  animation: floatReverse 5s ease-in-out infinite;
}
</style>
