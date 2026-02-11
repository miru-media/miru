import { init as initNgWeb, ng } from '@ng-org/web'
import type { NG } from '@ng-org/web'

import { promiseWithResolvers } from 'shared/utils'

const initSession = async (): Promise<NextGraphSession | undefined> => {
  const promise = promiseWithResolvers<NextGraphSession | undefined>()

  await initNgWeb(
    (event: any) => {
      const { session } = event

      session!.ng ??= ng
      promise.resolve(session)

      // initNgSignals(ng, session!)
    },
    true,
    [],
  )

  return await promise.promise
}

const sessionPromise = initSession()
export const getSession = async () => await sessionPromise

export interface NextGraphSession {
  ng: typeof NG
  session_id: string
  protected_store_id: string
  private_store_id: string
  public_store_id: string
  [key: string]: unknown
}
