export const win = /* @__PURE__ */ typeof window === 'undefined' ? globalThis : window
export const HTMLElementOrStub = /* @__PURE__ */ ((win as Partial<typeof win>).HTMLElement ??
  Object) as typeof HTMLElement
