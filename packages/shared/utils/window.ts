export const win = /* @__PURE__ */ typeof window !== 'undefined' ? window : globalThis
export const HTMLElementOrStub = /* @__PURE__ */ ((win.HTMLElement as unknown) ??
  Object) as typeof window.HTMLElement
