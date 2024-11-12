export const lerp = (from: number, to: number, weight: number) => from + (to - from) * weight

export const remap = (
  value: number,
  inputFrom: number,
  inputTo: number,
  outputFrom: number,
  outputTo: number,
) => ((value - inputFrom) / (inputTo - inputFrom)) * (outputTo - outputFrom) + outputFrom

/** remap with input and output both from zero */
export const remap0 = (value: number, inputTo: number, outputTo: number) => (value / inputTo) * outputTo
