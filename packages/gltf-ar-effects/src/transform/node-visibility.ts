import * as gltf from '@gltf-transform/core'
import type { IProperty } from '@gltf-transform/core'

import { KHR_NODE_VISIBILITY } from '../constants.ts'

export class KHRNodeVisibility extends gltf.Extension {
  public static readonly EXTENSION_NAME: typeof KHR_NODE_VISIBILITY = KHR_NODE_VISIBILITY
  public readonly extensionName: typeof KHR_NODE_VISIBILITY = KHR_NODE_VISIBILITY

  createVisibility(): Visibility {
    return new Visibility(this.document.getGraph())
  }

  read(context: gltf.ReaderContext): this {
    context.jsonDoc.json.nodes?.forEach((nodeDef, nodeIndex) => {
      const visibility = nodeDef.extensions?.[KHR_NODE_VISIBILITY] as { visible?: boolean } | undefined

      if (visibility?.visible === false) {
        context.nodes[nodeIndex].setExtension(KHR_NODE_VISIBILITY, this.createVisibility())
      }
    })
    return this
  }

  write(context: gltf.WriterContext): this {
    const { jsonDoc } = context

    this.document
      .getRoot()
      .listNodes()
      .forEach((node) => {
        const visibility = node.getExtension<Visibility>(KHR_NODE_VISIBILITY)

        if (visibility?.getVisible() === false) {
          const nodeDef = jsonDoc.json.nodes![context.nodeIndexMap.get(node)!]
          const nodeVisibility = ((nodeDef.extensions ??= {})[KHR_NODE_VISIBILITY] ??= {}) as {
            visible: boolean
          }
          nodeVisibility.visible = false
        }
      })

    return this
  }
}

interface IVisibility extends IProperty {
  visible: boolean
}

export class Visibility extends gltf.ExtensionProperty<IVisibility> {
  public static EXTENSION_NAME: typeof KHR_NODE_VISIBILITY = KHR_NODE_VISIBILITY
  declare public extensionName: typeof KHR_NODE_VISIBILITY
  declare public propertyType: 'Visibility'
  declare public parentTypes: [gltf.PropertyType.NODE]

  protected init(): void {
    this.extensionName = KHR_NODE_VISIBILITY
    this.propertyType = 'Visibility'
    this.parentTypes = [gltf.PropertyType.NODE]
  }

  setVisible(visible: boolean): this {
    return this.set('visible', visible)
  }

  getVisible(): boolean {
    return this.get('visible')
  }
}
