import { useAsyncCallback, useI18n } from "shared/utils"
import type { MediaAsset } from "../assets/media-asset"
import { useEditor } from "./utils"
import { ScreenRecorder, ScreenRecorderCancelledError, ScreenRecorderFailedError, screenRecordingFileName } from "../assets/screen-recorder"
import { computed, onScopeDispose, ref } from "fine-jsx"
import styles from '../css/index.module.css'



export const AssetBinScreenRecordButton = (props: {onRecorded?: (asset: MediaAsset) => void}) => {
    const editor = useEditor()
    const { t } = useI18n()
    const recorder = ref<ScreenRecorder>()
    recorder.value ??= new ScreenRecorder()
    const isRecording = ref(false)

    onScopeDispose(() => recorder.value?.dispose())

    const label = computed(() => {
        if (isRecording.value) return t('asset_bin_screen_record_stop')
        return t('asset_bin_screen_record_start')
    })

    const [finishRecording, isFinishing] = useAsyncCallback(async () => {
        const activeRecorder = recorder.value
        if (!activeRecorder?.isRecording){
            isRecording.value = false
            return
        }

        try {
            const blob = await activeRecorder.stop()
            const file = new File([blob], screenRecordingFileName(blob?.type), {type: blob.type})
            const asset = await editor.createMediaAsset(file)
            props.onRecorded?.(asset as MediaAsset)
        }catch (error){
            if (error instanceof ScreenRecorderFailedError){
                // esling-disable-next-line no-alert -- TODO
                alert(t('error_cannot_record_Screen'))
            }
        } finally {
            isRecording.value = false
        }
    })

    const [startRecording, isStarting] = useAsyncCallback(async () => {
        const activeRecorder = recorder.value
        if (!activeRecorder) return

        try {
            await activeRecorder.start(() => {
                if (!isFinishing.value) finishRecording()
            })
            isRecording.value = true
        } catch (error) {
            if (error instanceof ScreenRecorderCancelledError) return
            // esling-disable-next-line no-alert -- TODO
            alert(t('error_cannot_record_screen'))
        }
    })

    const onClick = () => {
        if (isStarting.value || isFinishing.value) return
        if (isRecording.value) finishRecording()
        else startRecording()
    }

    if (!ScreenRecorder.isSupported()) return null

    return (
            <button
                type="button"
                aria-label={label}
                disabled={() => isStarting.value || isFinishing.value}
                onClick={onClick}
                class={() => [
                    styles.desktopControlsButton,
                    styles.assetBinScreenRecordButton
                ]}
            >
                {() => isRecording.value ? <IconMsStopRounded /> : <IconMsScreenRecordRounded />}
            </button>
    )
}