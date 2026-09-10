<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { $api, getPhotoUrl } from '@/api'
import { clearAuth } from '@/auth'
import { useToast } from '@/composables/useToast'
import LivenessCamera from '@/components/LivenessCamera.vue'
import logoImg from '@/assets/images/logo.png'

const emit = defineEmits(['open-schedule', 'open-salary'])

const showResult = ref(false)
const modalOpen = ref(false)
const result = ref<any>(null)
const activeLocationId = ref<number | null>(null)
// Foydalanuvchining geo-tekshiruvda aniqlangan koordinatasi — backendga yuborish uchun.
const userLat = ref<number | null>(null)
const userLon = ref<number | null>(null)
const toast = useToast()

// For photo modal
const isPhotoModalOpen = ref(false)
const selectedPhotoUrl = ref('')

function openPhotoModal(photoUrl: string) {
  selectedPhotoUrl.value = getPhotoUrl(photoUrl)
  isPhotoModalOpen.value = true
}

// xpert-api: xodim (Finance\Employee) User'dan alohida.
// Mavjud endpointlar orqali: /auth/me → finance_employee_id → /finance/employees/{id}
const meUser = ref<any>(null)
const employee = ref<any>(null)
const todayWorkDay = ref<any>(null)
const inOutsData = ref<any>(null)

const employeeId = computed(() => employee.value?.id ?? meUser.value?.finance_employee_id ?? null)

const userInfo = computed<any>(() => {
  if (!employee.value && !meUser.value) return null
  const emp = employee.value || {}
  return {
    ...emp,
    name: emp.name || meUser.value?.name,
    role: meUser.value?.role,
    on_work_status: emp.on_work_status ?? 0,
    photo_url: emp.photo_url,
    location_id: emp.locations?.[0]?.id ?? null,
  }
})

const userShowInfo = computed<any>(() => {
  const emp = employee.value
  if (!emp) return null
  return {
    ...emp,
    employee_schedule: emp.employee_schedule,
    locations: emp.locations || [],
    location: emp.locations?.[0] || null,
    today_work_day: todayWorkDay.value ? [todayWorkDay.value] : [],
  }
})

const refreshInfo = async () => {
  try {
    const meRes: any = await $api('/auth/me')
    meUser.value = meRes?.data ?? null

    const empId = meUser.value?.finance_employee_id
    if (!empId) {
      employee.value = null
      return
    }

    const empRes: any = await $api(`/finance/employees/${empId}`, {
      query: { relations: 'employeeSchedule|locations', appends: 'today_first_income' },
    })
    employee.value = empRes?.data ?? null

    // Bugungi ish kuni turi (dam olish / bayram) — auth-only self-service endpointdan.
    try {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const todayStr = `${month}-${String(now.getDate()).padStart(2, '0')}`
      const wdRes: any = await $api('/hr/my-work-days/grid', { query: { month } })
      const rows = wdRes?.data?.data ?? wdRes?.data ?? []
      const myRow = rows.find((e: any) => e.id === empId)
      todayWorkDay.value = myRow?.days?.find((d: any) => String(d.date).slice(0, 10) === todayStr) ?? null
    } catch {
      todayWorkDay.value = null
    }
  } catch (err) {
    console.error(err)
  }
}

function formatDateISO(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getSmartDateRange() {
  const schedule = userShowInfo.value?.employee_schedule
  const now = new Date()
  const todayStr = formatDateISO(now)

  if (schedule?.is_night_shift && schedule.start_time) {
    const [h, m] = schedule.start_time.split(':').map(Number)
    const startMins = (h ?? 0) * 60 + (m ?? 0)
    const nowMins = now.getHours() * 60 + now.getMinutes()

    // 4 soatlik bufer bilan smena boshlanishini kutamiz.
    if (nowMins < (startMins - 240)) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return { from: formatDateISO(yesterday), to: todayStr }
    }
  }

  return { from: todayStr, to: todayStr }
}

const inOutFromDate = ref('')
const inOutToDate = ref('')

const refreshStats = async () => {
  if (!employeeId.value) return
  try {
    const res: any = await $api('/hr/in-outs', {
      query: {
        employee_id: employeeId.value,
        from_date: inOutFromDate.value,
        to_date: inOutToDate.value,
      },
    })
    inOutsData.value = res
  } catch (err) {
    console.error(err)
  }
}

const logOut = () => clearAuth()

const todayStats = computed(() => {
  const list = inOutsData.value?.data?.data || []
  if (!list.length) return { first: null, last: null }

  const sorted = [...list].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const first = sorted.find((i: any) => i.type === 'in')
  const last = [...sorted].reverse().find((i: any) => i.type === 'out')

  return { first, last }
})

const isPastEndTime = computed(() => {
  const schedule = userShowInfo.value?.employee_schedule
  const endTime = schedule?.end_time
  const startTime = schedule?.start_time
  if (!endTime) return false

  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const [endH, endM] = endTime.split(':').map(Number)
  const endMins = (endH ?? 0) * 60 + (endM ?? 0)

  if (schedule?.is_night_shift && startTime) {
    const [startH, startM] = startTime.split(':').map(Number)
    const startMins = (startH ?? 0) * 60 + (startM ?? 0)
    return nowMins > endMins && nowMins < startMins
  }

  const endDateTime = new Date()
  endDateTime.setHours(endH ?? 0, endM ?? 0, 0, 0)
  return now > endDateTime
})

const todayWorkStatus = computed(() => {
  const twd = userShowInfo.value?.today_work_day?.[0]
  if (twd && (twd.type === 'off' || twd.type === 'holiday')) {
    return {
      isOff: true,
      message: twd.type === 'off' ? 'Bugun dam olish kuni' : 'Bugun bayram',
      color: twd.type === 'off' ? 'sky' : 'primary' as const,
    }
  }
  return { isOff: false, message: '', color: 'neutral' as const }
})

const workStartStatus = computed(() => {
  if (todayWorkStatus.value.isOff) return null
  const startTime = userShowInfo.value?.employee_schedule?.start_time
  if (!startTime || userInfo.value?.on_work_status === 1 || todayStats.value.first) return null

  const now = new Date()
  const [startHours, startMinutes] = startTime.split(':').map(Number)

  const startDateTime = new Date()
  startDateTime.setHours(startHours, startMinutes, 0, 0)

  const diffMs = now.getTime() - startDateTime.getTime()
  const diffMins = Math.round(diffMs / 60000)

  if (diffMins > 0) {
    return { type: 'late', message: `Siz ${diffMins} daqiqa kech qoldingiz`, color: 'error' }
  } else if (diffMins < 0) {
    const absMins = Math.abs(diffMins)
    const h = Math.floor(absMins / 60)
    const m = absMins % 60
    const timeLeft = h > 0 ? `${h} soat ${m} daqiqa` : `${m} daqiqa`
    return { type: 'early', message: `Ish boshlanishiga ${timeLeft} qoldi`, color: 'primary' }
  }
  return null
})

const handleComplete = async (verificationResult: any) => {
  result.value = verificationResult
  toast.add({ title: 'Muvaffaqiyatli', description: 'Muvaffaqiyatli yuborildi', color: 'success' })
  showResult.value = true
  modalOpen.value = false

  await Promise.all([refreshInfo(), refreshStats()])
}

const handleError = (error: string) => {
  console.error('Liveness check error:', error)

  const isPermissionError
    = error.includes('NotAllowedError')
      || error.includes('Permission denied')
      || error.includes('PermissionDeniedError')
      || (error.toLowerCase().includes('camera') && error.toLowerCase().includes('denied'))

  if (isPermissionError) {
    toast.add({ title: 'Kamera xatosi', description: 'Kameraga ruxsat berilmagan. Iltimos brauzer sozlamalaridan ruxsat bering.', color: 'error', duration: 5000 })
    return
  }

  toast.add({ title: 'Xatolik', description: error, color: 'error', duration: 5000 })
}

const checkLocation = async () => {
  modalOpen.value = false
  activeLocationId.value = null
  userLat.value = null
  userLon.value = null

  const userLocations = userShowInfo.value?.locations || []

  const extractCoords = (loc: any): { lat: number, lon: number } | null => {
    let lat: number | null = null
    let lon: number | null = null

    if (typeof loc.location === 'string' && loc.location.includes(',')) {
      const parts = loc.location.split(',').map((s: string) => parseFloat(s.trim())) as number[]
      const p0 = Number(parts[0] ?? NaN)
      const p1 = Number(parts[1] ?? NaN)
      if (!isNaN(p0) && !isNaN(p1)) {
        lat = p0
        lon = p1
      }
    }

    if ((lat === null || lon === null) && loc.latitude && loc.longitude) {
      const latNum = parseFloat(String(loc.latitude))
      const lonNum = parseFloat(String(loc.longitude))
      if (!isNaN(latNum) && !isNaN(lonNum)) {
        lat = latNum
        lon = lonNum
      }
    }

    if (lat === null || lon === null) return null

    if ((lat > 90 || lat < -90) && Math.abs(lon) <= 90) {
      const swapped = lat
      lat = lon
      lon = swapped
    }

    return { lat, lon }
  }

  // Faqat geo-tekshiruv YOQILGAN va koordinatasi bor ish joylari masofa bo'yicha tekshiriladi.
  // Bittasida ham yoqilmagan bo'lsa — masofa tekshirilmaydi, to'g'ridan-to'g'ri kameraga o'tiladi.
  const geoLocations = userLocations.filter((l: any) => l.geo_check_enabled && extractCoords(l) !== null)
  if (!geoLocations.length) {
    activeLocationId.value = userLocations[0]?.id ?? userInfo.value?.location_id ?? null
    modalOpen.value = true
    return
  }

  const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (deg: number) => deg * (Math.PI / 180)
    const R = 6371000
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    })
  })

  try {
    const position = await getPosition()

    const currentLat = position.coords.latitude
    const currentLon = position.coords.longitude
    userLat.value = currentLat
    userLon.value = currentLon

    let foundLocationId: number | null = null
    let minDistance = Infinity

    for (const loc of geoLocations) {
      const coords = extractCoords(loc)
      if (!coords) continue

      const distanceMeters = haversineDistanceMeters(currentLat, currentLon, coords.lat, coords.lon)
      if (distanceMeters < minDistance) {
        minDistance = distanceMeters
      }

      // Backend bilan bir xil: GPS aniqligi uchun radius kamida 50 m.
      const validRadius = Math.max(Number(loc.radius) || 0, 50)
      if (distanceMeters <= validRadius) {
        foundLocationId = loc.id
        break
      }
    }

    if (minDistance === Infinity) {
      toast.add({ title: 'Lokatsiya', description: 'Barcha filiallar koordinatalari noto\'g\'ri', color: 'error' })
      return
    }

    if (foundLocationId !== null) {
      activeLocationId.value = foundLocationId
      modalOpen.value = true
    } else {
      modalOpen.value = false
      toast.add({ title: 'Masofa xatosi', description: `Siz eng yaqin filialdan ${Math.round(minDistance)} metr uzoqlikdasiz`, color: 'warning' })
      toast.add({ title: 'Lokatsiya', description: 'Siz tasdiqlangan filial ishlash radiusida emassiz', color: 'error' })
    }
  } catch (error: any) {
    console.error('Error getting location:', error)
    const isDenied = error.code === 1 || error.message?.includes('User denied Geolocation')
    if (isDenied) {
      toast.add({ title: 'Lokatsiya xatosi', description: 'Lokatsiyaga ruxsat berilmagan. Iltimos ruxsatni yoqib qayta urinib ko\'ring.', color: 'error' })
    } else {
      toast.add({ title: 'Lokatsiya xatosi', description: String(error.message || 'Noma\'lum xato'), color: 'error' })
    }
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
}

const formatTime = (dateString?: string) => {
  if (!dateString) return '--:--'
  return new Date(dateString).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
}

const openTelegram = () => {
  window.open('https://t.me/abbot_support', '_blank')
}

onMounted(async () => {
  await refreshInfo()
  const { from, to } = getSmartDateRange()
  inOutFromDate.value = from
  inOutToDate.value = to
  await refreshStats()
})
</script>

<template>
  <div class="min-h-screen w-full overflow-x-hidden" style="background: var(--ds-surface); font-family: 'Inter', sans-serif;">
    <!-- Ambient Background Effects -->
    <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] blur-[120px] rounded-full" style="background: rgba(78, 91, 228, 0.08);" />
      <div class="absolute top-[20%] -right-[5%] w-[30%] h-[30%] blur-[100px] rounded-full" style="background: rgba(99, 102, 241, 0.06);" />
      <div class="absolute -bottom-[10%] left-[20%] w-[35%] h-[35%] blur-[110px] rounded-full" style="background: rgba(78, 91, 228, 0.05);" />
    </div>

    <div class="relative z-10">
      <!-- Top Navigation -->
      <nav class="sticky top-0 z-50 backdrop-blur-md" style="background: rgba(248, 250, 252, 0.85);">
        <div class="mx-auto w-full max-w-7xl px-4 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3 group px-2 cursor-pointer">
            <div class="h-9 w-9 rounded-xl flex items-center justify-center p-1" style="background: var(--ds-primary-fixed);">
              <img
                :src="logoImg"
                alt="Abbot Logo"
                class="h-7 w-auto object-contain"
              >
            </div>
            <span class="text-xl font-bold tracking-tight hidden sm:block" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">AB<span style="color: var(--ds-primary);">BOT</span></span>
          </div>

          <div class="flex items-center gap-4">
            <div class="flex-col items-end mr-2 hidden sm:flex">
              <span class="text-sm font-semibold leading-none" style="color: var(--ds-on-surface);">{{ userInfo?.name }}</span>
              <span class="text-[10px] uppercase tracking-wider mt-1" style="color: var(--ds-secondary);">{{ userInfo?.role?.display_name || 'Xodim' }}</span>
            </div>
            <button
              class="h-10 rounded-xl flex items-center gap-2 px-3 font-medium transition-all"
              style="color: var(--ds-primary); background: var(--ds-primary-fixed);"
              @click="emit('open-schedule')"
            >
              <UIcon name="i-lucide-calendar-days" class="w-5 h-5" />
              <span class="hidden sm:inline text-sm">Ish jadvalim</span>
            </button>
            <button
              class="h-10 rounded-xl flex items-center gap-2 px-3 font-medium transition-all"
              style="color: var(--ds-primary); background: var(--ds-primary-fixed);"
              @click="emit('open-salary')"
            >
              <UIcon name="i-lucide-wallet" class="w-5 h-5" />
              <span class="hidden sm:inline text-sm">Oyligim</span>
            </button>
            <button
              class="h-10 w-10 rounded-xl flex items-center justify-center hover:!bg-red-50 hover:!text-red-500 transition-all"
              style="color: var(--ds-secondary);"
              @click="logOut"
            >
              <UIcon name="i-lucide-log-out" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <div class="mx-auto w-full max-w-7xl px-4 py-8 space-y-8">
        <div v-if="userInfo" class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <!-- Left Column: User Profile & Actions -->
          <div class="lg:col-span-4 space-y-6">
            <!-- User Card -->
            <div class="reg-card p-6 overflow-hidden relative group">
              <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <UIcon name="i-lucide-user" class="w-24 h-24" />
              </div>
              <div class="flex flex-col items-center text-center space-y-4">
                <div class="relative">
                  <div class="absolute inset-0 blur-xl opacity-20 animate-pulse rounded-full" style="background: var(--ds-primary);" />
                  <div
                    class="h-24 w-24 rounded-full bg-cover bg-center ring-2 relative z-10"
                    :style="{ backgroundImage: userInfo.photo_url ? `url(${getPhotoUrl(userInfo.photo_url)})` : 'none', '--tw-ring-color': 'rgba(78, 91, 228, 0.2)', background: userInfo.photo_url ? undefined : 'var(--ds-surface-container-lowest)' }"
                  />
                  <div class="absolute -bottom-1 -right-1 h-5 w-5 rounded-full z-20" style="background: var(--ds-primary); border: 4px solid var(--ds-surface);" />
                </div>
                <div>
                  <h2 class="text-xl font-bold leading-tight" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">
                    {{ userInfo.name }}
                  </h2>
                  <p class="text-sm font-medium" style="color: var(--ds-primary);">
                    {{ userInfo.role?.display_name || '-' }}
                  </p>
                </div>
              </div>

              <div class="mt-8 space-y-3">
                <div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--ds-surface-container-low);">
                  <div class="h-10 w-10 rounded-lg flex items-center justify-center" style="background: var(--ds-primary-fixed); color: var(--ds-primary);">
                    <UIcon name="i-lucide-map-pin" class="w-5 h-5" />
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <p class="text-[10px] uppercase font-semibold" style="color: var(--ds-secondary);">
                      Ish joyi
                    </p>
                    <p class="text-sm font-medium truncate" style="color: var(--ds-on-surface);" :title="userShowInfo?.locations?.map((l: any) => l.name).join(', ')">
                      {{ userShowInfo?.locations?.length ? userShowInfo.locations.map((l: any) => l.name).join(', ') : (userShowInfo?.location?.name || '-') }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-3 p-3 rounded-xl" style="background: var(--ds-surface-container-low);">
                  <div class="h-10 w-10 rounded-lg flex items-center justify-center" style="background: rgba(139, 92, 246, 0.08); color: #8B5CF6;">
                    <UIcon name="i-lucide-clock" class="w-5 h-5" />
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <p class="text-[10px] uppercase font-semibold" style="color: var(--ds-secondary);">
                      Ish grafigi
                    </p>
                    <p class="text-sm font-medium" style="color: var(--ds-on-surface);">
                      {{ userShowInfo?.employee_schedule?.start_time || '--:--' }} -
                      {{ userShowInfo?.employee_schedule?.end_time || '--:--' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Main Action Card -->
            <div class="reg-card p-6" style="border-top: 4px solid rgba(78, 91, 228, 0.3);">
              <div class="flex items-center justify-between mb-6">
                <h3 class="font-bold flex items-center gap-2" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">
                  <span class="h-2 w-2 rounded-full animate-ping" style="background: var(--ds-primary);" />
                  Ish holati
                </h3>
                <span
                  class="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                  :style="userInfo.on_work_status === 1
                    ? 'background: rgba(16, 185, 129, 0.12); color: #059669;'
                    : 'background: var(--ds-surface-container-high); color: var(--ds-secondary);'"
                >
                  {{ userInfo.on_work_status === 1 ? 'Ishlamoqda' : todayWorkStatus.isOff ? 'Dam olish' : todayStats.first?.created_at ? 'Ish joyida emas' : 'Bugun ishga kelmagan' }}
                </span>
              </div>

              <div class="space-y-4">
                <button
                  v-if="userInfo.on_work_status == 1"
                  class="w-full py-3 font-semibold group rounded-xl flex items-center justify-center gap-2 transition-colors"
                  style="background: rgba(245, 158, 11, 0.1); color: #B45309;"
                  @click="checkLocation()"
                >
                  <UIcon name="i-lucide-coffee" class="w-5 h-5" />
                  Sababli chiqish
                  <UIcon name="i-lucide-external-link" class="w-4 h-4 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <div
                  v-if="workStartStatus"
                  class="rounded-xl mb-2 p-3 flex items-center gap-2 text-sm"
                  :style="workStartStatus.color === 'error'
                    ? 'background: rgba(225,29,72,0.08); color: #BE123C;'
                    : 'background: var(--ds-primary-fixed); color: var(--ds-primary);'"
                >
                  <UIcon name="i-lucide-clock" class="w-4 h-4 shrink-0" />
                  {{ workStartStatus.message }}
                </div>

                <div
                  v-if="todayWorkStatus.isOff && userInfo.on_work_status !== 1"
                  class="rounded-xl mb-2 p-3 flex items-center gap-2 text-sm"
                  style="background: var(--ds-primary-fixed); color: var(--ds-primary);"
                >
                  <UIcon name="i-lucide-calendar-off" class="w-4 h-4 shrink-0" />
                  {{ todayWorkStatus.message }}
                </div>

                <button
                  class="h-16 w-full text-lg font-black tracking-wide group rounded-xl relative overflow-hidden flex items-center justify-center"
                  :style="userInfo.on_work_status !== 1
                    ? 'background: var(--ds-gradient-primary); box-shadow: 0 4px 20px rgba(78, 91, 228, 0.3); color: white; border: none;'
                    : 'background: linear-gradient(135deg, #e11d48, #f43f5e); box-shadow: 0 4px 20px rgba(225, 29, 72, 0.3); color: white; border: none;'"
                  @click="checkLocation()"
                >
                  <div class="absolute inset-0 bg-white/15 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span class="relative z-10 flex items-center justify-center gap-2">
                    <UIcon :name="userInfo.on_work_status !== 1 ? 'i-lucide-play' : 'i-lucide-square'" class="w-6 h-6" />
                    {{ userInfo.on_work_status !== 1 ? 'ISHNI BOSHLASH' : 'ISHNI YAKUNLASH' }}
                  </span>
                </button>

                <p v-if="userInfo.on_work_status !== 1 && isPastEndTime && !todayWorkStatus.isOff" class="text-xs text-center text-red-500 bg-red-50 p-2 rounded-lg">
                  <UIcon name="i-lucide-alert-circle" class="mr-1 inline-block" />
                  Ish vaqti yakunlangan.
                </p>

                <p class="text-xs text-center px-4" style="color: var(--ds-secondary);">
                  {{ userInfo.on_work_status !== 1
                    ? 'Ish boshlash uchun tugmani bosing. Masofa va yuzingiz tekshiriladi.'
                    : 'Ish kunini yakunlash uchun tugmani bosing.' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Right Column: Stats & History -->
          <div class="lg:col-span-8 space-y-6">
            <!-- Stats Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="reg-card p-6 group transition-all hover:-translate-y-0.5">
                <div class="flex items-center gap-4">
                  <div class="h-12 w-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform" style="background: var(--ds-primary-fixed); color: var(--ds-primary);">
                    <UIcon name="i-lucide-log-in" class="w-6 h-6" />
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase tracking-widest leading-none" style="color: var(--ds-secondary);">
                      Birinchi kelish
                    </p>
                    <p class="text-3xl font-black mt-1" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">
                      {{ formatTime(todayStats.first?.created_at) }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="reg-card p-6 group transition-all hover:-translate-y-0.5">
                <div class="flex items-center gap-4">
                  <div class="h-12 w-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform" style="background: rgba(225, 29, 72, 0.08); color: #e11d48;">
                    <UIcon name="i-lucide-log-out" class="w-6 h-6" />
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase tracking-widest leading-none" style="color: var(--ds-secondary);">
                      Oxirgi ketish
                    </p>
                    <p class="text-3xl font-black mt-1" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">
                      {{ formatTime(todayStats.last?.created_at) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- History Table -->
            <div class="reg-card overflow-hidden">
              <div class="p-6 flex items-center justify-between" style="border-bottom: 1px solid var(--ds-surface-container-high);">
                <h3 class="text-lg font-bold flex items-center gap-2" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">
                  <UIcon name="i-lucide-history" style="color: var(--ds-primary);" />
                  Bugungi faolliklar
                </h3>
                <span class="text-xs font-medium" style="color: var(--ds-secondary);">{{ formatDate(new Date().toISOString()).split(' ')[0] }}</span>
              </div>

              <div class="overflow-x-auto">
                <table class="ds-table w-full">
                  <thead>
                    <tr>
                      <th>Turi</th>
                      <th>Vaqt</th>
                      <th>Rasm</th>
                      <th>Izoh</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in (inOutsData?.data?.data || [])" :key="row.id">
                      <td>
                        <div class="flex items-center gap-2">
                          <span
                            class="h-2 w-2 rounded-full"
                            :class="row.type === 'in' ? 'bg-indigo-600' : 'bg-red-500'"
                            :style="row.type === 'in' ? 'box-shadow: 0 0 8px rgba(78,91,228,0.4);' : 'box-shadow: 0 0 8px rgba(225,29,72,0.4);'"
                          />
                          <span :style="row.type === 'in' ? 'color: var(--ds-primary);' : 'color: #e11d48;'" class="font-bold text-sm">
                            {{ row.type === 'in' ? 'KIRISH' : 'CHIQISH' }}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div class="flex items-center gap-2 text-sm" style="color: var(--ds-on-surface);">
                          <UIcon name="i-lucide-clock" class="w-3.5 h-3.5 opacity-40" />
                          {{ formatDate(row.created_at).split(' ')[1] }}
                        </div>
                      </td>
                      <td>
                        <div v-if="row.photo_url || row.photo" class="group cursor-pointer relative w-12 h-12" @click="openPhotoModal(row.photo_url || row.photo)">
                          <img
                            :src="getPhotoUrl(row.photo_url || row.photo)"
                            alt="Photo"
                            class="w-12 h-12 object-cover rounded-lg group-hover:scale-105 transition-transform"
                            style="border: 1px solid var(--ds-surface-container-high);"
                          >
                          <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                            <UIcon name="i-lucide-maximize-2" class="text-white w-4 h-4" />
                          </div>
                        </div>
                        <span v-else style="color: var(--ds-outline-variant);">No image</span>
                      </td>
                      <td>
                        <span class="italic max-w-[150px] truncate block" style="color: var(--ds-secondary);">{{ row.comment || '-' }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div v-if="!(inOutsData?.data?.data?.length)" class="flex flex-col items-center justify-center py-20" style="color: var(--ds-outline-variant);">
                  <UIcon name="i-lucide-inbox" class="w-12 h-12 mb-4 opacity-30" />
                  <p class="text-sm font-medium">
                    Hozircha hech qanday faollik yo'q
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Loading State -->
        <div v-else class="flex flex-col justify-center items-center h-[60vh] space-y-4">
          <div class="relative">
            <div class="h-16 w-16 rounded-full animate-spin" style="border: 4px solid var(--ds-surface-container-high); border-top-color: var(--ds-primary);" />
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="h-8 w-8 rounded-full animate-pulse" style="background: var(--ds-primary-fixed);" />
            </div>
          </div>
          <p class="font-medium animate-pulse" style="color: var(--ds-secondary);">
            Ma'lumotlar yuklanmoqda...
          </p>
        </div>
      </div>
    </div>

    <!-- Liveness Check Modal -->
    <div
      v-if="modalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.5);"
    >
      <div class="w-full sm:max-w-2xl rounded-3xl overflow-hidden" style="background: var(--ds-surface-container-lowest); box-shadow: var(--ds-shadow-hover);">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-xl flex items-center justify-center" style="background: var(--ds-primary-fixed); color: var(--ds-primary);">
                <UIcon name="i-lucide-scan-face" class="w-6 h-6" />
              </div>
              <div>
                <h3 class="text-lg font-bold" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">
                  Shaxsni tasdiqlash
                </h3>
                <p class="text-xs" style="color: var(--ds-secondary);">
                  Iltimos, yuzingizni kameraga ko'rsating
                </p>
              </div>
            </div>
            <button
              class="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
              style="color: var(--ds-secondary);"
              @click="modalOpen = false"
            >
              <UIcon name="i-lucide-x" class="w-5 h-5" />
            </button>
          </div>

          <div class="rounded-2xl overflow-hidden relative" style="background: var(--ds-surface-container-high);">
            <LivenessCamera
              :key="userInfo?.on_work_status == 1 ? 'out' : 'in'"
              :type="userInfo?.on_work_status == 1 ? 'out' : 'in'"
              :location-id="activeLocationId || userInfo?.location_id || null"
              :latitude="userLat"
              :longitude="userLon"
              @complete="handleComplete"
              @error="handleError"
            />

            <!-- Camera Overlay Guide -->
            <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div class="w-64 h-80 border-2 border-dashed rounded-[4rem] flex items-center justify-center" style="border-color: rgba(78, 91, 228, 0.2);">
                <div class="h-full w-full absolute animate-pulse rounded-[4rem]" style="background: rgba(78, 91, 228, 0.03);" />
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-col items-center gap-2">
            <UIcon name="i-lucide-shield-check" class="w-5 h-5" style="color: var(--ds-primary);" />
            <p class="text-[10px] text-center uppercase tracking-widest font-bold" style="color: var(--ds-secondary);">
              Xavfsiz ulanish o'rnatildi
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Photo lightbox -->
    <div
      v-if="isPhotoModalOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.6);"
      @click="isPhotoModalOpen = false"
    >
      <div class="p-2 relative rounded-2xl overflow-hidden max-w-xl w-full" style="background: var(--ds-surface-container-lowest);" @click.stop>
        <img :src="selectedPhotoUrl" alt="Verification Photo" class="w-full h-auto rounded-xl shadow-2xl">
        <button class="modalCloseBtn h-8 w-8 rounded-lg flex items-center justify-center" style="background: rgba(255,255,255,0.9); color: var(--ds-on-surface);" @click="isPhotoModalOpen = false">
          <UIcon name="i-lucide-x" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Footer -->
    <footer class="py-12 opacity-50 relative z-10" style="border-top: 1px solid var(--ds-surface-container-high);">
      <div class="mx-auto w-full max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-lg flex items-center justify-center p-1" style="background: var(--ds-surface-container-low);">
            <img :src="logoImg" alt="Abbot Logo" class="h-5 w-auto object-contain opacity-70">
          </div>
          <span class="text-sm font-bold tracking-tight" style="color: var(--ds-secondary); font-family: 'Manrope', sans-serif;">ABBOT</span>
        </div>
        <p class="text-xs" style="color: var(--ds-outline-variant);">
          © {{ new Date().getFullYear() }} Barcha huquqlar himoyalangan.
        </p>
        <div class="flex items-center gap-4" style="color: var(--ds-outline-variant);">
          <UIcon name="i-lucide-send" class="w-4 h-4 cursor-pointer hover:text-indigo-600 transition-colors" @click="openTelegram" />
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.reg-card {
  background: var(--ds-surface-container-lowest);
  border-radius: var(--ds-radius-xl);
  box-shadow: var(--ds-shadow-card);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.reg-card:hover {
  box-shadow: var(--ds-shadow-hover);
}
</style>
