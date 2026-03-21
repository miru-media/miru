export const lerp = (from: number, to: number, weight: number) => from + (to - from) * weight

export const remap = (
  value: number,
  inputFrom: number,
  inputTo: number,
  outputFrom: number,
  outputTo: number,
  // eslint-disable-next-line @typescript-eslint/max-params -- --
): number => ((value - inputFrom) / (inputTo - inputFrom)) * (outputTo - outputFrom) + outputFrom

/**
 * Remap with input and output both from zero
 *
 * @param value
 * @param inputTo
 * @param outputTo
 */
export const remap0 = (value: number, inputTo: number, outputTo: number) => (value / inputTo) * outputTo

export const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value

export const greatestCommonDivisor = (a: number, b: number) => {
  const absA = Math.abs(a)
  const absB = Math.abs(b)
  const aIsLess = absA < absB
  let lesser = aIsLess ? absA : absB
  let greater = aIsLess ? absB : absA

  while (lesser) {
    const temp = lesser
    lesser = greater % lesser
    greater = temp
  }

  return greater
}

interface RationalLike {
  value: number
  rate: number
}

export class Rational {
  value: number
  rate: number

  constructor(numerator: number, denominator: number) {
    this.value = numerator
    this.rate = denominator
  }

  add(other: RationalLike): Rational {
    if (this.rate === other.rate) return new Rational(this.value + other.value, this.rate)
    return Rational.simplified(this.value * other.rate + other.value * this.rate, this.rate * other.rate)
  }

  subtract(other: RationalLike): Rational {
    if (this.rate === other.rate) return new Rational(this.value - other.value, this.rate)
    return Rational.simplified(this.value * other.rate - other.value * this.rate, this.rate * other.rate)
  }

  toRate(rate: number): Rational {
    return new Rational(Math.round((this.value / this.rate) * rate), rate)
  }

  compare(other: RationalLike): number {
    const a = this.value * other.rate
    const b = other.value * this.rate

    return a - b
  }

  isLessThan(other: RationalLike): boolean {
    return this.compare(other) < 0
  }

  isGreaterThan(other: RationalLike): boolean {
    return this.compare(other) > 0
  }

  isEqualTo(other: RationalLike): boolean {
    return this.compare(other) === 0
  }

  isLte(other: RationalLike): boolean {
    return this.compare(other) <= 0
  }

  isGte(other: RationalLike): boolean {
    return this.compare(other) >= 0
  }

  clamp(min: RationalLike, max: RationalLike): Rational {
    return this.isLessThan(min) ? Rational.from(min) : this.isGreaterThan(max) ? Rational.from(max) : this
  }

  valueOf(): number {
    return this.value / this.rate
  }

  toJSON(): { value: number; rate: number } {
    return { rate: this.rate, value: this.value }
  }

  toOTIO(): { OTIO_SCHEMA: 'RationalTime.1'; rate: number; value: number } {
    return { OTIO_SCHEMA: 'RationalTime.1', rate: this.rate, value: this.value }
  }

  static simplified = (value: number, rate: number): Rational => {
    const gcd = greatestCommonDivisor(value, rate)
    return new Rational(value / gcd, rate / gcd)
  }

  static from = (rational: RationalLike): Rational =>
    rational instanceof Rational ? rational : new Rational(rational.value, rational.rate)

  static fromDecimal = (decimal: number, rate: number): Rational =>
    new Rational(Math.round(decimal * rate), rate)

  static min = (a: Rational, b: Rational): Rational => (a.isLte(b) ? a : b)

  static max = (a: Rational, b: Rational): Rational => (a.isGte(b) ? a : b)

  static ZERO = new Rational(0, 1)
}
