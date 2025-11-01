import 'dotenv/config';
import "express-async-errors"
import { NextFunction, Request, Response } from 'express';
import express, { Application } from 'express';
import connectDatabase from './api/v1/config/db';
import cors from 'cors';
import env from './api/v1/config/env';
import http from 'http';
import router from './api/v1/routes/index';
import cookieParser from 'cookie-parser';
import MongoStore from 'connect-mongo';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './../swagger.json';
import path from 'path';
import { ApiError } from './api/v1/utils/error-handlers/ApiError';
import mongoSanitize from 'express-mongo-sanitize';
import { agenda, startAgenda } from './api/v1/config/agenda';
import { scheduleCleanupResource } from './api/uploads/jobs';
import { createPassportSessionhandler, PassportSessionHandlerType } from './api/v1/config/passport/passport.helper';
import { logger } from './api/v1/config/logger/logger';
import useragent from 'express-useragent';
import { createAuthSessionManager, SessionMangerType, SetupPlaceSessionConfig, setupPlaceSessionConfig } from './api/v1/config/session/session.helper';

const version = '0.0.1';
const jsonParser = express.json();

export const mongoStoreSession = MongoStore.create({
   mongoUrl: env.MONGO_URL,
   collectionName: 'sessions',
});



export class Server {
   public app: Application;
   private server: http.Server | null = null;
   public port: number;
   private expressSessionHandler: SessionMangerType
   private passportSessionHandler: PassportSessionHandlerType
   private placeSessionConfig: SetupPlaceSessionConfig

   constructor(port?: number) {
      this.app = express();
      this.expressSessionHandler = createAuthSessionManager(this.app)
      this.passportSessionHandler = createPassportSessionhandler(this.app)
      this.placeSessionConfig = setupPlaceSessionConfig(this.app);


      this.port = !port
         ? env.NODE_ENV == 'production'
            ? Number(env.PROD_PORT)
            : Number(env.LOCAL_PORT)
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

   registerSchedulars() {
      scheduleCleanupResource()
   }

   registerMiddlewares() {
      this.app.set('trust proxy', 1);
      this.app.disable("etag");

      this.app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

      this.app.use(mongoSanitize({ replaceWith: '_', allowDots: false }));

      this.app.use(
         cors({
            origin: (origin, callback) => callback(null, true),
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: [
               'Content-Type',
               'Authorization',
               'x-csrf-token',
               'client-type',
               'x-session-id',
               'x-currency'
            ],
            exposedHeaders: ['set-cookie'],
         }),
      );

      this.app.use(useragent.express());
      this.app.use(cookieParser());

      this.placeSessionConfig.attachPreSessionOptions()
      // Sessions
      this.expressSessionHandler.syncSessionCookie();
      this.expressSessionHandler.intializeExpressSession();
      this.placeSessionConfig.initializeSessionOptions()
      this.expressSessionHandler.cleanupSessionCookie();

      // Passport
      this.passportSessionHandler.intializePassportStrategies();
      this.passportSessionHandler.registerMainPassportSession();

      // CSRF protection (after session + passport)
      this.expressSessionHandler.enforceCsrfProtection();
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
            message: `App running on version ${version}`,
         });
      });
      this.app.use("*", (_req: Request, res: Response) => {
         res.status(404).json({
            status: 404,
            success: false,
            message: "Route not found please recheck api end point.",
         });
      });
      // global error handler
      this.app.use((err: ApiError | unknown, _req: Request, res: Response, _next: NextFunction) => {

         logger.debug(`${err instanceof Error ? err?.message : err}`, 'GLOBAL_ERROR_MIDDLEWARE');
         if (err instanceof SyntaxError && "body" in err) {
            return res.status(400).json({
               status: 400,
               success: false,
               message: "Invalid JSON in request body",
            });
         }

         if (err instanceof ApiError) {
            return res.status(err.statusCode).json({
               status: err.statusCode,
               success: err.success,
               message: err.message,
               errorKey: err.errorKey,
               data: err.data,
            });
         }
         return res.status(500).json({
            status: 500,
            success: false,
            message: "Internal Server Error",
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

                  try {
                     await agenda.stop();
                     await agenda.close();
                     console.log("Agenda stopped gracefully");
                  } catch (err) {
                     console.error("Error stopping Agenda:", err);
                  }
                  resolve();
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

      const enviroment = env.NODE_ENV

      this.server = http.createServer(this.app);
      startAgenda().then(() => {
         this.server.listen(this.port, () => {
            console.log(`${enviroment} HTTP Server running on port ${this.port}...`);
         });
         this.registerSchedulars()
      });
      return this.server
   }

}