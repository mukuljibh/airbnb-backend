import { Response } from 'express';
export function cookiePathAndNameGenerator(baseUrl: string) {
   const sessionOptions = {
      '/api/v1/guest': { sessionName: 'userSession', role: 'guest' },
      '/api/v1/host': { sessionName: 'userSession', role: 'host' },
      '/api/v1/admin': { sessionName: 'userSession', role: 'admin' },
   };
   const path = Object.keys(sessionOptions).find((key) =>
      baseUrl?.startsWith(key),
   );
   const { sessionName, role } = sessionOptions[path] || {};

   return { path, sessionName, role };
}

export function clearCookies(res: Response, baseUrl: string, ...sessions) {
   const { path } = cookiePathAndNameGenerator(baseUrl);
   sessions.forEach((session) => {
      res.clearCookie(session, {
         httpOnly: true,
         secure: process.env.ENVIRONMENT === 'PROD' ? true : false,
         sameSite: process.env.ENVIRONMENT === 'PROD' ? 'none' : 'lax',
         path,
      });
   });
}
