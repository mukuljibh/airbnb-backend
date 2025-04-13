import MongoStore from 'connect-mongo';
import session from 'express-session';
import { Application } from 'express';
import {
   convertDateInFutureInSecond,
   generateExpTime,
} from '../utils/date-helper/dates.utils';

export function sessionConfig(app: Application) {
   const timeUnit = '1d';
   const expireDate = generateExpTime(timeUnit);
   const expireSecondForTtl = convertDateInFutureInSecond(timeUnit);
   app.use(
      '/api/v1/guest',
      session({
         name: 'userSession',
         secret: process.env.SESSION_SECRET,
         resave: false,
         saveUninitialized: false,
         store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL,
            collectionName: 'sessions',
            ttl: expireSecondForTtl,
         }),
         cookie: {
            httpOnly: true,
            secure: process.env.ENVIRONMENT === 'PROD',
            sameSite: process.env.ENVIRONMENT === 'PROD' ? 'none' : 'lax',
            path: '/api/v1/guest',
            expires: expireDate,
         },
         proxy: true,
      }),
   );

   // Host session
   app.use(
      '/api/v1/host',
      session({
         name: 'hostSession',
         secret: process.env.SESSION_SECRET,
         resave: false,
         saveUninitialized: false,
         store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL,
            collectionName: 'sessions',
            ttl: expireSecondForTtl,
         }),
         cookie: {
            httpOnly: true,
            secure: process.env.ENVIRONMENT === 'PROD',
            sameSite: process.env.ENVIRONMENT === 'PROD' ? 'none' : 'lax',
            path: '/api/v1/host',
            expires: expireDate,
         },
         proxy: true,
      }),
   );

   // Admin session
   app.use(
      '/api/v1/admin',
      session({
         name: 'adminSession',
         secret: process.env.SESSION_SECRET,
         resave: false,
         saveUninitialized: false,
         store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL,
            collectionName: 'sessions',
            ttl: expireSecondForTtl,
         }),
         cookie: {
            httpOnly: true,
            secure: process.env.ENVIRONMENT === 'PROD',
            sameSite: process.env.ENVIRONMENT === 'PROD' ? 'none' : 'lax',
            path: '/api/v1/admin',
            expires: expireDate,
         },
         proxy: true,
      }),
   );
   app.use(
      '/',
      session({
         secret: process.env.SESSION_SECRET,
         resave: false,
         saveUninitialized: false,
         store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL,
            collectionName: 'sessions',
            ttl: expireSecondForTtl,
         }),
         proxy: true,
      }),
   );
}
