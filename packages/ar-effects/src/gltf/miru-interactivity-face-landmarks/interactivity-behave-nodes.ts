import * as Behave from '@behave-graph/core'

import { MAX_LANDMARK_FACES } from '../../constants'

export class EventOnFaceLandmarksChangeNode extends Behave.EventNode {
  static OP = 'faceLandmarks/change'

  faceId: number

  get key() {
    return `${this.description.typeName}:${this.faceId}`
  }

  constructor(description: Behave.NodeDescription, graph: Behave.Graph, config: Behave.NodeConfiguration) {
    const { faceId } = config

    if (
      typeof faceId !== 'number' ||
      !Number.isInteger(faceId) ||
      Number.isNaN(faceId) ||
      faceId < 0 ||
      faceId > MAX_LANDMARK_FACES
    )
      throw new Error(`Invalid faceId of "${faceId}"`)

    super(
      description,
      graph,
      [],
      [
        new Behave.Socket('flow', 'flow:out', undefined, `${description.label} (${faceId}) flow`),
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

  init(_engine: Behave.Engine): void {
    return
  }
}
