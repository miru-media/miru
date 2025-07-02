export const lerp = (from: number, to: number, weight: number) => from + (to - from) * weight

export const remap = (
  value: number,
  inputFrom: number,
  inputTo: number,
  outputFrom: number,
  outputTo: number,
  // eslint-disable-next-line @typescript-eslint/max-params -- --
): number => ((value - inputFrom) / (inputTo - inputFrom)) * (outputTo - outputFrom) + outputFrom

/** remap with input and output both from zero */
export const remap0 = (value: number, inputTo: number, outputTo: number) => (value / inputTo) * outputTo

export const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value
