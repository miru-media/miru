export class ScreenRecorderCancelledError extends Error {
    constructor() {
        super('Screen recording was cancelled')
        this.name = 'ScreenRecorderCancelledError'
    }
}

export class ScreenRecorderFailedError extends Error {
    constructor(cause?: unknown) {
        super('Screen recording failed', { cause })
        this.name = 'ScreenRecorderFailedError'
    }
}

const isUserCancellation = (error: unknown): boolean => error instanceof DOMException && error.name == 'NotAllowedError'

const stopStreamTracks = (stream: MediaStream | undefined): void => {
    stream?.getTracks().forEach((track) => track.stop())
}

export const screenRecordingFileName = (mimeType: string): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const extension = mimeType.includes('webm') ? 'webm' : 'mp4'
    return `screen-recording-${timestamp}.${extension}`
}

export class ScreenRecorder {
    #stream?: MediaStream
    #recorder?: MediaRecorder
    #chunks: Blob[] = []
    #onEnded?: () => void

    static isSupported(): boolean {
        return (
            typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
            typeof MediaRecorder !== 'undefined'
        )
    }

    get isRecording(): boolean {
        return !!this.#recorder
    }

    async start(onEnded?: () => void): Promise<void> {
        if (this.isRecording) throw new Error ('Screen recording is already in progress')
        
        this.#onEnded = onEnded

        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true})
        } catch (error) {
            if (isUserCancellation(error)) throw new ScreenRecorderCancelledError()
            throw new ScreenRecorderFailedError(error)
        }

        let recorder: MediaRecorder
        try {
            recorder = new MediaRecorder(stream)
        }catch (error) {
            stopStreamTracks(stream)
            throw new ScreenRecorderFailedError(error)
        }

        this.#stream = stream
        this.#recorder = recorder
        this.#chunks = []

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) this.#chunks.push(event.data)
        }

        recorder.start()

        const videoTrack = stream.getVideoTracks()[0]
        if  (videoTrack) {
            videoTrack.addEventListener('ended', ()=> this.#onEnded?.(), {once: true})
        }
    }

    async stop(): Promise<Blob> {
        const recorder = this.#recorder
        if (!recorder) throw new Error('No screen recording in progress')
        
        try {
            await new Promise<void>((resolve, reject) => {
                recorder.onstop = () => resolve()
                recorder.onerror = () => reject(new ScreenRecorderFailedError())
                recorder.stop()
            })

            return new Blob(this.#chunks, { type: recorder.mimeType})
        } finally {
            this.#reset()
        }
    }

    dispose(): void {
        if (this.#recorder?.state === 'recording') this.#recorder.stop()
        this.#reset()
    }

    #reset(): void {
        stopStreamTracks(this.#stream)
        this.#stream = undefined
        this.#recorder = undefined
        this.#chunks = []
        this.#onEnded = undefined
    }
}