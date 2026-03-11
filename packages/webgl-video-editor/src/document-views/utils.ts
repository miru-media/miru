export const defineWrapperProps = <
  TTarget extends { prototype: TSource & Record<TSourceField, TSource> },
  TSource,
  TSourceField extends string,
>(
  Target: TTarget,
  keyToSource: TSourceField,
  props: (keyof TSource)[],
) => {
  for (const key of props)
    Object.defineProperty(Target.prototype, key, {
      get(this: TTarget['prototype']) {
        return this[keyToSource][key]
      },
      set(this: TTarget['prototype'], value: TSource[typeof key]) {
        ;(this[keyToSource][key] as any) = value
      },
      enumerable: true,
    })
}
