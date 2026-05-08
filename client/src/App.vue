<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { layouts, defaultLayout } from '@/layouts'

const route = useRoute()

const layoutComponent = computed(() => {
  const layoutName = (route.meta?.layout as string) || defaultLayout
  const component = layouts[layoutName]
  if (!component) {
    console.warn(`[LayoutResolver] Unknown layout "${layoutName}", falling back to "${defaultLayout}"`)
    return layouts[defaultLayout]
  }
  return component
})
</script>

<template>
  <component :is="layoutComponent">
    <router-view />
  </component>
</template>
