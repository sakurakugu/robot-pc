<template>
  <router-view />
</template>

<script setup lang="ts">
import { useCloudAccountStore } from '@/features/account/store'
import { useTheme } from './composables/useTheme'

useTheme()
void useCloudAccountStore().initialize()
</script>
