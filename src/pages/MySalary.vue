<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { $api } from '@/api'
import { useToast } from '@/composables/useToast'

const emit = defineEmits(['back'])

const toast = useToast()

const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

const year = ref(new Date().getFullYear())
const reports = ref<any[]>([])
const loading = ref(false)
const expandedId = ref<number | null>(null)

const money = (v: any) => String(Math.round(Number(v) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

const statusMeta = (r: any) => {
  if (r.status === 'paid' || r.payment_status === 'paid') return { label: 'To\'langan', cls: 'sal-badge--paid' }
  if (r.payment_status === 'partial') return { label: 'Qisman to\'langan', cls: 'sal-badge--partial' }
  if (r.status === 'approved') return { label: 'Tasdiqlangan', cls: 'sal-badge--approved' }

  return { label: 'Qoralama', cls: 'sal-badge--draft' }
}

const yearTotal = computed(() => reports.value.reduce((s, r) => s + Number(r.net_salary || 0), 0))
const yearPaid = computed(() => reports.value.reduce((s, r) => s + Number(r.paid_total || 0), 0))

const fetchReports = async () => {
  loading.value = true
  try {
    const res: any = await $api('/hr/my-salaries', { query: { year: year.value, per_page: 12 } })
    reports.value = res?.data?.data ?? res?.data ?? []
  } catch (err) {
    console.error(err)
    toast.add({ title: 'Xatolik', description: 'Oylik ma\'lumotlarini yuklab bo\'lmadi', color: 'error' })
  } finally {
    loading.value = false
  }
}

const shiftYear = (delta: number) => {
  year.value += delta
  expandedId.value = null
  fetchReports()
}

const toggle = (id: number) => {
  expandedId.value = expandedId.value === id ? null : id
}

const paidAtLabel = (v: string) => {
  if (!v) return ''
  const d = new Date(v)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

onMounted(fetchReports)
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
            Mening oyligim
          </div>
          <div class="text-[11px]" style="color: var(--ds-secondary);">
            Oylik hisobotlaringiz va to'lovlar
          </div>
        </div>
      </div>
    </nav>

    <div class="mx-auto w-full max-w-3xl px-4 py-6">
      <!-- Year nav -->
      <div class="flex items-center justify-center gap-4 mb-5">
        <button class="sal-nav-btn" @click="shiftYear(-1)">
          <UIcon name="i-lucide-chevron-left" class="w-5 h-5" />
        </button>
        <span class="text-lg font-bold min-w-[100px] text-center" style="color: var(--ds-on-surface);">{{ year }}</span>
        <button class="sal-nav-btn" @click="shiftYear(1)">
          <UIcon name="i-lucide-chevron-right" class="w-5 h-5" />
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <div class="sal-spinner" />
      </div>

      <template v-else>
        <!-- Yillik jamlanma -->
        <div v-if="reports.length" class="grid grid-cols-2 gap-3 mb-5">
          <div class="sal-card p-4">
            <div class="text-[11px] uppercase font-semibold mb-1" style="color: var(--ds-secondary);">Jami hisoblangan</div>
            <div class="text-lg font-bold" style="color: var(--ds-on-surface);">{{ money(yearTotal) }} <span class="text-xs font-medium">so'm</span></div>
          </div>
          <div class="sal-card p-4">
            <div class="text-[11px] uppercase font-semibold mb-1" style="color: var(--ds-secondary);">Jami to'langan</div>
            <div class="text-lg font-bold" style="color: #15803d;">{{ money(yearPaid) }} <span class="text-xs font-medium">so'm</span></div>
          </div>
        </div>

        <div v-if="!reports.length" class="sal-card p-10 text-center">
          <UIcon name="i-lucide-wallet" class="w-10 h-10 mx-auto mb-3" style="color: var(--ds-outline-variant);" />
          <div class="text-sm font-medium" style="color: var(--ds-secondary);">
            {{ year }}-yil uchun oylik hisobotlari topilmadi
          </div>
        </div>

        <!-- Oylik hisobotlar -->
        <div class="space-y-3">
          <div v-for="r in reports" :key="r.id" class="sal-card overflow-hidden">
            <button type="button" class="w-full p-4 text-left" @click="toggle(r.id)">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-bold" style="color: var(--ds-on-surface);">
                      {{ monthNames[r.month - 1] }} {{ r.year }}
                    </span>
                    <span class="sal-badge" :class="statusMeta(r).cls">{{ statusMeta(r).label }}</span>
                  </div>
                  <div class="text-[11px]" style="color: var(--ds-secondary);">
                    {{ r.worked_days }}/{{ r.total_work_days }} kun ishlangan
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <div class="text-right">
                    <div class="text-base font-bold" style="color: var(--ds-on-surface);">{{ money(r.net_salary) }}</div>
                    <div class="text-[10px]" style="color: var(--ds-secondary);">so'm</div>
                  </div>
                  <UIcon
                    :name="expandedId === r.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    class="w-4 h-4"
                    style="color: var(--ds-secondary);"
                  />
                </div>
              </div>
            </button>

            <!-- Tafsilotlar -->
            <div v-if="expandedId === r.id" class="px-4 pb-4">
              <div class="sal-divider mb-3" />

              <div class="space-y-2 text-sm">
                <div class="sal-row">
                  <span>{{ r.salary_type_label || 'Asosiy maosh' }}</span>
                  <span class="font-semibold">{{ money(r.base_salary) }} so'm</span>
                </div>
                <div v-if="Number(r.bonus_total)" class="sal-row" style="color: #15803d;">
                  <span>Bonus</span>
                  <span class="font-semibold">+{{ money(r.bonus_total) }} so'm</span>
                </div>
                <div v-if="Number(r.kpi_amount)" class="sal-row" style="color: #15803d;">
                  <span>KPI</span>
                  <span class="font-semibold">+{{ money(r.kpi_amount) }} so'm</span>
                </div>
                <div v-if="Number(r.fine_total)" class="sal-row" style="color: #b91c1c;">
                  <span>Jarima</span>
                  <span class="font-semibold">-{{ money(r.fine_total) }} so'm</span>
                </div>
                <div v-if="r.exclude_off_days && Number(r.off_days_amount)" class="sal-row" style="color: #b91c1c;">
                  <span>Dam olish kunlari ({{ r.worked_off_days }} kun)</span>
                  <span class="font-semibold">-{{ money(r.off_days_amount) }} so'm</span>
                </div>

                <div class="sal-divider my-2" />

                <div class="sal-row font-bold" style="color: var(--ds-on-surface);">
                  <span>Hisoblangan oylik</span>
                  <span>{{ money(r.net_salary) }} so'm</span>
                </div>
                <div class="sal-row" style="color: #15803d;">
                  <span>To'langan</span>
                  <span class="font-semibold">{{ money(r.paid_total) }} so'm</span>
                </div>
                <div v-if="Number(r.remaining) > 0" class="sal-row" style="color: #b45309;">
                  <span>Qolgan</span>
                  <span class="font-semibold">{{ money(r.remaining) }} so'm</span>
                </div>
              </div>

              <!-- To'lovlar tarixi -->
              <template v-if="r.payments?.length">
                <div class="text-[11px] uppercase font-semibold mt-4 mb-2" style="color: var(--ds-secondary);">
                  To'lovlar tarixi
                </div>
                <div class="space-y-1.5">
                  <div
                    v-for="p in r.payments"
                    :key="p.id"
                    class="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                    style="background: var(--ds-surface-container-high);"
                  >
                    <span style="color: var(--ds-secondary);">{{ paidAtLabel(p.paid_at) }}</span>
                    <span class="font-semibold" style="color: var(--ds-on-surface);">{{ money(p.amount) }} so'm</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sal-card {
  background: var(--ds-surface-container-lowest);
  border-radius: 16px;
  box-shadow: var(--ds-shadow, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.sal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ds-on-surface-variant);
}

.sal-divider {
  height: 1px;
  background: var(--ds-surface-container-high);
}

.sal-badge {
  padding: 2px 8px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 8px;
}

.sal-badge--paid {
  color: #15803d;
  background: rgba(34, 197, 94, 0.12);
}

.sal-badge--partial {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.sal-badge--approved {
  color: var(--ds-primary);
  background: var(--ds-primary-fixed);
}

.sal-badge--draft {
  color: #475569;
  background: rgba(148, 163, 184, 0.16);
}

.sal-nav-btn {
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

.sal-nav-btn:hover {
  background: var(--ds-surface-container-highest);
}

.sal-spinner {
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
