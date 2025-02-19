export const win = typeof window !== 'undefined' ? window : globalThis
export const HTMLElement = ((win.HTMLElement as unknown) ?? Object) as typeof window.HTMLElement
