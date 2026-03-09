import { initNg } from '@ng-org/orm'
import { init as initNgWeb, ng, type Session } from '@ng-org/web'

import { promiseWithResolvers } from 'shared/utils'

const initSession = async (): Promise<Session | undefined> => {
  const promise = promiseWithResolvers<Session | undefined>()

  await initNgWeb(
    (event: { session: Session; status: string }) => {
      const { session } = event

      initNg(ng, session)
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
