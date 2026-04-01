import type { MediaEditorElement } from 'webgl-media-editor'
import 'webgl-media-editor'

import { downloadBlob } from 'shared/utils'

const editor = document.getElementById('editor') as MediaEditorElement
const fileInput = document.getElementById('file-input') as HTMLInputElement
const downloadButton = document.getElementById('download-button') as HTMLButtonElement
const backButton = document.getElementById('back-button') as HTMLButtonElement
const cancelButton = document.getElementById('cancel-button') as HTMLButtonElement

let inputFile: File | undefined

const toggleEmptyState = () => {
  editor.sources = []
  editor.editStates = []
  document.getElementById('empty-state')?.classList.toggle('hidden')
  document.getElementById('editor-container')?.classList.toggle('hidden')
}

const onInputFile = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  toggleEmptyState()
  inputFile = file
  editor.sources = [file]
  target.value = ''
}

const onClickDownload = (): void => {
  void editor.toBlob(0).then((blob) => downloadBlob(blob, `edit-${inputFile?.name ?? ''}`))
}

const onClickBack = (): void => {
  window.close()
  location.href = '/demos/'
}
const onClickCancel = toggleEmptyState

backButton.addEventListener('click', onClickBack)
fileInput.addEventListener('input', onInputFile)
cancelButton.addEventListener('click', onClickCancel)
downloadButton.addEventListener('click', onClickDownload)

import.meta.hot?.accept()
