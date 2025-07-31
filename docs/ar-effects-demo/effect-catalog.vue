<script setup lang="ts">
import { catalog } from './catalog'

interface Effect {
  name: string
  url: string
}

const { modelValue, open } = defineProps<{ modelValue: Effect; open: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Effect]; 'update:open': [boolean] }>()
</script>
<template>
  <div :class="['root', open && 'is-open']">
    <div class="background" @click="() => emit('update:open', false)"></div>
    <div class="drawer">
      <slot />
      <button
        v-for="effect of catalog"
        :class="['effect', modelValue.url === effect.url && 'is-selected']"
        @click="() => emit('update:modelValue', effect)"
      >
        {{ effect.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.root {
  position: absolute;
  inset: 0;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  --effect-size: 4rem;

  .background,
  .drawer {
    width: var(--canvas-width);
  }

  .background {
    position: absolute;
    cursor: pointer;
    inset: 0;
    display: none;
    opacity: 0.25;
  }

  .drawer {
    position: absolute;
    display: flex;
    gap: 1rem;
    width: 100%;
    bottom: 0;
    max-height: 50vh;
    background-color: rgb(0, 0, 0, 0.25);

    pointer-events: all;
    transform: translateY(100%);
    transition: all 0.25s;
    padding: 2rem;
  }

  &.is-open {
    .background {
      display: block;
      pointer-events: all;
    }

    .drawer {
      transform: translateY(0);
    }
  }

  .effect {
    width: var(--effect-size);
    height: var(--effect-size);
    border: solid 0.25rem white;
    border-radius: 1rem;
    font-size: 1rem;

    &.is-selected {
      border-color: yellow;
    }
  }
}
</style>
