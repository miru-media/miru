import { MaybeArray } from '@/types'
import { arrayFlatToValue } from '@/utils'

import {
  EffectScope,
  MaybeRef,
  MaybeRefOrGetter,
  Ref,
  createEffectScope,
  effect,
  isRef,
  onScopeDispose,
  toValue,
  watch,
} from './reactivity'

declare global {
  /** @internal */
  /* eslint-disable-next-line @typescript-eslint/no-namespace */
  export namespace JSX {
    type IntrinsicElements = Record<string, unknown>

    interface Element {
      el: Node
      scope: EffectScope
      type: Component | string
      [HNODE_MARKER]: true
    }
  }
}

type HNode = JSX.Element

type SingleHNodeChild = HNode | Node | string | number | boolean | Record<string, any>
type HNodeChild = MaybeArray<SingleHNodeChild>
type MaybeChild = HNodeChild | null | undefined

interface AppendedChild {
  hNode: MaybeChild
  domNode: Node
}

export type Stop = () => void

export type ComponentProps<Props = Record<string, unknown>, R = unknown> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [P in keyof Props]: Props[P] extends Function | Ref ? Props[P] : MaybeRef<Props[P]>
} & {
  ref?: Ref<R | undefined>
  children?: MaybeArray<MaybeRefOrGetter<HNodeChild | null | undefined>>
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Component<Props extends Record<string, unknown> = {}, R = unknown> = (
  props: ComponentProps<Props, R>,
) => HNode

const HNODE_MARKER = Symbol()

const isHNode = (value: any): value is HNode => !!value?.[HNODE_MARKER]
const isDomNode = (value: any): value is Node =>
  !!value &&
  typeof value.nodeType === 'number' &&
  Object.prototype.toString.call(value) !== '[opbject Object]'
const isTextNode = (value: any): value is Text => {
  return isDomNode(value) && value.nodeType === 3
}

const updateChildNode = (cur: MaybeChild, prev: AppendedChild | undefined) => {
  if (isHNode(cur)) return cur.el

  // return domeNodes directly without updating them. assume the parent controls all of its content
  if (isDomNode(cur)) return cur

  const prevTextNode = prev?.domNode
  const textNode = prevTextNode && isTextNode(prevTextNode) ? prevTextNode : new Text()

  if (!cur) textNode.nodeValue = ''
  else textNode.nodeValue = typeof cur === 'object' ? JSON.stringify(cur, null, '  ') : String(cur)

  return textNode
}

const unAppend = (child: AppendedChild, parent: Node) => {
  const { hNode, domNode } = child
  if (isHNode(hNode)) hNode.scope.stop()
  if (domNode.parentNode === parent) parent.removeChild(domNode)
}

const isIgnoredPropKey = (key: string) =>
  key === 'children' || key === 'ref' || key === 'innerHTML' || key === 'innerText'

const toClassName = (value: unknown): string => {
  value = toValue(value)
  if (Array.isArray(value)) return value.map(toClassName).join(' ')
  return value === false ? '' : String(value ?? '')
}

export const h = (type: string | Component, props: ComponentProps): HNode => {
  const scope = createEffectScope()

  return scope.run((): HNode => {
    if (typeof type === 'function') {
      const hNode = type(props)

      return { ...hNode, type, scope }
    }

    return scope.run(() => createElementHNode(type, props, scope))
  })
}

const createElementHNode = (type: string, props: ComponentProps, scope: EffectScope): HNode => {
  const appendedNodes: AppendedChild[] = []
  const element = document.createElement(type)

  const hNode: HNode = {
    el: element,
    type,
    scope,
    [HNODE_MARKER]: true,
  }

  scope.run(() => {
    const { children } = props

    if (children) {
      // TODO: use fragments instead of flattening?
      watch([() => arrayFlatToValue(children)], ([children]) => {
        children.forEach((child, childIndex) => {
          const prevAppended: AppendedChild | undefined = appendedNodes[childIndex]

          const domNode = updateChildNode(child, prevAppended)
          // insert the new child at the position of the previous node (which may be the same)
          element.insertBefore(domNode, prevAppended?.domNode || null)

          if ((isHNode(child) && child !== prevAppended?.hNode) || domNode !== prevAppended?.domNode) {
            // remove the previous child if it changed
            if (prevAppended) unAppend(prevAppended, element)

            // update the list of appended children
            appendedNodes[childIndex] = { hNode: child, domNode }
          }
        })

        // if there are fewer children than before, unmount the extra from before
        for (let i = children.length; i < appendedNodes.length; i++) unAppend(appendedNodes[i], element)
      })

      onScopeDispose(() => {
        appendedNodes.length = 0
        hNode.el = undefined as never
        if (props.ref) props.ref.value = undefined
      })
    }

    effect(() => {
      for (const key in props) {
        if (isIgnoredPropKey(key)) continue

        const value = props[key]
        const first2Chars = key.slice(0, 2)

        if (first2Chars === 'a:') {
          const attrName = key.slice(2)
          element.setAttribute(attrName, toValue(value) as string)
        } else if (first2Chars === 'on') {
          ;(element as any)[key.toLowerCase()] = isRef(value) ? value.value : value
        } else if (key === 'class') {
          element.className = toClassName(value)
        } else if (key === 'style' || !(key in element)) {
          element.setAttribute(key, toValue(value) as string)
        } else {
          ;(element as any)[key] = toValue(value)
        }
      }
    })

    // component is to be unmounted
    // assume a parent component will remove it from the DOM
    onScopeDispose(() => {
      for (let key in props) {
        if (isIgnoredPropKey(key) || key.startsWith('a:')) continue
        if (key.startsWith('on')) key = key.toLowerCase()
        if (key in element) (element as any)[key] = null
        else element.removeAttribute(key)
      }
    })
  })

  if (props.ref) props.ref.value = element

  return hNode
}

export const render = (node: HNode, root: ParentNode): Stop => {
  if (!root) throw new Error(`[miru] No root to render into`)

  root.appendChild(node.el)

  return () => {
    node.scope.stop()
    root.removeChild(node.el)
  }
}

export { h as jsx, h as jsxs }
