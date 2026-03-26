<script setup lang="ts">
const { backUrl } = defineProps<{ backUrl: string }>()
</script>

<template>
  <div class="prose-lg dark:prose-invert text-center justify-center flex h-100vh flex-col p-10vw">
    <h2>
      <div class="i-tabler:alert-octagon-filled text-red inline-flex align-middle" />
      {{ $t('error_loading_doc') }}
    </h2>
    <p>{{ $t('error_loading_doc_info') }}</p>
    <p>
      <a :href="backUrl" class="button primary"
        ><div class="i-tabler:arrow-left" />
        {{ $t('error_back_to_doc_list') }}</a
      >
    </p>
  </div>
</template>
