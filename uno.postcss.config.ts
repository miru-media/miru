import { defineConfig, presetIcons } from 'unocss'

export default defineConfig({
  presets: [presetIcons({})],
  content: { filesystem: ['src/**/*.{ts,tsx,js,jsx,css}'] },
})
