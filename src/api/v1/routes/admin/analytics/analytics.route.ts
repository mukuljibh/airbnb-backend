import express from 'express';
import * as adminAnalyticsController from '../../../controllers/admin/analytics/analytics.controller';
const router = express.Router();

router.get('/dashboard', adminAnalyticsController.getAdminDashboardAnalytic);
router.get('/revenue', adminAnalyticsController.getRevenueDashboardAnalytic);

export default router;
