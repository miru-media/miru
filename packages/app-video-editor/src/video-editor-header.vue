<script setup lang="ts"></script>

<template>
  <div class="header-root">
    <div class="start"><slot name="start"></slot></div>
    <div class="middle"><slot name="middle" /></div>
    <div class="end"><slot name="end" /></div>
  </div>
</template>

<style scoped>
.header-root {
  position: relative;
  display: grid;
  grid-template-columns: 1fr minmax(auto, 1fr) 1fr;
  justify-content: end;
  min-height: 3.75rem;
  padding-left: max(env(safe-area-inset-left, 0.5rem), 0.5rem);
  padding-right: max(env(safe-area-inset-right, 0.5rem), 0.5rem);
  padding-top: max(env(safe-area-inset-top, 0.5rem), 0.5rem);
  padding-bottom: max(env(safe-area-inset-bottom, 0.5rem), 0.5rem);
}

.start,
.middle,
.end {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.start {
  justify-self: start;
}

.end {
  justify-self: end;
}
</style>
