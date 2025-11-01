import express from 'express';
import hostRoutes from './host/index'
import guestRoutes from './guest/index'

import adminRoutes from './admin/index';
import otherRoutes from './others/index';
import { placeCurrencyIntoRequest } from '../middleware/currency/currency.middleware';
// import { attachSessionOptions } from '../middleware/sessions/session.middleware';
import parseQueryOptions from '../middleware/pagination/pagination.middleware';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Route Definitions
|--------------------------------------------------------------------------
*/

//assign currency in to res locale object from client

const registerOptions = [
    placeCurrencyIntoRequest,
    parseQueryOptions
];
// General user routes
router.use('/guest', registerOptions, guestRoutes);

// host user routes
router.use('/host', registerOptions, hostRoutes);

// Admin routes
router.use('/admin', registerOptions, adminRoutes);

// Miscellaneous routes
router.use('/others', registerOptions, otherRoutes);


export default router;
