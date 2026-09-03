<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { accessToken } from '@/auth'
import LoginPage from '@/pages/Login.vue'
import RegisterPage from '@/pages/Register.vue'
import MySchedulePage from '@/pages/MySchedule.vue'
import MySalaryPage from '@/pages/MySalary.vue'
import ToastHost from '@/components/ToastHost.vue'

const isAuthed = computed(() => !!accessToken.value)

// 'home' = FaceID/davomat, 'schedule' = mening ish jadvalim, 'salary' = mening oyligim
const view = ref<'home' | 'schedule' | 'salary'>('home')

// Chiqib ketilsa bosh sahifaga qaytariladi
watch(isAuthed, val => {
  if (!val) view.value = 'home'
})
</script>

<template>
  <template v-if="isAuthed">
    <MySchedulePage
      v-if="view === 'schedule'"
      @back="view = 'home'"
    />
    <MySalaryPage
      v-else-if="view === 'salary'"
      @back="view = 'home'"
    />
    <RegisterPage
      v-else
      @open-schedule="view = 'schedule'"
      @open-salary="view = 'salary'"
    />
  </template>
  <LoginPage v-else />
  <ToastHost />
</template>
