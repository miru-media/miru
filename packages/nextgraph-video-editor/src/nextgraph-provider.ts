/* eslint-disable @typescript-eslint/no-unsafe-call -- missing types */
import * as base64 from 'base64-js'
import * as Y from 'yjs'

import { promiseWithResolvers } from 'shared/utils'

const { log, error: logError } = console

export const digestToString = (digest: { Blake3Digest32: Uint8Array }): string => {
  const bytes = Uint8Array.from([0, ...digest.Blake3Digest32].reverse())
  return base64.fromByteArray(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export class NextGraphProvider {
  readonly nuri: string
  doc: Y.Doc
  session: any
  heads: string[] = []
  shouldConnect = false
  isConnected = false

  readonly #destroy = this.destroy.bind(this)
  readonly #updateHandler = this._updateHandler.bind(this)
  readonly #connectedPromise = promiseWithResolvers()

  get whenConnected(): Promise<this> {
    return this.#connectedPromise.promise.then(() => this)
  }

  constructor(nuri: string, doc: Y.Doc, session: any) {
    // if (!session.ng) return
    this.nuri = nuri
    this.doc = doc
    this.session = session

    this.doc.on('update', this.#updateHandler)
    this.doc.on('destroy', this.#destroy)
    this.connect()
  }

  sendUpdate(update: Uint8Array): void {
    this.session.ng.discrete_update(this.session.session_id, update, this.heads, 'YMap', this.nuri)
  }

  /**
   * Listens to Yjs updates and sends them to NextGraph
   * @param {Uint8Array} update
   * @param {any} origin
   */
  _updateHandler(update: Uint8Array, origin: any): void {
    if (!this.isConnected || origin?.local === true) return

    try {
      log(this.heads)
      this.sendUpdate(update)
    } catch (error) {
      logError(error)
    }
  }

  destroy(): void {
    this.disconnect()
    //this.awareness.off('update', this._awarenessUpdateHandler)
    this.doc.off('update', this.#updateHandler)
  }

  disconnect(): void {
    this.shouldConnect = false
    // TODO unsub
  }

  connect(): void {
    const docIdLength = 53
    const docId = this.nuri.slice(0, docIdLength)

    log('connecting to doc', docId)
    if (this.shouldConnect) return

    this.shouldConnect = true

    this.session.ng.doc_subscribe(docId, this.session.session_id, this.onResponse.bind(this))
    // TODO .then keep unsub
  }

  onResponse(response: {
    V0: { TabInfo?: Record<string, unknown>; State?: Record<string, any>; Patch?: Record<string, any> }
  }): void {
    log('GOT APP RESPONSE', response)

    if (response.V0.TabInfo) {
      // noop
    } else if (response.V0.State) {
      for (const head of response.V0.State.heads) {
        const commitId = digestToString(head)
        this.heads.push(commitId)
      }

      const incomingStateAsUpdate = response.V0.State.discrete?.YMap as Uint8Array | undefined
      if (incomingStateAsUpdate) Y.applyUpdate(this.doc, incomingStateAsUpdate, { local: true })

      // send the difference between the locally saved doc and the incoming state
      this.sendUpdate(
        Y.encodeStateAsUpdate(
          this.doc,
          incomingStateAsUpdate && Y.encodeStateVectorFromUpdate(incomingStateAsUpdate),
        ),
      )

      this.#connectedPromise.resolve()
      this.isConnected = true
    } else if (response.V0.Patch) {
      const patchUpdate = response.V0.Patch.discrete?.YMap as Uint8Array | undefined
      if (patchUpdate) Y.applyUpdate(this.doc, patchUpdate, { local: true })

      let i = this.heads.length
      while (i--) {
        if (response.V0.Patch.commit_info.past.includes(this.heads[i]) === true) this.heads.splice(i, 1)
      }

      this.heads.push(response.V0.Patch.commit_id)
    }
  }
}
