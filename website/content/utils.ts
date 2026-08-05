export const navigateBack = () => {
  if ((navigator as Navigator & { canGoBack: boolean }).canGoBack) history.back()
  else {
    window.close()
    location.href = '/demos/'
  }
}
