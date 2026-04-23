<template>
  <el-button
    circle
    class="action-btn"
    :title="title"
    :disabled="disabled"
    @click="handleClick"
  >
    {{ label }}
  </el-button>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  title: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

function handleClick(): void {
  if (props.disabled) {
    return
  }
  emit('click')
}
</script>

<style scoped>
.action-btn {
  width: 48px;
  height: 48px;
  font-size: 13px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.34);
  transform: scale(1.04);
}
</style>
