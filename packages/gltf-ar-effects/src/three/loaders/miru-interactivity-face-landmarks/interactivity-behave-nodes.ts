import * as Behave from '@behave-graph/core'

import { LandmarkOps, MAX_LANDMARK_FACES } from '../../../constants'

const assertIsValidFaceId = (faceId: unknown): number => {
  if (
    typeof faceId !== 'number' ||
    !Number.isInteger(faceId) ||
    Number.isNaN(faceId) ||
    faceId < 0 ||
    faceId > MAX_LANDMARK_FACES
  )
    throw new Error(`Invalid faceId of "${String(faceId)}"`)

  return faceId
}

export class LandmarksFaceNode extends Behave.EventNode {
  static OP = LandmarkOps.Face as const

  faceId: number

  constructor(description: Behave.NodeDescription, graph: Behave.Graph, config: Behave.NodeConfiguration) {
    const faceId = assertIsValidFaceId(config.faceId)

    super(
      description,
      graph,
      [],
      [
        new Behave.Socket('flow', 'flow:start', undefined, `${description.label} (${faceId}) update`),
        new Behave.Socket('flow', 'flow:change', undefined, `${description.label} (${faceId}) update`),
        new Behave.Socket('flow', 'flow:end', undefined, `${description.label} (${faceId}) update`),
        ...[
          { name: 'translation', type: 'float3' },
          { name: 'rotation', type: 'float4' },
          { name: 'scale', type: 'float3' },
        ].map(
          ({ name, type }) =>
            new Behave.Socket(type, `value:${name}`, undefined, `${description.label} (${faceId}) ${name}`),
        ),
      ],
      config,
    )

    this.faceId = faceId
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this, @typescript-eslint/no-empty-function -- stubs */
  init(_engine: Behave.Engine): void {}
  dispose(_engine: Behave.Engine): void {}
  /* eslint-enable @typescript-eslint/class-methods-use-this, @typescript-eslint/no-empty-function */
}
