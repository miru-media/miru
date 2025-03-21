import { BaseNode } from './BaseNode'

export abstract class ParentNode extends BaseNode {
  abstract children: BaseNode[]

  _dispose() {
    const { children } = this
    children.forEach((child) => child.dispose())
    children.length = 0
  }
}
