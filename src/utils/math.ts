export const lerp = (from: number, to: number, weight: number) => from + (to - from) * weight

/** remap with input and output both from zero */
export const remap0 = (value: number, inputTo: number, outputTo: number) => (value / inputTo) * outputTo
