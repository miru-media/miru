---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'Miru'
  text: 'Web-based media editing'
  tagline: >
    Framework-agnostic Web platform libraries and components for photo and video editing with WebGL and WebCodecs
  image:
    src: '/hero.svg'
    alt: ''
  actions:
    - theme: brand
      text: Video editor
      link: /video-editor
    - theme: alt
      text: Video trimmer
      link: /video-trimmer
    - theme: alt
      text: Photo editor
      link: /photo-editor
    - theme: alt
      text: Source code
      link: https://gitea.com/miru/miru

features:
  - title: Browser-based
    details: Fully browser-based and client-side.
  - title: Filters
    details: Apply color LUT filters and visual effects.
  - title: Create videos
    details: Split, trim and join videos and audio and export to an MP4.
---

<br>

---

<br>

This project is funded through [NGI Zero Core](https://nlnet.nl/core), a fund established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more at the [NLnet project page](https://nlnet.nl/project/Miru).

<p class="flex flex-wrap items-center gap-2">
  <a href="https://nlnet.nl">
    <img class="light-only w-50" src="/nlnet-banner.svg" alt="NLnet foundation logo" />
    <img class="dark-only w-50" src="/nlnet-banner-diapositive.svg" alt="NLnet foundation logo" />
  </a>
  <a href="https://nlnet.nl/core">
    <img class="light-only w-50" src="/NGI0_tag.svg" alt="NGI Zero Logo" />
    <img class="dark-only w-50" src="/NGI0_tag_white_mono.svg" alt="NGI Zero Logo" />
  </a>
</p>

<HeroAnimation ref="heroAnimation" v-bind="heroImageAttrs"/>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import HeroAnimation from './hero-animation.vue'

const heroAnimation = ref<{ $el: SVGElement }>()
const heroImageAttrs = ref<Record<string, unknown>>({class: 'hidden'})

watchEffect(() => {
  const svgEl = heroAnimation.value?.$el
  if (!svgEl) return

  const heroImage = document.querySelector<HTMLImageElement>('.VPHomeHero.has-image .VPImage[src$=".svg"]')

  if (!heroImage) {
    console.warn('no hero image')
    return
  }

  heroImageAttrs.value =
    Object.fromEntries(Array.from(heroImage.attributes).filter(a => a.name !== 'src').map(({ name, value }) => [name, value]))
    console.log(heroImageAttrs.value)

  heroImage.parentElement?.insertBefore(svgEl, heroImage)
  heroImage.remove()
})
</script>
