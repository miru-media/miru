import { useLocalStorage } from '@vueuse/core'
import { reactive } from 'vue'

const hasSeenIntro = useLocalStorage('video-editor:has-seen-info-modal', 0)

export const state = reactive({ hasSeenIntro, showInfo: false })
