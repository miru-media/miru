import type * as MediaPipe from '@mediapipe/tasks-vision'

export interface WorkerInitData {
  type: 'INIT'
  wasmFileset: {
    wasmLoaderPath: string
    wasmBinaryPath: string
  }
  mediaPipeTasksVisionUrl: string
  modelAssetPath: string
}

export interface WorkerFetchProgressData {
  type: 'fetch-progress'
  progress: number
  error?: unknown
}

export interface WorkerResultData {
  type: 'result'
  result?: MediaPipe.FaceLandmarkerResult
  error?: unknown
  timestamp: number
}

export interface WorkerFrameData {
  type: 'frame'
  image: VideoFrame
  timestamp: number
}

export interface WorkerErrorData {
  type: 'error'
  error: unknown
}

let landmarker: MediaPipe.FaceLandmarker | undefined
;(self as unknown as { dbg: (...args: unknown[]) => void }).dbg = console.debug

Object.defineProperty(self, 'module', { value: self })
Object.defineProperty(self, 'exports', {
  get: () => ({}),
  set: (ModuleFactory: unknown) => ((self as any).ModuleFactory = ModuleFactory),
})

const postMessage = self.postMessage as (
  data: WorkerResultData | WorkerFetchProgressData | WorkerErrorData,
) => void

onmessage = async (event: MessageEvent<WorkerInitData | WorkerFrameData>) => {
  const { data } = event

  switch (data.type) {
    case 'INIT': {
      const { wasmFileset, mediaPipeTasksVisionUrl, modelAssetPath } = data

      try {
        const response = await fetch(modelAssetPath)

        if (!response.ok || !response.body)
          throw new Error(`Couldn't load face detection model. ${response.status} ${response.statusText}.`)

        const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10) || 3758596

        let receivedLength = 0
        const teedBody = response.body.tee()

        teedBody[0]
          .pipeTo(
            new WritableStream({
              write: (chunk) => {
                receivedLength += chunk.byteLength
                const progress = Math.min(receivedLength / contentLength, 1)
                postMessage({ type: 'fetch-progress', progress })
              },
            }),
          )
          .then(() => postMessage({ type: 'fetch-progress', progress: 1 }))
          .catch((error: unknown) => postMessage({ type: 'error', error }))

        const { FaceLandmarker } = (await import(
          /* @vite-ignore */ mediaPipeTasksVisionUrl
        )) as typeof MediaPipe

        const landmarker_ = await FaceLandmarker.createFromModelBuffer(wasmFileset, teedBody[1].getReader())
        await landmarker_.setOptions({
          baseOptions: { modelAssetPath },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 2,
        })
        landmarker = landmarker_
      } catch (error) {
        postMessage({ type: 'error', error })
      }
      break
    }
    case 'frame':
      {
        const { image, timestamp } = data

        if (!landmarker) {
          postMessage({ type: 'result', result: undefined, timestamp })
          return
        }

        try {
          const result = landmarker.detectForVideo(image, timestamp)
          image.close()
          postMessage({ type: 'result', result, timestamp })
        } catch (error) {
          postMessage({ type: 'result', error, timestamp })
        }
      }
      break
  }
}
