import express from 'express';
import generalRoutes from './general/index';
import adminRoutes from './admin/index';
import otherRoutes from './others/index';

const router = express.Router();

/* 
|--------------------------------------------------------------------------
| Route Definitions
|--------------------------------------------------------------------------
*/

// General user routes
router.use('/guest', generalRoutes);

// host user routes
router.use('/host', generalRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Miscellaneous routes
router.use('/others', otherRoutes);

export default router;
