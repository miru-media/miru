<script setup lang="ts">
interface Effect {
  name: string
  url: string
}

defineProps<{ modelValue: Effect; options: Effect[]; open: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Effect]; 'update:open': [boolean] }>()
</script>

<template>
  <div :class="['root', open && 'is-open']">
    <div class="background" @click="() => emit('update:open', false)"></div>
    <div class="drawer">
      <slot />
      <div class="effect-list">
        <button
          v-for="effect of options"
          :class="['effect', modelValue.url === effect.url && 'is-selected']"
          @click="() => emit('update:modelValue', effect)"
        >
          {{ effect.name }}
        </button>
      </div>
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
    width: 100%;
    bottom: 0;
    background-color: rgb(0, 0, 0, 0.25);

    pointer-events: all;
    transform: translateY(100%);
    transition: all 0.25s;
  }

  .effect-list {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    width: 100%;
    max-height: 30vh;
    overflow-y: auto;
    overflow-x: hidden;
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
    word-wrap: break-word;
    cursor: pointer;
    color: white;

    &.is-selected {
      border-color: yellow;
    }
  }
}
</style>
