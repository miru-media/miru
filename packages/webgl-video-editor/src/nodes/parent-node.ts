import { BaseNode } from './base-node.ts'

export abstract class ParentNode extends BaseNode {
  abstract children: BaseNode[]

  constructor(id: string, parent: ParentNode | undefined) {
    super(id, parent)

    this.onDispose(() => {
      const { children } = this
      children.forEach((child) => child.dispose())
      children.length = 0
    })
  }
}
