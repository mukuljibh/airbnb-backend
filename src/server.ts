import 'dotenv/config';

import express, { Application } from 'express';
import { Request, Response } from 'express';
import cors from 'cors';
import connectDatabase from './api/v1/config/db';
// import fs from 'fs';
// import https from 'https';
import http from 'http';
import router from './api/v1/routes/index';
import cookieParser from 'cookie-parser';
import { Cookie, Session } from 'express-session';
import MongoStore from 'connect-mongo';
import { passportConfig } from './api/v1/config/passport';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './../swagger.json';
// import { auth } from "./app/Middlewares";
import path from 'path';
import passport from 'passport';
import { ApiError } from './api/v1/utils/error-handlers/ApiError';
import { ISessionUser } from './api/v1/models/user/types/user.model.types';
import { sessionConfig } from './api/v1/config/session';
import { stopPolling } from './api/v1/events/reservation/reservation.emitter';
const version = '0.0.1';
const jsonParser = express.json();

export const mongoStoreSession = MongoStore.create({
   mongoUrl: process.env.MONGO_URL,
   collectionName: 'sessions',
});

export interface ISession extends Session {
   passport?: {
      user: ISessionUser;
   };
   expires?: Date;
   cookie: Cookie;
}

export class Server {
   public app: Application;
   private server: http.Server | null = null;
   public port: number;

   constructor(port?: number) {
      this.app = express();
      this.port = !port
         ? process.env.ENVIRONMENT == 'PROD'
            ? Number(process.env.PROD_PORT)
            : Number(process.env.LOCAL_PORT)
         : port;
      this.app.use(
         '/public',
         express.static(path.join(process.cwd(), 'public')),
      );

      if (!this.port) {
         throw new Error('Environments does not load up properly.');
      }

      this.registerMiddlewares();
      this.regsiterRoutes();

      connectDatabase();
      process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
      process.on('SIGINT', () => this.handleShutdown('SIGINT'));
      console.log(
         `HTTP Application server ready to be started at ${this.port}`,
      );
   }

   registerMiddlewares() {
      passportConfig();
      this.app.set('trust proxy', 1); // Add this before middleware registration
      this.app.use((req, res, next) => {
         if (
            req.originalUrl === '/api/v1/others/webhook' ||
            req.originalUrl === '/api/v1/others/webhook/connect'
         ) {
            next();
         } else {
            jsonParser(req, res, next);
         }
      });

      this.app.use(cookieParser());
      //  sessions
      sessionConfig(this.app);

      //this middle ware manually push valid session from db store when cookies not available from client after that passport will take care of everything.
      this.app.use(async (req: Request, res, next) => {
         const sessionId = req.headers['x-session-id'];
         if (
            !sessionId ||
            typeof sessionId !== 'string' ||
            sessionId.trim() === ''
         ) {
            return next();
         }
         const existingSession = req.session;
         const isValidSession = (session: ISession) => {
            return (
               session?.passport &&
               typeof session?.passport === 'object' &&
               session?.passport?.user
            );
         };
         if (!isValidSession(existingSession)) {
            try {
               const session = await new Promise<ISession | null>(
                  (resolve, reject) => {
                     mongoStoreSession.get(sessionId, (err, session) => {
                        if (err) {
                           reject(err);
                           return;
                        }
                        if (!session) {
                           console.log('Session not found or expired.');
                           resolve(null);
                           return;
                        }
                        session['expires'] = session.cookie.expires;
                        resolve(session as ISession);
                     });
                  },
               );

               if (session) {
                  req.sessionID = sessionId;
                  req.session['passport'] = session.passport;

                  console.log('Session restored:', session);
               }
            } catch (err) {
               console.error('Error retrieving session:', err);
               return next(err);
            }
         }

         return next();
      });

      this.app.use(passport.initialize());
      this.app.use(passport.session());
      //empty out the user session if csrf token mismatch
      this.app.use((req, res, next) => {
         const clientType = req.headers['client-type'];

         if (!req.session || clientType == 'Mobile') {
            return next();
         }
         const csrfTokenFromSession = req.session?.['csrf'];
         const tokenFromClientHeaders = req.headers['x-csrf-token'];
         if (csrfTokenFromSession !== tokenFromClientHeaders) {
            req.user = undefined;
         }
         next();
      });
      this.app.use(express.urlencoded({ limit: '50mb', extended: true }));
      this.app.use(
         cors({
            origin: (origin, callback) => {
               // Allow requests from any origin
               callback(null, true);
            },
            // origin: "*",
            credentials: true, // Allow cookies and other credentials
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            allowedHeaders: [
               'Content-Type',
               'Authorization',
               'x-csrf-token',
               'client-type',
               'x-session-id',
            ],
            exposedHeaders: ['set-cookie'],
         }),
      );
      // global error handler
      router.use((err, req, res, next) => {
         if (err instanceof ApiError) {
            res.status(err.statusCode).json({
               status: err.statusCode,
               success: err.success,
               message: err.message,
               errorKey: err.errorKey,
               data: err.data,
            });
            next();
         } else {
            res.status(500).json({ message: err.message });
         }
      });
   }

   regsiterRoutes() {
      //api version v1 parent path setup here
      this.app.use('/api/v1', router);
      this.app.use(
         '/api-docs',
         swaggerUi.serve,
         swaggerUi.setup(swaggerDocument),
      );

      this.app.get('/', (req: Request, res: Response) => {
         res.status(200).json({
            message: `App running on version ch  ${version}`,
         });
      });
   }
   async handleShutdown(signal: string) {
      console.log(`${signal} received, shutting down gracefully`);

      try {
         if (this.server) {
            await new Promise<void>((resolve, reject) => {
               this.server.close(async (err) => {
                  if (err) {
                     console.error('Error closing HTTP server:', err);
                     reject(err);
                     return;
                  }
                  console.log('HTTP server closed');
                  stopPolling();
                  process.exit(0);

                  // try {
                  //    // await closeWorkers();
                  //    console.log('All connections closed');
                  //    resolve();
                  // } catch (workerErr) {
                  //    console.error('Error closing workers:', workerErr);
                  //    reject(workerErr);
                  // }
               });
            });
         } else {
            console.log('Server not running, exiting immediately');
         }
      } catch (err) {
         console.error('Could not shut down server properly:', err);
      } finally {
         process.exit(0);
      }
   }

   start() {
      const env = process.env.ENVIRONMENT;
      if (env == 'PROD') {
         // const port = Number(this.port);
         // console.log(env, port);
         // const sslKey = fs.readFileSync(
         //    process.env.SSL_PRIV_KEY as string,
         //    'utf-8',
         // );
         // const sslCert = fs.readFileSync(
         //    process.env.SSL_CERT as string,
         //    'utf-8',
         // );
         // const options: https.ServerOptions = {
         //    key: sslKey,
         //    cert: sslCert,
         // };
         this.server = http.createServer(this.app);
         console.log(this.port);
         this.server.listen(this.port, () => {
            console.log(`PROD HTTPS Server running on port ${this.port}...`);
         });
      } else {
         this.server = http.createServer(this.app);
         this.server.listen(this.port, () => {
            console.log(`HTTP Server running on port ${this.port}...`);
         });
      }
   }
}
