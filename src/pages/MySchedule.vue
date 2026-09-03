<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { $api } from '@/api'
import { useToast } from '@/composables/useToast'

const emit = defineEmits(['back'])

const toast = useToast()

const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

// Dam olish kamida shu kundan boshlab so'raladi (bugun + 2 kun)
const MIN_ADVANCE_DAYS = 2
const minOffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MIN_ADVANCE_DAYS)
const minOffDateStr = `${minOffDate.getFullYear()}-${pad(minOffDate.getMonth() + 1)}-${pad(minOffDate.getDate())}`

const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']
const weekLabels = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya']

const month = ref(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`)
const myEmployeeId = ref<number | null>(null)
const employees = ref<any[]>([])
const pendingDates = ref<string[]>([])
const loading = ref(false)
const savingDate = ref<string | null>(null)

// Tanlangan kun (pastki oyna)
const selected = ref<any | null>(null)

const monthLabel = computed(() => {
  const [y, m] = month.value.split('-').map(Number)

  return `${monthNames[m - 1]} ${y}`
})

const myRow = computed(() => employees.value.find(e => e.id === myEmployeeId.value))

const calendar = computed(() => {
  const [y, m] = month.value.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()

  let startDow = first.getDay() - 1
  if (startDow < 0) startDow = 6

  const cells: any[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month.value}-${pad(d)}`
    const myType = myRow.value?.days?.find((x: any) => x.date === date)?.type || 'work'
    const offNames = employees.value
      .filter(e => e.id !== myEmployeeId.value && e.days?.find((x: any) => x.date === date)?.type === 'off')
      .map(e => e.name)

    cells.push({
      date,
      day: d,
      myType,
      pending: pendingDates.value.includes(date),
      offNames,
      offCount: offNames.length,
      isPast: date < todayStr,
      isToday: date === todayStr,
      canRequestOff: date >= minOffDateStr,
    })
  }

  return cells
})

const fetchMe = async () => {
  try {
    const res: any = await $api('/auth/me')
    myEmployeeId.value = res?.data?.finance_employee_id ?? null
  } catch (err) {
    console.error(err)
  }
}

const fetchGrid = async () => {
  loading.value = true
  try {
    const res: any = await $api('/hr/my-work-days/grid', { query: { month: month.value } })
    employees.value = res?.data?.data ?? res?.data ?? []
    pendingDates.value = res?.data?.my_pending_dates ?? []
  } catch (err) {
    console.error(err)
    toast.add({ title: 'Xatolik', description: 'Jadvalni yuklab bo\'lmadi', color: 'error' })
  } finally {
    loading.value = false
  }
}

const shiftMonth = (delta: number) => {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  month.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  selected.value = null
  fetchGrid()
}

const openCell = (cell: any) => {
  selected.value = cell
}

const setMyDay = async (type: 'work' | 'off') => {
  const cell = selected.value
  if (!cell || cell.isPast) return

  if (type === 'off' && !cell.canRequestOff) {
    toast.add({ title: 'Muddat o\'tgan', description: `Dam olish kamida ${MIN_ADVANCE_DAYS} kun oldin so'raladi`, color: 'error' })

    return
  }

  savingDate.value = cell.date
  try {
    const res: any = await $api('/hr/my-work-days/set-day', {
      method: 'POST',
      body: { date: cell.date, type },
    })

    if (type === 'off') {
      // Dam olish darhol belgilanmaydi — HR tasdig'iga so'rov ketadi
      if (!pendingDates.value.includes(cell.date)) pendingDates.value.push(cell.date)
      cell.pending = true
      toast.add({ title: 'So\'rov yuborildi', description: 'HR tasdiqlagach dam olish kuni hisoblanadi', color: 'success' })
    } else {
      const hadPending = !!res?.data?.cancelled_request_id || cell.pending
      pendingDates.value = pendingDates.value.filter(d => d !== cell.date)
      cell.pending = false

      const row = myRow.value
      if (row) {
        const day = row.days?.find((x: any) => x.date === cell.date)
        if (day) day.type = 'work'
        else (row.days ||= []).push({ date: cell.date, type: 'work' })
      }
      cell.myType = 'work'
      toast.add({ title: 'Saqlandi', description: hadPending ? 'Dam olish so\'rovi bekor qilindi' : 'Ish kuni belgilandi', color: 'success' })
    }
  } catch (err: any) {
    console.error(err)
    const msg = err?.data?.message || 'O\'zgartirib bo\'lmadi'
    toast.add({ title: 'Xatolik', description: msg, color: 'error' })
  } finally {
    savingDate.value = null
  }
}

onMounted(async () => {
  await fetchMe()
  await fetchGrid()
})
</script>

<template>
  <div class="min-h-screen w-full" style="background: var(--ds-surface); font-family: 'Inter', sans-serif;">
    <!-- Navbar -->
    <nav class="sticky top-0 z-50 backdrop-blur-md" style="background: rgba(249, 249, 255, 0.85);">
      <div class="mx-auto w-full max-w-3xl px-4 h-16 flex items-center gap-3">
        <button
          class="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
          style="color: var(--ds-secondary);"
          @click="emit('back')"
        >
          <UIcon name="i-lucide-arrow-left" class="w-5 h-5" />
        </button>
        <div>
          <div class="text-base font-bold" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">
            Mening ish jadvalim
          </div>
          <div class="text-[11px]" style="color: var(--ds-secondary);">
            Dam olish kunlaringizni belgilang
          </div>
        </div>
      </div>
    </nav>

    <div class="mx-auto w-full max-w-3xl px-4 py-6">
      <!-- Month nav -->
      <div class="flex items-center justify-center gap-4 mb-4">
        <button class="cal-nav-btn" @click="shiftMonth(-1)">
          <UIcon name="i-lucide-chevron-left" class="w-5 h-5" />
        </button>
        <span class="text-lg font-bold min-w-[160px] text-center" style="color: var(--ds-on-surface);">{{ monthLabel }}</span>
        <button class="cal-nav-btn" @click="shiftMonth(1)">
          <UIcon name="i-lucide-chevron-right" class="w-5 h-5" />
        </button>
      </div>

      <!-- Legend -->
      <div class="flex flex-wrap items-center justify-center gap-4 mb-4 text-xs" style="color: var(--ds-secondary);">
        <span class="inline-flex items-center gap-1.5"><span class="lg-dot" style="background:#22c55e;" /> Ish kuni</span>
        <span class="inline-flex items-center gap-1.5"><span class="lg-dot" style="background:#94a3b8;" /> Dam olish</span>
        <span class="inline-flex items-center gap-1.5"><span class="lg-dot" style="background:#f59e0b;" /> HR tasdig'i kutilmoqda</span>
        <span class="inline-flex items-center gap-1.5"><span class="lg-badge">N</span> hamkasblar dam olishda</span>
      </div>

      <div v-if="loading && !employees.length" class="flex justify-center py-16">
        <div class="cal-spinner" />
      </div>

      <template v-else>
        <!-- Weekday headers -->
        <div class="cal-grid mb-1">
          <div v-for="w in weekLabels" :key="w" class="text-center text-[11px] font-semibold" style="color: var(--ds-secondary);">
            {{ w }}
          </div>
        </div>

        <!-- Days -->
        <div class="cal-grid">
          <div v-for="(cell, i) in calendar" :key="i">
            <button
              v-if="cell"
              type="button"
              class="cal-day"
              :class="[
                cell.pending && cell.myType !== 'off' ? 'cal-day--pending' : (cell.myType === 'off' ? 'cal-day--off' : 'cal-day--work'),
                cell.isPast ? 'cal-day--past' : '',
                cell.isToday ? 'cal-day--today' : '',
              ]"
              @click="openCell(cell)"
            >
              <span class="cal-day-num">{{ cell.day }}</span>
              <span class="cal-day-type">{{ cell.pending && cell.myType !== 'off' ? 'So\'rov' : (cell.myType === 'off' ? 'Dam' : 'Ish') }}</span>
              <span v-if="cell.offCount" class="cal-day-badge">{{ cell.offCount }}</span>
            </button>
            <div v-else class="cal-day-empty" />
          </div>
        </div>
      </template>
    </div>

    <!-- Kun tafsiloti (pastki oyna) -->
    <div
      v-if="selected"
      class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style="background: rgba(0,0,0,0.4);"
      @click="selected = null"
    >
      <div
        class="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6"
        style="background: var(--ds-surface-container-lowest); box-shadow: var(--ds-shadow-hover);"
        @click.stop
      >
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="text-lg font-bold" style="font-family: 'Manrope', sans-serif; color: var(--ds-on-surface);">
              {{ selected.day }}-{{ monthLabel }}
            </div>
            <div v-if="selected.isPast" class="text-xs" style="color: var(--ds-outline-variant);">
              O'tgan kun — o'zgartirib bo'lmaydi
            </div>
          </div>
          <button class="h-8 w-8 rounded-lg flex items-center justify-center" style="color: var(--ds-secondary);" @click="selected = null">
            <UIcon name="i-lucide-x" class="w-4 h-4" />
          </button>
        </div>

        <!-- Sizning holatingiz -->
        <div class="text-[11px] uppercase font-semibold mb-2" style="color: var(--ds-secondary);">
          Sizning holatingiz
        </div>
        <div class="flex gap-2 mb-2">
          <button
            type="button"
            class="status-choice"
            :class="{ 'status-choice--active-work': selected.myType === 'work' && !selected.pending }"
            :disabled="selected.isPast || savingDate === selected.date"
            @click="setMyDay('work')"
          >
            <UIcon name="i-lucide-check" class="w-5 h-5" />
            Ish kuni
          </button>
          <button
            type="button"
            class="status-choice"
            :class="{
              'status-choice--active-off': selected.myType === 'off',
              'status-choice--pending': selected.pending && selected.myType !== 'off',
            }"
            :disabled="selected.isPast || savingDate === selected.date || selected.pending || selected.myType === 'off' || !selected.canRequestOff"
            @click="setMyDay('off')"
          >
            <UIcon :name="selected.pending && selected.myType !== 'off' ? 'i-lucide-hourglass' : 'i-lucide-coffee'" class="w-5 h-5" />
            {{ selected.pending && selected.myType !== 'off' ? 'So\'rov yuborilgan' : 'Dam olish' }}
          </button>
        </div>
        <div v-if="!selected.isPast" class="text-[11px] mb-5" style="color: var(--ds-outline-variant);">
          <template v-if="selected.pending && selected.myType !== 'off'">
            HR tasdiqlashini kutmoqda. "Ish kuni" tugmasi so'rovni bekor qiladi.
          </template>
          <template v-else-if="selected.myType !== 'off' && !selected.canRequestOff">
            Dam olish kamida {{ MIN_ADVANCE_DAYS }} kun oldin so'raladi — bu kun uchun so'rov yuborib bo'lmaydi.
          </template>
          <template v-else-if="selected.myType !== 'off'">
            Dam olish so'rovi HR tasdig'idan keyin kuchga kiradi.
          </template>
        </div>
        <div v-else class="mb-5" />

        <!-- Hamkasblar -->
        <div class="text-[11px] uppercase font-semibold mb-2" style="color: var(--ds-secondary);">
          Bu kuni dam olishda ({{ selected.offCount }})
        </div>
        <div v-if="selected.offNames.length" class="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          <span
            v-for="(name, idx) in selected.offNames"
            :key="idx"
            class="px-2.5 py-1 rounded-full text-xs"
            style="background: var(--ds-surface-container-high); color: var(--ds-on-surface-variant);"
          >
            {{ name }}
          </span>
        </div>
        <div v-else class="text-sm" style="color: var(--ds-outline-variant);">
          Hech kim dam olishda emas
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.cal-day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-height: 62px;
  border: 1px solid transparent;
  border-radius: 12px;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.cal-day:active {
  transform: scale(0.96);
}

.cal-day--work {
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
}

.cal-day--off {
  background: rgba(148, 163, 184, 0.14);
  color: #475569;
}

.cal-day--pending {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.cal-day--today {
  border-color: var(--ds-primary);
}

.cal-day--past {
  opacity: 0.45;
}

.cal-day-num {
  font-size: 0.9rem;
  font-weight: 700;
}

.cal-day-type {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
}

.cal-day-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  color: #fff;
  background: var(--ds-primary);
  border-radius: 8px;
}

.cal-day-empty {
  min-height: 62px;
}

.cal-nav-btn {
  height: 40px;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--ds-secondary);
  background: var(--ds-surface-container-high);
  transition: background 0.12s;
}

.cal-nav-btn:hover {
  background: var(--ds-surface-container-highest);
}

.lg-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.lg-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  color: #fff;
  background: var(--ds-primary);
  border-radius: 8px;
}

.status-choice {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ds-secondary);
  border: 1.5px solid rgba(148, 163, 184, 0.3);
  border-radius: 14px;
  transition: all 0.15s;
}

.status-choice:disabled {
  opacity: 0.5;
}

.status-choice--active-work {
  color: #15803d;
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.5);
}

.status-choice--active-off {
  color: #475569;
  background: rgba(148, 163, 184, 0.16);
  border-color: rgba(148, 163, 184, 0.6);
}

.status-choice--pending {
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.5);
  opacity: 1 !important;
}

.cal-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--ds-surface-container-high);
  border-top-color: var(--ds-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
