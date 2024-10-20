import { MaybeArray } from '@/types'
import { arrayFlatToValue, toKebabCase } from '@/utils'

import {
  createEffectScope,
  effect,
  EffectScope,
  getCurrentScope,
  isRef,
  MaybeRef,
  MaybeRefOrGetter,
  onScopeDispose,
  Ref,
  toValue,
  watch,
} from './reactivity'
import { SVG_TYPES } from './svgTypes'

declare global {
  /** @internal */
  /* eslint-disable-next-line @typescript-eslint/no-namespace */
  export namespace JSX {
    type IntrinsicElements = Record<string, unknown>

    interface Element {
      el: Node | DocumentFragment
      marker?: Node
      scope?: EffectScope
      type: Component | string
      [HNODE_MARKER]: true
    }
  }

  export interface DocumentFragment {
    /** @internal */
    [HNODE_MARKER]: Comment
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
const isDocFrag = (value: Node | DocumentFragment | undefined): value is DocumentFragment =>
  value?.nodeType === 11

const updateChildNode = (cur: MaybeChild, prev: AppendedChild | undefined) => {
  if (isHNode(cur)) return cur.el

  // return domeNodes directly without updating them. assume the parent controls all of its content
  if (isDomNode(cur)) return cur

  const prevTextNode = prev?.domNode
  const textNode = prevTextNode && isTextNode(prevTextNode) ? prevTextNode : new Text()

  if (cur === false || cur == null) textNode.nodeValue = ''
  else if (typeof cur === 'object') textNode.nodeValue = JSON.stringify(cur, null, '  ')
  else textNode.nodeValue = String(cur)

  return textNode
}

const unappend = (child: AppendedChild, parent: Node) => {
  const { domNode } = child
  if (domNode.parentNode === parent) parent.removeChild(domNode)
}
const unappendAndStop = (child: AppendedChild, parent: Node) => {
  const { hNode } = child

  unappend(child, parent)
  if (isHNode(hNode)) hNode.scope?.stop()
}

const isIgnoredPropKey = (key: string) =>
  key === 'children' || key === 'ref' || key === 'innerHTML' || key === 'innerText'

const toClassName = (value: unknown): string => {
  value = toValue(value)
  if (Array.isArray(value)) return value.map(toClassName).join(' ')
  return value === false ? '' : String(value ?? '')
}

export const h = (type: string | Component, props: ComponentProps): JSX.Element => {
  if (typeof type === 'function') {
    const scope = createEffectScope()
    const hNode = scope.run(() => type(props))

    return { ...hNode, type, scope }
  }

  return createElementHNode(type, props)
}

const createElementHNode = (type: string, props: ComponentProps): HNode => {
  const appendedNodes: AppendedChild[] = []

  const isSvg = SVG_TYPES.has(type)
  let element: Element | DocumentFragment
  let marker: Comment | null = null

  if (type === '#fragment') {
    element = document.createDocumentFragment()
    marker = new Comment(import.meta.env.PROD ? '' : 'fragment')
    element.appendChild(marker)
    element[HNODE_MARKER] = marker
  } else {
    element = isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', type)
      : document.createElement(type)
  }

  const hNode: HNode = {
    el: element,
    type,
    scope: undefined,
    [HNODE_MARKER]: true,
  }

  const parentScope = getCurrentScope()

  if (!parentScope) throw new Error(`[miru] jsx element must be created within an EffectScope`)

  if (props.children) {
    watch([() => parentScope.run(() => arrayFlatToValue(props.children))], ([children]) => {
      const appendTo = marker?.parentNode ?? element

      children.forEach((child, childIndex) => {
        const prevAppended = appendedNodes[childIndex] as AppendedChild | undefined
        const prevDomNode = prevAppended?.domNode

        const domNode = updateChildNode(child, prevAppended)
        // insert the new child at the position of the previous node (which may be the same)
        const beforeNode = isDocFrag(appendTo)
          ? null
          : ((isDocFrag(prevDomNode) ? prevDomNode[HNODE_MARKER] : prevDomNode) ?? marker?.nextElementSibling)
        if (beforeNode?.parentNode === appendTo) appendTo.insertBefore(domNode, beforeNode)
        else appendTo.appendChild(domNode)

        if ((isHNode(child) && child !== prevAppended?.hNode) || domNode !== prevAppended?.domNode) {
          // remove the previous child if it changed
          if (prevAppended) unappendAndStop(prevAppended, appendTo)

          // update the list of appended children
          appendedNodes[childIndex] = { hNode: child, domNode }
        }
      })

      // if there are fewer children than before, unmount the extra from before
      for (let i = children.length; i < appendedNodes.length; i++) unappendAndStop(appendedNodes[i], appendTo)
    })

    onScopeDispose(() => {
      if (isDocFrag(element)) {
        const parentNode = marker!.parentNode
        marker!.remove()
        if (parentNode) appendedNodes.forEach((node) => unappend(node, parentNode))
      }

      appendedNodes.length = 0
      hNode.el = undefined as never
      if (props.ref) props.ref.value = undefined
    })
  }

  if (isDocFrag(element)) return hNode

  effect(() => {
    for (const key in props) {
      if (isIgnoredPropKey(key)) continue

      const value = props[key]
      const first2Chars = key.slice(0, 2)

      if (first2Chars === 'on') {
        ;(element as any)[key.toLowerCase()] = isRef(value) ? value.value : value
      } else if (key === 'class') {
        element.setAttribute('class', toClassName(value))
      } else if (isSvg) {
        const svgKey = key === 'viewBox' ? key : toKebabCase(key)
        element.setAttribute(svgKey, String(toValue(value)))
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
    for (const key in props) {
      if (isIgnoredPropKey(key)) continue

      if (key.startsWith('on')) {
        ;(element as any)[key.toLowerCase()] = null
        continue
      }

      if (isSvg) {
        const svgKey = key === 'viewBox' ? key : toKebabCase(key)
        element.removeAttribute(svgKey)
        continue
      }

      if (key in element && key !== 'style') (element as any)[key] = null
      else element.removeAttribute(key)
    }
  })

  if (props.ref) props.ref.value = element

  return hNode
}

export const Fragment = (props: { children: HNodeChild[] }) => h('#fragment', props)

export const render = (node: JSX.Element, root: ParentNode): Stop => {
  if (!(root as ParentNode | undefined)) throw new Error(`[miru] No root to render into`)

  root.appendChild(node.el)

  return () => {
    node.scope?.stop()
    root.removeChild(node.el)
  }
}

export { h as jsx, h as jsxs }
