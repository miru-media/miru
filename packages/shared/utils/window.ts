export const win = typeof window !== 'undefined' ? window : globalThis
export const HTMLElementOrStub = ((win.HTMLElement as unknown) ?? Object) as typeof window.HTMLElement
