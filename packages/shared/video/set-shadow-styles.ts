import css from 'virtual:video-shadow.css'

let styleSheet_: CSSStyleSheet | HTMLStyleElement | undefined

const getStyleSheet = () => {
  if (styleSheet_ == null) {
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

export const setShadowStyles = (shadow: ShadowRoot) => {
  const styleSheet = getStyleSheet()

  if (styleSheet instanceof HTMLStyleElement) {
    shadow.appendChild(styleSheet.cloneNode(true))
  } else {
    shadow.adoptedStyleSheets = [styleSheet]
  }
}

if (import.meta.hot && 'CSSStyleSheet' in window) {
  import.meta.hot.accept('../../webgl-video-editor/src/index.css?inline', (mod) => {
    if (mod == null) import.meta.hot?.invalidate()
    if (styleSheet_ == null) return undefined
    else if (styleSheet_ instanceof HTMLStyleElement) return undefined
    else styleSheet_.replaceSync((mod as unknown as { default: string }).default)
  })
}
