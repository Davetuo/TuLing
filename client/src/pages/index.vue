<route lang="yaml">
meta:
  requiresAuth: true
</route>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
router.replace('/home')
</script>

<template>
  <div></div>
</template>
