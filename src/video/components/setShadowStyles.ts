// eslint-disable-next-line import/no-unresolved
import css from 'virtual:video-shadow.css'

let styleSheet_: CSSStyleSheet | HTMLStyleElement | undefined

const getStyleSheet = () => {
  if (styleSheet_ == undefined) {
    try {
      styleSheet_ = new CSSStyleSheet()
      styleSheet_.replaceSync(css)
    } catch {
      styleSheet_ = document.createElement('style')
      styleSheet_.style.display = 'none'
      styleSheet_.textContent = css
    }
  }

  return styleSheet_
}

export const setShadowStyles = (root: ShadowRoot | Document) => {
  const styleSheet = getStyleSheet()

  if (styleSheet instanceof HTMLStyleElement) {
    ;('body' in root ? root.body : root).appendChild(styleSheet.cloneNode(true))
  } else {
    root.adoptedStyleSheets = [styleSheet]
  }
}

if (import.meta.hot != null && 'CSSStyleSheet' in window) {
  import.meta.hot.accept('../css/index.css?inline', (mod) => {
    if (mod == null) return import.meta.hot?.invalidate()
    if (!styleSheet_) return

    const newCss = (mod as unknown as { default: string }).default
    if (styleSheet_ instanceof HTMLStyleElement) styleSheet_.textContent = newCss
    else styleSheet_.replaceSync(newCss)
  })
}
