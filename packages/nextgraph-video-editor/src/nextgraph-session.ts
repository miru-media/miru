import { init as initNgWeb, ng } from '@ng-org/web'
import type { Session } from '@ng-org/web'

import { promiseWithResolvers } from 'shared/utils'

const initSession = async (): Promise<Session | undefined> => {
  const promise = promiseWithResolvers<Session | undefined>()

  await initNgWeb(
    (event: { session: Session; status: string }) => {
      const { session } = event

      ;(session as Partial<Session>).ng ??= ng
      promise.resolve(session)
    },
    true,
    [],
  )

  return await promise.promise
}

const sessionPromise = initSession()
export const getSession = (): Promise<Session | undefined> => sessionPromise
