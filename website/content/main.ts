import 'virtual:uno.css'
import 'prism-themes/themes/prism-coldark-dark.css'

const handleMobileNav = (): void => {
  const mobileToggle = document.querySelector('[data-mobile-toggle]')
  const navigation = document.querySelector('[data-navigation]')

  if (!mobileToggle || !navigation) return

  mobileToggle.addEventListener('click', () => {
    navigation.classList.toggle('open')
    mobileToggle.classList.toggle('active')
  })

  document.documentElement.addEventListener('click', (event) => {
    const target = event.target as Element
    if (!mobileToggle.contains(target) && !navigation.contains(target)) {
      navigation.classList.remove('open')
      mobileToggle.classList.remove('active')
    }
  })
}

if (document.readyState === 'complete') handleMobileNav()
else document.addEventListener('DOMContentLoaded', handleMobileNav)
