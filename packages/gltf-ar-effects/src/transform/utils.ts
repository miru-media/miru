export const isSingleLiteral = (value: unknown): value is string | number | boolean | null =>
  value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
