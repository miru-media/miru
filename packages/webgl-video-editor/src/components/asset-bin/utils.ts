import { computed, onScopeDispose, ref, type Ref } from 'fine-jsx'

import type * as pub from '#core'
import type { InputEvent } from 'shared/types.ts'
import { useI18n } from 'shared/utils/index.ts'

import { importMediaFiles, useEditor, useImportMediaFiles } from '../utils.ts'

export const useAssetList = <T extends pub.AnyAsset>(options: {
  filterAssets?: (asset: pub.AnyAsset) => asset is T
  type: 'audio' | 'video'
  fileInput: Ref<HTMLInputElement | undefined>
}) => {
  const editor = useEditor()
  const { t } = useI18n()
  const assets = ref<T[]>([])
  const importFromContext = useImportMediaFiles()
  const { filterAssets = (_asset: unknown): _asset is T => true } = options

  const update = (): void => {
    assets.value = [...editor.doc.assets.values()].filter(filterAssets)
  }
  const assetCreateOff = editor.doc.assets.on('asset:create', update)
  const assetDeleteOff = editor.doc.assets.on('asset:delete', update)
  onScopeDispose(() => {
    assetCreateOff()
    assetDeleteOff()
  })
  update()

  const search = ref('')
  const filtered = computed(() => {
    const searchValue = search.value.trim().toLowerCase()
    if (searchValue === '') return assets.value
    return assets.value.filter((asset) => (asset.name ?? '').toLowerCase().includes(searchValue))
  })

  const searchProps = {
    defaultValue: search,
    onInput: (event: InputEvent) => void (search.value = event.target.value),
  }

  const onClickUpload = async () => {
    if (importFromContext) {
      const files = await importFromContext(options.type)
      if (files.length === 0) return
      await importMediaFiles(editor, files, t)
      return
    }
    options.fileInput.value?.click()
  }

  const onInputFile = async (event: InputEvent) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    await importMediaFiles(editor, files, t)
  }

  return {
    assets,
    filtered,
    search,
    searchProps,
    onInputFile,
    importFromContext,
    onClickUpload,
  }
}
