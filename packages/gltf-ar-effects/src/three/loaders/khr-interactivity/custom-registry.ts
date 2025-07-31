import * as Behave from '@behave-graph/core'

export interface IRegistryEnv {
  getTypeName: (typeIndex: number) => string
  setProperty: (path: string[], value: unknown) => void
}

export class CustomRegistry extends Behave.Registry {
  public env: IRegistryEnv
  constructor(env: IRegistryEnv) {
    super()
    this.env = env
  }
}
