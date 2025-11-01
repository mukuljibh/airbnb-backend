import { COOKIE_KEYS } from '../../constant/cookie.key.constant';

export function cookiePathAndNameGenerator(baseUrl: string) {
   const sessionOptions = {
      '/api/v1/guest': { sessionName: COOKIE_KEYS.GENERAL_SESSION, requestOrigin: 'guest' },
      '/api/v1/host': { sessionName: COOKIE_KEYS.GENERAL_SESSION, requestOrigin: 'host' },
      '/api/v1/admin': { sessionName: COOKIE_KEYS.ADMIN_SESSION, requestOrigin: 'admin' },
   } as const;


   const matchedPath = Object.keys(sessionOptions).find((key) =>
      baseUrl?.startsWith(key)
   );

   const options = matchedPath
      ? sessionOptions[matchedPath as keyof typeof sessionOptions]
      : { sessionName: 'defaultSession', requestOrigin: 'unknown' as const };

   const { sessionName, requestOrigin } = options;


   const cookiePath = requestOrigin === 'admin' ? '/api/v1/admin' : '/api/v1';

   return {
      path: cookiePath,
      sessionName,
      requestOrigin,
      cookieScope: matchedPath,
   };
}

export type SessionUserOptions = ReturnType<typeof cookiePathAndNameGenerator>;
export type SessionRequestOrigin = SessionUserOptions['requestOrigin']


