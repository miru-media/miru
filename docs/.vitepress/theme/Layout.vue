<script setup lang="ts">
import { useData } from 'vitepress/dist/client/index.js'
import DefaultTheme, { VPImage, VPLink } from 'vitepress/theme'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const BASE_URL = import.meta.env.BASE_URL
</script>

<template>
  <Layout>
    <template v-if="frontmatter.navbar === false" #sidebar-nav-before>
      <VPLink :href="BASE_URL" class="home-link">
        <VPImage :image="{ light: '/dark-logo.svg', dark: '/white-logo.svg', alt: 'Miru logo' }" />
      </VPLink>
      <hr class="divider" />
    </template>
    <template #sidebar-nav-after>
      <div class="sidebar-bottom">
        <VPLink href="https://gitea.com/miru/miru">Source code</VPLink>
      </div>
    </template>
  </Layout>
</template>

<style scoped>
.home-link {
  position: relative;
  display: block;
  height: var(--vp-nav-logo-height);

  :deep(img) {
    position: relative;
    top: -10px;
    left: 0;
    z-index: 1;
    height: var(--vp-nav-logo-height);
  }
}

.divider {
  margin: 17px 0 0px;
  border-width: 0 0 1px;
  border-color: var(--vp-c-divider);
}
</style>
